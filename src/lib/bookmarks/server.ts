import { desc, eq } from 'drizzle-orm'
import { verifyAuthor } from '@/lib/auth/dal'
import { db } from '@/lib/db'
import { archivedBookmarks, links } from '@/lib/db/schema'
import 'server-only'

export async function readArchivedBookmarks(page: number) {
  const { userId } = await verifyAuthor()
  const entries = await db().select({
    id: archivedBookmarks.legacySignalId,
    title: archivedBookmarks.title,
    body: archivedBookmarks.body,
    summary: archivedBookmarks.summary,
    savedAt: archivedBookmarks.savedAt,
    url: links.url,
  }).from(archivedBookmarks).innerJoin(links, eq(links.id, archivedBookmarks.linkId)).where(eq(archivedBookmarks.userId, userId)).orderBy(desc(archivedBookmarks.savedAt), archivedBookmarks.legacySignalId).limit(21).offset((page - 1) * 20)
  return { entries: entries.slice(0, 20), hasNext: entries.length > 20 }
}
