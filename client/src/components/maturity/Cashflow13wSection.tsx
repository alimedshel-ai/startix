import { useMemo, useState } from 'react'

import { computeCashflow13w } from '@/lib/finCashflow13w'

// ─── نقدية ١٣ أسبوعًا (المخرج ٣) — جدول + خلاصة + What-If ─────────────────
// يقرأ المدخلات المحسوبة من الأب (نقد افتتاحيّ · شرائح · تشغيل شهريّ · أقساط).

const sar = (v: number) => `${Math.round(v).toLocaleString('en-US')} ﷼`

export function Cashflow13wSection(props: {
  openingCash: number
  buckets: { b1: number; b2: number; b3: number; b4: number }
  monthlyOpex: number
  monthlyInstallments: number
}) {
  // What-If: احتمال تحصيل المتأخر >٩٠ يومًا (٠..١٠٠٪) — يُعاد الحساب حيًّا.
  const [b4Prob, setB4Prob] = useState(40)

  const res = useMemo(
    () => computeCashflow13w({ ...props, b4CollectProb: b4Prob / 100 }),
    [props, b4Prob],
  )

  const hasData = props.openingCash > 0 || props.monthlyOpex > 0 || Object.values(props.buckets).some((v) => v > 0)
  if (!hasData) return null

  const safe = res.firstRiskWeek == null
  return (
    <div className="rounded-lg border border-indigo-300 bg-indigo-50/40 p-3" dir="rtl">
      <div className="mb-2 text-sm font-bold">📅 توقّع النقدية — ١٣ أسبوعًا</div>

      {/* خلاصة المالك */}
      <div className={`mb-3 rounded-md border p-2.5 text-sm font-semibold ${safe ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-rose-300 bg-rose-50 text-rose-900'}`}>
        {safe
          ? `✅ نقدك يكفي طوال ١٣ أسبوعًا — أدنى رصيد ${sar(res.minBalance)}.`
          : `🔴 نقدك يكفي ${res.safeWeeks} ${res.safeWeeks === 1 ? 'أسبوعًا' : 'أسابيع'} فقط — أقرب خطر: الأسبوع ${res.firstRiskWeek}. أدنى رصيد ${sar(res.minBalance)}.`}
      </div>

      {/* What-If */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">ماذا لو تغيّر تحصيل المتأخر (&gt;٩٠ يومًا):</span>
        <input type="range" min={0} max={100} value={b4Prob} onChange={(e) => setB4Prob(Number(e.target.value))} className="w-40" />
        <span className="font-bold tabular-nums">{b4Prob}%</span>
      </div>

      {/* الجدول */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular-nums">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="p-1 text-right">الأسبوع</th>
              <th className="p-1 text-left">داخل</th>
              <th className="p-1 text-left">خارج</th>
              <th className="p-1 text-left">الرصيد المتوقَّع</th>
            </tr>
          </thead>
          <tbody>
            {res.weeks.map((w) => (
              <tr key={w.week} className={`border-b border-muted/40 ${w.belowFloor ? 'bg-rose-100/60' : ''}`}>
                <td className="p-1 text-right">{w.week}{w.belowFloor ? ' 🔴' : ''}</td>
                <td className="p-1 text-left text-emerald-700">{w.inflow ? `+${sar(w.inflow)}` : '—'}</td>
                <td className="p-1 text-left text-rose-700">{w.outflow ? `−${sar(w.outflow)}` : '—'}</td>
                <td className={`p-1 text-left font-semibold ${w.balance < 0 ? 'text-rose-700' : ''}`}>{sar(w.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        توزيع التحصيل بالعمر (B1 أسابيع ١-٤ · B2 ٣-٨ · B3/B4 ٧-١٣) · التشغيل ÷٤٫٣٣ · الأقساط أسابيع ٤/٨/١٢. تقديريّ لترتيب الأولويّة.
      </p>
    </div>
  )
}
