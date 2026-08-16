# Signals are created eagerly and only ever merged

Status: accepted

A Signal of size one — a single Link cited by a single Publisher — is an ordinary
Signal, not a special case. To make that true by construction rather than by
discipline, **every Link gets a Signal the moment it is first seen (1:1), and
clustering only ever merges Signals; it never creates them.** The alternative,
creating a Signal once two Publishers agree, is cheaper in rows but leaves
single-Publisher Links with no Signal at all, forcing a nullable singleton branch
into every downstream reader.

## Consequences

- Merges leave a `merged_into` tombstone rather than deleting a row, so
  provenance survives and every read path must resolve tombstones. Bookmarks and
  read state, which attach to Signals, resolve through them too.
- Temporal decay is expressible as "this Signal no longer accepts merges."
- LLM merge adjudication, if adopted, operates on Signals that already exist —
  it decides merge or split, it never detects a cluster. This keeps the
  invariant that detection is deterministic.
- Cost accepted: one Signal row per Link ever observed.
