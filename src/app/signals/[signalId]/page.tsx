import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { verifySession } from '@/lib/auth/dal'
import { readSignalProvenance } from '@/lib/signals/provenance'
import { SignalProvenanceView } from './provenance'

export const metadata: Metadata = {
  title: 'Signal provenance — Zis',
}

export default async function SignalProvenancePage({
  params,
}: {
  params: Promise<{ signalId: string }>
}) {
  const sessionPromise = verifySession()
  const { signalId } = await params
  const { userId } = await sessionPromise
  const provenance = await readSignalProvenance(userId, signalId)

  if (provenance === null)
    notFound()

  return <SignalProvenanceView provenance={provenance} />
}
