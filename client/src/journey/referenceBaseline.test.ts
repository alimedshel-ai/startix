import { describe, expect, it } from 'vitest'

import type { StageId } from '@/lib/journeyStages'

import { getNextStep, type NextStepResult, type NextStepState } from './nextStep'
import { getRescueNext, type RescueResult, type RescueState } from './rescue'

// ─── الأساس المرجعيّ — عمود المحرّك مُنتَجٌ ومُقفَلٌ بالتأكيد (لا مقروءاً) ────
// الخطوة ① في الترتيب المعتمد؛ يوثّقه docs/REFERENCE_BASELINE.md. هذا الاختبار
// **يُنتج** قيم عمود المحرّك (ENG) لكل صفّ باستدعاء الدالّتين النقيّتين، ويقفلها
// بـ toEqual للكائن الكامل — فالأخضر يعني **تطابق البايت** لا مجرّد «قيمة موجودة».
//   • getNextStep  — المشي على المراحل + بوّابة SWOT (الصفوف ١·٢·٣·٤·٦).
//   • getRescueNext — تجاوز الطوارئ الذي يسبق المحرّك في useGuidedNext (الصفّ ٥).
// النطاق صراحةً: التشغيل يُنتج **عمود ENG فقط**. أعمدة الأسطح الثلاثة
// (القمرة/السايدبار/لوحة العميل) تبقى مقروءةً بملف:سطر حتى مرحلة الظلّ.
// بروتوكول ما بعد حذف ق١ يعيد تشغيل هذا الملفّ: أيّ فرقٍ في المحرّك = اختبارٌ
// أحمر يوقف الخطوة **آليّاً** — لا عينٌ تقارن console.log.

const ALL: StageId[] = ['environment', 'synthesis', 'directions', 'indicators', 'initiatives', 'execution']
const comp = (done: Partial<Record<StageId, boolean>> = {}): Record<StageId, boolean> =>
  Object.fromEntries(ALL.map((id) => [id, Boolean(done[id])])) as Record<StageId, boolean>

// حالات الصفوف + المخرَج المُقفَل (الكائن الكامل، منسوخ من مخرَج التشغيل الموقَّع).
const ENGINE_ROWS: Array<{ id: string; label: string; state: NextStepState; expected: NextStepResult }> = [
  {
    id: '1', label: 'OWNER × S0',
    state: { isPro: false, activeCompanyId: 'owner-co', completions: comp(), path: 'LONG', specialty: null, signals: {} },
    expected: {
      kind: 'action', stageId: 'environment', icon: '🌐', label: 'ابدأ التشخيص',
      toolPath: '/internal-environment', reason: 'ابدأ بتشخيص البيئة الداخليّة والخارجيّة لإدارتك.',
    },
  },
  {
    id: '2', label: 'PRO × S0 (طبقة getNextStep — §1.5 غير مُشغَّل هنا)',
    state: { isPro: true, activeCompanyId: 'c1', completions: comp(), path: 'LONG', specialty: 'HR', signals: { usesDiagnostic: true } },
    expected: {
      kind: 'action', stageId: 'environment', icon: '🌐', label: 'ابدأ تقييم النضج',
      toolPath: '/manager/deep-analysis', reason: 'ابدأ بتقييم نضج إدارتك — يكشف أقوى وأضعف جوانبها بالأرقام.',
    },
  },
  {
    id: '3', label: 'PRO × Sₑ — المرساة (synthesis · خارجيّ حاضرٌ فارغ)',
    state: {
      isPro: true, activeCompanyId: 'c1', completions: comp({ environment: true }), path: 'LONG', specialty: 'HR',
      signals: { swotSourcesReady: true, externalSourceReady: false, usesDiagnostic: true },
    },
    expected: {
      kind: 'action', stageId: 'environment', icon: '🌍', label: 'أكمل مسحاً خارجيّاً (PESTEL)',
      toolPath: '/manager/dept-pestel',
      reason: 'تحليلك الحاليّ داخليّ (قوّة/ضعف). SWOT يحتاج فرصاً وتهديدات من مسح خارجيّ — أكمِل PESTEL (أو بورتر) أوّلاً.',
    },
  },
  {
    id: '4', label: 'INTERNAL × S0 (non-pro = OWNER — صفّ البروتوكول)',
    state: { isPro: false, activeCompanyId: 'owner-co', completions: comp(), path: 'LONG', specialty: null, signals: {} },
    expected: {
      kind: 'action', stageId: 'environment', icon: '🌐', label: 'ابدأ التشخيص',
      toolPath: '/internal-environment', reason: 'ابدأ بتشخيص البيئة الداخليّة والخارجيّة لإدارتك.',
    },
  },
  {
    id: '6', label: 'ANY × S✓ (كل المراحل مكتملة)',
    state: {
      isPro: false, activeCompanyId: 'c1',
      completions: comp({ environment: true, synthesis: true, directions: true, indicators: true, initiatives: true, execution: true }),
      path: 'LONG', specialty: null, signals: {},
    },
    expected: {
      kind: 'done', stageId: 'execution', icon: '🏁', label: 'راجِع التنفيذ والمتابعة',
      toolPath: '/execute', reason: 'أكملت كل مراحل مسارك — تابِع التنفيذ وراقِب المؤشّرات دوريّاً.',
    },
  },
]

const EMERGENCY_STATE: RescueState = { criticalHealth: true, done: { risk: false, eisenhower: false, raci: false, gantt: false } }
const EMERGENCY_EXPECTED: RescueResult = {
  kind: 'rescue',
  step: { id: 'risk', icon: '⚠️', label: 'أوقف النزيف', tool: 'خريطة المخاطر', toolPath: '/risk-map', why: 'احصر ما يستنزفك الآن وسجّله قبل أيّ شيء آخر.' },
  doneCount: 0, total: 4,
}

describe('الأساس المرجعيّ — عمود المحرّك مُقفَلٌ بالتأكيد الكامل', () => {
  for (const row of ENGINE_ROWS) {
    it(`صفّ ${row.id} — ${row.label}`, () => {
      const out = getNextStep(row.state)
      console.log(`\n[صفّ ${row.id}] ${row.label}\n${JSON.stringify(out, null, 2)}`)
      expect(out).toEqual(row.expected) // قفل البايت — لا toBeTruthy
    })
  }

  it('صفّ ٥ — ANY × E (getRescueNext يسبق المحرّك)', () => {
    const out = getRescueNext(EMERGENCY_STATE)
    console.log(`\n[صفّ ٥] ANY × E (طوارئ)\n${JSON.stringify(out, null, 2)}`)
    expect(out).toEqual(EMERGENCY_EXPECTED) // قفل البايت
  })

  // تأكيدات ضيّقة صريحة تبقى فوق قفل toEqual — نيّة مُعلَنة لا تكرار عابر.
  it('المرساة: الصفّ ٣ يُنتج توجيهاً لمصدرٍ خارجيّ (لا synthesis مكتمل)', () => {
    const out = getNextStep(ENGINE_ROWS[2].state)
    expect(out.kind).toBe('action')
    expect(out.stageId).toBe('environment')
    expect(out.toolPath).toContain('pestel')
  })

  it('الطوارئ: الصفّ ٥ يُنتج rescue → أوّل خطوة (risk/خريطة المخاطر)', () => {
    const out = getRescueNext(EMERGENCY_STATE)
    expect(out.kind).toBe('rescue')
    expect(out.step?.id).toBe('risk')
    expect(out.step?.toolPath).toBe('/risk-map')
  })

  it('الاكتمال: الصفّ ٦ يُنتج done → /execute', () => {
    const out = getNextStep(ENGINE_ROWS[4].state)
    expect(out.kind).toBe('done')
    expect(out.toolPath).toBe('/execute')
  })
})
