'use server'

import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/auth/dal'
import { interestProfile } from '@/lib/interests/server'
import { ProfileValidationError } from '@/lib/interests/validation'

export async function saveInterestProfile(formData: FormData) {
  await verifySession()
  let value: unknown
  try {
    value = JSON.parse(String(formData.get('profile')))
  }
  catch {
    return { error: 'The Profile could not be read. Reload and try again.' }
  }
  try {
    await interestProfile.save(value)
  }
  catch (error) {
    return { error: error instanceof ProfileValidationError ? error.message : 'Your changes could not be saved. Reload your Profile and try again.' }
  }
  revalidatePath('/interests')
  return { profile: await interestProfile.read() }
}
