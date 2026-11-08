import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { databaseUrl } from '@/lib/env'
import * as schema from './schema'

function connect() {
  return drizzle(neon(databaseUrl()), { schema })
}

let client: ReturnType<typeof connect> | undefined
export function db() {
  client ??= connect()
  return client
}
