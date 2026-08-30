export type TodayFormAction = (formData: FormData) => void | Promise<void>

export interface TodayBriefEntry {
  admittedBy: 'interest' | 'convergence'
  entryId: string
  isBookmarked: boolean
  isRead: boolean
  originUrl: string
  position: number
  signalId: string
  summary: string | null
  title: string
  whyText: string
}

export interface TodayBriefModel {
  entries: TodayBriefEntry[]
  hasBrief: boolean
  localDate: string
  previousBriefDate: string | null
}

export interface TodayBriefViewProps {
  actionTargets: {
    markRead: TodayFormAction
    save: TodayFormAction
  }
  brief: TodayBriefModel
}

const DESTINATIONS = [
  { href: '/', label: 'Today' },
  { href: '/earlier', label: 'Earlier' },
  { href: '/saved', label: 'Saved' },
  { href: '/interests', label: 'Interests' },
  { href: '/settings', label: 'Settings' },
] as const

const READING_GRID = 'xl:grid xl:grid-cols-[14rem_minmax(0,38rem)] xl:gap-x-8'

function dateLabel(localDate: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric',
  }).format(new Date(`${localDate}T12:00:00.000Z`))
}

function EmptyBrief({ previousBriefDate }: { previousBriefDate: string | null }) {
  return (
    <section className="mt-register" aria-label="Empty Brief">
      <p className="text-body text-ink-dim lg:text-body-lg">
        Nothing cleared the bar today. Not a quiet corner of the internet — a quiet day. Zis would rather hand you an empty page than pad one.
      </p>
      <nav aria-label="What to read next" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-meta text-ink-faint">
        <a className="underline decoration-rule underline-offset-4 hover:text-ink" href={previousBriefDate === null ? '/earlier' : `/earlier/${previousBriefDate}`}>
          Yesterday&apos;s Brief
        </a>
        <a className="underline decoration-rule underline-offset-4 hover:text-ink" href="/interests">
          Your Interests
        </a>
      </nav>
    </section>
  )
}

function EntryActionForm({
  action,
  disabled,
  label,
  signalId,
}: {
  action: TodayFormAction
  disabled: boolean
  label: string
  signalId: string
}) {
  return (
    <form action={action}>
      <input name="signalId" type="hidden" value={signalId} />
      <button
        className="underline decoration-rule underline-offset-4 hover:text-ink disabled:no-underline disabled:opacity-70"
        disabled={disabled}
        type="submit"
      >
        {label}
      </button>
    </form>
  )
}

function WhyText({ entry }: { entry: TodayBriefEntry }) {
  return (
    <p className="break-words text-meta text-ink-faint">
      <a
        className="underline decoration-rule underline-offset-4 hover:text-ink"
        href={`/signals/${entry.signalId}`}
      >
        {entry.whyText}
      </a>
    </p>
  )
}

function EntryActions({
  actionTargets,
  entry,
}: {
  actionTargets: TodayBriefViewProps['actionTargets']
  entry: TodayBriefEntry
}) {
  return (
    <>
      <div aria-live="polite" className="mt-3 hidden flex-wrap gap-x-5 gap-y-2 text-meta text-ink-faint lg:flex">
        <EntryActionForm
          action={actionTargets.save}
          disabled={entry.isBookmarked}
          label={entry.isBookmarked ? 'Saved' : 'Save'}
          signalId={entry.signalId}
        />
        <span aria-hidden="true">·</span>
        <EntryActionForm
          action={actionTargets.markRead}
          disabled={entry.isRead}
          label={entry.isRead ? 'Read' : 'Mark read'}
          signalId={entry.signalId}
        />
        <span aria-hidden="true">·</span>
        <a className="underline decoration-rule underline-offset-4 hover:text-ink" href={`/signals/${entry.signalId}`}>
          Why this?
        </a>
      </div>
      <details className="mt-3 text-meta text-ink-faint lg:hidden">
        <summary aria-label="Entry actions" className="w-fit cursor-pointer select-none marker:text-ink-faint">
          ⋯
        </summary>
        <div aria-live="polite" className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
          <EntryActionForm
            action={actionTargets.save}
            disabled={entry.isBookmarked}
            label={entry.isBookmarked ? 'Saved' : 'Save'}
            signalId={entry.signalId}
          />
          <EntryActionForm
            action={actionTargets.markRead}
            disabled={entry.isRead}
            label={entry.isRead ? 'Read' : 'Mark read'}
            signalId={entry.signalId}
          />
          <a className="underline decoration-rule underline-offset-4 hover:text-ink" href={`/signals/${entry.signalId}`}>
            Why this?
          </a>
        </div>
      </details>
    </>
  )
}

function BriefEntry({
  actionTargets,
  entry,
}: {
  actionTargets: TodayBriefViewProps['actionTargets']
  entry: TodayBriefEntry
}) {
  const isConvergence = entry.admittedBy === 'convergence'
  const titleLink = (
    <a
      className="break-words decoration-accent underline-offset-4 hover:underline"
      href={entry.originUrl}
      rel="noopener noreferrer"
      target="_blank"
    >
      {entry.title}
      {' ↗'}
    </a>
  )

  return (
    <article
      className={`${isConvergence ? 'mt-entry' : 'mt-entry first:mt-0'} ${READING_GRID}`}
      id={`entry-${entry.position}`}
    >
      <div className="min-w-0 xl:col-start-2 xl:row-start-1">
        {isConvergence
          ? <h3 className="text-body font-semibold tracking-[-0.012em] text-ink lg:text-body-lg">{titleLink}</h3>
          : <h2 className="text-title font-medium tracking-[-0.018em] text-ink lg:text-title-lg">{titleLink}</h2>}
        {entry.summary === null
          ? null
          : (
              <p className={isConvergence ? 'mt-2 break-words text-body text-ink-dim lg:text-body-lg' : 'mt-2 break-words text-body text-ink lg:text-body-lg'}>
                {entry.summary}
              </p>
            )}
      </div>
      <div className="mt-3 xl:col-start-1 xl:row-start-1 xl:mt-0 xl:pt-1 xl:text-right">
        <WhyText entry={entry} />
      </div>
      <div className="xl:col-start-2 xl:row-start-2">
        <EntryActions actionTargets={actionTargets} entry={entry} />
      </div>
    </article>
  )
}

function DesktopRail() {
  return (
    <aside className="hidden border-r border-rule px-8 py-12 lg:sticky lg:top-0 lg:block lg:h-screen lg:self-start">
      <p className="font-mono text-date font-semibold uppercase tracking-[0.22em] text-ink">
        Zis
      </p>
      <nav aria-label="Primary navigation" className="mt-10 text-meta">
        {DESTINATIONS.map(destination => (
          <a
            aria-current={destination.href === '/' ? 'page' : undefined}
            className={destination.href === '/' ? 'block py-1.5 text-ink' : 'block py-1.5 text-ink-faint hover:text-ink'}
            href={destination.href}
            key={destination.href}
          >
            {destination.label}
          </a>
        ))}
      </nav>
      <p className="mt-12 max-w-[10rem] text-meta text-ink-faint">
        A private, bounded brief. It ends on purpose.
      </p>
    </aside>
  )
}

function MobileFooter() {
  return (
    <footer className="mx-5 border-t border-rule pb-10 pt-5 lg:hidden">
      <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2 text-meta text-ink-faint">
        {DESTINATIONS.map(destination => (
          <a
            aria-current={destination.href === '/' ? 'page' : undefined}
            className={destination.href === '/' ? 'text-ink' : 'hover:text-ink'}
            href={destination.href}
            key={destination.href}
          >
            {destination.label}
          </a>
        ))}
      </nav>
    </footer>
  )
}

export function TodayBriefView({ actionTargets, brief }: TodayBriefViewProps) {
  const interestEntries = brief.entries.filter(entry => entry.admittedBy === 'interest')
  const convergenceEntries = brief.entries.filter(entry => entry.admittedBy === 'convergence')

  return (
    <div className="min-h-screen bg-paper text-ink lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)]">
      <a
        className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-10 focus:not-sr-only focus:bg-paper focus:px-3 focus:py-2 focus:text-meta focus:text-ink"
        href="#today-brief"
      >
        Skip to brief
      </a>
      <DesktopRail />
      <div className="min-w-0">
        <main className="min-w-0 px-5 py-10 sm:px-8 lg:px-12 lg:py-14 xl:px-16" id="today-brief">
          <div className="mx-auto max-w-measure lg:max-w-measure-lg xl:max-w-[54rem]">
            <div className={READING_GRID}>
              <header className="xl:col-start-2">
                <p className="font-mono text-date tabular-nums uppercase tracking-[0.16em] text-ink-faint">
                  {dateLabel(brief.localDate)}
                </p>
                <h1 className="mt-2 font-display text-title font-semibold tracking-[-0.025em] text-ink lg:text-title-lg">
                  Your brief
                </h1>
              </header>
            </div>

            {brief.hasBrief && brief.entries.length === 0
              ? (
                  <div className={READING_GRID}>
                    <div className="xl:col-start-2">
                      <EmptyBrief previousBriefDate={brief.previousBriefDate} />
                    </div>
                  </div>
                )
              : null}
            {!brief.hasBrief
              ? (
                  <div className={`mt-register ${READING_GRID}`}>
                    <p className="text-body text-ink-dim xl:col-start-2">
                      Today&apos;s Brief has not been cut yet.
                    </p>
                  </div>
                )
              : null}
            {interestEntries.length > 0
              ? (
                  <section aria-label="Stories matched to your Interests" className="mt-register">
                    {interestEntries.map(entry => (
                      <BriefEntry actionTargets={actionTargets} entry={entry} key={entry.entryId} />
                    ))}
                  </section>
                )
              : null}
            {convergenceEntries.length > 0
              ? (
                  <>
                    <div className={READING_GRID}>
                      <hr className="mt-register border-0 border-t border-rule xl:col-start-2" />
                    </div>
                    <section aria-labelledby="convergence-heading" className="pt-6">
                      <div className={READING_GRID}>
                        <h2 className="xl:col-start-2" id="convergence-heading">
                          <span className="block text-meta font-semibold uppercase tracking-[0.14em] text-ink">
                            You did not ask for this
                          </span>
                          <span className="mt-2 block max-w-measure text-meta text-ink-dim">
                            Enough independent Publishers converged on it that it arrives anyway.
                          </span>
                        </h2>
                      </div>
                      {convergenceEntries.map(entry => (
                        <BriefEntry actionTargets={actionTargets} entry={entry} key={entry.entryId} />
                      ))}
                    </section>
                  </>
                )
              : null}
          </div>
        </main>
        <MobileFooter />
      </div>
    </div>
  )
}
