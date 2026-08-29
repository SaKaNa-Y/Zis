'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { authenticatePassphrase } from '@/lib/auth/credentials'
import {
  issueSession,
  SESSION_DURATION_SECONDS,
  sessionCookie,
} from '@/lib/auth/session'

/** The sole public mutation: successful passphrase proof mints a new session. */
export async function login(formData: FormData): Promise<never> {
  const submitted = formData.get('passphrase')
  const passphrase = typeof submitted === 'string' ? submitted : ''
  const authentication = await authenticatePassphrase(passphrase)

  if (!authentication.authenticated)
    redirect('/login')

  const now = new Date()
  const token = await issueSession({
    sessionVersion: authentication.sessionVersion,
    userId: authentication.userId,
  }, { now })
  const expiresAt = Math.floor(now.getTime() / 1000) + SESSION_DURATION_SECONDS
  const cookie = sessionCookie(token, expiresAt)
  const cookieStore = await cookies()

  cookieStore.set(cookie.name, cookie.value, cookie.options)
  redirect('/')
}
