import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { PathBadge, pathLabel } from '@/components/PathBadge'
import { RadarChart } from '@/components/charts/RadarChart'
import { api } from '@/lib/api'
import type { OwnerDiagnosticResult, StrategicPath } from '@/lib/diagnosticQuestions'
import { useDiagnosticStore } from '@/store/diagnosticStore'

const PATH_LABEL_BY_KEY: Record<StrategicPath, string> = {
  EMERGENCY_RISK: 'إنقاذ / خطر',
  NASCENT_CAUTIOUS: 'نشأة / حذر',
  GROWING_CHAOTIC: 'نمو / فوضى',
  MATURE_COMPETITIVE: 'نضج / تنافسية',
  DEFAULT_STRATEGIC: 'مسار افتراضي',
}

const AXIS_LABEL_AR: Record<string, string> = {
  Governance: 'الحوكمة',
  Financial: 'المالية',
  Team: 'الفريق',
  Digital: 'الرقمي',
}

const SCENARIO_LABEL: Record<string, string> = {
  optimistic: 'سيناريو متفائل',
  pessimistic: 'سيناريو متشائم',
}

export function DiagnosticResultPage() {
  const storeResult = useDiagnosticStore((s) => s.ownerResult)
  const setResult = useDiagnosticStore((s) => s.setOwnerResult)
  const reset = useDiagnosticStore((s) => s.reset)
  const [loading, setLoading] = useState(!storeResult)

  useEffect(() => {
    if (storeResult) {
      setLoading(false)
      return
    }
    let cancel = false
    api.get<{ result: OwnerDiagnosticResult | null }>('/api/diagnostic/me/latest')
      .then(({ data }) => {
        if (cancel) return
        if (data.result) setResult(data.result)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancel) setLoading(false)
      })
    return () => { cancel = true }
  }, [storeResult, setResult])

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="نتيجة التشخيص" />
        <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>
      </div>
    )
  }

  if (!storeResult) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="نتيجة التشخيص" />
        <EmptyState
          title="لا توجد نتيجة تشخيص بعد"
          description="شغّل تشخيص المالك أولاً لمعرفة مسارك الاستراتيجي وخريطة الطريق."
          action={
            <Link to="/diagnostic/owner" className={buttonVariants()}>
              ابدأ تشخيص المالك
            </Link>
          }
        />
      </div>
    )
  }

  const result = storeResult
  const radarTranslated = result.radarData.map((r) => ({ axis: AXIS_LABEL_AR[r.axis] ?? r.axis, value: r.value }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="نتيجة التشخيص"
        description="المسار الاستراتيجي، نضجك، الرسم الراداري، وأهم 4 إجراءات عاجلة."
        actions={<Button variant="ghost" onClick={reset}>إعادة التشخيص</Button>}
      />

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="overflow-hidden bg-gradient-to-bl from-primary/10 to-transparent md:col-span-5">
          <div className="h-1 bg-gradient-to-l from-primary to-violet-500" />
          <CardHeader>
            <CardDescription>المسار الاستراتيجي الموصى به</CardDescription>
            <CardTitle className="flex items-center gap-3">
              <PathBadge path={result.strategicPath} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-4xl font-bold tabular-nums text-primary">{result.maturityScore}</div>
              <div className="text-sm text-muted-foreground">/ 100 درجة النضج</div>
            </div>
            <ul className="mt-4 grid gap-1.5 text-xs">
              {(['EMERGENCY_RISK', 'NASCENT_CAUTIOUS', 'GROWING_CHAOTIC', 'MATURE_COMPETITIVE'] as const).map((k) => (
                <li key={k} className="flex justify-between">
                  <span className="text-muted-foreground">{PATH_LABEL_BY_KEY[k]}</span>
                  <span className="tabular-nums font-medium">{result.pathScores[k]}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-500/5 to-indigo-500/5 md:col-span-7">
          <CardHeader>
            <CardTitle>رسم القدرات الراداري</CardTitle>
            <CardDescription>الحوكمة · المالية · الفريق · الرقمي — كل محور 0–100.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadarChart data={radarTranslated} />
          </CardContent>
        </Card>

        <Card className="border-rose-200 bg-gradient-to-br from-rose-500/5 to-transparent md:col-span-6">
          <CardHeader>
            <CardTitle>أبرز نقاط الضعف</CardTitle>
            <CardDescription>الأبعاد الأقل تقييماً — ابدأ بها.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3">
              {result.weaknesses.map((w) => (
                <li key={w.key} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm">
                  <span>{w.label}</span>
                  <span className="tabular-nums text-muted-foreground">{w.pct}%</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-500/5 to-transparent md:col-span-6">
          <CardHeader>
            <CardTitle>إجراءات عاجلة</CardTitle>
            <CardDescription>4 خطوات تنفّذها في الـ 90 يوم القادمة.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3 text-sm">
              {result.roadmap.map((a, i) => (
                <li key={`${a.source}-${i}`} className="rounded-xl border bg-card p-3">
                  <span className="ml-2 inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                  <span className="font-medium">{a.title}.</span>{' '}
                  <span className="text-muted-foreground">{a.detail}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card className="md:col-span-12">
          <CardHeader>
            <CardTitle>معاينة السيناريوهات</CardTitle>
            <CardDescription>
              نتيجتان محتملتان لمسار {pathLabel(result.strategicPath)}.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {result.scenarios.map((s) => (
              <div key={s.name} className="rounded-xl border bg-gradient-to-br from-card to-primary/5 p-4">
                <div className="text-xs uppercase tracking-wider text-primary">{SCENARIO_LABEL[s.name] ?? s.name}</div>
                <div className="mt-1 font-semibold">{s.headline}</div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
