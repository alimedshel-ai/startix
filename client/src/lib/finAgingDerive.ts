// ─── ت٣أ٢: اشتقاق إجماليات الذمم والقروض من التفاصيل — دوالّ نقيّة قابلة للاختبار ──
// مطابق docs/FIN_QUANT_CROSSOVER.md §ت٣أ٢ (مُعتمَد 2026-08-08). تُستعمَل داخل الشاشة
// (FinanceQuantitativeSection) لحساب FINQ_AR / FINQ_AR_OVERDUE / FINQ_DEBT / FINQ_INST
// من التفاصيل — finQuantDerive.ts والمحرّك لا يتغيّران (يقرآن الإجماليات كما هي).

/** يحوّل الأرقام العربية-الهندية (٠-٩) والفارسية (۰-۹) إلى لاتينية قبل التفسير. */
export function toLatinDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
}

export interface Loan {
  lender: string
  balance: number
  installment: number
  /** ح٣ — سعر الفائدة/التكلفة (٪ سنوي). يغذّي WACC/ICR في ط٤ فقط؛ لا أثر على المحرّك الحيّ (ق٩). */
  rate?: number
}

/** WACC تقريبيّ = متوسط أسعار الفائدة مرجّحًا بالأرصدة (ط٤). null إن غابت الأسعار/الأرصدة. */
export function weightedAvgRate(loans: Loan[] | undefined): number | null {
  if (!loans || loans.length === 0) return null
  let wsum = 0
  let bsum = 0
  for (const l of loans) {
    if (typeof l.rate === 'number' && isFinite(l.rate) && typeof l.balance === 'number' && isFinite(l.balance) && l.balance > 0) {
      wsum += l.rate * l.balance
      bsum += l.balance
    }
  }
  return bsum > 0 ? wsum / bsum : null
}

/** شرائح أعمار الذمم الأربع (0-30 / 31-60 / 61-90 / +90). */
export const AR_BUCKETS = ['B1', 'B2', 'B3', 'B4'] as const

const fin = (n: unknown): number => (typeof n === 'number' && isFinite(n) ? n : 0)

/**
 * يشتقّ إجمالي الذمم والمتأخر من شرائح الأعمار في finq.
 * FINQ_AR = مجموع قيَم الشرائح · المتأخر = **B3 + B4 فقط** (فوق 60 يومًا، قرار المالك 2026-08-08).
 * يُرجِع null إن لم تُدخَل أيّ شريحة (فيبقى الإجمالي اليدويّ fallback).
 */
export function deriveArAging(
  finq: Record<string, number>,
): { value: number; overdueV: number; overdueN: number } | null {
  const present = AR_BUCKETS.some(
    (b) => finq[`FINQ_AR_${b}_V`] != null || finq[`FINQ_AR_${b}_N`] != null,
  )
  if (!present) return null
  const v = (b: string) => fin(finq[`FINQ_AR_${b}_V`])
  const n = (b: string) => fin(finq[`FINQ_AR_${b}_N`])
  return {
    value: v('B1') + v('B2') + v('B3') + v('B4'),
    overdueV: v('B3') + v('B4'),
    overdueN: n('B3') + n('B4'),
  }
}

/**
 * يشتقّ إجمالي الديون والأقساط من قائمة القروض.
 * FINQ_DEBT = مجموع الأرصدة · FINQ_INST = مجموع الأقساط. null إن كانت القائمة فارغة.
 */
export function sumLoans(loans: Loan[] | undefined): { debt: number; inst: number } | null {
  if (!loans || loans.length === 0) return null
  return {
    debt: loans.reduce((s, l) => s + fin(l.balance), 0),
    inst: loans.reduce((s, l) => s + fin(l.installment), 0),
  }
}
