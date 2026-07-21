import { Link, useParams } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useJourney, type JourneyStepView } from '@/hooks/useJourney'
import { JOURNEY_STAGES } from '@/lib/journeyStages'

// ─── القمرة الموجّهة (C3) — مكان واحد لتشغيل مسار العميل ──────────────
// URL: /manager/clients/:companyId/run
// تعيد استخدام useJourney (بيانات حقيقيّة: artifacts/SWOT/KPIs) وتتبنّى شكل
// «القمرة»: خطّ زمني جانبيّ + لوحة تركيز واحدة «التالي». الأدوات تبقى صفحات
// حقيقيّة (زرّ ينتقل إليها) — لا نماذج داخليّة، فلا فقدان بيانات.
//   • حالات صريحة: عمل (available) · مكتمل (done) · مقفلة (locked).
//   • صفر لمس للمحرّك — طبقة عرض فوق useJourney فقط.

const STAGE_ICON: Record<string, string> = Object.fromEntries(
  JOURNEY_STAGES.map((s) => [s.id, s.icon]),
)

function ar(n: number): string {
  return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d])
}

export function RunCockpitPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const cid = companyId ?? null
  const clientQuery = cid ? `?client=${cid}` : ''
  const { loading, path, steps, total, currentIndex, progressPct, nextStage } = useJourney(cid)

  if (!cid) {
    return <EmptyState title="لا عميل محدّد" description="افتح القمرة من صفحة عميل." icon={<span className="text-4xl">👥</span>} />
  }
  if (loading && steps.length === 0) {
    return <div className="flex justify-center py-16"><LoadingSpinner size="lg" label="جاري تحميل المسار…" /></div>
  }

  const done = !nextStage
  const nextLocked = nextStage?.status === 'locked'

  return (
    <div className="flex flex-col gap-4 lg:flex-row" dir="rtl">
      {/* ─── الخطّ الزمنيّ الجانبيّ ─── */}
      <aside className="lg:w-72 lg:shrink-0">
        <div className="sticky top-4 rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-sm font-bold">🧭 {path.labelAr}</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
              {currentIndex > 0 ? ar(currentIndex) : '—'} / {ar(total)}
            </span>
          </div>
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">{path.taglineAr}</p>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
          </div>

          <ol className="relative space-y-1">
            <div aria-hidden className="absolute bottom-3 right-[15px] top-3 w-px bg-border" />
            {steps.map((step) => (
              <TimelineStep
                key={step.stageId}
                step={step}
                icon={STAGE_ICON[step.stageId] ?? '•'}
                isNext={step.stageId === nextStage?.stageId}
                clientQuery={clientQuery}
              />
            ))}
          </ol>

          <Link to={`/manager/clients/${cid}`} className="mt-4 block text-center text-[11px] text-muted-foreground underline-offset-4 hover:underline">
            ← رجوع لصفحة العميل
          </Link>
        </div>
      </aside>

      {/* ─── لوحة التركيز: الخطوة الواحدة التالية ─── */}
      <main className="flex-1">
        {done ? (
          <div className="flex flex-col items-center rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 p-12 text-center">
            <span className="mb-4 text-6xl">🏁</span>
            <h2 className="mb-2 text-2xl font-bold text-emerald-900">اكتمل مسارك!</h2>
            <p className="mb-6 max-w-md text-emerald-800/80">أنجزت كل مراحل خطّتك. تابِع التنفيذ وراقب المؤشّرات دوريّاً.</p>
            <Link to={`/execute${clientQuery}`} className="rounded-lg bg-emerald-600 px-6 py-2.5 font-medium text-white shadow-sm hover:opacity-90">
              🚀 مركز التنفيذ والمتابعة ←
            </Link>
          </div>
        ) : nextLocked ? (
          <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/60 p-12 text-center">
            <span className="mb-4 text-5xl">🔒</span>
            <h2 className="mb-2 text-xl font-bold text-amber-900">الخطوة التالية مقفلة</h2>
            <p className="mb-6 max-w-md text-amber-800/80">
              «{nextStage?.titleAr}» تحتاج إكمال مرحلة سابقة أوّلاً. أكمل أقرب مرحلة متاحة من الخطّ الزمنيّ لفتحها.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* البطاقة القائدة — إجراء واحد واضح */}
            <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-l from-primary/10 to-transparent p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-primary">الخطوة التالية</div>
              <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold">
                <span aria-hidden>{STAGE_ICON[nextStage!.stageId] ?? '🎯'}</span>
                {nextStage!.titleAr}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{nextStage!.emphasisAr}</p>

              {nextStage!.tools.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1.5 text-[11px] font-semibold text-muted-foreground">ماذا ستفعل هنا:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {nextStage!.tools.map((t) => (
                      <span key={t} className="rounded-full border bg-card px-2.5 py-0.5 text-[11px]">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              <Link
                to={`${nextStage!.href}${clientQuery}`}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-base font-bold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:opacity-90"
              >
                افتحها الآن ←
              </Link>
            </div>

            {/* لماذا هذه الخطوة الآن — سياق موجز */}
            <div className="flex items-start gap-3 rounded-xl border bg-card/60 p-4">
              <span className="mt-0.5 text-lg">ℹ️</span>
              <p className="text-xs leading-relaxed text-muted-foreground">
                المسار يمشي بالترتيب — كل مرحلة تُغذّي التالية بالبيانات. أكمل هذه الخطوة، ثم ستحدّث القمرة تلقائيّاً
                إلى ما بعدها. أنجزتَ <b className="text-foreground">{ar(progressPct)}٪</b> من مسارك.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// ─── عنصر الخطّ الزمنيّ ─────────────────────────────────────────────
function TimelineStep({
  step, icon, isNext, clientQuery,
}: {
  step: JourneyStepView
  icon: string
  isNext: boolean
  clientQuery: string
}) {
  const locked = step.status === 'locked'
  const done = step.status === 'done'

  let dotCls = 'bg-card border-border text-muted-foreground'
  if (done) dotCls = 'bg-emerald-500 border-emerald-500 text-white'
  else if (isNext) dotCls = 'bg-primary border-primary text-primary-foreground ring-4 ring-primary/15'
  else if (locked) dotCls = 'bg-muted border-border text-muted-foreground/50'

  const label = (
    <div className="flex items-center gap-2.5">
      <span className={`z-10 flex size-[30px] shrink-0 items-center justify-center rounded-full border-2 text-xs ${dotCls}`}>
        {done ? '✓' : locked ? '🔒' : icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-sm ${isNext ? 'font-bold text-primary' : done ? 'font-medium' : 'text-muted-foreground'}`}>
          {step.titleAr}
        </div>
        {isNext && <div className="text-[10px] font-medium text-primary">⭐ ابدأ الآن</div>}
      </div>
    </div>
  )

  // المقفلة غير قابلة للنقر؛ الباقي ينتقل لصفحة الأداة.
  if (locked) {
    return <li className="cursor-not-allowed rounded-lg p-1.5 opacity-60">{label}</li>
  }
  return (
    <li>
      <Link to={`${step.href}${clientQuery}`} className={`block rounded-lg p-1.5 transition hover:bg-accent/50 ${isNext ? 'bg-primary/5' : ''}`}>
        {label}
      </Link>
    </li>
  )
}
