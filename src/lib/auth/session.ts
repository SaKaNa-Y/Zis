import { jwtVerify, SignJWT } from 'jose'
import { sessionSecret } from '@/lib/env'
import 'server-only'

const ALGORITHM = 'HS256'
const ISSUER = 'zis'
const AUDIENCE = 'zis'
const MINIMUM_SECRET_BYTES = 32
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const SESSION_COOKIE_NAME = '__Host-zis_session'
export const SESSION_DURATION_SECONDS = 90 * 24 * 60 * 60
export const SESSION_REFRESH_AFTER_SECONDS = 7 * 24 * 60 * 60

export interface SessionIdentity {
  userId: string
  sessionVersion: number
}

export interface SessionClaims extends SessionIdentity {
  issuedAt: number
  expiresAt: number
}

export interface SessionCryptoOptions {
  secret?: string
  now?: Date
}

export interface SessionCookie {
  name: typeof SESSION_COOKIE_NAME
  value: string
  options: {
    expires: Date
    httpOnly: true
    path: '/'
    sameSite: 'lax'
    secure: true
  }
}

function encodedSecret(secret: string | undefined): Uint8Array {
  const encoded = new TextEncoder().encode(secret ?? sessionSecret())
  if (encoded.byteLength < MINIMUM_SECRET_BYTES)
    throw new Error('SESSION_SECRET must contain at least 32 bytes of high-entropy key material')
  return encoded
}

function unixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}

export async function issueSession(
  identity: SessionIdentity,
  options: SessionCryptoOptions = {},
): Promise<string> {
  if (!UUID.test(identity.userId))
    throw new Error('Session userId must be a UUID')
  if (!Number.isSafeInteger(identity.sessionVersion) || identity.sessionVersion < 0)
    throw new Error('Session version must be a non-negative safe integer')

  const issuedAt = unixSeconds(options.now ?? new Date())
  return new SignJWT({ sv: identity.sessionVersion })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(identity.userId)
    .setJti(crypto.randomUUID())
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_DURATION_SECONDS)
    .sign(encodedSecret(options.secret))
}

export async function verifySessionToken(
  token: string | undefined,
  options: SessionCryptoOptions = {},
): Promise<SessionClaims | null> {
  if (token === undefined || token === '')
    return null

  try {
    const { payload } = await jwtVerify(token, encodedSecret(options.secret), {
      algorithms: [ALGORITHM],
      audience: AUDIENCE,
      currentDate: options.now ?? new Date(),
      issuer: ISSUER,
      requiredClaims: ['sub', 'iat', 'exp', 'jti', 'sv'],
    })

    if (typeof payload.sub !== 'string' || !UUID.test(payload.sub))
      return null
    if (typeof payload.jti !== 'string' || !UUID.test(payload.jti))
      return null
    if (!Number.isSafeInteger(payload.sv) || (payload.sv as number) < 0)
      return null
    if (!Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp))
      return null

    return {
      userId: payload.sub,
      sessionVersion: payload.sv as number,
      issuedAt: payload.iat as number,
      expiresAt: payload.exp as number,
    }
  }
  catch {
    return null
  }
}

export function sessionCookie(token: string, expiresAt: number): SessionCookie {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    options: {
      expires: new Date(expiresAt * 1000),
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: true,
    },
  }
}

export function shouldRefreshSession(session: SessionClaims, now: Date = new Date()): boolean {
  return unixSeconds(now) - session.issuedAt >= SESSION_REFRESH_AFTER_SECONDS
}
