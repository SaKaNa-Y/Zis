import type { ESLint } from 'eslint'
import noDirectEgress from './no-direct-egress'

/** The Zis-specific rules, composed on top of `@antfu/eslint-config`. */
const plugin: ESLint.Plugin = {
  meta: { name: 'zis' },
  rules: { 'no-direct-egress': noDirectEgress },
}

export default plugin
