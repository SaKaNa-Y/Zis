import { expect, it } from 'vitest'
import { createAppearanceSettings } from './appearance'

it('defaults to system and persists the explicit preference across reads', async () => {
  let cookie: string | undefined
  const appearance = createAppearanceSettings({
    verifySession: async () => {},
    readPreference: async () => cookie,
    writePreference: async (value) => { cookie = value },
  })
  expect(await appearance.read()).toBe('system')
  await appearance.save('dark')
  expect(await appearance.read()).toBe('dark')
  await appearance.save('light')
  expect(await appearance.read()).toBe('light')
  await appearance.save('system')
  expect(await appearance.read()).toBe('system')
})

it('requires authentication to change a preference but can read it on login', async () => {
  let cookie = 'dark'
  const appearance = createAppearanceSettings({
    verifySession: async () => { throw new Error('unauthorized') },
    readPreference: async () => cookie,
    writePreference: async (value) => { cookie = value },
  })
  expect(await appearance.read()).toBe('dark')
  await expect(appearance.save('light')).rejects.toThrow('unauthorized')
  expect(await appearance.read()).toBe('dark')
})

it('ignores an invalid cookie and reports invalid selections or failed persistence', async () => {
  const appearance = createAppearanceSettings({
    verifySession: async () => {},
    readPreference: async () => 'invalid',
    writePreference: async () => { throw new Error('storage failed') },
  })
  expect(await appearance.read()).toBe('system')
  await expect(appearance.save('invalid')).rejects.toThrow('Choose')
  await expect(appearance.save('light')).rejects.toThrow('storage failed')
  expect(await appearance.read()).toBe('system')
})
