import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, apiErrorMessage } from '@/lib/api'
import { homeFor } from '@/components/layouts/nav'
import { SECTORS } from '@/lib/onboardingOptions'
import { useAuthStore } from '@/store/authStore'
import { useDiagnosticStore } from '@/store/diagnosticStore'
import type { ManagerType, SpecialtyDeptType, UserType } from '@/types/user'

const SPECIALTY_OPTIONS: { value: SpecialtyDeptType; label: string }[] = [
  { value: 'HR', label: 'الموارد البشرية' },
  { value: 'FINANCE', label: 'المالية' },
  { value: 'SALES', label: 'المبيعات' },
  { value: 'MARKETING', label: 'التسويق' },
  { value: 'OPERATIONS', label: 'العمليات' },
  { value: 'IT', label: 'تقنية المعلومات' },
  { value: 'CUSTOMER_SERVICE', label: 'خدمة العملاء' },
  { value: 'SUPPORT', label: 'الإمداد والدعم' },
  { value: 'LOGISTICS', label: 'اللوجستيات' },
  { value: 'QUALITY', label: 'الجودة' },
  { value: 'PROJECTS', label: 'المشاريع' },
  { value: 'GOVERNANCE', label: 'الحوكمة' },
  { value: 'COMPLIANCE', label: 'الامتثال' },
]

const schema = z.object({
  name: z.string().min(1, 'الاسم مطلوب').max(120),
  email: z.string().email('بريد إلكتروني غير صالح'),
  password: z.string().min(8, 'كلمة المرور يجب ألا تقل عن ٨ أحرف').max(128),
  phone: z.string().max(40).optional().or(z.literal('')),
  userType: z.enum(['OWNER', 'MANAGER', 'INVESTOR']),
  // ق١: الإنفاذ على الخادم (auth.ts يرفض INTERNAL ذاتيّاً) + الواجهة لا تعرض راديو
  // INTERNAL. يبقى النوع هنا واسعاً لأنّ النموذج يُبنى من selectedManagerType العامّ
  // (ManagerType) فيتفادى تضييقُه كسر النوع (تُضبَط INTERNAL عبر الدعوة لا هنا).
  managerType: z.enum(['INTERNAL', 'INDEPENDENT_PRO']).optional(),
  specialtyDeptType: z.enum(SPECIALTY_OPTIONS.map((o) => o.value) as [SpecialtyDeptType, ...SpecialtyDeptType[]]).optional(),
  // PRO-1 — أوّل عميل يخدمه المدير المستقل: اسم (إلزامي) + قطاع + حجم.
  // نُنشئ الشركة فوراً في التسجيل ببياناتها الأساسيّة — بدل جمعها لاحقاً في
  // شريحة onboarding — حتى يبدأ الحساب فاعلاً بلا حالة «مدير بلا عميل».
  firstClientName: z.string().max(120).optional().or(z.literal('')),
  firstClientSector: z.string().max(80).optional().or(z.literal('')),
  firstClientSize: z.enum(['MICRO', 'SMALL', 'MEDIUM', 'LARGE']).optional(),
}).superRefine((data, ctx) => {
  if (data.userType === 'MANAGER' && !data.managerType) {
    ctx.addIssue({ path: ['managerType'], code: 'custom', message: 'اختر نوع المدير' })
  }
  if (data.userType === 'MANAGER' && data.managerType === 'INDEPENDENT_PRO' && !data.specialtyDeptType) {
    ctx.addIssue({ path: ['specialtyDeptType'], code: 'custom', message: 'اختر تخصّصك — الإدارة التي تشرف عليها' })
  }
  // اسم أوّل عميل إلزامي للمدير المستقل — الأدوات الاستراتيجيّة تعمل على عميل.
  if (data.userType === 'MANAGER' && data.managerType === 'INDEPENDENT_PRO' && !data.firstClientName?.trim()) {
    ctx.addIssue({ path: ['firstClientName'], code: 'custom', message: 'اسم أوّل عميل مطلوب للبدء' })
  }
})

type Form = z.infer<typeof schema>

const TYPE_LABEL: Record<UserType, string> = {
  OWNER: 'صاحب أعمال',
  MANAGER: 'مدير / مستشار',
  INVESTOR: 'مستثمر',
}

const MANAGER_TYPE_LABEL: Record<ManagerType, string> = {
  INTERNAL: 'مدير داخلي',
  INDEPENDENT_PRO: 'مدير مستقل',
}

export function JoinPage() {
  const navigate = useNavigate()
  const authedUser = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const selectedType = useAuthStore((s) => s.selectedType)
  const selectedManagerType = useAuthStore((s) => s.selectedManagerType)
  const selectedSpecialty = useAuthStore((s) => s.selectedSpecialty)
  const registerUser = useAuthStore((s) => s.register)
  const login = useAuthStore((s) => s.login)
  const [submitting, setSubmitting] = useState(false)

  // مستخدم مسجّل يفتح /join؟ لا نُتيح تسجيل حساب جديد فوق حساب قائم — نوجّهه
  // لصفحته الرئيسية (dashboard/manager/investor). هذا يمنع الإرباك الذي
  // ظهر سابقاً: زائر مسجّل كـ OWNER يمرّ بمسار المدير ثم يعود لصفحة تسجيل
  // فيرى نفسه "OWNER" مصادفة.
  useEffect(() => {
    if (!isAuthenticated || !authedUser) return
    navigate(homeFor(authedUser.userType, authedUser.managerType), { replace: true })
  }, [isAuthenticated, authedUser, navigate])

  const { register, watch, handleSubmit, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      userType: (selectedType as UserType | null) ?? 'OWNER',
      // نلتقط اختيارات المدير من /select-type حتى لا يُعيد المستخدم إدخالها.
      managerType: selectedManagerType ?? undefined,
      specialtyDeptType: selectedSpecialty ?? undefined,
    },
  })
  const userType = watch('userType')
  const managerType = watch('managerType')

  // useForm.defaultValues تُقرأ مرّة واحدة عند التحميل — لذا لو تغيّر
  // selectedType/selectedManagerType/selectedSpecialty في الـ store بعد
  // تحميل الصفحة (مثلاً بعد إعادة التوجيه من /diagnostic/try)، الفورم
  // يبقى بالقيم القديمة ما لم نستدعِ reset() صراحة. هذا الـ effect
  // يحسم البقّ الذي أدّى إلى تسجيل مدير كـ OWNER.
  useEffect(() => {
    reset({
      userType: (selectedType as UserType | null) ?? 'OWNER',
      managerType: selectedManagerType ?? undefined,
      specialtyDeptType: selectedSpecialty ?? undefined,
    })
  }, [selectedType, selectedManagerType, selectedSpecialty, reset])

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      await registerUser({
        email: values.email,
        password: values.password,
        name: values.name,
        userType: values.userType,
        managerType: values.userType === 'MANAGER' ? values.managerType : undefined,
        specialtyDeptType:
          values.userType === 'MANAGER' && values.managerType === 'INDEPENDENT_PRO'
            ? values.specialtyDeptType
            : undefined,
        firstClientName:
          values.userType === 'MANAGER' &&
          values.managerType === 'INDEPENDENT_PRO' &&
          values.firstClientName?.trim()
            ? values.firstClientName.trim()
            : undefined,
        // بيانات أوّل عميل الأساسيّة — القطاع والحجم. OPEX يُجمَع في /onboarding.
        firstClientMeta:
          values.userType === 'MANAGER' && values.managerType === 'INDEPENDENT_PRO'
            ? {
                sector: values.firstClientSector?.trim() || undefined,
                size: values.firstClientSize || undefined,
              }
            : undefined,
        phone: values.phone || undefined,
      })
      await login(values.email, values.password)
      toast.success('تم إنشاء الحساب — تحقق من بريدك لإكمال التحقق')

      // نقل التشخيص المجاني الذي أُجري قبل التسجيل إلى القاعدة.
      // كان هذا سابقاً في OnboardingPage — نُقل هنا بعد حذف /onboarding
      // لأنّ الصفحة كانت مجرّد وسيط لهذه المهمة + استمارة رقم/صورة بلا قيمة.
      const nextPath = await persistPendingDiagnosticAndPickHome({
        userType: values.userType,
        managerType: values.userType === 'MANAGER' ? values.managerType ?? null : null,
      })
      // R1.3 — بعد نقل التشخيص، لو الوجهة هي home مباشرة (لا يوجد
      // /diagnostic/result معلّق)، نمرّ عبر /onboarding لجمع pains/goals/
      // opex. المدير الداخلي والمستثمر يستفيدون من pains/goals فقط؛ المدير
      // المستقل يستفيد أيضاً من OPEX لأوّل عميل. تركنا التخطّي متاحاً داخل
      // /onboarding نفسها لمن لا يريد.
      const goesToDiagnosticResult = nextPath === '/diagnostic/result'
      navigate(goesToDiagnosticResult ? nextPath : '/onboarding', { replace: true })
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'فشل إنشاء الحساب'))
    } finally {
      setSubmitting(false)
    }
  })

  // ─── نقل التشخيص المجاني (مسبق-التسجيل) للقاعدة ثم اختيار الوجهة ─────
  // القانون الأول يمنع بقاء بيانات العمل في localStorage — لذا هنا نستدعي
  // /api/diagnostic/{owner|manager|investor} بمسودّة الزائر ثم نمسح العلم.
  // استثناء موثّق للمدير المستقل (الأمر ٢٥ في الخطة): لا نستدعي
  // /api/diagnostic/manager لأنه يُنشئ شركة — بدلاً من ذلك نُبقي النتيجة
  // transient وتُطبَّق كأوّل تدقيق لأوّل عميل يُضاف (الأمر ٣١).
  async function persistPendingDiagnosticAndPickHome(role: {
    userType: UserType
    managerType: ManagerType | null
  }): Promise<string> {
    const state = useDiagnosticStore.getState()
    const home = homeFor(role.userType, role.managerType)
    if (!state.pendingPersist) return home

    try {
      if (role.userType === 'OWNER') {
        const req = ['companyName', 'sector', 'stage', 'size', 'ownerDependency',
          'financialTracking', 'liquidity', 'governance', 'scalability', 'exitStrategy'] as const
        if (req.every((k) => state.ownerDraft[k])) {
          await api.post('/api/diagnostic/owner', state.ownerDraft)
          state.clearPendingPersist()
          return '/diagnostic/result'
        }
      } else if (role.userType === 'MANAGER' && role.managerType === 'INTERNAL') {
        const req = ['departmentType', 'teamSize', 'experienceLevel', 'operationalMaturity',
          'toolingMaturity', 'reportingQuality', 'decisionAuthority'] as const
        if (req.every((k) => state.managerDraft[k as keyof typeof state.managerDraft])) {
          await api.post('/api/diagnostic/manager', state.managerDraft)
          state.clearPendingPersist()
        }
      } else if (role.userType === 'INVESTOR') {
        const req = ['portfolioSize', 'investmentStage', 'monitoringCadence',
          'sectorFocus', 'involvementType', 'ticketSize'] as const
        if (req.every((k) => state.investorDraft[k as keyof typeof state.investorDraft])) {
          await api.post('/api/diagnostic/investor', state.investorDraft)
          state.clearPendingPersist()
        }
      }
      // INDEPENDENT_PRO: managerResult يبقى transient — يُستهلَك في الأمر ٣١.
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر حفظ تشخيصك السابق — يمكنك المحاولة لاحقاً'))
      state.clearPendingPersist()
    }
    return home
  }

  const roleLabel = TYPE_LABEL[(userType as UserType | null) ?? 'OWNER']
  // نُخفي حقول المدير الفرعية لو كان المستخدم اختارها مسبقاً من /select-type،
  // ونعرض بدلها ملخّصاً للقراءة فقط مع رابط للتعديل. لو رجع بحقن قيمة غير
  // متّسقة يدوياً، schema.superRefine يمنع الإرسال.
  const managerSubchoiceLocked =
    userType === 'MANAGER' &&
    selectedManagerType != null &&
    selectedSpecialty != null

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        ← العودة للصفحة الرئيسية
      </Link>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">إنشاء حساب جديد</CardTitle>
          <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border bg-primary/5 p-3">
            <div className="flex flex-col text-sm">
              <span className="text-xs text-muted-foreground">ستنضمّ كـ</span>
              <span className="font-semibold">
                {roleLabel}
                {userType === 'MANAGER' && selectedManagerType
                  ? ` · ${MANAGER_TYPE_LABEL[selectedManagerType]}`
                  : ''}
                {userType === 'MANAGER' &&
                selectedManagerType === 'INDEPENDENT_PRO' &&
                selectedSpecialty
                  ? ` · ${SPECIALTY_OPTIONS.find((o) => o.value === selectedSpecialty)?.label ?? selectedSpecialty}`
                  : ''}
              </span>
            </div>
            <Link
              to="/select-type"
              className="text-xs text-primary underline-offset-4 hover:underline"
            >
              تغيير
            </Link>
          </div>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="grid gap-4">
            <input type="hidden" {...register('userType')} />
            <div className="grid gap-2">
              <Label htmlFor="name">الاسم الكامل</Label>
              <Input id="name" autoComplete="name" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" autoComplete="email" dir="ltr" className="text-left" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                dir="ltr"
                className="text-left"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            {userType === 'MANAGER' && managerSubchoiceLocked && (
              <div className="grid gap-2 rounded-xl border bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">نوع المدير</span>
                  <span className="font-medium">
                    {selectedManagerType ? MANAGER_TYPE_LABEL[selectedManagerType] : ''}
                  </span>
                </div>
                {selectedManagerType === 'INDEPENDENT_PRO' && selectedSpecialty && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">التخصّص</span>
                    <span className="font-medium">
                      {SPECIALTY_OPTIONS.find((o) => o.value === selectedSpecialty)?.label ?? selectedSpecialty}
                    </span>
                  </div>
                )}
                <input type="hidden" {...register('managerType')} />
                <input type="hidden" {...register('specialtyDeptType')} />
                <Link to="/select-type" className="text-xs text-primary underline-offset-4 hover:underline">
                  تعديل الاختيار ←
                </Link>
              </div>
            )}
            {userType === 'MANAGER' && !managerSubchoiceLocked && (
              <div className="grid gap-2 rounded-xl border bg-muted/30 p-3">
                <Label>نوع المدير</Label>
                <div className="grid gap-1">
                  <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-card p-2 text-sm hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input type="radio" value="INDEPENDENT_PRO" {...register('managerType')} />
                    <span>
                      <span className="block font-medium">مستقل</span>
                      <span className="text-xs text-muted-foreground">خبير تخصّص يخدم عدّة عملاء</span>
                    </span>
                  </label>
                </div>
                {errors.managerType && (
                  <p className="text-sm text-destructive">{errors.managerType.message}</p>
                )}
                {managerType === 'INDEPENDENT_PRO' && (
                  <div className="mt-2 grid gap-1">
                    <Label htmlFor="specialtyDeptType">تخصّصك (الإدارة التي تشرف عليها)</Label>
                    <select
                      id="specialtyDeptType"
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                      {...register('specialtyDeptType')}
                    >
                      <option value="">اختر تخصّصك…</option>
                      {SPECIALTY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {errors.specialtyDeptType && (
                      <p className="text-sm text-destructive">{errors.specialtyDeptType.message}</p>
                    )}
                  </div>
                )}
              </div>
            )}
            {userType === 'MANAGER' &&
              (selectedManagerType === 'INDEPENDENT_PRO' || managerType === 'INDEPENDENT_PRO') && (
              <div className="grid gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
                <Label htmlFor="firstClientName">اسم أوّل عميل تخدمه</Label>
                <Input
                  id="firstClientName"
                  autoComplete="organization"
                  placeholder="مثال: شركة رفارف للتقنية"
                  {...register('firstClientName')}
                />
                {errors.firstClientName && (
                  <p className="text-sm text-destructive">{errors.firstClientName.message}</p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1">
                    <Label htmlFor="firstClientSector" className="text-xs">القطاع</Label>
                    <select
                      id="firstClientSector"
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                      {...register('firstClientSector')}
                    >
                      <option value="">اختر…</option>
                      {SECTORS.map((s) => (
                        <option key={s.code} value={s.code}>{s.labelAr}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="firstClientSize" className="text-xs">حجم المنشأة</Label>
                    <select
                      id="firstClientSize"
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                      {...register('firstClientSize')}
                    >
                      <option value="">اختر…</option>
                      <option value="MICRO">متناهية الصغر (1-4)</option>
                      <option value="SMALL">صغيرة (5-49)</option>
                      <option value="MEDIUM">متوسطة (50-249)</option>
                      <option value="LARGE">كبيرة (≥ 250)</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  ننشئ هذه الشركة تلقائياً ونربطها بحسابك — كل تحليل تعمله يبدأ بها.
                  الأرقام المالية (OPEX) نجمعها في الخطوة التالية.
                </p>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="phone">رقم الجوال (اختياري)</Label>
              <Input id="phone" autoComplete="tel" dir="ltr" className="text-left" placeholder="+966…" {...register('phone')} />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button className="w-full" type="submit" disabled={submitting}>
              {submitting ? 'جاري إنشاء الحساب…' : 'إنشاء الحساب'}
            </Button>
            <p className="text-sm text-muted-foreground">
              لديك حساب؟{' '}
              <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                تسجيل الدخول
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
