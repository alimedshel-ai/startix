// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

// ─── بوّابة الحفظ (إلزاميّة قبل الحزمة الرباعيّة) ────────────────────────────
// إثبات آليّ لمسار حفظ costItems: تعديل مبلغ بندٍ من الواجهة ⇒ الحمولة المُرسَلة
// إلى FIN_QUANT تحمل القيمة الجديدة داخل costItems (المكافئ الآليّ لِـ:
// «عدّل مبلغًا من المتصفّح ثم GET يُظهر القيمة الجديدة بعد إعادة التحميل»).
// الخادم يخزّن data كـ JSON عامًّا (strategic.ts) فالحمولة الصحيحة ⇒ دوران صحيح.

const { getMock, upsertMock } = vi.hoisted(() => ({ getMock: vi.fn(), upsertMock: vi.fn() }))
vi.mock('@/lib/strategicApi', () => ({ getArtifact: getMock, upsertArtifact: upsertMock }))

import { FinanceQuantitativeSection } from './FinanceQuantitativeSection'

const LOADED_ITEM = { id: 'ci_seed', name: 'إيجار المكتب', type: 1, amount: 1000, recurrence: 'monthly' }

describe('بوّابة الحفظ — costItems يدور من الواجهة إلى حمولة FIN_QUANT', () => {
  beforeEach(() => {
    getMock.mockImplementation(async (_companyId: string, type: string) =>
      type === 'FIN_QUANT'
        ? { data: { schemaVersion: 2, finq: {}, loans: [], costItems: [LOADED_ITEM] } }
        : { data: {} }, // HR_QUANT
    )
    upsertMock.mockResolvedValue({ data: {} })
  })
  afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers() })

  it('تعديل مبلغ بندٍ ⇒ الحفظ يُستدعى بـ costItems يحمل القيمة الجديدة', async () => {
    vi.useFakeTimers()
    render(<FinanceQuantitativeSection companyId="co-1" />)

    // تفريغ وعود التحميل (getArtifact) فتظهر القيمة المحمّلة في الحقل.
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    const amountInput = screen.getByPlaceholderText('المبلغ') as HTMLInputElement
    expect(amountInput.value).toBe('1000')

    // تجاهُل حفظ صدى التحميل؛ نُثبت على حفظ التعديل وحده.
    upsertMock.mockClear()

    // تعديل المبلغ من الواجهة.
    await act(async () => { fireEvent.change(amountInput, { target: { value: '2500' } }) })
    expect((screen.getByPlaceholderText('المبلغ') as HTMLInputElement).value).toBe('2500')

    // تجاوُز مهلة الحفظ المؤجّل (1000ms) فيُطلَق upsert.
    await act(async () => { await vi.advanceTimersByTimeAsync(1100) })

    const finCall = upsertMock.mock.calls.find((c) => c[1] === 'FIN_QUANT')
    expect(finCall).toBeTruthy()
    const payload = finCall![2] as { costItems?: Array<{ amount: number }> }
    expect(payload.costItems).toEqual([expect.objectContaining({ id: 'ci_seed', amount: 2500 })])
  })
})

// ─── إثبات تصيير §٧-أ (المكافئ الآليّ للّقطة الحيّة) ──────────────────────────
// بطاقة ⚖️ نقطة التعادل تعرض هامش المساهمة + وحدات التعادل + المبيعات بأرقام حقيقيّة
// مقروءةً من الإجماليّات الفعّالة (٥٠٠٠٠ ثابتة · ٢٠٠ متغيّرة · ٦٠٠ سعر ⇒ ٤٠٠/١٢٥/٧٥٠٠٠).
describe('نقطة التعادل — بطاقة ⚖️ تعرض أرقامًا حقيقيّة من effectiveFinq', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers() })

  it('٥٠٠٠٠/٢٠٠/٦٠٠ ⇒ هامش ٤٠٠ · وحدات ١٢٥ · مبيعات ٧٥٠٠٠', async () => {
    getMock.mockImplementation(async (_companyId: string, type: string) =>
      type === 'FIN_QUANT'
        ? { data: { schemaVersion: 2, finq: { FINQ_FIXED_COSTS: 50_000, FINQ_VAR_COST_UNIT: 200, FINQ_PRICE_UNIT: 600 }, loans: [], costItems: [] } }
        : { data: {} },
    )
    upsertMock.mockResolvedValue({ data: {} })

    vi.useFakeTimers()
    render(<FinanceQuantitativeSection companyId="co-be" />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    // التنسيق مُوحَّد على sar (ar-SA + «ريال») بعد كومِت توحيد العملة 5994529؛ نحسب
    // المتوقَّع بنفس toLocaleString('ar-SA') تفاديًا لهشاشة ICU. الوحدات تبقى en-US.
    const sar = (n: number) => `${n.toLocaleString('ar-SA')} ريال`
    expect(screen.getByText('هامش المساهمة/وحدة')).toBeTruthy()
    expect(screen.getByText(sar(400))).toBeTruthy()   // هامش المساهمة = 600 − 200
    expect(screen.getByText('125')).toBeTruthy()      // وحدات التعادل = ⌈50000 ÷ 400⌉
    expect(screen.getByText(sar(75_000))).toBeTruthy() // مبيعات التعادل = 125 × 600
  })
})
