import { verifySession } from '@/lib/auth/dal'

export default async function Home() {
  await verifySession()

  return (
    <main>
      <p>Nothing is ingested and nothing is rendered yet.</p>
    </main>
  )
}
