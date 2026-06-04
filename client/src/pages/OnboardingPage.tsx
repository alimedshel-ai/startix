import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, apiErrorMessage } from '@/lib/api'
import type { OwnerDiagnosticResult } from '@/lib/diagnosticQuestions'
import { useAuthStore } from '@/store/authStore'
import { useDiagnosticStore } from '@/store/diagnosticStore'
import type { User, UserType } from '@/types/user'

const schema = z.object({
  phone: z.string().max(40).optional().or(z.literal('')),
  avatarUrl: z.string().url().optional().or(z.literal('')),
})
type Form = z.infer<typeof schema>

const TYPE_LABEL: Record<UserType, string> = {
  OWNER: 'صاحب أعمال',
  MANAGER: 'مدير',
  INVESTOR: 'مستثمر',
}

const NEXT_STEP: Record<UserType, { label: string; to: string }> = {
  OWNER:    { label: 'ابدأ التشخيص الاستراتيجي', to: '/diagnostic/owner' },
  MANAGER:  { label: 'ابدأ تشخيص الإدارة',        to: '/manager/diagnostic' },
  INVESTOR: { label: 'ابدأ تقييم المحفظة',         to: '/investor/diagnostic' },
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const logout = useAuthStore((s) => s.logout)
  const [submitting, setSubmitting] = useState(false)

  // لو الزائر سوّى تشخيص قبل التسجيل، احفظه في حسابه أوّل ما يدخل.
  const { draft, pendingPersist, setResult, clearPendingPersist } = useDiagnosticStore()
  const persistAttempted = useRef(false)
  useEffect(() => {
    if (persistAttempted.current) return
    if (!user || user.userType !== 'OWNER') return
    if (!pendingPersist) return
    // تأكد أن الـ draft مكتمل
    const required = ['companyName', 'sector', 'stage', 'size', 'ownerDependency',
      'financialTracking', 'liquidity', 'governance', 'scalability', 'exitStrategy'] as const
    if (required.some((k) => !draft[k])) return

    persistAttempted.current = true
    ;(async () => {
      try {
        const { data } = await api.post<{ result: OwnerDiagnosticResult }>('/api/diagnostic/owner', draft)
        setResult(data.result)
        clearPendingPersist()
        toast.success('تم حفظ تشخيصك في حسابك')
        navigate('/diagnostic/result')
      } catch (err: unknown) {
        toast.error(apiErrorMessage(err, 'تعذّر حفظ تشخيصك السابق'))
        clearPendingPersist()
      }
    })()
  }, [user, pendingPersist, draft, navigate, setResult, clearPendingPersist])

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { phone: user?.phone ?? '', avatarUrl: user?.avatarUrl ?? '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      const { data } = await api.patch<{ user: User }>('/api/auth/me', {
        phone: values.phone || null,
        avatarUrl: values.avatarUrl || null,
      })
      setUser(data.user)
      toast.success('تم حفظ التفضيلات')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'فشل التحديث'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  })

  const userType = user?.userType ?? 'OWNER'
  const nextStep = NEXT_STEP[userType]

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            مرحباً، {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-sm text-muted-foreground">
            انضممت كـ{TYPE_LABEL[userType]}.{' '}
            {user?.isVerified ? 'تم التحقق من البريد.' : 'تحقق من بريدك لإكمال التحقق.'}
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={async () => {
            await logout()
            navigate('/')
          }}
        >
          تسجيل الخروج
        </Button>
      </header>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>الخطوة ١ — تفضيلات الحساب</CardTitle>
          <CardDescription>اختياري. تقدر تعبيها لاحقاً من الملف الشخصي.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="phone">رقم الجوال</Label>
              <Input id="phone" dir="ltr" className="text-left" placeholder="+966…" {...register('phone')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="avatarUrl">رابط الصورة الشخصية</Label>
              <Input id="avatarUrl" dir="ltr" className="text-left" placeholder="https://…" {...register('avatarUrl')} />
              {errors.avatarUrl && (
                <p className="text-sm text-destructive">{errors.avatarUrl.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'جاري الحفظ…' : 'حفظ التفضيلات'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>الخطوة ٢ — ابدأ التشخيص</CardTitle>
          <CardDescription>
            خمس دقائق فقط لتحديد مسارك الاستراتيجي وخريطة طريق الـ٩٠ يوم القادمة.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link to={nextStep.to} className={buttonVariants()}>
            {nextStep.label}
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
