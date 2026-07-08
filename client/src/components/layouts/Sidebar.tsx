import { NavLink } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { ACCENT_CLASSES, navFor } from './nav'

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'صاحب أعمال',
  MANAGER: 'مدير',
  INVESTOR: 'مستثمر',
}

export function Sidebar() {
  const user = useAuthStore((s) => s.user)
  const userType = user?.userType ?? useAuthStore.getState().selectedType ?? null
  const isAdmin = user?.isAdmin === true
  // نستنسخ الأقسام ونحذف عناصر adminOnly لغير المسؤولين، ثم نُسقط الأقسام
  // التي فرغت — حتى لا يظهر عنوان قسم بلا عناصر.
  const sections = navFor(userType, user?.managerType)
    .map((s) => ({ ...s, items: s.items.filter((i) => (i.adminOnly ? isAdmin : true)) }))
    .filter((s) => s.items.length > 0)

  return (
    <aside className="w-72 shrink-0 border-l bg-card/40">
      <div className="sticky top-14 flex h-[calc(100vh-3.5rem)] flex-col overflow-y-auto">
        {/* User block at top */}
        {user && (
          <div className="border-b bg-gradient-to-bl from-primary/10 to-transparent p-4">
            <div className="text-sm font-semibold">{user.name}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {ROLE_LABEL[userType ?? ''] ?? '—'} · {user.plan === 'BASIC' ? 'أساسي' : user.plan === 'PROFESSIONAL' ? 'احترافي' : 'مؤسسي'}
            </div>
          </div>
        )}

        <nav className="flex flex-1 flex-col gap-5 p-3">
          {sections.map((section) => {
            const accent = ACCENT_CLASSES[section.accent]
            return (
              <div key={section.title} className="flex flex-col gap-1">
                <div className="flex items-center gap-2 px-2 pb-1">
                  <span className={cn('inline-block size-1.5 rounded-full', accent.dot)} />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {section.title}
                  </span>
                </div>
                <ul className="flex flex-col gap-0.5">
                  {section.items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end
                        className={({ isActive }) =>
                          cn(
                            'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                            isActive
                              ? `${accent.bgSoft} ${accent.text} font-medium`
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          )
                        }
                      >
                        {item.icon && <span className="text-base leading-none">{item.icon}</span>}
                        <span className="flex-1 truncate text-right">{item.label}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
          {sections.length === 0 && (
            <p className="px-2 text-xs text-muted-foreground">
              اختر دورك من <a href="/select-type" className="underline">/select-type</a> لعرض القائمة.
            </p>
          )}
        </nav>

        <div className="border-t p-3 text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} ستارتكس
        </div>
      </div>
    </aside>
  )
}
