import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createSignalProvenanceReader } from '@/lib/signals/provenance'
import { SignalProvenanceView } from './provenance'

vi.mock('server-only', () => ({}))

describe('signal provenance', () => {
  it('renders a Strength-one Signal as a complete, countable Citation record', () => {
    const html = renderToStaticMarkup(createElement(SignalProvenanceView, {
      provenance: {
        admittedBy: 'interest',
        entryId: '00000000-0000-4000-8000-000000000771',
        originUrl: 'https://origin.example/release',
        publishers: [
          {
            citations: [
              {
                firstSeenAt: '2026-08-30T01:30:00.000Z',
                id: '00000000-0000-4000-8000-000000000773',
                itemTitle: 'A careful independent account',
                itemUrl: 'https://reader.example/independent-account',
              },
            ],
            id: '00000000-0000-4000-8000-000000000774',
            isOrigin: false,
            name: 'Independent Publisher',
          },
          {
            citations: [
              {
                firstSeenAt: '2026-08-30T00:00:00.000Z',
                id: '00000000-0000-4000-8000-000000000775',
                itemTitle: 'The original release',
                itemUrl: 'https://origin.example/release',
              },
            ],
            id: '00000000-0000-4000-8000-000000000776',
            isOrigin: true,
            name: 'Origin Publisher',
          },
        ],
        signalId: '00000000-0000-4000-8000-000000000772',
        strength: 1,
        summary: 'A small release with one independent Publisher behind it.',
        title: 'A release worth checking',
      },
    }))

    expect(html).toContain('Signal provenance')
    expect(html).toContain('A release worth checking ↗')
    expect(html).toContain('A small release with one independent Publisher behind it.')
    expect(html).toContain('href="https://origin.example/release"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('Interest match')
    expect(html).toContain('Strength 1')
    expect(html).toContain('1 distinct Publisher, with the origin excluded')
    expect(html.match(/data-citation-id=/g)).toHaveLength(2)
    expect(html.match(/data-strength-publisher="true"/g)).toHaveLength(1)
    expect(html.indexOf('Independent Publisher')).toBeLessThan(html.indexOf('Origin Publisher'))
    expect(html).toContain('Origin · excluded from Strength')
    expect(html).not.toMatch(/>[^<]*(?:cosine|\bGAP\b|relevance|score)[^<]*</i)
    expect(html).not.toMatch(/class="[^"]*card/i)
    expect(html).toContain('aria-label="Primary navigation"')
    expect(html).toContain('aria-label="Footer navigation"')
    for (const href of ['/', '/earlier', '/saved', '/interests', '/settings'])
      expect(html).toContain(`href="${href}"`)
  })

  it('renders the stored Strength as distinct non-origin Publishers without dropping Citations', async () => {
    const userId = '00000000-0000-4000-8000-000000000780'
    const entryId = '00000000-0000-4000-8000-000000000781'
    const signalId = '00000000-0000-4000-8000-000000000782'
    const base = {
      admitted_by: 'convergence',
      entry_signal_id: entryId,
      origin_publisher_id: '00000000-0000-4000-8000-000000000789',
      origin_publisher_name: 'Origin Publisher',
      origin_url: 'https://origin.example/release',
      signal_id: signalId,
      strength: 2,
      summary: 'Independent Publishers checked the original claim.',
      title: 'The claim under review',
    }
    const readProvenance = createSignalProvenanceReader(vi.fn(async () => [
      {
        ...base,
        citation_first_seen_at: '2026-08-30T03:00:00.000Z',
        citation_id: '00000000-0000-4000-8000-000000000783',
        item_title: 'First account of the claim',
        item_url: 'https://alpha.example/first-account',
        publisher_id: '00000000-0000-4000-8000-000000000787',
        publisher_name: 'Alpha Publisher',
      },
      {
        ...base,
        citation_first_seen_at: '2026-08-30T04:00:00.000Z',
        citation_id: '00000000-0000-4000-8000-000000000784',
        item_title: 'A follow-up from the same Publisher',
        item_url: 'https://alpha.example/follow-up',
        publisher_id: '00000000-0000-4000-8000-000000000787',
        publisher_name: 'Alpha Publisher',
      },
      {
        ...base,
        citation_first_seen_at: '2026-08-30T02:00:00.000Z',
        citation_id: '00000000-0000-4000-8000-000000000785',
        item_title: 'A second independent account',
        item_url: 'https://beta.example/account',
        publisher_id: '00000000-0000-4000-8000-000000000788',
        publisher_name: 'Beta Publisher',
      },
      {
        ...base,
        citation_first_seen_at: '2026-08-30T00:00:00.000Z',
        citation_id: '00000000-0000-4000-8000-000000000786',
        item_title: 'The origin self-citation',
        item_url: 'https://origin.example/release',
        publisher_id: '00000000-0000-4000-8000-000000000789',
        publisher_name: 'Origin Publisher',
      },
    ]))

    const provenance = await readProvenance(userId, entryId)

    expect(provenance).not.toBeNull()
    const html = renderToStaticMarkup(createElement(SignalProvenanceView, {
      provenance: provenance!,
    }))

    expect(html.match(/data-citation-id=/g)).toHaveLength(4)
    expect(html.match(/data-strength-publisher="true"/g)).toHaveLength(2)
    expect(html).toContain('Strength 2')
    expect(html).toContain('2 distinct Publishers, with the origin excluded')
    expect(html).toContain('First account of the claim')
    expect(html).toContain('A follow-up from the same Publisher')
    expect(html.indexOf('Origin Publisher')).toBeGreaterThan(html.indexOf('Alpha Publisher'))
    expect(html.indexOf('Origin Publisher')).toBeGreaterThan(html.indexOf('Beta Publisher'))
  })

  it('lists a known origin last even when it has no Citation of its own', async () => {
    const entryId = '00000000-0000-4000-8000-000000000791'
    const readProvenance = createSignalProvenanceReader(async () => [{
      admitted_by: 'interest',
      citation_first_seen_at: '2026-08-30T01:00:00.000Z',
      citation_id: '00000000-0000-4000-8000-000000000792',
      entry_signal_id: entryId,
      item_title: 'An independent Citation',
      item_url: null,
      origin_publisher_id: '00000000-0000-4000-8000-000000000793',
      origin_publisher_name: 'Known Origin',
      origin_url: 'https://origin.example/uncollected-story',
      publisher_id: '00000000-0000-4000-8000-000000000794',
      publisher_name: 'Independent Publisher',
      signal_id: '00000000-0000-4000-8000-000000000795',
      strength: 1,
      summary: null,
      title: 'A story Zis did not ingest directly',
    }])

    const provenance = await readProvenance(
      '00000000-0000-4000-8000-000000000790',
      entryId,
    )
    const html = renderToStaticMarkup(createElement(SignalProvenanceView, {
      provenance: provenance!,
    }))

    expect(html).toContain('Known Origin')
    expect(html).toContain('No Citation recorded.')
    expect(html.indexOf('Known Origin')).toBeGreaterThan(html.indexOf('Independent Publisher'))
    expect(html.match(/data-citation-id=/g)).toHaveLength(1)
    expect(html.match(/data-strength-publisher="true"/g)).toHaveLength(1)
  })
})
