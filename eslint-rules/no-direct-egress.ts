import type { Rule } from 'eslint'

/**
 * The half of the egress rule that `no-restricted-globals` and
 * `no-restricted-imports` cannot see.
 *
 * `security-model.md` §1 says every outbound request in the system goes through
 * `safeFetch` — every request, with no exemption list, because an exemption list
 * is the shape a bypass path takes. The two stock rules ban the bare global and
 * the static import. They say nothing about `globalThis.fetch`, a dynamic
 * `import('undici')`, or a `require('node:https')`, and a new adapter reaching
 * for any of those would pass a CI that claims to enforce the invariant.
 *
 * The exception is the `safeFetch` module itself, and it is granted in
 * `eslint.config.ts` by path rather than here by name — a rule that knows how to
 * exempt itself is one edit away from exempting something else.
 */

/** Transports. Requesting one of these is requesting a second way out. */
export const BANNED_MODULES = new Set([
  'undici',
  'node:http',
  'node:https',
  'http',
  'https',
  'node:net',
  'node:tls',
  'net',
  'tls',
  'node-fetch',
  'axios',
  'got',
  'ky',
  'superagent',
  'request',
])

/** Globals that reach the network without being called `fetch`. */
const EGRESS_PROPERTIES = new Set([
  'fetch',
  'XMLHttpRequest',
  'EventSource',
  'WebSocket',
  'sendBeacon',
])

const NAMESPACES = new Set(['globalThis', 'window', 'global', 'self', 'navigator'])

function bannedModuleName(node: { type: string, value?: unknown }): string | undefined {
  if (node.type !== 'Literal' || typeof node.value !== 'string')
    return undefined
  return BANNED_MODULES.has(node.value) ? node.value : undefined
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'require every outbound request to go through safeFetch',
    },
    schema: [],
    messages: {
      global: '`{{name}}` reaches the network directly. Every request in Zis goes through safeFetch — see security-model.md §1.',
      module: 'Importing `{{name}}` is a second way out. Every request in Zis goes through safeFetch — see security-model.md §1.',
    },
  },

  create(context) {
    return {
      // globalThis.fetch(…), window.fetch, navigator.sendBeacon(…)
      MemberExpression(node) {
        if (node.object.type !== 'Identifier' || !NAMESPACES.has(node.object.name))
          return
        const property = node.property
        const name = property.type === 'Identifier' && !node.computed
          ? property.name
          : property.type === 'Literal' && typeof property.value === 'string'
            ? property.value
            : undefined
        if (name !== undefined && EGRESS_PROPERTIES.has(name))
          context.report({ node, messageId: 'global', data: { name: `${node.object.name}.${name}` } })
      },

      // await import('undici')
      ImportExpression(node) {
        const name = bannedModuleName(node.source)
        if (name !== undefined)
          context.report({ node, messageId: 'module', data: { name } })
      },

      // require('node:https'), createRequire(…)('node:https')
      CallExpression(node) {
        const callee = node.callee
        const isRequire = callee.type === 'Identifier' && callee.name === 'require'
        if (!isRequire || node.arguments.length === 0)
          return
        const first = node.arguments[0]
        if (first === undefined)
          return
        const name = bannedModuleName(first)
        if (name !== undefined)
          context.report({ node, messageId: 'module', data: { name } })
      },
    }
  },
}

export default rule
