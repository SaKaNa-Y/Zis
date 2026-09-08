'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/auth/dal'
import { CredentialActionError } from '@/lib/auth/postgres'
import { sessionCookie } from '@/lib/auth/session'
import { accountSettings, appearanceSettings } from '@/lib/settings/server'

export async function saveAppearance(value: unknown): Promise<{ error?: string }> {
  await verifySession()
  try {
    await appearanceSettings.save(value)
  }
  catch {
    return { error: 'Appearance could not be saved. Try again.' }
  }
  revalidatePath('/', 'layout')
  return {}
}

async function finishSignOut(): Promise<never> {
  const cookie = sessionCookie('', 0)
  ;(await cookies()).set(cookie.name, cookie.value, cookie.options)
  revalidatePath('/', 'layout')
  redirect('/login')
}

function textField(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === 'string' ? value : ''
}

export async function changePassphrase(_previous: { error?: string }, form: FormData): Promise<{ error?: string }> {
  await verifySession()
  try {
    await accountSettings.changePassphrase({
      currentPassphrase: textField(form, 'currentPassphrase'),
      newPassphrase: textField(form, 'newPassphrase'),
      confirmation: textField(form, 'confirmation'),
    })
  }
  catch (error) {
    return { error: error instanceof CredentialActionError ? error.message : 'The change could not be confirmed. Try signing in with the new passphrase before retrying.' }
  }
  return finishSignOut()
}

export async function signOutEverywhere(_previous: { error?: string }, form: FormData): Promise<{ error?: string }> {
  await verifySession()
  if (form.get('confirm') !== 'yes')
    return { error: 'Confirm that you want to sign out on every device.' }
  try {
    await accountSettings.signOutEverywhere()
  }
  catch (error) {
    return { error: error instanceof CredentialActionError ? error.message : 'Sign-out could not be confirmed. Try again or return to sign in.' }
  }
  return finishSignOut()
}
