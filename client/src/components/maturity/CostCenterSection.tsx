import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  COST_TYPE_LABEL, RECURRENCE_LABEL, costMap, monthlyEquivalent, monthlyOpex,
  type CostItem, type CostType, type Recurrence,
} from '@/lib/finCostCenter'

// ─── مركز التكاليف (المخرج ٤) — محرّر بنود + خريطة تكاليف ──────────────────
// قرار ٢: البنود تسود على المجمّع (الاشتقاق يتمّ في المستهلك عبر
// deriveAggregatesIntoFinq). هذا المكوّن يدير القائمة ويعرض الخريطة فقط.

const sar = (n: number) => `${Math.round(n).toLocaleString('en-US')} ﷼`
const uid = (items: CostItem[]) => `ci_${items.length}_${items.reduce((s, i) => s + i.name.length, 0)}`
const TYPES: CostType[] = [1, 2, 3, 4, 5, 6, 7, 8]
const RECURRENCES: Recurrence[] = ['monthly', 'quarterly', 'annual', 'oneoff']

export function CostCenterSection({ items, onChange }: { items: CostItem[]; onChange: (items: CostItem[]) => void }) {
  const map = useMemo(() => costMap(items), [items])
  const opex = useMemo(() => monthlyOpex(items), [items])
  const top5 = useMemo(
    () => [...items].sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a)).slice(0, 5),
    [items],
  )

  const add = () => onChange([...items, { id: uid(items) + `_${items.length}`, name: '', type: 1, amount: 0, recurrence: 'monthly' }])
  const update = (i: number, patch: Partial<CostItem>) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50/40 p-3" dir="rtl">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold">🧾 مركز التكاليف — بنود تفصيليّة (٨ أنواع)</span>
        <Button type="button" size="sm" variant="outline" onClick={add}>+ أضف بندًا</Button>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">
        عند إضافة بنودٍ لفئةٍ، مجموعها الشهريّ <b>يسود</b> على القيمة المجمّعة القديمة (قرار ٢). CapEx ومسحوبات المالك تُستثنى من التشغيل الشهريّ.
      </p>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
          لا بنود بعد — أضِف بنودك التفصيليّة، أو اترك الحقول المجمّعة القديمة كما هي.
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((it, i) => (
            <div key={it.id} className="flex flex-wrap items-center gap-1.5 rounded-md border bg-card p-1.5">
              <Input
                className="h-8 w-40" placeholder="اسم البند (إيجار المكتب)" value={it.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <select
                className="h-8 rounded-md border bg-background px-2 text-xs" value={it.type}
                onChange={(e) => update(i, { type: Number(e.target.value) as CostType })}
              >
                {TYPES.map((t) => <option key={t} value={t}>{t}. {COST_TYPE_LABEL[t]}</option>)}
              </select>
              <Input
                className="h-8 w-28" type="number" inputMode="numeric" placeholder="المبلغ" value={it.amount || ''}
                onChange={(e) => update(i, { amount: Number(e.target.value) || 0 })}
              />
              <select
                className="h-8 rounded-md border bg-background px-2 text-xs" value={it.recurrence}
                onChange={(e) => update(i, { recurrence: e.target.value as Recurrence })}
              >
                {RECURRENCES.map((r) => <option key={r} value={r}>{RECURRENCE_LABEL[r]}</option>)}
              </select>
              <span className="text-[11px] text-muted-foreground">= {sar(monthlyEquivalent(it))}/شهر</span>
              <Button type="button" size="sm" variant="ghost" className="ms-auto text-rose-600" onClick={() => remove(i)}>حذف</Button>
            </div>
          ))}
        </div>
      )}

      {map.length > 0 && (
        <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50/50 p-3">
          <div className="mb-2 text-sm font-bold">🗺️ خريطة التكاليف — إجمالي التشغيل الشهريّ: {sar(opex)}</div>
          <div className="space-y-1">
            {map.map((row) => (
              <div key={row.type} className="flex items-center gap-2 text-xs">
                <span className="w-32 shrink-0 truncate">{row.label}</span>
                <div className="h-3 flex-1 overflow-hidden rounded bg-muted">
                  <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, row.pct)}%` }} />
                </div>
                <span className="w-24 shrink-0 text-left tabular-nums">{sar(row.monthly)}</span>
                <span className="w-10 shrink-0 text-left tabular-nums text-muted-foreground">{Math.round(row.pct)}%</span>
              </div>
            ))}
          </div>
          {top5.length > 0 && (
            <div className="mt-2 border-t pt-2 text-[11px] text-muted-foreground">
              👑 أكبر ٥ مصاريف: {top5.filter((t) => t.name).map((t) => `${t.name} (${sar(monthlyEquivalent(t))})`).join(' · ') || '—'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
