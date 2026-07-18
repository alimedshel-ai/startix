import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { OpexHint } from '@/components/OpexHint'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCompany } from '@/hooks/useCompany'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_LABEL, type DeptCode } from '@/lib/deptApi'
import { DEPT_BSC_BANK, perspectivePriorityForPath, type PerspectiveKey } from '@/lib/deptBSC'
import { createKPI, getArtifact, listKPIs, listObjectives, upsertArtifact, type ArtifactType } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

interface BSCPerspective {
  objectives: string
  measures: string
  initiatives: string
  target: string
}

interface BSCData {
  perspectives: Record<PerspectiveKey, BSCPerspective>
}

const EMPTY_PERSPECTIVE: BSCPerspective = { objectives: '', measures: '', initiatives: '', target: '' }
const EMPTY: BSCData = {
  perspectives: {
    financial: { ...EMPTY_PERSPECTIVE },
    customer: { ...EMPTY_PERSPECTIVE },
    internal: { ...EMPTY_PERSPECTIVE },
    learning: { ...EMPTY_PERSPECTIVE },
  },
}

// معنى البُعد الكلاسيكي (شركة كاملة) — يستخدمها OWNER/INTERNAL manager.
const CLASSIC_PERSPECTIVES: {
  key: PerspectiveKey; labelAr: string; icon: string; descAr: string; accent: string
}[] = [
  { key: 'financial', icon: '💰', labelAr: 'مالي',           descAr: 'كيف نبدو للمساهمين ماليّاً؟', accent: 'border-emerald-300 bg-emerald-50/40' },
  { key: 'customer',  icon: '👥', labelAr: 'العملاء',        descAr: 'كيف يرانا عملاؤنا؟',            accent: 'border-sky-300 bg-sky-50/40' },
  { key: 'internal',  icon: '⚙️', labelAr: 'العمليات الداخلية', descAr: 'في ماذا يجب أن نتفوّق؟',       accent: 'border-amber-300 bg-amber-50/40' },
  { key: 'learning',  icon: '📚', labelAr: 'التعلّم والنموّ',  descAr: 'كيف نستمرّ في التحسّن؟',       accent: 'border-violet-300 bg-violet-50/40' },
]

export function BSCPage() {
  const [params] = useSearchParams()
  const client = params.get('client')
  const q = client ? `&client=${client}` : ''
  return <Navigate to={`/measure?tab=bsc${q}`} replace />
}

export function BSCView({ companyId }: { companyId: string }) {
  const user = useAuthStore((s) => s.user)
  const isDeptScoped =
    user?.userType === 'MANAGER' &&
    user?.managerType === 'INDEPENDENT_PRO' &&
    user?.specialtyDeptType != null &&
    DEPT_BSC_BANK[user.specialtyDeptType] != null
  const specialty = user?.specialtyDeptType ?? null
  return isDeptScoped
    ? <DeptEditor companyId={companyId} specialty={specialty as DeptCode} />
    : <ClassicEditor companyId={companyId} />
}

// شريط تنقّل صغير أعلى المحتوى — الطريق الطبيعي: BSC ← → الأهداف الاستراتيجيّة.
function CrossNavBar() {
  const [params] = useSearchParams()
  const client = params.get('client')
  const qs = client ? `&client=${client}` : ''
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-2 text-xs">
      <span className="text-muted-foreground">
        💡 BSC يُغذّي الأهداف الاستراتيجيّة — يمكنك الاستيراد من هناك.
      </span>
      <div className="flex flex-wrap gap-2">
        <Link
          to={`/measure?tab=objectives${qs}`}
          className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 font-medium text-primary transition hover:bg-primary hover:text-primary-foreground"
        >
          🎯 الأهداف الاستراتيجيّة ←
        </Link>
        <Link
          to={`/measure?tab=kpis${qs}`}
          className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          📊 KPIs ←
        </Link>
      </div>
    </div>
  )
}

// ─── الكلاسيكي (شركة) — كما كان ───────────────────────────────────
function ClassicEditor({ companyId }: { companyId: string }) {
  const { company } = useCompany()
  const [data, setData] = useState<BSCData>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getArtifact<BSCData>(companyId, 'BSC').then((row) => {
      if (row?.data?.perspectives) {
        setData({
          perspectives: {
            financial: { ...EMPTY_PERSPECTIVE, ...row.data.perspectives.financial },
            customer:  { ...EMPTY_PERSPECTIVE, ...row.data.perspectives.customer },
            internal:  { ...EMPTY_PERSPECTIVE, ...row.data.perspectives.internal },
            learning:  { ...EMPTY_PERSPECTIVE, ...row.data.perspectives.learning },
          },
        })
      }
    }).catch(() => undefined)
  }, [companyId])

  function setField(key: PerspectiveKey, field: keyof BSCPerspective, value: string) {
    setData((p) => ({
      perspectives: { ...p.perspectives, [key]: { ...p.perspectives[key], [field]: value } },
    }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'BSC', data)
      toast.success('تم حفظ BSC')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <CrossNavBar />
      <OpexHint opex={company?.opex} focus={['target', 'budget']} title="OPEX يُغذّي البُعد المالي" />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle>الأبعاد الأربعة</CardTitle>
            <CardDescription>لكل بُعد: أهداف، مقاييس، قيمة مستهدفة، مبادرات.</CardDescription>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? 'جاري الحفظ…' : 'حفظ'}
          </Button>
        </CardHeader>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {CLASSIC_PERSPECTIVES.map((p) => (
          <PerspectiveCard
            key={p.key}
            k={p.key}
            labelAr={p.labelAr}
            icon={p.icon}
            descAr={p.descAr}
            accent={p.accent}
            data={data.perspectives[p.key]}
            onField={(f, v) => setField(p.key, f, v)}
            suggestions={null}
            rank={null}
          />
        ))}
      </div>

      <NextStepCTA />
    </>
  )
}

// ─── DeptEditor (INDEPENDENT_PRO) — مُعاد التفسير ────────────────
function DeptEditor({ companyId, specialty }: { companyId: string; specialty: DeptCode }) {
  const artifactType: ArtifactType = `BSC_${specialty}`
  const user = useAuthStore((s) => s.user)
  const strategyPath = user?.strategyPath ?? null
  const bank = DEPT_BSC_BANK[specialty]
  const priorityKeys = perspectivePriorityForPath(strategyPath)
  const { company } = useCompany()
  const [data, setData] = useState<BSCData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    getArtifact<BSCData>(companyId, artifactType).then((row) => {
      if (row?.data?.perspectives) {
        setData({
          perspectives: {
            financial: { ...EMPTY_PERSPECTIVE, ...row.data.perspectives.financial },
            customer:  { ...EMPTY_PERSPECTIVE, ...row.data.perspectives.customer },
            internal:  { ...EMPTY_PERSPECTIVE, ...row.data.perspectives.internal },
            learning:  { ...EMPTY_PERSPECTIVE, ...row.data.perspectives.learning },
          },
        })
      }
    }).catch(() => undefined)
  }, [companyId, artifactType])

  function setField(key: PerspectiveKey, field: keyof BSCPerspective, value: string) {
    setData((p) => ({
      perspectives: { ...p.perspectives, [key]: { ...p.perspectives[key], [field]: value } },
    }))
  }
  function appendLine(key: PerspectiveKey, field: keyof BSCPerspective, line: string) {
    setData((p) => {
      const current = p.perspectives[key][field].trim()
      if (current.includes(line)) return p
      const sep = current ? '\n• ' : '• '
      return {
        perspectives: {
          ...p.perspectives,
          [key]: { ...p.perspectives[key], [field]: current + sep + line },
        },
      }
    })
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, artifactType, data)
      toast.success('تم حفظ BSC')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  // 🧠 توليد تلقائي:
  //   • objectives ← من Objectives القائمة + بنك التخصّص (٢ لكل بُعد)
  //   • measures   ← أسماء KPIs القائمة + بنك التخصّص
  //   • initiatives ← بنك التخصّص
  async function generateAll() {
    setGenerating(true)
    try {
      const [obs, kps] = await Promise.all([
        listObjectives(companyId).catch(() => []),
        listKPIs(companyId).catch(() => []),
      ])
      const next: BSCData = {
        perspectives: {
          financial: { ...data.perspectives.financial },
          customer:  { ...data.perspectives.customer },
          internal:  { ...data.perspectives.internal },
          learning:  { ...data.perspectives.learning },
        },
      }

      // خريطة نوع Objective → PerspectiveKey.
      const objMap: Record<string, PerspectiveKey> = {
        financial: 'financial', customer: 'customer',
        operations: 'internal',  people: 'learning', innovation: 'learning',
      }
      for (const o of obs.slice(0, 8)) {
        const key = objMap[o.type as string] ?? 'internal'
        const line = o.title
        const current = next.perspectives[key].objectives.trim()
        if (!current.includes(line)) {
          const sep = current ? '\n• ' : '• '
          next.perspectives[key].objectives = current + sep + line
        }
      }

      // KPIs الحاليّة → measures. نحاول تخمين البُعد بالفئة (name).
      for (const k of kps.slice(0, 8)) {
        // نضع KPI في «internal» افتراضياً — يمكن للمدير سحبه لبُعد آخر.
        const key: PerspectiveKey = /مالي|ربح|إيراد|هامش|تكلفة|SAR|ريال/.test(k.name)
          ? 'financial'
          : /عميل|CSAT|NPS|رضا/.test(k.name)
            ? 'customer'
            : /تدريب|شهادة|تعلّم|قدرات/.test(k.name)
              ? 'learning'
              : 'internal'
        const line = `${k.name}${k.targetValue ? ` (هدف ${k.targetValue})` : ''}`
        const current = next.perspectives[key].measures.trim()
        if (!current.includes(k.name)) {
          const sep = current ? '\n• ' : '• '
          next.perspectives[key].measures = current + sep + line
        }
      }

      // ملء ما تبقّى من البنك — ٢ من كل بُعد.
      let added = 0
      for (const key of ['financial', 'customer', 'internal', 'learning'] as PerspectiveKey[]) {
        const bp = bank.perspectives[key]
        for (const list of [
          ['objectives', bp.objectives.slice(0, 2)] as const,
          ['measures',   bp.measures.slice(0, 2)] as const,
          ['initiatives', bp.initiatives.slice(0, 2)] as const,
        ]) {
          const [field, items] = list
          const current = next.perspectives[key][field].trim()
          for (const it of items) {
            if (!current.includes(it)) {
              const sep = next.perspectives[key][field].trim() ? '\n• ' : '• '
              next.perspectives[key][field] = next.perspectives[key][field] + sep + it
              added++
            }
          }
        }
      }
      // القيمة المستهدفة من OPEX للمالي إن كانت فارغة.
      if (!next.perspectives.financial.target && company?.opex?.target) {
        next.perspectives.financial.target = `${company.opex.target.toLocaleString('ar-SA')} SAR`
      }

      setData(next)
      toast.success(`🧠 مُلئت الأبعاد الأربعة${obs.length > 0 ? ` من ${obs.length} هدف` : ''}${kps.length > 0 ? ` + ${kps.length} KPI` : ''} + بنك تخصّصك (${added} بند).`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر التوليد التلقائي'))
    } finally {
      setGenerating(false)
    }
  }

  // 📌 حوّل هدف من البُعد المالي إلى KPI فعلي في القاعدة (اختياري).
  async function objectiveToKPI(perspectiveKey: PerspectiveKey, line: string) {
    try {
      await createKPI({
        companyId,
        name: line,
        unit: perspectiveKey === 'financial' ? 'SAR' : '%',
        targetValue: perspectiveKey === 'financial' ? (company?.opex?.target ?? 100000) : 100,
        frequency: 'quarterly',
      })
      toast.success(`تحويل «${line}» إلى KPI في القاعدة.`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر التحويل'))
    }
  }

  return (
    <>
      <CrossNavBar />
      {/* شارة السياق — يوضّح إعادة التفسير */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-wrap items-center gap-3 p-3 text-xs">
          <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
            🎯 السياق: إدارة {DEPT_LABEL[specialty]}
          </span>
          {strategyPath && (
            <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
              {strategyPath === 'QUICK' ? '⚡ مسارك: تشغيلي (قصير)' : strategyPath === 'MEDIUM' ? '🎯 مسارك: تكتيكي (متوسّط)' : '🔭 مسارك: استراتيجي (طويل)'}
            </span>
          )}
          <span className="text-muted-foreground">
            الأبعاد مُعاد تفسيرها — مالي (وفر إدارتك)، عملاء (المستفيدون من خدمتك)، داخلي (عملياتك)، تعلّم (فريقك).
            {priorityKeys.length > 0 && ` · مسارك يُبرز: ${priorityKeys.slice(0, 2).map((k) => bankLabel(k)).join(' + ')}.`}
          </span>
        </CardContent>
      </Card>

      {/* 🧠 توليد تلقائي */}
      <Card className="border-primary/40 bg-gradient-to-l from-primary/15 to-primary/5">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="text-3xl" aria-hidden>🧠</div>
            <div>
              <div className="text-sm font-bold">توليد تلقائي — أهدافك + KPIs + بنك تخصّصك</div>
              <div className="text-xs text-muted-foreground">
                نجلب الأهداف المحفوظة والمؤشرات القائمة ونصنّفها في الأبعاد الأربعة، ثم نُكمل من بنك تخصّصك.
              </div>
            </div>
          </div>
          <Button onClick={generateAll} disabled={generating || saving} size="lg">
            {generating ? 'جاري…' : '✨ ولّد الآن'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle>الأبعاد الأربعة</CardTitle>
            <CardDescription>أضِف يدوياً أو انقر مقترحاً من البنك تحت كل حقل.</CardDescription>
          </div>
          <Button onClick={save} disabled={saving || generating}>
            {saving ? 'جاري الحفظ…' : 'حفظ'}
          </Button>
        </CardHeader>
      </Card>

      {/* رتّب الأبعاد بحسب أولوية المسار — المُبرَزة أوّلاً */}
      <div className="grid gap-3 lg:grid-cols-2">
        {orderedPerspectiveKeys(strategyPath).map((key, idx) => {
          const meta = CLASSIC_PERSPECTIVES.find((c) => c.key === key)!
          const bp = bank.perspectives[key]
          const isPriority = priorityKeys.slice(0, 2).includes(key)
          return (
            <PerspectiveCard
              key={key}
              k={key}
              labelAr={meta.labelAr}
              icon={meta.icon}
              descAr={bp.descAr}
              accent={meta.accent}
              data={data.perspectives[key]}
              onField={(f, v) => setField(key, f, v)}
              suggestions={{
                objectives: bp.objectives,
                measures: bp.measures,
                initiatives: bp.initiatives,
                onAppend: (field, line) => appendLine(key, field, line),
                onPromoteObjectiveToKPI: (line) => objectiveToKPI(key, line),
              }}
              rank={{ order: idx + 1, isPriority }}
            />
          )
        })}
      </div>

      {/* الخطوة التاليّة — CTA لنقل البُعد ‎objectives‎ إلى صفحة الأهداف. */}
      <NextStepCTA />
    </>
  )
}

// بطاقة CTA خضراء في نهاية BSC — تدفع المستخدم للخطوة التاليّة (الأهداف).
function NextStepCTA() {
  const [params] = useSearchParams()
  const client = params.get('client')
  const qs = client ? `&client=${client}` : ''
  return (
    <Card className="border-2 border-emerald-300 bg-emerald-50/40">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base text-emerald-900">✓ حفظت BSC — الخطوة التاليّة</CardTitle>
          <CardDescription>
            انتقل إلى تبويب «الأهداف الاستراتيجيّة» — يوجد زر «⚖️ استورد من BSC» يجلب كل ما كتبته هنا كأهداف SMART.
          </CardDescription>
        </div>
        <Link
          to={`/measure?tab=objectives${qs}`}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
        >
          🎯 الأهداف الاستراتيجيّة ←
        </Link>
      </CardHeader>
    </Card>
  )
}

// ─── بطاقة بُعد (تشترك بين Classic و Dept) ──────────────────────
function PerspectiveCard({
  labelAr, icon, descAr, accent, data, onField, suggestions, rank,
}: {
  k: PerspectiveKey
  labelAr: string
  icon: string
  descAr: string
  accent: string
  data: BSCPerspective
  onField: (field: keyof BSCPerspective, value: string) => void
  suggestions: {
    objectives: string[]
    measures: string[]
    initiatives: string[]
    onAppend: (field: keyof BSCPerspective, line: string) => void
    onPromoteObjectiveToKPI?: (line: string) => void
  } | null
  rank: { order: number; isPriority: boolean } | null
}) {
  return (
    <Card className={`${accent} ${rank?.isPriority ? 'ring-2 ring-primary/40' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {rank && (
            <span
              className={`inline-flex size-6 items-center justify-center rounded-full text-[10px] font-bold tabular-nums ${
                rank.isPriority ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
              }`}
            >
              #{rank.order}
            </span>
          )}
          <CardTitle className="flex items-center gap-2 text-base">
            <span aria-hidden>{icon}</span>
            {labelAr}
            {rank?.isPriority && (
              <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                ⭐ مُبرَز في مسارك
              </span>
            )}
          </CardTitle>
        </div>
        <CardDescription className="text-xs">{descAr}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <BSCField
          labelAr="الأهداف"
          value={data.objectives}
          onChange={(v) => onField('objectives', v)}
          placeholder="مثال: خفض تكلفة الدوران ٣٠٪…"
          rows={2}
          suggestions={suggestions?.objectives ?? []}
          onAppend={(l) => suggestions?.onAppend('objectives', l)}
          extraActionLabel={suggestions?.onPromoteObjectiveToKPI ? '＋ حوّل لـ KPI' : undefined}
          onExtraAction={(l) => suggestions?.onPromoteObjectiveToKPI?.(l)}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <BSCField
            labelAr="المقاييس"
            value={data.measures}
            onChange={(v) => onField('measures', v)}
            placeholder="ROI، NPS، …"
            rows={2}
            suggestions={suggestions?.measures ?? []}
            onAppend={(l) => suggestions?.onAppend('measures', l)}
          />
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">القيمة المستهدفة</label>
            <Input
              value={data.target}
              onChange={(e) => onField('target', e.target.value)}
              placeholder="مثال: 25%"
            />
          </div>
        </div>
        <BSCField
          labelAr="المبادرات"
          value={data.initiatives}
          onChange={(v) => onField('initiatives', v)}
          placeholder="ما الخطوات لتحقيق الهدف؟"
          rows={2}
          suggestions={suggestions?.initiatives ?? []}
          onAppend={(l) => suggestions?.onAppend('initiatives', l)}
        />
      </CardContent>
    </Card>
  )
}

// حقل نصّي مع رقائق مقترحات + زر عمل إضافي.
function BSCField({
  labelAr, value, onChange, placeholder, rows,
  suggestions, onAppend,
  extraActionLabel, onExtraAction,
}: {
  labelAr: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  rows: number
  suggestions: string[]
  onAppend: (line: string) => void
  extraActionLabel?: string
  onExtraAction?: (line: string) => void
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{labelAr}</label>
      <Textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {suggestions.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {suggestions.map((s) => {
            const already = value.includes(s)
            return (
              <button
                key={s}
                type="button"
                onClick={() => onAppend(s)}
                disabled={already}
                className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                  already
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-primary/30 bg-card hover:bg-primary hover:text-primary-foreground'
                }`}
                title={already ? 'مضاف' : 'أضِف'}
              >
                {already ? '✓ ' : '＋ '}{s}
                {extraActionLabel && onExtraAction && already && (
                  <span
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); onExtraAction(s) }}
                    className="ml-1 text-primary hover:underline"
                  >
                    {extraActionLabel}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── منطق مساعد ────────────────────────────────────────────────

// ترتيب الأبعاد على الشاشة — الأولوية (مسار المدير) أوّلاً.
function orderedPerspectiveKeys(path: 'QUICK' | 'MEDIUM' | 'LONG' | null): PerspectiveKey[] {
  const priority = perspectivePriorityForPath(path)
  const all: PerspectiveKey[] = ['financial', 'customer', 'internal', 'learning']
  const rest = all.filter((k) => !priority.slice(0, 2).includes(k))
  return [...priority.slice(0, 2), ...rest]
}

function bankLabel(key: PerspectiveKey): string {
  const map: Record<PerspectiveKey, string> = {
    financial: 'مالي', customer: 'العملاء', internal: 'العمليات الداخلية', learning: 'التعلّم',
  }
  return map[key]
}
