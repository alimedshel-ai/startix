import { useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, getSWOT, upsertArtifact } from '@/lib/strategicApi'
import type { DeptCode } from '@/lib/deptApi'
import { useAuthStore } from '@/store/authStore'

// ─── قوالب مخاطر شائعة لكل تخصّص — للبدء السريع بلا SWOT ───────
// كل قالب: (name, probability, impact, mitigation) — بحسب ما هو شائع في
// الحالة الحمراء/الأولى لكل إدارة. المدير يعدّل ثم يحفظ.
const COMMON_RISKS_BY_DEPT: Partial<Record<DeptCode, Array<{ name: string; probability: 1|2|3|4|5; impact: 1|2|3|4|5; mitigation: string }>>> = {
  FINANCE: [
    { name: 'نقص السيولة اليوميّة', probability: 4, impact: 5, mitigation: 'مراجعة يوميّة للتدفّق النقديّ + خطّ ائتمان احتياطيّ' },
    { name: 'تجاوز الميزانيّة التشغيليّة', probability: 4, impact: 4, mitigation: 'تفعيل تنبيهات ٨٠٪ لكل بند + مراجعة أسبوعيّة' },
    { name: 'ضعف تحصيل الذمم المدينة', probability: 3, impact: 4, mitigation: 'سياسات تحصيل صارمة + متابعة أسبوعيّة للفواتير' },
    { name: 'اعتماد على مورد ماليّ واحد', probability: 3, impact: 5, mitigation: 'تنويع مصادر التمويل + بناء علاقات بنكيّة متعدّدة' },
  ],
  MARKETING: [
    { name: 'اعتماد على قناة تسويقيّة واحدة', probability: 4, impact: 4, mitigation: 'تنويع القنوات + قياس ROI لكل قناة شهرياً' },
    { name: 'انخفاض معدّل التحويل', probability: 3, impact: 4, mitigation: 'اختبارات A/B + تحسين الصفحات المقصودة' },
    { name: 'ارتفاع تكلفة الاستحواذ (CAC)', probability: 3, impact: 4, mitigation: 'تحسين استهداف الجمهور + تقوية القنوات العضويّة' },
    { name: 'فقدان السمعة على السوشيال ميديا', probability: 2, impact: 5, mitigation: 'مراقبة السمعة + سياسة استجابة سريعة للأزمات' },
  ],
  SALES: [
    { name: 'اعتماد على عميل رئيسيّ واحد', probability: 3, impact: 5, mitigation: 'تنويع قاعدة العملاء + عدم تجاوز ٢٠٪ لأيّ عميل' },
    { name: 'فقدان مندوب مبيعات نجم', probability: 3, impact: 4, mitigation: 'خطط تعاقب + توثيق العلاقات مع العملاء' },
    { name: 'انخفاض معدل الإغلاق', probability: 4, impact: 3, mitigation: 'تدريب فريق المبيعات + تحسين قمع المبيعات' },
    { name: 'فقدان صفقة كبيرة للمنافس', probability: 3, impact: 4, mitigation: 'مراقبة المنافسين + عرض قيمة مميّزة' },
  ],
  HR: [
    { name: 'استقالة مواهب رئيسيّة', probability: 4, impact: 4, mitigation: 'مراجعة رواتب + مسار مهنيّ واضح + استطلاعات دوريّة' },
    { name: 'صعوبة التوظيف في وقت الطوارئ', probability: 3, impact: 4, mitigation: 'بناء pipeline مرشحين + شراكات مع مواقع توظيف' },
    { name: 'إرهاق الفريق (Burnout)', probability: 4, impact: 3, mitigation: 'مراقبة ساعات العمل + توزيع عادل للأحمال' },
    { name: 'عدم الامتثال لأنظمة العمل', probability: 2, impact: 5, mitigation: 'مراجعة قانونيّة دوريّة + تحديث السياسات' },
  ],
  OPERATIONS: [
    { name: 'توقّف عمليّة حرجة', probability: 3, impact: 5, mitigation: 'خطّة استمراريّة أعمال + نظام احتياطي' },
    { name: 'انقطاع سلسلة التوريد', probability: 3, impact: 4, mitigation: 'موردون بدائل + مخزون احتياطيّ' },
    { name: 'تدنّي الجودة', probability: 3, impact: 4, mitigation: 'نظام مراقبة جودة + مراجعات دوريّة' },
    { name: 'ارتفاع تكاليف التشغيل', probability: 4, impact: 3, mitigation: 'مراجعة الكفاءة + تحسين العمليّات' },
  ],
  IT: [
    { name: 'اختراق أمنيّ / تسريب بيانات', probability: 3, impact: 5, mitigation: 'اختبار اختراق دوريّ + تشفير + WAF + مراقبة ٢٤/٧' },
    { name: 'انقطاع الخدمة (Downtime)', probability: 3, impact: 4, mitigation: 'نظام backup آليّ + failover + مراقبة uptime' },
    { name: 'تراكم الديون التقنيّة', probability: 4, impact: 3, mitigation: 'تخصيص ٢٠٪ من الوقت لسدّ الديون التقنيّة' },
    { name: 'اعتماد على نظام قديم غير مدعوم', probability: 3, impact: 4, mitigation: 'خطّة ترحيل + توثيق المخاطر التشغيليّة' },
  ],
  CUSTOMER_SERVICE: [
    { name: 'ارتفاع معدّل التذمّر (Churn)', probability: 4, impact: 4, mitigation: 'مقابلات مع العملاء الخارجين + تحسين تجربتهم' },
    { name: 'بطء الاستجابة', probability: 4, impact: 3, mitigation: 'زيادة الفريق + أتمتة الأسئلة الشائعة' },
    { name: 'تدنّي رضا العميل (CSAT)', probability: 3, impact: 4, mitigation: 'قياس أسبوعيّ + خطط تحسين للنقاط المنخفضة' },
    { name: 'فقدان معلومات العملاء', probability: 2, impact: 4, mitigation: 'CRM موحّد + نسخ احتياطيّة' },
  ],
  LOGISTICS: [
    { name: 'تأخير الشحنات الحرجة', probability: 3, impact: 5, mitigation: 'شركات شحن بدائل + جدول مرن' },
    { name: 'أخطاء في الجرد', probability: 3, impact: 4, mitigation: 'أتمتة الجرد + جرد دوريّ' },
    { name: 'انقطاع المخزون', probability: 3, impact: 4, mitigation: 'نظام تحذير مبكّر + مخزون احتياطيّ' },
    { name: 'ارتفاع تكلفة الشحن', probability: 4, impact: 3, mitigation: 'تفاوض مع شركات الشحن + تحسين المسارات' },
  ],
  QUALITY: [
    { name: 'زيادة نسبة العيوب', probability: 3, impact: 4, mitigation: 'مراقبة إحصائيّة + تحليل جذور الأسباب' },
    { name: 'شكاوى العملاء المتكرّرة', probability: 3, impact: 4, mitigation: 'خطّة استجابة + معالجة الجذور' },
    { name: 'فقدان شهادات الجودة', probability: 2, impact: 5, mitigation: 'مراجعات دوريّة + تجديد السياسات' },
    { name: 'اعتماد على مورد بجودة متذبذبة', probability: 3, impact: 4, mitigation: 'موردون بدائل + معايير قبول صارمة' },
  ],
  PROJECTS: [
    { name: 'تجاوز الجدول الزمنيّ', probability: 4, impact: 4, mitigation: 'مراجعة أسبوعيّة + إدارة مخاطر مبكّرة' },
    { name: 'تجاوز الميزانيّة', probability: 4, impact: 4, mitigation: 'تتبّع دقيق + احتياطي ١٥٪' },
    { name: 'فقدان أعضاء الفريق الرئيسيّين', probability: 3, impact: 4, mitigation: 'خطط تعاقب + توثيق شامل' },
    { name: 'تغيّر نطاق العمل (Scope Creep)', probability: 4, impact: 3, mitigation: 'إدارة تغييرات صارمة + عقود واضحة' },
  ],
  GOVERNANCE: [
    { name: 'عدم توافق قرارات القيادة', probability: 3, impact: 4, mitigation: 'اجتماعات دوريّة + توثيق قرارات' },
    { name: 'ضعف مساءلة أعضاء المجلس', probability: 3, impact: 4, mitigation: 'مؤشّرات أداء واضحة + مراجعات سنويّة' },
    { name: 'تضارب مصالح', probability: 2, impact: 5, mitigation: 'إفصاح إلزاميّ + مراجعة مستقلّة' },
    { name: 'ضعف الرقابة الداخليّة', probability: 3, impact: 4, mitigation: 'تدقيق داخليّ + فصل مهام' },
  ],
  COMPLIANCE: [
    { name: 'عقوبات هيئة تنظيميّة', probability: 3, impact: 5, mitigation: 'مراجعة قانونيّة دوريّة + تدريب الفرق' },
    { name: 'انتهاء صلاحيّة تراخيص', probability: 3, impact: 4, mitigation: 'نظام تنبيهات + تجديد مبكّر' },
    { name: 'انتهاك حماية البيانات (GDPR/PDPL)', probability: 2, impact: 5, mitigation: 'سياسة خصوصيّة + أمان بيانات' },
    { name: 'شكوى من عميل أو موظف', probability: 3, impact: 3, mitigation: 'قنوات إبلاغ + خطّة استجابة' },
  ],
  SUPPORT: [
    { name: 'بطء استجابة الدعم', probability: 4, impact: 3, mitigation: 'زيادة الفريق + قاعدة معرفة' },
    { name: 'تكرار نفس المشاكل', probability: 4, impact: 3, mitigation: 'تحليل جذور الأسباب + إصلاح دائم' },
    { name: 'فقدان عملاء بسبب سوء الدعم', probability: 3, impact: 4, mitigation: 'مقاييس CSAT + خطط تحسين' },
    { name: 'ضغط عمل مرتفع على الفريق', probability: 4, impact: 3, mitigation: 'أتمتة + توسيع الفريق' },
  ],
}

interface Risk {
  id: string
  name: string
  probability: 1 | 2 | 3 | 4 | 5
  impact: 1 | 2 | 3 | 4 | 5
  mitigation: string
}

interface RiskData {
  risks: Risk[]
}

const EMPTY: RiskData = { risks: [] }

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

  useEffect(() => {
    getArtifact<RiskData>(companyId, 'RISK_REGISTER').then((row) => {
      if (row?.data?.risks) setData({ risks: row.data.risks })
    }).catch(() => undefined)
  }, [companyId])

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
  function remove(id: string) {
    setData((p) => ({ risks: p.risks.filter((r) => r.id !== id) }))
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
      .map((t) => ({ id: crypto.randomUUID(), ...t }))
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
              {/* ٢. من SWOT — إن أنجزته */}
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
                  ← إن كان SWOT جاهزاً
                </div>
              </button>
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

      <Card>
        <CardHeader>
          <CardTitle>الشبكة الحرارية (احتمالية × أثر)</CardTitle>
          <CardDescription>
            الصفوف = الأثر (يقل من أعلى لأسفل). الأعمدة = الاحتمالية (تزيد من اليمين لليسار).
          </CardDescription>
        </CardHeader>
        <CardContent>
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
          {data.risks.map((r) => {
            const score = r.probability * r.impact
            const tint = cellTint(score)
            return (
              <div key={r.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    className="min-w-[180px] flex-1"
                    value={r.name}
                    onChange={(e) => update(r.id, { name: e.target.value })}
                    placeholder="اسم الخطر…"
                  />
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">احتمالية</span>
                    <select
                      className="rounded-md border bg-background px-2 py-1"
                      value={r.probability}
                      onChange={(e) => update(r.id, { probability: Number(e.target.value) as Risk['probability'] })}
                    >
                      {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">أثر</span>
                    <select
                      className="rounded-md border bg-background px-2 py-1"
                      value={r.impact}
                      onChange={(e) => update(r.id, { impact: Number(e.target.value) as Risk['impact'] })}
                    >
                      {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tint.bg} ${tint.text}`}>
                    {tint.label} · {score}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>×</Button>
                </div>
                <Input
                  className="mt-2"
                  value={r.mitigation}
                  onChange={(e) => update(r.id, { mitigation: e.target.value })}
                  placeholder="إجراء التخفيف المقترح…"
                />
              </div>
            )
          })}
          {data.risks.length === 0 && (
            <p className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              لا توجد مخاطر مسجلة بعد.
            </p>
          )}
          <div className="flex justify-between pt-1">
            <Button variant="outline" size="sm" onClick={add}>+ خطر جديد</Button>
            <Button variant="outline" size="sm" onClick={importFromSWOT} disabled={importing || saving}>
              {importing ? 'جاري…' : '🧭 استورد من SWOT'}
            </Button>
            <Button onClick={save} disabled={saving || importing}>{saving ? 'جاري الحفظ…' : 'حفظ السجل'}</Button>
          </div>
        </CardContent>
      </Card>

      {ranked.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>أولوية المعالجة</CardTitle>
            <CardDescription>المخاطر مرتبة حسب احتمالية × أثر.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {ranked.slice(0, 10).map((r, i) => {
                const score = r.probability * r.impact
                const tint = cellTint(score)
                return (
                  <li key={r.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                    <span className="flex items-center gap-2">
                      <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground tabular-nums">{i + 1}</span>
                      <span className="font-medium">{r.name}</span>
                    </span>
                    <span className={`rounded-md px-2 py-0.5 text-xs ${tint.bg} ${tint.text}`}>
                      {tint.label} · {score}
                    </span>
                  </li>
                )
              })}
            </ol>
          </CardContent>
        </Card>
      )}
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
        return (
          <div
            key={p}
            className={`flex h-16 flex-col items-center justify-center rounded-md ${tint.bg} ${tint.text}`}
            title={`أثر ${impact} · احتمالية ${p} = ${score}`}
          >
            <span className="text-xs opacity-80">{tint.label}</span>
            <span className="text-lg font-bold tabular-nums">{cell.length || ''}</span>
          </div>
        )
      })}
    </>
  )
}
