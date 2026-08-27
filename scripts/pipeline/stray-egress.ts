// DELIBERATE VIOLATION, removed in the commit after this one. This is the half
// of the tree that actually fetches, so it is the half where a rule scoped only
// to src/ would let a second egress through.
import http from 'node:http'

export async function strayFromScripts(url: string) {
  const direct = await globalThis.fetch(url)
  const secure = await import('node:https')
  return { direct, secure, http }
}
