import { Buffer } from 'node:buffer'
import { neon, Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { databaseUrl } from '@/lib/env'
import * as schema from './schema'

/**
 * One schema-aware client shared by the app and pipeline. Reads and small
 * commits use HTTP; large atomic commits use a scoped WebSocket connection.
 * Built on first use so a surface that never touches the corpus needs no URL.
 */
let client: ReturnType<typeof build> | undefined

export interface DatabaseStatement {
  sql: string
  params: unknown[]
}

function build() {
  const connectionString = databaseUrl()
  const http = neon(connectionString)
  return Object.assign(drizzle(http, { schema }), {
    async commit(statements: DatabaseStatement[]): Promise<void> {
      // Neon's HTTP envelope is limited to 64 MiB. Leave room for the driver's
      // parameter encoding and avoid allocating the entire envelope to size it.
      const bytes = statements.reduce((total, statement) =>
        total + Buffer.byteLength(JSON.stringify(statement)), 0)
      if (bytes <= 16 * 1024 * 1024) {
        await http.transaction(statements.map(statement => http.query(statement.sql, statement.params)))
        return
      }

      // Stream large writes on one connection: splitting HTTP transactions
      // would expose a partially updated Signal graph or Brief.
      const pool = new Pool({ connectionString })
      try {
        const connection = await pool.connect()
        let failed = true
        try {
          await connection.query('BEGIN')
          for (const statement of statements)
            await connection.query(statement.sql, statement.params)
          await connection.query('COMMIT')
          failed = false
        }
        catch (error) {
          // Preserve the write failure even if the connection also lost rollback.
          await connection.query('ROLLBACK').catch(() => {})
          throw error
        }
        finally {
          connection.release(failed)
        }
      }
      finally {
        await pool.end()
      }
    },
  })
}

export type Database = ReturnType<typeof build>

export function db(): Database {
  client ??= build()
  return client
}
