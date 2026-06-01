import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiErrorMessage } from '@/lib/api'
import {
  deleteReport, generateReport, getReport, listReports,
  type Report, type ReportSummary, type ReportType,
} from '@/lib/reportsApi'

const REPORT_META: Record<ReportType, { title: string; desc: string; icon: string; accent: string }> = {
  strategic:  { title: 'التقرير الاستراتيجي', desc: 'تشخيص + SWOT + TOWS + الاتجاه + الأهداف + المؤشرات.', icon: '🧭', accent: 'from-violet-500 via-fuchsia-500 to-rose-500' },
  compliance: { title: 'تقرير الامتثال',      desc: 'نتائج التدقيق، مناطق الخطر، مصفوفة المخاطر، الغرامات، خطة الإصلاح.', icon: '⚖️', accent: 'from-rose-500 via-orange-500 to-amber-500' },
  department: { title: 'تقرير الإدارات',      desc: 'تقييم الإدارات + مؤشراتها + التوصيات والمقارنات.', icon: '🏢', accent: 'from-indigo-500 via-sky-500 to-teal-500' },
  annual:     { title: 'الخطة السنوية',       desc: 'كل الأهداف والمبادرات والمشاريع لهذه السنة.',     icon: '🗓️', accent: 'from-amber-500 via-yellow-500 to-emerald-500' },
  executive:  { title: 'الملخص التنفيذي',     desc: 'صفحتان: الصحة، أهم المخاطر، أهم الفرص، القرارات.', icon: '📋', accent: 'from-emerald-500 via-teal-500 to-sky-500' },
}

const TYPE_LABEL: Record<string, string> = {
  strategic: 'استراتيجي', compliance: 'امتثال', department: 'إدارات', annual: 'خطة سنوية', executive: 'ملخص تنفيذي',
}

export function ReportsPage() {
  return (
    <StrategicShell
      title="التقارير"
      description="أنشئ تقارير منسّقة من بيانات شركتك الحالية، واطبعها كملف PDF أو احفظها للرجوع."
    >
      {(companyId) => <Inner companyId={companyId} />}
    </StrategicShell>
  )
}

function Inner({ companyId }: { companyId: string }) {
  const [reports, setReports] = useState<ReportSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<ReportType | null>(null)
  const [opened, setOpened] = useState<Report | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  useEffect(() => {
    listReports(companyId).then(setReports).catch(() => undefined).finally(() => setLoading(false))
  }, [companyId])

  async function generate(type: ReportType) {
    setGenerating(type)
    try {
      const r = await generateReport({ companyId, type })
      setReports((p) => [{ id: r.id, type: r.type, title: r.title, fileUrl: r.fileUrl, createdAt: r.createdAt }, ...p])
      setOpened(r)
      toast.success('تم توليد التقرير')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل التوليد'))
    } finally {
      setGenerating(null)
    }
  }

  async function open(id: string) {
    setOpeningId(id)
    try {
      const r = await getReport(id)
      setOpened(r)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الفتح'))
    } finally {
      setOpeningId(null)
    }
  }

  async function remove(id: string) {
    if (!confirm('حذف هذا التقرير؟')) return
    try {
      await deleteReport(id)
      setReports((p) => p.filter((r) => r.id !== id))
      if (opened?.id === id) setOpened(null)
      toast.success('تم الحذف')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحذف'))
    }
  }

  function downloadJson() {
    if (!opened) return
    const blob = new Blob([JSON.stringify(opened.data, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${opened.title.replace(/\s+/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function openPrintTab() {
    if (!opened) return
    window.open(`/reports/${opened.id}/print`, '_blank', 'noopener,noreferrer')
  }

  async function downloadExcel() {
    if (!opened) return
    try {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:5001'
      const res = await fetch(`${base}/api/reports/${opened.id}/excel`, { credentials: 'include' })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${opened.title.replace(/\s+/g, '-')}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('تم تنزيل الملف')
    } catch (err) {
      toast.error((err as Error).message || 'فشل التنزيل')
    }
  }

  return (
    <>
      <Card className="overflow-hidden bg-gradient-to-bl from-orange-500/10 via-amber-500/5 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-orange-500 via-amber-500 to-yellow-500" />
        <CardHeader>
          <CardTitle>أنشئ تقرير جديد</CardTitle>
          <CardDescription>اختر النوع — يُولّد فوراً من بيانات شركتك ويُحفظ في الأرشيف.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(REPORT_META) as ReportType[]).map((t) => {
              const meta = REPORT_META[t]
              const isBusy = generating === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => generate(t)}
                  disabled={generating !== null}
                  className="group relative overflow-hidden rounded-2xl border bg-card p-4 text-right transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
                >
                  <div className={`pointer-events-none absolute -left-4 -top-4 size-20 rounded-full bg-gradient-to-bl ${meta.accent} opacity-20 blur-2xl transition group-hover:opacity-40`} />
                  <div className="relative">
                    <div className="mb-2 text-3xl">{meta.icon}</div>
                    <div className="text-sm font-semibold">{meta.title}</div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{meta.desc}</p>
                    {isBusy && <p className="mt-2 text-xs text-primary">جاري التوليد…</p>}
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الأرشيف</CardTitle>
          <CardDescription>{reports.length} تقرير محفوظ.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">جاري التحميل…</p>}
          {!loading && reports.length === 0 && (
            <p className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              لا توجد تقارير. أنشئ أول تقرير من الأعلى.
            </p>
          )}
          <ul className="space-y-2 text-sm">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-md border bg-muted/50 px-2 py-0.5 text-[10px] uppercase">{TYPE_LABEL[r.type] ?? r.type}</span>
                  <span className="font-medium">{r.title}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">{new Date(r.createdAt).toLocaleDateString('ar-SA')}</span>
                  <Button variant="outline" size="sm" onClick={() => open(r.id)} disabled={openingId === r.id}>
                    {openingId === r.id ? 'فتح…' : 'عرض'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>حذف</Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {opened && (
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-gradient-to-l from-primary via-violet-500 to-fuchsia-500" />
          <CardHeader className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>{opened.title}</CardTitle>
              <CardDescription>
                {TYPE_LABEL[opened.type] ?? opened.type} · {new Date(opened.createdAt).toLocaleString('ar-SA')}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={openPrintTab}>
                📄 تنزيل PDF
              </Button>
              <Button variant="outline" size="sm" onClick={downloadExcel}>
                📊 Excel
              </Button>
              <Button variant="outline" size="sm" onClick={downloadJson}>
                JSON
              </Button>
              <a
                href="/ai/presentation"
                className="inline-flex h-8 items-center rounded-md border bg-card px-3 text-xs transition hover:bg-accent"
              >
                🎞️ عرض تقديمي
              </a>
              <Button variant="ghost" size="sm" onClick={() => setOpened(null)}>إغلاق</Button>
            </div>
          </CardHeader>
          <CardContent>
            <ReportBody type={opened.type as ReportType} data={opened.data} />
          </CardContent>
        </Card>
      )}
    </>
  )
}

type AnyRec = Record<string, unknown>

function ReportBody({ type, data }: { type: ReportType; data: unknown }) {
  const d = (data ?? {}) as AnyRec
  switch (type) {
    case 'executive':  return <ExecutiveBody d={d} />
    case 'strategic':  return <StrategicBody d={d} />
    case 'compliance': return <ComplianceBody d={d} />
    case 'department': return <DepartmentBody d={d} />
    case 'annual':     return <AnnualBody d={d} />
    default: return <pre className="overflow-x-auto rounded-md bg-muted/30 p-3 text-xs">{JSON.stringify(d, null, 2)}</pre>
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="text-sm">{children}</div>
    </section>
  )
}

function ExecutiveBody({ d }: { d: AnyRec }) {
  const company = d.company as { name?: string; sector?: string; size?: string; stage?: string } | null
  const top = (d.topWeaknesses as { label: string; pct: number }[] | undefined) ?? []
  const k = d.kpiSummary as { total: number; onTrack: number } | undefined
  const dept = d.deptSummary as { total: number; audited: number } | undefined
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Section title="عن الشركة">
        <ul className="space-y-1">
          <li>الاسم: <b>{company?.name ?? '—'}</b></li>
          <li>القطاع: {company?.sector ?? '—'}</li>
          <li>الحجم: {company?.size ?? '—'}</li>
          <li>المرحلة: {company?.stage ?? '—'}</li>
        </ul>
      </Section>
      <Section title="القياسات الرئيسية">
        <ul className="space-y-1 tabular-nums">
          <li>صحة عامة: <b>{String(d.healthScore ?? '—')}%</b></li>
          <li>نضج: <b>{String(d.maturityScore ?? '—')}</b></li>
          <li>المسار: <b>{String(d.strategicPath ?? '—')}</b></li>
          <li>مؤشرات في المسار: {k?.onTrack ?? 0} / {k?.total ?? 0}</li>
          <li>إدارات مدققة: {dept?.audited ?? 0} / {dept?.total ?? 0}</li>
          <li>مهام متأخرة: {String(d.overdueTasks ?? 0)}</li>
        </ul>
      </Section>
      <Section title="أبرز نقاط الضعف">
        {top.length === 0 ? <p className="text-muted-foreground">—</p> : (
          <ol className="space-y-1">
            {top.map((w, i) => <li key={i}>• {w.label} — <span className="tabular-nums">{w.pct}%</span></li>)}
          </ol>
        )}
      </Section>
    </div>
  )
}

function StrategicBody({ d }: { d: AnyRec }) {
  const diag = d.diagnostic as { strategicPath?: string; maturityScore?: number; roadmap?: { title: string; detail: string }[]; weaknesses?: { label: string; pct: number }[] } | null
  const swot = d.swot as { strengths?: string[]; weaknesses?: string[]; opportunities?: string[]; threats?: string[] } | null
  const objectives = (d.objectives as { title: string; status: string; type: string; okrs: { keyResult: string }[] }[] | undefined) ?? []
  const kpis = (d.kpis as { name: string; currentValue: number; targetValue: number; unit: string }[] | undefined) ?? []
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Section title="نتيجة التشخيص">
        {diag ? (
          <>
            <p>المسار: <b>{diag.strategicPath ?? '—'}</b> · النضج: <b>{diag.maturityScore ?? '—'}</b></p>
            {diag.weaknesses && diag.weaknesses.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {diag.weaknesses.slice(0, 5).map((w, i) => <li key={i}>• {w.label} — {w.pct}%</li>)}
              </ul>
            )}
          </>
        ) : <p className="text-muted-foreground">لم يجرَ تشخيص بعد.</p>}
      </Section>
      <Section title="SWOT">
        {swot ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>القوة ({swot.strengths?.length ?? 0})</div>
            <div>الضعف ({swot.weaknesses?.length ?? 0})</div>
            <div>الفرص ({swot.opportunities?.length ?? 0})</div>
            <div>التهديدات ({swot.threats?.length ?? 0})</div>
          </div>
        ) : <p className="text-muted-foreground">لا يوجد SWOT.</p>}
      </Section>
      <Section title="الأهداف">
        {objectives.length === 0 ? <p className="text-muted-foreground">—</p> : (
          <ul className="space-y-1 text-xs">
            {objectives.map((o, i) => <li key={i}>• {o.title} ({o.status}) — {o.okrs.length} OKR</li>)}
          </ul>
        )}
      </Section>
      <Section title="المؤشرات">
        {kpis.length === 0 ? <p className="text-muted-foreground">—</p> : (
          <ul className="space-y-1 text-xs tabular-nums">
            {kpis.slice(0, 6).map((k, i) => <li key={i}>• {k.name}: {k.currentValue}/{k.targetValue} {k.unit}</li>)}
          </ul>
        )}
      </Section>
      {diag?.roadmap && diag.roadmap.length > 0 && (
        <Section title="خارطة الـ90 يوم">
          <ol className="space-y-1 text-xs">
            {diag.roadmap.map((r, i) => (
              <li key={i}><b>{i + 1}. {r.title}.</b> <span className="text-muted-foreground">{r.detail}</span></li>
            ))}
          </ol>
        </Section>
      )}
    </div>
  )
}

function ComplianceBody({ d }: { d: AnyRec }) {
  const basic = d.basic as { maturityPct?: number; dangerZone?: string } | null
  const pro = d.pro as { maturityPct?: number; dangerZone?: string; reformPlan?: { week: number; axis: string; action: string }[]; penaltyEstimate?: number } | null
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Section title="تدقيق أساسي">
        {basic ? (
          <p>النضج: <b>{basic.maturityPct}%</b> · المنطقة: <b>{basic.dangerZone}</b></p>
        ) : <p className="text-muted-foreground">لم يجرَ التدقيق الأساسي بعد.</p>}
      </Section>
      <Section title="تدقيق احترافي">
        {pro ? (
          <p>النضج: <b>{pro.maturityPct}%</b> · المنطقة: <b>{pro.dangerZone}</b> · تعرّض الغرامات: <b className="tabular-nums">{pro.penaltyEstimate?.toLocaleString('ar-SA') ?? '—'} SAR</b></p>
        ) : <p className="text-muted-foreground">لم يجرَ التدقيق الاحترافي بعد.</p>}
      </Section>
      {pro?.reformPlan && pro.reformPlan.length > 0 && (
        <Section title="خطة الإصلاح (12 أسبوع)">
          <ol className="space-y-1 text-xs">
            {pro.reformPlan.slice(0, 12).map((r, i) => (
              <li key={i}>أسبوع {r.week} — <b>{r.axis}</b>: {r.action}</li>
            ))}
          </ol>
        </Section>
      )}
    </div>
  )
}

function DepartmentBody({ d }: { d: AnyRec }) {
  const depts = (d.departments as { type: string; label: string; auditScore: number | null; kpis: { name: string; currentValue: number; targetValue: number }[] }[] | undefined) ?? []
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {depts.length === 0 && <p className="text-sm text-muted-foreground">لا توجد إدارات.</p>}
      {depts.map((d, i) => (
        <Section key={i} title={d.label}>
          <p className="tabular-nums">صحة: <b>{d.auditScore != null ? `${Math.round(d.auditScore)}%` : '—'}</b></p>
          {d.kpis.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs tabular-nums">
              {d.kpis.map((k, j) => <li key={j}>• {k.name}: {k.currentValue}/{k.targetValue}</li>)}
            </ul>
          )}
        </Section>
      ))}
    </div>
  )
}

function AnnualBody({ d }: { d: AnyRec }) {
  const objectives = (d.objectives as { title: string; status: string; okrsCount: number }[] | undefined) ?? []
  const initiatives = (d.initiatives as { title: string; priority: string; status: string }[] | undefined) ?? []
  const projects = (d.projects as { title: string; status: string }[] | undefined) ?? []
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Section title={`أهداف ${String(d.year ?? '')}`}>
        {objectives.length === 0 ? <p className="text-muted-foreground">—</p> : (
          <ul className="space-y-1 text-xs">{objectives.map((o, i) => <li key={i}>• {o.title} ({o.status})</li>)}</ul>
        )}
      </Section>
      <Section title="المبادرات">
        {initiatives.length === 0 ? <p className="text-muted-foreground">—</p> : (
          <ul className="space-y-1 text-xs">{initiatives.map((x, i) => <li key={i}>• {x.title} — {x.priority} / {x.status}</li>)}</ul>
        )}
      </Section>
      <Section title="المشاريع">
        {projects.length === 0 ? <p className="text-muted-foreground">—</p> : (
          <ul className="space-y-1 text-xs">{projects.map((x, i) => <li key={i}>• {x.title} — {x.status}</li>)}</ul>
        )}
      </Section>
      <div className="md:col-span-3 text-xs text-muted-foreground tabular-nums">
        {String(d.taskCount ?? 0)} مهمة هذا العام · {String(d.overdueTasks ?? 0)} متأخرة.
      </div>
    </div>
  )
}
