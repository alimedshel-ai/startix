// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { CostCenterSection } from './CostCenterSection'
import type { CostItem } from '@/lib/finCostCenter'

// ─── إثبات تصيير §٧-ب (المكافئ الآليّ للّقطة الحيّة) ──────────────────────────
// بند نوع ٤ يُظهر بنك الاقتراحات الحكوميّة القابل للنقر (يُعبّئ الاسم + الدورة)،
// ونوع ٥ تمويليّ معطَّل (لا مبلغ) مع توجيه «أدرجها من قائمة القروض».

const item = (over: Partial<CostItem>): CostItem =>
  ({ id: 'ci_1', name: '', type: 1, amount: 0, recurrence: 'monthly', ...over })

afterEach(() => cleanup())

describe('CostCenterSection §٧-ب — بنك الاقتراحات + تعطيل نوع ٥', () => {
  it('نوع ٤: تظهر الاقتراحات الحكوميّة، والنقر يعبّئ الاسم + الدورة (سنويّ لرخص العمل)', () => {
    const onChange = vi.fn()
    render(<CostCenterSection items={[item({ type: 4 })]} onChange={onChange} />)

    // الاقتراحات الحكوميّة ظاهرة (منها المقابل المالي للعمالة الوافدة + رخص وإقامات).
    expect(screen.getByRole('button', { name: 'المقابل الماليّ للعمالة الوافدة' })).toBeTruthy()
    const rukhas = screen.getByRole('button', { name: 'رخص عمل وإقامات' })
    fireEvent.click(rukhas)
    // النقر يعبّئ الاسم والدورة الافتراضيّة (سنويّ = annual) — اقتراح لا إجبار.
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ name: 'رخص عمل وإقامات', recurrence: 'annual' })])
  })

  it('نوع ٥ تمويليّ: التوجيه ظاهر، وحقل المبلغ معطَّل (لا مصدر ثانٍ للرقم)', () => {
    const { container } = render(<CostCenterSection items={[item({ type: 5 })]} onChange={vi.fn()} />)
    expect(screen.getByText(/أدرجها من قائمة القروض/)).toBeTruthy()
    // لا اقتراحات لنوع ٥.
    expect(screen.queryByText('اقتراحات:')).toBeNull()
    // حقل المبلغ معطَّل.
    const amount = within(container).getByPlaceholderText('المبلغ') as HTMLInputElement
    expect(amount.disabled).toBe(true)
  })

  it('اختيار نوع ٥ لبندٍ يُصفّر مبلغه (لا يُحتسب في التشغيل)', () => {
    const onChange = vi.fn()
    const { container } = render(<CostCenterSection items={[item({ type: 1, amount: 9000 })]} onChange={onChange} />)
    const typeSelect = within(container).getAllByRole('combobox')[0]
    fireEvent.change(typeSelect, { target: { value: '5' } })
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ type: 5, amount: 0 })])
  })
})
