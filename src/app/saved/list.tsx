'use client'

import type { SavedEntry, SavedPage } from '@/lib/bookmarks/saved'
import type { TranslationAction } from '@/lib/translations/model'
import { useActionState } from 'react'

import { Text, useLocale } from '@/lib/i18n/context'
import { useReadingTranslation } from '@/lib/translations/reading'
import { changeBookmark } from './actions'

interface Removal {
  entry: SavedEntry
  receipt: string
}
interface Feedback {
  removed: Removal[]
  error?: string
}

function dateLabel(value: string, language = 'en') {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`))
}

export function SavedList({ saved, translationAction }: { saved: SavedPage, translationAction?: TranslationAction }) {
  const { t, language } = useLocale()
  const [feedback, action, pending] = useActionState<Feedback, FormData>(async (previous, formData) => {
    const removedEntry = saved.entries.find(entry => entry.signalId === formData.get('signalId'))
    let result
    try {
      result = await changeBookmark(formData)
    }
    catch {
      return { ...previous, error: t('Unable to confirm your change. Reload to check your saved Signals.', '无法确认修改结果，请刷新后检查收藏。') }
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
        <legend className="sr-only"><Text en="Saved Signals" zh="已收藏内容" /></legend>
        {entries.length === 0
          ? (
              <p className="text-body text-ink-dim">
                {saved.page === 1 ? t('No saved Signals yet. Save a Signal from a Brief to find it here.', '尚未收藏内容。从简报中收藏后，可在这里找到。') : t('There are no saved Signals on this page.', '这一页没有收藏内容。')}
                {' '}
                <a href={saved.page === 1 ? '/' : '/saved'} className="underline underline-offset-4">{saved.page === 1 ? t('Return to Today', '返回今天') : t('Return to the first page', '返回第一页')}</a>
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
                          {t('Removed:', '已移除：')}
                          {' '}
                          {entry.title}
                          {' · '}
                          <button type="submit" className="underline underline-offset-4 disabled:opacity-40" aria-label={t(`Undo removal of ${entry.title}`, `撤销移除 ${entry.title}`)}><Text en="Undo" zh="撤销" /></button>
                        </form>
                        <p className="mt-2 text-meta text-ink-faint"><Text en="Undo is available until you leave, reload, or change pages." zh="离开、刷新或切换页面之前，可以撤销。" /></p>
                      </li>
                    )
                  : (
                      <li key={entry.signalId} className="py-5 first:pt-0">
                        <SavedTitle entry={entry} action={translationAction} />
                        <p className="mt-2 break-words text-meta text-ink-dim">{entry.originName || new URL(entry.originUrl).hostname}</p>
                        <p className="mt-2 text-meta text-ink-faint">
                          {t('Saved', '收藏于')}
                          {' '}
                          <time dateTime={entry.savedDate}>{dateLabel(entry.savedDate, language)}</time>
                          {' · '}
                          <a href={`/signals/${entry.entryId}`} className="underline decoration-dotted underline-offset-4 hover:text-ink">
                            {t('Why this? Brief of', '查看入选理由，所属简报：')}
                            {' '}
                            {dateLabel(entry.briefDate, language)}
                          </a>
                        </p>
                        <form action={action} className="mt-3">
                          <input type="hidden" name="operation" value="remove" />
                          <input type="hidden" name="signalId" value={entry.signalId} />
                          <button type="submit" aria-label={t(`Remove ${entry.title} from Saved`, `从收藏中移除 ${entry.title}`)} className="text-meta text-ink-dim underline underline-offset-4 disabled:opacity-40"><Text en="Remove" zh="移除" /></button>
                        </form>
                      </li>
                    ))}
              </ul>
            )}
      </fieldset>
      <p role="status" className="mt-4 text-meta text-ink-dim">{feedback.error ?? (pending ? t('Saving…', '正在保存…') : feedback.removed.length ? t('Bookmark removed. Undo is available in its place.', '已移除收藏，可以在原位置撤销。') : '')}</p>
      <nav aria-label={t('Saved pages', '收藏分页')} className="mt-register flex flex-wrap justify-between gap-5 text-meta">
        {saved.page > 1 && <a href={`/saved?page=${saved.page - 1}`} className="underline underline-offset-4"><Text en="Previous page" zh="上一页" /></a>}
        {saved.hasNext && <a href={`/saved?page=${saved.page + 1}`} className="ml-auto underline underline-offset-4"><Text en="Next page" zh="下一页" /></a>}
      </nav>
    </>
  )
}

function SavedTitle({ entry, action }: { entry: SavedEntry, action?: TranslationAction }) {
  const { t } = useLocale()
  const translation = useReadingTranslation(entry.entryId, { title: entry.title, summary: null, whyText: '' }, action)
  return (
    <>
      <a lang={translation.lang} href={entry.originUrl} target="_blank" rel="noopener noreferrer" className="reading-title break-words font-semibold underline decoration-rule underline-offset-4 hover:text-ink-dim">
        {translation.text.title}
        <span aria-label={t(' (opens in a new tab)', '（在新标签页打开）')} className="text-ink-faint"> ↗</span>
      </a>
      {translation.controls}
    </>
  )
}
