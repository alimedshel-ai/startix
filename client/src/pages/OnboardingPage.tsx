import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { homeFor } from '@/components/layouts/nav'
import { api, apiErrorMessage } from '@/lib/api'
import { ENTITY_TYPES, ONBOARDING_GOALS, ONBOARDING_PAINS, SECTORS } from '@/lib/onboardingOptions'
import { useAuthStore } from '@/store/authStore'
import type { OpexData, User } from '@/types/user'

// ─── R1.3 — /onboarding: 3 شرائح بعد التسجيل ────────────────────────
// الشرائح: الهوية+OPEX → الآلام → الأهداف. كل شريحة اختيارية
// (يمكن التخطّي). يحفظ عبر POST /api/auth/onboarding في طلب واحد.
//
// المنطق:
//   • Owner: يظهر فقط شريحة الآلام والأهداف (لا عميل خارجي).
//   • Manager INTERNAL: نفس Owner.
//   • Manager INDEPENDENT_PRO: كل الشرائح الثلاث.
//   • Investor: نفس Owner (بلا OPEX).

type SlideId = 'identity' | 'pains' | 'goals'

interface FormState {
  sector?: string
  subsector?: string
  entityType?: string
  size?: 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE'
  opex: OpexData
  pains: string[]
  goals: string[]
}

const EMPTY: FormState = { opex: {}, pains: [], goals: [] }

export function OnboardingPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const clearDraft = useAuthStore((s) => s.clearOnboardingDraft)
  const draft = useAuthStore((s) => s.onboardingDraft)

  const [state, setState] = useState<FormState>(() => ({
    ...EMPTY,
    ...draft.firstClientMeta,
    opex: { ...(draft.firstClientMeta?.opex ?? {}) },
    pains: draft.pains ?? [],
    goals: draft.goals ?? [],
  }))
  const [saving, setSaving] = useState(false)

  const showIdentity = user?.userType === 'MANAGER' && user?.managerType === 'INDEPENDENT_PRO'
  const slides = useMemo<SlideId[]>(
    () => (showIdentity ? ['identity', 'pains', 'goals'] : ['pains', 'goals']),
    [showIdentity],
  )
  const [step, setStep] = useState(0)
  const currentSlide = slides[step]
  const isLast = step === slides.length - 1

  if (!user) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">جاري التحميل…</p>
      </div>
    )
  }

  function togglePain(code: string) {
    setState((prev) => ({
      ...prev,
      pains: prev.pains.includes(code)
        ? prev.pains.filter((c) => c !== code)
        : [...prev.pains, code],
    }))
  }
  function toggleGoal(code: string) {
    setState((prev) => ({
      ...prev,
      goals: prev.goals.includes(code)
        ? prev.goals.filter((c) => c !== code)
        : [...prev.goals, code],
    }))
  }
  function setOpex<K extends keyof OpexData>(key: K, raw: string) {
    const num = raw === '' ? undefined : Number(raw)
    const value = Number.isFinite(num) ? num : undefined
    setState((prev) => ({ ...prev, opex: { ...prev.opex, [key]: value } }))
  }

  async function submit() {
    setSaving(true)
    try {
      const payload = {
        pains: state.pains,
        goals: state.goals,
        firstCompany: showIdentity
          ? {
              sector: state.sector || undefined,
              subsector: state.subsector || undefined,
              entityType: state.entityType || undefined,
              size: state.size,
              opex: state.opex,
            }
          : undefined,
      }
      const { data } = await api.post<{ user: User }>('/api/auth/onboarding', payload)
      setUser(data.user)
      clearDraft()
      toast.success('تم حفظ بياناتك — أهلاً بك.')
      navigate(homeFor(data.user.userType, data.user.managerType), { replace: true })
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  function skip() {
    clearDraft()
    navigate(homeFor(user!.userType, user!.managerType), { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            {slides.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`}
              />
            ))}
          </div>
          <CardTitle>
            {currentSlide === 'identity' && 'بيانات أوّل عميل — الهوية والميزانية'}
            {currentSlide === 'pains'    && 'ما التحديات الأكبر حالياً؟'}
            {currentSlide === 'goals'    && 'ما الأهداف الأولى بالنسبة لك؟'}
          </CardTitle>
          <CardDescription>
            {currentSlide === 'identity' && 'تُستخدم في KPIs / تحليل الفجوة / أنسوف / RACI بلا سؤالك مرّة أخرى.'}
            {currentSlide === 'pains'    && 'اختيار متعدّد — يُحدّد ترتيب أدواتك (مصفوفة الأولوية / أيزنهاور).'}
            {currentSlide === 'goals'    && 'اختيار متعدّد — يُشغّل الأدوات المرتبطة بأهدافك تلقائياً.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-6">
          {currentSlide === 'identity' && (
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="sector">القطاع</Label>
                  <select
                    id="sector"
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={state.sector ?? ''}
                    onChange={(e) => setState((p) => ({ ...p, sector: e.target.value }))}
                  >
                    <option value="">اختر…</option>
                    {SECTORS.map((s) => (
                      <option key={s.code} value={s.code}>{s.labelAr}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="subsector">النشاط الفرعي</Label>
                  <Input
                    id="subsector"
                    placeholder="مثال: تجارة تجزئة إلكترونية"
                    value={state.subsector ?? ''}
                    onChange={(e) => setState((p) => ({ ...p, subsector: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="entityType">نوع الكيان</Label>
                  <select
                    id="entityType"
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={state.entityType ?? ''}
                    onChange={(e) => setState((p) => ({ ...p, entityType: e.target.value }))}
                  >
                    <option value="">اختر…</option>
                    {ENTITY_TYPES.map((e) => (
                      <option key={e.code} value={e.code}>{e.labelAr}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="size">حجم المنشأة</Label>
                  <select
                    id="size"
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={state.size ?? ''}
                    onChange={(e) => setState((p) => ({ ...p, size: (e.target.value || undefined) as FormState['size'] }))}
                  >
                    <option value="">اختر…</option>
                    <option value="MICRO">متناهية الصغر (1-4 موظفين)</option>
                    <option value="SMALL">صغيرة (5-49)</option>
                    <option value="MEDIUM">متوسطة (50-249)</option>
                    <option value="LARGE">كبيرة (≥ 250)</option>
                  </select>
                </div>
              </div>

              <div className="rounded-lg border bg-primary/5 p-4">
                <div className="mb-3 text-sm font-semibold">OPEX — أرقام تشغيلية سنوية</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1">
                    <Label htmlFor="team" className="text-xs">عدد الفريق</Label>
                    <Input
                      id="team" type="number" min={0}
                      value={state.opex.team ?? ''}
                      onChange={(e) => setOpex('team', e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="budget" className="text-xs">الميزانية السنوية (SAR)</Label>
                    <Input
                      id="budget" type="number" min={0}
                      value={state.opex.budget ?? ''}
                      onChange={(e) => setOpex('budget', e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="target" className="text-xs">المستهدف السنوي (SAR)</Label>
                    <Input
                      id="target" type="number" min={0}
                      value={state.opex.target ?? ''}
                      onChange={(e) => setOpex('target', e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="avgSalary" className="text-xs">متوسط الراتب الشهري (SAR)</Label>
                    <Input
                      id="avgSalary" type="number" min={0}
                      value={state.opex.avgSalary ?? ''}
                      onChange={(e) => setOpex('avgSalary', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentSlide === 'pains' && (
            <div className="grid gap-2 sm:grid-cols-2">
              {ONBOARDING_PAINS.map((p) => {
                const selected = state.pains.includes(p.code)
                return (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => togglePain(p.code)}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-right transition ${
                      selected
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'bg-card hover:bg-accent'
                    }`}
                  >
                    <span className="text-2xl" aria-hidden>{p.icon}</span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{p.labelAr}</span>
                      {p.desc && <span className="mt-0.5 block text-xs text-muted-foreground">{p.desc}</span>}
                    </span>
                    {selected && <span className="text-primary" aria-hidden>✓</span>}
                  </button>
                )
              })}
            </div>
          )}

          {currentSlide === 'goals' && (
            <div className="grid gap-2 sm:grid-cols-2">
              {ONBOARDING_GOALS.map((g) => {
                const selected = state.goals.includes(g.code)
                return (
                  <button
                    key={g.code}
                    type="button"
                    onClick={() => toggleGoal(g.code)}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-right transition ${
                      selected
                        ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                        : 'bg-card hover:bg-accent'
                    }`}
                  >
                    <span className="text-2xl" aria-hidden>{g.icon}</span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{g.labelAr}</span>
                      {g.desc && <span className="mt-0.5 block text-xs text-muted-foreground">{g.desc}</span>}
                    </span>
                    {selected && <span className="text-emerald-600" aria-hidden>✓</span>}
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>

        <div className="flex items-center justify-between gap-2 border-t p-4">
          <Button variant="ghost" onClick={skip}>
            تخطّي الجميع
          </Button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>السابق</Button>
            )}
            {!isLast && (
              <Button onClick={() => setStep((s) => s + 1)}>التالي ←</Button>
            )}
            {isLast && (
              <Button onClick={submit} disabled={saving}>
                {saving ? 'جاري الحفظ…' : 'حفظ والمتابعة'}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
