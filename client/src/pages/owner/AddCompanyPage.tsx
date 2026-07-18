import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiErrorMessage } from '@/lib/api'
import { createCompany, listMyCompanies } from '@/lib/deptApi'
import { SECTORS } from '@/lib/onboardingOptions'
import { useAuthStore } from '@/store/authStore'
import { useDiagnosticStore } from '@/store/diagnosticStore'

const SIZES = [
  ['MICRO', 'متناهية الصغر (1–9)'],
  ['SMALL', 'صغيرة (10–49)'],
  ['MEDIUM', 'متوسطة (50–249)'],
  ['LARGE', 'كبيرة (250+)'],
] as const

// خيارات مرحلة الشركة — مطابقة لـ OwnerAnswers.stage في التشخيص
const STAGES = [
  ['struggle', 'متعثّرة — في وضع البقاء'],
  ['startup',  'ناشئة — أقل من سنتين'],
  ['scaling',  'متوسّعة — تنمو بسرعة'],
  ['stable',   'مستقرّة — راسخة ومربحة'],
] as const

// ─── مصادر مسبق-الملء لكل حقل ─────────────────────────────────────────
// نُبيّن للمستخدم من أين جاءت القيمة المقترحة حتى يعرف أنّه ليس مطالباً
// بإعادة الإجابة على أسئلة سبق أن أجابها.
type PrefillSource = 'diagnostic' | 'onboarding' | 'registration' | 'previousClient'
type PrefillMap = Partial<Record<'sector' | 'size' | 'country' | 'stage', PrefillSource>>

// ⚠️ تخصّص المدير ≠ قطاع العميل. مدير مالي قد يخدم عميلاً في التقنية
// أو التصنيع أو التجزئة. لا وجود لخريطة منطقيّة — نتركه للمستخدم أو
// نستنسخه من عميل سابق (نفس المدير يخدم قطاعاً مشابهاً غالباً).

// حجم الفريق في التشخيص (micro/small/medium/large) → حجم Company (MICRO/…/LARGE).
function teamSizeToCompanySize(v?: string): typeof SIZES[number][0] | null {
  if (v === 'micro') return 'MICRO'
  if (v === 'small') return 'SMALL'
  if (v === 'medium') return 'MEDIUM'
  if (v === 'large') return 'LARGE'
  return null
}

export function AddCompanyPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const draft = useAuthStore((s) => s.onboardingDraft)
  const diagnosticManagerDraft = useDiagnosticStore((s) => s.managerDraft)
  // 🆕 نقرأ أيضاً ownerDraft — لو المستخدم أجرى تشخيص المالك سابقاً
  // (حتى لو كان المستخدم الحاليّ مدير) فقد تكون هناك بيانات قطاع/مرحلة مخزّنة.
  const diagnosticOwnerDraft = useDiagnosticStore((s) => s.ownerDraft)
  const isPro = user?.userType === 'MANAGER' && user?.managerType === 'INDEPENDENT_PRO'

  // ─── حساب القيم الابتدائية من مصادر البيانات السابقة ─────────────
  // ترتيب الأولوية: draft (onboarding قبل الحفظ) → ownerDraft (من تشخيص المالك)
  //                → previousClient (يُملأ لاحقاً من API).
  // ملاحظة: لا نستنسخ القطاع من تخصّص المدير — تخصّصه (مالية/تسويق/…) لا يقول
  // شيئاً عن قطاع عميله (تقنية/تصنيع/تجزئة/…).
  const prefillFromDraft = draft.firstClientMeta
  const sizeFromDx = teamSizeToCompanySize(diagnosticManagerDraft.teamSize)
  // sector / stage من تشخيص المالك (إن أُجري)
  const sectorFromOwnerDx = diagnosticOwnerDraft.sector
  const stageFromOwnerDx = diagnosticOwnerDraft.stage
  // حجم من تشخيص المالك (SizeOption) — نطابقه مع SIZES
  const sizeFromOwnerDx: typeof SIZES[number][0] | null =
    diagnosticOwnerDraft.size === 'micro' ? 'MICRO'
    : diagnosticOwnerDraft.size === 'small' ? 'SMALL'
    : diagnosticOwnerDraft.size === 'medium' ? 'MEDIUM'
    : diagnosticOwnerDraft.size === 'large' ? 'LARGE'
    : null

  const initialSector = prefillFromDraft?.sector ?? sectorFromOwnerDx ?? ''
  const initialSize: typeof SIZES[number][0] =
    prefillFromDraft?.size ?? sizeFromDx ?? sizeFromOwnerDx ?? 'SMALL'
  const initialStage = stageFromOwnerDx ?? ''

  const initialSources: PrefillMap = {}
  if (prefillFromDraft?.sector) initialSources.sector = 'onboarding'
  else if (sectorFromOwnerDx) initialSources.sector = 'diagnostic'
  if (prefillFromDraft?.size) initialSources.size = 'onboarding'
  else if (sizeFromDx) initialSources.size = 'diagnostic'
  else if (sizeFromOwnerDx) initialSources.size = 'diagnostic'
  if (stageFromOwnerDx) initialSources.stage = 'diagnostic'

  const [name, setName] = useState('')
  const [sector, setSector] = useState(initialSector)
  const [size, setSize] = useState<typeof SIZES[number][0]>(initialSize)
  const [stage, setStage] = useState(initialStage)
  const [country, setCountry] = useState('SA')
  const [submitting, setSubmitting] = useState(false)
  const [sources, setSources] = useState<PrefillMap>(initialSources)

  // ─── محاولة إضافيّة: قراءة عملاء سابقين ونسخ القطاع/الحجم منهم ─────
  // المدير المستقل عادةً يخدم قطاعاً واحداً — لذا إذا لم تكن هناك بيانات
  // من draft/diagnostic، نُقلّد أوّل عميل سبق أن أضافه (إن وُجد).
  useEffect(() => {
    if (!isPro) return
    // لا نحتاج للاستدعاء إذا كان لدينا بالفعل قطاع أو حجم من مصدر سابق.
    if (initialSector && initialSize !== 'SMALL') return
    let cancelled = false
    listMyCompanies()
      .then((companies) => {
        if (cancelled || companies.length === 0) return
        const latest = companies[0] // مرتّبة على السيرفر — الأحدث أوّلاً
        const next: PrefillMap = {}
        if (!initialSector && latest.sector) {
          setSector(latest.sector)
          next.sector = 'previousClient'
        }
        if (initialSize === 'SMALL' && !prefillFromDraft?.size && !sizeFromDx && latest.size) {
          setSize(latest.size)
          next.size = 'previousClient'
        }
        if (latest.country && latest.country !== 'SA') {
          setCountry(latest.country)
          next.country = 'previousClient'
        }
        if (Object.keys(next).length > 0) {
          setSources((prev) => ({ ...prev, ...next }))
        }
      })
      .catch(() => { /* بلا مصدر إضافي — لا نُفشل الصفحة */ })
    return () => { cancelled = true }
    // نريد التنفيذ مرّة واحدة عند التحميل — القيم الابتدائية ثابتة أثناء عمر الفورم.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('اسم الشركة مطلوب')
      return
    }
    setSubmitting(true)
    try {
      await createCompany({
        name: name.trim(),
        sector: sector.trim() || undefined,
        size,
        stage: stage.trim() || undefined,
        country: country.trim() || 'SA',
      })
      toast.success(isPro ? 'تم إضافة العميل' : 'تم إنشاء الشركة')
      navigate(isPro ? '/manager/clients' : '/companies')
    } catch (err) {
      toast.error(apiErrorMessage(err, isPro ? 'تعذّر إضافة العميل' : 'تعذّر إنشاء الشركة'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={isPro ? 'إضافة عميل جديد' : 'إضافة شركة'}
        description={isPro
          ? 'أنشئ سجلّ عميل جديد ليظهر في «عملائي» وتفعّل عليه الأدوات الاستراتيجيّة.'
          : 'إنشاء كيان شركة جديد.'}
        breadcrumbs={isPro
          ? [{ label: 'عملائي', to: '/manager/clients' }, { label: 'إضافة عميل' }]
          : [{ label: 'الشركات', to: '/companies' }, { label: 'إضافة' }]}
      />

      {/* 📥 ملخّص «تمّ ملؤه من بياناتك السابقة» — يظهر عند وجود مصدر واحد على الأقلّ */}
      {Object.keys(sources).length > 0 && (
        <Card className="overflow-hidden border-2 border-sky-300 bg-gradient-to-l from-sky-50 to-transparent shadow-sm">
          <div className="h-1 bg-gradient-to-l from-sky-500 via-sky-400 to-transparent" />
          <CardContent className="p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-lg">📥</span>
              <span className="text-xs font-bold text-sky-900">
                استخدمنا بياناتك السابقة — لا حاجة لإعادة الإجابة
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-sky-800/80">
              الحقول التي عليها شارة <b>«📥 من ...»</b> جاءت من التشخيص أو التسجيل أو أوّل عميل أضفته.
              يمكنك تعديل أيّ حقل بحرّية قبل الإضافة.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 💡 توضيح للمدير المستقلّ: هذه بيانات العميل، ليست بياناتك الشخصيّة */}
      {isPro && Object.keys(sources).length === 0 && (
        <Card className="border-2 border-dashed border-amber-300 bg-amber-50/30">
          <CardContent className="flex items-start gap-3 p-3">
            <div className="text-xl">💡</div>
            <div className="flex-1 text-[11px] leading-relaxed text-amber-900">
              <b>هذه بيانات العميل الجديد — ليست بياناتك.</b> تشخيصك كمدير مستقلّ يوثّق تخصّصك (مثل «المالية»)،
              لكن كل عميل تديره له قطاعه ومرحلته الخاصّة.
              <b className="mt-0.5 block">سنستنسخ القطاع/الحجم تلقائياً من عميل سابق إن أضفته.</b>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden shadow-sm">
        <div className="h-1.5 bg-gradient-to-l from-indigo-500 via-sky-500 to-teal-500" />
        <CardHeader>
          <CardTitle>{isPro ? 'تفاصيل العميل' : 'تفاصيل الشركة'}</CardTitle>
          <CardDescription>القطاع والحجم والمرحلة تساعد في تخصيص التشخيص وتدقيق الامتثال.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="name">الاسم</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="شركتي" required />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="sector">القطاع</Label>
                {sources.sector && <SourceBadge source={sources.sector} />}
              </div>
              <select
                id="sector"
                className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                value={sector}
                onChange={(e) => {
                  setSector(e.target.value)
                  // تعديل المستخدم يُلغي علامة المصدر — أصبحت القيمة إدخاله.
                  setSources((prev) => ({ ...prev, sector: undefined }))
                }}
              >
                <option value="">اختر…</option>
                {SECTORS.map((s) => (
                  <option key={s.code} value={s.code}>{s.labelAr}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="size">حجم الكيان</Label>
                {sources.size && <SourceBadge source={sources.size} />}
              </div>
              <select
                id="size"
                className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                value={size}
                onChange={(e) => {
                  setSize(e.target.value as typeof SIZES[number][0])
                  setSources((prev) => ({ ...prev, size: undefined }))
                }}
              >
                {SIZES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="stage">مرحلة الشركة</Label>
                {sources.stage && <SourceBadge source={sources.stage} />}
              </div>
              <select
                id="stage"
                className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                value={stage}
                onChange={(e) => {
                  setStage(e.target.value)
                  setSources((prev) => ({ ...prev, stage: undefined }))
                }}
              >
                <option value="">اختر…</option>
                {STAGES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="country">الدولة (رمز ISO-2)</Label>
                {sources.country && <SourceBadge source={sources.country} />}
              </div>
              <Input id="country" dir="ltr" className="text-left" value={country} onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={submitting}>{submitting ? 'جاري الإنشاء…' : (isPro ? 'إضافة العميل' : 'إنشاء الشركة')}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── شارة صغيرة تشرح مصدر القيمة المسبقة الملء ─────────────────────
function SourceBadge({ source }: { source: PrefillSource }) {
  const meta: Record<PrefillSource, { label: string; className: string }> = {
    diagnostic:     { label: '📥 من تشخيصك',        className: 'border-sky-300 bg-sky-50 text-sky-700' },
    onboarding:     { label: '📥 من onboarding',    className: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
    registration:   { label: '📥 من تخصّصك',        className: 'border-violet-300 bg-violet-50 text-violet-700' },
    previousClient: { label: '📥 من عميلك السابق',  className: 'border-amber-300 bg-amber-50 text-amber-700' },
  }
  const m = meta[source]
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${m.className}`}>
      {m.label}
    </span>
  )
}
