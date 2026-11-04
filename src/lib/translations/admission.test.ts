import { expect, it } from 'vitest'
import { translateAdmission } from './admission'

it('localizes framing without modifying the private statement or Publisher names', () => {
  const why = '3 Publishers converged · Alpha, Beta, Gamma · origin: example.com · matched: "Private interest · matched: \\"quoted\\"\n第二行"'
  const translated = translateAdmission(why, 'zh')
  expect(translated).toContain('3 个独立发布者共同关注 · Alpha, Beta, Gamma · 原始来源：example.com')
  expect(translated).toContain('Private interest · matched: \\"quoted\\"\n第二行')
  expect(translateAdmission(why, 'en')).toBe(why)
})
it('supports convergence and preserves unfamiliar historical formats verbatim', () => {
  expect(translateAdmission('2 Publishers converged · A, B · origin: example.com · no Interest matched — surfacing on convergence alone', 'zh')).toContain('仅因共同关注而入选')
  expect(translateAdmission('Historical private explanation', 'zh')).toBe('Historical private explanation')
})
