import { defineConfig } from 'drizzle-kit'
import { databaseUrl } from './src/lib/env'

/**
 * `drizzle-kit` is run by hand against production, after taking Neon Free's one
 * manual snapshot. It is deliberately absent from the Vercel build step: a
 * preview build must never migrate a database it does not own
 * (docs/repo-and-ci.md §3).
 */
export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl() },
})
