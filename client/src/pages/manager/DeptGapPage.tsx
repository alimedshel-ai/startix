import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { OpexHint } from '@/components/OpexHint'
import { PageHeader } from '@/components/PageHeader'
import { NextStepCard } from '@/components/strategic/NextStepCard'
import { StageBanner } from '@/components/strategic/StageBanner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useClientScopedCompany } from '@/hooks/useClientScopedCompany'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_ICON, DEPT_LABEL, listDepartments, type Department } from '@/lib/deptApi'
import { generateSmartGaps, type SmartGapItem } from '@/lib/smartGap'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

// ─── تحليل ذكي للفجوات — إدارة العميل ───────────────────────────
// المصدر: stratix legacy — gap-analysis.html + محرك ذكاء smartGap.
// عند فتح الصفحة نحسب فجوات ذكية من (آخر تدقيق + التخصّص + OPEX).
// المدير يقبل ما يريد بضغطة واحدة، ثم يعدّل/يضيف/يحذف يدوياً.
// الحفظ: StrategicArtifact بنوع GAP_ANALYSIS_<DEPT>.

interface GapItem {
  id: string
  name: string
  current: number
  target: number
  action: string
}
interface GapData { gaps: GapItem[] }

function makeId(): string {
  return `g_${Math.floor(performance.now() * 1000)}_${Math.floor(1000 + Math.random() * 9000)}`
}
function clampScore(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}
function normalize(raw: unknown): GapData {
  if (!raw || typeof raw !== 'object' || !('gaps' in raw)) return { gaps: [] }
  const arr = (raw as { gaps?: unknown }).gaps
  if (!Array.isArray(arr)) return { gaps: [] }
  const gaps: GapItem[] = []
  for (const g of arr) {
    if (!g || typeof g !== 'object') continue
    const o = g as Partial<GapItem>
    if (typeof o.name !== 'string') continue
    gaps.push({
      id: typeof o.id === 'string' ? o.id : makeId(),
      name: o.name,
      current: clampScore(o.current),
      target: clampScore(o.target),
      action: typeof o.action === 'string' ? o.action : '',
    })
  }
  return { gaps }
}

// Map DeptCode → مسار التدقيق للـ«ابدأ التدقيق».
function auditRoute(dept: string): string {
  const m: Record<string, string> = {
    HR: 'hr', FINANCE: 'finance', SALES: 'sales', MARKETING: 'marketing',
    OPERATIONS: 'operations', IT: 'it', CUSTOMER_SERVICE: 'cs', SUPPORT: 'cs',
    LOGISTICS: 'logistics', QUALITY: 'quality', PROJECTS: 'projects',
    GOVERNANCE: 'governance', COMPLIANCE: 'compliance',
  }
  return m[dept] ?? 'hr'
}

export function DeptGapPage() {
  const scope = useClientScopedCompany()
  const user = useAuthStore((s) => s.user)
  const specialty = user?.specialtyDeptType ?? null

  const [data, setData] = useState<GapData>({ gaps: [] })
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    if (!scope.company || !specialty) return
    let alive = true
    setLoading(true)
    setData({ gaps: [] })
    setSavedAt(null)
    ;(async () => {
      try {
        const cid = scope.company!.id
        const [artifact, deps] = await Promise.allSettled([
          getArtifact<GapData>(cid, `GAP_ANALYSIS_${specialty}`),
          listDepartments(cid),
        ])
        if (!alive) return
        if (artifact.status === 'fulfilled' && artifact.value?.data) {
          setData(normalize(artifact.value.data))
          setSavedAt(artifact.value.updatedAt)
        }
        if (deps.status === 'fulfilled') setDepartments(deps.value)
      } catch (err) {
        if (alive) toast.error(apiErrorMessage(err, 'تعذّر التحميل'))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [scope.company, specialty])

  const myDept = specialty ? departments.find((d) => d.type === specialty) : null
  const auditData = myDept?.auditData ?? null

  const smartSuggestions: SmartGapItem[] = useMemo(() => generateSmartGaps({
    specialty,
    opex: scope.company?.opex ?? {},
    pains: user?.pains ?? [],
    goals: user?.goals ?? [],
    auditScores: auditData ? {
      governance: auditData.governance,
      financial:  auditData.financial,
      team:       auditData.team,
      digital:    auditData.digital,
    } : null,
    auditHealthPct: auditData?.healthPct ?? null,
  }), [specialty, scope.company?.opex, user?.pains, user?.goals, auditData])

  function addSmartGap(s: SmartGapItem) {
    if (data.gaps.some((g) => g.name === s.axis)) return
    setData((prev) => ({
      gaps: [...prev.gaps, {
        id: makeId(), name: s.axis,
        current: s.current, target: s.target, action: s.action,
      }],
    }))
    toast.success(`أُضيفت "${s.axis}"`)
  }
  function addAllSmart() {
    const existing = new Set(data.gaps.map((g) => g.name))
    const toAdd = smartSuggestions.filter((s) => !existing.has(s.axis))
    if (toAdd.length === 0) {
      toast.error('كل المقترحات مُضافة سابقاً.')
      return
    }
    setData((prev) => ({
      gaps: [...prev.gaps, ...toAdd.map((s) => ({
        id: makeId(), name: s.axis,
        current: s.current, target: s.target, action: s.action,
      }))],
    }))
    toast.success(`أُضيفت ${toAdd.length} فجوات ذكية.`)
  }

  function addGap(name = '') {
    setData((prev) => ({
      gaps: [...prev.gaps, { id: makeId(), name, current: 0, target: 0, action: '' }],
    }))
  }
  function updateGap(id: string, patch: Partial<GapItem>) {
    setData((prev) => ({ gaps: prev.gaps.map((g) => (g.id === id ? { ...g, ...patch } : g)) }))
  }
  function removeGap(id: string) {
    setData((prev) => ({ gaps: prev.gaps.filter((g) => g.id !== id) }))
  }

  async function save() {
    if (!scope.company || !specialty) return
    if (data.gaps.length === 0) {
      toast.error('أضف فجوة واحدة على الأقل قبل الحفظ.')
      return
    }
    setSaving(true)
    try {
      const saved = await upsertArtifact<GapData>(scope.company.id, `GAP_ANALYSIS_${specialty}`, data)
      setSavedAt(saved.updatedAt)
      toast.success(`تم حفظ ${data.gaps.length} فجوة`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  if (!specialty) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="تحليل الفجوة الذكي" />
        <EmptyState title="لا يوجد تخصّص محدّد" />
      </div>
    )
  }
  if (scope.loading || loading) return <LoadingSpinner fullPage label="جاري التحميل…" />
  if (!scope.company) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="تحليل الفجوة الذكي" />
        <EmptyState title={scope.error ?? 'لا شركة نشطة'} />
      </div>
    )
  }

  const clientQ = `?client=${scope.company.id}`
  const existingNames = new Set(data.gaps.map((g) => g.name))
  const remainingSuggestions = smartSuggestions.filter((s) => !existingNames.has(s.axis))
  const totalGap = data.gaps.reduce((sum, g) => sum + Math.max(0, g.target - g.current), 0)
  const avgGap = data.gaps.length > 0 ? Math.round(totalGap / data.gaps.length) : 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`تحليل الفجوة الذكي — إدارة ${DEPT_LABEL[specialty]}`}
        description={
          savedAt
            ? `لعميل ${scope.company.name} · آخر حفظ ${new Date(savedAt).toLocaleString('ar-SA')}`
            : `لعميل ${scope.company.name} · النظام يحلّل + يقترح، وأنت تعدّل`
        }
      />

      <StageBanner clientQuery={clientQ} />

      {/* السياق الذي يبني عليه التحليل */}
      <div className="grid gap-3 sm:grid-cols-3">
        <ContextChip icon={DEPT_ICON[specialty]} label="التخصّص" value={DEPT_LABEL[specialty]} />
        <ContextChip
          icon="🩺"
          label="آخر تدقيق"
          value={auditData ? `${Math.round(auditData.healthPct)}٪` : 'لم يبدأ'}
          highlight={!auditData}
          extra={auditData ? (
            <div className="mt-1 flex flex-wrap gap-1 text-[9px] text-muted-foreground">
              <span>حوكمة {Math.round(auditData.governance)}</span>
              <span>· مالي {Math.round(auditData.financial)}</span>
              <span>· فريق {Math.round(auditData.team)}</span>
              <span>· رقمي {Math.round(auditData.digital)}</span>
            </div>
          ) : null}
        />
        <ContextChip
          icon="💰"
          label="مستهدف سنوي"
          value={scope.company.opex?.target ? `${scope.company.opex.target.toLocaleString('ar-SA')} ر.س` : '—'}
          highlight={!scope.company.opex?.target}
        />
      </div>

      {/* المقترحات الذكية */}
      {smartSuggestions.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">🧠 تحليل ذكي — فجوات مُستنبَطة</CardTitle>
              <CardDescription>
                {auditData
                  ? 'مبنيّة على آخر تدقيقك — القيم + خطة المعالجة محسوبة تلقائياً.'
                  : 'لا يوجد تدقيق بعد — نُقدّم فجوات نموذجية بقيم افتراضية للتعديل.'}
              </CardDescription>
            </div>
            {remainingSuggestions.length > 0 && (
              <Button size="sm" onClick={addAllSmart}>＋ اقبل الكل ({remainingSuggestions.length})</Button>
            )}
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {smartSuggestions.map((s, i) => {
              const already = existingNames.has(s.axis)
              const diff = s.target - s.current
              return (
                <div key={i} className={`rounded-lg border p-3 ${already ? 'border-emerald-300 bg-emerald-50/40' : 'bg-card hover:shadow-sm'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        {s.axis}
                        <span className="rounded-full border bg-muted/40 px-1.5 py-0 text-[9px]">
                          {s.source === 'audit' ? 'من التدقيق' : s.source === 'opex' ? 'من OPEX' : s.source}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="tabular-nums">حالياً <b>{s.current}٪</b></span>
                        <span>→</span>
                        <span className="tabular-nums text-primary">مستهدف <b>{s.target}٪</b></span>
                        <span className="rounded bg-rose-100 px-1.5 py-0 text-rose-800">فجوة {diff}</span>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        <span className="font-medium">لماذا: </span>{s.rationale}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed">
                        <span className="font-medium text-emerald-700">خطة معالجة: </span>{s.action}
                      </p>
                    </div>
                    {already ? (
                      <span className="shrink-0 rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">✓ مُضاف</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addSmartGap(s)}
                        className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
                      >
                        ＋ اقبل
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {!auditData && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="text-2xl">💡</span>
            <div className="flex-1">
              <div className="text-sm font-semibold">أَجرِ التدقيق الأساسي لتحصل على تحليل أدقّ</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                التدقيق ينتج ٤ درجات (حوكمة/مالي/فريق/رقمي) — كل واحدة تصير فجوة تلقائية بمعالجة مقترحة.
              </p>
            </div>
            <Link
              to={`/manager/${auditRoute(specialty)}/audit${clientQ}`}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              ابدأ التدقيق
            </Link>
          </CardContent>
        </Card>
      )}

      <OpexHint opex={scope.company.opex} focus={['target', 'budget', 'team']} title="OPEX يُثري السياق" />

      {data.gaps.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatBox label="عدد المحاور" value={String(data.gaps.length)} />
          <StatBox label="متوسط الفجوة" value={`${avgGap}٪`} accent={avgGap > 30 ? 'rose' : avgGap > 15 ? 'amber' : 'emerald'} />
          <StatBox label="إجمالي التحديات" value={String(totalGap)} />
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">
            الفجوات المُدرَجة {data.gaps.length > 0 && `(${data.gaps.length})`}
          </h2>
          <Button size="sm" variant="outline" onClick={() => addGap()}>＋ محور مخصّص</Button>
        </div>
        {data.gaps.length === 0 ? (
          <EmptyState title="لا فجوات مُدرَجة بعد" description="اقبل من المقترحات الذكية أعلاه، أو أضف محوراً مخصّصاً." />
        ) : (
          <div className="grid gap-3">
            {data.gaps.map((g) => (
              <GapRow key={g.id} gap={g} onChange={(patch) => updateGap(g.id, patch)} onRemove={() => removeGap(g.id)} />
            ))}
          </div>
        )}
      </div>

      {data.gaps.length > 0 && (
        <div className="sticky bottom-4 z-10 flex justify-end gap-2">
          <Button onClick={save} disabled={saving} size="lg" className="shadow-lg">
            {saving ? 'جاري الحفظ…' : `حفظ ${data.gaps.length} فجوة`}
          </Button>
        </div>
      )}

      <NextStepCard clientQuery={clientQ} />
    </div>
  )
}

function ContextChip({
  icon, label, value, highlight, extra,
}: { icon: string; label: string; value: string; highlight?: boolean; extra?: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? 'border-amber-300 bg-amber-50/40' : 'bg-card'}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span aria-hidden>{icon}</span>{label}
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{value}</div>
      {extra}
    </div>
  )
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: 'rose' | 'amber' | 'emerald' }) {
  const valueClass = accent === 'rose' ? 'text-rose-600' : accent === 'amber' ? 'text-amber-600' : accent === 'emerald' ? 'text-emerald-600' : ''
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${valueClass}`}>{value}</div>
    </div>
  )
}

function GapRow({ gap, onChange, onRemove }: { gap: GapItem; onChange: (patch: Partial<GapItem>) => void; onRemove: () => void }) {
  const diff = Math.max(0, gap.target - gap.current)
  const zone = diff > 30 ? 'rose' : diff > 15 ? 'amber' : diff > 0 ? 'emerald' : 'sky'
  const zoneClass = {
    rose: 'border-rose-200 bg-rose-50/50',
    amber: 'border-amber-200 bg-amber-50/50',
    emerald: 'border-emerald-200 bg-emerald-50/50',
    sky: 'border-sky-200 bg-sky-50/50',
  }[zone]
  return (
    <Card className={zoneClass}>
      <CardContent className="grid gap-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input value={gap.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="اسم المحور" className="flex-1" />
          <button onClick={onRemove} className="rounded-md border bg-card px-2.5 py-1.5 text-xs hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700">حذف ×</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">الوضع الحالي (0-100)</Label>
            <Input type="number" min={0} max={100} value={gap.current} onChange={(e) => onChange({ current: clampScore(e.target.value) })} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">المستهدف (0-100)</Label>
            <Input type="number" min={0} max={100} value={gap.target} onChange={(e) => onChange({ target: clampScore(e.target.value) })} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">الفجوة</Label>
            <div className="rounded-md border bg-card px-3 py-2 text-center">
              <span className="text-2xl font-bold tabular-nums">{diff}</span>
              <span className="ml-1 text-xs text-muted-foreground">نقطة</span>
            </div>
          </div>
        </div>
        <div className="relative h-3 overflow-hidden rounded-full bg-muted">
          <div className="absolute inset-y-0 right-0 bg-primary/30" style={{ width: `${gap.target}%` }} />
          <div className="absolute inset-y-0 right-0 bg-primary" style={{ width: `${gap.current}%` }} />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">خطة العمل لردم الفجوة</Label>
          <Textarea value={gap.action} onChange={(e) => onChange({ action: e.target.value })} rows={3} placeholder="خطوات تنفيذية، مسؤول، مدّة زمنية…" />
        </div>
      </CardContent>
    </Card>
  )
}
