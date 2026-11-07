# Code and Developer Tools

Read this profile for frameworks, libraries, runtimes, build tools, test tools, linters, formatters, code generators, and tools that primarily change source or developer workflows.

## Candidate Gates

A candidate must satisfy every applicable gate:

- supports the repository's required languages, runtimes, operating systems, module formats, and deployment targets;
- interoperates with load-bearing frameworks, build pipelines, package managers, test environments, and editor or CI constraints;
- permits the intended use and distribution under its license;
- has no unresolved security or supply-chain condition that violates the repository's constraints;
- preserves required public contracts, generated output, runtime behavior, and supported consumers, or provides an acceptable migration path.

Mark an unverifiable material gate Needs Evidence. Reject a candidate when a verified incompatibility cannot be removed without changing the Tool Decision Context.

## Compare Fit

Inspect:

- API and configuration surface, type support, diagnostics, documentation, and time to first useful result;
- runtime, build-time, bundle, memory, artifact, and transitive-dependency overhead where relevant;
- extension points and whether the repository needs them now or only hypothetically;
- compatibility policy, release cadence, deprecation practice, governance, maintainer continuity, and downstream ecosystem support;
- migration radius across imports, configuration, tests, generated files, plugins, CI, documentation, and contributor workflow;
- coexistence with the Current Baseline, incremental adoption boundaries, rollback, and removal cost.

Use manifests, lockfiles, imports, configuration, CI, tests, build output, and existing performance evidence to establish repository needs. Use official support matrices, migration guides, releases, security advisories, source, and licenses to establish candidate facts. Benchmark only representative repository work and distinguish measured results from vendor claims.
