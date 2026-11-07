/** Retired entrypoint: preserve a safe CLI diagnostic, never load legacy workers. */
import process from 'node:process'

if (process.argv.slice(2).includes('--dry-run')) {
  process.stdout.write('zis legacy paid translation: retired; dry-run only; no work performed.\n')
}
else {
  process.stderr.write('zis legacy paid translation is retired. Use the capture flow; historical data is retained.\n')
  process.exitCode = 1
}
