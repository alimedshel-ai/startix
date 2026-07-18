import { Link } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'

// ─── OutsideRescueBanner ─────────────────────────────────────────
// بانر تحذير يظهر عندما يدخل المستخدم أداةً خارج التسلسل الرباعيّ
// لخطّة الإنقاذ ٩٠ يوم (مخاطر → أيزنهاور → RACI → جانت).
//
// أدوات خارج المسار (مثل SWOT / TOWS / Directions / Choices / KPIs / OKRs)
// طويلة الأمد بطبيعتها — لا تناسب المنطقة الحمراء التي تتطلّب استقراراً سريعاً.
//
// الاستعمال: نمرّر `toolName` (مثل «مركز القياس») + companyId.

interface Props {
  companyId: string
  /** اسم الأداة/الصفحة الحاليّة كما تظهر للمستخدم */
  toolName: string
  /** سطر إضافي (اختياري) يشرح لماذا هذه الأداة خارج مسار الإنقاذ */
  whyOutside?: string
}

export function OutsideRescueBanner({ companyId, toolName, whyOutside }: Props) {
  return (
    <Card className="overflow-hidden border-2 border-rose-400 bg-gradient-to-l from-rose-50 via-rose-50/40 to-transparent shadow-md">
      <div className="h-1 animate-pulse bg-gradient-to-l from-rose-600 via-rose-500 to-rose-400" />
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="text-3xl">⚠️</div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-rose-400 bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-900">
                خارج مسار الإنقاذ ٩٠ يوم
              </span>
            </div>
            <div className="text-sm font-bold text-rose-900">
              «{toolName}» ليست ضمن الأدوات الأربع للإنقاذ
            </div>
            <p className="mt-1 text-xs leading-relaxed text-rose-800/80">
              خطّتك الحاليّة هي إنقاذ ٩٠ يوم (مخاطر → أيزنهاور → RACI → جانت).
              {whyOutside ? ` ${whyOutside}` : ' هذه الأداة تنتظر خروجك من المنطقة الحمراء والانتقال إلى خطّة تأسيسيّة.'}
              <b className="mt-1 block text-rose-900">لا تُنشئ بيانات استراتيجيّة طويلة الأمد قبل استعادة الاستقرار.</b>
            </p>
          </div>
          <Link
            to={`/manager/strategic-plan?client=${companyId}`}
            className="shrink-0 rounded-md bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700"
          >
            ← عد لخطّة الإنقاذ
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
