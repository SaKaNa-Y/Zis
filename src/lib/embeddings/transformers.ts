import type { EmbeddingProvider } from './provider'
import { resolve } from 'node:path'
import process from 'node:process'
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
}

export type TransformersLoader = (
  task: 'feature-extraction',
  modelId: typeof TRANSFORMERS_MODEL_ID,
  options: TransformersLoadOptions,
) => Promise<FeatureExtractor>

export interface TransformersEmbeddingProviderOptions {
  /** Dependency seam for tests; production lazily imports Transformers.js. */
  load?: TransformersLoader
  cacheDir?: string
}

const loadTransformersPipeline: TransformersLoader = async (task, modelId, options) => {
  const { pipeline } = await import('@huggingface/transformers')
  const extractor = await pipeline(task, modelId, options)
  return extractor as unknown as FeatureExtractor
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
  options: TransformersEmbeddingProviderOptions = {},
): EmbeddingProvider {
  const load = options.load ?? loadTransformersPipeline
  const cacheDir = options.cacheDir ?? TRANSFORMERS_CACHE_DIR
  let extractorPromise: Promise<FeatureExtractor> | undefined

  function getExtractor(): Promise<FeatureExtractor> {
    if (extractorPromise !== undefined)
      return extractorPromise

    const loading = load('feature-extraction', TRANSFORMERS_MODEL_ID, {
      revision: TRANSFORMERS_MODEL_REVISION,
      dtype: 'fp32',
      device: 'cpu',
      cache_dir: cacheDir,
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
