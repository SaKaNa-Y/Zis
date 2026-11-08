'use client'

import type { Appearance } from '@/lib/settings/appearance'
import type { InterfaceLanguage, ReadingStyle } from '@/lib/settings/preferences'
import { useState, useTransition } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { DEFAULT_READING } from '@/lib/settings/preferences'
import { saveAppearance, saveLanguage, saveReadingStyle } from './actions'

function Choice<T extends string>({ label, value, choices, disabled, onChange }: { label: string, value: T, choices: readonly { value: T, label: string }[], disabled: boolean, onChange: (value: T) => void }) {
  return (
    <fieldset disabled={disabled} className="settings-choices">
      <legend className="sr-only">{label}</legend>
      {choices.map(choice => (
        <label key={choice.value} className="settings-choice">
          <input type="radio" name={label} checked={value === choice.value} onChange={() => onChange(choice.value)} value={choice.value} />
          <span>{choice.label}</span>
        </label>
      ))}
    </fieldset>
  )
}
function SettingRow({ label, description, children }: { label: string, description?: string, children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <div>
        <p className="text-body font-medium">{label}</p>
        {description && <p className="mt-2 max-w-[24rem] text-meta text-ink-dim">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
export function SettingsPreferences({ initialAppearance, initialReading, initialInterface }: {
  initialAppearance: Appearance
  initialReading: ReadingStyle
  initialInterface: InterfaceLanguage
}) {
  const { t } = useLocale()
  const [appearance, setAppearance] = useState(initialAppearance)
  const [reading, setReading] = useState(initialReading)
  const [interfaceLanguage, setInterfaceLanguage] = useState(initialInterface)
  const [feedback, setFeedback] = useState('')
  const [pending, startTransition] = useTransition()
  function persist(operation: () => Promise<{ error?: string }>, rollback: () => void) {
    setFeedback('')
    startTransition(async () => {
      try {
        const result = await operation()
        if (result.error) {
          rollback()
          setFeedback(result.error)
        }
        else { setFeedback('saved') }
      }
      catch {
        rollback()
        setFeedback(t('Could not save. Check your connection and try again.', '保存失败，请检查网络后重试。'))
      }
    })
  }
  function chooseAppearance(value: Appearance) {
    const previous = appearance
    setAppearance(value)
    document.documentElement.className = value
    persist(() => saveAppearance(value), () => {
      setAppearance(previous)
      document.documentElement.className = previous
    })
  }
  function applyReading(value: ReadingStyle) {
    setReading(value)
    document.documentElement.dataset.readingSize = value.size
    document.documentElement.dataset.readingFont = value.font
  }
  function chooseReading(value: ReadingStyle) {
    const previous = reading
    applyReading(value)
    persist(() => saveReadingStyle(value), () => applyReading(previous))
  }
  const languages = [{ value: 'zh' as const, label: '简体中文' }, { value: 'en' as const, label: 'English' }]
  return (
    <>
      <section aria-labelledby="appearance-heading" className="settings-section">
        <h2 id="appearance-heading" className="settings-heading">{t('Appearance', '外观')}</h2>
        <SettingRow label={t('Theme', '主题')} description={t('For this browser. System follows your device’s appearance.', '仅保存在当前浏览器。跟随系统会自动适应设备的外观。')}>
          <Choice
            label={t('Theme', '主题')}
            value={appearance}
            disabled={pending}
            onChange={chooseAppearance}
            choices={[
              { value: 'light', label: t('Light', '浅色') },
              { value: 'dark', label: t('Dark', '深色') },
              { value: 'system', label: t('System', '跟随系统') },
            ]}
          />
        </SettingRow>
      </section>
      <section aria-labelledby="language-heading" className="settings-section">
        <h2 id="language-heading" className="settings-heading">{t('Language', '语言')}</h2>
        <SettingRow label={t('Interface language', '界面语言')} description={t('Navigation, buttons, and messages. Saved across devices.', '导航、按钮与提示文字。在所有设备上同步。')}>
          <label>
            <span className="sr-only">{t('Interface language', '界面语言')}</span>
            <select
              className="settings-select"
              disabled={pending}
              value={interfaceLanguage}
              onChange={(event) => {
                const value = event.target.value as InterfaceLanguage
                const previous = interfaceLanguage
                setInterfaceLanguage(value)
                persist(() => saveLanguage(value), () => setInterfaceLanguage(previous))
              }}
            >
              <option value="system">{t('Follow browser', '跟随浏览器')}</option>
              {languages.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </SettingRow>
      </section>
      <section aria-labelledby="reading-heading" className="settings-section">
        <h2 id="reading-heading" className="settings-heading">{t('Reading style', '阅读样式')}</h2>
        <p className="mt-2 text-meta text-ink-dim">{t('For reading content in this browser. Navigation and controls keep their usual size.', '仅调整当前浏览器的阅读内容，导航和操作控件保持原样。')}</p>
        <SettingRow label={t('Text size', '字号')}>
          <Choice
            label={t('Text size', '字号')}
            value={reading.size}
            disabled={pending}
            onChange={size => chooseReading({ ...reading, size })}
            choices={[
              { value: 'small', label: t('Small', '小') },
              { value: 'standard', label: t('Standard', '标准') },
              { value: 'large', label: t('Large', '大') },
              { value: 'extra-large', label: t('Extra large', '特大') },
            ]}
          />
        </SettingRow>
        <SettingRow label={t('Typeface', '字体')}>
          <Choice
            label={t('Typeface', '字体')}
            value={reading.font}
            disabled={pending}
            onChange={font => chooseReading({ ...reading, font })}
            choices={[
              { value: 'default', label: t('Default', '默认') },
              { value: 'sans', label: t('Sans serif', '黑体') },
              { value: 'serif', label: t('Serif', '宋体') },
            ]}
          />
        </SettingRow>
        <div className="reading-preview" aria-label={t('Reading preview', '阅读预览')}>
          <p className="mb-5 text-meta text-ink-faint">{t('Reading preview', '阅读预览')}</p>
          <div lang="zh-CN">
            <h3 className="reading-title">让技术阅读回到值得关注的事</h3>
            <p className="reading-body mt-3">在文章中打开引文，就能对照原文阅读。</p>
          </div>
          <div lang="en" className="mt-7 border-t border-rule pt-6">
            <h3 className="reading-title">A little less noise. A little more perspective.</h3>
            <p className="reading-body mt-3">Open a citation in an article to read the original passage.</p>
          </div>
        </div>
        <button type="button" className="mt-4 text-meta underline underline-offset-4 disabled:opacity-40" disabled={pending || (reading.size === DEFAULT_READING.size && reading.font === DEFAULT_READING.font)} onClick={() => chooseReading(DEFAULT_READING)}>{t('Reset reading style', '恢复默认阅读样式')}</button>
      </section>
      <p role="status" className="min-h-6 text-meta text-ink-dim">{pending ? t('Saving…', '正在保存…') : feedback === 'saved' ? t('Saved.', '已保存。') : feedback}</p>
    </>
  )
}
