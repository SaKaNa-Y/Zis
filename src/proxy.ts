import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isPublicPath } from '@/lib/auth/routing'
import {
  issueSession,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  sessionCookie,
  shouldRefreshSession,
  verifySessionToken,
} from '@/lib/auth/session'

function isPageNavigation(request: NextRequest): boolean {
  return (request.method === 'GET' || request.method === 'HEAD')
    && request.headers.get('accept')?.includes('text/html') === true
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (isPublicPath(request.nextUrl.pathname))
    return NextResponse.next()

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const session = await verifySessionToken(token)

  if (session !== null) {
    const response = NextResponse.next()

    if (shouldRefreshSession(session)) {
      const now = new Date()
      const refreshedToken = await issueSession({
        userId: session.userId,
        sessionVersion: session.sessionVersion,
      }, { now })
      const expiresAt = Math.floor(now.getTime() / 1000) + SESSION_DURATION_SECONDS
      const cookie = sessionCookie(refreshedToken, expiresAt)
      response.cookies.set(cookie.name, cookie.value, cookie.options)
    }

    return response
  }

  if (!isPageNavigation(request))
    return new NextResponse(null, { status: 401 })

  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
