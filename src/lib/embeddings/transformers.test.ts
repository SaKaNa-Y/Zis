import type {
  FeatureExtractor,
  TransformersLoader,
} from './transformers'
import type { SafeFetch, SafeFetchResponse } from '@/lib/safe-fetch'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, truncate, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  createTransformersEmbeddingProvider,
  downloadRangedAsset,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
  prepareTransformersModelCache,
  TRANSFORMERS_MODEL_FILE_BYTES,
  TRANSFORMERS_MODEL_ID,
  TRANSFORMERS_MODEL_REVISION,
} from './transformers'

function vector(value = 0.25): number[] {
  const values: number[] = []
  for (let index = 0; index < EMBEDDING_DIMENSIONS; index += 1) {
    values.push(value)
  }
  return values
}

function extractorReturning(rows: readonly (readonly number[])[]): FeatureExtractor {
  return vi.fn(async () => ({
    tolist: () => rows,
  }))
}

function fetched(
  bytes: Uint8Array,
  status = 200,
  headers: Record<string, string> = {},
): SafeFetchResponse {
  return {
    url: 'https://huggingface.co/model-asset',
    status,
    headers,
    bytes,
    byteLength: bytes.byteLength,
    text: () => new TextDecoder().decode(bytes),
  }
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

async function warmModelCache(cacheDir: string): Promise<string> {
  const root = join(cacheDir, TRANSFORMERS_MODEL_ID, TRANSFORMERS_MODEL_REVISION)
  const model = join(root, 'onnx/model.onnx')
  await mkdir(dirname(model), { recursive: true })
  await Promise.all([
    writeFile(join(root, 'config.json'), '{}'),
    writeFile(join(root, 'tokenizer.json'), '{}'),
    writeFile(join(root, 'tokenizer_config.json'), '{}'),
    writeFile(model, ''),
  ])
  await truncate(model, TRANSFORMERS_MODEL_FILE_BYTES)
  return root
}

describe('the local Transformers.js embedding provider', () => {
  it('exposes model semantics without making the runtime vendor part of stored metadata', () => {
    const load = vi.fn<TransformersLoader>()
    const provider = createTransformersEmbeddingProvider({ load })

    expect(provider).toMatchObject({
      model: 'bge-small-en-v1.5',
      dimensions: 384,
      version: 'bge-small-en-v1.5:cls:l2:no-prefix:v1',
    })
    expect(EMBEDDING_MODEL).toBe('bge-small-en-v1.5')
    expect(EMBEDDING_VERSION).not.toContain('Xenova')
  })

  it('does not load the model for an empty batch', async () => {
    const load = vi.fn<TransformersLoader>()
    const provider = createTransformersEmbeddingProvider({ load })

    await expect(provider.embed([])).resolves.toEqual([])
    expect(load).not.toHaveBeenCalled()
  })

  it('pins the exact fp32 CPU model and embeds unprefixed text with CLS pooling and L2 normalization', async () => {
    const extractor = extractorReturning([vector(0.5), vector(-0.5)])
    const load = vi.fn<TransformersLoader>().mockResolvedValue(extractor)
    const provider = createTransformersEmbeddingProvider({ load })

    const embeddings = await provider.embed([
      'Reader statement exactly as written',
      'Signal basis exactly as stored',
    ])

    expect(load).toHaveBeenCalledOnce()
    expect(load).toHaveBeenCalledWith(
      'feature-extraction',
      TRANSFORMERS_MODEL_ID,
      {
        revision: TRANSFORMERS_MODEL_REVISION,
        dtype: 'fp32',
        device: 'cpu',
        cache_dir: resolve(process.cwd(), '.cache/transformers'),
        local_files_only: true,
      },
    )
    expect(TRANSFORMERS_MODEL_ID).toBe('Xenova/bge-small-en-v1.5')
    expect(TRANSFORMERS_MODEL_REVISION).toBe('ea104dacec62c0de699686887e3f920caeb4f3e3')
    expect(extractor).toHaveBeenCalledWith(
      [
        'Reader statement exactly as written',
        'Signal basis exactly as stored',
      ],
      { pooling: 'cls', normalize: true },
    )
    expect(embeddings).toHaveLength(2)
    expect(embeddings[0]).toBeInstanceOf(Float32Array)
    expect(embeddings[0]).toHaveLength(384)
    expect(embeddings[0]?.[0]).toBe(0.5)
  })

  it('prefetches a missing pinned asset through safeFetch before local-only loading', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'zis-transformers-'))
    try {
      const root = await warmModelCache(cacheDir)
      const missing = join(root, 'tokenizer_config.json')
      await unlink(missing)
      const fetcher = vi.fn<SafeFetch>().mockResolvedValue(fetched(new TextEncoder().encode('{"model_max_length":512}')))

      await prepareTransformersModelCache(fetcher, cacheDir)

      expect(fetcher).toHaveBeenCalledOnce()
      expect(fetcher).toHaveBeenCalledWith(
        `https://huggingface.co/${TRANSFORMERS_MODEL_ID}/resolve/${TRANSFORMERS_MODEL_REVISION}/tokenizer_config.json`,
      )
      expect(await readFile(missing, 'utf8')).toBe('{"model_max_length":512}')
    }
    finally {
      await rm(cacheDir, { recursive: true, force: true })
    }
  })

  it('downloads large assets as independently bounded ranged fetches', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'zis-transformers-'))
    const destination = join(cacheDir, 'model.onnx')
    const source = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    const fetcher = vi.fn<SafeFetch>(async (_url, options = {}) => {
      const range = options.headers?.range
      const match = /^bytes=(\d+)-(\d+)$/.exec(range ?? '')
      if (match === null)
        throw new Error('expected a byte range')
      const start = Number(match[1])
      const end = Number(match[2])
      const bytes = source.slice(start, end + 1)
      return fetched(bytes, 206, {
        'content-range': `bytes ${start}-${end}/${source.byteLength}`,
      })
    })

    try {
      await downloadRangedAsset(fetcher, 'https://example.com/model.onnx', destination, {
        byteLength: source.byteLength,
        chunkBytes: 4,
        sha256: sha256(source),
      })

      expect(fetcher.mock.calls.map(([, options]) => options)).toEqual([
        { headers: { 'accept-encoding': 'identity', 'range': 'bytes=0-3' } },
        { headers: { 'accept-encoding': 'identity', 'range': 'bytes=4-7' } },
        { headers: { 'accept-encoding': 'identity', 'range': 'bytes=8-9' } },
      ])
      expect(Array.from(await readFile(destination))).toEqual(Array.from(source))
    }
    finally {
      await rm(cacheDir, { recursive: true, force: true })
    }
  })

  it('keeps the existing cache file when the completed download fails its pinned checksum', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'zis-transformers-'))
    const destination = join(cacheDir, 'model.onnx')
    const source = Uint8Array.from([1, 2, 3])
    await writeFile(destination, Uint8Array.from([99]))
    const fetcher = vi.fn<SafeFetch>().mockResolvedValue(fetched(
      source,
      206,
      { 'content-range': 'bytes 0-2/3' },
    ))

    try {
      await expect(downloadRangedAsset(
        fetcher,
        'https://example.com/model.onnx',
        destination,
        { byteLength: 3, sha256: '0'.repeat(64) },
      )).rejects.toThrow('does not match the pinned checksum')

      expect(Array.from(await readFile(destination))).toEqual([99])
    }
    finally {
      await rm(cacheDir, { recursive: true, force: true })
    }
  })

  it('rejects a wrong-sized fp32 model before replacing the final cache file', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'zis-transformers-'))
    try {
      const root = await warmModelCache(cacheDir)
      const model = join(root, 'onnx/model.onnx')
      await truncate(model, 1)
      const fetcher = vi.fn<SafeFetch>().mockResolvedValue(fetched(
        new Uint8Array(2),
        206,
        { 'content-range': `bytes 0-8388607/${TRANSFORMERS_MODEL_FILE_BYTES}` },
      ))

      await expect(
        prepareTransformersModelCache(fetcher, cacheDir),
      )
        .rejects
        .toThrow('returned 2 bytes; expected')
      await expect(readFile(model)).resolves.toHaveLength(1)
      const [url, options] = fetcher.mock.calls[0] ?? []
      expect(url).toContain('/onnx/model.onnx')
      expect(options).toEqual({
        headers: {
          'accept-encoding': 'identity',
          'range': 'bytes=0-8388607',
        },
      })
    }
    finally {
      await rm(cacheDir, { recursive: true, force: true })
    }
  })

  it('uses stable batches of at most 32 texts', async () => {
    const extractor = vi.fn<FeatureExtractor>(async texts => ({
      tolist: () => texts.map((_, index) => vector(index)),
    }))
    const load = vi.fn<TransformersLoader>().mockResolvedValue(extractor)
    const provider = createTransformersEmbeddingProvider({ load })
    const texts = Array.from({ length: 65 }, (_, index) => `text-${index}`)

    const embeddings = await provider.embed(texts)

    expect(extractor.mock.calls.map(([batch]) => batch.length)).toEqual([32, 32, 1])
    expect(extractor.mock.calls.flatMap(([batch]) => batch)).toEqual(texts)
    expect(embeddings).toHaveLength(65)
  })

  it('shares a lazy model load across concurrent calls', async () => {
    let finishLoading: ((extractor: FeatureExtractor) => void) | undefined
    const loading = new Promise<FeatureExtractor>((resolveLoading) => {
      finishLoading = resolveLoading
    })
    const load = vi.fn<TransformersLoader>().mockReturnValue(loading)
    const provider = createTransformersEmbeddingProvider({ load })

    const first = provider.embed(['first'])
    const second = provider.embed(['second'])
    expect(load).toHaveBeenCalledOnce()

    finishLoading?.(extractorReturning([vector()]))
    await expect(Promise.all([first, second])).resolves.toHaveLength(2)
    expect(load).toHaveBeenCalledOnce()
  })

  it('clears a failed lazy load so a later call can retry', async () => {
    const load = vi.fn<TransformersLoader>()
      .mockRejectedValueOnce(new Error('model cache unavailable'))
      .mockResolvedValueOnce(extractorReturning([vector()]))
    const provider = createTransformersEmbeddingProvider({ load })

    await expect(provider.embed(['first attempt'])).rejects.toThrow('model cache unavailable')
    await expect(provider.embed(['retry'])).resolves.toHaveLength(1)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it.each([
    {
      name: 'the model returns a different number of rows',
      rows: [] as number[][],
      expected: /1 rows/,
    },
    {
      name: 'a vector has the wrong dimension',
      rows: [[0, 1]],
      expected: /384 dimensions/,
    },
    {
      name: 'a vector contains a non-finite value',
      rows: [vector().map((value, index) => index === 10 ? Number.NaN : value)],
      expected: /finite numbers/,
    },
    {
      name: 'a finite number overflows fp32 storage',
      rows: [vector().map((value, index) => index === 10 ? Number.MAX_VALUE : value)],
      expected: /finite numbers/,
    },
  ])('rejects malformed output when $name', async ({ rows, expected }) => {
    const load = vi.fn<TransformersLoader>().mockResolvedValue(extractorReturning(rows))
    const provider = createTransformersEmbeddingProvider({ load })

    await expect(provider.embed(['one text'])).rejects.toThrow(expected)
  })
})
