// @vitest-environment jsdom
import { useEffect, useMemo, useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { FINANCE_CONFIG } from '@/lib/financeMaturity'
import { financeAutoAnswers, layerFinanceConfig } from '@/lib/finMaturityLayering'
import { computeOverall, type MaturityAnswers } from '@/lib/maturityEngine'

// ─── سباق «الحفظ قبل اكتمال finq» — إثبات التصحيح الذاتيّ للدرجة المحفوظة ──────
// منصّة دنيا تعيد إنتاج وصل الحفظ الفعليّ في MaturityInApp (effectiveConfig مذكّر على
// [answeredIds] + ضمن اعتماديّات الحفظ). تستعمل الدوالّ الحقيقيّة (layerFinanceConfig ·
// financeAutoAnswers · computeOverall). تُثبت: (١) إجابةٌ قبل finq ⇒ حفظٌ بتهيئةٍ تضمّ
// الآليّ المشروط · (٢) تحميل finq وحده (بلا إجابة جديدة) ⇒ حفظٌ تصحيحيّ بتهيئةٍ تُسقطها.

const READY_FINQ = { FINQ_FIXED_COSTS: 50_000, FINQ_VAR_COST_UNIT: 200, FINQ_PRICE_UNIT: 600, FND_CASH: 100_000 }
const allIds = (c: { sections: { questions: { id: string }[] }[] }) =>
  c.sections.flatMap((s) => s.questions.map((q) => q.id))

// نسخةٌ مطابقة لوصل MaturityInApp (الطبقة الثابتة 'large' هنا للتركيز على سباق finq).
function SaveHarness({ onSave }: { onSave: (ids: string[]) => void }) {
  const [finq, setFinq] = useState<Record<string, number>>({})
  const [answers, setAnswers] = useState<MaturityAnswers>({})
  const skipFirst = useRef(true)

  const answeredIds = useMemo(() => new Set(financeAutoAnswers(finq, []).map((a) => a.id)), [finq])
  const effectiveConfig = useMemo(
    () => layerFinanceConfig(FINANCE_CONFIG, { tier: 'large', answeredIds }),
    [answeredIds],
  )

  useEffect(() => {
    if (skipFirst.current) { skipFirst.current = false; return }
    const t = setTimeout(() => {
      // نفس حساب MaturityInApp: الدرجة تُحسب من التهيئة الفعّالة الحاليّة.
      void computeOverall(effectiveConfig, answers).maturityPct
      onSave(allIds(effectiveConfig))
    }, 1000)
    return () => clearTimeout(t)
  }, [answers, effectiveConfig, onSave])

  return (
    <div>
      <button onClick={() => setAnswers({ fin_plan_7: 0 })}>answer</button>
      <button onClick={() => setFinq(READY_FINQ)}>loadFinq</button>
    </div>
  )
}

describe('سباق الحفظ/finq — التصحيح الذاتيّ للدرجة المحفوظة', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers() })

  it('إجابة قبل finq ⇒ حفظ يضمّ الآليّ المشروط؛ تحميل finq وحده ⇒ حفظ تصحيحيّ يُسقطه', async () => {
    vi.useFakeTimers()
    const onSave = vi.fn<(ids: string[]) => void>()
    render(<SaveHarness onSave={onSave} />)

    // (١) المستخدم يجيب قبل أن يجهز finq ⇒ حفظٌ «بائت» بتهيئةٍ تضمّ التعادل/النقدية.
    await act(async () => { fireEvent.click(screen.getByText('answer')) })
    await act(async () => { await vi.advanceTimersByTimeAsync(1100) })
    expect(onSave).toHaveBeenCalledTimes(1)
    const stale = onSave.mock.calls[0][0]
    for (const c of ['fin_plan_7', 'fin_rep_4', 'fin_cash_1']) expect(stale).toContain(c)

    // (٢) يجهز finq (بلا إجابةٍ جديدة) ⇒ حفظٌ تصحيحيّ ثانٍ بتهيئةٍ تُسقط الآليّ المشروط.
    await act(async () => { fireEvent.click(screen.getByText('loadFinq')) })
    await act(async () => { await vi.advanceTimersByTimeAsync(1100) })
    expect(onSave).toHaveBeenCalledTimes(2) // تحميل finq وحده أطلق التصحيح
    const corrected = onSave.mock.calls[1][0]
    for (const c of ['fin_plan_7', 'fin_rep_4', 'fin_cash_1']) expect(corrected).not.toContain(c)
    // العدد يتقلّص من ٨٥ (مع المشروط) إلى ٨٢ (بعد جاهزيّة الأدوات).
    expect(stale).toHaveLength(85)
    expect(corrected).toHaveLength(82)
  })
})
