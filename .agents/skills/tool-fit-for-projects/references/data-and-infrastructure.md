# Data and Infrastructure

Read this profile for databases, object or file storage, caches, queues, event systems, search engines, and other stateful infrastructure.

## Candidate Gates

A candidate must satisfy every applicable gate:

- represents the repository's required data model, queries, transactions, ordering, retention, and consistency semantics;
- meets durability, recovery-point, recovery-time, backup, restore, and availability constraints;
- can run in the required topology, region, network, runtime, and operational environment;
- satisfies applicable license, security, privacy, compliance, residency, encryption, and access-control requirements;
- provides a credible data migration, validation, rollback, and exit route without unacceptable loss or downtime.

Treat an untested recovery claim or unknown data boundary as Needs Evidence. Reject a candidate when satisfying a gate would require changing a user-owned constraint or accepting unbounded data risk.

## Compare Fit

Inspect:

- schema and query fit, correctness model, transaction and consistency behavior, concurrency, ordering, and failure semantics;
- representative latency, throughput, capacity, storage growth, scaling boundaries, and degradation behavior;
- operational ownership, deployment, upgrades, backups, restore drills, replication, failover, observability, and incident response;
- client and protocol compatibility, local development, testing, data tooling, and integration with existing services;
- migration phases, dual-read or dual-write complexity, reconciliation, cutover, rollback, and long-term data portability;
- infrastructure, staffing, support, transfer, backup, and exit costs across the expected lifetime.

Use schemas, migrations, queries, traffic or storage evidence, failure requirements, runbooks, and current operational incidents to establish repository needs. Prefer official protocol, durability, consistency, limit, backup, and lifecycle documentation. Require representative tests for performance or recovery claims that materially decide the outcome.
