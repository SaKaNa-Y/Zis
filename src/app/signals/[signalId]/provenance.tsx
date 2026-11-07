'use client'

import type {
  SignalProvenance as SignalProvenanceModel,
  SignalProvenancePublisher,
} from '@/lib/signals/provenance'
import type { TranslationAction } from '@/lib/translations/model'
import Link from 'next/link'
import { Text, useLocale } from '@/lib/i18n/context'
import { useReadingTranslation } from '@/lib/translations/reading'
import { DestinationNavigation, MobileDestinationFooter } from '../../destinations'

export interface SignalProvenanceViewProps {
  translationAction?: TranslationAction
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
              <Text en="Origin · excluded from Strength" zh="原始发布者，不计入关注强度" />
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
          <Text en="No Citation recorded." zh="尚未记录引用。" />
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

export function SignalProvenanceView({ provenance: original, translationAction }: SignalProvenanceViewProps) {
  const { t } = useLocale()
  const translation = useReadingTranslation(original.entryId, original, translationAction)
  const provenance = { ...original, ...translation.text }
  const publishers = [...provenance.publishers].sort((left, right) =>
    Number(left.isOrigin) - Number(right.isOrigin))
  const strengthLabel = `${t('Strength', '关注强度')} ${provenance.strength}`
  const publisherCountLabel = t(`${provenance.strength} distinct ${provenance.strength === 1 ? 'Publisher' : 'Publishers'}, with the origin excluded.`, `${provenance.strength} 个独立发布者，不含原始发布者。`)

  return (
    <div className="brief-v2 app-shell">
      <a
        className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-10 focus:not-sr-only focus:bg-paper focus:px-3 focus:py-2 focus:text-meta focus:text-ink"
        href="#signal-provenance"
      >
        <Text en="Skip to provenance" zh="跳至来源信息" />
      </a>
      <DestinationNavigation />
      <div className="min-w-0">
        <main className="page-content provenance-content" id="signal-provenance">
          <nav aria-label={t('Breadcrumb', '页面路径')} className="text-meta text-ink-faint">
            <Link className="underline decoration-rule underline-offset-4 hover:text-ink" href="/">
              <Text en="← Information" zh="← 信息流" />
            </Link>
          </nav>

          <header lang={translation.lang} className="mt-register max-w-measure-lg">
            <p className="font-mono text-date font-semibold uppercase tracking-[0.16em] text-ink-faint">
              <Text en="Signal provenance" zh="内容来源" />
            </p>
            <h1 className="reading-title page-title provenance-title mt-3">
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
                  <p className="reading-body mt-3 break-words text-body text-ink-dim lg:text-body-lg">
                    {provenance.summary}
                  </p>
                )}
          </header>

          <section aria-label={t('Historical explanation', '历史入选理由')} className="explanation-panel mt-register max-w-measure-lg">
            <h2 className="text-meta font-semibold text-ink-dim">
              {t('Why this appeared in the Brief of', '入选简报日期：')}
              {' '}
              <Link href={`/earlier/${provenance.briefDate}`} className="underline underline-offset-4">
                <time dateTime={provenance.briefDate}>{provenance.briefDate}</time>
              </Link>
            </h2>
            <p lang={translation.lang} className="reading-why mt-2 break-words text-body text-ink-dim">{provenance.whyText}</p>
            {translation.controls}
            <p className="mt-2 text-meta text-ink-faint"><Text en="This explanation is frozen. The Citation record below reflects the current Signal." zh="原始入选理由已封存。下方引用记录反映内容当前的来源情况。" /></p>
          </section>

          <dl className="mt-register grid max-w-measure gap-y-5 text-body sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-6">
            <dt className="font-mono text-meta uppercase tracking-[0.12em] text-ink-faint"><Text en="Admission" zh="入选方式" /></dt>
            <dd className="m-0 text-ink">{t(admissionLabel(provenance.admittedBy), provenance.admittedBy === 'interest' ? '匹配关注兴趣' : '多个发布者共同关注')}</dd>
            <dt className="font-mono text-meta uppercase tracking-[0.12em] text-ink-faint"><Text en="Strength" zh="关注强度" /></dt>
            <dd className="m-0 text-ink">
              <span className="font-semibold">{strengthLabel}</span>
              {' — '}
              {publisherCountLabel}
            </dd>
          </dl>

          <section aria-labelledby="citation-record-heading" className="mt-register">
            <div className="max-w-measure-lg">
              <h2 className="font-display text-title font-semibold tracking-[-0.018em] text-ink" id="citation-record-heading">
                <Text en="Citation record" zh="引用记录" />
              </h2>
              <p className="mt-2 text-meta text-ink-faint">
                <Text en="Each Publisher is counted once. Every Citation remains visible below." zh="每个发布者只计算一次，所有引用记录均列于下方。" />
              </p>
            </div>
            <div tabIndex={0} role="region" aria-label={t('Citation record, scroll horizontally for more', '引用记录，可横向滚动查看更多')} className="citation-table mt-6 overflow-x-auto">
              <table aria-labelledby="citation-record-heading" className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-rule font-mono text-meta uppercase tracking-[0.1em] text-ink-faint">
                    <th className="pb-3 pr-5 font-normal" scope="col"><Text en="Publisher" zh="发布者" /></th>
                    <th className="pb-3 pr-5 font-normal" scope="col"><Text en="Citing Item" zh="引用内容" /></th>
                    <th className="pb-3 font-normal" scope="col"><Text en="First seen" zh="首次发现" /></th>
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
