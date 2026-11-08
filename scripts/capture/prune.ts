import process from 'node:process'
import { prunePublicationRuns } from '../../src/lib/articles/service'
import { captureStore } from '../../src/lib/capture/postgres'

async function main(): Promise<void> {
  if (process.argv.includes('--dry-run')) {
    console.log('Capture retention: delete expired cards, images and publication attempts; preserve minimal deduplication receipts. No source collection or model calls.')
    return
  }
  const result = await captureStore.prune()
  const runs = await prunePublicationRuns()
  console.log(`Retention removed ${result.cards} expired cards, ${result.images} images and ${runs} publication attempts.`)
}

main().catch(() => {
  console.error('Capture retention failed. Inspect database access and migration state before retrying.')
  process.exitCode = 1
})
