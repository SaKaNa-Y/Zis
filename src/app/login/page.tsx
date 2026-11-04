import type { Metadata } from 'next'
import { Text } from '@/lib/i18n/context'
import { ZisBrand } from '../destinations'
import { login } from './actions'

export const metadata: Metadata = {
  title: 'Reader access — Zis',
}

export default function LoginPage() {
  return (
    <main className="login-surface">
      <header className="login-topbar">
        <ZisBrand />
        <span className="eyebrow"><Text en="A private reading space" zh="私人的阅读空间" /></span>
      </header>
      <div className="login-grid">
        <section className="login-intro">
          <p className="eyebrow text-accent"><Text en="Less noise. More perspective." zh="少些噪声，多些视角。" /></p>
          <h1>
            <Text en="One brief." zh="一份简报。" />
            <br />
            <span><Text en="Room to think." zh="留出思考空间。" /></span>
          </h1>
          <p><Text en="A considered selection of what mattered in tech. Shaped by your Interests. Finished when you are." zh="精选技术领域的重要变化，围绕你的关注兴趣，读完即可安心离开。" /></p>
          <div className="login-motif" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>

        <section aria-labelledby="login-heading" className="login-card">
          <div className="flex items-baseline justify-between gap-6">
            <h2 id="login-heading" className="font-display text-2xl tracking-[-0.02em]">
              <Text en="Welcome back" zh="欢迎回来" />
            </h2>
            <span className="font-mono text-xs uppercase tracking-[0.16em] text-ink-faint">
              <Text en="Private" zh="私人空间" />
            </span>
          </div>

          <p id="passphrase-note" className="mt-4 text-sm leading-relaxed text-ink-dim">
            <Text en="Use the generated secret held in your password manager." zh="请使用保存在密码管理器中的口令。" />
          </p>

          <form action={login} className="mt-10">
            <label className="block font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim" htmlFor="passphrase">
              <Text en="Passphrase" zh="口令" />
            </label>
            <input
              aria-describedby="passphrase-note"
              autoCapitalize="none"
              autoComplete="current-password"
              className="mt-3 block w-full border border-rule bg-paper-sunk px-4 py-4 font-mono text-base tracking-[0.04em] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent focus:ring-offset-4 focus:ring-offset-paper"
              id="passphrase"
              name="passphrase"
              required
              spellCheck={false}
              type="password"
            />

            <button className="mt-8 w-full border border-accent bg-accent px-5 py-4 font-mono text-sm font-semibold uppercase tracking-[0.16em] text-paper hover:border-ink hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" type="submit">
              <Text en="Enter your reading space →" zh="进入你的阅读空间 →" />
            </button>
          </form>

          <p className="mt-8 font-mono text-xs leading-relaxed text-ink-faint">
            <Text en="No signup · No reset route · Session revocable at the source" zh="不提供注册或口令重置，可由管理员撤销登录会话" />
          </p>
        </section>
      </div>
      <footer className="login-footer eyebrow"><Text en="One reader. One brief. Then back to your day." zh="一位读者，一份简报，然后回到你的生活。" /></footer>
    </main>
  )
}
