import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  getRedirectUrl,
  unstable_doesMiddlewareMatch,
} from 'next/experimental/testing/server'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isPublicPath } from '../src/lib/auth/routing'
import {
  issueSession,
  SESSION_COOKIE_NAME,
  SESSION_REFRESH_AFTER_SECONDS,
  verifySessionToken,
} from '../src/lib/auth/session'
import { config, proxy } from '../src/proxy'

vi.mock('server-only', () => ({}))

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SESSION_SECRET = '0123456789abcdef0123456789abcdef'
const USER_ID = '00000000-0000-4000-8000-000000000075'
const NOW = new Date('2026-08-29T08:00:00.000Z')
const originalEnvironment = { ...process.env }

type NextRequestInit = NonNullable<ConstructorParameters<typeof NextRequest>[1]>

function request(pathname: string, init: NextRequestInit = {}): NextRequest {
  return new NextRequest(`https://zis.example${pathname}`, init)
}

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory())
      return routeFiles(path)
    return entry.name === 'page.tsx' || entry.name === 'route.ts' ? [path] : []
  })
}

function routePath(file: string): string {
  const directory = relative(join(ROOT, 'src', 'app'), dirname(file))
  const segments = directory === ''
    ? []
    : directory
        .split(sep)
        .filter(segment => !segment.startsWith('(') && !segment.startsWith('@'))
        .map(segment => segment.startsWith('[') ? 'fixture' : segment)
  return `/${segments.join('/')}`
}

beforeEach(() => {
  process.env.SESSION_SECRET = SESSION_SECRET
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  process.env = { ...originalEnvironment }
  vi.useRealTimers()
})

describe('deny-by-default routing', () => {
  it('redirects unauthenticated page navigation to the sole public route', async () => {
    for (const pathname of ['/', '/future', '/login-admin']) {
      const response = await proxy(request(pathname, { headers: { accept: 'text/html' } }))

      expect(response.status, pathname).toBe(307)
      expect(getRedirectUrl(response), pathname).toBe('https://zis.example/login')
    }
  })

  it('refuses unauthenticated API traffic and Server Action POSTs without redirecting', async () => {
    const apiResponse = await proxy(request('/api/future', {
      headers: { accept: 'application/json' },
    }))
    const actionResponse = await proxy(request('/', {
      headers: {
        'accept': 'text/x-component',
        'next-action': 'future-action-id',
      },
      method: 'POST',
    }))

    expect(apiResponse.status).toBe(401)
    expect(getRedirectUrl(apiResponse)).toBeNull()
    expect(actionResponse.status).toBe(401)
    expect(getRedirectUrl(actionResponse)).toBeNull()
  })

  it('allows both the login page and its Server Action POST', async () => {
    const pageResponse = await proxy(request('/login', { headers: { accept: 'text/html' } }))
    const actionResponse = await proxy(request('/login', {
      headers: { 'next-action': 'login-action-id' },
      method: 'POST',
    }))

    expect(pageResponse.headers.get('x-middleware-next')).toBe('1')
    expect(actionResponse.headers.get('x-middleware-next')).toBe('1')
  })

  it('optimistically allows a signed live session on every request method', async () => {
    const token = await issueSession(
      { userId: USER_ID, sessionVersion: 2 },
      { secret: SESSION_SECRET, now: NOW },
    )
    const response = await proxy(request('/', {
      headers: {
        'cookie': `${SESSION_COOKIE_NAME}=${token}`,
        'next-action': 'protected-action-id',
      },
      method: 'POST',
    }))

    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('refreshes a valid session only after the rolling threshold', async () => {
    const issuedAt = new Date(NOW.getTime() - SESSION_REFRESH_AFTER_SECONDS * 1000)
    const oldToken = await issueSession(
      { userId: USER_ID, sessionVersion: 2 },
      { secret: SESSION_SECRET, now: issuedAt },
    )
    const response = await proxy(request('/', {
      headers: {
        accept: 'text/html',
        cookie: `${SESSION_COOKIE_NAME}=${oldToken}`,
      },
    }))
    const refreshed = response.cookies.get(SESSION_COOKIE_NAME)?.value

    expect(refreshed).toBeDefined()
    expect(refreshed).not.toBe(oldToken)
    await expect(verifySessionToken(refreshed, { secret: SESSION_SECRET, now: NOW }))
      .resolves
      .toMatchObject({ userId: USER_ID, sessionVersion: 2 })
  })

  it('matches every product path and excludes only framework assets', () => {
    for (const pathname of ['/', '/login', '/future', '/api/future', '/report.json']) {
      expect(unstable_doesMiddlewareMatch({
        config,
        url: `https://zis.example${pathname}`,
      }), pathname).toBe(true)
    }

    for (const pathname of ['/_next/static/chunk.js', '/_next/image']) {
      expect(unstable_doesMiddlewareMatch({
        config,
        url: `https://zis.example${pathname}`,
      }), pathname).toBe(false)
    }
  })

  it('walks every current app route and keeps login as the only public route', () => {
    const routes = routeFiles(join(ROOT, 'src', 'app')).map(routePath)

    expect(routes.filter(isPublicPath)).toEqual(['/login'])
    for (const route of routes) {
      expect(unstable_doesMiddlewareMatch({
        config,
        url: `https://zis.example${route}`,
      }), route).toBe(true)
    }
  })

  it('keeps the Signal provenance page inside the authenticated route surface', async () => {
    const routes = routeFiles(join(ROOT, 'src', 'app')).map(routePath)

    expect(routes).toContain('/signals/fixture')
    const response = await proxy(request('/signals/fixture', { headers: { accept: 'text/html' } }))
    expect(response.status).toBe(307)
    expect(getRedirectUrl(response)).toBe('https://zis.example/login')
  })

  it('uses the Next.js 16 Proxy convention without a runtime override', () => {
    expect(config).not.toHaveProperty('runtime')
    expect(existsSync(join(ROOT, 'src', 'proxy.ts'))).toBe(true)
    expect(existsSync(join(ROOT, 'proxy.ts'))).toBe(false)
    expect(existsSync(join(ROOT, 'middleware.ts'))).toBe(false)
    expect(existsSync(join(ROOT, 'middleware.js'))).toBe(false)
  })

  it('has no signup, reset, or recovery route at all', () => {
    for (const route of ['signup', 'reset', 'recovery'])
      expect(existsSync(join(ROOT, 'src', 'app', route)), route).toBe(false)
  })

  it('keeps login to one server form without custom validation state', () => {
    const page = readFileSync(join(ROOT, 'src', 'app', 'login', 'page.tsx'), 'utf8')

    expect(page.match(/<form\b/g)).toHaveLength(1)
    expect(page.match(/<input\b/g)).toHaveLength(1)
    expect(page).not.toContain('searchParams')
    expect(page).not.toContain('aria-invalid')
    expect(page).not.toContain('role="alert"')
  })
})
