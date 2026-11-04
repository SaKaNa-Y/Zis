'use client'

import type { InterestStatement } from '@/lib/interests/validation'

import { useActionState, useState } from 'react'
import { Text, useLocale } from '@/lib/i18n/context'
import { MAX_CHARACTERS, MAX_INTERESTS, mayNotMatch } from '@/lib/interests/validation'
import { saveInterestProfile } from './actions'

function editableRows(profile: InterestStatement[]) {
  return (profile.length ? profile : [{ statement: '' }]).map((row, index) => ({ ...row, key: row.id ?? `new-${index}` }))
}

export function InterestEditor({ profile }: { profile: InterestStatement[] }) {
  const { t } = useLocale()
  const [rows, setRows] = useState(() => editableRows(profile))
  const [dirty, setDirty] = useState(false)
  const [feedback, action, pending] = useActionState<{ error?: string, saved?: boolean }, FormData>(async (_previous: { error?: string, saved?: boolean }, formData: FormData) => {
    const result = await saveInterestProfile(formData)
    if (result.profile) {
      setRows(editableRows(result.profile))
      setDirty(false)
      return { saved: true }
    }
    return { error: result.error }
  }, {})
  const invalid = rows.some(row => !row.statement.trim() || Array.from(row.statement.trim()).length > MAX_CHARACTERS)

  return (
    <form action={action} className="mt-register">
      <input type="hidden" name="profile" value={JSON.stringify(rows.map(({ id, statement }) => ({ id, statement })))} />
      <fieldset disabled={pending}>
        <legend className="sr-only"><Text en="Your Interest statements" zh="你的关注兴趣" /></legend>
        <ol className="space-y-7">
          {rows.map((row, index) => {
            const count = Array.from(row.statement).length
            const noteId = `interest-note-${row.key}`
            return (
              <li key={row.key}>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <label htmlFor={`interest-${row.key}`} className="font-mono text-date tabular-nums">
                    {t('Interest', '关注兴趣')}
                    {' '}
                    {String(index + 1).padStart(2, '0')}
                  </label>
                  <button
                    type="button"
                    disabled={rows.length === 1}
                    className="text-meta text-ink-dim underline underline-offset-4 disabled:opacity-40"
                    onClick={() => {
                      setRows(rows.filter(candidate => candidate.key !== row.key))
                      setDirty(true)
                    }}
                  >
                    <Text en="Remove" zh="移除" />
                  </button>
                </div>
                <textarea
                  id={`interest-${row.key}`}
                  aria-describedby={noteId}
                  aria-invalid={count > MAX_CHARACTERS || undefined}
                  className="block min-h-28 w-full resize-y rounded-sm border border-rule bg-paper px-4 py-3 text-body text-ink focus:outline-2 focus:outline-offset-2 focus:outline-ink"
                  rows={3}
                  required
                  value={row.statement}
                  onChange={(event) => {
                    setRows(rows.map(candidate => candidate.key === row.key ? { ...candidate, statement: event.target.value } : candidate))
                    setDirty(true)
                  }}
                />
                <div id={noteId} className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-meta text-ink-faint">
                  <span className="font-mono tabular-nums">
                    {count}
                    {' '}
                    /
                    {' '}
                    {MAX_CHARACTERS}
                    {' '}
                    {t('characters', '字符')}
                  </span>
                  {mayNotMatch(row.statement) && <span><Text en="This Interest may not match. English statements work best." zh="这条兴趣可能无法匹配，目前英文描述的匹配效果更好。" /></span>}
                </div>
              </li>
            )
          })}
        </ol>
        <p className="mt-5 text-meta text-ink-faint"><Text en="Keep 1–20 Interests. Add a replacement before removing your last Interest." zh="保留 1–20 条关注兴趣。删除最后一条之前，请先添加替代内容。" /></p>
        <div className="mt-5 flex flex-wrap items-center gap-5">
          <button
            type="button"
            disabled={rows.length >= MAX_INTERESTS}
            className="text-meta underline underline-offset-4 disabled:opacity-40"
            onClick={() => {
              setRows([...rows, { key: crypto.randomUUID(), statement: '' }])
              setDirty(true)
            }}
          >
            <Text en="Add Interest" zh="添加关注兴趣" />
          </button>
          <button type="submit" disabled={invalid || !dirty} className="rounded-sm border border-ink bg-paper px-4 py-2 text-meta text-ink disabled:opacity-40">{pending ? t('Saving…', '正在保存…') : t('Save changes', '保存修改')}</button>
        </div>
      </fieldset>
      <p role="status" className="mt-4 text-meta text-ink-dim">
        {feedback.error ?? (dirty ? t('Unsaved changes.', '修改尚未保存。') : feedback.saved ? t('Saved. Your changes apply to future Briefs.', '已保存，将应用于后续简报。') : '')}
      </p>
    </form>
  )
}
