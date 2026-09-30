import type { Metadata } from 'next'
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
        <span className="eyebrow">A private reading space</span>
      </header>
      <div className="login-grid">
        <section className="login-intro">
          <p className="eyebrow text-accent">Less noise. More perspective.</p>
          <h1>
            One brief.
            <br />
            <span>Room to think.</span>
          </h1>
          <p>A considered selection of what mattered in tech. Shaped by your Interests. Finished when you are.</p>
          <div className="login-motif" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>

        <section aria-labelledby="login-heading" className="login-card">
          <div className="flex items-baseline justify-between gap-6">
            <h2 id="login-heading" className="font-display text-2xl tracking-[-0.02em]">
              Welcome back
            </h2>
            <span className="font-mono text-xs uppercase tracking-[0.16em] text-ink-faint">
              Private
            </span>
          </div>

          <p id="passphrase-note" className="mt-4 text-sm leading-relaxed text-ink-dim">
            Use the generated secret held in your password manager.
          </p>

          <form action={login} className="mt-10">
            <label className="block font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim" htmlFor="passphrase">
              Passphrase
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
              Enter your reading space →
            </button>
          </form>

          <p className="mt-8 font-mono text-xs leading-relaxed text-ink-faint">
            No signup · No reset route · Session revocable at the source
          </p>
        </section>
      </div>
      <footer className="login-footer eyebrow">One reader. One brief. Then back to your day.</footer>
    </main>
  )
}
