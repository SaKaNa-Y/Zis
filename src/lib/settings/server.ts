import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth/dal'
import { withCredentialClient } from '@/lib/auth/postgres'
import { createAccountSettings } from './account'
import { APPEARANCE_COOKIE_NAME, createAppearanceSettings } from './appearance'
import 'server-only'

export const accountSettings = createAccountSettings({ verifySession, withClient: withCredentialClient })

export const appearanceSettings = createAppearanceSettings({
  verifySession,
  readPreference: async () => (await cookies()).get(APPEARANCE_COOKIE_NAME)?.value,
  writePreference: async (value) => {
    (await cookies()).set(APPEARANCE_COOKIE_NAME, value, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 365 * 24 * 60 * 60,
    })
  },
})
