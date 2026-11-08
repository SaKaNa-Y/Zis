import { and, eq, isNull } from 'drizzle-orm'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { isInterfaceLanguage, resolveLanguage } from '@/lib/settings/preferences'
import 'server-only'

export const readLocale = cache(async () => {
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE_NAME)?.value)
  const reader = session
    ? (await db().select({ interfaceLanguage: users.interfaceLanguage }).from(users).where(and(eq(users.id, session.userId), eq(users.sessionVersion, session.sessionVersion), isNull(users.revokedAt))))[0]
    : undefined
  const interfaceLanguage = isInterfaceLanguage(reader?.interfaceLanguage) ? reader.interfaceLanguage : 'system'
  const language = resolveLanguage(interfaceLanguage, (await headers()).get('accept-language') ?? '')
  return { interfaceLanguage, language, t: (en: string, zh: string) => language === 'zh' ? zh : en }
})
