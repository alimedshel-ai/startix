import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { MATURITY_BY_SPECIALTY } from '@/lib/maturityConfigs'
import { useAuthStore } from '@/store/authStore'
import type { SpecialtyDeptType, UserType } from '@/types/user'

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

// نفس ترتيب SPECIALTY_OPTIONS في JoinPage — يجب أن يبقيا متزامنَين.
const SPECIALTIES: { value: SpecialtyDeptType; label: string; icon: string }[] = [
  { value: 'HR',                label: 'الموارد البشرية', icon: '👤' },
  { value: 'FINANCE',           label: 'المالية',          icon: '💰' },
  { value: 'SALES',             label: 'المبيعات',         icon: '💼' },
  { value: 'MARKETING',         label: 'التسويق',          icon: '📢' },
  { value: 'OPERATIONS',        label: 'العمليات',         icon: '⚙️' },
  { value: 'IT',                label: 'تقنية المعلومات',  icon: '💻' },
  { value: 'CUSTOMER_SERVICE',  label: 'خدمة العملاء',     icon: '📞' },
  { value: 'SUPPORT',           label: 'الإمداد والدعم',   icon: '🚚' },
  { value: 'LOGISTICS',         label: 'اللوجستيات',       icon: '📦' },
  { value: 'QUALITY',           label: 'الجودة',           icon: '✅' },
  { value: 'PROJECTS',          label: 'المشاريع',         icon: '📋' },
  { value: 'GOVERNANCE',        label: 'الحوكمة',          icon: '🏛️' },
  { value: 'COMPLIANCE',        label: 'الامتثال',         icon: '⚖️' },
]

export function SelectTypePage() {
  const navigate = useNavigate()
  const authedUser = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setSelectedType = useAuthStore((s) => s.setSelectedType)
  const setSelectedManagerType = useAuthStore((s) => s.setSelectedManagerType)
  const setSelectedSpecialty = useAuthStore((s) => s.setSelectedSpecialty)
  const storedSpecialty = useAuthStore((s) => s.selectedSpecialty)
  const [params] = useSearchParams()

  // مستخدم مسجّل يفتح /select-type؟ نوجّهه لصفحته الرئيسية بدل السماح
  // له باختيار دور جديد فوق حسابه القائم. يمنع خلط الأدوار في نفس المتصفّح.
  useEffect(() => {
    if (!isAuthenticated || !authedUser) return
    const home =
      authedUser.userType === 'MANAGER' ? '/manager/dept-dashboard'
      : authedUser.userType === 'INVESTOR' ? '/investor/dashboard'
      : '/dashboard'
    navigate(home, { replace: true })
  }, [isAuthenticated, authedUser, navigate])

  // خطوات هذه الشاشة: role → managerType (إن كان MANAGER) → specialty (إن
  // كان INDEPENDENT_PRO). نستعمل حالة محلية بدلاً من الاعتماد على الـ store
  // لأنها لحظية — نلتزم بها في الـ store فقط عند الضغط على "متابعة".
  const [step, setStep] = useState<'role' | 'specialty'>('role')

  // لو الزائر جاي من /diagnostic/try ومعه ?role=OWNER|MANAGER|INVESTOR،
  // نتصرّف حسب ما تمّ التقاطه سابقاً:
  //   - OWNER/INVESTOR → مباشرة إلى /join.
  //   - MANAGER + managerType محفوظ + (INTERNAL أو specialty محفوظ)
  //     → مباشرة إلى /join (التشخيص التقط كل شيء).
  //   - MANAGER بدون تفاصيل → عرض الخطوة الفرعية للاستكمال.
  useEffect(() => {
    const r = params.get('role')
    if (r === 'OWNER' || r === 'INVESTOR') {
      setSelectedType(r)
      navigate('/join', { replace: true })
      return
    }
    if (r === 'MANAGER') {
      setSelectedType(r)
      // ق١: المدير الذاتيّ = مستقلّ حصراً (الداخليّ دعوةً من المالك فقط، يُضبَط
      // managerType عند قبول الدعوة لا هنا). لا خطوة اختيار نوع.
      setSelectedManagerType('INDEPENDENT_PRO')
      if (storedSpecialty != null) {
        navigate('/join', { replace: true })
        return
      }
      setStep('specialty')
    }
  }, [params, navigate, setSelectedType, setSelectedManagerType, storedSpecialty])

  const chooseRole = (type: UserType) => {
    if (type === 'MANAGER') {
      // ق١: المدير الذاتيّ مستقلٌّ حصراً — لا خطوة اختيار نوع (الداخليّ دعوةً من
      // المالك فقط). نضبط النوع مباشرة وننتقل للتخصّص.
      setSelectedType('MANAGER')
      setSelectedManagerType('INDEPENDENT_PRO')
      setStep('specialty')
      return
    }
    setSelectedType(type)
    navigate('/join')
  }

  const chooseSpecialty = (s: SpecialtyDeptType) => {
    setSelectedSpecialty(s)
    // التخصّصات التي لها تقييم نضج «قبل التسجيل» → جرّبه أوّلاً (التخصّص محفوظ فيلتقطه /join).
    if (MATURITY_BY_SPECIALTY[s]) { navigate(`/diagnostic/m/${s.toLowerCase()}`); return }
    navigate('/join')
  }

  const back = () => {
    if (step === 'specialty') {
      setStep('role')
      return
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-10 px-6 py-16">
      <div className="text-center">
        {step === 'role' ? (
          <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <span>← العودة للصفحة الرئيسية</span>
          </Link>
        ) : (
          <button onClick={back} className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <span>← رجوع</span>
          </button>
        )}
        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          {step === 'role' && 'كيف ستستخدم ستارتكس؟'}
          {step === 'specialty' && 'ما هو تخصّصك؟'}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {step === 'role' && 'اختر الدور الذي يناسبك — تقدر تغيّره لاحقاً.'}
          {step === 'specialty' && 'اختر الإدارة التي تشرف عليها لدى عملائك — ستُستخدم لتخصيص التشخيص وتصفية لوحاتك.'}
        </p>
      </div>

      {step === 'role' && (
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
                <Button className="w-full" onClick={() => chooseRole(o.type)}>
                  المتابعة كـ{o.title}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {step === 'specialty' && (
        <div className="grid w-full gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {SPECIALTIES.map((s) => (
            <button
              key={s.value}
              onClick={() => chooseSpecialty(s.value)}
              className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
            >
              <span className="text-3xl" aria-hidden>{s.icon}</span>
              <span className="text-sm font-medium">{s.label}</span>
            </button>
          ))}
        </div>
      )}

      {step === 'role' && (
        <Link to="/login" className={buttonVariants({ variant: 'ghost' })}>
          لديك حساب؟ تسجيل الدخول
        </Link>
      )}
    </div>
  )
}

