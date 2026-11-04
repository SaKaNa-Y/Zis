'use server'

import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/auth/dal'
import { readLocale } from '@/lib/i18n/server'
import { interestProfile } from '@/lib/interests/server'
import { ProfileValidationError } from '@/lib/interests/validation'

export async function saveInterestProfile(formData: FormData) {
  await verifySession()
  const { t } = await readLocale()
  let value: unknown
  try {
    value = JSON.parse(String(formData.get('profile')))
  }
  catch {
    return { error: t('The Profile could not be read. Reload and try again.', '无法读取关注兴趣，请刷新后重试。') }
  }
  try {
    await interestProfile.save(value)
  }
  catch (error) {
    return { error: error instanceof ProfileValidationError ? t(error.message, '请填写 1–20 条不重复的关注兴趣，每条 1–200 个字符；如修改已过期，请刷新后重试。') : t('Your changes could not be saved. Reload your Profile and try again.', '保存失败，请刷新关注兴趣后重试。') }
  }
  revalidatePath('/interests')
  return { profile: await interestProfile.read() }
}
