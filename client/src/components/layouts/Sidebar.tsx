import { useState } from 'react'
import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom'

import { useJourneyCompletions } from '@/hooks/useJourneyCompletions'
import { useNextStep } from '@/hooks/useNextStep'
import { canOpenStage, isStageInPath, type StageId } from '@/lib/journeyStages'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { ACCENT_CLASSES, navFor, type NavItem, type NavSection } from './nav'

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'صاحب أعمال',
  MANAGER: 'مدير',
  INVESTOR: 'مستثمر',
}

const PATH_LABEL: Record<'QUICK' | 'MEDIUM' | 'LONG', { icon: string; ar: string }> = {
  QUICK:  { icon: '⚡', ar: 'مسار سريع' },
  MEDIUM: { icon: '🎯', ar: 'مسار متوسط' },
  LONG:   { icon: '🔭', ar: 'مسار طويل' },
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

// ─── تحديد وضع السايدبار حسب السياق ─────────────────────────────
// portfolio: المدير المستقل على /manager/clients أو /manager/clients/compare
//   بدون ?client= — نُخفي المراحل ونعرض العملاء + المالي فقط.
// analysis: داخل عميل (?client=X أو /manager/clients/:id) — نعرض المراحل.
// default:  للأدوار الأخرى — سلوك افتراضي (كل الأقسام).
type SidebarMode = 'portfolio' | 'analysis' | 'default'

export function getSidebarMode(pathname: string, hasClientParam: boolean, isPro: boolean): SidebarMode {
  if (!isPro) return 'default'
  if (hasClientParam) return 'analysis'
  // مسارات مرتبطة بالمحفظة (بلا ?client=).
  if (
    pathname === '/manager/clients' ||
    pathname === '/manager/clients/compare' ||
    /^\/manager\/clients\/[^/]+$/.test(pathname)  // client detail بلا ?client=
  ) return 'portfolio'
  return 'analysis'
}

export function Sidebar() {
  const user = useAuthStore((s) => s.user)
  const userType = user?.userType ?? useAuthStore.getState().selectedType ?? null
  const isAdmin = user?.isAdmin === true
  const isPro = user?.userType === 'MANAGER' && user?.managerType === 'INDEPENDENT_PRO'
  const [params] = useSearchParams()
  const location = useLocation()
  // العميل النشط من ?client=<id> — شارات المراحل بحسب صحّة عميل واحد.
  const activeClientId = isPro ? params.get('client') : null
  const pathMatch = location.pathname.match(/^\/manager\/clients\/([^/]+)$/)
  const detailClientId = pathMatch?.[1] ?? null
  const effectiveClientId = activeClientId ?? detailClientId
  const { completions } = useJourneyCompletions(effectiveClientId)
  const nextStep = useNextStep()

  const mode = getSidebarMode(location.pathname, !!activeClientId, isPro)
  const strategyPath = user?.strategyPath ?? null

  // فلترة: adminOnly لغير المسؤولين + proOnly لغير المستقل + إسقاط الفارغ.
  let sections = navFor(userType, user?.managerType, user?.specialtyDeptType)
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => {
        if (i.adminOnly && !isAdmin) return false
        if (i.proOnly && !isPro) return false
        return true
      }),
    }))
    .filter((s) => s.items.length > 0)

  // 🎨 وضع «المحفظة» للمدير المستقل — نُخفي المراحل ونُبقي الأقسام غير
  // المرحليّة (العملاء + المالي). المراحل غير مفيدة قبل اختيار عميل.
  if (mode === 'portfolio') {
    sections = sections.filter((s) => !s.stageId)
  }

  return (
    <aside className="w-72 shrink-0 border-l bg-card/40">
      <div className="sticky top-14 flex h-[calc(100vh-3.5rem)] flex-col overflow-y-auto">
        {/* User block at top */}
        {user && (
          <div className="border-b bg-gradient-to-bl from-primary/10 to-transparent p-4">
            <div className="text-sm font-semibold">{user.name}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>{ROLE_LABEL[userType ?? ''] ?? '—'}</span>
              <span>·</span>
              <span>{user.plan === 'BASIC' ? 'أساسي' : user.plan === 'PROFESSIONAL' ? 'احترافي' : 'مؤسسي'}</span>
              {strategyPath && (
                <>
                  <span>·</span>
                  <Link
                    to="/settings/path"
                    className="inline-flex items-center gap-1 rounded-full border bg-card px-1.5 text-[10px] text-foreground hover:bg-muted"
                    title="غيّر مسارك الاستراتيجي"
                  >
                    <span>{PATH_LABEL[strategyPath].icon}</span>
                    <span>{PATH_LABEL[strategyPath].ar}</span>
                  </Link>
                </>
              )}
            </div>
            {mode === 'analysis' && (
              <div className="mt-2 rounded-md border bg-card/70 px-2 py-1 text-[10px] text-muted-foreground">
                📊 تعرض حالة رحلة العميل الحالي
              </div>
            )}
            {mode === 'portfolio' && (
              <div className="mt-2 rounded-md border bg-card/70 px-2 py-1 text-[10px] text-muted-foreground">
                👥 عرض المحفظة — الأدوات تظهر عند فتح عميل
              </div>
            )}
          </div>
        )}

        {/* 🎯 التالي لك الآن — بطاقة ديناميكية أعلى السايدبار */}
        {nextStep.step && (
          <div className="border-b bg-gradient-to-l from-amber-500/10 to-rose-500/10 p-3">
            <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              🎯 التالي لك الآن
            </div>
            <NavLink
              to={nextStep.step.to}
              className="block rounded-lg border-2 border-primary/30 bg-card p-2.5 shadow-sm transition hover:border-primary hover:shadow-md"
            >
              <div className="flex items-start gap-2">
                <span className="text-xl leading-none">{nextStep.step.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{nextStep.step.label}</div>
                  <div className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                    {nextStep.step.reason}
                  </div>
                </div>
                <span className="text-xs text-primary">←</span>
              </div>
            </NavLink>
          </div>
        )}

        <nav className="flex flex-1 flex-col gap-5 p-3">
          {sections.map((section) => {
            const accent = ACCENT_CLASSES[section.accent]
            const status: StageStatus | null =
              isPro && effectiveClientId && section.stageId
                ? stageStatus(section.stageId, completions)
                : null
            const stageIcon = status ? STATUS_ICON[status] : ''
            const stageTitle = status ? STATUS_TITLE[status] : undefined
            const isLocked = status === 'locked'
            // فلترة المسار: هل هذه المرحلة داخل مسار المستخدم؟
            const inPath = section.stageId ? isStageInPath(section.stageId, strategyPath) : true
            return (
              <SidebarSection
                key={section.title}
                section={section}
                accent={accent}
                stageIcon={stageIcon}
                stageTitle={stageTitle}
                isLocked={isLocked}
                statusComplete={status === 'complete'}
                inPath={inPath}
                pathLabel={strategyPath ? PATH_LABEL[strategyPath].ar : null}
              />
            )
          })}
          {/* Legend at the bottom — يشرح الشارات */}
          {isPro && effectiveClientId && sections.some((s) => s.stageId) && (
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

// ─── قسم واحد — مرحلة أو ملحق — مع دعم الطيّ خارج المسار ─────────
function SidebarSection({
  section,
  accent,
  stageIcon,
  stageTitle,
  isLocked,
  statusComplete,
  inPath,
  pathLabel,
}: {
  section: NavSection
  accent: { dot: string; bgSoft: string; text: string }
  stageIcon: string
  stageTitle: string | undefined
  isLocked: boolean
  statusComplete: boolean
  inPath: boolean
  pathLabel: string | null
}) {
  // خارج المسار → مطويّة مبدئياً مع تلميح (لا حذف — يمكن الفتح يدوياً).
  const [outOfPathExpanded, setOutOfPathExpanded] = useState(false)
  const collapsedByPath = !inPath && !outOfPathExpanded

  return (
    <div className={cn('flex flex-col gap-1', isLocked && 'opacity-50')}>
      <div className="flex items-center gap-2 px-2 pb-1">
        <span className={cn('inline-block size-1.5 rounded-full', accent.dot)} />
        <span className="flex-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {section.title}
        </span>
        {stageIcon && (
          <span
            className={cn('text-[11px]', statusComplete && 'text-emerald-600')}
            title={stageTitle}
          >
            {stageIcon}
          </span>
        )}
      </div>
      {collapsedByPath ? (
        <button
          type="button"
          onClick={() => setOutOfPathExpanded(true)}
          className="mx-2 rounded-md border border-dashed bg-card/40 px-2 py-1.5 text-[10px] text-muted-foreground transition hover:bg-card"
          title="خارج مسارك المُختار — اضغط لعرضها"
        >
          خارج {pathLabel ?? 'المسار'} — {section.items.length} أدوات مخفيّة — ▼ افتح
        </button>
      ) : (
        <>
          <SectionItems section={section} accent={accent} />
          {!inPath && outOfPathExpanded && (
            <button
              type="button"
              onClick={() => setOutOfPathExpanded(false)}
              className="mx-2 mt-0.5 rounded-md px-2 py-1 text-[10px] text-muted-foreground transition hover:bg-muted"
            >
              ▲ أخفِ (خارج مسارك)
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ─── قائمة عناصر القسم — تدعم الطيّ (essential vs extras) ────────
function SectionItems({ section, accent }: { section: NavSection; accent: { bgSoft: string; text: string } }) {
  const [expanded, setExpanded] = useState(false)
  const essentials = section.items.filter((i) => i.essential)
  const extras = section.items.filter((i) => !i.essential)
  const collapsibleActive = section.collapsible && essentials.length > 0 && extras.length > 0
  const visible = collapsibleActive && !expanded ? essentials : section.items
  return (
    <>
      <ul className="flex flex-col gap-0.5">
        {visible.map((item) => (
          <NavItemRow key={item.to} item={item} accent={accent} />
        ))}
      </ul>
      {collapsibleActive && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mx-2 mt-0.5 rounded-md px-2 py-1 text-[10px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          {expanded
            ? '▲ أخفِ الأدوات الإضافية'
            : `▼ أظهر ${extras.length} أداة إضافية`}
        </button>
      )}
    </>
  )
}

function NavItemRow({ item, accent }: { item: NavItem; accent: { bgSoft: string; text: string } }) {
  return (
    <li>
      <NavLink
        to={item.to}
        end
        className={({ isActive }) =>
          cn(
            'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
            isActive
              ? `${accent.bgSoft} ${accent.text} font-medium`
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            item.optional && 'opacity-70'
          )
        }
        title={item.optional ? 'أداة مساندة — لا تُحسب في اكتمال المرحلة' : undefined}
      >
        {item.icon && <span className="text-base leading-none">{item.icon}</span>}
        <span className="flex-1 truncate text-right">{item.label}</span>
        {item.optional && <span className="text-[9px] text-muted-foreground/70" title="مساندة">◇</span>}
      </NavLink>
    </li>
  )
}
