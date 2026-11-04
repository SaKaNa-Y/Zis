'use client'

import type { Language } from '@/lib/settings/preferences'
import { createContext, useContext } from 'react'

const LocaleContext = createContext<{ language: Language, contentLanguage: Language }>({ language: 'en', contentLanguage: 'en' })
export function LocaleProvider({ language, contentLanguage, children }: { language: Language, contentLanguage: Language, children: React.ReactNode }) {
  return <LocaleContext value={{ language, contentLanguage }}>{children}</LocaleContext>
}
export function useLocale() {
  const { language, contentLanguage } = useContext(LocaleContext)
  return { language, contentLanguage, t: (en: string, zh: string) => language === 'zh' ? zh : en }
}
export function Text({ en, zh }: { en: string, zh: string }) {
  const { t } = useLocale()
  return t(en, zh)
}
