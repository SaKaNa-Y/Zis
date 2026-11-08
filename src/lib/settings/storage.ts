import { sql } from 'drizzle-orm'
import { verifyAuthor } from '@/lib/auth/dal'
import { db } from '@/lib/db'
import { neonStorageCredentials } from '@/lib/env'
import { safeFetch } from '@/lib/safe-fetch'
import 'server-only'

// Neon Free's database storage allowance per project (October 2026).
const FREE_PROJECT_BYTES = 1_000_000_000

async function readProjectUsage() {
  const credentials = neonStorageCredentials()
  if (!credentials)
    return null
  const endpoint = new URL(`https://console.neon.tech/api/v2/projects/${credentials.projectId}/branches?limit=2`)
  const response = await safeFetch(endpoint.href, {
    headers: { Authorization: `Bearer ${credentials.apiKey}` },
    timeoutMs: 5000,
    beforeRequest: async (url) => {
      if (url !== endpoint.href)
        throw new Error('Unexpected redirect from Neon')
    },
  })
  if (response.status !== 200)
    return null
  const payload: unknown = JSON.parse(response.text())
  // Neon counts root data at its logical size. A child shares some of its
  // parent's data, so its logical size cannot establish project usage.
  if (!payload || typeof payload !== 'object' || !('branches' in payload)
    || !Array.isArray(payload.branches) || payload.branches.length !== 1) {
    return null
  }
  if ('pagination' in payload && payload.pagination && typeof payload.pagination === 'object'
    && 'next' in payload.pagination && payload.pagination.next) {
    return null
  }
  const branch: unknown = payload.branches[0]
  if (!branch || typeof branch !== 'object' || !('project_id' in branch)
    || branch.project_id !== credentials.projectId || ('parent_id' in branch && branch.parent_id)
    || !('logical_size' in branch) || typeof branch.logical_size !== 'number'
    || !Number.isSafeInteger(branch.logical_size) || branch.logical_size < 0) {
    return null
  }
  return { remainingBytes: Math.max(0, FREE_PROJECT_BYTES - branch.logical_size) }
}

export async function readStorage() {
  await verifyAuthor()
  const now = new Date()
  const [database, project] = await Promise.all([
    db().execute<{ bytes: string }>(sql`SELECT pg_database_size(current_database())::text AS bytes`),
    readProjectUsage().catch(() => null),
  ])
  const row = database.rows[0]
  if (!row)
    throw new Error('Database size unavailable')
  return { databaseBytes: Number(row.bytes), checkedAt: now, project }
}
