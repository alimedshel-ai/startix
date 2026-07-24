import { describe, expect, it } from 'vitest'

import { cardStateFor } from './cardState'

// معيار قبول الرقعة A: لنفس العميل، بطاقة «التالي لك الآن» (البيكون) وشارة ⭐
// في الصفحة يشيران لنفس الأداة — لأنّ كليهما يقرأ نفس guidedNext.to. نثبّت هذا
// بالبناء: cardStateFor يُرجِع 'current' فقط للبطاقة التي يطابق مسارُها الوجهةَ.

const CLIENT_Q = '?client=c1'
// مجموعة بطاقات صفحة العميل (المسارات الأساسيّة — المبسّط إحماء خارجها).
const PATHS = {
  audit: '/manager/hr/audit',
  pestel: '/manager/dept-pestel',
  s7: '/internal-environment',
  swot: '/swot',
}
const base = { dataLoaded: true, clientQ: CLIENT_Q }
const stateOf = (path: string, guidedTo: string | null, done = false) =>
  cardStateFor({ ...base, done, guidedTo, path })

describe('cardStateFor — ⭐ من المصدر الواحد (يطابق البيكون بالبناء)', () => {
  it('قبل التحميل → idle (لا وميض ⭐/✓)', () => {
    expect(cardStateFor({ dataLoaded: false, done: false, guidedTo: `${PATHS.audit}${CLIENT_Q}`, path: PATHS.audit, clientQ: CLIENT_Q })).toBe('idle')
  })

  it('المكتملة → done ولو كانت هي وجهة البيكون (done يتقدّم)', () => {
    expect(stateOf(PATHS.audit, `${PATHS.audit}${CLIENT_Q}`, true)).toBe('done')
  })

  // الحالات الخمس: كلّ منها قيمة مختلفة لوجهة البيكون → البطاقة المطابقة فقط ⭐.
  const SCENARIOS: { name: string; guided: string }[] = [
    { name: 'بلا تدقيق → البيكون على التدقيق', guided: `${PATHS.audit}${CLIENT_Q}` },
    { name: 'تدقيق بلا PESTEL → البيكون على PESTEL', guided: `${PATHS.pestel}${CLIENT_Q}` },
    { name: 'قبل SWOT (مصدر داخليّ) → البيكون على 7S', guided: `${PATHS.s7}${CLIENT_Q}` },
    { name: 'مصدران جاهزان → البيكون على SWOT (QUICK)', guided: `${PATHS.swot}${CLIENT_Q}` },
    { name: 'المسار الطويل يصل SWOT كذلك (LONG)', guided: `${PATHS.swot}${CLIENT_Q}` },
  ]

  for (const sc of SCENARIOS) {
    it(`${sc.name}: بطاقة واحدة فقط ⭐ وهي وجهة البيكون`, () => {
      const currents = Object.values(PATHS).filter((p) => stateOf(p, sc.guided) === 'current')
      // بطاقة واحدة بالضبط تحمل ⭐
      expect(currents).toHaveLength(1)
      // وهي نفسها التي يشير إليها البيكون (مساراً + لاحقة العميل)
      expect(`${currents[0]}${CLIENT_Q}`).toBe(sc.guided)
    })
  }

  it('البطاقات غير المطابقة وغير المكتملة → idle (لا قفل محلّيّ)', () => {
    const guided = `${PATHS.audit}${CLIENT_Q}`
    expect(stateOf(PATHS.pestel, guided)).toBe('idle')
    expect(stateOf(PATHS.swot, guided)).toBe('idle')
  })
})
