import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/store/authStore'

const PLAN_LABEL: Record<string, string> = {
  BASIC: 'أساسي',
  PROFESSIONAL: 'احترافي',
  ENTERPRISE: 'مؤسسي',
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
        <Button variant="ghost" size="icon" aria-label="إشعارات" className="relative">
          <span aria-hidden>🔔</span>
        </Button>

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
            <DropdownMenuItem onSelect={() => navigate('/onboarding')}>
              <span className="ml-2">👤</span> الملف الشخصي
            </DropdownMenuItem>
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
