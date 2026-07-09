import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { listMyNotifications, markNotificationRead, type Notification } from '@/lib/notificationsApi'
import { useAuthStore } from '@/store/authStore'

const PLAN_LABEL: Record<string, string> = {
  BASIC: 'أساسي',
  PROFESSIONAL: 'احترافي',
  ENTERPRISE: 'مؤسسي',
}

// جرس الإشعارات — يستدعي GET /api/notifications/me عند التحميل، يعرض عدّاد
// غير مقروء، ويسمح بالتعليم كمقروء من dropdown. لا يعيد تصميم الشريط.
function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let cancel = false
    listMyNotifications()
      .then((p) => {
        if (cancel) return
        setNotifications(p.notifications)
        setUnread(p.unread)
      })
      .catch(() => {
        // فشل الجلب لا يجب أن يكسر الـ chrome — نتجاهله بصمت.
      })
    return () => { cancel = true }
  }, [])

  async function markRead(id: string) {
    // تحديث متفائل — نتراجع عند الفشل.
    const wasUnread = notifications.find((n) => n.id === id)?.read === false
    setNotifications((rows) => rows.map((n) => (n.id === id ? { ...n, read: true } : n)))
    if (wasUnread) setUnread((u) => Math.max(0, u - 1))
    try {
      await markNotificationRead(id)
    } catch {
      // تراجع
      setNotifications((rows) => rows.map((n) => (n.id === id ? { ...n, read: false } : n)))
      if (wasUnread) setUnread((u) => u + 1)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative inline-flex items-center justify-center rounded-md p-2 transition hover:bg-muted" aria-label="إشعارات">
        <span aria-hidden>🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -end-0.5 min-w-4 rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>الإشعارات</span>
          {unread > 0 && (
            <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-700 dark:text-rose-300">
              {unread} غير مقروء
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            لا توجد إشعارات بعد.
          </div>
        )}
        {notifications.slice(0, 8).map((n) => (
          <DropdownMenuItem
            key={n.id}
            onSelect={(e) => {
              e.preventDefault()
              if (!n.read) markRead(n.id)
            }}
            className={`flex-col items-start gap-0.5 ${n.read ? 'opacity-70' : ''}`}
          >
            <span className={`text-xs leading-snug ${n.read ? '' : 'font-medium'}`}>{n.message}</span>
            <span className="text-[10px] text-muted-foreground">
              {new Date(n.createdAt).toLocaleString('ar-SA')}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function initials(name?: string | null) {
  if (!name) return '؟؟'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join('')
}

export function Topbar() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/80 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Link to="/" className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70 font-bold text-primary-foreground shadow-sm">
          س
        </span>
        <span className="text-lg font-bold tracking-tight">ستارتكس</span>
      </Link>

      <div className="flex items-center gap-2">
        <NotificationBell />


        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg p-1 transition hover:bg-muted">
            <Avatar className="size-9 ring-2 ring-primary/10">
              <AvatarFallback className="bg-primary/15 text-primary font-semibold">{initials(user?.name)}</AvatarFallback>
            </Avatar>
            <div className="hidden flex-col items-end text-right md:flex">
              <span className="text-sm font-medium leading-tight">{user?.name ?? 'الحساب'}</span>
              <span className="text-[10px] text-muted-foreground">{PLAN_LABEL[user?.plan ?? 'BASIC']}</span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="font-semibold">{user?.name}</span>
              <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/pricing')}>
              <span className="ml-2">💎</span> الباقة: {PLAN_LABEL[user?.plan ?? 'BASIC']}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={async () => {
                await logout()
                navigate('/')
              }}
            >
              <span className="ml-2">🚪</span> تسجيل الخروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
