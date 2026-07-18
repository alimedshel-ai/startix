import { Link } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'

// ─── NextActionCard — «إلى أين أذهب الآن؟» ─────────────────────
// بطاقة توجيه ذكيّة مشتركة تُستخدَم أعلى الصفحات الأساسيّة (Hubs،
// ClientsPage، DiagnosticPage) لتوجيه المدير إلى الخطوة الأنسب
// بلغة واضحة + CTA واحد ملوَّن حسب أولويّة الحالة.

export type NextActionVariant = 'sky' | 'rose' | 'amber' | 'orange' | 'emerald' | 'indigo' | 'slate'

const VARIANTS: Record<NextActionVariant, { border: string; bg: string; button: string }> = {
  sky:      { border: 'border-sky-400',     bg: 'bg-gradient-to-l from-sky-100 to-sky-50/40',         button: 'bg-sky-600 text-white hover:bg-sky-700' },
  rose:     { border: 'border-rose-500',    bg: 'bg-gradient-to-l from-rose-100 to-rose-50/40',       button: 'bg-rose-600 text-white hover:bg-rose-700' },
  amber:    { border: 'border-amber-400',   bg: 'bg-gradient-to-l from-amber-100 to-amber-50/40',     button: 'bg-amber-600 text-white hover:bg-amber-700' },
  orange:   { border: 'border-orange-400',  bg: 'bg-gradient-to-l from-orange-100 to-orange-50/40',   button: 'bg-orange-600 text-white hover:bg-orange-700' },
  emerald:  { border: 'border-emerald-400', bg: 'bg-gradient-to-l from-emerald-100 to-emerald-50/40', button: 'bg-emerald-600 text-white hover:bg-emerald-700' },
  indigo:   { border: 'border-indigo-400',  bg: 'bg-gradient-to-l from-indigo-100 to-indigo-50/40',   button: 'bg-indigo-600 text-white hover:bg-indigo-700' },
  slate:    { border: 'border-slate-400',   bg: 'bg-gradient-to-l from-slate-100 to-slate-50/40',     button: 'bg-slate-700 text-white hover:bg-slate-800' },
}

export interface NextActionCardProps {
  icon: string
  title: string
  reason: string
  to: string
  cta: string
  variant: NextActionVariant
  /** إذا كانت الخطوة داخل نفس الصفحة (تبديل تبويب) — استخدم onClick بدل Link */
  onClick?: () => void
}

export function NextActionCard({ icon, title, reason, to, cta, variant, onClick }: NextActionCardProps) {
  const v = VARIANTS[variant]

  const Button = onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-4 py-2 text-sm font-medium shadow-sm transition ${v.button}`}
    >
      {cta} ←
    </button>
  ) : (
    <Link
      to={to}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-4 py-2 text-sm font-medium shadow-sm transition ${v.button}`}
    >
      {cta} ←
    </Link>
  )

  return (
    <Card className={`overflow-hidden border-2 ${v.border} ${v.bg}`}>
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        <div className="text-4xl">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            🧭 إلى أين أذهب الآن؟
          </div>
          <div className="mt-0.5 text-base font-bold">{title}</div>
          <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{reason}</div>
        </div>
        {Button}
      </CardContent>
    </Card>
  )
}
