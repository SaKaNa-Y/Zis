import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { LocaleProvider } from '@/lib/i18n/context'
import { SettingsPreferences } from './preferences'

vi.mock('./actions', () => ({ saveAppearance: vi.fn(), saveLanguage: vi.fn(), saveReadingStyle: vi.fn() }))

it('offers interface language and a bilingual preview without changing navigation type', () => {
  const view = createElement(SettingsPreferences, { initialAppearance: 'system', initialReading: { size: 'large', font: 'serif' }, initialInterface: 'zh' })
  const html = renderToStaticMarkup(createElement(LocaleProvider, { language: 'zh', children: view }))
  expect(html).toContain('界面语言')
  expect(html).not.toContain('内容语言')
  expect(html).toContain('name="字号"')
  expect(html).toContain('value="extra-large"')
  expect(html).toContain('lang="zh-CN"')
  expect(html).toContain('lang="en"')
  expect(html).toContain('恢复默认阅读样式')
  expect(html).not.toContain('Notifications')
})
