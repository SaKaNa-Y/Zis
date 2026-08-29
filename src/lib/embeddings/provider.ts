/**
 * The embedding identity stored with vectors.
 *
 * It describes reproducible model semantics, not the runtime that happened to
 * execute them. A local Transformers.js run and a remote provider can therefore
 * be swapped without turning the provider vendor into application data.
 */
export const EMBEDDING_MODEL = 'bge-small-en-v1.5' as const
export const EMBEDDING_DIMENSIONS = 384 as const
export const EMBEDDING_VERSION = 'bge-small-en-v1.5:cls:l2:no-prefix:v1' as const

export interface EmbeddingProvider {
  readonly model: typeof EMBEDDING_MODEL
  readonly dimensions: typeof EMBEDDING_DIMENSIONS
  readonly version: typeof EMBEDDING_VERSION

  /** Embed text exactly as supplied; callers own any domain-specific shaping. */
  embed: (texts: readonly string[]) => Promise<readonly Float32Array[]>
}
