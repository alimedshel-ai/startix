import { useMemo } from 'react'

import { Input } from '@/components/ui/input'
import {
  classifySaudization,
  saudizationAchievementPct,
  type CategoryInput,
  type CategoryResult,
  type SaudizationStatus,
} from '@/lib/saudization'
import {
  currentRatio,
  isStale,
  SAUDIZATION_CATALOG,
  SAUDIZATION_LEGAL_NOTE,
} from '@/lib/saudizationCatalog'

// ─── وحدة التوطين — عدّة تدخل، نسبة تطلع تلقائياً (لا كتابة نِسَب تخميناً) ──────
// المستخدم يفعّل الفئات المنطبقة على منشأته ويُدخل الأعداد؛ المحرّك يحسب النسبة
// الفعليّة والفجوة والحالة. النتيجة الإجماليّة تُغذّي KPI_STR_04 (تُعرَض في الأعلى).
// مُتحكَّم بها من الأب (تُحفَظ ضمن artifact HR_QUANT). حارس الراتب في طبقة §د.

const STATUS_META: Record<SaudizationStatus, { badge: string; label: string; cls: string }> = {
  compliant:      { badge: '✅', label: 'ممتثل',     cls: 'text-emerald-700' },
  near:           { badge: '🟡', label: 'قريب',      cls: 'text-amber-700' },
  non_compliant:  { badge: '🔴', label: 'غير ممتثل', cls: 'text-rose-700' },
  not_applicable: { badge: '⬜', label: 'لا ينطبق',  cls: 'text-muted-foreground' },
}

function numOrUndef(v: string): number | undefined {
  const n = Number(v.replace(/[^\d.-]/g, ''))
  return v.trim() === '' || !isFinite(n) ? undefined : n
}

export function SaudizationSection({
  inputs,
  onChange,
}: {
  inputs: CategoryInput[]
  onChange: (next: CategoryInput[]) => void
}) {
  const byId = useMemo(() => new Map(inputs.map((i) => [i.ruleId, i])), [inputs])
  const summary = useMemo(() => classifySaudization(inputs), [inputs])
  const resultById = useMemo(
    () => new Map(summary.results.map((r) => [r.ruleId, r])),
    [summary],
  )
  const achievement = saudizationAchievementPct(summary)
  const now = new Date() // لوسم تقادم مصادر الكتالوج (٩٠ يوماً)

  function toggle(ruleId: string, on: boolean) {
    if (on) onChange([...inputs, { ruleId, saudiCount: 0, nonSaudiCount: 0, countedCount: 0 }])
    else onChange(inputs.filter((i) => i.ruleId !== ruleId))
  }

  function setField(ruleId: string, field: keyof Omit<CategoryInput, 'ruleId'>, v: string) {
    const n = numOrUndef(v) ?? 0
    onChange(inputs.map((i) => (i.ruleId === ruleId ? { ...i, [field]: n } : i)))
  }

  return (
    <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50/40 p-4" dir="rtl">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-emerald-900">🇸🇦 التوطين — عدّة تدخل، نسبة تطلع تلقائياً</span>
        {achievement != null ? (
          <span className="text-xs font-bold text-emerald-900">
            السعودة الفعليّة / المستهدفة: {achievement}٪ · تُغذّي KPI_STR_04
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">فعّل الفئات المنطبقة على منشأتك</span>
        )}
      </div>
      {summary.applicableCount > 0 && (
        <p className="mb-2 text-xs text-emerald-800/80">
          إجماليّ الفجوة: <b>{summary.totalGap}</b> موظّف · الحالة العامّة:{' '}
          <b className={STATUS_META[summary.overallStatus].cls}>{STATUS_META[summary.overallStatus].label}</b>
        </p>
      )}

      <div className="flex flex-col divide-y divide-emerald-200">
        {SAUDIZATION_CATALOG.map((rule) => {
          const enabled = byId.has(rule.id)
          const inp = byId.get(rule.id)
          const res = resultById.get(rule.id)
          return (
            <div key={rule.id} className="py-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-emerald-600"
                  checked={enabled}
                  onChange={(e) => toggle(rule.id, e.target.checked)}
                />
                <span className="flex-1">{rule.category}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  الهدف {currentRatio(rule)}٪{rule.applyMinWorkers ? ` · ينطبق ${rule.applyMinWorkers}+` : ''}
                  {isStale(rule, now) && <span className="mr-1 rounded bg-amber-200 px-1 text-[10px] font-bold text-amber-900">يحتاج إعادة تحقّق</span>}
                </span>
              </label>

              {enabled && inp && (
                <div className="mt-2 mr-6 flex flex-col gap-2">
                  <div className="grid grid-cols-3 gap-2">
                    <CountInput label="سعوديّون" value={inp.saudiCount} onChange={(v) => setField(rule.id, 'saudiCount', v)} />
                    <CountInput label="غير سعوديّين" value={inp.nonSaudiCount} onChange={(v) => setField(rule.id, 'nonSaudiCount', v)} />
                    <CountInput label="محتسَبون فعلاً" value={inp.countedCount} onChange={(v) => setField(rule.id, 'countedCount', v)} />
                  </div>
                  {res && <ResultRow res={res} />}
                  {(rule.minSalary || rule.minSalaryNote) && (
                    <p className="text-[11px] text-muted-foreground">
                      حدّ الاحتساب: {rule.minSalary ? `${rule.minSalary.toLocaleString('ar-SA')} ريال` : rule.minSalaryNote}
                      {rule.accreditation ? ` · ${rule.accreditation}` : ''}
                    </p>
                  )}
                  {/* حوكمة: مصدر وتاريخ تحقّق كل صف */}
                  <p className="text-[10px] text-muted-foreground/80">المصدر: {rule.source} · تحقّق {rule.verifiedOn}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* تأطير المسؤوليّة — بجانب التوصيات، لا في وثيقة منفصلة */}
      <p className="mt-3 border-t border-emerald-200 pt-2 text-[11px] leading-relaxed text-emerald-900/70">
        {SAUDIZATION_LEGAL_NOTE}
      </p>
    </div>
  )
}

function ResultRow({ res }: { res: CategoryResult }) {
  const m = STATUS_META[res.status]
  return (
    <div className="flex flex-col gap-1 rounded bg-white/70 px-2 py-1.5 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`font-bold ${m.cls}`}>{m.badge} {m.label}</span>
        {res.status !== 'not_applicable' && (
          <>
            <span>الفعليّ <b>{res.actualRatio}٪</b> / المطلوب {res.requiredRatio}٪</span>
            {res.gap > 0 && <span className="text-rose-700">فجوة <b>{res.gap}</b> موظّف</span>}
          </>
        )}
      </div>
      {res.sequenceRequired && (
        <p className="rounded bg-rose-100/70 px-2 py-1 font-medium text-rose-800">
          ⚠️ مهنة مقصورة ١٠٠٪ — تسلسل إلزاميّ: وظّف سعوديّاً وارفع عقده أولاً، <b>ثمّ</b> غيّر مهنة غير السعوديّ (لا تُنفَّذ الخطوتان معكوستَين — إجراء غير نظاميّ).
        </p>
      )}
    </div>
  )
}

function CountInput({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-emerald-900">
      {label}
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        className="h-8 text-center"
        value={value === 0 ? '' : value}
        placeholder="0"
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
