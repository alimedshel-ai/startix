import { Link } from 'react-router-dom'
import type { CompanyOpex } from '@/lib/deptApi'

// ─── R4 — عرض OPEX كإشارة تغذية للأدوات الاستراتيجية ───────────────
// المصدر: ملف الاقتراح — «OPEX (المستهدف/الميزانية/الفريق) مخزّنة لكنها
// لا تصل إلى الأدوات». هذا المكوّن يُدرَج أعلى كل أداة تعتمد على OPEX
// (KPIs، Ansoff، Gap، Financial) ليُوضّح للمدير الأرقام المتاحة ويربطها
// بموقع تعديلها (/onboarding).

interface Props {
  opex: CompanyOpex | null | undefined
  focus?: ('team' | 'budget' | 'target' | 'avgSalary')[]
  title?: string
}

export function OpexHint({ opex, focus, title = 'أرقام تشغيلية متاحة' }: Props) {
  const items: { key: keyof CompanyOpex; label: string; icon: string; suffix?: string }[] = [
    { key: 'team',      icon: '👥', label: 'عدد الفريق' },
    { key: 'budget',    icon: '💰', label: 'الميزانية السنوية', suffix: 'SAR' },
    { key: 'target',    icon: '🎯', label: 'المستهدف السنوي',   suffix: 'SAR' },
    { key: 'avgSalary', icon: '💵', label: 'متوسط الراتب',      suffix: 'SAR/شهر' },
  ]
  const filtered = focus ? items.filter((i) => focus.includes(i.key)) : items
  const hasAny = opex && filtered.some((i) => opex[i.key] != null)

  if (!hasAny) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
        <span className="ml-1">ℹ️</span>
        <span>لا OPEX مسجّلة — </span>
        <Link to="/onboarding" className="text-primary underline-offset-4 hover:underline">
          أضِف الأرقام من صفحة onboarding
        </Link>
        <span> لتُغذّي هذه الأداة تلقائياً.</span>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-primary/5 p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-primary">{title}</span>
        <Link to="/onboarding" className="text-[10px] text-primary/70 underline-offset-4 hover:underline">
          تعديل ←
        </Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
        {filtered.map((i) => {
          const v = opex?.[i.key]
          if (v == null) return null
          return (
            <div key={i.key} className="flex items-center gap-1.5 rounded-md bg-card px-2 py-1.5">
              <span aria-hidden>{i.icon}</span>
              <div className="flex-1">
                <div className="text-[10px] text-muted-foreground">{i.label}</div>
                <div className="text-sm font-semibold tabular-nums">
                  {v.toLocaleString('ar-SA')}
                  {i.suffix && <span className="mr-1 text-[10px] text-muted-foreground">{i.suffix}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
