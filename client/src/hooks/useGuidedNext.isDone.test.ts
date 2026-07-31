import { describe, expect, it } from 'vitest'

import { deepHasContent } from '@/lib/artifactContent'
import { ANALYSIS_TOOLS, firstIncompleteAnalysisKey } from '@/lib/analysisPlan'
import { artifactSatisfies } from '@/lib/journeyStages'

// يعيد هذا الاختبار إنتاج سلسلة §1.5 في useGuidedNext حرفيّاً (isDone +
// firstIncompleteAnalysisKey) بالدوالّ الحقيقيّة — إذ لا renderHook متاح.
// الخلل المُصلَح: artifact محفوظ فارغ ({}) كان يُحسب أداةً منجَزة (وجوديّاً)،
// فيتخطّى المحرّك مراحل التحليل ويعلن «انتهى» بعد التدقيق وحده.

type RawArtifact = { type: string; data: unknown }

// مُطابِق لبناء المجموعتين في useJourneyCompletions.
const typesOf = (arts: RawArtifact[]) => new Set(arts.map((a) => a.type))
const nonEmptyTypesOf = (arts: RawArtifact[]) =>
  new Set(arts.filter((a) => deepHasContent(a.data)).map((a) => a.type))

// isDone كما في §1.5 بالضبط (على أيّ مجموعة تُمرّر لها).
const nextKeyFor = (recommended: string[], set: Set<string>, hasAudit: boolean) => {
  const isDone = (key: string): boolean => {
    const t = ANALYSIS_TOOLS[key]
    if (!t) return true
    if (t.viaAudit) return hasAudit
    return t.artifactBases.some((b) => artifactSatisfies(set, b))
  }
  return firstIncompleteAnalysisKey(recommended, isDone)
}

describe('§1.5 isDone — واعٍ بالمحتوى لا وجوديّ (خلل «انتهى» الكاذب)', () => {
  const recommended = ['audit', 's7'] // مستوى تشغيليّ مختصر
  const emptyInternalEnv: RawArtifact[] = [{ type: 'INTERNAL_ENV_HR', data: {} }]

  it('قبل الإصلاح (وجوديّ): INTERNAL_ENV_HR={} يُحسب s7 منجَزاً → null (خلل «انتهى»)', () => {
    expect(nextKeyFor(recommended, typesOf(emptyInternalEnv), true)).toBeNull()
  })

  it('بعد الإصلاح (محتوى): INTERNAL_ENV_HR={} فارغ → الخطوة التالية s7 لا done', () => {
    expect(nextKeyFor(recommended, nonEmptyTypesOf(emptyInternalEnv), true)).toBe('s7')
  })

  it('7S مملوء فعلاً → لا يُعاد اقتراحه (لا رجوع كاذب)', () => {
    const filled: RawArtifact[] = [{ type: 'INTERNAL_ENV_HR', data: { aspects: { staff: { rating: 3 } } } }]
    expect(nextKeyFor(recommended, nonEmptyTypesOf(filled), true)).toBeNull()
  })

  it('بلا تدقيق → الخطوة audit بغضّ النظر عن الفارغ', () => {
    expect(nextKeyFor(recommended, nonEmptyTypesOf(emptyInternalEnv), false)).toBe('audit')
  })
})
