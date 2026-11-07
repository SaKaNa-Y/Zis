# Cloud and Deployment

Read this profile for compute, hosting, deployment platforms, networking, edge platforms, container services, serverless products, and managed cloud infrastructure.

## Candidate Gates

A candidate must satisfy every applicable gate:

- supports the workload's runtime, architecture, build and deployment model, regions, networking, and service dependencies;
- satisfies identity, access, secret handling, encryption, security, compliance, residency, and isolation requirements;
- can meet required availability, recovery, scaling, support, and service-limit constraints;
- fits any hard budget, procurement, contract, and organization or account boundary supplied by the user;
- provides an acceptable portability, migration, rollback, and exit route.

Mark undocumented limits, unavailable regions, uncertain compliance, and unresolved pricing assumptions Needs Evidence. Reject a candidate when a required capability or boundary is unavailable.

## Compare Fit

Inspect:

- deployment flow, infrastructure ownership, local parity, preview environments, release control, rollback, and incident access;
- compute behavior, scaling model, cold starts, quotas, network paths, latency, storage, observability, and operational tooling;
- identity and access model, organization controls, auditability, policy enforcement, and separation of duties;
- reliability history, service-level commitments, support model, maintenance windows, deprecation policy, and regional dependencies;
- pricing shape under representative load, including base capacity, requests, storage, network egress, observability, support, and growth;
- infrastructure-as-code support, proprietary interfaces, data or artifact portability, migration stages, and exit cost.

Use deployment configuration, infrastructure code, traffic shape, regions, current incidents, latency evidence, and operational constraints to establish repository needs. Use current official region, limit, pricing, security, SLA, deprecation, and support documentation for candidate facts. State every workload and pricing assumption; do not present calculator output as a measured bill.
