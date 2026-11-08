import process from 'node:process'
import { afterEach, describe, expect, it } from 'vitest'
import { databaseUrl, sessionSecret } from './env'

const original = { ...process.env }

afterEach(() => {
  process.env = { ...original }
})

describe('reading the environment', () => {
  it('returns the value when it is set', () => {
    process.env.DATABASE_URL = 'postgresql://example'
    expect(databaseUrl()).toBe('postgresql://example')
  })

  it('fails closed when a variable is absent', () => {
    delete process.env.DATABASE_URL
    expect(() => databaseUrl()).toThrow('DATABASE_URL')
  })

  it('treats an empty value as absent — a blank preview URL must not connect', () => {
    process.env.DATABASE_URL = ''
    expect(() => databaseUrl()).toThrow('DATABASE_URL')
  })

  it('asks only for the variable in hand, so a surface without the session key still runs', () => {
    process.env.DATABASE_URL = 'postgresql://example'
    delete process.env.SESSION_SECRET
    expect(databaseUrl()).toBe('postgresql://example')
    expect(() => sessionSecret()).toThrow('SESSION_SECRET')
  })
})
