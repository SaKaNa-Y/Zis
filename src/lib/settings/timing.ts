// tests/repo-invariants.test.ts checks this against the actual Ingest schedule.
export const DAILY_INGESTION_CRON = '17 22 * * *'

export function generationTime(): string {
  const [minute, hour] = DAILY_INGESTION_CRON.split(' ').map(Number)
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Shanghai',
    hourCycle: 'h23',
  }).format(new Date(Date.UTC(2026, 0, 1, hour, minute)))
}
