import type {
  FeatureExtractor,
  TransformersLoader,
} from './transformers'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  createTransformersEmbeddingProvider,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
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
