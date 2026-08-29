import { sql } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { db } from '@/lib/db'
import { SESSION_COOKIE_NAME, verifySessionToken } from './session'
import 'server-only'

export interface VerifiedSession {
  userId: string
}

export interface VerifySessionDependencies {
  readToken: () => Promise<string | undefined>
  readSessionVersion: (userId: string) => Promise<number | null>
  unauthorized: () => never
}

export function createVerifySession(
  dependencies: VerifySessionDependencies,
): () => Promise<VerifiedSession> {
  return async () => {
    const token = await dependencies.readToken()
    const session = await verifySessionToken(token)
    if (session === null)
      return dependencies.unauthorized()

    const storedVersion = await dependencies.readSessionVersion(session.userId)
    if (storedVersion === null || storedVersion !== session.sessionVersion)
      return dependencies.unauthorized()

    return { userId: session.userId }
  }
}

async function readSessionVersion(userId: string): Promise<number | null> {
  const result = await db().execute<{ session_version: number }>(sql`
    SELECT "session_version"
    FROM "user"
    WHERE "id" = ${userId}::uuid
    LIMIT 1
  `)
  return result.rows[0]?.session_version ?? null
}

export const verifySession = cache(createVerifySession({
  readSessionVersion,
  readToken: async () => (await cookies()).get(SESSION_COOKIE_NAME)?.value,
  unauthorized: () => redirect('/login'),
}))
