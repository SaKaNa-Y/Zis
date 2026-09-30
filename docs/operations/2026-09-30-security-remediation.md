# Dependency security remediation — 2026-09-30

## Scope and acceptance

Remediate the currently open Zis security dependency alerts from main
`34af5939e5c12cb3e700b9fe5ac63704ae32a09c`, including vulnerable copies in the
independent calibration prototype. Preserve application, authentication, data,
SSRF protections, and the Node 22 / pnpm 11 toolchain. Use minimal compatible
upgrades; do not dismiss alerts, weaken installation policy, rotate credentials,
or publish/merge/deploy without separate authorization.

## Inventory and resolution

GitHub returned **17 open Dependabot alerts: 8 high, 6 medium, 3 low**. These
represent 15 unique advisories; the two sharp advisories each affect both lockfiles.
The registry audit additionally identified three brace-expansion advisories,
with vulnerable copies in both the 1.x and 5.x lines. Audit entry counts are not
interchangeable with GitHub alert counts.

| Dependency | Affected resolution and path | Local resolution | Exposure |
| --- | --- | --- | --- |
| undici | Direct runtime dependency 8.10.0 | 8.10.2 | Network fetching via `src/lib/safe-fetch.ts`; 11 advisories cover several APIs. |
| sharp | Transformers.js 3.8.1 → 0.34.5, Next 16.3.3 → 0.35.3; prototype Transformers.js → 0.34.5 | 0.35.4 everywhere | Runtime native image decoders; current embedding pipeline is text-only, but this does not justify dismissing the alerts. |
| js-yaml | ESLint → @eslint/eslintrc → 4.3.1 | 4.3.2 | Development YAML parsing; crafted input can exhaust CPU. |
| esbuild | drizzle-kit → @esbuild-kit/esm-loader → @esbuild-kit/core-utils → 0.18.20 | Reuse 0.25.12 already used directly by drizzle-kit | Development server cross-origin information exposure. No application dev server using this copy was observed. |
| brace-expansion | ESLint/minimatch → 1.1.18; typescript-eslint/minimatch → 5.0.9 | 1.1.21 / 5.0.12 | Development glob expansion; crafted patterns can exhaust CPU or stack. |

Official advisories:

- sharp: [libvips](https://github.com/advisories/GHSA-f88m-g3jw-g9cj), [libheif](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c).
- js-yaml: [merge-source CPU exhaustion](https://github.com/advisories/GHSA-2883-xcg3-v3hh).
- esbuild: [development server exposure](https://github.com/advisories/GHSA-67mh-4wv8-2f99).
- brace-expansion: [quadratic rewriting](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr), [nested braces](https://github.com/advisories/GHSA-qhr7-859c-m2p7), [comma parsing](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p).
- undici: [retry DoS](https://github.com/advisories/GHSA-pmjh-fq2x-6v4x), [dump truncation](https://github.com/advisories/GHSA-2gqq-gqf2-x968), [cached cookies](https://github.com/advisories/GHSA-2jfj-6hjv-fm6j), [WebSocket protocol](https://github.com/advisories/GHSA-rfgv-xxqx-mfg5), [decompression](https://github.com/advisories/GHSA-3xpg-4rpp-hhhm), [response splitting](https://github.com/advisories/GHSA-r53p-7pc4-xj5r), [BalancedPool TLS](https://github.com/advisories/GHSA-w293-vg96-wgc3), [unsafe cache methods](https://github.com/advisories/GHSA-8436-99hf-9mmv), [WebSocketStream close](https://github.com/advisories/GHSA-rx4f-c7p8-82vq), [cross-origin cache](https://github.com/advisories/GHSA-vp8m-p9jh-q5pm), [WebSocket deflate](https://github.com/advisories/GHSA-3wwx-pv8p-q78v).

Existing [Dependabot PR #96](https://github.com/SaKaNa-Y/Zis/pull/96) already
proposes undici 8.10.2. This local patch uses that same target and adds the
remaining fixes, without its unrelated lockfile refresh. Do not merge both
blindly: reconcile or supersede #96 when publication is authorized.

Overrides are temporary compatibility constraints until upstream dependency
ranges are patched. The prototype has its own pnpm settings, so normal frozen
installation in its directory preserves its sharp override. Do not install it
with `--ignore-workspace`, which skips these settings. Existing root install-script
and registry-trust policies remain unchanged. Lockfile changes exclude unrelated
Babel, Rolldown, and source-map upgrades. Regression tests inspect both resolved
graphs to prevent vulnerable versions returning through indirect dependencies.

## Validation and boundaries

- Frozen installs succeed for both graphs with Node 22.23.2 / pnpm 11.9.0.
- Registry audits for both graphs report **0 known vulnerabilities** after fixes.
- Native sharp smoke checks succeed through Transformers.js RawImage in both
  installations: generated local PNG, 2 × 2 pixels; sharp 0.35.4, libvips 8.18.6,
  libheif 1.23.2. No remote image, model download, or private corpus was used.
- Drizzle generates schema SQL into a temporary directory with patched esbuild;
  no database connection or migration is executed.
- Repository validation: typecheck, ESLint, no-px, env-example, all 546 tests in
  55 files, and the production webpack build pass.
- `pnpm peers check` retains an existing mismatch: eslint-plugin-unicorn 73.0.0
  wants ESLint >=10.4, while the repository uses 9.39.5. Both versions are
  unchanged by this patch; ESLint runs successfully. This is separate toolchain
  maintenance, not a newly introduced security regression.

GitHub code-scanning returned 404/no analysis. Secret-scanning returned 404/disabled
and a token-scope requirement; no secret-scanning results could be verified.
No credentials, authorization scopes, scanner settings, or alert states were
changed. These dependency audits do not establish that the repository contains
no other vulnerabilities or secrets. Remote alerts remain unresolved until the
approved fix is published, merged, and re-evaluated by GitHub.
