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

// القطعة ٣ — بنك الاقتراحات (اقتراح لا إجبار): النقر يعبّئ الاسم ويضبط الدورة
// الافتراضيّة؛ الكتابة الحرّة تبقى متاحة دائمًا. نوع ٥ تمويليّ: لا بنود ولا اقتراحات
// (المصدر الواحد هو قائمة القروض — لا مصدران لنفس الرقم).
type Suggestion = { name: string; recurrence: Recurrence }
const SUGGESTIONS: Record<CostType, Suggestion[]> = {
  1: [
    { name: 'رواتب وأجور ثابتة', recurrence: 'monthly' },
    { name: 'إيجار مقرّ/مستودع/ورشة', recurrence: 'annual' },
    { name: 'كهرباء وماء', recurrence: 'monthly' },
    { name: 'اتصالات وإنترنت', recurrence: 'monthly' },
    { name: 'اشتراكات أنظمة وبرامج', recurrence: 'monthly' },
    { name: 'تأمين منشأة/مركبات/طبّي', recurrence: 'annual' },
    { name: 'مكتب محاسبة', recurrence: 'annual' },
    { name: 'صيانة دوريّة', recurrence: 'quarterly' },
  ],
  2: [
    { name: 'موادّ وقطع غيار', recurrence: 'monthly' },
    { name: 'وقود وتحرّكات فرق', recurrence: 'monthly' },
    { name: 'عمولات مرتبطة بالإنتاج', recurrence: 'monthly' },
    { name: 'مقاولو باطن', recurrence: 'monthly' },
    { name: 'تغليف وتسليم', recurrence: 'monthly' },
  ],
  3: [
    { name: 'إعلانات مموّلة', recurrence: 'monthly' },
    { name: 'إدارة حسابات ومحتوى', recurrence: 'monthly' },
    { name: 'مطبوعات ولوحات', recurrence: 'quarterly' },
    { name: 'معارض ورعايات', recurrence: 'annual' },
    { name: 'عمولات تسويق', recurrence: 'monthly' },
  ],
  4: [
    { name: 'زكاة/ضريبة دخل', recurrence: 'annual' },
    { name: 'ضريبة القيمة المضافة', recurrence: 'quarterly' },
    { name: 'التأمينات الاجتماعية GOSI', recurrence: 'monthly' },
    { name: 'المقابل الماليّ للعمالة الوافدة', recurrence: 'monthly' },
    { name: 'رخص عمل وإقامات', recurrence: 'annual' },
    { name: 'رسوم بلديّة', recurrence: 'annual' },
    { name: 'سجل تجاريّ وغرفة', recurrence: 'annual' },
    { name: 'رسوم جمركيّة', recurrence: 'monthly' },
    { name: 'غرامات ومخالفات', recurrence: 'oneoff' },
  ],
  5: [], // تمويليّة — تُدار من قائمة القروض
  6: [
    { name: 'شراء معدات وآلات', recurrence: 'oneoff' },
    { name: 'مركبات وأسطول', recurrence: 'oneoff' },
    { name: 'تجهيز مقرّ/ورشة', recurrence: 'oneoff' },
    { name: 'تطوير أنظمة', recurrence: 'oneoff' },
  ],
  7: [
    { name: 'راتب شخصيّ للمالك', recurrence: 'monthly' },
    { name: 'مسحوبات نقديّة', recurrence: 'monthly' },
    { name: 'مصاريف شخصيّة من حساب الشركة', recurrence: 'monthly' },
  ],
  8: [
    { name: 'مصاريف بنكيّة', recurrence: 'monthly' },
    { name: 'ضيافة واستقبال', recurrence: 'monthly' },
    { name: 'تدريب وتطوير', recurrence: 'quarterly' },
    { name: 'مخصّص ديون مشكوك فيها', recurrence: 'quarterly' },
    { name: 'متنوّعات', recurrence: 'monthly' },
  ],
}

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
          {items.map((it, i) => {
            const financing = it.type === 5
            return (
            <div key={it.id} className="rounded-md border bg-card p-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Input
                  className="h-8 w-40" placeholder="اسم البند (إيجار المكتب)" value={it.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                />
                <select
                  className="h-8 rounded-md border bg-background px-2 text-xs" value={it.type}
                  onChange={(e) => {
                    const t = Number(e.target.value) as CostType
                    // نوع ٥ تمويليّ: صفّر المبلغ (لا مصدر ثانٍ للرقم — يُدار من القروض).
                    update(i, t === 5 ? { type: t, amount: 0 } : { type: t })
                  }}
                >
                  {TYPES.map((t) => <option key={t} value={t}>{t}. {COST_TYPE_LABEL[t]}</option>)}
                </select>
                <Input
                  className="h-8 w-28" type="number" inputMode="numeric" placeholder="المبلغ" value={it.amount || ''}
                  disabled={financing}
                  onChange={(e) => update(i, { amount: Number(e.target.value) || 0 })}
                />
                <select
                  className="h-8 rounded-md border bg-background px-2 text-xs" value={it.recurrence}
                  disabled={financing}
                  onChange={(e) => update(i, { recurrence: e.target.value as Recurrence })}
                >
                  {RECURRENCES.map((r) => <option key={r} value={r}>{RECURRENCE_LABEL[r]}</option>)}
                </select>
                <span className="text-[11px] text-muted-foreground">= {sar(monthlyEquivalent(it))}/شهر</span>
                <Button type="button" size="sm" variant="ghost" className="ms-auto text-rose-600" onClick={() => remove(i)}>حذف</Button>
              </div>

              {/* القطعة ٣ — توجيه نوع ٥، أو بنك اقتراحات النوع (نقر يعبّئ الاسم + الدورة) */}
              {financing ? (
                <p className="mt-1.5 text-[11px] font-medium text-amber-700">
                  💡 التمويليّة تُدار من مصدرٍ واحد — <b>أدرجها من قائمة القروض</b> أعلى الصفحة (لا مصدران لنفس الرقم).
                </p>
              ) : (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <span className="text-[11px] text-muted-foreground">اقتراحات:</span>
                  {SUGGESTIONS[it.type].map((s) => (
                    <button
                      type="button" key={s.name}
                      onClick={() => update(i, { name: s.name, recurrence: s.recurrence })}
                      className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800 hover:bg-emerald-100"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            )
          })}
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
