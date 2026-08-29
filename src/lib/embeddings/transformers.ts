import type { EmbeddingProvider } from './provider'
import type { SafeFetch } from '@/lib/safe-fetch'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { MAX_RESPONSE_BYTES } from '@/lib/safe-fetch'
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
} from './provider'

export {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
} from './provider'

export const TRANSFORMERS_MODEL_ID = 'Xenova/bge-small-en-v1.5' as const
export const TRANSFORMERS_MODEL_REVISION = 'ea104dacec62c0de699686887e3f920caeb4f3e3' as const
export const TRANSFORMERS_BATCH_SIZE = 32 as const
export const TRANSFORMERS_CACHE_DIR = resolve(process.cwd(), '.cache/transformers')
export const TRANSFORMERS_MODEL_FILE_BYTES = 133_093_490 as const

const TRANSFORMERS_MODEL_FILE_SHA256 = '828e1496d7fabb79cfa4dcd84fa38625c0d3d21da474a00f08db0f559940cf35'

interface ModelAsset {
  path: string
  kind: 'json' | 'model'
}

const MODEL_ASSETS: readonly ModelAsset[] = [
  { path: 'config.json', kind: 'json' },
  { path: 'tokenizer.json', kind: 'json' },
  { path: 'tokenizer_config.json', kind: 'json' },
  { path: 'onnx/model.onnx', kind: 'model' },
]

export interface FeatureExtractionResult {
  tolist: () => unknown
}

export type FeatureExtractor = (
  texts: string[],
  options: Readonly<{
    pooling: 'cls'
    normalize: true
  }>,
) => Promise<FeatureExtractionResult>

export interface TransformersLoadOptions {
  revision: typeof TRANSFORMERS_MODEL_REVISION
  dtype: 'fp32'
  device: 'cpu'
  cache_dir: string
  local_files_only: true
}

export type TransformersLoader = (
  task: 'feature-extraction',
  modelId: typeof TRANSFORMERS_MODEL_ID,
  options: TransformersLoadOptions,
) => Promise<FeatureExtractor>

interface TransformersEmbeddingProviderBaseOptions {
  cacheDir?: string
}

export type TransformersEmbeddingProviderOptions = TransformersEmbeddingProviderBaseOptions & (
  | {
    /** Full dependency seam for tests; production uses the guarded local loader. */
    load: TransformersLoader
    fetcher?: never
  }
  | {
    load?: never
    /** The only egress used to fill a cold pinned-model cache. */
    fetcher: SafeFetch
  }
)

function missingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

function assetPath(cacheDir: string, asset: ModelAsset): string {
  return join(cacheDir, TRANSFORMERS_MODEL_ID, TRANSFORMERS_MODEL_REVISION, asset.path)
}

async function cachedAssetIsValid(path: string, asset: ModelAsset): Promise<boolean> {
  try {
    if (asset.kind === 'model')
      return (await stat(path)).size === TRANSFORMERS_MODEL_FILE_BYTES
    JSON.parse(await readFile(path, 'utf8'))
    return true
  }
  catch (error) {
    if (missingFile(error) || error instanceof SyntaxError)
      return false
    throw error
  }
}

function validateJsonAsset(bytes: Uint8Array, asset: ModelAsset): void {
  try {
    JSON.parse(new TextDecoder().decode(bytes))
  }
  catch (cause) {
    throw new Error(`${asset.path} is not valid JSON`, { cause })
  }
}

async function replaceTemporaryAsset(path: string, temporary: string): Promise<void> {
  try {
    await unlink(path)
  }
  catch (error) {
    if (!missingFile(error))
      throw error
  }
  await rename(temporary, path)
}

async function replaceCachedAsset(path: string, bytes: Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, bytes, { flag: 'wx' })
    await replaceTemporaryAsset(path, temporary)
  }
  catch (error) {
    await unlink(temporary).catch(() => {})
    throw error
  }
}

interface RangedAssetDescriptor {
  byteLength: number
  sha256: string
  chunkBytes?: number
}

/** Download a large pinned asset without weakening safeFetch's per-request limits. */
export async function downloadRangedAsset(
  fetcher: SafeFetch,
  url: string,
  path: string,
  descriptor: RangedAssetDescriptor,
): Promise<void> {
  const chunkBytes = descriptor.chunkBytes ?? MAX_RESPONSE_BYTES
  if (!Number.isSafeInteger(descriptor.byteLength) || descriptor.byteLength <= 0)
    throw new TypeError('byteLength must be a positive safe integer')
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes <= 0 || chunkBytes > MAX_RESPONSE_BYTES)
    throw new TypeError(`chunkBytes must be between 1 and ${MAX_RESPONSE_BYTES}`)
  if (!/^[a-f\d]{64}$/i.test(descriptor.sha256))
    throw new TypeError('sha256 must be a 64-character hexadecimal digest')

  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`
  const digest = createHash('sha256')
  let handle: Awaited<ReturnType<typeof open>> | undefined

  try {
    handle = await open(temporary, 'wx')
    for (let start = 0; start < descriptor.byteLength; start += chunkBytes) {
      const end = Math.min(start + chunkBytes, descriptor.byteLength) - 1
      const expectedBytes = end - start + 1
      const response = await fetcher(url, {
        headers: {
          'accept-encoding': 'identity',
          'range': `bytes=${start}-${end}`,
        },
      })
      const expectedContentRange = `bytes ${start}-${end}/${descriptor.byteLength}`

      if (response.status !== 206)
        throw new Error(`Ranged asset returned HTTP ${response.status}; expected 206`)
      if (response.headers['content-range'] !== expectedContentRange) {
        throw new Error(
          `Ranged asset returned Content-Range ${response.headers['content-range'] ?? '<missing>'}; expected ${expectedContentRange}`,
        )
      }
      if (response.byteLength !== expectedBytes || response.bytes.byteLength !== expectedBytes) {
        throw new Error(
          `Ranged asset returned ${response.bytes.byteLength} bytes; expected ${expectedBytes}`,
        )
      }

      let written = 0
      while (written < response.bytes.byteLength) {
        const result = await handle.write(
          response.bytes,
          written,
          response.bytes.byteLength - written,
          start + written,
        )
        if (result.bytesWritten === 0)
          throw new Error('Ranged asset cache write made no progress')
        written += result.bytesWritten
      }
      digest.update(response.bytes)
    }

    if (digest.digest('hex') !== descriptor.sha256)
      throw new Error('Ranged asset does not match the pinned checksum')

    await handle.sync()
    await handle.close()
    handle = undefined
    await replaceTemporaryAsset(path, temporary)
  }
  catch (error) {
    await handle?.close().catch(() => {})
    await unlink(temporary).catch(() => {})
    throw error
  }
}

/** Fill Transformers.js's pinned filesystem cache without exposing a second egress. */
export async function prepareTransformersModelCache(
  fetcher: SafeFetch,
  cacheDir: string = TRANSFORMERS_CACHE_DIR,
): Promise<void> {
  for (const asset of MODEL_ASSETS) {
    const path = assetPath(cacheDir, asset)
    if (await cachedAssetIsValid(path, asset))
      continue

    const url = `https://huggingface.co/${TRANSFORMERS_MODEL_ID}/resolve/${TRANSFORMERS_MODEL_REVISION}/${asset.path}`
    if (asset.kind === 'model') {
      await downloadRangedAsset(fetcher, url, path, {
        byteLength: TRANSFORMERS_MODEL_FILE_BYTES,
        sha256: TRANSFORMERS_MODEL_FILE_SHA256,
      })
      continue
    }

    const response = await fetcher(url)
    if (response.status !== 200)
      throw new Error(`Pinned model asset ${asset.path} returned HTTP ${response.status}`)
    validateJsonAsset(response.bytes, asset)
    await replaceCachedAsset(path, response.bytes)
  }
}

function guardedTransformersLoader(fetcher: SafeFetch): TransformersLoader {
  return async (task, modelId, options) => {
    await prepareTransformersModelCache(fetcher, options.cache_dir)
    const { pipeline } = await import('@huggingface/transformers')
    const extractor = await pipeline(task, modelId, options)
    return extractor as unknown as FeatureExtractor
  }
}

function numericRow(value: unknown): readonly number[] | undefined {
  if (Array.isArray(value))
    return value as unknown[] as number[]

  if (ArrayBuffer.isView(value))
    return Array.from(value as unknown as ArrayLike<number>)

  return undefined
}

function validateBatch(value: unknown, expectedRows: number): readonly Float32Array[] {
  if (!Array.isArray(value) || value.length !== expectedRows) {
    throw new Error(
      `Embedding model must return ${expectedRows} rows; received ${Array.isArray(value) ? value.length : 'non-array output'}.`,
    )
  }

  return value.map((candidate, rowIndex) => {
    const row = numericRow(candidate)
    if (row?.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Embedding row ${rowIndex} must have ${EMBEDDING_DIMENSIONS} dimensions; received ${row?.length ?? 'non-array output'}.`,
      )
    }

    if (!row.every(component => typeof component === 'number' && Number.isFinite(component)))
      throw new Error(`Embedding row ${rowIndex} must contain only finite numbers.`)

    const embedding = Float32Array.from(row)
    if (!embedding.every(component => Number.isFinite(component)))
      throw new Error(`Embedding row ${rowIndex} must contain only finite numbers after fp32 conversion.`)

    return embedding
  })
}

/**
 * Run the settled BGE embedding semantics locally on CPU.
 *
 * The model is loaded only for the first non-empty request. Calls on the same
 * provider share that load, while a failed load is forgotten so a later run can
 * recover after a transient cache or download failure.
 */
export function createTransformersEmbeddingProvider(
  options: TransformersEmbeddingProviderOptions,
): EmbeddingProvider {
  const cacheDir = options.cacheDir ?? TRANSFORMERS_CACHE_DIR
  const load = options.load ?? guardedTransformersLoader(options.fetcher)
  let extractorPromise: Promise<FeatureExtractor> | undefined

  function getExtractor(): Promise<FeatureExtractor> {
    if (extractorPromise !== undefined)
      return extractorPromise

    const loading = load('feature-extraction', TRANSFORMERS_MODEL_ID, {
      revision: TRANSFORMERS_MODEL_REVISION,
      dtype: 'fp32',
      device: 'cpu',
      cache_dir: cacheDir,
      local_files_only: true,
    })
    extractorPromise = loading
    void loading.catch(() => {
      if (extractorPromise === loading)
        extractorPromise = undefined
    })
    return loading
  }

  return {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    version: EMBEDDING_VERSION,
    async embed(texts) {
      if (texts.length === 0)
        return []

      const extractor = await getExtractor()
      const embeddings: Float32Array[] = []

      for (let offset = 0; offset < texts.length; offset += TRANSFORMERS_BATCH_SIZE) {
        const batch = texts.slice(offset, offset + TRANSFORMERS_BATCH_SIZE)
        const result = await extractor(batch, { pooling: 'cls', normalize: true })
        embeddings.push(...validateBatch(result.tolist(), batch.length))
      }

      return embeddings
    },
  }
}
