import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useClientScopedCompany } from '@/hooks/useClientScopedCompany'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_LABEL } from '@/lib/deptApi'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

// ─── تحليل الفجوات على مستوى إدارة العميل ──────────────────────────
// المصدر: stratix legacy — gap-analysis.html (per-axis gap between current
// state 1-100 and target 1-100, with an action plan). المدير الخبير يُضيف
// محاور صحّة الإدارة، يحدّد قيم الحالي والمستهدف، ويكتب خطة الردم.
//
// شكل التخزين: StrategicArtifact بنوع `GAP_ANALYSIS_<DEPT>`.

interface GapItem {
  id: string
  name: string
  current: number
  target: number
  action: string
}

interface GapData {
  gaps: GapItem[]
}

// نُقدّم للمدير قائمة اقتراحات محاور شائعة لكل تخصّص لبدء التحليل
// (يمكن تعديلها أو حذفها).
import type { DeptCode } from '@/lib/deptApi'

const AXIS_SUGGESTIONS: Partial<Record<DeptCode, string[]>> = {
  HR:               ['نضج تقييم الأداء', 'نسبة السعودة', 'رضا الموظفين', 'اكتمال SOPs'],
  FINANCE:          ['هامش صافي', 'DSO', 'نسبة السيولة', 'دقة التقارير المالية'],
  SALES:            ['معدل التحويل', 'دورة البيع', 'تنويع العملاء', 'قدرة الفريق'],
  MARKETING:        ['ROI الحملات', 'الحضور الرقمي', 'CAC', 'وضوح الرسالة'],
  OPERATIONS:       ['كفاءة التشغيل', 'نضج SOPs', 'مستوى الأتمتة', 'إدارة الموردين'],
  IT:               ['Uptime', 'أمن سيبراني', 'التكامل بين الأنظمة', 'استخدام السحابة'],
  CUSTOMER_SERVICE: ['CSAT', 'FCR', 'وقت الاستجابة', 'نضج CRM'],
  SUPPORT:          ['SLA الالتزام', 'نضج البنية التقنية', 'كفاءة المشتريات'],
  LOGISTICS:        ['OTIF', 'تنويع الناقلين', 'دقة التسليم', 'تكلفة الشحن'],
  QUALITY:          ['معدل العيوب', 'شهادات ISO', 'ثقافة الجودة', 'CAPA'],
  PROJECTS:         ['التسليم في الموعد', 'ضمن الميزانية', 'نضج PMO', 'إدارة المخاطر'],
  COMPLIANCE:       ['التزام ZATCA', 'نضج GOSI', 'PDPL', 'دورة تجديد التراخيص'],
  GOVERNANCE:       ['فعالية المجلس', 'استقلالية اللجان', 'إفصاح شفاف', 'إدارة المخاطر المؤسسية'],
}

function makeId(): string {
  return `g_${Math.floor(performance.now() * 1000)}_${Math.floor(1000 + Math.random() * 9000)}`
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

function clampScore(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function DeptGapPage() {
  const user = useAuthStore((s) => s.user)
  const scope = useClientScopedCompany()
  const specialty = user?.specialtyDeptType ?? null
  const [data, setData] = useState<GapData>({ gaps: [] })
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
        const artifact = await getArtifact<GapData>(scope.company!.id, `GAP_ANALYSIS_${specialty}`)
        if (!alive) return
        if (artifact?.data) {
          setData(normalize(artifact.data))
          setSavedAt(artifact.updatedAt)
        }
      } catch (err) {
        if (alive) toast.error(apiErrorMessage(err, 'تعذّر تحميل تحليل الفجوة السابق'))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [scope.company, specialty])

  function addGap(name = '') {
    setData((prev) => ({
      gaps: [...prev.gaps, { id: makeId(), name, current: 0, target: 0, action: '' }],
    }))
  }

  function updateGap(id: string, patch: Partial<GapItem>) {
    setData((prev) => ({
      gaps: prev.gaps.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }))
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
      const saved = await upsertArtifact<GapData>(
        scope.company.id, `GAP_ANALYSIS_${specialty}`, data
      )
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
        <PageHeader title="تحليل الفجوة" />
        <EmptyState title="لا يوجد تخصّص محدّد" />
      </div>
    )
  }
  if (scope.loading || loading) return <LoadingSpinner fullPage label="جاري التحميل…" />
  if (!scope.company) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="تحليل الفجوة" />
        <EmptyState title={scope.error ?? 'لا شركة نشطة'} />
      </div>
    )
  }

  const suggestions = AXIS_SUGGESTIONS[specialty] ?? []
  const totalGap = data.gaps.reduce((sum, g) => sum + Math.max(0, g.target - g.current), 0)
  const avgGap = data.gaps.length > 0 ? Math.round(totalGap / data.gaps.length) : 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`تحليل الفجوة — إدارة ${DEPT_LABEL[specialty]}`}
        description={
          savedAt
            ? `لعميل ${scope.company.name} · آخر حفظ ${new Date(savedAt).toLocaleString('ar-SA')}`
            : `لعميل ${scope.company.name} · حدّد الحالي والمستهدف وخطة الردم لكل محور`
        }
      />

      {/* ملخص */}
      {data.gaps.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatBox label="عدد المحاور" value={String(data.gaps.length)} />
          <StatBox label="متوسط الفجوة" value={`${avgGap}٪`} accent={avgGap > 30 ? 'rose' : avgGap > 15 ? 'amber' : 'emerald'} />
          <StatBox label="إجمالي التحديات" value={String(totalGap)} />
        </div>
      )}

      {/* المقترحات السريعة */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">محاور موصى بها لتخصّصك — انقر لإضافتها</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => {
              const already = data.gaps.some((g) => g.name === s)
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => addGap(s)}
                  disabled={already}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    already
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-primary/30 bg-primary/5 hover:bg-primary hover:text-primary-foreground'
                  }`}
                >
                  {already ? '✓ ' : '＋ '}{s}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => addGap()}
              className="rounded-full border border-dashed border-muted-foreground/40 bg-card px-3 py-1 text-xs hover:bg-accent"
            >
              ＋ محور مخصّص
            </button>
          </CardContent>
        </Card>
      )}

      {/* قائمة الفجوات */}
      {data.gaps.length === 0 ? (
        <EmptyState
          title="لا فجوات مسجّلة بعد"
          description="ابدأ بمحور من المقترحات أعلاه أو أضف محوراً مخصّصاً."
          action={
            <Button onClick={() => addGap()}>
              ＋ إضافة أول محور
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {data.gaps.map((g) => (
            <GapRow
              key={g.id}
              gap={g}
              onChange={(patch) => updateGap(g.id, patch)}
              onRemove={() => removeGap(g.id)}
            />
          ))}
        </div>
      )}

      <div className="sticky bottom-4 z-10 flex justify-end gap-2">
        <Button variant="outline" onClick={() => addGap()}>＋ محور جديد</Button>
        <Button onClick={save} disabled={saving} size="lg" className="shadow-lg">
          {saving ? 'جاري الحفظ…' : `حفظ ${data.gaps.length} فجوة`}
        </Button>
      </div>
    </div>
  )
}

// ─── مكوّنات فرعية ───────────────────────────────────────────────────

function StatBox({
  label, value, accent,
}: { label: string; value: string; accent?: 'rose' | 'amber' | 'emerald' }) {
  const valueClass =
    accent === 'rose' ? 'text-rose-600'
    : accent === 'amber' ? 'text-amber-600'
    : accent === 'emerald' ? 'text-emerald-600'
    : ''
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${valueClass}`}>{value}</div>
    </div>
  )
}

function GapRow({
  gap, onChange, onRemove,
}: { gap: GapItem; onChange: (patch: Partial<GapItem>) => void; onRemove: () => void }) {
  const diff = Math.max(0, gap.target - gap.current)
  const zone = diff > 30 ? 'rose' : diff > 15 ? 'amber' : diff > 0 ? 'emerald' : 'sky'
  const zoneClass = {
    rose: 'border-rose-200 bg-rose-50/50',
    amber: 'border-amber-200 bg-amber-50/50',
    emerald: 'border-emerald-200 bg-emerald-50/50',
    sky: 'border-sky-200 bg-sky-50/50',
  }[zone]

  return (
    <Card className={`${zoneClass}`}>
      <CardContent className="grid gap-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={gap.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="اسم المحور (مثال: نضج SOPs)"
            className="flex-1"
          />
          <button
            onClick={onRemove}
            className="rounded-md border bg-card px-2.5 py-1.5 text-xs hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700"
          >
            حذف ×
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">الوضع الحالي (0-100)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={gap.current}
              onChange={(e) => onChange({ current: clampScore(e.target.value) })}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">المستهدف (0-100)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={gap.target}
              onChange={(e) => onChange({ target: clampScore(e.target.value) })}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">الفجوة</Label>
            <div className="rounded-md border bg-card px-3 py-2 text-center">
              <span className="text-2xl font-bold tabular-nums">{diff}</span>
              <span className="ml-1 text-xs text-muted-foreground">نقطة</span>
            </div>
          </div>
        </div>

        {/* شريط بصري */}
        <div className="relative h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 right-0 bg-primary/30"
            style={{ width: `${gap.target}%` }}
            title={`المستهدف ${gap.target}%`}
          />
          <div
            className="absolute inset-y-0 right-0 bg-primary"
            style={{ width: `${gap.current}%` }}
            title={`الحالي ${gap.current}%`}
          />
        </div>

        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">خطة العمل لردم الفجوة</Label>
          <Textarea
            value={gap.action}
            onChange={(e) => onChange({ action: e.target.value })}
            rows={2}
            placeholder="اكتب الخطوات التنفيذية والمسؤول والمدّة الزمنية…"
          />
        </div>
      </CardContent>
    </Card>
  )
}
