import type { FetchOutcome, IngestionSource, ParsedFeedItem } from './pipeline'
import type { SafeFetch, SafeFetchResponse } from '@/lib/safe-fetch'
import { capEmbeddingText, plainText } from './plain-text'

/** A failed page invalidates the Source fetch; never commit a partial page set. */
export class ApiSourceError extends Error {
  constructor(message: string, readonly outcome: FetchOutcome, readonly response?: SafeFetchResponse) {
    super(message)
  }
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new ApiSourceError('Expected an API object', 'parse_error')
  return value as Record<string, unknown>
}

function list(value: unknown, maximum = Number.MAX_SAFE_INTEGER): unknown[] {
  if (!Array.isArray(value) || value.length > maximum)
    throw new ApiSourceError('Expected an API list', 'parse_error')
  return value
}

function text(value: unknown): string {
  if (typeof value !== 'string')
    throw new ApiSourceError('Expected an API string', 'parse_error')
  return value
}

function bounded(value: unknown): string {
  return capEmbeddingText(plainText(text(value)))
}

function outbound(value: unknown): ParsedFeedItem['outboundUrls'] {
  const body = typeof value === 'string' ? value : ''
  return [...body.matchAll(/https?:\/\/[^\s<>"\])]+/g)].map(match => ({ rawUrl: match[0] }))
}

export async function fetchApiSource(source: IngestionSource, fetch: SafeFetch, githubToken?: string): Promise<{
  response: SafeFetchResponse
  items: ParsedFeedItem[]
}> {
  let totalBytes = 0
  let response: SafeFetchResponse | undefined
  async function json(url: string, options?: Parameters<SafeFetch>[1]): Promise<unknown> {
    response = await fetch(url, options)
    totalBytes += response.byteLength
    if (response.status < 200 || response.status >= 300)
      throw new ApiSourceError(`API HTTP ${response.status}`, 'http_error', response)
    try {
      return JSON.parse(response.text())
    }
    catch {
      throw new ApiSourceError('API returned invalid JSON', 'parse_error', response)
    }
  }

  const items: ParsedFeedItem[] = []
  if (source.transport === 'hn_firebase') {
    if (!/^https:\/\/hacker-news\.firebaseio\.com\/v0\/(?:top|new)stories\.json$/.test(source.endpointUrl))
      throw new ApiSourceError('Unsupported Hacker News list', 'parse_error')
    const ids = list(await json(source.endpointUrl), 500)
    for (const id of new Set(ids)) {
      if (!Number.isSafeInteger(id) || Number(id) <= 0)
        throw new ApiSourceError('Invalid Hacker News item ID', 'parse_error')
      const value = await json(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
      if (value === null)
        continue
      const item = object(value)
      if (item.deleted === true || item.dead === true || item.type !== 'story')
        continue
      if (item.id !== id || typeof item.time !== 'number' || !Number.isFinite(item.time))
        throw new ApiSourceError('Invalid Hacker News story identity/date', 'parse_error')
      items.push({
        guid: String(id),
        link: `https://news.ycombinator.com/item?id=${id}`,
        title: bounded(item.title),
        text: bounded(item.text ?? ''),
        rawFeedDate: new Date(item.time * 1000).toISOString(),
        outboundUrls: [
          ...(typeof item.url === 'string' ? [{ rawUrl: item.url, anchorText: bounded(item.title) }] : []),
          ...outbound(item.text),
        ],
      })
    }
  }
  else if (source.transport === 'bluesky_feed') {
    const url = new URL(source.endpointUrl)
    const actor = url.searchParams.get('actor')
    if (url.origin !== 'https://public.api.bsky.app' || url.pathname !== '/xrpc/app.bsky.feed.getAuthorFeed' || !actor?.startsWith('did:'))
      throw new ApiSourceError('Unsupported Bluesky author endpoint', 'parse_error')
    // A Source is a bounded current feed, like RSS: the newest 100 author posts.
    // Reposts and pinned older posts cannot impersonate this Publisher.
    url.searchParams.set('limit', '100')
    url.searchParams.set('filter', 'posts_no_replies')
    url.searchParams.set('includePins', 'false')
    const page = object(await json(url.href))
    for (const entry of list(page.feed, 100)) {
      const view = object(entry)
      if (view.reason !== undefined)
        continue
      const post = object(view.post)
      if (object(post.author).did !== actor)
        throw new ApiSourceError('Bluesky author differs from Source owner', 'parse_error')
      const record = object(post.record)
      if (record.$type !== 'app.bsky.feed.post' || record.reply !== undefined)
        continue
      const uri = text(post.uri)
      const prefix = `at://${actor}/app.bsky.feed.post/`
      if (!uri.startsWith(prefix) || !/^[\w.-]+$/.test(uri.slice(prefix.length)))
        throw new ApiSourceError('Invalid Bluesky post identity', 'parse_error')
      const urls: ParsedFeedItem['outboundUrls'] = []
      for (const facet of list(record.facets ?? [])) {
        for (const feature of list(object(facet).features)) {
          const field = object(feature)
          if (field.$type === 'app.bsky.richtext.facet#link')
            urls.push({ rawUrl: text(field.uri) })
        }
      }
      const embed = record.embed === undefined ? undefined : object(record.embed)
      const media = embed?.$type === 'app.bsky.embed.recordWithMedia' ? object(embed.media) : embed
      if (media?.$type === 'app.bsky.embed.external') {
        const external = object(media.external)
        urls.push({ rawUrl: text(external.uri), anchorText: bounded(external.title ?? '') })
      }
      items.push({ guid: uri, link: `https://bsky.app/profile/${actor}/post/${uri.slice(prefix.length)}`, title: bounded(record.text), text: bounded(record.text), rawFeedDate: text(record.createdAt), outboundUrls: urls })
    }
  }
  else if (source.transport === 'github_graphql') {
    const repository = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/releases$/.exec(source.endpointUrl)
    if (repository === null)
      throw new ApiSourceError('Unsupported GitHub releases endpoint', 'parse_error')
    if (!githubToken)
      throw new ApiSourceError('Missing GitHub public-read token', 'http_error')
    const result = object(await json('https://api.github.com/graphql', {
      method: 'POST',
      headers: { 'authorization': `Bearer ${githubToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        query: 'query($owner:String!,$name:String!){repository(owner:$owner,name:$name){url releases(first:100,orderBy:{field:CREATED_AT,direction:DESC}){nodes{tagName name url description publishedAt isDraft}}}}',
        variables: { owner: repository[1], name: repository[2] },
      }),
    }))
    if (result.errors !== undefined)
      throw new ApiSourceError('GitHub GraphQL query failed', 'http_error', response)
    const resolvedRepository = object(object(result.data).repository)
    // GitHub resolves transferred repositories (for example facebook/react).
    // Validate against that authoritative identity, not the old configured path.
    const repositoryUrl = text(resolvedRepository.url)
    if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(repositoryUrl))
      throw new ApiSourceError('Invalid resolved GitHub repository URL', 'parse_error')
    const releases = object(resolvedRepository.releases)
    for (const value of list(releases.nodes, 100)) {
      const release = object(value)
      if (release.isDraft === true || release.publishedAt === null)
        continue
      const url = text(release.url)
      if (!url.startsWith(`${repositoryUrl}/releases/tag/`))
        throw new ApiSourceError('Release URL differs from Source repository', 'parse_error')
      items.push({ guid: text(release.tagName), link: url, title: bounded(release.name || release.tagName), text: bounded(release.description ?? ''), summary: bounded(release.description ?? ''), rawFeedDate: text(release.publishedAt), outboundUrls: outbound(release.description) })
    }
  }
  else {
    throw new ApiSourceError(`Unsupported API transport ${source.transport}`, 'parse_error')
  }
  if (response === undefined)
    throw new ApiSourceError('API Source returned no response', 'http_error')
  return { items, response: { ...response, byteLength: totalBytes } }
}
