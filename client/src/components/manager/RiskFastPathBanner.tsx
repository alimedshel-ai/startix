import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { api, apiErrorMessage } from '@/lib/api'
import type { DangerZone } from '@/lib/deptApi'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types/user'

// ─── ربط الفحص بالمسار: خطر ⇐ وصّي بالمسار السريع ─────────────────
// عند خطر التدقيق (منطقة حمراء أو صحة < ٤٠٪) نوصي بالتركيز على المسار
// السريع (التشغيلي): «أوقف النزيف» قبل أي خطة تكتيكية/طويلة. توصية قويّة
// لا حجب — يبقى للمدير أن يتجاوز. زر واحد يحوّل strategyPath إلى QUICK.
//
// المُحفّز = نفس تعريف الطوارئ (pickStrategicPath → EMERGENCY) لاتّساق التطبيق.

function isAuditAtRisk(healthPct: number, dangerZone: DangerZone): boolean {
  return dangerZone === 'RED' || healthPct < 40
}

export function RiskFastPathBanner({ companyId, healthPct, dangerZone }: {
  companyId: string
  healthPct: number
  dangerZone: DangerZone
}) {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [saving, setSaving] = useState(false)

  if (!isAuditAtRisk(healthPct, dangerZone)) return null

  const rescueHref = `/manager/strategic-plan?client=${companyId}`
  const alreadyQuick = user?.strategyPath === 'QUICK'

  async function switchToQuick() {
    setSaving(true)
    try {
      const { data } = await api.patch<{ user: User }>('/api/auth/me', { strategyPath: 'QUICK' })
      setUser(data.user)
      toast.success('تحوّلت إلى المسار السريع — ركّز على إيقاف النزيف أوّلاً.')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر تغيير المسار'))
    } finally {
      setSaving(false)
    }
  }

  // على المسار السريع سلفاً → تأكيد لطيف بدل التوصية.
  if (alreadyQuick) {
    return (
      <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50/50 p-3 text-xs leading-relaxed text-emerald-900">
        ✓ أنت على <b>المسار السريع</b> المناسب لحالة الخطر الحاليّة — أوقف النزيف عبر خطة الإنقاذ قبل أي تخطيط أطول.{' '}
        <Link to={rescueHref} className="font-medium underline underline-offset-4">افتح خطة الإنقاذ ←</Link>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border-2 border-rose-400 bg-gradient-to-l from-rose-50 to-transparent p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="text-3xl leading-none" aria-hidden>🚨</span>
          <div className="min-w-0">
            <div className="text-sm font-bold text-rose-900">
              التدقيق في {dangerZone === 'RED' ? 'المنطقة الحمراء' : `منطقة خطر (صحّة ${Math.round(healthPct)}٪)`} — ركّز على المسار السريع
            </div>
            <p className="mt-1 text-xs leading-relaxed text-rose-800/80">
              حالة الإدارة حرجة. الأنسب الآن <b>المسار السريع (التشغيلي)</b>: أوقِف النزيف واستعِد الاستقرار —
              <b> لا تدخل خططاً تكتيكيّة أو طويلة</b> قبل الخروج من الخطر. (يمكنك التجاوز إن أصررت.)
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-1.5">
          <Button onClick={switchToQuick} disabled={saving} className="bg-rose-600 hover:bg-rose-700">
            {saving ? 'جاري…' : '⚡ حوّلني للمسار السريع'}
          </Button>
          <Link to={rescueHref} className="text-center text-[11px] text-rose-700 underline-offset-4 hover:underline">
            أو افتح خطة الإنقاذ ←
          </Link>
        </div>
      </div>
    </div>
  )
}
