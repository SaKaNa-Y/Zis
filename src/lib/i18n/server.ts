import { and, eq } from 'drizzle-orm'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { isInterfaceLanguage, isLanguage, resolveLanguage } from '@/lib/settings/preferences'
import 'server-only'

export const readLocale = cache(async () => {
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE_NAME)?.value)
  const reader = session
    ? (await db().select({ interfaceLanguage: users.interfaceLanguage, contentLanguage: users.contentLanguage }).from(users).where(and(eq(users.id, session.userId), eq(users.sessionVersion, session.sessionVersion))))[0]
    : undefined
  const interfaceLanguage = isInterfaceLanguage(reader?.interfaceLanguage) ? reader.interfaceLanguage : 'system'
  const language = resolveLanguage(interfaceLanguage, (await headers()).get('accept-language') ?? '')
  const contentLanguage = isLanguage(reader?.contentLanguage) ? reader.contentLanguage : 'zh'
  return { interfaceLanguage, language, contentLanguage, t: (en: string, zh: string) => language === 'zh' ? zh : en }
})
