import { NavLink } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { navFor } from './nav'

export function Sidebar() {
  const userType = useAuthStore((s) => s.user?.userType ?? s.selectedType ?? null)
  const sections = navFor(userType)

  return (
    <aside className="w-64 shrink-0 border-r bg-card/30">
      <div className="sticky top-0 flex h-[calc(100vh-3.5rem)] flex-col gap-6 overflow-y-auto p-4">
        {sections.map((section) => (
          <div key={section.title} className="flex flex-col gap-1">
            <div className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </div>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end
                    className={({ isActive }) =>
                      cn(
                        'block rounded-md px-2 py-1.5 text-sm transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {sections.length === 0 && (
          <p className="px-2 text-xs text-muted-foreground">
            Pick a role on /select-type to see your menu.
          </p>
        )}
      </div>
    </aside>
  )
}
