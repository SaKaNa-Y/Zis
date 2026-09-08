'use client'

import type { SavedEntry, SavedPage } from '@/lib/bookmarks/saved'
import { useActionState } from 'react'
import { changeBookmark } from './actions'

interface Removal {
  entry: SavedEntry
  receipt: string
}
interface Feedback {
  removed: Removal[]
  error?: string
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`))
}

export function SavedList({ saved }: { saved: SavedPage }) {
  const [feedback, action, pending] = useActionState<Feedback, FormData>(async (previous, formData) => {
    const removedEntry = saved.entries.find(entry => entry.signalId === formData.get('signalId'))
    let result
    try {
      result = await changeBookmark(formData)
    }
    catch {
      return { ...previous, error: 'Unable to confirm your change. Reload to check your saved Signals.' }
    }
    if (result.error)
      return { ...previous, error: result.error }
    if (formData.get('operation') === 'undo')
      return { removed: previous.removed.filter(removal => removal.receipt !== formData.get('receipt')) }
    if (!result.receipt || !removedEntry)
      return { removed: previous.removed }
    return { removed: [...previous.removed, {
      entry: removedEntry,
      receipt: result.receipt,
    }] }
  }, { removed: [] })

  const removals = new Map(feedback.removed.map(removal => [removal.entry.signalId, removal]))
  const entries = [...saved.entries.filter(entry => !removals.has(entry.signalId)), ...feedback.removed.map(removal => removal.entry)]
    .sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt) || left.signalId.localeCompare(right.signalId))

  return (
    <>
      <fieldset disabled={pending} className="mt-register min-w-0">
        <legend className="sr-only">Saved Signals</legend>
        {entries.length === 0
          ? (
              <p className="text-body text-ink-dim">
                {saved.page === 1 ? 'No saved Signals yet. Save a Signal from a Brief to find it here.' : 'There are no saved Signals on this page.'}
                {' '}
                <a href={saved.page === 1 ? '/' : '/saved'} className="underline underline-offset-4">{saved.page === 1 ? 'Return to Today' : 'Return to the first page'}</a>
              </p>
            )
          : (
              <ul className="divide-y divide-rule">
                {entries.map(entry => removals.has(entry.signalId)
                  ? (
                      <li key={entry.signalId} className="py-5 first:pt-0">
                        <form action={action} className="text-meta text-ink-dim">
                          <input type="hidden" name="operation" value="undo" />
                          <input type="hidden" name="receipt" value={removals.get(entry.signalId)!.receipt} />
                          Removed:
                          {' '}
                          {entry.title}
                          {' · '}
                          <button type="submit" className="underline underline-offset-4 disabled:opacity-40" aria-label={`Undo removal of ${entry.title}`}>Undo</button>
                        </form>
                        <p className="mt-2 text-meta text-ink-faint">Undo is available until you leave, reload, or change pages.</p>
                      </li>
                    )
                  : (
                      <li key={entry.signalId} className="py-5 first:pt-0">
                        <a href={entry.originUrl} target="_blank" rel="noopener noreferrer" className="break-words text-body font-semibold underline decoration-rule underline-offset-4 hover:text-ink-dim lg:text-body-lg">
                          {entry.title}
                          <span aria-label=" (opens in a new tab)" className="text-ink-faint"> ↗</span>
                        </a>
                        <p className="mt-2 break-words text-meta text-ink-dim">{entry.originName || new URL(entry.originUrl).hostname}</p>
                        <p className="mt-2 text-meta text-ink-faint">
                          Saved
                          {' '}
                          <time dateTime={entry.savedDate}>{dateLabel(entry.savedDate)}</time>
                          {' · '}
                          <a href={`/signals/${entry.entryId}`} className="underline decoration-dotted underline-offset-4 hover:text-ink">
                            Why this? Brief of
                            {' '}
                            {dateLabel(entry.briefDate)}
                          </a>
                        </p>
                        <form action={action} className="mt-3">
                          <input type="hidden" name="operation" value="remove" />
                          <input type="hidden" name="signalId" value={entry.signalId} />
                          <button type="submit" aria-label={`Remove ${entry.title} from Saved`} className="text-meta text-ink-dim underline underline-offset-4 disabled:opacity-40">Remove</button>
                        </form>
                      </li>
                    ))}
              </ul>
            )}
      </fieldset>
      <p role="status" className="mt-4 text-meta text-ink-dim">{feedback.error ?? (pending ? 'Saving…' : feedback.removed.length ? 'Bookmark removed. Undo is available in its place.' : '')}</p>
      <nav aria-label="Saved pages" className="mt-register flex flex-wrap justify-between gap-5 text-meta">
        {saved.page > 1 && <a href={`/saved?page=${saved.page - 1}`} className="underline underline-offset-4">Previous page</a>}
        {saved.hasNext && <a href={`/saved?page=${saved.page + 1}`} className="ml-auto underline underline-offset-4">Next page</a>}
      </nav>
    </>
  )
}
