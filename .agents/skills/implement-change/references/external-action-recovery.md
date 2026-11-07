# Recover an uncertain external action

Use this method when a request that could change an external system times out, loses its response, or is interrupted before its result is known. A missing response is not proof of failure. This applies during a live session as well as after a restart or handoff. Ordinary successful operations need no extra recovery ledger.

## Recover the action and inspect its effect

Recover the intended action, target account/project, exact payload or relevant content identity, existing authorization, and any request ID, resource ID, idempotency key or receipt already available. Preserve the useful identifiers in the existing task record without copying secrets. Confirm that an earlier executor or pending request cannot still perform a conflicting action before replacing it.

Query the system that owns the effect, using stable identity and the relevant version. For example, find a PR by its repository and head/base branches, then inspect its content; use a known object ID or operation receipt when available. A similar title or an empty local log is not enough. Check whether the query covers the right account, permissions, pagination and possible delayed visibility. Inspect related partial effects when the action has several steps.

Classify the result from evidence:

- **Completed:** The intended effect is confirmed. Recover its ID/link/receipt and continue from that state. Repair missing local writeback only; do not repeat the external action.
- **Confirmed not completed:** The owning system provides adequate evidence that the intended effect did not occur and is not still pending. Recheck current authorization and preconditions before retrying only the missing work. A partial result requires reconciling the completed steps first.
- **Still unknown:** Reading failed, returned incomplete or ambiguous evidence, or cannot yet distinguish absence from delay. Retain the action identity, last observation and next useful check. Do not convert uncertainty into failure and blindly repeat the write.

If the service offers a documented idempotent retry or operation-status mechanism, use its actual scope and constraints. Reuse the same operation identity and compatible payload; changing the key can create another action. Do not assume that a client-side search followed by creation is atomic, or that every API is idempotent. A retry with a guaranteed duplicate-safe mechanism may resolve an unknown result within the existing authorization; otherwise keep the write pending.

## Continue without repeating completed work

Keep external completion separate from local records and later delivery steps. For example, if PR creation succeeded but saving its URL failed, recover the PR and retry saving the URL. If the request is still pending remotely, observe that operation instead of starting a replacement. Read-only reconciliation can continue within existing authority. Recheck scope only when facts or authorization have changed; a lost receipt alone does not require asking for the same permission again.

Pause only the dependent write when no safe continuation is supported; continue independent work. Return the unresolved state, its practical effect and the next check or missing prerequisite. Ask the user when continuation needs a new decision or authorization, not to substitute for an available state query. This method does not authorize publishing, messaging, rollback or compensating actions beyond the active task.
