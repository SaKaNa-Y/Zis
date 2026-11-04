'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/auth/dal'
import { CredentialActionError } from '@/lib/auth/postgres'
import { sessionCookie } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { readLocale } from '@/lib/i18n/server'
import { isInterfaceLanguage, isLanguage, isReadingStyle, READING_COOKIE } from '@/lib/settings/preferences'
import { accountSettings, appearanceSettings } from '@/lib/settings/server'

export async function saveAppearance(value: unknown): Promise<{ error?: string }> {
  await verifySession()
  const { t } = await readLocale()
  try {
    await appearanceSettings.save(value)
  }
  catch {
    return { error: t('Appearance could not be saved. Try again.', '外观保存失败，请重试。') }
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
  const { t } = await readLocale()
  try {
    await accountSettings.changePassphrase({
      currentPassphrase: textField(form, 'currentPassphrase'),
      newPassphrase: textField(form, 'newPassphrase'),
      confirmation: textField(form, 'confirmation'),
    })
  }
  catch (error) {
    return { error: error instanceof CredentialActionError ? t(error.message, accountErrorChinese(error.message)) : t('The change could not be confirmed. Try signing in with the new passphrase before retrying.', '无法确认修改结果。请先尝试使用新口令登录，再决定是否重试。') }
  }
  return finishSignOut()
}

export async function signOutEverywhere(_previous: { error?: string }, form: FormData): Promise<{ error?: string }> {
  await verifySession()
  const { t } = await readLocale()
  if (form.get('confirm') !== 'yes')
    return { error: t('Confirm that you want to sign out on every device.', '请确认退出所有设备。') }
  try {
    await accountSettings.signOutEverywhere()
  }
  catch (error) {
    return { error: error instanceof CredentialActionError ? t(error.message, accountErrorChinese(error.message)) : t('Sign-out could not be confirmed. Try again or return to sign in.', '无法确认退出结果，请重试或返回登录页。') }
  }
  return finishSignOut()
}

export async function saveReadingStyle(value: unknown): Promise<{ error?: string }> {
  await verifySession()
  const { t } = await readLocale()
  if (!isReadingStyle(value))
    return { error: t('Choose a valid reading style.', '请选择有效的阅读样式。') }
  try {
    (await cookies()).set(READING_COOKIE, JSON.stringify(value), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 365 * 24 * 60 * 60 })
  }
  catch { return { error: t('Reading style could not be saved. Try again.', '阅读样式保存失败，请重试。') } }
  revalidatePath('/', 'layout')
  return {}
}

export async function saveLanguage(field: 'interfaceLanguage' | 'contentLanguage', value: unknown): Promise<{ error?: string }> {
  const { userId } = await verifySession()
  const { t } = await readLocale()
  if ((field !== 'interfaceLanguage' && field !== 'contentLanguage') || !(field === 'interfaceLanguage' ? isInterfaceLanguage(value) : isLanguage(value)))
    return { error: t('Choose a valid language.', '请选择有效的语言。') }
  try {
    await db().update(users).set({ [field]: value }).where(eq(users.id, userId))
  }
  catch { return { error: t('Language could not be saved. Try again.', '语言保存失败，请重试。') } }
  revalidatePath('/', 'layout')
  return {}
}

function accountErrorChinese(message: string): string {
  const messages: Record<string, string> = {
    'Your session has expired. Sign in again.': '登录会话已过期，请重新登录。',
    'Use a password-manager-generated passphrase of 32–1024 UTF-8 bytes (32 or more ASCII characters).': '请使用密码管理器生成口令，长度为 32–1024 个 UTF-8 字节（至少 32 个 ASCII 字符）。',
    'The new passphrases must match.': '两次输入的新口令必须一致。',
    'Enter your current passphrase (up to 1024 UTF-8 bytes).': '请输入当前口令（最多 1024 个 UTF-8 字节）。',
    'The current passphrase is incorrect or verification is temporarily locked. If locked, try again in 15 minutes.': '当前口令错误或验证暂时锁定。如已锁定，请在 15 分钟后重试。',
  }
  return messages[message] ?? '账户操作失败，请重试。'
}
