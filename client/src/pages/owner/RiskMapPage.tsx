import { useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, getSWOT, upsertArtifact } from '@/lib/strategicApi'
import { listDepartments, type Department, type AxisBreakdown } from '@/lib/deptApi'
import { AXIS_LABEL_AR } from '@/lib/smartGap'
import { useAuthStore } from '@/store/authStore'
import { weaknessesFromDeepAnswers } from '@/pages/manager/DeptDeepPage'
import { COMMON_RISKS_BY_DEPT, AI_MITIGATION_ENABLED, findRiskTemplate, deptMitigationPool, riskSuggestion } from './riskTemplates'


interface Risk {
  id: string
  name: string
  probability: 1 | 2 | 3 | 4 | 5
  impact: 1 | 2 | 3 | 4 | 5
  mitigation: string
  /** مستورَدة بلا تقييم فعليّ (تدخل ١/١ ركناً أدنى، لا ٣/٣ وسطاً كاذباً) —
   *  تحتاج مراجعة المستخدم. حقل اختياريّ: الاستيرادات القديمة تتركه undefined.
   *  ملاحظة: كلّ الاستيرادات (SWOT/يدويّ/قوالب) تُدخِل ٣/٣ زائفاً — عطلٌ سابق
   *  يُعمَّم عليه هذا الوسم لاحقاً (لا في هذه الدفعة). انظر DISPLAY_VS_DECISION.md. */
  unreviewed?: boolean
}

interface RiskData {
  risks: Risk[]
}

const EMPTY: RiskData = { risks: [] }

// محور تدقيق «ضعيف»: درجته أقلّ من نصف سقفه (score/cap < 0.5) — مصدر مخاطر
// عميل الطوارئ (يملك تدقيقاً لا تحليلاً عميقاً). دالّة نقيّة، تُستعمَل في فحص
// الملكيّة وفي التوليد معاً (لا عتبة مكرّرة).
function weakAxesOf(depts: Department[]): AxisBreakdown[] {
  return depts.flatMap((d) => d.auditData?.byAxis ?? []).filter((a) => a.cap > 0 && a.score / a.cap < 0.5)
}

// Heatmap color: probability × impact = 1..25
function cellTint(score: number): { bg: string; label: string; text: string } {
  if (score >= 16) return { bg: 'bg-red-500/80', label: 'حرج', text: 'text-white' }
  if (score >= 10) return { bg: 'bg-orange-500/80', label: 'مرتفع', text: 'text-white' }
  if (score >= 5)  return { bg: 'bg-amber-400/80', label: 'متوسط', text: 'text-amber-900' }
  return { bg: 'bg-emerald-400/70', label: 'منخفض', text: 'text-emerald-900' }
}

export function RiskMapPage() {
  const [params] = useSearchParams()
  const client = params.get('client')
  const from = params.get('from')
  const parts = ['tab=risk']
  if (client) parts.push(`client=${client}`)
  if (from) parts.push(`from=${from}`)
  return <Navigate to={`/priority?${parts.join('&')}`} replace />
}

export function RiskMapView({ companyId }: { companyId: string }) {
  return <Editor companyId={companyId} />
}

function Editor({ companyId }: { companyId: string }) {
  const user = useAuthStore((s) => s.user)
  const specialty = user?.specialtyDeptType ?? null
  const [data, setData] = useState<RiskData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  // ملكيّة SWOT وقت الرسم — نُخفي «استورد من SWOT» قبل الضغط حين لا مصدر، بشرط
  // !hasSwot (لا from=emergency): الخيار يتبع الملكيّة لا سياق الدخول، فيعود
  // تلقائيّاً حين يُنجَز SWOT لاحقاً. عرضٌ يُصلَح في الاشتقاق لا في ردّ الفعل.
  const [hasSwot, setHasSwot] = useState(false)
  // ملكيّة التشخيص (① نقاط الضعف) وقت الرسم — عميل الطوارئ يملكه لا SWOT.
  const [hasDeep, setHasDeep] = useState(false)
  // ملكيّة التدقيق — عميل الطوارئ يملك محاور تدقيق ضعيفة (لا تحليلاً عميقاً غالباً).
  const [hasAudit, setHasAudit] = useState(false)

  useEffect(() => {
    getArtifact<RiskData>(companyId, 'RISK_REGISTER').then((row) => {
      if (row?.data?.risks) setData({ risks: row.data.risks })
    }).catch(() => undefined)
    // ملكيّة SWOT وقت الرسم — نفس شرط importFromSWOT (تهديدات أو ضعف)، فتُخفى
    // البطاقة قبل الضغط بدل أن تُعرَض ثمّ تفشل بـ«افتح /swot أوّلاً».
    getSWOT(companyId)
      .then((s) => setHasSwot(((s.threats?.length ?? 0) + (s.weaknesses?.length ?? 0)) > 0))
      .catch(() => setHasSwot(false))
    // ملكيّة التشخيص — نفس artifact + دالّة مولّد المبادرات (مسار واحد، لا ثالث).
    getArtifact<{ weaknesses?: string[]; answers?: Record<string, { selected?: string[]; other?: string } | string> }>(companyId, 'DEPT_DEEP_ANSWERS')
      .then((row) => setHasDeep(weaknessesFromDeepAnswers(specialty, row?.data).length > 0))
      .catch(() => setHasDeep(false))
    // ملكيّة التدقيق — محاور ضعيفة (مصدر عميل الطوارئ الفعليّ، لا التحليل العميق).
    listDepartments(companyId)
      .then((depts) => setHasAudit(weakAxesOf(depts).length > 0))
      .catch(() => setHasAudit(false))
  }, [companyId, specialty])

  function add() {
    setData((p) => ({
      risks: [
        ...p.risks,
        { id: crypto.randomUUID(), name: '', probability: 3, impact: 3, mitigation: '' },
      ],
    }))
  }
  function update(id: string, patch: Partial<Risk>) {
    setData((p) => ({ risks: p.risks.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))
  }
  // تغيير الاسم: إن طابق قالباً معروفاً ولم يقيّمه المستخدم بعد (٣/٣ الافتراضيّ +
  // تخفيف فارغ)، نملأ الاحتمال/الأثر المتوقّع + التخفيف الأوّل تلقائيّاً — «التقييم
  // المتوقّع» يوفّر الحساب اليدويّ. لا ندهس تقييماً حرّكه المستخدم.
  function changeName(id: string, name: string) {
    const t = findRiskTemplate(name, specialty)
    setData((p) => ({
      risks: p.risks.map((r) => {
        if (r.id !== id) return r
        const next: Risk = { ...r, name }
        if (t) {
          if (r.probability === 3 && r.impact === 3) {
            next.probability = t.probability
            next.impact = t.impact
            next.unreviewed = false
          }
          if (!r.mitigation.trim()) next.mitigation = t.mitigations[0]
        }
        return next
      }),
    }))
  }
  function remove(id: string) {
    setData((p) => ({ risks: p.risks.filter((r) => r.id !== id) }))
  }
  // تطبيق التقييم المتوقّع بالجملة — يحلّ عناء ضبط كلّ خطر يدويّاً حين يكثر العدد.
  // يمسّ فقط غير المُراجَعة أو المتروكة على الافتراض (١×١) وله قالب مطابق — فلا
  // يدهس تقييماً وضعه المستخدم. التخفيف يُملأ فقط إن كان فارغاً.
  function applyExpectedAssessments() {
    const targets = data.risks.filter(
      (r) => (r.unreviewed || (r.probability === 1 && r.impact === 1)) && riskSuggestion(r.name, specialty),
    )
    if (targets.length === 0) {
      toast.info('لا مخاطر بحاجة لتقييم متوقّع (كلّها مُراجَعة أو بلا قالب مطابق).')
      return
    }
    const ids = new Set(targets.map((r) => r.id))
    setData((p) => ({
      risks: p.risks.map((r) => {
        if (!ids.has(r.id)) return r
        const sug = riskSuggestion(r.name, specialty)!
        return {
          ...r,
          probability: sug.probability,
          impact: sug.impact,
          unreviewed: false,
          mitigation: r.mitigation.trim() ? r.mitigation : sug.mitigations[0],
        }
      }),
    }))
    toast.success(`طُبِّق التقييم المتوقّع على ${targets.length} خطراً — راجِعها وعدّل ما يلزم ثم احفظ.`)
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'RISK_REGISTER', data)
      toast.success('تم حفظ سجل المخاطر')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  // ─── قوالب مخاطر شائعة بحسب التخصّص — للبدء بلا SWOT ───────
  function importCommonRisks() {
    if (!specialty) {
      toast.error('لم يُحدَّد التخصّص — لا يمكن تحميل القوالب.')
      return
    }
    const templates = COMMON_RISKS_BY_DEPT[specialty]
    if (!templates || templates.length === 0) {
      toast.error(`لا قوالب مخاطر شائعة لتخصّص ${specialty} — ابدأ يدوياً أو من SWOT.`)
      return
    }
    const existing = new Set(data.risks.map((r) => r.name.trim()))
    const newRisks: Risk[] = templates
      .filter((t) => !existing.has(t.name))
      .map((t) => ({ id: crypto.randomUUID(), name: t.name, probability: t.probability, impact: t.impact, mitigation: t.mitigations[0] }))
    if (newRisks.length === 0) {
      toast.error('كل القوالب مُضافة سلفاً.')
      return
    }
    setData((p) => ({ risks: [...p.risks, ...newRisks] }))
    toast.success(`أُضيف ${newRisks.length} من القوالب الشائعة — عدّل الأسماء والتخفيفات حسب حالتك ثم احفظ.`)
  }

  // ─── ترابط: SWOT (Weaknesses + Threats) → Risk Register ────────
  // نقاط الضعف الداخلية والتهديدات الخارجية كلاهما مخاطر واجبة الرصد.
  // الافتراض: threats بأثر 4 (خارجية = فوق مسيطرتنا)، weaknesses بأثر 3
  // (داخلية = يمكن التحكم بها). كلاهما probability=3 (متوسط) للمراجعة.
  async function importFromSWOT() {
    setImporting(true)
    try {
      const swot = await getSWOT(companyId)
      const threats = swot.threats ?? []
      const weaknesses = swot.weaknesses ?? []
      if (threats.length === 0 && weaknesses.length === 0) {
        toast.error('لا تهديدات/ضعف مسجّلة في SWOT — افتح /swot أوّلاً.')
        return
      }
      const existing = new Set(data.risks.map((r) => r.name))
      const newRisks: Risk[] = []
      for (const t of threats) {
        const clean = t.trim()
        if (!clean) continue
        const name = `[تهديد] ${clean.slice(0, 80)}${clean.length > 80 ? '…' : ''}`
        if (existing.has(name)) continue
        newRisks.push({ id: crypto.randomUUID(), name, probability: 3, impact: 4, mitigation: '' })
      }
      for (const w of weaknesses) {
        const clean = w.trim()
        if (!clean) continue
        const name = `[ضعف] ${clean.slice(0, 80)}${clean.length > 80 ? '…' : ''}`
        if (existing.has(name)) continue
        newRisks.push({ id: crypto.randomUUID(), name, probability: 3, impact: 3, mitigation: '' })
      }
      if (newRisks.length === 0) {
        toast.error('كل التهديدات/الضعف مُستوردَة مسبقاً.')
        return
      }
      setData((p) => ({ risks: [...p.risks, ...newRisks] }))
      toast.success(`أُضيف ${newRisks.length} خطر من SWOT — راجع الاحتمالية والأثر ثم احفظ.`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر الاستيراد من SWOT'))
    } finally {
      setImporting(false)
    }
  }

  // ─── استيراد من التشخيص ① — مصدر عميل الطوارئ (لا SWOT ②) ───────────
  // يوافق بانر الإنقاذ «سجّل ما يستنزفك الآن» من مادّة العميل هو. نفس مسار
  // مولّد المبادرات (weaknessesFromDeepAnswers). تدخل ١/١ موسومة unreviewed —
  // ركنٌ أدنى لا وسطٌ كاذب — فلا تدّعي تقييماً لم يحدث.
  async function importFromDiagnosis() {
    setImporting(true)
    try {
      // ① التحليل العميق (مفصّل) إن وُجد.
      const row = await getArtifact<{ weaknesses?: string[]; answers?: Record<string, { selected?: string[]; other?: string } | string> }>(companyId, 'DEPT_DEEP_ANSWERS').catch(() => null)
      let names = weaknessesFromDeepAnswers(specialty, row?.data)
        .map((w) => w.trim()).filter(Boolean)
        .map((w) => `[تشخيص] ${w.slice(0, 80)}${w.length > 80 ? '…' : ''}`)
      // ② وإلّا محاور التدقيق الضعيفة — مصدر عميل الطوارئ (خشِن، لكن ما يملكه).
      if (names.length === 0) {
        const depts = await listDepartments(companyId).catch(() => [] as Department[])
        names = weakAxesOf(depts).map((a) => `[تدقيق] ضعف ${AXIS_LABEL_AR[a.axis]} (${Math.round(a.score)}/${a.cap})`)
      }
      if (names.length === 0) {
        toast.error('لا نقاط ضعف في تشخيصك/تدقيقك بعد — أكمل التدقيق أوّلاً.')
        return
      }
      const existing = new Set(data.risks.map((r) => r.name))
      const newRisks: Risk[] = []
      for (const name of names) {
        if (existing.has(name)) continue
        newRisks.push({ id: crypto.randomUUID(), name, probability: 1, impact: 1, mitigation: '', unreviewed: true })
      }
      if (newRisks.length === 0) {
        toast.error('كل نقاط ضعفك مُستوردَة سلفاً.')
        return
      }
      setData((p) => ({ risks: [...p.risks, ...newRisks] }))
      toast.success(`أُضيف ${newRisks.length} خطر من تشخيصك — بلا تقييم (١/١)؛ راجِع احتماليّة كلٍّ وأثره ثم احفظ.`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر الاستيراد من التشخيص'))
    } finally {
      setImporting(false)
    }
  }

  // Build a 5×5 grid: each cell counts risks at (impact, probability)
  const grid = useMemo(() => {
    const g: Risk[][][] = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => []))
    for (const r of data.risks) {
      if (r.name.trim()) g[r.impact - 1][r.probability - 1].push(r)
    }
    return g
  }, [data.risks])

  const ranked = [...data.risks]
    .filter((r) => r.name.trim())
    .sort((a, b) => b.probability * b.impact - a.probability * a.impact)

  const criticalCount = data.risks.filter((r) => r.probability * r.impact >= 16).length
  const highCount = data.risks.filter((r) => {
    const s = r.probability * r.impact
    return s >= 10 && s < 16
  }).length

  const isEmpty = data.risks.length === 0
  const hasTemplates = specialty && COMMON_RISKS_BY_DEPT[specialty]

  return (
    <>
      {/* 🎯 بطاقة استقبال — تظهر فقط عند فراغ السجل، بـ٣ طرق للبدء */}
      {isEmpty && (
        <Card className="overflow-hidden border-2 border-primary/40 bg-gradient-to-l from-primary/10 via-primary/5 to-transparent shadow-md">
          <div className="h-1.5 bg-gradient-to-l from-rose-500 via-orange-500 to-amber-500" />
          <CardContent className="p-5">
            <div className="mb-3 flex items-start gap-3">
              <div className="text-4xl">⚠️</div>
              <div>
                <h2 className="text-lg font-bold">ابدأ برصد مخاطرك في ٣ طرق</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  المنطقة الحمراء أو التخطيط الوقائيّ يحتاج <b className="text-foreground">أوّلاً</b> حصر ما يستنزفك.
                  اختر أنسب طريقة — يمكن الجمع بينها لاحقاً.
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {/* ١. قوالب شائعة — الأسرع للحالة الطارئة */}
              {hasTemplates && (
                <button
                  type="button"
                  onClick={importCommonRisks}
                  className="group flex flex-col items-start gap-2 rounded-xl border-2 border-rose-300 bg-rose-50/60 p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-rose-500 hover:shadow-md"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🚨</span>
                    <span className="rounded-full border border-rose-400 bg-white px-2 py-0.5 text-[9px] font-bold text-rose-800">الأسرع</span>
                  </div>
                  <div className="text-sm font-bold text-rose-900">قوالب مخاطر شائعة</div>
                  <div className="text-[11px] leading-relaxed text-rose-800/80">
                    ٤ مخاطر جاهزة لتخصّصك مع تخفيفات مُقترحة — عدّلها حسب حالتك.
                  </div>
                  <div className="mt-auto pt-1 text-[10px] font-medium text-rose-700 opacity-0 transition group-hover:opacity-100">
                    ← ابدأ فوراً
                  </div>
                </button>
              )}
              {/* ٢. من التشخيص ① — مصدر عميل الطوارئ (يملك تحليلاً لا SWOT). */}
              {(hasDeep || hasAudit) && (
                <button
                  type="button"
                  onClick={importFromDiagnosis}
                  disabled={importing}
                  className="group flex flex-col items-start gap-2 rounded-xl border-2 border-violet-300 bg-violet-50/60 p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-violet-500 hover:shadow-md disabled:opacity-60"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🔍</span>
                    <span className="rounded-full border border-violet-400 bg-white px-2 py-0.5 text-[9px] font-bold text-violet-800">مصدرك الآن</span>
                  </div>
                  <div className="text-sm font-bold text-violet-900">استورد من تشخيصك</div>
                  <div className="text-[11px] leading-relaxed text-violet-800/80">
                    نقاط ضعف تشخيصك/تدقيقك تُتحوّل إلى مخاطر — بلا تقييم (تدخل ١/١)، راجِعها.
                  </div>
                  <div className="mt-auto pt-1 text-[10px] font-medium text-violet-700 opacity-0 transition group-hover:opacity-100">
                    ← من واقعك، قبل SWOT
                  </div>
                </button>
              )}
              {/* ٣. من SWOT — تظهر فقط حين يملك العميل SWOT (تهديدات/ضعف).
                  عميل الطوارئ المبكّر (بلا SWOT) لا يرى طريقاً مسدوداً؛ وحين
                  يُنجز SWOT لاحقاً تعود تلقائيّاً — الملكيّة لا السياق. */}
              {hasSwot && (
                <button
                  type="button"
                  onClick={importFromSWOT}
                  disabled={importing}
                  className="group flex flex-col items-start gap-2 rounded-xl border-2 border-sky-300 bg-sky-50/60 p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-sky-500 hover:shadow-md disabled:opacity-60"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🎭</span>
                    <span className="rounded-full border border-sky-400 bg-white px-2 py-0.5 text-[9px] font-bold text-sky-800">مُوصى به</span>
                  </div>
                  <div className="text-sm font-bold text-sky-900">استورد من SWOT</div>
                  <div className="text-[11px] leading-relaxed text-sky-800/80">
                    التهديدات + نقاط الضعف من SWOT تُتحوّل تلقائياً إلى مخاطر مرقّمة.
                  </div>
                  <div className="mt-auto pt-1 text-[10px] font-medium text-sky-700 opacity-0 transition group-hover:opacity-100">
                    ← SWOT جاهز
                  </div>
                </button>
              )}
              {/* ٣. يدوياً */}
              <button
                type="button"
                onClick={add}
                className="group flex flex-col items-start gap-2 rounded-xl border-2 border-emerald-300 bg-emerald-50/60 p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500 hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">✍️</span>
                  <span className="rounded-full border border-emerald-400 bg-white px-2 py-0.5 text-[9px] font-bold text-emerald-800">الأكثر تحكّماً</span>
                </div>
                <div className="text-sm font-bold text-emerald-900">أضف خطراً يدويّاً</div>
                <div className="text-[11px] leading-relaxed text-emerald-800/80">
                  ابدأ بخطر واحد تعرفه من واقع إدارتك — أضف احتماله وأثره والتخفيف.
                </div>
                <div className="mt-auto pt-1 text-[10px] font-medium text-emerald-700 opacity-0 transition group-hover:opacity-100">
                  ← تحكّم كامل
                </div>
              </button>
            </div>
            <div className="mt-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-2 text-[11px] text-muted-foreground">
              <b className="text-foreground">💡 نصيحة:</b> ابدأ بـ٤-٦ مخاطر عاجلة الآن. يمكن دائماً إضافة المزيد لاحقاً حين تعمّق SWOT.
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-red-200 bg-gradient-to-br from-red-500/15 to-transparent">
          <CardHeader>
            <CardDescription>مخاطر حرجة</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-red-700">{criticalCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-orange-200 bg-gradient-to-br from-orange-500/15 to-transparent">
          <CardHeader>
            <CardDescription>مخاطر مرتفعة</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-orange-700">{highCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-500/15 to-transparent">
          <CardHeader>
            <CardDescription>إجمالي المخاطر</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-emerald-700">{data.risks.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
      <Card>
        <CardHeader>
          <CardTitle>الشبكة الحرارية (احتمالية × أثر)</CardTitle>
          <CardDescription>
            الصفوف = الأثر (يقل من أعلى لأسفل). الأعمدة = الاحتمالية (تزيد من اليمين لليسار).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* A2 — مفتاح شرح: يعرّف كل رقم في الاحتمال/الأثر وكيف يُختار (مطويّ). */}
          <details className="mb-4 rounded-lg border bg-muted/30 p-3 text-xs">
            <summary className="cursor-pointer font-semibold text-foreground">
              ❓ كيف أختار الأرقام؟ — دليل الاحتمال والأثر
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1 font-semibold text-foreground">🎲 الاحتمال — كم مرجّح خلال السنة؟</div>
                <ul className="space-y-0.5 text-muted-foreground">
                  <li><b>١ نادر</b> — أقلّ من ١٠٪ · لم يقع سابقاً</li>
                  <li><b>٢ غير مرجّح</b> — ١٠–٣٠٪ · وقع مرّة</li>
                  <li><b>٣ ممكن</b> — ٣٠–٥٠٪ · يقع أحياناً</li>
                  <li><b>٤ مرجّح</b> — ٥٠–٨٠٪ · متكرّر</li>
                  <li><b>٥ شبه مؤكّد</b> — أكثر من ٨٠٪ · يقع غالباً</li>
                </ul>
              </div>
              <div>
                <div className="mb-1 font-semibold text-foreground">💥 الأثر — لو وقع، كم يضرّ؟</div>
                <ul className="space-y-0.5 text-muted-foreground">
                  <li><b>١ ضئيل</b> — إزعاج طفيف · بلا أثر ماليّ يُذكر</li>
                  <li><b>٢ طفيف</b> — محدود · يُحتوى بسهولة</li>
                  <li><b>٣ متوسّط</b> — اضطراب ملحوظ · خسارة متوسّطة</li>
                  <li><b>٤ كبير</b> — خسارة كبيرة · تعطّل مهمّ</li>
                  <li><b>٥ كارثيّ</b> — يهدّد بقاء المنشأة</li>
                </ul>
              </div>
            </div>
            <div className="mt-3 border-t pt-2 text-muted-foreground">
              <b className="text-foreground">الدرجة = الاحتمال × الأثر (١–٢٥):</b>{' '}
              🔴 ١٦+ حرج · 🟠 ١٠–١٥ عالٍ · 🟡 ٥–٩ متوسّط · 🟢 أقلّ من ٥ منخفض.
              <div className="mt-1">
                <b className="text-foreground">كيف تختار:</b> (١) كم مرّة يقع فعلاً؟ ← الاحتمال. (٢) لو وقع غداً، كم يكلّفك (مال · عملاء · سمعة · توقّف)؟ ← الأثر. اضرب الرقمين.
              </div>
            </div>
          </details>
          <div className="grid grid-cols-[40px_repeat(5,minmax(0,1fr))] gap-1 text-xs">
            <div />
            {[5, 4, 3, 2, 1].map((p) => (
              <div key={p} className="text-center font-semibold text-muted-foreground tabular-nums">
                احتمالية {p}
              </div>
            ))}
            {[5, 4, 3, 2, 1].map((impact) => (
              <ContextRow key={impact} impact={impact} row={grid[impact - 1]} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>سجل المخاطر</CardTitle>
          <CardDescription>{data.risks.length} خطر.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* أسماء القوالب المعروفة لتخصّصك — اختيار الاسم يملأ التقييم المتوقّع */}
          <datalist id="risk-template-names">
            {(specialty ? COMMON_RISKS_BY_DEPT[specialty] ?? [] : []).map((t) => (
              <option key={t.name} value={t.name} />
            ))}
          </datalist>
          {data.risks.map((r) => {
            const score = r.probability * r.impact
            const tint = cellTint(score)
            return (
              <div key={r.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    className="min-w-[180px] flex-1"
                    value={r.name}
                    onChange={(e) => changeName(r.id, e.target.value)}
                    list="risk-template-names"
                    placeholder="اسم الخطر… (اختر معروفاً ليُملأ التقييم المتوقّع)"
                  />
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">احتمالية</span>
                    <select
                      className="rounded-md border bg-background px-2 py-1"
                      value={r.probability}
                      onChange={(e) => update(r.id, { probability: Number(e.target.value) as Risk['probability'], unreviewed: false })}
                    >
                      {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">أثر</span>
                    <select
                      className="rounded-md border bg-background px-2 py-1"
                      value={r.impact}
                      onChange={(e) => update(r.id, { impact: Number(e.target.value) as Risk['impact'], unreviewed: false })}
                    >
                      {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tint.bg} ${tint.text}`}>
                    {tint.label} · {score}
                  </span>
                  {r.unreviewed && (
                    <span className="rounded-md border border-dashed border-violet-400 bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700" title="مستوردة من تشخيصك بلا تقييم — راجِع احتماليّتها وأثرها">
                      🔍 غير مُراجَعة
                    </span>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>×</Button>
                </div>
                <Input
                  className="mt-2"
                  value={r.mitigation}
                  onChange={(e) => update(r.id, { mitigation: e.target.value })}
                  placeholder="إجراء التخفيف المقترح…"
                />
                {(() => {
                  // مُوحِّد واحد: كتالوج التشخيص (أدقّ للمستوردة) ← بنك الأقسام (ذكيّ عبر
                  // كلّ الأقسام). يُرجِع ٣ تخفيفات + تقييماً متوقّعاً. وإلّا مطويّة القسم.
                  const sug = riskSuggestion(r.name, specialty)
                  const aiBtn = AI_MITIGATION_ENABLED ? (
                    <button
                      type="button"
                      className="rounded-full border border-dashed border-primary/40 px-2 py-0.5 text-[11px] text-primary hover:bg-primary/5"
                      title="توليد اقتراحات بالذكاء الاصطناعيّ"
                    >
                      🤖 اقتراحات أذكى
                    </button>
                  ) : null
                  // رقيقة تخفيف — تملأ الحقل فقط، لا تمسّ اسم الخطر (الشرط ٣).
                  const chip = (s: string, i: number) => {
                    const active = r.mitigation.trim() === s
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => update(r.id, { mitigation: s })}
                        className={`rounded-full border px-2 py-0.5 text-[11px] leading-snug transition ${active ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-muted-foreground/30 bg-muted/40 text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}
                        title="اضغط لاستخدام هذا الإجراء — لا يغيّر اسم الخطر، يمكنك تعديله بعدها"
                      >
                        {s}
                      </button>
                    )
                  }
                  if (sug) {
                    // ٣ رقائق محدّدة + رقيقة تقييمٍ متوقّع تملأ الأثر/الاحتمال فقط (لا الاسم).
                    const needsAssessment = r.probability !== sug.probability || r.impact !== sug.impact
                    return (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">اقتراحات:</span>
                        {sug.mitigations.map(chip)}
                        {needsAssessment && (
                          <button
                            type="button"
                            onClick={() => update(r.id, { probability: sug.probability, impact: sug.impact, unreviewed: false })}
                            className="rounded-full border border-amber-400/60 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100"
                            title="يملأ الاحتمال والأثر المتوقّعَين لهذا الخطر — لا يغيّر الاسم"
                          >
                            🎯 تقييم متوقّع {sug.probability}×{sug.impact}
                          </button>
                        )}
                        {aiBtn}
                      </div>
                    )
                  }
                  // لا مطابقة: اقتراحات القسم مطويّة (اختياريّة، ≤٥) — لا ضوضاء على كلّ صفّ (الشرط ٢).
                  const pool = deptMitigationPool(specialty).slice(0, 5)
                  if (pool.length === 0 && !aiBtn) return null
                  return (
                    <details className="mt-1.5 text-[11px]">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">💡 اقتراحات قسمك (اختياريّ)</summary>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {pool.map(chip)}
                        {aiBtn}
                      </div>
                    </details>
                  )
                })()}
              </div>
            )
          })}
          {data.risks.length === 0 && (
            <p className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              لا توجد مخاطر مسجلة بعد.
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={add}>+ خطر جديد</Button>
            {/* تطبيق التقييم المتوقّع بالجملة — يظهر فقط حين وجود مخاطر غير مُراجَعة لها قالب. */}
            {(() => {
              const cnt = data.risks.filter(
                (r) => (r.unreviewed || (r.probability === 1 && r.impact === 1)) && riskSuggestion(r.name, specialty),
              ).length
              return cnt > 0 ? (
                <Button
                  size="sm"
                  onClick={applyExpectedAssessments}
                  disabled={saving || importing}
                  title="يملأ الاحتمال والأثر المتوقّعَين لكلّ خطر غير مُراجَع له قالب مطابق — لا يمسّ ما قيّمته، راجِعها بعدها"
                >
                  🎯 طبّق التقييم المتوقّع ({cnt})
                </Button>
              ) : null
            })()}
            {/* استيرادات محصورة بالملكيّة — كالبطاقات (لا طريق مسدود لعميل الطوارئ). */}
            {(hasDeep || hasAudit) && (
              <Button variant="outline" size="sm" onClick={importFromDiagnosis} disabled={importing || saving}>
                {importing ? 'جاري…' : '🔍 من تشخيصك'}
              </Button>
            )}
            {hasSwot && (
              <Button variant="outline" size="sm" onClick={importFromSWOT} disabled={importing || saving}>
                {importing ? 'جاري…' : '🧭 من SWOT'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
        </div>

        {/* أولوية المعالجة — ملتصقة بجانب السجل لتربط كل خطر بترتيب علاجه */}
        <aside className="h-fit space-y-3 lg:sticky lg:top-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">🎯 أولوية المعالجة</CardTitle>
              <CardDescription className="text-xs">الأعلى (احتمالية × أثر) يُعالَج أوّلاً.</CardDescription>
            </CardHeader>
            <CardContent>
              {ranked.length > 0 ? (
                <ol className="space-y-2 text-sm">
                  {ranked.slice(0, 10).map((r, i) => {
                    const score = r.probability * r.impact
                    const tint = cellTint(score)
                    return (
                      <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2.5">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground tabular-nums">{i + 1}</span>
                          <span className="truncate font-medium">{r.name}</span>
                        </span>
                        <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs ${tint.bg} ${tint.text}`}>{score}</span>
                      </li>
                    )
                  })}
                </ol>
              ) : (
                <p className="text-xs text-muted-foreground">أضِف مخاطر (باسمٍ) ليظهر ترتيب معالجتها هنا.</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* شريط حفظ ثابت أسفل الصفحة — لا يضيع مهما طال السجل */}
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-primary/40 bg-card p-3 shadow-lg">
        <div className="text-xs text-muted-foreground">
          <b className="text-red-700 tabular-nums">{criticalCount}</b> حرجة · <b className="text-foreground tabular-nums">{data.risks.length}</b> إجمالي · احفظ لتثبيت السجل.
        </div>
        <Button onClick={save} disabled={saving || importing} size="lg">
          {saving ? 'جاري الحفظ…' : '💾 حفظ السجل'}
        </Button>
      </div>
    </>
  )
}

function ContextRow({ impact, row }: { impact: number; row: Risk[][] }) {
  return (
    <>
      <div className="flex items-center justify-center text-xs font-semibold text-muted-foreground tabular-nums">
        أثر {impact}
      </div>
      {[5, 4, 3, 2, 1].map((p) => {
        const cell = row[p - 1] ?? []
        const score = p * impact
        const tint = cellTint(score)
        // نقرأ الوسم في الرسم — وإلّا صار حقلاً صامتاً: البيانات تعرف والعين لا.
        const unrev = cell.filter((r) => r.unreviewed).length
        return (
          <div
            key={p}
            className={`flex h-16 flex-col items-center justify-center rounded-md ${tint.bg} ${tint.text} ${unrev > 0 ? 'border-2 border-dashed border-violet-500' : ''}`}
            title={unrev > 0 ? `أثر ${impact} · احتمالية ${p} = ${score} · ${unrev} 🔍 غير مُراجَعة` : `أثر ${impact} · احتمالية ${p} = ${score}`}
          >
            <span className="text-xs opacity-80">{tint.label}</span>
            <span className="text-lg font-bold tabular-nums">{cell.length || ''}</span>
            {unrev > 0 && <span className="text-[9px] font-bold text-violet-700">🔍 {unrev}</span>}
          </div>
        )
      })}
    </>
  )
}
