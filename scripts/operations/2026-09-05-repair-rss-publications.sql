-- One-off production repair for ADR-0021, before the first Brief.
-- Run against Zis / production / neondb, after deploying the matching code.
-- No Item, Citation, or Signal is deleted; raw Citation addresses survive.
BEGIN;
LOCK TABLE item, citation, link, brief IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM brief) THEN
    RAISE EXCEPTION 'publication repair requires a corpus without a Brief';
  END IF;
END $$;

CREATE TEMP TABLE publication_repair ON COMMIT DROP AS
SELECT i.id AS item_id, i.url AS old_url, rtrim(i.external_id, '/') AS new_url
FROM item i JOIN source s ON s.id = i.source_id
JOIN publisher p ON p.id = s.publisher_id
JOIN publisher_host h ON h.publisher_id = p.id AND h.host = 'css-weekly.com'
WHERE p.slug = 'cssweekly' AND s.endpoint_url = 'https://css-weekly.com/feed/'
  AND i.url LIKE 'https://feedpress.me/link/24028/%'
  AND i.external_id LIKE 'https://css-weekly.com/%';

CREATE TEMP TABLE review_repair ON COMMIT DROP AS
SELECT i.id AS item_id
FROM item i JOIN source s ON s.id = i.source_id
JOIN publisher p ON p.id = s.publisher_id
JOIN publisher_host h ON h.publisher_id = p.id AND h.host = 'console.dev'
WHERE p.slug = 'consoledev' AND s.endpoint_url = 'https://console.dev/rss.xml'
  AND i.url IS NOT NULL;

DO $$
BEGIN
  IF (SELECT count(*) FROM publication_repair) <> 24
    OR (SELECT count(*) FROM review_repair) <> 6 THEN
    RAISE EXCEPTION 'publication repair counts changed; inspect before retrying';
  END IF;
  IF EXISTS (SELECT 1 FROM publication_repair r JOIN link l ON l.url = r.new_url) THEN
    RAISE EXCEPTION 'a corrected Link already exists; merge explicitly instead';
  END IF;
  IF (SELECT count(*) FROM publication_repair r JOIN citation c ON c.item_id = r.item_id
      JOIN link l ON l.id = c.link_id AND l.url = r.old_url WHERE c.kind = 'self') <> 24 THEN
    RAISE EXCEPTION 'tracking Citation shape changed';
  END IF;
  IF (SELECT count(*) FROM review_repair r JOIN citation c ON c.item_id = r.item_id
      WHERE c.kind = 'self') <> 6 THEN
    RAISE EXCEPTION 'review Citation shape changed';
  END IF;
END $$;

UPDATE link l SET url = r.new_url
FROM publication_repair r WHERE l.url = r.old_url;
UPDATE item i SET url = r.new_url, updated_at = now()
FROM publication_repair r WHERE i.id = r.item_id;
UPDATE citation c SET kind = 'outbound', anchor_text = i.title
FROM review_repair r JOIN item i ON i.id = r.item_id
WHERE c.item_id = r.item_id AND c.kind = 'self';
UPDATE item i SET url = NULL, updated_at = now()
FROM review_repair r WHERE i.id = r.item_id;

SELECT (SELECT count(*) FROM publication_repair) AS corrected_publications,
       (SELECT count(*) FROM review_repair) AS corrected_reviews;
COMMIT;
