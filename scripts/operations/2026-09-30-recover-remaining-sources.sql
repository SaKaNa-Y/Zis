-- Manual configuration maintenance after deploying the September 30 source fixes.
-- Run against Zis / production / neondb. This is not a schema migration.
-- The same Source and Publisher identities survive. Manual disable decisions survive.
BEGIN;
LOCK TABLE source IN SHARE ROW EXCLUSIVE MODE;

-- These exact feeds now have bounded parser compatibility fixes. Only their
-- automatic ten-failure stop may be cleared; preserve manual disable decisions.
UPDATE source
SET disabled_at = NULL, disabled_reason = NULL,
    consecutive_failures = 0, retry_after_at = NULL
WHERE transport IN ('rss', 'atom')
  AND endpoint_url IN (
    'https://vercel.com/atom',
    'https://danluu.com/atom.xml',
    'https://antfu.me/feed.xml',
    'https://magazine.sebastianraschka.com/feed'
  )
  AND disabled_at IS NOT NULL
  AND disabled_reason = 'automatically disabled after 10 consecutive failures'
RETURNING id, endpoint_url, disabled_at, consecutive_failures;

-- Recheck HN through the real robots gate after the MIME extraction fix. Keep
-- it disabled until that request authorizes each path. Expire the known bad
-- cached interpretation without deleting evidence or writing an allow verdict.
UPDATE source
SET retry_after_at = NULL
WHERE transport = 'hn_firebase'
  AND endpoint_url IN (
    'https://hacker-news.firebaseio.com/v0/topstories.json',
    'https://hacker-news.firebaseio.com/v0/newstories.json'
  )
  AND disabled_at IS NOT NULL
  AND disabled_reason = 'automatically disabled after 10 consecutive robots denials'
  AND retry_after_at IS NOT NULL;

UPDATE robots_cache
SET expires_at = '2026-09-30T00:00:00Z'
WHERE host = 'hacker-news.firebaseio.com'
  AND verdict = 'ambiguous' AND status = 200 AND authoritative = false
  AND content_type = 'application/octet-stream, text/plain'
  AND expires_at > '2026-09-30T00:00:00Z';

-- Import AI publishes the same issues on its registered author-owned WordPress host.
-- September 30 checks of both official feeds matched issues 465 through 474:
-- normalized full text and outbound URL sets matched for every paired issue.
-- WordPress provides the ten latest issues. This is an endpoint move, not a new
-- voice; it keeps the existing Source and leaves all historical corpus rows alone.
UPDATE source AS s
SET endpoint_url = 'https://jack-clark.net/feed/',
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
  AND p.slug = 'importai'
  AND s.transport = 'rss'
  AND s.endpoint_url = 'https://importai.substack.com/feed'
RETURNING s.id, s.endpoint_url, s.disabled_at, s.consecutive_failures;

-- Production verification found no Import AI Items before this move.
-- No Item identity rewrite, corpus merge or historical backfill is needed.
COMMIT;
