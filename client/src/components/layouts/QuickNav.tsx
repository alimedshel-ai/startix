import { useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { useAuthStore } from '@/store/authStore'
import { homeFor } from './nav'

// ─── QuickNav — شريط تنقّل سريع تحت Topbar ────────────────────────
// أزرار:
//   ← رجوع | → للأمام | 🏠 الرئيسيّة | 📋 خطتي | ⚙️ الإعدادات | 🚪 خروج
// اختصارات لوحة المفاتيح:
//   Alt + → : رجوع  ·  Alt + ← : تقدّم (RTL)
//   Alt + H : الرئيسيّة
//   Alt + P : الخطة الاستراتيجيّة (للمدير)
//   Alt + Q : تسجيل الخروج
// الغرض: تنقّل موحّد بلا حاجة لأزرار المتصفّح، وخروج بضغطة واحدة.

interface NavButton {
  key: string
  icon: string
  labelAr: string
  onClick: () => void
  shortcutAr: string
  primary?: boolean
  hidden?: boolean
  danger?: boolean
}

export function QuickNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const home = homeFor(user?.userType, user?.managerType)
  const isManager = user?.userType === 'MANAGER'
  const activeClient = params.get('client')
    ?? location.pathname.match(/^\/manager\/clients\/([^/]+)$/)?.[1]
    ?? null
  const planUrl = activeClient
    ? `/manager/strategic-plan?client=${activeClient}`
    : '/manager/strategic-plan'

  const buttons: NavButton[] = [
    {
      key: 'back',
      icon: '←',
      labelAr: 'رجوع',
      shortcutAr: 'Alt+→',
      onClick: () => navigate(-1),
    },
    {
      key: 'forward',
      icon: '→',
      labelAr: 'تقدّم',
      shortcutAr: 'Alt+←',
      onClick: () => navigate(1),
    },
    {
      key: 'home',
      icon: '🏠',
      labelAr: 'الرئيسيّة',
      shortcutAr: 'Alt+H',
      onClick: () => navigate(home),
      primary: true,
    },
    {
      key: 'plan',
      icon: '📖',
      labelAr: 'الخطة الاستراتيجيّة',
      shortcutAr: 'Alt+P',
      onClick: () => navigate(planUrl),
      hidden: !isManager,
      primary: true,
    },
    {
      key: 'settings',
      icon: '⚙️',
      labelAr: 'مساري',
      shortcutAr: '',
      onClick: () => navigate('/settings/path'),
      hidden: !isManager,
    },
    {
      key: 'logout',
      icon: '🚪',
      labelAr: 'خروج',
      shortcutAr: 'Alt+Q',
      onClick: async () => {
        await logout()
        navigate('/')
      },
      danger: true,
    },
  ]

  // اختصارات لوحة المفاتيح — Alt + مفتاح
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey) return
      // نتجاهل عندما يكون التركيز داخل input/textarea لتفادي كسر الكتابة.
      const tgt = e.target as HTMLElement | null
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return
      // في RTL: → معناه «السابق»، ← معناه «التالي».
      if (e.key === 'ArrowRight') { e.preventDefault(); navigate(-1); return }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); navigate(1);  return }
      const k = e.key.toLowerCase()
      if (k === 'h') { e.preventDefault(); navigate(home); return }
      if (k === 'p' && isManager) { e.preventDefault(); navigate(planUrl); return }
      if (k === 'q') {
        e.preventDefault()
        void logout().then(() => navigate('/'))
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, home, planUrl, isManager, logout])

  const visible = buttons.filter((b) => !b.hidden)

  return (
    <div className="sticky top-14 z-20 flex items-center gap-1 border-b bg-background/70 px-4 py-1.5 backdrop-blur">
      {visible.map((b) => (
        <button
          key={b.key}
          type="button"
          onClick={b.onClick}
          title={b.shortcutAr ? `${b.labelAr} (${b.shortcutAr})` : b.labelAr}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
            b.primary
              ? 'border border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground'
              : b.danger
                ? 'border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <span aria-hidden>{b.icon}</span>
          <span className="hidden sm:inline">{b.labelAr}</span>
        </button>
      ))}
      <div className="mr-auto text-[10px] text-muted-foreground/70">
        <span className="hidden md:inline">اختصارات: Alt+→ رجوع · Alt+H الرئيسيّة · Alt+Q خروج</span>
      </div>
    </div>
  )
}
