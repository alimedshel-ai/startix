import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import type { DeptCode } from '@/lib/deptApi'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

interface Capability {
  id: string
  name: string
  description?: string
  maturity: 1 | 2 | 3 | 4 | 5
  isCore: boolean
}

interface CoreCapData {
  capabilities: Capability[]
}

const EMPTY: CoreCapData = { capabilities: [] }

const MATURITY_LABEL: Record<number, string> = {
  1: 'ضعيف جداً',
  2: 'ضعيف',
  3: 'متوسط',
  4: 'قوي',
  5: 'ممتاز',
}

const MATURITY_COLOR: Record<number, string> = {
  1: 'hsl(0 75% 55%)',
  2: 'hsl(25 85% 55%)',
  3: 'hsl(45 90% 55%)',
  4: 'hsl(150 60% 45%)',
  5: 'hsl(160 70% 40%)',
}

// S2.3 — قدرات مقترحة شائعة حسب تخصّص المدير المستقل.
// كل قدرة عندها اسم + وصف مقترح يفسّر معناها وأين تظهر — المدير ينقر →
// الاسم والوصف يُضافان معاً بنضج مبدئي = 3.
interface CapSuggestion { name: string; description: string }

const CAP_SUGGESTIONS: Partial<Record<DeptCode, CapSuggestion[]>> = {
  HR: [
    { name: 'استقطاب الكفاءات',    description: 'قدرة الشركة على جذب أفضل المرشّحين قبل المنافس — عبر العلامة كصاحب عمل، قنوات توظيف متعدّدة، وتجربة مرشّح متميّزة.' },
    { name: 'الاحتفاظ بالموظفين',  description: 'خفض معدل الدوران — عبر ثقافة عمل صحيّة، مسارات وظيفية واضحة، ومزايا تنافسية.' },
    { name: 'التطوير المهني',      description: 'برامج تدريب مستمر، Coaching، شهادات — تُحوّل الفريق من مؤدّي مهام إلى مصدر ميزة تنافسية.' },
    { name: 'ثقافة أداء',           description: 'مواءمة الأهداف الفردية مع الاستراتيجية + قياس دوري + مكافأة عادلة على النتائج.' },
    { name: 'قيادة تنفيذية',       description: 'مجموعة قيادات قادرة على تنفيذ التحوّلات واتخاذ قرارات استراتيجية سريعة.' },
    { name: 'توطين الكفاءات',       description: 'استقطاب وتطوير كوادر سعودية عالية الجودة تدعم رؤية 2030 وتخفض تكاليف الاعتماد الخارجي.' },
  ],
  FINANCE: [
    { name: 'التحكم في التكاليف',  description: 'رقابة تفصيلية على بنود المصروفات + تحديد الهدر + مقارنة بالمعايير القطاعية.' },
    { name: 'تحليل الربحية',        description: 'قياس ربحية كل منتج/عميل/قناة على حِدَة — يوجّه قرارات التسعير والاستثمار.' },
    { name: 'التخطيط المالي',       description: 'ميزانيات وتنبّؤات دقيقة تربط الأرقام باستراتيجية الأعمال، مع مرونة تعديل ديناميكية.' },
    { name: 'إدارة النقد',          description: 'ضبط دورة تحوّل النقد (DSO/DPO) وإدارة السيولة لتفادي مخاطر التوقف التشغيلي.' },
    { name: 'شفافية التقارير',      description: 'قوائم مالية دقيقة في وقتها، متوافقة مع IFRS، وقابلة للتدقيق الخارجي بسهولة.' },
    { name: 'إدارة المخاطر المالية', description: 'كشف مبكّر لمخاطر السوق/الائتمان/العملات + تحوّط منظّم + رأس مال احتياطي كافٍ.' },
  ],
  SALES: [
    { name: 'إغلاق الصفقات الكبيرة', description: 'منهجية مبيعات استشارية (Solution Selling) + فِرق حسابات رئيسية + قدرة على التفاوض التنفيذي.' },
    { name: 'توليد العملاء المحتملين', description: 'قنوات متعدّدة (رقمية + ميدانية + شراكات) تُنتج تدفّقاً مستمراً من الفرص المؤهَّلة.' },
    { name: 'التسعير الديناميكي',   description: 'أسعار مبنيّة على القيمة والمنافسة والطلب — تتكيّف مع كل شريحة عملاء وحالة سوق.' },
    { name: 'إدارة الحسابات الرئيسية', description: 'خطط سنوية لكل حساب استراتيجي مع مؤشّرات صحّة العميل، تحقيق نمو محفظة العميل، وحوكمة العلاقات.' },
    { name: 'التنبّؤ بالإيرادات',    description: 'دقة > 90% في توقّع مبيعات الربع — مبنيّة على منهجية BANT/MEDDIC وأدوات CRM.' },
    { name: 'قنوات بيع متعدّدة',    description: 'مزيج متوازن من البيع المباشر، الشركاء، والقنوات الرقمية — يقلّل الاعتماد على قناة واحدة.' },
  ],
  MARKETING: [
    { name: 'بناء العلامة التجارية', description: 'قصّة مقنعة + هوية مميّزة + حضور اتصالي متسق يُنشئ ولاءً وتفضيلاً على المنافس.' },
    { name: 'تسويق رقمي',           description: 'استخدام محكم لمزيج قنوات (SEO/SEM/Social/Email) + قياس ROAS + تحسين مستمر.' },
    { name: 'تحليل السوق',           description: 'أبحاث دورية للعملاء والمنافسين والاتجاهات — يوجّه قرارات المنتج والتسعير والتموضع.' },
    { name: 'قصص محتوى قوية',       description: 'محتوى ذو قيمة تعليمية/عاطفية يبني الثقة ويقصر دورة الشراء.' },
    { name: 'ولاء العملاء',          description: 'برامج مكافآت + Customer Success + NPS > 50 — تحوّل العميل الحالي لسفير للعلامة.' },
    { name: 'استهداف دقيق للجمهور', description: 'شرائح جمهور محدّدة بدقّة (Persona) + استخدام بيانات السلوك لعرض الرسالة الصحيحة.' },
  ],
  OPERATIONS: [
    { name: 'كفاءة سلاسل الإمداد', description: 'تصميم مُحكم لتدفّق المدخلات → الإنتاج → التسليم مع أدنى مخزون ممكن وأعلى موثوقية.' },
    { name: 'أتمتة العمليات',       description: 'استبدال مهام يدوية متكرّرة بـRPA/IoT/AI — يخفض الأخطاء ويحرّر الفريق للقيمة العالية.' },
    { name: 'ضبط الجودة',            description: 'SPC + Zero-Defect Mindset + سياسة CAPA فعّالة — يخفض الإرجاعات وشكاوى العملاء.' },
    { name: 'مرونة الإنتاج',        description: 'قدرة على تغيير حجم/نوع المخرجات بسرعة استجابة لتقلّبات الطلب دون كلفة مرتفعة.' },
    { name: 'إدارة السعة',           description: 'موازنة الاستخدام الأمثل للأصول والفريق مع الحفاظ على مرونة تُلبّي الذروة.' },
    { name: 'Lean/Six Sigma',       description: 'ثقافة تحسين مستمر + إزالة الهدر (Muda) + قرارات مبنيّة على بيانات — تخفض التكلفة وترفع الجودة.' },
  ],
  IT: [
    { name: 'أمن سيبراني',          description: 'حماية متعدّدة الطبقات (Zero Trust) + استجابة سريعة للحوادث + امتثال ISO 27001 و NCA.' },
    { name: 'موثوقية البنية التحتية', description: 'Uptime > 99.9% + مراقبة استباقية + خطة تعافي كوارث (DRP) مُختبَرة دورياً.' },
    { name: 'تكامل الأنظمة',         description: 'APIs موحّدة + منصّة تكامل + بيانات موحّدة (Golden Record) تربط كل أنظمة الأعمال.' },
    { name: 'DevOps وسرعة النشر',   description: 'CI/CD ناضج + إصدار متكرر + إمكانية Zero-Downtime — يقصر دورة تسليم القيمة.' },
    { name: 'الذكاء الاصطناعي وتحليل البيانات', description: 'قدرة على استخراج رؤى قابلة للتنفيذ من بيانات الأعمال + نماذج تنبّؤية.' },
    { name: 'الحوسبة السحابية',     description: 'Cloud-Native + Auto-Scaling + Multi-Region + FinOps — مرونة عالية بتكلفة مُحكَمة.' },
  ],
  CUSTOMER_SERVICE: [
    { name: 'حل شكاوى سريع (FCR)', description: 'نسبة حلّ من أول اتصال ≥ 70% — يخفض تكاليف التكرار ويرفع رضا العملاء.' },
    { name: 'رضا العملاء العالي',   description: 'CSAT ≥ 85% + NPS ≥ 50 مستمر — دليل على تجربة عميل استثنائية.' },
    { name: 'دعم متعدّد القنوات',   description: 'قنوات موحّدة (Omnichannel): هاتف/شات/بريد/سوشيال — تجربة سلسة عبر كل نقاط الاتصال.' },
    { name: 'قاعدة معرفة قوية',      description: 'مقالات + سيناريوهات + Self-service — تُقلّل التذاكر وتُسرّع الحل.' },
    { name: 'تدريب الفريق',          description: 'برامج Coaching + Simulation + مسار مهني — يخفض الدوران ويرفع جودة التفاعل.' },
    { name: 'تخصيص الخدمة',          description: 'استخدام تاريخ العميل وتفضيلاته لتقديم خدمة مخصّصة — يرفع الولاء بشكل كبير.' },
  ],
  SUPPORT: [
    { name: 'إدارة المشتريات',       description: 'e-Procurement + كتالوج موحّد + سير عمل معتمد — يخفض التكلفة ويسرّع الدورة.' },
    { name: 'تفاوض مع المورّدين',    description: 'قدرة على انتزاع شروط أفضل (سعر/جودة/تسليم) عبر استخدام الحجم وتحليل السوق.' },
    { name: 'إدارة الأصول',          description: 'سجل موحّد + صيانة استباقية + تحسين استخدام — يرفع العمر ويخفض التكلفة الإجمالية (TCO).' },
    { name: 'صيانة استباقية',        description: 'IoT + تحليل تنبّؤي — إصلاح قبل التعطّل، يخفض توقف العمليات إلى أدنى مستوى.' },
    { name: 'إدارة العقود',          description: 'CLM ذكي + تنبيهات تجديد + مراجعة قانونية — يمنع الالتزامات غير المرغوبة.' },
    { name: 'دعم لوجستي',            description: 'قدرة على تلبية طلبات الأقسام الأخرى بسرعة ودقّة، بلا اختناقات.' },
  ],
  LOGISTICS: [
    { name: 'شبكة توزيع واسعة',      description: 'مراكز/شركاء يغطّون كل المناطق المستهدفة — يخفض زمن التسليم ويوسّع الوصول.' },
    { name: 'كفاءة تسليم OTIF',      description: 'التسليم في الموعد بالجودة الكاملة ≥ 95% — عامل تنافسي حاسم في B2B/B2C.' },
    { name: 'إدارة المخزون',         description: 'دقة جرد ≥ 99% + دوران عالي + توازن (تجنّب النقص والفائض).' },
    { name: 'أتمتة المستودعات',     description: 'WMS + Barcode/RFID + AGVs — يرفع الإنتاجية ويخفض الأخطاء.' },
    { name: 'تنويع الناقلين',        description: 'شراكات مع عدّة ناقلين تخفض الاعتماد وترفع القدرة على التفاوض.' },
    { name: 'تتبّع الشحنات',         description: 'GPS + رؤية لحظية للعميل — يبني الثقة ويقلّل استفسارات الدعم.' },
  ],
  QUALITY: [
    { name: 'شهادات ISO',            description: 'ISO 9001 + شهادات قطاعية (IATF/FSSC/…) — يفتح أسواقاً ويرفع الثقة.' },
    { name: 'خفض معدل العيوب',       description: 'DPMO منخفض (Six Sigma) — يخفض تكاليف عدم المطابقة وشكاوى العملاء.' },
    { name: 'ضبط عمليات SPC',        description: 'مراقبة إحصائية حيّة للعمليات — يكشف الانحرافات قبل تحوّلها لعيوب.' },
    { name: 'CAPA فعّال',             description: 'إجراءات تصحيح ووقاية مبنيّة على السبب الجذري — تمنع تكرار المشكلات.' },
    { name: 'ثقافة جودة شاملة',      description: 'كل موظف مسؤول عن الجودة — تُدمج في كل قرار وعملية.' },
    { name: 'تدقيق مستمر',           description: 'تدقيقات داخلية دورية + خارجية سنوية — تحافظ على الشهادات وتُحسّن باستمرار.' },
  ],
  PROJECTS: [
    { name: 'تسليم في الموعد',       description: 'دقة توقّع + إدارة مخاطر استباقية — نسبة تسليم في الموعد ≥ 90%.' },
    { name: 'ضمن الميزانية',         description: 'انحراف ميزانية ≤ 5% — دليل على تقدير دقيق وإدارة تكاليف محكمة.' },
    { name: 'إدارة المخاطر',         description: 'سجل مخاطر + تحليل كمّي (Monte Carlo) + خطط استجابة — يخفض المفاجآت.' },
    { name: 'PMO ناضج',              description: 'حوكمة موحّدة + منهجيات + قوالب + مؤشّرات محفظة — يرفع نجاح المشاريع.' },
    { name: 'منهجية مرنة (Agile)',    description: 'قدرة على التسليم التدريجي والتكيّف مع التغيّر — مناسبة للمشاريع الرقمية.' },
    { name: 'إدارة أصحاب المصلحة',   description: 'خرائط تأثير + خطط تواصل + إدارة التوقّعات — تخفض المقاومة وترفع القبول.' },
  ],
  COMPLIANCE: [
    { name: 'التزام ZATCA',          description: 'فواتير إلكترونية + إقرارات دقيقة في الموعد — يجنّب الغرامات والتوقّف.' },
    { name: 'التزام GOSI',            description: 'التسجيل الصحيح + الاشتراكات الدقيقة + إجراءات نهاية الخدمة الصحيحة.' },
    { name: 'حماية البيانات PDPL',    description: 'موافقة صريحة + حقوق أصحاب البيانات + أمان تقني — يجنّب غرامات ثقيلة.' },
    { name: 'مراجعة داخلية',          description: 'وظيفة تدقيق داخلي مستقلّة + تقارير للجنة تدقيق + متابعة توصيات.' },
    { name: 'أخلاقيات وحوكمة',       description: 'مدوّنة سلوك + آلية إبلاغ عن المخالفات + تدريب دوري — تبني السمعة.' },
    { name: 'التزام قطاعي متخصّص',    description: 'التزام باللوائح الخاصة بالقطاع (SAMA/CMA/SFDA/…) — يفتح ترخيصاً للعمل.' },
  ],
  GOVERNANCE: [
    { name: 'فعالية مجلس الإدارة',   description: 'أعضاء ذوو خبرة متنوّعة + اجتماعات منتظمة + قرارات موثّقة + متابعة تنفيذ.' },
    { name: 'استقلالية اللجان',      description: 'لجنة تدقيق + مخاطر + مكافآت مستقلّة عن الإدارة التنفيذية — رقابة موضوعية.' },
    { name: 'إفصاح شفاف',            description: 'تقارير سنوية شاملة + إفصاح مستمر عن الأحداث الجوهرية — يبني ثقة المساهمين والسوق.' },
    { name: 'إدارة المخاطر المؤسسية', description: 'ERM ناضج + مصفوفة مخاطر + خطط استجابة على مستوى المجلس.' },
    { name: 'تدقيق داخلي مستقل',      description: 'وظيفة تدقيق تتبع اللجنة مباشرة + خطة سنوية موافق عليها + متابعة تنفيذ.' },
    { name: 'قيم أخلاقية معتمَدة',    description: 'قيم مؤسسية معلنة + آلية تطبيق + ثقافة تدعمها — تبني سمعة طويلة الأمد.' },
  ],
}

export function CoreCapabilitiesPage() {
  return (
    <StrategicShell
      title="القدرات الجوهرية"
      description="القدرات التي تميّز شركتك عن المنافسين. حدّد قدرة، قيّم نضجها، وحدد إن كانت جوهرية."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const user = useAuthStore((s) => s.user)
  const specialty = user?.specialtyDeptType ?? null
  const suggestions = specialty ? CAP_SUGGESTIONS[specialty] ?? [] : []
  const [data, setData] = useState<CoreCapData>(EMPTY)
  const [saving, setSaving] = useState(false)

  function addSuggestion(s: CapSuggestion) {
    if (data.capabilities.some((c) => c.name === s.name)) return
    setData((p) => ({
      capabilities: [
        ...p.capabilities,
        { id: crypto.randomUUID(), name: s.name, description: s.description, maturity: 3, isCore: false },
      ],
    }))
  }

  function addAllSuggestions() {
    const existing = new Set(data.capabilities.map((c) => c.name))
    const toAdd = suggestions.filter((s) => !existing.has(s.name))
    if (toAdd.length === 0) return
    setData((p) => ({
      capabilities: [
        ...p.capabilities,
        ...toAdd.map((s) => ({
          id: crypto.randomUUID(),
          name: s.name,
          description: s.description,
          maturity: 3 as const,
          isCore: false,
        })),
      ],
    }))
  }

  useEffect(() => {
    getArtifact<CoreCapData>(companyId, 'CORE_CAPABILITIES').then((row) => {
      if (row?.data) setData({ capabilities: row.data.capabilities ?? [] })
    })
  }, [companyId])

  function add() {
    setData((p) => ({
      capabilities: [
        ...p.capabilities,
        { id: crypto.randomUUID(), name: '', description: '', maturity: 3, isCore: false },
      ],
    }))
  }
  function update(id: string, patch: Partial<Capability>) {
    setData((p) => ({
      capabilities: p.capabilities.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))
  }
  function remove(id: string) {
    setData((p) => ({ capabilities: p.capabilities.filter((c) => c.id !== id) }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'CORE_CAPABILITIES', data)
      toast.success('تم حفظ القدرات')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  const chartData = data.capabilities
    .filter((c) => c.name.trim())
    .map((c) => ({ name: c.name, maturity: c.maturity, isCore: c.isCore }))
    .sort((a, b) => b.maturity - a.maturity)

  const coreCount = data.capabilities.filter((c) => c.isCore).length
  const avgMaturity = data.capabilities.length === 0
    ? 0
    : Math.round((data.capabilities.reduce((s, c) => s + c.maturity, 0) / data.capabilities.length) * 20)

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-fuchsia-200 bg-gradient-to-br from-fuchsia-500/10 to-transparent">
          <CardHeader>
            <CardDescription>إجمالي القدرات</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-fuchsia-700">{data.capabilities.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-amber-200 bg-gradient-to-br from-amber-500/10 to-transparent">
          <CardHeader>
            <CardDescription>القدرات الجوهرية</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-amber-700">{coreCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-500/10 to-transparent">
          <CardHeader>
            <CardDescription>متوسط النضج</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-emerald-700">{avgMaturity}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {suggestions.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm">💡 قدرات مقترحة لتخصّصك</CardTitle>
              <CardDescription>كل قدرة تأتي باسم + وصف مقترح. انقر لإضافتها، ثم صنّف الجوهرية.</CardDescription>
            </div>
            {suggestions.some((s) => !data.capabilities.find((c) => c.name === s.name)) && (
              <Button size="sm" onClick={addAllSuggestions}>
                ＋ أضِف الكل ({suggestions.filter((s) => !data.capabilities.find((c) => c.name === s.name)).length})
              </Button>
            )}
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {suggestions.map((s) => {
              const already = data.capabilities.some((c) => c.name === s.name)
              return (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => addSuggestion(s)}
                  disabled={already}
                  className={`rounded-lg border p-3 text-right transition ${
                    already
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-primary/30 bg-card hover:border-primary hover:bg-primary/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{s.name}</span>
                    <span className="text-xs">{already ? '✓ مُضاف' : '＋ إضافة'}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {s.description}
                  </p>
                </button>
              )
            })}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>القدرات</CardTitle>
            <CardDescription>أضف قدرة جوهرية، قيّم نضجها، وميّزها كجوهرية إذا كانت تميّزك تنافسياً.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.capabilities.map((c) => (
              <div key={c.id} className="rounded-xl border bg-card p-3 transition hover:shadow-sm">
                <div className="flex items-center gap-2">
                  <Input
                    value={c.name}
                    placeholder="اسم القدرة (مثال: تطوير منتج سريع)"
                    onChange={(e) => update(c.id, { name: e.target.value })}
                    className="flex-1"
                  />
                  <label className="flex shrink-0 items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs">
                    <input
                      type="checkbox"
                      checked={c.isCore}
                      onChange={(e) => update(c.id, { isCore: e.target.checked })}
                    />
                    جوهرية
                  </label>
                  <select
                    className="rounded-md border bg-background px-2 py-1 text-xs"
                    value={c.maturity}
                    onChange={(e) => update(c.id, { maturity: Number(e.target.value) as Capability['maturity'] })}
                  >
                    {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v} — {MATURITY_LABEL[v]}</option>)}
                  </select>
                  <Button variant="ghost" size="sm" onClick={() => remove(c.id)}>×</Button>
                </div>
                <Textarea
                  rows={2}
                  className="mt-2"
                  value={c.description ?? ''}
                  onChange={(e) => update(c.id, { description: e.target.value })}
                  placeholder="وصف اختياري للقدرة وأين تظهر…"
                />
              </div>
            ))}
            {data.capabilities.length === 0 && (
              <p className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                لا توجد قدرات بعد. ابدأ بإضافة 5–10 قدرات تميّز شركتك.
              </p>
            )}
            <div className="flex justify-between pt-1">
              <Button variant="outline" size="sm" onClick={add}>+ قدرة جديدة</Button>
              <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ'}</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>الرسم البياني</CardTitle>
            <CardDescription>القدرات مرتبة حسب النضج.</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">أدخل قدرة وأعطها اسماً لرؤيتها هنا.</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 32 + 40)}>
                <BarChart data={chartData} layout="vertical" margin={{ right: 12, left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="maturity" radius={[0, 6, 6, 0]}>
                    {chartData.map((d, i) => (
                      <rect key={i} fill={MATURITY_COLOR[d.maturity]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
