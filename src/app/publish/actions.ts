'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { completeRun, failRun, listPublicationRuns, reportStage, startRun } from '@/lib/articles/service'
import { verifyAuthor } from '@/lib/auth/dal'

function field(form: FormData, name: string) {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

function showHistory(): never {
  revalidatePath('/')
  revalidatePath('/articles')
  revalidatePath('/history')
  redirect('/history')
}

export async function openPublication(form: FormData) {
  await verifyAuthor()
  const key = field(form, 'attempt')
  if (!key || key.length > 120)
    throw new Error('Provide an attempt key of up to 120 characters.')
  let id = await startRun(`window:${key}`)
  const attempts = new Map((await listPublicationRuns()).map(run => [run.id, run]))
  while (attempts.get(id)?.status === 'failed') {
    const previous = id
    id = await startRun(`retry:${previous}`, previous)
  }
  redirect(`/publish?run=${encodeURIComponent(id)}`)
}

export async function updatePublication(form: FormData) {
  await verifyAuthor()
  const id = field(form, 'run')
  if (field(form, 'outcome') === 'failed') {
    await failRun(id, field(form, 'reason'))
    showHistory()
  }
  await reportStage(id, field(form, 'stage'))
  revalidatePath('/publish')
  revalidatePath('/history')
}

export async function finishPublication(form: FormData) {
  await verifyAuthor()
  const id = field(form, 'run')
  const reason = field(form, 'reason')
  let outputs: unknown
  try {
    outputs = JSON.parse(field(form, 'outputs'))
  }
  catch {
    await failRun(id, 'Invalid publication JSON.')
    showHistory()
  }
  try {
    await completeRun(id, outputs, reason || undefined)
  }
  catch {
    // Replay with the same identity in case PostgreSQL committed before disconnect.
    try {
      await completeRun(id, outputs, reason || undefined)
    }
    catch {
      await failRun(id, 'Could not commit the supplied articles. Check the article fields and source URLs.')
    }
  }
  showHistory()
}
