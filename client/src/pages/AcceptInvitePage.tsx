import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, apiErrorMessage } from '@/lib/api'
import { homeFor } from '@/components/layouts/nav'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types/user'

// ─── D-٢: صفحة قبول الدعوة (مسار المدعوّ المستقلّ) ──────────────────────────
// تطابق رابط البريد /invitations/accept?token=… (invitations.ts:67). تتحقّق من
// التوكن عبر GET /check (عامّ)، ثمّ:
//   • بلا حساب → تسجيل عبر POST /register (يُنتج MANAGER+null→INTERNAL ويدخل فوراً).
//   • بحساب + مصادَق → POST /accept (يُكمل الوصل + الرقعة).
//   • بحساب + غير مصادَق → يوجَّه لتسجيل الدخول ثمّ العودة للرابط (يقبل تلقائياً).

interface CheckOk {
  gate: 'ok'
  email: string
  role: string
  companyId: string
  companyName: string | null
  hasAccount: boolean
}

const regSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب').max(120),
  password: z.string().min(8, 'كلمة المرور ٨ أحرف على الأقل').max(128),
})
type RegForm = z.infer<typeof regSchema>

export function AcceptInvitePage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [phase, setPhase] = useState<'loading' | 'error' | 'ready'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [invite, setInvite] = useState<CheckOk | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<RegForm>({
    resolver: zodResolver(regSchema),
  })

  // تحقّق من التوكن عند الدخول.
  useEffect(() => {
    let alive = true
    if (!token) { setPhase('error'); setErrorMsg('رابط دعوة غير صالح — لا يوجد رمز.'); return }
    ;(async () => {
      try {
        const { data } = await api.get<CheckOk>(`/api/invitations/${token}/check`)
        if (!alive) return
        setInvite(data)
        setPhase('ready')
      } catch (err) {
        if (!alive) return
        setErrorMsg(apiErrorMessage(err, 'تعذّر التحقّق من الدعوة'))
        setPhase('error')
      }
    })()
    return () => { alive = false }
  }, [token])

  function goHome(user: User) {
    toast.success('تمّ قبول الدعوة — أهلاً بك')
    navigate(homeFor(user.userType, user.managerType), { replace: true })
  }

  // بلا حساب: تسجيل عبر الدعوة (المُنتِج الوحيد لـMANAGER+null→INTERNAL).
  const onRegister = handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      const { data } = await api.post<{ user: User }>(`/api/invitations/${token}/register`, values)
      setUser(data.user)
      goHome(data.user)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر إنشاء الحساب'))
    } finally {
      setSubmitting(false)
    }
  })

  // بحساب + مصادَق: أكمل الوصل مباشرةً.
  async function onAccept() {
    setSubmitting(true)
    try {
      await api.post(`/api/invitations/${token}/accept`, {})
      const me = await api.get<{ user: User }>('/api/auth/me')
      setUser(me.data.user)
      goHome(me.data.user)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر قبول الدعوة'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16" dir="rtl">
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        → العودة للصفحة الرئيسية
      </Link>
      <Card className="shadow-sm">
        {phase === 'loading' && (
          <CardHeader>
            <CardTitle className="text-xl">جارٍ التحقّق من الدعوة…</CardTitle>
          </CardHeader>
        )}

        {phase === 'error' && (
          <>
            <CardHeader>
              <CardTitle className="text-xl text-destructive">تعذّر فتح الدعوة</CardTitle>
              <CardDescription>{errorMsg}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
                تسجيل الدخول
              </Button>
            </CardFooter>
          </>
        )}

        {phase === 'ready' && invite && (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">دعوة للانضمام</CardTitle>
              <CardDescription>
                دُعيت للانضمام إلى <strong>{invite.companyName ?? 'شركة'}</strong> بدور{' '}
                <em>{invite.role === 'manager' ? 'مدير' : invite.role}</em>.
              </CardDescription>
            </CardHeader>

            {/* بحساب قائم */}
            {invite.hasAccount ? (
              <CardContent className="grid gap-4">
                {isAuthenticated ? (
                  <>
                    <p className="text-sm text-muted-foreground">حسابك جاهز — أكمِل الانضمام بنقرة.</p>
                    <Button className="w-full" onClick={onAccept} disabled={submitting}>
                      {submitting ? 'جارٍ القبول…' : 'قبول الدعوة'}
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      لديك حساب بهذا البريد ({invite.email}). سجّل الدخول ثمّ عُد لهذا الرابط ليُقبَل تلقائياً.
                    </p>
                    <Button className="w-full" onClick={() => navigate('/login')}>
                      تسجيل الدخول
                    </Button>
                  </>
                )}
              </CardContent>
            ) : (
              /* بلا حساب — تسجيل عبر الدعوة */
              <form onSubmit={onRegister}>
                <CardContent className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>البريد الإلكتروني</Label>
                    <Input value={invite.email} readOnly disabled dir="ltr" className="text-left" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="name">الاسم</Label>
                    <Input id="name" autoComplete="name" {...register('name')} />
                    {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">كلمة المرور</Label>
                    <Input id="password" type="password" autoComplete="new-password" dir="ltr" className="text-left" {...register('password')} />
                    {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" type="submit" disabled={submitting}>
                    {submitting ? 'جارٍ إنشاء الحساب…' : 'إنشاء الحساب والانضمام'}
                  </Button>
                </CardFooter>
              </form>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
