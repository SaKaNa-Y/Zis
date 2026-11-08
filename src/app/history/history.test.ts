import type { PublicationRun } from '@/lib/articles/types'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { PublicationHistory } from './history'

it('groups attempts by Shanghai date and distinguishes a quiet day from a completed empty attempt', () => {
  const now = new Date('2026-11-08T01:00:00Z')
  const failed: PublicationRun = {
    id: 'first',
    startedAt: new Date('2026-11-07T23:10:00Z'),
    finishedAt: now,
    status: 'failed',
    reason: 'Source unavailable',
    stages: [{ name: 'Fetch', at: now.toISOString() }],
    articles: [],
    retryOf: null,
  }
  const retry: PublicationRun = { ...failed, id: 'second', startedAt: now, retryOf: 'first', status: 'empty', reason: 'No new sources' }
  const html = renderToStaticMarkup(createElement(PublicationHistory, { runs: [retry, failed], now }))
  expect(html.indexOf('Finished without publication')).toBeLessThan(html.indexOf('Source unavailable'))
  expect(html).toContain('href="#run-first"')
  expect(html).toContain('No publication attempts')
  expect(html).toContain('No new sources')
  expect(html).toContain('Fetch')
  expect(html.match(/November 8, 2026<\/h2>/g)).toHaveLength(1)
})
