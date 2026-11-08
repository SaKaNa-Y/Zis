'use client'

import { useActionState } from 'react'
import { Text, useLocale } from '@/lib/i18n/context'
import { changePassphrase, signOutEverywhere } from './actions'

const inputClass = 'mt-2 block w-full rounded-sm border border-ink-faint bg-paper px-3 py-2 text-body text-ink'
const buttonClass = 'rounded-sm border border-ink bg-paper px-4 py-2 text-meta text-ink disabled:opacity-40'

export function AccountControls() {
  const { t } = useLocale()
  const [changeFeedback, changeAction, changing] = useActionState(changePassphrase, {})
  const [signOutFeedback, signOutAction, signingOut] = useActionState(signOutEverywhere, {})
  const busy = changing || signingOut
  return (
    <div className="mt-5">
      <details>
        <summary className="cursor-pointer text-body underline underline-offset-4"><Text en="Change passphrase" zh="修改口令" /></summary>
        <p id="passphrase-guidance" className="mt-4 text-meta text-ink-dim"><Text en="Generate and save the new passphrase in your password manager. Use 32–1024 UTF-8 bytes (32 or more ASCII characters). There is no in-app recovery." zh="请使用密码管理器生成并保存新口令。长度为 32–1024 个 UTF-8 字节（至少 32 个 ASCII 字符）。应用内没有找回口令功能。" /></p>
        <p className="mt-3 text-meta text-ink-dim"><Text en="After changing it, every device will be signed out, including this one. Sign in again with the new passphrase." zh="修改后包括当前设备在内的所有设备都会退出登录，请使用新口令重新登录。" /></p>
        <form action={changeAction} className="mt-5">
          <fieldset disabled={busy} className="space-y-4">
            <legend className="sr-only"><Text en="Change passphrase" zh="修改口令" /></legend>
            <label className="block text-meta" htmlFor="current-passphrase">
              <Text en="Current passphrase" zh="当前口令" />
              <input id="current-passphrase" name="currentPassphrase" type="password" autoComplete="current-password" required className={inputClass} />
            </label>
            <label className="block text-meta" htmlFor="new-passphrase">
              <Text en="New passphrase" zh="新口令" />
              <input id="new-passphrase" name="newPassphrase" type="password" autoComplete="new-password" aria-describedby="passphrase-guidance" required className={inputClass} />
            </label>
            <label className="block text-meta" htmlFor="confirm-passphrase">
              <Text en="Confirm new passphrase" zh="确认新口令" />
              <input id="confirm-passphrase" name="confirmation" type="password" autoComplete="new-password" required className={inputClass} />
            </label>
            <button type="submit" className={buttonClass}>{changing ? t('Changing…', '正在修改…') : t('Change passphrase and sign out', '修改口令并退出登录')}</button>
          </fieldset>
          <p role="status" className="mt-3 text-meta text-ink-dim">{changeFeedback.error}</p>
        </form>
      </details>
      <details className="mt-7">
        <summary className="cursor-pointer text-body underline underline-offset-4"><Text en="Sign out everywhere" zh="退出所有设备" /></summary>
        <p className="mt-4 text-meta text-ink-dim"><Text en="End all author sessions, including this browser." zh="退出包括当前浏览器在内的所有作者会话。" /></p>
        <form action={signOutAction} className="mt-4">
          <fieldset disabled={busy}>
            <legend className="sr-only"><Text en="Confirm sign out everywhere" zh="确认退出所有设备" /></legend>
            <label className="flex items-start gap-3 text-meta">
              <input name="confirm" value="yes" type="checkbox" required className="mt-1" />
              <Text en="Sign out on every device, including this one." zh="退出包括当前设备在内的所有设备。" />
            </label>
            <button type="submit" className={`${buttonClass} mt-4`}>{signingOut ? t('Signing out…', '正在退出…') : t('Confirm sign out everywhere', '确认退出所有设备')}</button>
          </fieldset>
          <p role="status" className="mt-3 text-meta text-ink-dim">{signOutFeedback.error}</p>
        </form>
      </details>
    </div>
  )
}
