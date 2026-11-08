import process from 'node:process'

function required(name: string): string {
  const value = process.env[name]
  if (value === undefined || value === '')
    throw new Error(`Missing required environment variable ${name}`)
  return value
}

/** Neon Postgres. The one variable both Vercel and Actions hold. */
export function databaseUrl(): string {
  return required('DATABASE_URL')
}

/** Session signing key. Vercel only — the pipeline has no sessions. */
export function sessionSecret(): string {
  return required('SESSION_SECRET')
}

/** Optional provider credentials for author-only project storage readings. */
export function neonStorageCredentials() {
  const projectId = process.env.NEON_PROJECT_ID
  const apiKey = process.env.NEON_API_KEY
  return apiKey && projectId && /^[a-z0-9-]{1,60}$/.test(projectId) ? { projectId, apiKey } : null
}
