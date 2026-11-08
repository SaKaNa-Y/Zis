import { sql } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import { db } from '@/lib/db'
import { SESSION_COOKIE_NAME, verifySessionToken } from './session'
import 'server-only'

export interface VerifiedSession {
  role: 'reader' | 'author'
  userId: string
  sessionVersion: number
}

export interface VerifySessionDependencies {
  readToken: () => Promise<string | undefined>
  readAccount: (userId: string) => Promise<Omit<VerifiedSession, 'userId'> | null>
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

    const account = await dependencies.readAccount(session.userId)
    if (account === null || account.sessionVersion !== session.sessionVersion)
      return dependencies.unauthorized()

    return { userId: session.userId, ...account }
  }
}

async function readAccount(userId: string) {
  const result = await db().execute<{ sessionVersion: number, role: VerifiedSession['role'] }>(sql`
    SELECT session_version AS "sessionVersion", role
    FROM "user"
    WHERE id = ${userId}::uuid AND revoked_at IS NULL
  `)
  return result.rows[0] ?? null
}

export const verifySession = cache(createVerifySession({
  readAccount,
  readToken: async () => (await cookies()).get(SESSION_COOKIE_NAME)?.value,
  unauthorized: () => redirect('/login'),
}))

export async function verifyAuthor() {
  const identity = await verifySession()
  if (identity.role !== 'author')
    notFound()
  return identity
}
