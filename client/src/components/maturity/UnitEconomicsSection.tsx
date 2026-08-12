import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { unitEconomics, type Product } from '@/lib/finUnitEconomics'

// ─── اقتصاديات الوحدة (المخرج ٥) — محرّر منتجات + جدول هوامش + كشف الخاسر ───

const sar = (n: number) => `${Math.round(n).toLocaleString('en-US')} ﷼`
const uid = (products: Product[]) => `pr_${products.length}_${products.reduce((s, p) => s + p.name.length, 0)}`

export function UnitEconomicsSection({ products, onChange, fixedMonthly }: {
  products: Product[]
  onChange: (products: Product[]) => void
  fixedMonthly: number
}) {
  const econ = useMemo(() => unitEconomics(products, fixedMonthly), [products, fixedMonthly])
  const byId = useMemo(() => new Map(econ.rows.map((r) => [r.id, r])), [econ])

  const add = () => onChange([...products, { id: uid(products) + `_${products.length}`, name: '', varCostUnit: 0, priceUnit: 0 }])
  const update = (i: number, patch: Partial<Product>) => onChange(products.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  const remove = (i: number) => onChange(products.filter((_, idx) => idx !== i))

  return (
    <div className="rounded-lg border border-violet-300 bg-violet-50/40 p-3" dir="rtl">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold">📦 اقتصاديات الوحدة — هامش كلّ منتج/خدمة</span>
        <Button type="button" size="sm" variant="outline" onClick={add}>+ أضف منتجًا</Button>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">
        لكلّ منتج: هامش المساهمة (السعر − المتغيّرة) ونسبته + السعر الأدنى المقبول. يكشف <b>المنتج الخاسر المخفيّ</b> وراء ربحيّة الشركة الكلّيّة.
      </p>

      {econ.lossMaking.length > 0 && (
        <div className="mb-2 rounded-md border border-rose-300 bg-rose-50 p-2 text-xs font-semibold text-rose-900">
          🔴 منتجات خاسرة (السعر لا يغطّي المتغيّرة): {econ.lossMaking.map((r) => r.name || '؟').join(' · ')} — ارفع سعرها أو أوقفها.
        </div>
      )}

      {products.length === 0 ? (
        <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
          لا منتجات بعد — أضِف منتجًا بسعره وتكلفته المتغيّرة لترى هامشه.
        </div>
      ) : (
        <div className="space-y-1.5">
          {products.map((p, i) => {
            const e = byId.get(p.id)
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-1.5 rounded-md border bg-card p-1.5">
                <Input className="h-8 w-36" placeholder="اسم المنتج" value={p.name} onChange={(ev) => update(i, { name: ev.target.value })} />
                <Input className="h-8 w-24" type="number" inputMode="numeric" placeholder="السعر" value={p.priceUnit || ''} onChange={(ev) => update(i, { priceUnit: Number(ev.target.value) || 0 })} />
                <Input className="h-8 w-24" type="number" inputMode="numeric" placeholder="متغيّرة/وحدة" value={p.varCostUnit || ''} onChange={(ev) => update(i, { varCostUnit: Number(ev.target.value) || 0 })} />
                <Input className="h-8 w-24" type="number" inputMode="numeric" placeholder="وحدات/شهر" value={p.monthlyUnits || ''} onChange={(ev) => update(i, { monthlyUnits: Number(ev.target.value) || undefined })} />
                {e && (
                  <span className={`text-[11px] font-semibold ${e.profitable ? 'text-emerald-700' : 'text-rose-700'}`}>
                    هامش {sar(e.contributionMargin)} ({Math.round(e.contributionMarginPct)}%){e.profitable ? '' : ' 🔴'}
                  </span>
                )}
                <Button type="button" size="sm" variant="ghost" className="ms-auto text-rose-600" onClick={() => remove(i)}>حذف</Button>
              </div>
            )
          })}
        </div>
      )}

      {econ.rows.some((r) => r.monthlyContribution != null) && (
        <div className="mt-2 rounded-md border border-emerald-300 bg-emerald-50/60 p-2 text-xs">
          <b>إجمالي المساهمة الشهريّة:</b> {sar(econ.totalMonthlyContribution)}
          {econ.coversFixed != null && (
            econ.coversFixed
              ? <span className="text-emerald-700"> — تغطّي التكاليف الثابتة ({sar(fixedMonthly)}) ✅</span>
              : <span className="text-rose-700"> — لا تغطّي الثابتة ({sar(fixedMonthly)}) 🔴</span>
          )}
        </div>
      )}
    </div>
  )
}
