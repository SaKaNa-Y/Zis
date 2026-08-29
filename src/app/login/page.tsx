import type { Metadata } from 'next'
import { login } from './actions'

export const metadata: Metadata = {
  title: 'Reader access — Zis',
}

export default function LoginPage() {
  return (
    <main className="login-surface relative isolate min-h-screen overflow-hidden bg-paper px-6 py-8 text-ink sm:px-10 sm:py-12 lg:px-16">
      <div aria-hidden="true" className="login-rule absolute inset-y-0 left-[8%] hidden w-[0.0625rem] bg-rule lg:block" />

      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-[76rem] content-between gap-16 sm:min-h-[calc(100vh-6rem)] lg:grid-cols-[minmax(0,1fr)_minmax(22rem,30rem)] lg:items-center lg:gap-24">
        <section className="max-w-[38rem] self-end pb-4 lg:self-center lg:pl-10">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.22em] text-ink-faint">
            Zis / reader access
          </p>
          <h1 className="mt-8 font-display text-[clamp(3rem,8vw,7rem)] leading-[0.9] tracking-[-0.045em] text-ink">
            One brief.
            <br />
            One reader.
          </h1>
          <p className="mt-8 max-w-[32rem] text-lg leading-relaxed text-ink-dim">
            A bounded morning starts behind one deliberate gate. Nothing to join,
            nothing to recover here.
          </p>
        </section>

        <section aria-labelledby="login-heading" className="self-start border-y border-rule py-8 lg:self-center lg:py-12">
          <div className="flex items-baseline justify-between gap-6">
            <h2 id="login-heading" className="font-display text-2xl tracking-[-0.02em]">
              Enter
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
              Enter Zis
            </button>
          </form>

          <p className="mt-8 font-mono text-xs leading-relaxed text-ink-faint">
            No signup · No reset route · Session revocable at the source
          </p>
        </section>
      </div>
    </main>
  )
}
