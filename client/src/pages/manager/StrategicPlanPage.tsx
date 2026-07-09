import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useClientScopedCompany } from '@/hooks/useClientScopedCompany'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_ICON, DEPT_LABEL } from '@/lib/deptApi'
import {
  PATH_ACCENT_STYLES,
  pickStrategicPath,
  specialtyKPIHints,
} from '@/lib/strategicPath'
import { getProOverview, type OverviewClient } from '@/lib/proApi'
import { useAuthStore } from '@/store/authStore'

// ─── الخطة الاستراتيجية الكاملة للإدارة على مستوى عميل ─────────────────
// المسار: /manager/strategic-plan?client=<id>.
// تعرض:
//   • رأس المسار مع مدّته وأولوياته
//   • أولويات محدّدة
//   • مبادرات مقترحة (٣-٥)
//   • KPIs موصى بها (عامّة + مخصّصة للتخصّص)
//   • مخاطر تنبيهية
//   • خارطة زمنية بسيطة (ربع/شهر/أسبوع)

export function StrategicPlanPage() {
  const user = useAuthStore((s) => s.user)
  const scope = useClientScopedCompany()
  const [client, setClient] = useState<OverviewClient | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const path = pickStrategicPath({
    healthPct: client.healthPct,
    dangerZone: client.dangerZone,
    hasAnyAudit: client.hasAnyAudit,
  })
  const style = PATH_ACCENT_STYLES[path.accent]
  const specialty = user?.specialtyDeptType ?? client.specialty
  const specialtyLabel = specialty ? DEPT_LABEL[specialty] : 'الإدارة'
  const kpiHints = specialtyKPIHints(specialty)

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

      {/* رأس المسار */}
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

      {/* خارطة زمنية بسيطة */}
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
  // نُقسم على ٤ مراحل نسبية (بغض النظر عن المدّة).
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
  // نمنح لكل مسار أربع مراحل مناسبة له.
  if (days <= 90) {
    // مسار الطوارئ ٩٠ يوماً
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
  // ١٨ شهراً
  return [
    { range: 'أشهر ١-٤',    title: 'التأسيس المتقدّم', desc: 'مراجعة الوضع وإطلاق مبادرات الابتكار.' },
    { range: 'أشهر ٥-٩',    title: 'الاعتماد',          desc: 'العمل نحو شهادات قطاعية.' },
    { range: 'أشهر ١٠-١٤',  title: 'التميّز',           desc: 'مشاركة أفضل الممارسات.' },
    { range: 'أشهر ١٥-١٨',  title: 'القيادة',            desc: 'بناء علامة تجارية للإدارة.' },
  ]
}
