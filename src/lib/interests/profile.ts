import type { Database } from '@/lib/db'
import { and, asc, eq, notInArray } from 'drizzle-orm'
import { interests } from '@/lib/db/schema'
import { guardInterestProfiles } from './concurrency'
import { ProfileValidationError, validateProfile } from './validation'
import 'server-only'

export function createInterestProfile(dependencies: {
  database: () => Database
  verifySession: () => Promise<{ userId: string }>
}) {
  return {
    async read() {
      const { userId } = await dependencies.verifySession()
      return dependencies.database().select({ id: interests.id, statement: interests.statement }).from(interests).where(eq(interests.userId, userId)).orderBy(asc(interests.createdAt), asc(interests.id))
    },
    async save(value: unknown) {
      const { userId } = await dependencies.verifySession()
      const input = validateProfile(value)
      const database = dependencies.database()
      const owned = await database.select({ id: interests.id, userId: interests.userId, statement: interests.statement }).from(interests).where(eq(interests.userId, userId))
      if (input.some(row => row.id !== undefined && !owned.some(interest => interest.id === row.id)))
        throw new ProfileValidationError('An Interest no longer exists in your Profile. Reload and try again.')
      const retained = input.flatMap(row => row.id === undefined ? [] : [row.id])
      const statements = [database.delete(interests).where(and(eq(interests.userId, userId), retained.length ? notInArray(interests.id, retained) : undefined))]
      await database.commit([
        ...guardInterestProfiles(owned, [userId]),
        ...statements.map(statement => statement.toSQL()),
        ...input.map((row, index) => row.id === undefined
          ? database.insert(interests).values({ userId, statement: row.statement.trim(), createdAt: new Date(Date.now() + index) }).toSQL()
          : database.update(interests).set({ statement: row.statement.trim(), updatedAt: new Date() }).where(and(eq(interests.userId, userId), eq(interests.id, row.id))).toSQL()),
      ])
    },
  }
}
