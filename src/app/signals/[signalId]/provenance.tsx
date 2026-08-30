import type {
  SignalProvenance as SignalProvenanceModel,
  SignalProvenancePublisher,
} from '@/lib/signals/provenance'
import Link from 'next/link'
import { DesktopDestinationRail, MobileDestinationFooter } from '../../destinations'

export interface SignalProvenanceViewProps {
  provenance: SignalProvenanceModel
}

const timestampFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  hour: '2-digit',
  hour12: false,
  minute: '2-digit',
  month: 'short',
  timeZone: 'UTC',
  timeZoneName: 'short',
  year: 'numeric',
})

function admissionLabel(admittedBy: SignalProvenanceModel['admittedBy']): string {
  return admittedBy === 'interest' ? 'Interest match' : 'Publisher convergence'
}

function timestampLabel(value: string): string {
  return timestampFormatter.format(new Date(value))
}

function PublisherRows({ publisher }: { publisher: SignalProvenancePublisher }) {
  const publisherCell = (
    <th
      className="w-[12rem] py-4 pr-5 text-left align-top text-meta font-semibold text-ink"
      rowSpan={Math.max(1, publisher.citations.length)}
      scope="rowgroup"
    >
      <span className="break-words">{publisher.name}</span>
      {publisher.isOrigin
        ? (
            <span className="mt-1 block font-normal text-ink-faint">
              Origin · excluded from Strength
            </span>
          )
        : null}
    </th>
  )

  if (publisher.citations.length === 0) {
    return (
      <tr className="border-t border-rule">
        {publisherCell}
        <td className="py-4 pr-5 text-body text-ink-dim" colSpan={2}>
          No Citation recorded.
        </td>
      </tr>
    )
  }

  return publisher.citations.map((citation, index) => (
    <tr
      className="border-t border-rule"
      data-citation-id={citation.id}
      data-strength-publisher={index === 0 && !publisher.isOrigin ? true : undefined}
      key={citation.id}
    >
      {index === 0 ? publisherCell : null}
      <td className="min-w-[16rem] py-4 pr-5 align-top text-body text-ink-dim">
        {citation.itemUrl === null
          ? <span className="break-words">{citation.itemTitle}</span>
          : (
              <a
                className="break-words underline decoration-rule underline-offset-4 hover:text-ink"
                href={citation.itemUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {citation.itemTitle}
                {' ↗'}
              </a>
            )}
      </td>
      <td className="whitespace-nowrap py-4 align-top font-mono text-meta tabular-nums text-ink-faint">
        <time dateTime={citation.firstSeenAt}>{timestampLabel(citation.firstSeenAt)}</time>
      </td>
    </tr>
  ))
}

export function SignalProvenanceView({ provenance }: SignalProvenanceViewProps) {
  const publishers = [...provenance.publishers].sort((left, right) =>
    Number(left.isOrigin) - Number(right.isOrigin))
  const strengthLabel = `Strength ${provenance.strength}`
  const publisherCountLabel = `${provenance.strength} distinct ${provenance.strength === 1 ? 'Publisher' : 'Publishers'}, with the origin excluded.`

  return (
    <div className="min-h-screen bg-paper text-ink lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)]">
      <a
        className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-10 focus:not-sr-only focus:bg-paper focus:px-3 focus:py-2 focus:text-meta focus:text-ink"
        href="#signal-provenance"
      >
        Skip to provenance
      </a>
      <DesktopDestinationRail />
      <div className="min-w-0">
        <main className="mx-auto max-w-[64rem] px-5 py-10 sm:px-8 lg:px-12 lg:py-14" id="signal-provenance">
          <nav aria-label="Breadcrumb" className="text-meta text-ink-faint">
            <Link className="underline decoration-rule underline-offset-4 hover:text-ink" href="/">
              ← Today
            </Link>
          </nav>

          <header className="mt-register max-w-measure-lg">
            <p className="font-mono text-date font-semibold uppercase tracking-[0.16em] text-ink-faint">
              Signal provenance
            </p>
            <h1 className="mt-3 font-display text-title font-semibold tracking-[-0.025em] text-ink lg:text-title-lg">
              <a
                className="break-words decoration-accent underline-offset-4 hover:underline"
                href={provenance.originUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {provenance.title}
                {' ↗'}
              </a>
            </h1>
            {provenance.summary === null
              ? null
              : (
                  <p className="mt-3 break-words text-body text-ink-dim lg:text-body-lg">
                    {provenance.summary}
                  </p>
                )}
          </header>

          <dl className="mt-register grid max-w-measure gap-y-5 text-body sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-6">
            <dt className="font-mono text-meta uppercase tracking-[0.12em] text-ink-faint">Admission</dt>
            <dd className="m-0 text-ink">{admissionLabel(provenance.admittedBy)}</dd>
            <dt className="font-mono text-meta uppercase tracking-[0.12em] text-ink-faint">Strength</dt>
            <dd className="m-0 text-ink">
              <span className="font-semibold">{strengthLabel}</span>
              {' — '}
              {publisherCountLabel}
            </dd>
          </dl>

          <section aria-labelledby="citation-record-heading" className="mt-register">
            <div className="max-w-measure-lg">
              <h2 className="font-display text-title font-semibold tracking-[-0.018em] text-ink" id="citation-record-heading">
                Citation record
              </h2>
              <p className="mt-2 text-meta text-ink-faint">
                Each Publisher is counted once. Every Citation remains visible below.
              </p>
            </div>
            <div className="mt-6 overflow-x-auto">
              <table aria-labelledby="citation-record-heading" className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-rule font-mono text-meta uppercase tracking-[0.1em] text-ink-faint">
                    <th className="pb-3 pr-5 font-normal" scope="col">Publisher</th>
                    <th className="pb-3 pr-5 font-normal" scope="col">Citing Item</th>
                    <th className="pb-3 font-normal" scope="col">First seen</th>
                  </tr>
                </thead>
                <tbody>
                  {publishers.map(publisher => (
                    <PublisherRows key={publisher.id} publisher={publisher} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
        <MobileDestinationFooter />
      </div>
    </div>
  )
}
