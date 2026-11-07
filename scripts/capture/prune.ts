import process from 'node:process'
import { captureStore } from '../../src/lib/capture/postgres'

async function main(): Promise<void> {
  if (process.argv.includes('--dry-run')) {
    console.log('Capture retention: delete expired cards and images; preserve minimal deduplication receipts. No source collection or model calls.')
    return
  }
  const result = await captureStore.prune()
  console.log(`Capture retention removed ${result.cards} expired cards and ${result.images} images.`)
}

main().catch(() => {
  console.error('Capture retention failed. Inspect database access and migration state before retrying.')
  process.exitCode = 1
})
