-- Manual configuration maintenance after deploying the reviewed fetch fixes.
-- Run against Zis / production / neondb. This is not a schema migration.
-- Only these reviewed RSS Sources may recover; manual disable decisions survive.
-- Source identities, Item history, Briefs and cache decisions are preserved.
BEGIN;
LOCK TABLE source IN SHARE ROW EXCLUSIVE MODE;

UPDATE source AS s
SET disabled_at = NULL,
    disabled_reason = NULL,
    consecutive_failures = 0,
    retry_after_at = NULL
FROM publisher AS p
WHERE s.publisher_id = p.id
  AND p.slug = 'github'
  AND s.transport = 'rss'
  AND s.endpoint_url IN ('https://github.blog/feed/', 'https://github.blog/changelog/feed/')
  AND s.disabled_at IS NOT NULL
  AND s.disabled_reason = 'automatically disabled after 10 consecutive failures'
RETURNING s.id, s.endpoint_url, s.disabled_at, s.consecutive_failures;

-- Rename the existing endpoint rather than inserting a second Source. A conflicting
-- apex Source causes the unique constraint to roll back the entire transaction.
-- Every CASE reads the original row; an unrelated manual disable is never cleared.
UPDATE source AS s
SET endpoint_url = 'https://sophiebits.com/atom.xml',
    disabled_at = CASE
      WHEN s.disabled_at IS NOT NULL AND s.disabled_reason = 'automatically disabled after 10 consecutive robots denials'
      THEN NULL ELSE s.disabled_at END,
    disabled_reason = CASE
      WHEN s.disabled_at IS NOT NULL AND s.disabled_reason = 'automatically disabled after 10 consecutive robots denials'
      THEN NULL ELSE s.disabled_reason END,
    consecutive_failures = CASE
      WHEN s.disabled_at IS NOT NULL AND s.disabled_reason = 'automatically disabled after 10 consecutive robots denials'
      THEN 0 ELSE s.consecutive_failures END,
    retry_after_at = CASE
      WHEN s.disabled_at IS NOT NULL AND s.disabled_reason = 'automatically disabled after 10 consecutive robots denials'
      THEN NULL ELSE s.retry_after_at END
FROM publisher AS p
WHERE s.publisher_id = p.id
  AND p.slug = 'sophiebits'
  AND s.transport = 'rss'
  AND s.endpoint_url = 'https://www.sophiebits.com/atom.xml'
RETURNING s.id, s.endpoint_url, s.disabled_at, s.consecutive_failures;

COMMIT;
