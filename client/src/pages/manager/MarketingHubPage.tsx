import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useClientScopedCompany } from '@/hooks/useClientScopedCompany'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'
import type { StrategyPath } from '@/types/user'

// ─── مركز التسويق — للمدير المستقل بتخصّص MARKETING فقط ──────────
// يجمع في صفحة واحدة:
//   ١. هوية العلامة (شعار، اسم، شعار نصّي، موقع/متجر)
//   ٢. قنوات التواصل الاجتماعي (٧ قنوات رئيسيّة)
//   ٣. مقاييس فنيّة (SEO/CVR/ROAS/CAC/LTV)
//   ٤. تحليل إداري (فريق، ميزانية شهريّة، أدوات)
//   ٥. ٣ خطط: تشغيلي (٩٠ يوم) · تكتيكي (٣-١٢ شهر) · استراتيجي (١-٣+ سنوات)
// كل خطة قابلة للتوليد التلقائي بحسب هوية العلامة ومقاييسها ومسار المدير.

type PlanKey = 'operational' | 'tactical' | 'strategic'

interface SocialHandles {
  twitter: string
  instagram: string
  linkedin: string
  tiktok: string
  youtube: string
  facebook: string
  snapchat: string
}

interface Brand {
  name: string
  logoUrl: string
  taglineAr: string
  websiteUrl: string
  storeUrl: string
  storePlatform: string   // Shopify / Salla / Zid / Custom
  targetAudienceAr: string
}

interface TechMetrics {
  seoScore: string           // 0-100
  organicMonthly: string     // زيارات
  cvr: string                 // معدل التحويل %
  romi: string                // العائد على الإنفاق التسويقي
  cac: string                 // تكلفة اكتساب العميل
  ltv: string                 // قيمة العميل مدى الحياة
  brandAwarenessScore: string
}

interface AdminAnalysis {
  teamSize: string
  monthlyBudgetSAR: string
  tools: string        // نصّ حرّ متعدّد الأسطر
  capacityHoursMonth: string
}

interface MarketingHubData {
  brand: Brand
  socials: SocialHandles
  tech: TechMetrics
  admin: AdminAnalysis
  plans: Record<PlanKey, string>   // نصّ الخطة (يقبل تعديلاً حرّاً)
}

const EMPTY: MarketingHubData = {
  brand: { name: '', logoUrl: '', taglineAr: '', websiteUrl: '', storeUrl: '', storePlatform: '', targetAudienceAr: '' },
  socials: { twitter: '', instagram: '', linkedin: '', tiktok: '', youtube: '', facebook: '', snapchat: '' },
  tech: { seoScore: '', organicMonthly: '', cvr: '', romi: '', cac: '', ltv: '', brandAwarenessScore: '' },
  admin: { teamSize: '', monthlyBudgetSAR: '', tools: '', capacityHoursMonth: '' },
  plans: { operational: '', tactical: '', strategic: '' },
}

const SOCIALS_META: { key: keyof SocialHandles; icon: string; labelAr: string; placeholder: string }[] = [
  { key: 'twitter',   icon: '𝕏',   labelAr: 'X (Twitter)',   placeholder: '@company_handle' },
  { key: 'instagram', icon: '📷', labelAr: 'Instagram',      placeholder: '@instagram_handle' },
  { key: 'linkedin',  icon: '💼', labelAr: 'LinkedIn',       placeholder: 'linkedin.com/company/…' },
  { key: 'tiktok',    icon: '🎵', labelAr: 'TikTok',          placeholder: '@tiktok_handle' },
  { key: 'youtube',   icon: '▶️', labelAr: 'YouTube',        placeholder: 'youtube.com/@channel' },
  { key: 'facebook',  icon: '👥', labelAr: 'Facebook',        placeholder: 'facebook.com/…' },
  { key: 'snapchat',  icon: '👻', labelAr: 'Snapchat',        placeholder: '@snap_handle' },
]

const PLAN_META: Record<PlanKey, { icon: string; labelAr: string; horizonAr: string; descAr: string }> = {
  operational: { icon: '⚙️', labelAr: 'الخطة التشغيليّة', horizonAr: '٠-٩٠ يوم',    descAr: 'المهام اليوميّة/الأسبوعيّة/الشهريّة — من ينشر ماذا ومتى، ما الحملات الجارية، ما الاجتماعات.' },
  tactical:    { icon: '🎯', labelAr: 'الخطة التكتيكيّة', horizonAr: '٣-١٢ شهر',    descAr: 'الحملات الفصليّة، إطلاقات المنتجات، الشراكات، مواسم البيع.' },
  strategic:   { icon: '🔭', labelAr: 'الخطة الاستراتيجيّة', horizonAr: '١-٣+ سنوات', descAr: 'موقع العلامة في السوق، القنوات الجديدة، التوسّع، إعادة بناء الهويّة.' },
}

export function MarketingHubPage() {
  const user = useAuthStore((s) => s.user)
  const scope = useClientScopedCompany()
  const specialty = user?.specialtyDeptType
  const strategyPath = user?.strategyPath ?? null
  const [data, setData] = useState<MarketingHubData>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    if (!scope.company || specialty !== 'MARKETING') return
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const art = await getArtifact<MarketingHubData>(scope.company!.id, `MARKETING_HUB_MARKETING`)
        if (!alive) return
        if (art?.data) {
          setData({
            brand: { ...EMPTY.brand, ...(art.data.brand ?? {}) },
            socials: { ...EMPTY.socials, ...(art.data.socials ?? {}) },
            tech: { ...EMPTY.tech, ...(art.data.tech ?? {}) },
            admin: { ...EMPTY.admin, ...(art.data.admin ?? {}) },
            plans: { ...EMPTY.plans, ...(art.data.plans ?? {}) },
          })
          setSavedAt(art.updatedAt)
        }
      } catch (err) {
        if (alive) toast.error(apiErrorMessage(err, 'تعذّر تحميل مركز التسويق'))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [scope.company, specialty])

  async function save() {
    if (!scope.company) return
    setSaving(true)
    try {
      const art = await upsertArtifact(scope.company.id, `MARKETING_HUB_MARKETING`, data)
      setSavedAt(art.updatedAt)
      toast.success('تم حفظ مركز التسويق.')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  function generatePlan(key: PlanKey) {
    const generated = buildPlan(key, data, strategyPath)
    setData((p) => ({ ...p, plans: { ...p.plans, [key]: generated } }))
    toast.success(`🧠 وُلّدت ${PLAN_META[key].labelAr} — راجعها وعدّل.`)
  }

  // الوصول متاح فقط لتخصّص MARKETING.
  if (specialty !== 'MARKETING') {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="مركز التسويق" />
        <EmptyState
          title="هذه الصفحة لتخصّص التسويق فقط"
          description="غيّر تخصّصك من إعدادات الحساب لتصل إلى مركز التسويق."
        />
      </div>
    )
  }

  if (scope.loading || loading) return <LoadingSpinner fullPage label="جاري تحميل مركز التسويق…" />

  if (!scope.company) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="مركز التسويق" />
        <EmptyState
          title={scope.error ?? 'اختر عميلاً أوّلاً'}
          description="افتح عميلاً من قائمتك ثم افتح مركز التسويق."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`مركز التسويق — ${scope.company.name}`}
        description={savedAt ? `آخر حفظ ${new Date(savedAt).toLocaleString('ar-SA')}` : 'ابدأ بتعبئة هويّة العلامة، ثم القنوات والمقاييس، ثم ولّد الخطط.'}
        breadcrumbs={[
          { label: 'عملائي', to: '/manager/clients' },
          { label: scope.company.name, to: `/manager/clients/${scope.company.id}` },
          { label: 'مركز التسويق' },
        ]}
      />

      {/* بطاقة تعريف */}
      <Card className="border-primary/20 bg-gradient-to-l from-primary/5 to-transparent">
        <CardContent className="p-4 text-xs leading-relaxed">
          <div className="flex items-start gap-3">
            <div className="text-2xl leading-none">📣</div>
            <div className="flex-1">
              <div className="text-sm font-bold text-foreground">ما هو مركز التسويق؟</div>
              <p className="mt-1 text-muted-foreground">
                لوحة موحّدة تجمع <b className="text-foreground">هويّة العلامة</b> (الشعار، المتجر، القنوات) +
                <b className="text-foreground"> المقاييس الفنيّة</b> (SEO، CTR، ROMI) +
                <b className="text-foreground"> التحليل الإداري</b> (فريق، ميزانية) —
                ثم تُوَلَّد ٣ خطط بمستويات مختلفة: <b>تشغيلي</b> (٩٠ يوم) · <b>تكتيكي</b> (٣-١٢ شهر) · <b>استراتيجي</b> (١-٣+ سنوات).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── ١. هويّة العلامة ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🎨 ١. هويّة العلامة (Brand Identity)</CardTitle>
          <CardDescription>الشعار + الاسم + الشعار النصّي + المتجر — الأساس لكل رسالة تسويقيّة.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="b_name">اسم العلامة</Label>
            <Input id="b_name" value={data.brand.name} onChange={(e) => setData((p) => ({ ...p, brand: { ...p.brand, name: e.target.value } }))} placeholder="مثال: نون / سلة / …" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="b_logo">الشعار — رابط أو رفع مباشر</Label>
            <Input id="b_logo" type="url" value={data.brand.logoUrl.startsWith('data:') ? '' : data.brand.logoUrl} onChange={(e) => setData((p) => ({ ...p, brand: { ...p.brand, logoUrl: e.target.value } }))} placeholder="https://example.com/logo.png" />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted">
                <span>📤</span>
                <span>رفع شعار من جهازك</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    // حجم الحدّ الأقصى: ٥٠٠ كيلوبايت — كافٍ لشعار مضغوط.
                    if (file.size > 500 * 1024) {
                      toast.error(`الملف كبير (${Math.round(file.size / 1024)}KB) — الحدّ الأقصى ٥٠٠KB. اضغط الصورة أو استعمل SVG.`)
                      e.target.value = ''
                      return
                    }
                    const reader = new FileReader()
                    reader.onload = () => {
                      const dataUrl = reader.result as string
                      setData((p) => ({ ...p, brand: { ...p.brand, logoUrl: dataUrl } }))
                      toast.success(`رُفع ${file.name} (${Math.round(file.size / 1024)}KB)`)
                    }
                    reader.onerror = () => toast.error('تعذّرت قراءة الملف.')
                    reader.readAsDataURL(file)
                    e.target.value = ''
                  }}
                />
              </label>
              {data.brand.logoUrl.startsWith('data:') && (
                <>
                  <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                    ✓ شعار مرفوع مباشرة
                  </span>
                  <button
                    type="button"
                    onClick={() => setData((p) => ({ ...p, brand: { ...p.brand, logoUrl: '' } }))}
                    className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                  >
                    ✕ إزالة
                  </button>
                </>
              )}
            </div>
            <div className="text-[10px] leading-relaxed text-muted-foreground">
              PNG · JPG · WebP · SVG (بحدّ ٥٠٠KB). الشعارات المرفوعة تُحفَظ داخل بيانات مركز التسويق.
            </div>
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="b_tag">الشعار النصّي / Slogan</Label>
            <Input id="b_tag" value={data.brand.taglineAr} onChange={(e) => setData((p) => ({ ...p, brand: { ...p.brand, taglineAr: e.target.value } }))} placeholder="مثال: كل ما تحتاجه، بضغطة زر." />
          </div>
          <div className="space-y-1">
            <Label htmlFor="b_web">الموقع الإلكتروني</Label>
            <Input id="b_web" type="url" value={data.brand.websiteUrl} onChange={(e) => setData((p) => ({ ...p, brand: { ...p.brand, websiteUrl: e.target.value } }))} placeholder="https://example.com" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="b_store">رابط المتجر الإلكتروني</Label>
            <Input id="b_store" type="url" value={data.brand.storeUrl} onChange={(e) => setData((p) => ({ ...p, brand: { ...p.brand, storeUrl: e.target.value } }))} placeholder="https://store.example.com" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="b_plat">منصّة المتجر</Label>
            <select
              id="b_plat"
              className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
              value={data.brand.storePlatform}
              onChange={(e) => setData((p) => ({ ...p, brand: { ...p.brand, storePlatform: e.target.value } }))}
            >
              <option value="">اختر…</option>
              <option value="Salla">سلّة</option>
              <option value="Zid">زد</option>
              <option value="Shopify">Shopify</option>
              <option value="WooCommerce">WooCommerce</option>
              <option value="Custom">مخصّص</option>
              <option value="None">لا متجر</option>
            </select>
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="b_aud">الجمهور المستهدف (وصف موجز)</Label>
            <Textarea
              id="b_aud" rows={2}
              value={data.brand.targetAudienceAr}
              onChange={(e) => setData((p) => ({ ...p, brand: { ...p.brand, targetAudienceAr: e.target.value } }))}
              placeholder="مثال: نساء ٢٥-٤٥ في السعودية، مهتمّات بالجمال والعناية الشخصيّة، دخل متوسط-عالٍ."
            />
          </div>

          {/* معاينة الشعار */}
          {data.brand.logoUrl && (
            <div className="md:col-span-2 rounded-lg border bg-muted/20 p-3">
              <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">معاينة الشعار</div>
              <div className="flex items-center gap-3">
                <img src={data.brand.logoUrl} alt="logo" className="max-h-16 max-w-32 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                <div>
                  <div className="text-base font-bold">{data.brand.name || '—'}</div>
                  <div className="text-xs text-muted-foreground">{data.brand.taglineAr || '—'}</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── ٢. قنوات التواصل الاجتماعي ─────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📱 ٢. قنوات التواصل الاجتماعي</CardTitle>
          <CardDescription>الحسابات النشطة — تُستخدم لبناء الخطط وتحليل الأداء.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2">
          {SOCIALS_META.map((s) => (
            <div key={s.key} className="space-y-1">
              <Label className="flex items-center gap-1.5 text-xs">
                <span className="text-base">{s.icon}</span>
                {s.labelAr}
              </Label>
              <Input
                value={data.socials[s.key]}
                onChange={(e) => setData((p) => ({ ...p, socials: { ...p.socials, [s.key]: e.target.value } }))}
                placeholder={s.placeholder}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ─── ٣. التحليل الفنّي ────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🧪 ٣. التحليل الفنّي — مقاييس أداء التسويق</CardTitle>
          <CardDescription>
            المقاييس الرئيسيّة لصحّة قناتك التسويقيّة. اتركها فارغة إن لم تقس بعد — الخطط ستُوصي بقياسها.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <MetricInput label="نتيجة SEO (٠-١٠٠)" value={data.tech.seoScore}
            onChange={(v) => setData((p) => ({ ...p, tech: { ...p.tech, seoScore: v } }))} placeholder="مثال: 75" hint="جودة الموقع وترتيبه في محرّكات البحث" />
          <MetricInput label="زيارات عضويّة/شهر" value={data.tech.organicMonthly}
            onChange={(v) => setData((p) => ({ ...p, tech: { ...p.tech, organicMonthly: v } }))} placeholder="مثال: 50000" hint="حجم الحركة من محركات البحث بلا إعلانات" />
          <MetricInput label="معدّل التحويل %" value={data.tech.cvr}
            onChange={(v) => setData((p) => ({ ...p, tech: { ...p.tech, cvr: v } }))} placeholder="مثال: 2.5" hint="من الزوّار إلى مشترين" />
          <MetricInput label="ROMI (عائد الإنفاق) ×" value={data.tech.romi}
            onChange={(v) => setData((p) => ({ ...p, tech: { ...p.tech, romi: v } }))} placeholder="مثال: 4" hint="كل ريال ننفقه → كم ريال يعود؟ ≥٣ صحّي" />
          <MetricInput label="CAC (تكلفة اكتساب) SAR" value={data.tech.cac}
            onChange={(v) => setData((p) => ({ ...p, tech: { ...p.tech, cac: v } }))} placeholder="مثال: 150" hint="تكلفة كسب عميل واحد" />
          <MetricInput label="LTV (قيمة العميل) SAR" value={data.tech.ltv}
            onChange={(v) => setData((p) => ({ ...p, tech: { ...p.tech, ltv: v } }))} placeholder="مثال: 800" hint="إجمالي إنفاق العميل خلال علاقته معك" />
          <MetricInput label="وعي العلامة (٠-١٠٠)" value={data.tech.brandAwarenessScore}
            onChange={(v) => setData((p) => ({ ...p, tech: { ...p.tech, brandAwarenessScore: v } }))} placeholder="مثال: 40" hint="كم ٪ من جمهورك يعرف علامتك" />
        </CardContent>
        {/* تحليل سريع لصحّة CAC vs LTV */}
        {data.tech.cac && data.tech.ltv && Number(data.tech.cac) > 0 && (
          <CardContent className="pt-0">
            <LTVCACRatio cac={Number(data.tech.cac)} ltv={Number(data.tech.ltv)} />
          </CardContent>
        )}
      </Card>

      {/* ─── ٤. التحليل الإداري ───────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">👥 ٤. التحليل الإداري — قدرات الفريق</CardTitle>
          <CardDescription>حجم الفريق + الميزانية + الأدوات — أساس تقدير قدرة التنفيذ.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <MetricInput label="حجم فريق التسويق" value={data.admin.teamSize}
            onChange={(v) => setData((p) => ({ ...p, admin: { ...p.admin, teamSize: v } }))} placeholder="مثال: 4" />
          <MetricInput label="الميزانية الشهريّة (SAR)" value={data.admin.monthlyBudgetSAR}
            onChange={(v) => setData((p) => ({ ...p, admin: { ...p.admin, monthlyBudgetSAR: v } }))} placeholder="مثال: 50000" />
          <MetricInput label="ساعات العمل المتاحة/شهر (جميع الفريق)" value={data.admin.capacityHoursMonth}
            onChange={(v) => setData((p) => ({ ...p, admin: { ...p.admin, capacityHoursMonth: v } }))} placeholder="مثال: 640" hint="عدد الفريق × ١٦٠ ساعة عمل شهريّة" />
          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="a_tools">الأدوات المستخدمة</Label>
            <Textarea
              id="a_tools" rows={2}
              value={data.admin.tools}
              onChange={(e) => setData((p) => ({ ...p, admin: { ...p.admin, tools: e.target.value } }))}
              placeholder="مثال: HubSpot, Meta Ads Manager, Google Ads, Canva, Buffer…"
            />
          </div>
        </CardContent>
      </Card>

      {/* ─── ٥. الخطط الثلاث ───────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {(['operational', 'tactical', 'strategic'] as PlanKey[]).map((key) => {
          const meta = PLAN_META[key]
          return (
            <Card key={key} className={
              key === 'operational' ? 'border-emerald-300 bg-emerald-50/40' :
              key === 'tactical' ? 'border-sky-300 bg-sky-50/40' :
              'border-purple-300 bg-purple-50/40'
            }>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="text-2xl">{meta.icon}</span>
                  {meta.labelAr}
                </CardTitle>
                <CardDescription className="text-xs">
                  <span className="rounded-full border bg-card px-2 py-0.5 font-medium">{meta.horizonAr}</span>
                  <br className="my-1" />
                  {meta.descAr}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  onClick={() => generatePlan(key)}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  🧠 ولّد الخطة من بياناتي
                </Button>
                <Textarea
                  rows={12}
                  value={data.plans[key]}
                  onChange={(e) => setData((p) => ({ ...p, plans: { ...p.plans, [key]: e.target.value } }))}
                  placeholder={`نصّ ${meta.labelAr}…`}
                />
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* CTA حفظ + انتقالات */}
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-lg">
        <div className="flex flex-wrap gap-2">
          <Link to={`/manager/clients/${scope.company.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            ← لوحة العميل
          </Link>
          <Link to={`/bmc?client=${scope.company.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            🧩 BMC للتسويق
          </Link>
          <Link to={`/manager/strategic-plan?client=${scope.company.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            🗺️ الخطة الاستراتيجيّة
          </Link>
        </div>
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? 'جاري الحفظ…' : '💾 حفظ مركز التسويق'}
        </Button>
      </div>
    </div>
  )
}

// ─── مكوّنات مساعدة ────────────────────────────────────────────

function MetricInput({
  label, value, onChange, placeholder, hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint && <div className="text-[10px] leading-relaxed text-muted-foreground">{hint}</div>}
    </div>
  )
}

function LTVCACRatio({ cac, ltv }: { cac: number; ltv: number }) {
  const ratio = ltv / cac
  const health = ratio >= 3 ? 'صحّي' : ratio >= 2 ? 'مقبول' : 'خطير'
  const color = ratio >= 3 ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : ratio >= 2 ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-rose-400 bg-rose-50 text-rose-800'
  return (
    <div className={`rounded-lg border-2 p-3 text-xs ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold">نسبة LTV/CAC = {ratio.toFixed(1)}×</div>
          <div className="mt-0.5 text-[10px]">
            القاعدة: <b>≥ ٣×</b> صحّي · <b>٢-٣×</b> مقبول · <b>&lt; ٢×</b> نموذج غير مستدام يحتاج مراجعة.
          </div>
        </div>
        <div className="rounded-full border bg-card px-2 py-0.5 text-[10px] font-bold">{health}</div>
      </div>
    </div>
  )
}

// ─── مولّد الخطط — يبني نصّاً منظّماً من البيانات المُدخَلة ─────

function buildPlan(key: PlanKey, data: MarketingHubData, path: StrategyPath | null): string {
  const b = data.brand
  const activeSocials = SOCIALS_META.filter((s) => data.socials[s.key].trim()).map((s) => s.labelAr)
  const budget = Number(data.admin.monthlyBudgetSAR) || 0
  const team = Number(data.admin.teamSize) || 1
  const cvr = Number(data.tech.cvr) || 0
  const romi = Number(data.tech.romi) || 0
  const cac = Number(data.tech.cac) || 0
  const ltv = Number(data.tech.ltv) || 0

  const brandLine = b.name ? `العلامة: ${b.name}${b.taglineAr ? ` — ${b.taglineAr}` : ''}` : '⚠️ عبّئ اسم العلامة أوّلاً.'
  const storeLine = b.storeUrl ? `المتجر: ${b.storeUrl}${b.storePlatform ? ` (${b.storePlatform})` : ''}` : 'لا متجر مسجّل.'
  const audienceLine = b.targetAudienceAr ? `الجمهور: ${b.targetAudienceAr}` : '⚠️ حدّد جمهورك المستهدف.'
  const socialsLine = activeSocials.length > 0 ? `القنوات النشطة: ${activeSocials.join(' · ')}` : '⚠️ لم تُسجَّل قنوات — أضف على الأقلّ قناتين.'

  if (key === 'operational') {
    return [
      `# ${PLAN_META.operational.labelAr} — ${PLAN_META.operational.horizonAr}`,
      '',
      brandLine, storeLine, audienceLine, socialsLine,
      '',
      '## الأسبوع الأول',
      '• جرد كامل للحسابات والصلاحيات (٧ قنوات + Ads Manager + Analytics)',
      '• مراجعة آخر ٣٠ يوماً: ما نشرنا، ما نجح، ما لم يحقق تفاعلاً',
      '• تعيين مسؤول نشر لكل قناة (RACI)',
      '',
      '## الشهر الأول — روتين النشر',
      `• جدول نشر أسبوعي (٣-٥ منشورات/قناة على ${activeSocials.slice(0, 3).join('/') || 'القنوات الرئيسيّة'})`,
      '• حملة أداء نشطة على Meta/Google بميزانية أسبوعيّة محدَّدة',
      cac > 0 ? `• مراقبة CAC (حالياً ${cac} SAR) وإيقاف أي إعلان تجاوز ${Math.round(cac * 1.5)} SAR` : '• قياس CAC للحملات الجارية',
      cvr > 0 ? `• تحسين صفحات الهبوط (CVR الحالي ${cvr}٪ → مستهدف ${(cvr * 1.2).toFixed(1)}٪)` : '• قياس CVR الحالي كخط أساس',
      '• اجتماع فريق أسبوعي ٣٠ دقيقة — مراجعة الأرقام والتصحيح',
      '',
      '## الشهر الثاني والثالث — التحسين',
      '• A/B tests على الرسائل والصور (بحدّ اختبار واحد أسبوعياً)',
      '• توسيع أفضل ٣ حملات وإيقاف أضعف ٣',
      '• محتوى تعليمي (Blog/YouTube) أسبوعياً لتحسين SEO',
      `• مراجعة نهاية كل شهر: هل ROMI ≥ ${(romi > 0 ? romi : 3).toFixed(1)}؟`,
      '',
      '## KPIs يوميّة/أسبوعيّة',
      '• التفاعل الاجتماعي (Engagement)',
      '• Reach + Impressions',
      '• CVR',
      '• CAC',
      '• قيمة الطلب المتوسّطة (AOV)',
      '',
      budget > 0 ? `## الميزانيّة: ${budget.toLocaleString('ar-SA')} SAR/شهر` : '## الميزانيّة: — (أدخِلها في التحليل الإداري)',
      `## الفريق: ${team} أعضاء`,
    ].filter(Boolean).join('\n')
  }

  if (key === 'tactical') {
    return [
      `# ${PLAN_META.tactical.labelAr} — ${PLAN_META.tactical.horizonAr}`,
      '',
      brandLine, socialsLine,
      '',
      '## الربع الأول — التأسيس',
      '• إطلاق استراتيجيّة محتوى موحّدة (Content Pillars: ٣-٥ محاور)',
      '• حملة توعية بالعلامة (Brand Awareness) بميزانيّة ~٣٠٪ من الإجمالي الفصلي',
      '• إعداد Marketing Automation (Nurture flows)',
      `${ltv > 0 && cac > 0 ? `• استهداف LTV/CAC ≥ ٣× (حالياً ${(ltv / cac).toFixed(1)}×)` : '• قياس LTV/CAC كخط أساس'}`,
      '',
      '## الربع الثاني — الإطلاقات',
      '• حملة موسميّة كبرى (رمضان/الوطني/يوم التأسيس — حسب التوقيت)',
      '• شراكة مع ١-٣ مؤثّرين مطابقين للجمهور',
      '• توسّع في قناة جديدة (اختبار قناة لم تُستكشف)',
      '• برنامج إحالة العملاء (Referral)',
      '',
      '## الربع الثالث — التوسيع',
      '• حملات Retargeting متقدّمة (LAL Audiences)',
      '• نمو قنوات SEO/Organic (نشر أسبوعي)',
      '• شهادات وقصص نجاح عملاء (Case Studies)',
      '',
      '## الربع الرابع — التقييم والتخطيط',
      '• مراجعة كامل السنة',
      '• تحديد الحملات الأنجح للتوسيع',
      '• رسم الخطة التكتيكيّة للسنة القادمة',
      '',
      '## KPIs فصليّة',
      '• نمو الوعي بالعلامة (Brand Awareness Score)',
      '• عدد العملاء الجدد',
      '• Marketing-Sourced Pipeline %',
      '• حصّة الصوت (Share of Voice)',
      '',
      path === 'QUICK' ? 'ملاحظة: مسارك تشغيلي (قصير) → ركّز على الربعين ١ + ٢ فقط.' :
      path === 'MEDIUM' ? 'ملاحظة: مسارك تكتيكي (متوسّط) → أنجز الأربع أرباع باستقرار.' :
      path === 'LONG' ? 'ملاحظة: مسارك استراتيجي (طويل) → استثمر في قنوات ذات نموّ مركّب (SEO + المحتوى).' :
      '',
    ].filter(Boolean).join('\n')
  }

  // strategic
  return [
    `# ${PLAN_META.strategic.labelAr} — ${PLAN_META.strategic.horizonAr}`,
    '',
    brandLine, audienceLine,
    '',
    '## السنة الأولى — إعادة تعريف الموقع',
    '• مراجعة الشعار والهويّة البصريّة (Brand Refresh إن لزم)',
    '• رسم Brand Story موحّدة',
    '• Positioning Statement بلغة العميل، لا لغة الشركة',
    '• أبحاث سوق (Personas + Journey Maps)',
    '',
    '## السنة الثانية — التوسّع القنواتيّ',
    '• دخول قناة جديدة كبيرة (Podcast/Newsletter/Live Events)',
    '• شراكات استراتيجيّة (Co-marketing) مع علامات مكمّلة',
    '• برنامج Ambassadors طويل الأمد',
    '• توسّع جغرافي (إن كانت العلامة قابلة للتصدير)',
    '',
    '## السنة الثالثة+ — القيادة القطاعيّة',
    '• Thought Leadership (نشر أبحاث القطاع، تنظيم فعاليّات)',
    '• منصّة محتوى خاصّة (Media Property)',
    '• توسّع دولي / إطلاق منتج/خدمة جديدة',
    '',
    '## قرارات كبرى تُتّخذ الآن',
    '• هل نبقى B2C أم نضيف B2B؟',
    '• هل نبني قناة إعلاميّة خاصّة أم نعتمد على القنوات القائمة؟',
    '• هل نُوسّع خارج السعودية؟ ومتى؟',
    '• هل نستثمر في Ads Automation / AI Content؟',
    '',
    '## KPIs استراتيجيّة',
    '• حصّة السوق (Market Share)',
    '• Net Promoter Score (NPS) للعلامة',
    '• قيمة العلامة (Brand Equity)',
    '• حصّة الصوت (Share of Voice)',
    '',
    path === 'LONG' ? 'ملاحظة: مسارك استراتيجي (طويل) — هذه الخطة تناسبك تماماً.' :
    path === 'MEDIUM' ? 'ملاحظة: مسارك تكتيكي (متوسّط) — نفّذ السنة الأولى فقط، وأعِد التقييم.' :
    path === 'QUICK' ? 'ملاحظة: مسارك تشغيلي (قصير) — راجع فقط، لا تنفّذ بعد.' : '',
  ].filter(Boolean).join('\n')
}
