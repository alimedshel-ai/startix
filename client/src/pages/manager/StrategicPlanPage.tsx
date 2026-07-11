import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useClientScopedCompany } from '@/hooks/useClientScopedCompany'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_ICON, DEPT_LABEL } from '@/lib/deptApi'
import { getProOverview, type OverviewClient } from '@/lib/proApi'
import {
  PATH_ACCENT_STYLES,
  pickStrategicPath,
  specialtyKPIHints,
  type StrategicPath,
  type StrategicPathKey,
} from '@/lib/strategicPath'
import { useAuthStore } from '@/store/authStore'

// ─── الخطة الاستراتيجية — يختار المدير نوعها (طوارئ/تأسيس/نمو/تميز) ───
// السلوك:
//   • المنصّة تُوصي بمسار افتراضي بناءً على صحّة الإدارة (recommendedPath).
//   • المدير يستطيع تعديل الاختيار — يظهر لأي مسار سبب اختياره لكل حالة.
//   • تحت المسار المختار: أولوياته + مبادراته + KPIs + مخاطر + خارطة زمنيّة
//     + قائمة الأدوات المستخدمة داخل المنصّة لدعم هذا المسار.

// ─── أدوات موصى بها لكل نوع خطة ─────────────────────────────────
// تُوجّه المدير للأداة الصحيحة داخل المنصّة بحسب طبيعة الخطة.
interface RecommendedTool {
  icon: string
  labelAr: string
  to: string
  whyAr: string
}

function toolsForPath(key: StrategicPathKey, companyId: string): RecommendedTool[] {
  const q = `?client=${companyId}`
  const common: RecommendedTool[] = [
    { icon: '💡', labelAr: 'المبادرات', to: `/initiatives${q}`, whyAr: 'كل ما تحتاج تنفيذه — يُحوَّل إلى مشاريع' },
    { icon: '📊', labelAr: 'مؤشرات الأداء (KPIs)', to: `/kpis${q}`, whyAr: 'قياس التقدّم بأرقام محدَّدة' },
  ]
  if (key === 'EMERGENCY') {
    return [
      { icon: '⚠️', labelAr: 'خريطة المخاطر', to: `/risk-map${q}`, whyAr: 'حصر المخاطر الحرجة قبل أي شيء آخر' },
      { icon: '🎯', labelAr: 'مصفوفة أيزنهاور', to: `/eisenhower${q}`, whyAr: 'فرز المهام: افعل الآن / فوّض / احذف' },
      { icon: '👥', labelAr: 'مصفوفة RACI', to: `/raci${q}`, whyAr: 'من مسؤول عن كل تحرّك عاجل — بلا فراغ' },
      { icon: '📅', labelAr: 'مخطّط جانت', to: `/gantt-chart${q}`, whyAr: 'خطّ زمنيّ للأسابيع الـ١٢' },
      ...common,
      { icon: '✍️', labelAr: 'إدخالات KPIs', to: `/kpi-entries${q}`, whyAr: 'قياس أسبوعي لتتبّع التعافي' },
    ]
  }
  if (key === 'FOUNDATION') {
    return [
      { icon: '🎯', labelAr: 'الأهداف الاستراتيجية', to: `/objectives${q}`, whyAr: 'صياغة أهداف SMART أساسيّة' },
      { icon: '⚖️', labelAr: 'Balanced Scorecard', to: `/bsc${q}`, whyAr: 'أساس القياس المتوازن ٤ أبعاد' },
      { icon: '👥', labelAr: 'مصفوفة RACI', to: `/raci${q}`, whyAr: 'وضوح الأدوار — أساس السقف التنظيمي' },
      { icon: '🎯', labelAr: 'الأولوية (أثر × جهد)', to: `/priority-matrix${q}`, whyAr: 'ترتيب المبادرات لبناء الأساسات' },
      ...common,
      { icon: '📁', labelAr: 'المشاريع', to: `/projects${q}`, whyAr: 'تحويل التأسيس إلى مشاريع بمدد ٦ أشهر' },
    ]
  }
  if (key === 'GROWTH') {
    return [
      { icon: '🧭', labelAr: 'التوجّه الاستراتيجي', to: `/directions${q}`, whyAr: 'اختيار اتجاه للنموّ' },
      { icon: '📐', labelAr: 'مصفوفة أنسوف', to: `/ansoff${q}`, whyAr: 'خدمة × جمهور: أين تنمو؟' },
      { icon: '🧩', labelAr: 'نموذج الأعمال Canvas', to: `/bmc${q}`, whyAr: 'إعادة تصميم نموذج عملك' },
      { icon: '🔭', labelAr: 'الآفاق الثلاثة', to: `/three-horizons${q}`, whyAr: 'توزيع المبادرات: نمو اليوم + الغد + المستقبل' },
      { icon: '🧩', labelAr: 'إطار OGSM', to: `/ogsm${q}`, whyAr: 'أهداف/إستراتيجيات/مقاييس متدرّجة' },
      ...common,
      { icon: '🗓️', labelAr: 'الخطة السنويّة', to: `/annual-plan${q}`, whyAr: 'تحويل النموّ إلى خطة سنة كاملة' },
    ]
  }
  if (key === 'EXCELLENCE') {
    return [
      { icon: '🔭', labelAr: 'الآفاق الثلاثة', to: `/three-horizons${q}`, whyAr: 'تركيز على H٣ — رهانات المستقبل' },
      { icon: '🔮', labelAr: 'السيناريوهات', to: `/scenarios${q}`, whyAr: 'استكشاف مسارات متعدّدة للتميّز' },
      { icon: '🔍', labelAr: 'المقارنة المرجعيّة', to: `/benchmarking${q}`, whyAr: 'قياس نضج إدارتك ضد الأفضل' },
      { icon: '⚖️', labelAr: 'Balanced Scorecard', to: `/bsc${q}`, whyAr: 'قياس التميّز في الأبعاد الأربعة' },
      { icon: '📐', labelAr: 'التحليل المالي المتقدّم', to: `/financial-analysis${q}`, whyAr: 'Dupont + Monte Carlo لقيادة القرار' },
      { icon: '🧪', labelAr: 'مختبر المحاكاة', to: `/ai/simulation${q}`, whyAr: 'اختبار سيناريوهات ابتكار' },
      ...common,
    ]
  }
  // DEFAULT
  return [
    { icon: '📋', labelAr: 'التدقيق الأساسي', to: `/manager/dept-deep${q}`, whyAr: 'التقييم السريع لبدء التخطيط' },
    { icon: '🔬', labelAr: 'التحليل العميق', to: `/manager/deep-analysis${q}`, whyAr: 'تحليل ٦٠ سؤالاً لتخصّصك' },
    { icon: '🌐', labelAr: 'PESTEL للإدارة', to: `/manager/dept-pestel${q}`, whyAr: 'مسح البيئة الخارجيّة' },
  ]
}

// ─── سبب اختيار كل مسار ─────────────────────────────────────────
function pathReason(key: StrategicPathKey): string {
  switch (key) {
    case 'EMERGENCY':  return 'صحّة الإدارة أقل من ٤٠٪ أو منطقة خطر حمراء — تحتاج تدخّلاً فورياً قبل التخطيط طويل الأمد.'
    case 'FOUNDATION': return 'صحّة الإدارة بين ٤٠-٥٩٪ — الإجراءات ضعيفة وتحتاج بناء أساسات (SOPs + قياس + أدوار).'
    case 'GROWTH':     return 'صحّة الإدارة بين ٦٠-٧٩٪ — الأساسات موجودة، والفرصة الآن للنموّ وتوسّع الأثر.'
    case 'EXCELLENCE': return 'صحّة الإدارة ٨٠٪+ — إدارتك ناضجة، والوقت مناسب لبناء قيادة قطاعيّة وابتكار.'
    default:           return 'لم يتمّ تدقيق الإدارة بعد — ابدأ بالتشخيص لاختيار المسار الصحيح.'
  }
}

// جميع المسارات الممكن اختيارها (ما عدا DEFAULT).
const SELECTABLE_KEYS: StrategicPathKey[] = ['EMERGENCY', 'FOUNDATION', 'GROWTH', 'EXCELLENCE']

// نُنشئ نسخة من كل مسار للعرض في المُبدّل.
function allPaths(): Record<StrategicPathKey, StrategicPath> {
  return {
    EMERGENCY:  pickStrategicPath({ healthPct: 20, dangerZone: 'RED', hasAnyAudit: true }),
    FOUNDATION: pickStrategicPath({ healthPct: 50, dangerZone: 'ORANGE', hasAnyAudit: true }),
    GROWTH:     pickStrategicPath({ healthPct: 70, dangerZone: 'YELLOW', hasAnyAudit: true }),
    EXCELLENCE: pickStrategicPath({ healthPct: 85, dangerZone: 'GREEN', hasAnyAudit: true }),
    DEFAULT:    pickStrategicPath({ healthPct: null, dangerZone: null, hasAnyAudit: false }),
  }
}

export function StrategicPlanPage() {
  const user = useAuthStore((s) => s.user)
  const scope = useClientScopedCompany()
  const [client, setClient] = useState<OverviewClient | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // اختيار المدير — يُهيّأ لأول مرّة من التوصية.
  const [selectedKey, setSelectedKey] = useState<StrategicPathKey | null>(null)

  useEffect(() => {
    if (!scope.companyId) return
    let alive = true
    setLoading(true)
    setError(null)
    getProOverview()
      .then((res) => {
        if (!alive) return
        const found = res.clients.find((c) => c.companyId === scope.companyId) ?? null
        setClient(found)
        if (!found) setError('لم نجد هذا العميل في قائمتك.')
      })
      .catch((err) => {
        if (!alive) return
        setError(apiErrorMessage(err, 'تعذّر تحميل الخطة'))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => { alive = false }
  }, [scope.companyId])

  const paths = useMemo(() => allPaths(), [])

  const recommendedPath = useMemo<StrategicPath | null>(() => {
    if (!client) return null
    return pickStrategicPath({
      healthPct: client.healthPct,
      dangerZone: client.dangerZone,
      hasAnyAudit: client.hasAnyAudit,
    })
  }, [client])

  // عند تحميل العميل لأول مرة — نُطابق اختيار المدير مع التوصية.
  useEffect(() => {
    if (recommendedPath && !selectedKey) setSelectedKey(recommendedPath.key)
  }, [recommendedPath, selectedKey])

  if (scope.loading || loading) {
    return <LoadingSpinner fullPage label="جاري إعداد الخطة الاستراتيجية…" />
  }

  if (error || !client) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="الخطة الاستراتيجية" />
        <EmptyState
          title={error ?? 'اختر عميلاً أوّلاً'}
          description="افتح لوحة العميل من «عملائي» ثم اختر «الخطة الاستراتيجية»."
          action={
            <Link to="/manager/clients" className="rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-accent">
              الذهاب لعملائي
            </Link>
          }
        />
      </div>
    )
  }

  const path = selectedKey ? paths[selectedKey] : recommendedPath!
  const style = PATH_ACCENT_STYLES[path.accent]
  const specialty = user?.specialtyDeptType ?? client.specialty
  const specialtyLabel = specialty ? DEPT_LABEL[specialty] : 'الإدارة'
  const kpiHints = specialtyKPIHints(specialty)
  const tools = toolsForPath(path.key, client.companyId)
  const isRecommended = recommendedPath?.key === path.key

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`الخطة الاستراتيجية — ${client.companyName}`}
        description={`إدارة ${specialtyLabel} · مدّة الخطة ${path.duration}`}
        breadcrumbs={[
          { label: 'عملائي', to: '/manager/clients' },
          { label: client.companyName, to: `/manager/clients/${client.companyId}` },
          { label: 'الخطة' },
        ]}
      />

      {/* بطاقة تعريف */}
      <Card className="border-primary/20 bg-gradient-to-l from-primary/5 to-transparent">
        <CardContent className="p-4 text-xs leading-relaxed">
          <div className="flex items-start gap-3">
            <div className="text-2xl leading-none">🗺️</div>
            <div className="flex-1">
              <div className="text-sm font-bold text-foreground">لكل حالة نوع خطة يناسبها</div>
              <p className="mt-1 text-muted-foreground">
                المنصّة تُوصي بمسار بناءً على صحّة الإدارة الحالية، لكن <b className="text-foreground">القرار لك</b>.
                اختر بين ٤ خطط: 🚨 عاجلة (٩٠ يوم) · 🌱 تأسيسيّة (٦ أشهر) · 🚀 نموّ (١٢ شهر) · 🏆 تميّز (١٨ شهر).
              </p>
              <p className="mt-1 text-muted-foreground">
                كل خطة تعرض <b className="text-foreground">الأدوات الفعليّة داخل المنصّة</b> التي تدعمها.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* مُبدّل نوع الخطة */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">🎯 اختر نوع الخطة</CardTitle>
          <CardDescription>
            المنصّة تُوصي بـ <b className="text-foreground">{recommendedPath?.shortName}</b> بناءً على صحّة إدارتك
            ({client.healthPct != null ? `${client.healthPct}٪` : 'بلا تدقيق'}) — لكن يمكنك اختيار مسار آخر.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-4">
          {SELECTABLE_KEYS.map((k) => {
            const p = paths[k]
            const s = PATH_ACCENT_STYLES[p.accent]
            const isSelected = selectedKey === k
            const isRec = recommendedPath?.key === k
            return (
              <button
                key={k}
                type="button"
                onClick={() => setSelectedKey(k)}
                className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-right transition ${
                  isSelected ? `${s.border} ${s.bg} shadow-md ring-2 ${s.ring}` : `${s.border} bg-card hover:shadow`
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-2xl">{p.icon}</span>
                  {isRec && (
                    <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${s.chip}`}>
                      ⭐ توصية
                    </span>
                  )}
                </div>
                <div className={`text-sm font-bold ${s.text}`}>{p.shortName}</div>
                <div className="text-[10px] text-muted-foreground">{p.duration}</div>
                <div className="text-[10px] leading-relaxed text-muted-foreground line-clamp-2">
                  {p.urgencyLabel}
                </div>
                {isSelected && <div className="mt-1 text-[10px] font-medium text-primary">✓ مُختار</div>}
              </button>
            )
          })}
        </CardContent>
        {/* سبب توصية المسار المُختار */}
        <CardContent className="pt-0">
          <div className={`rounded-lg border-2 border-dashed p-3 text-xs ${
            isRecommended ? 'border-emerald-300 bg-emerald-50/40' : 'border-amber-300 bg-amber-50/40'
          }`}>
            <b className="text-foreground">
              {isRecommended ? '⭐ لماذا نوصي بهذا المسار؟' : 'ℹ️ ملاحظة — هذا ليس المسار الموصى به'}
            </b>
            <p className="mt-0.5 text-muted-foreground">{pathReason(path.key)}</p>
            {!isRecommended && recommendedPath && (
              <button
                type="button"
                onClick={() => setSelectedKey(recommendedPath.key)}
                className="mt-1 text-[10px] text-primary underline-offset-2 hover:underline"
              >
                عد إلى التوصية «{recommendedPath.shortName}» ←
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* رأس المسار المختار */}
      <Card className={`overflow-hidden ${style.border} ${style.bg}`}>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="text-6xl leading-none" aria-hidden>{path.icon}</span>
              <div>
                <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${style.chip}`}>
                  {path.urgencyLabel}
                </span>
                <h2 className={`mt-1 text-2xl font-bold ${style.text}`}>{path.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  مدّة الخطة {path.duration} · لإدارة {DEPT_ICON[specialty!]} {specialtyLabel} في {client.companyName}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">صحة الإدارة</div>
              <div className={`text-4xl font-bold tabular-nums ${style.text}`}>
                {client.healthPct != null ? `${client.healthPct}٪` : '—'}
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed">{path.description}</p>
        </CardContent>
      </Card>

      {/* 🛠️ الأدوات الفعليّة التي تدعم هذا المسار */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🛠️ الأدوات المستخدمة في هذه الخطة</CardTitle>
          <CardDescription>
            {tools.length} أداة داخل المنصّة مُختارة خصيصاً لمسار {path.shortName}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="flex items-start gap-2 rounded-lg border bg-card p-3 transition hover:-translate-y-0.5 hover:shadow"
              >
                <span className="text-xl leading-none">{t.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{t.labelAr}</div>
                  <div className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{t.whyAr}</div>
                </div>
                <span className="text-xs text-primary">←</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* الأولويات */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🎯 الأولويات — ما يجب التركيز عليه</CardTitle>
          <CardDescription>مرتّبة حسب الأثر على مسار {path.shortName}.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-2 text-sm">
            {path.priorities.map((p, i) => (
              <li key={i} className="flex items-start gap-3 rounded-md border bg-card p-3">
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${style.chip}`}>
                  {i + 1}
                </span>
                <span className="flex-1 leading-relaxed">{p}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* المبادرات المقترحة */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">💡 المبادرات المقترحة</CardTitle>
          <CardDescription>مبادرات ملموسة تفعّلها من صفحة "المبادرات".</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {path.initiatives.map((it, i) => (
              <li key={i} className="rounded-md border bg-card p-3 leading-relaxed">
                {it}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-end">
            <Link
              to={`/initiatives?client=${client.companyId}`}
              className="text-xs text-primary underline-offset-4 hover:underline"
            >
              افتح صفحة المبادرات ←
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📊 مؤشرات الأداء الموصى بها</CardTitle>
          <CardDescription>
            مقترحات لمسار {path.shortName}
            {kpiHints.length > 0 ? ' + معايير خاصّة بتخصّصك' : ''}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-semibold text-muted-foreground">لهذا المسار</div>
              <ul className="grid gap-1.5 text-sm">
                {path.suggestedKPIs.map((k) => (
                  <li key={k} className="rounded-md border bg-card px-3 py-2">📈 {k}</li>
                ))}
              </ul>
            </div>
            {kpiHints.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold text-muted-foreground">
                  خاصّة بتخصّصك ({specialtyLabel})
                </div>
                <ul className="grid gap-1.5 text-sm">
                  {kpiHints.map((k) => (
                    <li key={k} className="rounded-md border bg-card px-3 py-2">⚡ {k}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="mt-3 flex justify-end">
            <Link
              to={`/kpis?client=${client.companyId}`}
              className="text-xs text-primary underline-offset-4 hover:underline"
            >
              افتح صفحة KPIs ←
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* المخاطر */}
      <Card className="border-amber-200 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-base">⚠️ مخاطر ينبغي الانتباه لها</CardTitle>
          <CardDescription>راقب هذه المؤشرات أثناء تنفيذ الخطة.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm">
            {path.risks.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span aria-hidden>⚠️</span>
                <span className="flex-1 leading-relaxed">{r}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* خارطة زمنية */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🗓️ خارطة زمنية مقترحة</CardTitle>
          <CardDescription>ملخص المراحل الرئيسية للـ{path.duration}.</CardDescription>
        </CardHeader>
        <CardContent>
          <Timeline days={path.durationDays} pathName={path.shortName} accent={style.chip} />
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="flex flex-wrap justify-end gap-3">
        <Link
          to={`/annual-plan?client=${client.companyId}`}
          className="rounded-md border bg-card px-4 py-2 text-sm hover:bg-accent"
        >
          خطة سنوية مفصّلة
        </Link>
        <Link
          to={`/manager/clients/${client.companyId}`}
          className={`rounded-md px-4 py-2 text-sm ${style.chip} hover:opacity-90`}
        >
          عودة إلى لوحة العميل
        </Link>
      </div>
    </div>
  )
}

// ─── خارطة زمنية بسيطة ─────────────────────────────────────────────

function Timeline({
  days, pathName, accent,
}: { days: number; pathName: string; accent: string }) {
  const phases = phaseLabels(days, pathName)
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {phases.map((p, i) => (
        <div key={i} className="rounded-lg border bg-card p-3">
          <div className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${accent}`}>
            المرحلة {i + 1}
          </div>
          <div className="mt-2 text-xs font-semibold text-muted-foreground">{p.range}</div>
          <div className="mt-1 text-sm font-medium">{p.title}</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.desc}</p>
        </div>
      ))}
    </div>
  )
}

function phaseLabels(days: number, pathName: string): { range: string; title: string; desc: string }[] {
  void pathName
  if (days <= 90) {
    return [
      { range: 'أسبوع ١',       title: 'التحرّك الفوري',  desc: 'تحديد المشاكل الحرجة وإيقاف النزيف.' },
      { range: 'أسبوع ٢-٤',     title: 'الاستقرار',       desc: 'استعادة العمليات الأساسية.' },
      { range: 'أسبوع ٥-٨',     title: 'التعافي',         desc: 'بناء إجراءات وقائية.' },
      { range: 'أسبوع ٩-١٢',    title: 'التحوّل',        desc: 'الانتقال لخطة تأسيسية طويلة.' },
    ]
  }
  if (days <= 180) {
    return [
      { range: 'شهر ١',         title: 'الترتيب والتوثيق', desc: 'رسم الوضع الحالي وتحديد الفجوات.' },
      { range: 'شهر ٢-٣',       title: 'البناء',           desc: 'إنشاء SOPs وأنظمة قياس.' },
      { range: 'شهر ٤-٥',       title: 'التطبيق',         desc: 'تدريب الفريق وتفعيل الأنظمة.' },
      { range: 'شهر ٦',         title: 'المراجعة',         desc: 'قياس الأثر وتعديل الخطة.' },
    ]
  }
  if (days <= 365) {
    return [
      { range: 'ربع ١',         title: 'التخطيط',          desc: 'مراجعة الأداء وتحديد فرص النمو.' },
      { range: 'ربع ٢',         title: 'التسريع',         desc: 'أتمتة وتوسّع مبكر.' },
      { range: 'ربع ٣',         title: 'التوسّع',          desc: 'إطلاق ٢-٣ مبادرات ابتكار.' },
      { range: 'ربع ٤',         title: 'التقييم',          desc: 'مراجعة النتائج وتخطيط العام التالي.' },
    ]
  }
  return [
    { range: 'أشهر ١-٤',    title: 'التأسيس المتقدّم', desc: 'مراجعة الوضع وإطلاق مبادرات الابتكار.' },
    { range: 'أشهر ٥-٩',    title: 'الاعتماد',          desc: 'العمل نحو شهادات قطاعية.' },
    { range: 'أشهر ١٠-١٤',  title: 'التميّز',           desc: 'مشاركة أفضل الممارسات.' },
    { range: 'أشهر ١٥-١٨',  title: 'القيادة',            desc: 'بناء علامة تجارية للإدارة.' },
  ]
}
