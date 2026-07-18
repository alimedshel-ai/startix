import { Link } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'

// ─── RescueContextBanner — سياق خطّة الإنقاذ ٩٠ يوم ────────────────
// يظهر أعلى الأدوات الأربع (Risk/Eisenhower/RACI/Gantt) عند القدوم من
// الخطّة الطارئة (?from=emergency). يوضّح:
//   • أين المستخدم في التسلسل (١/٢/٣/٤)
//   • ماذا تفعل هذه الأداة (سبب هذه الخطوة)
//   • الخطوة التالية + زرّ للانتقال
//   • رابط الرجوع للخطة الشاملة

export type RescueStep = 1 | 2 | 3 | 4

interface StepDef {
  key: RescueStep
  label: string
  tool: string
  icon: string
  what: string
  to: (clientId: string) => string
}

const STEPS: StepDef[] = [
  {
    key: 1, label: 'أوقف النزيف', tool: 'خريطة المخاطر', icon: '⚠️',
    what: 'حصر ما يستنزفك الآن — كل خطر باحتماله وأثره وخطّة تخفيفه.',
    to: (id) => `/priority?tab=risk&client=${id}&from=emergency`,
  },
  {
    key: 2, label: 'اُفرز فوراً', tool: 'مصفوفة أيزنهاور', icon: '🎯',
    what: 'رتّب المهام: افعل الآن / خطّط / فوّض / احذف — بلا تشتّت.',
    to: (id) => `/priority?tab=eisenhower&client=${id}&from=emergency`,
  },
  {
    key: 3, label: 'حدّد المسؤول', tool: 'مصفوفة RACI', icon: '👥',
    what: 'لكل مهمّة مسؤول واضح — بلا فراغ ولا ازدواج في المسؤوليّة.',
    to: (id) => `/priority?tab=raci&client=${id}&from=emergency`,
  },
  {
    key: 4, label: 'راقب أسبوعياً', tool: 'مخطّط جانت', icon: '📅',
    what: 'خط زمنيّ لـ١٢ أسبوع — أفعال متسلسلة قابلة للمتابعة.',
    to: (id) => `/execute?tab=gantt&client=${id}&from=emergency`,
  },
]

export function RescueContextBanner({
  currentStep, companyId,
}: { currentStep: RescueStep; companyId: string }) {
  const current = STEPS.find((s) => s.key === currentStep)!
  const next = STEPS.find((s) => s.key === currentStep + 1) ?? null

  return (
    <Card className="overflow-hidden border-2 border-rose-400 bg-gradient-to-l from-rose-50 via-rose-50/50 to-transparent shadow-md">
      <div className="h-1 bg-gradient-to-l from-rose-600 via-rose-500 to-rose-400" />
      <CardContent className="p-4">
        {/* رأس السياق */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xl">🚨</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-rose-400 bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-900">
                خطّة إنقاذ ٩٠ يوم
              </span>
              <span className="text-[10px] font-bold text-rose-700 tabular-nums">
                · الخطوة {currentStep} من ٤
              </span>
            </div>
            <div className="text-[11px] leading-relaxed text-rose-800/80">
              <b className="text-rose-900">{current.icon} {current.tool}</b> — {current.what}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              to={`/manager/strategic-plan?client=${companyId}`}
              className="rounded-md border border-rose-300 bg-white px-2 py-1 text-[10px] font-medium text-rose-700 transition hover:bg-rose-50"
            >
              ← الخطة الشاملة
            </Link>
            {/* خروج مؤقّت من الطوارئ — يزيل `from=emergency` من الـURL ويعيد كل التبويبات */}
            <Link
              to={window.location.pathname + '?client=' + companyId}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 transition hover:bg-slate-50"
              title="أخرج من وضع الطوارئ وأظهر كل التبويبات (للمتقدّمين فقط)"
            >
              👁️ إظهار الكل
            </Link>
          </div>
        </div>

        {/* مؤشّر التسلسل — ٤ دوائر مرقّمة مربوطة بأسهم */}
        <div className="mb-3 flex items-center justify-between gap-1 rounded-lg border border-rose-200 bg-white/60 p-2">
          {STEPS.map((s, i) => {
            const isDone = s.key < currentStep
            const isCurrent = s.key === currentStep
            return (
              <div key={s.key} className="flex flex-1 items-center gap-1">
                <Link
                  to={s.to(companyId)}
                  className={`flex flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] transition ${
                    isCurrent
                      ? 'bg-rose-500 font-bold text-white shadow-sm'
                      : isDone
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'text-rose-800/60 hover:bg-rose-100'
                  }`}
                  title={s.what}
                >
                  <span className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                    isCurrent ? 'bg-white text-rose-700'
                    : isDone ? 'bg-emerald-500 text-white'
                    : 'bg-rose-200 text-rose-700'
                  }`}>
                    {isDone ? '✓' : s.key}
                  </span>
                  <span className="truncate">{s.tool}</span>
                </Link>
                {i < STEPS.length - 1 && (
                  <span className={`text-[10px] ${s.key < currentStep ? 'text-emerald-500' : 'text-rose-300'}`}>←</span>
                )}
              </div>
            )
          })}
        </div>

        {/* الخطوة التالية / إتمام الخطّة */}
        {next ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-rose-300 bg-rose-100/40 p-2">
            <div className="text-[11px] leading-relaxed text-rose-900">
              <b>بعد إتمام هذه الخطوة →</b> انتقل إلى{' '}
              <b>{next.icon} {next.tool}</b> ({next.label}).
            </div>
            <Link
              to={next.to(companyId)}
              className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700"
            >
              الخطوة {next.key} ←
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-emerald-400 bg-emerald-50 p-2">
            <div className="text-[11px] leading-relaxed text-emerald-900">
              🏆 <b>الخطوة الأخيرة —</b> بعد إتمام مخطّط جانت، تكون خطّة الإنقاذ جاهزة للتنفيذ.
            </div>
            <Link
              to={`/manager/strategic-plan?client=${companyId}`}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
            >
              ← عد للخطة الشاملة
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── مُساعد للحصول على الخطوة من التبويب النشط ────────────────────
export function rescueStepFromTab(tab: string | null | undefined): RescueStep | null {
  if (tab === 'risk')       return 1
  if (tab === 'eisenhower') return 2
  if (tab === 'raci')       return 3
  if (tab === 'gantt')      return 4
  return null
}
