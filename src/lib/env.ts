/**
 * The canonical reader for every environment variable Zis has.
 *
 * `.env.example` is the canonical *list* and `pnpm check:env` asserts every name
 * in it is read somewhere in source — this module is where they are read.
 *
 * Each variable is read through its own accessor, at call time, rather than
 * validated eagerly at import. That is not laziness for its own sake: the Vercel
 * and Actions variable sets are deliberately nearly disjoint
 * (docs/repo-and-ci.md §4), so an eager check would demand `DEEPSEEK_API_KEY` of
 * the UI, which is precisely the reach the asymmetry exists to deny. Reading at
 * the point of use means each surface fails closed on exactly the variables it
 * actually needs — which is also what makes a preview with no production
 * `DATABASE_URL` unable to connect rather than able to write.
 */

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

/** DeepSeek. Actions only — a UI compromise cannot spend the AI budget. */
export function deepseekApiKey(): string {
  return required('DEEPSEEK_API_KEY')
}

/** Cloudflare Workers AI account. Actions only. */
export function cloudflareAccountId(): string {
  return required('CLOUDFLARE_ACCOUNT_ID')
}

/** Cloudflare Workers AI token. Actions only. */
export function cloudflareApiToken(): string {
  return required('CLOUDFLARE_API_TOKEN')
}

/**
 * Fine-grained PAT with zero permissions selected — nothing but the default
 * public read (docs/repo-and-ci.md §5). Actions only.
 */
export function githubPat(): string {
  return required('GITHUB_PAT')
}
