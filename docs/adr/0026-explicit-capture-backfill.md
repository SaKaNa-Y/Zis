# Explicit historical capture backfill

Sources still start tracking at activation, and resuming a source starts a new
tracking window. The reader requested a one-time backfill of November 7 morning
content after the initial sources were enabled that afternoon.

An authenticated Sources action can move all enabled sources' tracking start
back to a selected date at midnight Asia/Shanghai. It never moves an earlier
start forward and leaves paused sources unchanged. Repeating the action is
idempotent. This allows collection; it does not claim collection has run.

Original identity deduplication, expired-content receipts, capacity limits, and
seven-day retention from first capture remain unchanged. No schema migration is
needed. The Sources form replaces the previous unconditional no-backfill rule.
