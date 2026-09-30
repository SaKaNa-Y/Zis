import { DestinationNavigation, MobileDestinationFooter } from './destinations'

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
  period?: 'today' | 'earlier'
}

const READING_GRID = 'brief-grid'

function signalProvenanceHref(entrySignalId: string): string {
  return `/signals/${entrySignalId}`
}

export function dateLabel(localDate: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric',
  }).format(new Date(`${localDate}T12:00:00.000Z`))
}

function EmptyBrief({ previousBriefDate, period }: { previousBriefDate: string | null, period: 'today' | 'earlier' }) {
  return (
    <section className="mt-register" aria-label="Empty Brief">
      <p className="text-body text-ink-dim lg:text-body-lg">
        Nothing cleared the bar
        {' '}
        {period === 'today' ? 'today' : 'on this day'}
        . Not a quiet corner of the internet — a quiet day. Zis would rather hand you an empty page than pad one.
      </p>
      <nav aria-label="What to read next" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-meta text-ink-faint">
        <a className="underline decoration-rule underline-offset-4 hover:text-ink" href={previousBriefDate === null ? '/earlier' : `/earlier/${previousBriefDate}`}>
          {period === 'today' ? 'Yesterday\'s Brief' : 'Previous Brief'}
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
        className="entry-action disabled:opacity-70"
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
        href={signalProvenanceHref(entry.entryId)}
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
        <a className="underline decoration-rule underline-offset-4 hover:text-ink" href={signalProvenanceHref(entry.entryId)}>
          Why this?
        </a>
      </div>
      <details className="mt-3 text-meta text-ink-faint lg:hidden">
        <summary aria-label="Entry actions" className="entry-action w-fit cursor-pointer select-none">
          Actions
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
          <a className="underline decoration-rule underline-offset-4 hover:text-ink" href={signalProvenanceHref(entry.entryId)}>
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
      className={`${isConvergence ? 'mt-entry' : 'mt-entry first:mt-0'} ${READING_GRID} brief-entry`}
      id={`entry-${entry.position}`}
    >
      <span className="entry-number" aria-hidden="true">{String(entry.position).padStart(2, '0')}</span>
      <div className="entry-copy">
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
      <div className="entry-context">
        <span className="context-label">Why this surfaced</span>
        <WhyText entry={entry} />
      </div>
      <div className="entry-tools">
        <EntryActions actionTargets={actionTargets} entry={entry} />
      </div>
    </article>
  )
}

export function TodayBriefView({ actionTargets, brief, period = 'today' }: TodayBriefViewProps) {
  const interestEntries = brief.entries.filter(entry => entry.admittedBy === 'interest')
  const convergenceEntries = brief.entries.filter(entry => entry.admittedBy === 'convergence')

  return (
    <div className="brief-v2">
      <a
        className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-10 focus:not-sr-only focus:bg-paper focus:px-3 focus:py-2 focus:text-meta focus:text-ink"
        href="#today-brief"
      >
        Skip to brief
      </a>
      <DestinationNavigation current={period === 'today' ? '/' : '/earlier'} />
      <div className="min-w-0">
        <main className="brief-canvas" id="today-brief">
          <div className="brief-document">
            <div className={READING_GRID}>
              <header className="brief-intro">
                <p className="font-mono text-date tabular-nums uppercase tracking-[0.16em] text-ink-faint">
                  {dateLabel(brief.localDate)}
                </p>
                <h1 className="brief-heading">
                  Your daily
                  {' '}
                  <span>brief.</span>
                </h1>
                <p className="brief-deck">What mattered. Why it matters. Then back to your day.</p>
              </header>
            </div>

            {brief.hasBrief && brief.entries.length === 0
              ? (
                  <div className={READING_GRID}>
                    <div className="xl:col-start-2">
                      <EmptyBrief period={period} previousBriefDate={brief.previousBriefDate} />
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
                  <section aria-label="Stories matched to your Interests" className="brief-register">
                    <p className="register-label">Matched to your Interests</p>
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
                    <section aria-labelledby="convergence-heading" className="convergence-register">
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
            {brief.hasBrief && brief.entries.length > 0 && (
              <div className="brief-finish">
                <p className="xl:col-start-2">
                  <span aria-hidden="true">✓</span>
                  {' '}
                  That’s your brief. The rest of the day is yours.
                </p>
              </div>
            )}
          </div>
        </main>
        <MobileDestinationFooter current={period === 'today' ? '/' : '/earlier'} />
      </div>
    </div>
  )
}
