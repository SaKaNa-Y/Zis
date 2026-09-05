import register from '../../../docs/source-register.json'
import { canonicalizeLink, publisherHostKey } from './canonicalize'

interface HostOwner { host: string, publisherId: string }

/** Only an explicitly curated Source may use its RSS link as a Citation. */
export function itemLinkIsOutbound(endpointUrl: string, publisherId: string, hosts: HostOwner[]): boolean {
  const publisher = register.publishers.find(publisher =>
    publisher.sources.some(source => 'url' in source && source.url === endpointUrl && 'itemLinkRole' in source && source.itemLinkRole === 'outbound'),
  )
  if (publisher === undefined)
    return false
  if (!publisher.hosts.some(host => hosts.some(row => publisherHostKey(row.host) === host && row.publisherId === publisherId)))
    throw new Error(`host ownership assertion failed: outbound Source ${endpointUrl} has no registered Publisher host`)
  return true
}

/** A curated guest article asserts one address, never ownership of its host. */
export function guestPublicationOwner(url: string, hosts: HostOwner[], endpointUrl?: string): string | undefined {
  const canonical = canonicalizeLink(url)
  const publisher = register.publishers.find(publisher =>
    'publications' in publisher && publisher.publications?.includes(canonical ?? '')
    && (endpointUrl === undefined || publisher.sources.some(source => 'url' in source && source.url === endpointUrl)),
  )
  return publisher === undefined
    ? undefined
    : hosts.find(row => publisher.hosts.includes(publisherHostKey(row.host)))?.publisherId
}
