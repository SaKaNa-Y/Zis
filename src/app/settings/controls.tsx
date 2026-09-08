'use client'

import type { Appearance } from '@/lib/settings/appearance'
import { useActionState, useState, useTransition } from 'react'
import { isAppearance } from '@/lib/settings/appearance'
import { changePassphrase, saveAppearance, signOutEverywhere } from './actions'

export function AppearanceControl({ initialAppearance }: { initialAppearance: Appearance }) {
  const [appearance, setAppearance] = useState(initialAppearance)
  const [feedback, setFeedback] = useState('')
  const [pending, startTransition] = useTransition()

  function select(value: string) {
    if (!isAppearance(value))
      return
    const previous = appearance
    setAppearance(value)
    document.documentElement.className = value
    startTransition(async () => {
      let error: string | undefined
      try {
        error = (await saveAppearance(value)).error
      }
      catch {
        error = 'Appearance could not be saved. Check your connection and try again.'
      }
      if (error) {
        setAppearance(previous)
        document.documentElement.className = previous
      }
      setFeedback(error ?? 'Appearance saved.')
    })
  }

  return (
    <div className="mt-4">
      <label className="sr-only" htmlFor="appearance">Appearance</label>
      <select id="appearance" value={appearance} disabled={pending} onChange={event => select(event.target.value)} className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-meta sm:w-auto">
        <option value="system">Match system</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      <p role="status" className="mt-2 min-h-5 text-meta text-ink-dim">{pending ? 'Saving…' : feedback}</p>
    </div>
  )
}

const inputClass = 'mt-2 block w-full rounded-sm border border-rule bg-paper px-3 py-2 text-body text-ink'
const buttonClass = 'rounded-sm border border-ink bg-paper px-4 py-2 text-meta text-ink disabled:opacity-40'

export function AccountControls() {
  const [changeFeedback, changeAction, changing] = useActionState(changePassphrase, {})
  const [signOutFeedback, signOutAction, signingOut] = useActionState(signOutEverywhere, {})
  const busy = changing || signingOut
  return (
    <div className="mt-5">
      <details>
        <summary className="cursor-pointer text-body underline underline-offset-4">Change passphrase</summary>
        <p id="passphrase-guidance" className="mt-4 text-meta text-ink-dim">Generate and save the new passphrase in your password manager. Use 32–1024 UTF-8 bytes (32 or more ASCII characters). There is no in-app recovery.</p>
        <p className="mt-3 text-meta text-ink-dim">After changing it, every device will be signed out, including this one. Sign in again with the new passphrase.</p>
        <form action={changeAction} className="mt-5">
          <fieldset disabled={busy} className="space-y-4">
            <legend className="sr-only">Change passphrase</legend>
            <label className="block text-meta" htmlFor="current-passphrase">
              Current passphrase
              <input id="current-passphrase" name="currentPassphrase" type="password" autoComplete="current-password" required className={inputClass} />
            </label>
            <label className="block text-meta" htmlFor="new-passphrase">
              New passphrase
              <input id="new-passphrase" name="newPassphrase" type="password" autoComplete="new-password" aria-describedby="passphrase-guidance" required className={inputClass} />
            </label>
            <label className="block text-meta" htmlFor="confirm-passphrase">
              Confirm new passphrase
              <input id="confirm-passphrase" name="confirmation" type="password" autoComplete="new-password" required className={inputClass} />
            </label>
            <button type="submit" className={buttonClass}>{changing ? 'Changing…' : 'Change passphrase and sign out'}</button>
          </fieldset>
          <p role="status" className="mt-3 text-meta text-ink-dim">{changeFeedback.error}</p>
        </form>
      </details>
      <details className="mt-7">
        <summary className="cursor-pointer text-body underline underline-offset-4">Sign out everywhere</summary>
        <p className="mt-4 text-meta text-ink-dim">End every existing session, including this browser. Your Briefs and appearance preference stay as they are.</p>
        <form action={signOutAction} className="mt-4">
          <fieldset disabled={busy}>
            <legend className="sr-only">Confirm sign out everywhere</legend>
            <label className="flex items-start gap-3 text-meta">
              <input name="confirm" value="yes" type="checkbox" required className="mt-1" />
              Sign out on every device, including this one.
            </label>
            <button type="submit" className={`${buttonClass} mt-4`}>{signingOut ? 'Signing out…' : 'Confirm sign out everywhere'}</button>
          </fieldset>
          <p role="status" className="mt-3 text-meta text-ink-dim">{signOutFeedback.error}</p>
        </form>
      </details>
    </div>
  )
}
