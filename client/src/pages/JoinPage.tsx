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
import type { UserType } from '@/types/user'

const schema = z.object({
  name: z.string().min(1, 'الاسم مطلوب').max(120),
  email: z.string().email('بريد إلكتروني غير صالح'),
  password: z.string().min(8, 'كلمة المرور يجب ألا تقل عن ٨ أحرف').max(128),
  phone: z.string().max(40).optional().or(z.literal('')),
  userType: z.enum(['OWNER', 'MANAGER', 'INVESTOR']),
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

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      userType: (selectedType as UserType | null) ?? 'OWNER',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      await registerUser({
        email: values.email,
        password: values.password,
        name: values.name,
        userType: values.userType,
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
