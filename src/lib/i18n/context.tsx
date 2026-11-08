'use client'

import type { Language } from '@/lib/settings/preferences'
import { createContext, useContext } from 'react'

const LocaleContext = createContext<Language>('en')

export function LocaleProvider({ language, children }: { language: Language, children: React.ReactNode }) {
  return <LocaleContext value={language}>{children}</LocaleContext>
}

export function useLocale() {
  const language = useContext(LocaleContext)
  return { language, t: (en: string, zh: string) => language === 'zh' ? zh : en }
}

export function Text({ en, zh }: { en: string, zh: string }) {
  const { t } = useLocale()
  return t(en, zh)
}
