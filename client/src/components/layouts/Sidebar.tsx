import { NavLink, useSearchParams } from 'react-router-dom'

import { useJourneyCompletions } from '@/hooks/useJourneyCompletions'
import { canOpenStage, JOURNEY_STAGES, type StageId } from '@/lib/journeyStages'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { ACCENT_CLASSES, navFor } from './nav'

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'صاحب أعمال',
  MANAGER: 'مدير',
  INVESTOR: 'مستثمر',
}

// حالة قسم مرتبط بمرحلة استراتيجية.
type StageStatus = 'locked' | 'available' | 'complete'

function stageStatus(
  stageId: StageId,
  completions: Record<StageId, boolean>,
): StageStatus {
  if (completions[stageId]) return 'complete'
  if (canOpenStage(stageId, completions)) return 'available'
  return 'locked'
}

const STATUS_ICON: Record<StageStatus, string> = {
  locked:    '🔒',
  available: '',
  complete:  '✓',
}

const STATUS_TITLE: Record<StageStatus, string> = {
  locked:    'مقفلة — أكمل المرحلة السابقة أولاً',
  available: 'متاحة — يمكنك البدء',
  complete:  'مكتَملة',
}

export function Sidebar() {
  const user = useAuthStore((s) => s.user)
  const userType = user?.userType ?? useAuthStore.getState().selectedType ?? null
  const isAdmin = user?.isAdmin === true
  const isPro = user?.userType === 'MANAGER' && user?.managerType === 'INDEPENDENT_PRO'
  // العميل النشط من ?client=<id> — تُعتَبر شارات المراحل بحسب صحّة عميل واحد
  // في وقت واحد. لو غير موجودة → لا نُظهر شارات (نتجنب استدعاءات مكلفة بلا داعٍ).
  const [params] = useSearchParams()
  const activeClientId = isPro ? params.get('client') : null
  const { completions } = useJourneyCompletions(activeClientId)
  // نستنسخ الأقسام ونحذف: adminOnly لغير المسؤولين + proOnly لغير المستقل،
  // ثم نُسقط الأقسام التي فرغت (M1..M3 تختفي كلياً للمدير الداخلي).
  const sections = navFor(userType, user?.managerType, user?.specialtyDeptType)
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => {
        if (i.adminOnly && !isAdmin) return false
        if (i.proOnly && !isPro) return false
        return true
      }),
    }))
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
            {isPro && activeClientId && (
              <div className="mt-2 rounded-md border bg-card/70 px-2 py-1 text-[10px] text-muted-foreground">
                📊 تعرض حالة رحلة العميل الحالي
              </div>
            )}
          </div>
        )}

        <nav className="flex flex-1 flex-col gap-5 p-3">
          {sections.map((section) => {
            const accent = ACCENT_CLASSES[section.accent]
            // شارة المرحلة (تظهر فقط عند: pro + client + section له stageId)
            const status: StageStatus | null =
              isPro && activeClientId && section.stageId
                ? stageStatus(section.stageId, completions)
                : null
            const stageIcon = status ? STATUS_ICON[status] : ''
            const stageTitle = status ? STATUS_TITLE[status] : undefined
            const isLocked = status === 'locked'
            // نُطبّق شفافية على الأقسام المقفلة للتلميح البصري.
            return (
              <div key={section.title} className={cn('flex flex-col gap-1', isLocked && 'opacity-50')}>
                <div className="flex items-center gap-2 px-2 pb-1">
                  <span className={cn('inline-block size-1.5 rounded-full', accent.dot)} />
                  <span className="flex-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {section.title}
                  </span>
                  {stageIcon && (
                    <span
                      className={cn(
                        'text-[11px]',
                        status === 'complete' && 'text-emerald-600',
                      )}
                      title={stageTitle}
                    >
                      {stageIcon}
                    </span>
                  )}
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
          {/* Legend at the bottom — يشرح الشارات لو الشخص لأول مرة يرى */}
          {isPro && activeClientId && sections.some((s) => s.stageId) && (
            <div className="mt-2 rounded-md border border-dashed bg-card/40 p-2 text-[10px] text-muted-foreground">
              <div className="mb-1 font-semibold">دليل الشارات:</div>
              <div className="flex flex-wrap gap-3">
                <span>🔒 مقفلة</span>
                <span>● قيد العمل</span>
                <span className="text-emerald-600">✓ مكتَملة</span>
              </div>
            </div>
          )}
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
