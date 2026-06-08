import { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/authStore'
import type { UserType } from '@/types/user'

const OPTIONS: { type: UserType; title: string; blurb: string; icon: string }[] = [
  {
    type: 'OWNER',
    title: 'صاحب أعمال',
    blurb: 'تدير استراتيجية شركتك عبر ١٣ إدارة، مع تشخيص ومسار استراتيجي مخصّص.',
    icon: '👔',
  },
  {
    type: 'MANAGER',
    title: 'مدير / مستشار',
    blurb: 'تدير الاستراتيجية لعملاء أو لإدارة داخل المنشأة، مع أدوات تدقيق متقدمة.',
    icon: '📋',
  },
  {
    type: 'INVESTOR',
    title: 'مستثمر',
    blurb: 'تقيّم الصحة الاستراتيجية والتشغيلية للشركات في محفظتك.',
    icon: '📈',
  },
]

export function SelectTypePage() {
  const navigate = useNavigate()
  const setSelectedType = useAuthStore((s) => s.setSelectedType)
  const [params] = useSearchParams()

  // لو الزائر جاي من /diagnostic/try ومعه ?role=OWNER|MANAGER|INVESTOR،
  // نخطّي اختيار النوع ونروح مباشرة لصفحة التسجيل.
  useEffect(() => {
    const r = params.get('role')
    if (r === 'OWNER' || r === 'MANAGER' || r === 'INVESTOR') {
      setSelectedType(r)
      navigate('/join', { replace: true })
    }
  }, [params, navigate, setSelectedType])

  const choose = (type: UserType) => {
    setSelectedType(type)
    navigate('/join')
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-10 px-6 py-16">
      <div className="text-center">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <span>← العودة للصفحة الرئيسية</span>
        </Link>
        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          كيف ستستخدم ستارتكس؟
        </h1>
        <p className="mt-3 text-muted-foreground">
          اختر الدور الذي يناسبك — تقدر تغيّره لاحقاً.
        </p>
      </div>

      <div className="grid w-full gap-4 md:grid-cols-3">
        {OPTIONS.map((o) => (
          <Card key={o.type} className="group flex flex-col transition hover:-translate-y-1 hover:shadow-md">
            <CardHeader>
              <div className="mb-2 text-3xl">{o.icon}</div>
              <CardTitle className="text-lg">{o.title}</CardTitle>
              <CardDescription className="leading-relaxed">{o.blurb}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1" />
            <CardFooter>
              <Button className="w-full" onClick={() => choose(o.type)}>
                المتابعة كـ{o.title}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Link to="/login" className={buttonVariants({ variant: 'ghost' })}>
        لديك حساب؟ تسجيل الدخول
      </Link>
    </div>
  )
}
