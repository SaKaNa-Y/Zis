import type { Language } from '@/lib/settings/preferences'

/** Localize only the sealed explanation's framing. Never send Interests to AI. */
export function translateAdmission(original: string, language: Language): string {
  if (language === 'en')
    return original
  const match = /^(\d+) Publishers converged · ([\s\S]*?) · origin: (\S+) · (?:matched: "([\s\S]*)"|(no Interest matched — surfacing on convergence alone))$/.exec(original)
  if (!match)
    return original
  const [, count, names, host, interest, convergence] = match
  const provenance = `${count} 个独立发布者共同关注 · ${names} · 原始来源：${host}`
  return convergence ? `${provenance} · 未匹配关注兴趣，仅因共同关注而入选` : `${provenance} · 匹配关注兴趣：「${interest}」`
}
