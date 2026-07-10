import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api, apiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import type { StrategyPath, User } from '@/types/user'

// ─── /settings/path — تغيير المسار الاستراتيجي لاحقاً ────────────
// نفس بطاقات الشريحة ٤ في /onboarding. عند الحفظ نستدعي PATCH /api/auth/me
// (السيرفر يُحدّث pathChosenAt تلقائياً).

const OPTIONS: {
  code: StrategyPath
  icon: string
  labelAr: string
  timeAr: string
  focusAr: string
  stagesAr: string
  toolsAr: string
  colorClass: string
}[] = [
  {
    code: 'QUICK',
    icon: '⚡',
    labelAr: 'سريع',
    timeAr: '٠–٣ شهور',
    focusAr: 'تشخيص + مبادرات فورية',
    stagesAr: 'المراحل: ① ② ⑤ ⑥',
    toolsAr: '~٣ أدوات أساسية',
    colorClass: 'border-amber-400 hover:border-amber-500 bg-amber-50/40',
  },
  {
    code: 'MEDIUM',
    icon: '🎯',
    labelAr: 'متوسط',
    timeAr: '٣–١٢ شهر',
    focusAr: 'تشخيص + توليف + توجّه + مبادرات',
    stagesAr: 'المراحل: ① ② ③ ⑤ ⑥',
    toolsAr: '~٦ أدوات أساسية',
    colorClass: 'border-sky-400 hover:border-sky-500 bg-sky-50/40',
  },
  {
    code: 'LONG',
    icon: '🔭',
    labelAr: 'طويل',
    timeAr: '١٢–٣٦+ شهر',
    focusAr: 'الرحلة الاستراتيجية الكاملة',
    stagesAr: 'المراحل: كلها ①→⑥',
    toolsAr: 'كل الأدوات',
    colorClass: 'border-purple-400 hover:border-purple-500 bg-purple-50/40',
  },
]

export function PathSettingsPage() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()
  const [selected, setSelected] = useState<StrategyPath | null>(user?.strategyPath ?? null)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!selected) {
      toast.error('اختر مساراً أولاً')
      return
    }
    setSaving(true)
    try {
      const { data } = await api.patch<{ user: User }>('/api/auth/me', { strategyPath: selected })
      setUser(data.user)
      toast.success('تم تحديث مسارك الاستراتيجي')
      navigate(-1)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>🎯 مسارك الاستراتيجي</CardTitle>
          <CardDescription>
            حدّد عمق الرحلة الاستراتيجية — يُغيّر ترتيب السايدبار وإبراز الأدوات
            على الآفاق الثلاثة والقرار.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-3">
          {OPTIONS.map((opt) => {
            const isSelected = selected === opt.code
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => setSelected(opt.code)}
                className={`flex flex-col gap-2 rounded-xl border-2 p-4 text-right transition ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/40'
                    : opt.colorClass
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-3xl" aria-hidden>{opt.icon}</span>
                  <span className="rounded-md bg-card px-2 py-0.5 text-[10px] font-medium">{opt.timeAr}</span>
                </div>
                <div className="text-lg font-bold">{opt.labelAr}</div>
                <div className="text-xs leading-relaxed text-muted-foreground">
                  <div><strong className="text-foreground">التركيز:</strong> {opt.focusAr}</div>
                  <div className="mt-1">{opt.stagesAr}</div>
                  <div className="mt-1 text-muted-foreground/80">{opt.toolsAr}</div>
                </div>
                {isSelected && <div className="mt-1 text-xs font-medium text-primary">✓ مختار</div>}
              </button>
            )
          })}
        </CardContent>
        <div className="flex items-center justify-between gap-2 border-t p-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>إلغاء</Button>
          <Button onClick={save} disabled={saving || !selected}>
            {saving ? 'جاري الحفظ…' : 'حفظ المسار'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
