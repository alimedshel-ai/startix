import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/PageHeader'
import { api, apiErrorMessage } from '@/lib/api'
import { DEPT_LABEL, getMyFirstCompany, type Company, type DeptCode } from '@/lib/deptApi'
import { useAuthStore } from '@/store/authStore'
import { useDiagnosticStore } from '@/store/diagnosticStore'
import type { ExperienceLevel, TeamSize, ToolingOption } from '@/lib/managerInvestorQuestions'

const DEPTS = [
  ['HR', 'الموارد البشرية'],
  ['FINANCE', 'المالية'],
  ['SALES', 'المبيعات'],
  ['MARKETING', 'التسويق'],
  ['OPERATIONS', 'العمليات'],
  ['IT', 'تقنية المعلومات'],
  ['CUSTOMER_SERVICE', 'خدمة العملاء'],
  ['SUPPORT', 'الإمداد والدعم'],
  ['LOGISTICS', 'اللوجستيات'],
  ['QUALITY', 'الجودة'],
  ['PROJECTS', 'المشاريع'],
  ['GOVERNANCE', 'الحوكمة'],
  ['COMPLIANCE', 'الامتثال'],
] as const

const TOOLING = [
  ['none', 'لا يوجد — يدوي'],
  ['basic', 'أساسي — جداول'],
  ['modern', 'حديث — برامج سحابية'],
  ['advanced', 'متقدم — منظومة متكاملة'],
] as const

const schema = z.object({
  companyName: z.string().min(1, 'مطلوب').max(120),
  departmentType: z.enum(DEPTS.map((d) => d[0]) as [string, ...string[]]),
  experienceYears: z.string().regex(/^\d+$/, 'أرقام فقط'),
  teamSize: z.string().regex(/^\d+$/, 'أرقام فقط'),
  toolingMaturity: z.enum(TOOLING.map((t) => t[0]) as [string, ...string[]]),
  topChallenge: z.string().min(3, 'اكتب ملاحظة قصيرة').max(280),
})
type Form = z.infer<typeof schema>

// أي حقل في الفورم مصدره: تسجيل / تشخيص مسبق / إدخال المستخدم.
type FieldSource = 'registration' | 'diagnostic' | 'user'
type FieldSources = Partial<Record<keyof Form, FieldSource>>

// تحويل من مصطلحات التشخيص المجاني (enum) إلى الأرقام التقريبية التي يقبلها
// نموذج /manager/diagnostic حالياً. الوسط الحسابي للنطاق يعطي تقدير مفيد.
const TEAM_SIZE_TO_NUMBER: Record<TeamSize, string> = {
  micro:  '3',
  small:  '15',
  medium: '60',
  large:  '150',
}
const EXPERIENCE_TO_YEARS: Record<ExperienceLevel, string> = {
  junior: '2',
  mid:    '5',
  senior: '10',
  expert: '15',
}

// خيارات نضج الأدوات مطابقة بين النموذجين حرفياً — لا حاجة لتحويل.
const isKnownTooling = (v: string): v is ToolingOption =>
  v === 'none' || v === 'basic' || v === 'modern' || v === 'advanced'

export function DiagnosticManagerPage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [sources, setSources] = useState<FieldSources>({})
  const [savedCompany, setSavedCompany] = useState<Company | null>(null)
  // «editing» = المدير يريد تعديل التشخيص الحالي، حتى لو محفوظ سلفاً.
  const [editing, setEditing] = useState(false)
  // «justSaved» = عرض بطاقة النجاح الكبيرة بعد الحفظ الناجح — بدل الانتقال.
  const [justSaved, setJustSaved] = useState(false)
  const user = useAuthStore((s) => s.user)
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { departmentType: 'HR', toolingMaturity: 'basic' },
  })

  // ─── الملء التلقائي + كشف الحالة المحفوظة ───────────────────────
  useEffect(() => {
    let cancel = false
    ;(async () => {
      const nextSources: FieldSources = {}
      const draft = useDiagnosticStore.getState().managerDraft

      try {
        const { company } = await getMyFirstCompany()
        if (cancel) return
        if (company?.name) {
          setValue('companyName', company.name)
          nextSources.companyName = 'registration'
          // وجود شركة مربوطة يعني أن التشخيص المدير حُفظ سابقاً
          // (لأنه هو مَن ينشئ الشركة على السيرفر).
          setSavedCompany(company)
        }
      } catch {
        /* غياب الشركة ليس خطأً — المستخدم يكتب الاسم يدوياً */
      }

      if (draft.departmentType) {
        setValue('departmentType', draft.departmentType)
        nextSources.departmentType = 'diagnostic'
      } else if (user?.specialtyDeptType) {
        setValue('departmentType', user.specialtyDeptType)
        nextSources.departmentType = 'registration'
      }

      if (draft.teamSize) {
        setValue('teamSize', TEAM_SIZE_TO_NUMBER[draft.teamSize])
        nextSources.teamSize = 'diagnostic'
      }
      if (draft.experienceLevel) {
        setValue('experienceYears', EXPERIENCE_TO_YEARS[draft.experienceLevel])
        nextSources.experienceYears = 'diagnostic'
      }
      if (draft.toolingMaturity && isKnownTooling(draft.toolingMaturity)) {
        setValue('toolingMaturity', draft.toolingMaturity)
        nextSources.toolingMaturity = 'diagnostic'
      }

      if (!cancel) setSources(nextSources)
    })()
    return () => { cancel = true }
  }, [setValue, user?.specialtyDeptType])

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      // ─── تحويل حقول الفورم (أرقام + textarea) → schema السيرفر (enum) ──
      // السيرفر managerSchema في controllers/diagnostic.ts يتطلّب:
      //   teamSize/experienceLevel/operationalMaturity/toolingMaturity/
      //   reportingQuality/decisionAuthority — كلها enums.
      // نُحوّل الأرقام إلى نطاقات، ونشتق النضج من toolingMaturity كافتراضي.
      const team = Number(values.teamSize)
      const teamSize: 'micro' | 'small' | 'medium' | 'large' =
        team < 5     ? 'micro'
      : team < 50    ? 'small'
      : team < 250   ? 'medium' : 'large'

      const years = Number(values.experienceYears)
      const experienceLevel: 'junior' | 'mid' | 'senior' | 'expert' =
        years < 3    ? 'junior'
      : years < 8    ? 'mid'
      : years < 15   ? 'senior' : 'expert'

      const toolingToMaturity: Record<string, 'none' | 'partial' | 'good' | 'great'> = {
        none:    'none',
        basic:   'partial',
        modern:  'good',
        advanced:'great',
      }
      const maturity = toolingToMaturity[values.toolingMaturity] ?? 'partial'

      await api.post('/api/diagnostic/manager', {
        companyName: values.companyName,
        departmentType: values.departmentType,
        teamSize,
        experienceLevel,
        operationalMaturity: maturity,
        toolingMaturity: values.toolingMaturity,
        reportingQuality: maturity,
        decisionAuthority: 'tactical',
      })
      toast.success('تم حفظ التشخيص')
      // نعرض بطاقة النجاح على نفس الصفحة بدل الانتقال المباشر.
      setJustSaved(true)
      setEditing(false)
      // نُحدّث savedCompany بعد الحفظ — إن كان أوّل حفظ.
      try {
        const { company } = await getMyFirstCompany()
        if (company) setSavedCompany(company)
      } catch { /* skip */ }
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'تعذّر إرسال التشخيص'))
    } finally {
      setSubmitting(false)
    }
  })

  const dept = watch('departmentType')
  const tooling = watch('toolingMaturity')

  // متى نعرض حالة «مُكتمل» بدل الفورم؟
  // • عند وجود شركة محفوظة (savedCompany) + لم نضغط «تعديل» بعد.
  // • وليس بعد الحفظ الجديد مباشرة (justSaved له بطاقة خاصّة).
  const showCompletedState = savedCompany && !editing && !justSaved

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="تشخيص المدير"
        description={
          showCompletedState
            ? 'تشخيصك محفوظ — يمكنك مراجعة لوحة إدارتك أو تعديل البيانات.'
            : 'راجع الحقول المعبّأة من تسجيلك وتشخيصك السابق، ثم أضف تحدّياً حالياً.'
        }
      />

      {/* ✅ حالة «مُكتمل» — نعرضها بدل الفورم عند وجود شركة محفوظة */}
      {showCompletedState && (
        <Card className="mx-auto w-full max-w-2xl overflow-hidden border-2 border-emerald-400 bg-gradient-to-bl from-emerald-500/15 to-transparent shadow-md">
          <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-teal-500 to-sky-500" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="text-5xl">✅</span>
              <div>
                <CardTitle>تشخيصك مُكتمل — لا حاجة لإعادته</CardTitle>
                <CardDescription>
                  الشركة: <b>{savedCompany?.name}</b>
                  {user?.specialtyDeptType && ` · إدارة ${DEPT_LABEL[user.specialtyDeptType as DeptCode]}`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs font-semibold text-muted-foreground">ماذا الآن؟</div>
              <p className="mt-1 text-xs leading-relaxed">
                افتح <b>لوحة الإدارة</b> لبدء أدوات التحليل الاستراتيجي، أو <b>عدّل التشخيص</b> إن تغيّرت
                بياناتك (حجم الفريق، نضج الأدوات، الشركة).
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              ✏️ تعديل التشخيص
            </Button>
            <Link to="/manager/dept-dashboard" className={buttonVariants({ variant: 'default' })}>
              📊 افتح لوحة إدارتي ←
            </Link>
          </CardFooter>
        </Card>
      )}

      {/* 🎉 بطاقة «تمّ الحفظ للتوّ» — بعد submit مباشرة، بدل الانتقال */}
      {justSaved && (
        <Card className="mx-auto w-full max-w-2xl overflow-hidden border-2 border-emerald-500 bg-gradient-to-bl from-emerald-500/20 to-transparent shadow-lg">
          <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-teal-500 to-sky-500" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="text-5xl">🎉</span>
              <div>
                <CardTitle>تمّ حفظ تشخيصك بنجاح</CardTitle>
                <CardDescription>
                  اختر خطوتك التالية — لا حاجة للعودة لهذه الصفحة إلا لتعديل البيانات.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardFooter className="flex flex-wrap justify-between gap-2">
            <Button variant="ghost" onClick={() => { setJustSaved(false); setEditing(true) }}>
              ✏️ تعديل التشخيص مجدّداً
            </Button>
            <div className="flex flex-wrap gap-2">
              <Link to="/manager/clients" className={buttonVariants({ variant: 'outline' })}>
                🤝 عملائي
              </Link>
              <Button
                onClick={() => navigate('/manager/dept-dashboard')}
                size="lg"
              >
                📊 افتح لوحة الإدارة ←
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* الفورم — يظهر فقط إذا لم يُحفَظ سلفاً أو المستخدم اختار التعديل */}
      {!showCompletedState && !justSaved && (
      <Card className="mx-auto w-full max-w-2xl overflow-hidden shadow-sm">
        <div className="h-1.5 bg-gradient-to-l from-sky-500 via-teal-500 to-emerald-500" />
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>{editing ? 'تعديل التشخيص' : 'أخبرنا عن إدارتك'}</CardTitle>
              <CardDescription>إجاباتك تغذي لوحة الإدارة وتوصيات مؤشرات الأداء.</CardDescription>
            </div>
            {editing && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                × إلغاء التعديل
              </Button>
            )}
          </div>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <FieldLabel htmlFor="companyName" source={sources.companyName}>اسم الشركة</FieldLabel>
              <Input id="companyName" {...register('companyName')} />
              {errors.companyName && (
                <p className="text-sm text-destructive">{errors.companyName.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <FieldLabel source={sources.departmentType}>الإدارة</FieldLabel>
              <Select value={dept} onValueChange={(v) => setValue('departmentType', v as Form['departmentType'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPTS.map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 md:grid-cols-2 md:gap-4">
              <div className="grid gap-2">
                <FieldLabel htmlFor="experienceYears" source={sources.experienceYears}>سنوات الخبرة</FieldLabel>
                <Input id="experienceYears" type="number" min={0} {...register('experienceYears')} />
              </div>
              <div className="grid gap-2">
                <FieldLabel htmlFor="teamSize" source={sources.teamSize}>حجم الفريق</FieldLabel>
                <Input id="teamSize" type="number" min={0} {...register('teamSize')} />
              </div>
            </div>

            <div className="grid gap-2">
              <FieldLabel source={sources.toolingMaturity}>نضج الأدوات</FieldLabel>
              <Select value={tooling} onValueChange={(v) => setValue('toolingMaturity', v as Form['toolingMaturity'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TOOLING.map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <FieldLabel htmlFor="topChallenge">أكبر تحدٍّ حالياً</FieldLabel>
              <Textarea id="topChallenge" rows={3} {...register('topChallenge')} placeholder="سؤال جديد لم يُطرح في التشخيص السابق — اكتب أهمّ ما يشغلك اليوم." />
              {errors.topChallenge && (
                <p className="text-sm text-destructive">{errors.topChallenge.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={submitting} className="mr-auto">
              {submitting ? 'جاري الحفظ…' : (editing ? 'حفظ التعديل' : 'حفظ التشخيص')}
            </Button>
          </CardFooter>
        </form>
      </Card>
      )}
    </div>
  )
}

function FieldLabel({
  htmlFor, source, children,
}: { htmlFor?: string; source?: FieldSource; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={htmlFor}>{children}</Label>
      {source && <SourceBadge source={source} />}
    </div>
  )
}

function SourceBadge({ source }: { source: FieldSource }) {
  const map: Record<FieldSource, { label: string; className: string }> = {
    registration: { label: '✓ من تسجيلك',        className: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    diagnostic:   { label: '✓ من تشخيصك السابق', className: 'text-sky-700 bg-sky-50 border-sky-200' },
    user:         { label: 'إدخالك',             className: 'text-muted-foreground bg-muted border-border' },
  }
  const meta = map[source]
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}
