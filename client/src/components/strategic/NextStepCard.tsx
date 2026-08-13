import { Link, useLocation, useNavigate } from 'react-router-dom'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useGuidedNext, type GuidedKind } from '@/hooks/useGuidedNext'
import { skipTows } from '@/journey/towsSkip'

// ─── S3 — بطاقة «الخطوة التالية» أسفل كل أداة استراتيجية ──────────
// مصدر واحد: تقرأ من useGuidedNext (نفس ما تقرأه القمرة · السايد بار ·
// لوحة العميل) — فلا «تالٍ» يختلف بحسب السطح. حُذف المُقرِّر المنشقّ
// (القائمة الثابتة ٣-من-٩ + مطابقتها بالتساوي التامّ التي تُعمي عن
// artifacts الإدارة _HR). التسلسل + الطوارئ + بوّابة SWOT (الشقّان
// الداخليّ/الخارجيّ) كلّها من المحرّك الموحّد الآن — انظر TASK_UNIFY (الخطوة ١).

interface Props {
  clientQuery?: string
  /** معرّف العميل/الشركة — المحرّك الموحّد يبني «التالي» ووجهته منه. */
  companyId?: string
}

// نبرة البطاقة بحسب نوع الخطوة (طوارئ/إعادة تدقيق/عاديّة/اكتمال).
const KIND_STYLE: Record<GuidedKind, { card: string; badge: string; badgeText: string; btn: string; title: string }> = {
  rescue:      { card: 'border-rose-300 bg-gradient-to-l from-rose-100/60 to-transparent',       badge: 'text-rose-700',        badgeText: '🚨 خطة إنقاذ عاجلة',  btn: 'bg-rose-600 text-white',            title: 'text-rose-950' },
  reaudit:     { card: 'border-amber-300 bg-gradient-to-l from-amber-100/60 to-transparent',     badge: 'text-amber-700',       badgeText: 'تأكّد من التعافي',    btn: 'bg-amber-600 text-white',           title: 'text-amber-950' },
  action:      { card: 'border-primary/30 bg-gradient-to-l from-primary/10 to-primary/5',        badge: 'text-muted-foreground', badgeText: 'الخطوة التالية',     btn: 'bg-primary text-primary-foreground', title: '' },
  locked:      { card: 'border-primary/30 bg-gradient-to-l from-primary/10 to-primary/5',        badge: 'text-muted-foreground', badgeText: 'الخطوة التالية',     btn: 'bg-primary text-primary-foreground', title: '' },
  done:        { card: 'border-emerald-300 bg-gradient-to-l from-emerald-100/60 to-transparent', badge: 'text-emerald-700',     badgeText: '🏁 اكتمل المسار',     btn: 'bg-emerald-600 text-white',         title: 'text-emerald-950' },
  'no-client': { card: '', badge: '', badgeText: '', btn: '', title: '' },
}

export function NextStepCard({ companyId }: Props) {
  const { loading, next } = useGuidedNext(companyId ?? null)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // لا نعرض شيئاً أثناء الجلب أو حين لا وجهة (لا عميل / غير قابلة للنقر).
  if (loading || !next || !next.to) return null
  const s = KIND_STYLE[next.kind]
  // المحرّك route-agnostic: قد يوصي بالأداة التي أنت عليها (مثلاً PESTEL وأنت
  // في /manager/dept-pestel). عندها لا نعرض رابطاً دائريّاً «افتحها الآن»
  // لصفحتك نفسها — بل إشارة «أنت هنا، أكمِلها» مع إبقاء سبب الخطوة مفيداً.
  const isHere = next.to.split('?')[0] === pathname

  // زر «تخطّى» للخطوة المقترَحة غير المُلزِمة (TOWS): يكتم التوصية لهذا العميل
  // وينتقل للخطوة الحقيقيّة التالية — «افتحها الآن أو تخطّى».
  const onSkip = () => {
    if (companyId) skipTows(companyId)
    if (next.skipTo) navigate(next.skipTo)
  }

  return (
    <Card className={s.card}>
      <CardHeader className="pb-2">
        <CardDescription className={`text-xs font-medium ${s.badge}`}>{s.badgeText}</CardDescription>
        <CardTitle className={`flex items-center gap-2 text-base ${s.title}`}>
          <span aria-hidden>{next.icon}</span>
          <span>{next.label}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="max-w-md text-xs text-muted-foreground">{next.reason}</p>
        <div className="flex shrink-0 items-center gap-2">
          {next.skippable && next.skipTo && (
            <button
              type="button"
              onClick={onSkip}
              className="rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted"
            >
              تخطّى ←
            </button>
          )}
          {isHere ? (
            <span className="rounded-md border border-dashed px-3 py-1.5 text-sm font-medium text-muted-foreground">
              ✓ أنت في هذه الأداة — أكمِلها واحفظ
            </span>
          ) : (
            <Link
              to={next.to}
              className={`rounded-md px-3 py-1.5 text-sm font-medium shadow-sm hover:opacity-90 ${s.btn}`}
            >
              افتحها الآن ←
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
