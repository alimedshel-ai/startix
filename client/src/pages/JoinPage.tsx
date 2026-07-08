import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import type { SpecialtyDeptType, UserType } from '@/types/user'

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
  managerType: z.enum(['INTERNAL', 'INDEPENDENT_PRO']).optional(),
  specialtyDeptType: z.enum(SPECIALTY_OPTIONS.map((o) => o.value) as [SpecialtyDeptType, ...SpecialtyDeptType[]]).optional(),
}).superRefine((data, ctx) => {
  if (data.userType === 'MANAGER' && !data.managerType) {
    ctx.addIssue({ path: ['managerType'], code: 'custom', message: 'اختر نوع المدير' })
  }
  if (data.userType === 'MANAGER' && data.managerType === 'INDEPENDENT_PRO' && !data.specialtyDeptType) {
    ctx.addIssue({ path: ['specialtyDeptType'], code: 'custom', message: 'اختر تخصّصك — الإدارة التي تشرف عليها' })
  }
})

type Form = z.infer<typeof schema>

const TYPE_LABEL: Record<UserType, string> = {
  OWNER: 'صاحب أعمال',
  MANAGER: 'مدير / مستشار',
  INVESTOR: 'مستثمر',
}

export function JoinPage() {
  const navigate = useNavigate()
  const selectedType = useAuthStore((s) => s.selectedType)
  const registerUser = useAuthStore((s) => s.register)
  const login = useAuthStore((s) => s.login)
  const [submitting, setSubmitting] = useState(false)

  const { register, watch, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      userType: (selectedType as UserType | null) ?? 'OWNER',
    },
  })
  const userType = watch('userType')
  const managerType = watch('managerType')

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
        phone: values.phone || undefined,
      })
      await login(values.email, values.password)
      toast.success('تم إنشاء الحساب — تحقق من بريدك لإكمال التحقق')
      navigate('/onboarding')
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'فشل إنشاء الحساب'))
    } finally {
      setSubmitting(false)
    }
  })

  const roleLabel = TYPE_LABEL[(selectedType as UserType | null) ?? 'OWNER']

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        ← العودة للصفحة الرئيسية
      </Link>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">إنشاء حساب جديد</CardTitle>
          <CardDescription>
            انضمام كـ <span className="font-medium text-foreground">{roleLabel}</span>.
            <Link to="/select-type" className="mr-1 underline-offset-4 hover:underline">
              تغيير
            </Link>
          </CardDescription>
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
            {userType === 'MANAGER' && (
              <div className="grid gap-2 rounded-xl border bg-muted/30 p-3">
                <Label>نوع المدير</Label>
                <div className="grid gap-1 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-card p-2 text-sm hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input type="radio" value="INTERNAL" {...register('managerType')} />
                    <span>
                      <span className="block font-medium">داخلي</span>
                      <span className="text-xs text-muted-foreground">مدير داخل شركة واحدة</span>
                    </span>
                  </label>
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
