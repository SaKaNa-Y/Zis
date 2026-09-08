export type Appearance = 'light' | 'dark' | 'system'

export const APPEARANCE_COOKIE_NAME = '__Host-zis_appearance'

export function isAppearance(value: unknown): value is Appearance {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function createAppearanceSettings(dependencies: {
  verifySession: () => Promise<unknown>
  readPreference: () => Promise<string | undefined>
  writePreference: (appearance: Appearance) => Promise<void>
}) {
  return {
    async read(): Promise<Appearance> {
      const value = await dependencies.readPreference()
      return isAppearance(value) ? value : 'system'
    },
    async save(value: unknown) {
      await dependencies.verifySession()
      if (!isAppearance(value))
        throw new Error('Choose light, dark, or match system.')
      await dependencies.writePreference(value)
    },
  }
}
