import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TodayBriefView } from './today'

const actionTargets = {
  markRead: async () => {},
  save: async () => {},
}

describe('today brief', () => {
  it('renders a cut empty Brief as an intentional boundary with the two useful next destinations', () => {
    const html = renderToStaticMarkup(createElement(TodayBriefView, {
      actionTargets,
      brief: {
        entries: [],
        hasBrief: true,
        localDate: '2026-08-30',
        previousBriefDate: '2026-08-29',
      },
    }))

    expect(html).toContain('Nothing cleared the bar today.')
    expect(html).toContain('Not a quiet corner of the internet — a quiet day.')
    expect(html).toContain('Zis would rather hand you an empty page than pad one.')
    expect(html).toContain('href="/earlier/2026-08-29"')
    expect(html).toContain('Yesterday&#x27;s Brief')
    expect(html).toContain('href="/interests"')
    expect(html).toContain('Your Interests')
    expect(html).not.toContain('<article')
    expect(html).toMatch(/<p class="[^"]*text-body[^"]*">Nothing cleared the bar today\. Not a quiet corner of the internet — a quiet day\. Zis would rather hand you an empty page than pad one\.<\/p>/)
  })

  it('renders one Entry in the ordinary rhythm with its external and internal destinations', () => {
    const signalId = '00000000-0000-4000-8000-000000000076'
    const whyText = '2 Publishers converged · Alpha, Beta · origin: database.example · matched: "Database internals"'
    const html = renderToStaticMarkup(createElement(TodayBriefView, {
      actionTargets,
      brief: {
        entries: [{
          admittedBy: 'interest',
          entryId: signalId,
          isBookmarked: false,
          isRead: false,
          originUrl: 'https://database.example/deep-storage',
          position: 1,
          signalId,
          summary: 'A careful account of a storage engine trade-off, written in plain text.',
          title: 'Inside the storage engine',
          whyText,
        }],
        hasBrief: true,
        localDate: '2026-08-30',
        previousBriefDate: '2026-08-29',
      },
    }))

    expect(html.match(/<article/g)).toHaveLength(1)
    expect(html).toMatch(/<section[^>]*class="mt-register"[^>]*><article class="mt-entry first:mt-0 /)
    expect(html).toContain('href="https://database.example/deep-storage"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('Inside the storage engine ↗')
    expect(html).toContain('A careful account of a storage engine trade-off, written in plain text.')
    expect(html).toContain(`href="/signals/${signalId}"`)
    expect(html).toContain(whyText.replaceAll('"', '&quot;'))
    expect(html.match(/<form/g)).toHaveLength(4)
    expect(html).toContain(`name="signalId" value="${signalId}"`)
    expect(html).not.toContain('You did not ask for this')
    expect(html).not.toContain('<img')
  })

  it('places the complete convergence explanation after the interest register and steps its type down', () => {
    const entries = [
      {
        admittedBy: 'interest' as const,
        entryId: '00000000-0000-4000-8000-000000000101',
        isBookmarked: false,
        isRead: false,
        originUrl: 'https://one.example/story',
        position: 1,
        signalId: '00000000-0000-4000-8000-000000000101',
        summary: 'The first requested story.',
        title: 'Interest story one',
        whyText: '2 Publishers converged · One, Two · origin: one.example · matched: "Storage engines"',
      },
      {
        admittedBy: 'interest' as const,
        entryId: '00000000-0000-4000-8000-000000000102',
        isBookmarked: true,
        isRead: false,
        originUrl: 'https://two.example/story',
        position: 2,
        signalId: '00000000-0000-4000-8000-000000000102',
        summary: null,
        title: 'Interest story two',
        whyText: '2 Publishers converged · Three, Four · origin: two.example · matched: "Build tools"',
      },
      {
        admittedBy: 'convergence' as const,
        entryId: '00000000-0000-4000-8000-000000000103',
        isBookmarked: false,
        isRead: true,
        originUrl: 'https://wire.example/story',
        position: 3,
        signalId: '00000000-0000-4000-8000-000000000103',
        summary: 'Independent Publishers converged on an unrequested story.',
        title: 'The wire story',
        whyText: '4 Publishers converged · Five, Six, Seven, +1 · origin: wire.example · no Interest matched — surfacing on convergence alone',
      },
    ]
    const html = renderToStaticMarkup(createElement(TodayBriefView, {
      actionTargets,
      brief: {
        entries,
        hasBrief: true,
        localDate: '2026-08-30',
        previousBriefDate: '2026-08-29',
      },
    }))

    const interestIndex = html.indexOf('Interest story one')
    const ruleIndex = html.indexOf('<hr')
    const headingIndex = html.indexOf('You did not ask for this')
    const convergenceIndex = html.indexOf('The wire story')

    expect(interestIndex).toBeGreaterThan(-1)
    expect(ruleIndex).toBeGreaterThan(interestIndex)
    expect(headingIndex).toBeGreaterThan(ruleIndex)
    expect(convergenceIndex).toBeGreaterThan(headingIndex)
    expect(html).toContain('Enough independent Publishers converged on it that it arrives anyway.')
    expect(html).toMatch(/<h3 class="[^"]*text-body[^"]*font-semibold[^"]*"[^>]*><a[^>]*>The wire story ↗<\/a><\/h3>/)
    expect(html.split(entries[2]!.whyText)).toHaveLength(2)
    expect(html).not.toMatch(/badge/i)
    expect(html).toContain('aria-label="Primary navigation"')
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('aria-label="Footer navigation"')
    expect(html).toContain('href="#today-brief"')
    expect(html).toContain('Skip to brief')
    expect(html).toContain('<details')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('max-w-measure lg:max-w-measure-lg')
    expect(html).toContain('break-words')
    expect(html).not.toContain('leading-relaxed')
    expect(html).not.toContain('first-of-type:mt-6')
  })
})
