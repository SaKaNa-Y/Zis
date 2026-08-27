import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { databaseUrl } from '@/lib/env'
import * as schema from './schema'

/**
 * One Drizzle client over Neon's HTTP driver, shared by the app and the
 * pipeline. Built on first use rather than at import so that a surface which
 * never touches the corpus never demands `DATABASE_URL`.
 */
let client: ReturnType<typeof build> | undefined

function build() {
  return drizzle(neon(databaseUrl()), { schema })
}

export function db(): ReturnType<typeof build> {
  client ??= build()
  return client
}
