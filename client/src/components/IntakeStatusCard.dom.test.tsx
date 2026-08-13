// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'

// ─── إثبات سلوكيّ ③ (المكافئ الآليّ للّقطة) — بطاقة الاستلام تعرض حالة العميل ومساره ──
const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))
vi.mock('@/lib/strategicApi', () => ({ getArtifact: getMock }))

import { IntakeStatusCard } from './IntakeStatusCard'

const renderR = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('IntakeStatusCard ③ — بطاقة الاستلام تُصيَّر لعميل بحالة ومسار', () => {
  it('عميل تأسيسيّ بلا تقييم حوكمة: حالة + مخرج + مسار (يبدأ بمنتج مبنيّ) + ملاحظة تنظيميّة', async () => {
    getMock.mockResolvedValue({ data: { answers: {} } }) // GOV_QUANT فارغ ⇒ غير مقيَّم
    renderR(<IntakeStatusCard companyId="co-1" level="foundation" />)
    await act(async () => { await Promise.resolve() }) // تفريغ تحميل GOV_QUANT

    // الحالة + المدّة + المخرج المتوقَّع.
    expect(screen.getByText(/أنت في حالة «تأسيسيّ»/)).toBeTruthy()
    expect(screen.getByText(/تثبيت الأساسيّات/)).toBeTruthy()
    // نقطة البدء = منتج مبنيّ فعلًا، موسومٌ «ابدأ هنا» و«✅ متاح».
    expect(screen.getByText('مركز التكاليف')).toBeTruthy()
    expect(screen.getByText(/ابدأ هنا/)).toBeTruthy()
    expect(screen.getAllByText('✅ متاح').length).toBeGreaterThan(0)
    // منتج قادم موسومٌ 🔜 (صدق: تقرير المالك غير مبنيّ).
    expect(screen.getByText('تقرير المالك الشهريّ')).toBeTruthy()
    expect(screen.getAllByText('🔜 قادم').length).toBeGreaterThan(0)
    // المحور التنظيميّ: بلا إجابات ⇒ «غير مقيَّمة».
    expect(screen.getByText(/الحوكمة غير مقيَّمة بعد/)).toBeTruthy()
  })

  it('عميل طوارئ: يبدأ بخطة الإنقاذ — وزرّ «ابدأ هنا» ينقل لورشة المالية مع ?client', async () => {
    getMock.mockResolvedValue({ data: { answers: {} } })
    renderR(<IntakeStatusCard companyId="co-2" level="emergency" />)
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText(/حالة «طوارئ/)).toBeTruthy()
    expect(screen.getByText(/خطة الإنقاذ/)).toBeTruthy()
    // البند الأوّل صار زرًّا قابلًا للنقر بوجهة صحيحة (لا نصّ ميّت).
    const cta = screen.getByRole('link', { name: /ابدأ هنا/ }) as HTMLAnchorElement
    expect(cta.getAttribute('href')).toBe('/manager/deep-analysis?client=co-2')
  })

  it('المنتج القادم (🔜) يبقى نصًّا لا رابطًا (صدق: غير مبنيّ)', async () => {
    getMock.mockResolvedValue({ data: { answers: {} } })
    renderR(<IntakeStatusCard companyId="co-3" level="growth" />)
    await act(async () => { await Promise.resolve() })
    // «خطة ٩٠ يومًا» قادمة (🔜) → ليست رابطًا.
    expect(screen.queryByRole('link', { name: 'خطة ٩٠ يومًا' })).toBeNull()
  })
})
