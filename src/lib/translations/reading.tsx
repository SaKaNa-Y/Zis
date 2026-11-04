'use client'

import type { ReadingText, TranslationAction, TranslationResult } from './model'
import { useEffect, useState } from 'react'
import { useLocale } from '@/lib/i18n/context'

export function useReadingTranslation(entryId: string, original: ReadingText, action?: TranslationAction) {
  const { contentLanguage, language, t } = useLocale()
  const [result, setResult] = useState<{ key: string, result: TranslationResult }>()
  const [showOriginal, setShowOriginal] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const key = JSON.stringify([entryId, contentLanguage, original.title, original.summary, original.whyText])
  useEffect(() => {
    if (!action)
      return
    let active = true
    action(entryId, contentLanguage, attempt > 0).then((value) => {
      if (active)
        setResult({ key, result: value })
    }).catch(() => {
      if (active)
        setResult({ key, result: { state: 'failed' } })
    })
    return () => {
      active = false
    }
  }, [key, entryId, contentLanguage, action, attempt])
  const current = result?.key === key ? result.result : undefined
  const translated = current?.state === 'ready' && !showOriginal
  const text = translated ? current.text : original
  const controls = !action
    ? null
    : (
        <div lang={language === 'zh' ? 'zh-CN' : 'en'} className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-meta text-ink-faint">
          {current?.state === 'ready'
            ? (
                <>
                  <span>{showOriginal ? t('Original', '原文') : t('Translated', '译文')}</span>
                  <button type="button" className="underline underline-offset-4" onClick={() => setShowOriginal(!showOriginal)}>{showOriginal ? t('Show translation', '查看译文') : t('Show original', '查看原文')}</button>
                </>
              )
            : (
                <>
                  <span role="status">{current?.state === 'failed' ? t('Translation unavailable. Showing the original.', '翻译失败，暂时显示原文。') : current?.state === 'processing' ? t('Translating. Showing the original.', '正在翻译，暂时显示原文。') : t('Waiting for the daily translation task. Showing the original.', '等待每日后台任务翻译，暂时显示原文。')}</span>
                  <button type="button" className="underline underline-offset-4" onClick={() => setAttempt(value => value + 1)}>{current?.state === 'failed' ? t('Retry', '重试') : t('Check again', '检查进度')}</button>
                </>
              )}
        </div>
      )
  return { text, controls, lang: translated ? (contentLanguage === 'zh' ? 'zh-CN' : 'en') : /\p{Script=Han}/u.test(`${original.title}${original.summary ?? ''}${original.whyText}`) ? 'zh-CN' : 'en' }
}
