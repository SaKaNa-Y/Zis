import { verifySession } from '@/lib/auth/dal'
import { db } from '@/lib/db'
import { sessionSecret } from '@/lib/env'
import { createSavedBookmarks } from './saved'
import 'server-only'

export const savedBookmarks = createSavedBookmarks({
  execute: statement => db().execute(statement),
  verifySession,
  undoSecret: sessionSecret,
})
