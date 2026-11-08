import { sql } from 'drizzle-orm'
import { verifyAuthor } from '@/lib/auth/dal'
import { db } from '@/lib/db'
import { neonStorageCredentials } from '@/lib/env'
import { safeFetch } from '@/lib/safe-fetch'
import 'server-only'

// Neon Free's database storage allowance per project (October 2026).
const FREE_PROJECT_BYTES = 1_000_000_000
const SAMPLE_WINDOW_MS = 24 * 60 * 60 * 1000

async function readProjectUsage(now: Date) {
  const credentials = neonStorageCredentials()
  if (!credentials)
    return null
  const oldest = now.getTime() - SAMPLE_WINDOW_MS
  const endpoint = new URL('https://console.neon.tech/api/v2/consumption_history/projects')
  endpoint.search = new URLSearchParams({
    project_ids: credentials.projectId,
    metrics: 'logical_size_bytes',
    granularity: 'hourly',
    from: new Date(oldest).toISOString(),
    to: now.toISOString(),
  }).toString()
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
  if (!payload || typeof payload !== 'object' || !('projects' in payload) || !Array.isArray(payload.projects))
    return null
  const project = payload.projects.find(p => p?.project_id === credentials.projectId)
  if (!Array.isArray(project?.periods))
    return null
  let latest: { measuredAt: string, remainingBytes: number } | null = null
  for (const period of project.periods) {
    if (!Array.isArray(period?.consumption))
      continue
    for (const sample of period.consumption) {
      const bytes = sample?.logical_size_bytes
      const time = Date.parse(sample?.timeframe_end)
      if (!Number.isSafeInteger(bytes) || bytes < 0 || !Number.isFinite(time) || time < oldest || time > now.getTime())
        continue
      const measuredAt = new Date(time).toISOString()
      if (!latest || latest.measuredAt < measuredAt)
        latest = { remainingBytes: Math.max(0, FREE_PROJECT_BYTES - bytes), measuredAt }
    }
  }
  return latest
}

export async function readStorage() {
  await verifyAuthor()
  const now = new Date()
  const [database, project] = await Promise.all([
    db().execute<{ bytes: string }>(sql`SELECT pg_database_size(current_database())::text AS bytes`),
    readProjectUsage(now).catch(() => null),
  ])
  const row = database.rows[0]
  if (!row)
    throw new Error('Database size unavailable')
  return { databaseBytes: Number(row.bytes), checkedAt: now, project }
}
