import { describe, expect, it } from 'vitest'
import { isPublicPath } from './routing'

describe('the public route policy', () => {
  it('allows only the exact login path', () => {
    expect(isPublicPath('/login')).toBe(true)

    for (const pathname of ['/', '/login/', '/login-admin', '/api/login', '/future'])
      expect(isPublicPath(pathname), pathname).toBe(false)
  })
})
