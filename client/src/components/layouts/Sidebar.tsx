import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom'

import { openCommandPalette } from '@/components/CommandPalette'
import { useGuidedNext } from '@/hooks/useGuidedNext'
import { useJourneyCompletions } from '@/hooks/useJourneyCompletions'
import { stageStatus, type StageStatus } from '@/journey'
import { isStageInPath, overallProgressPct, stageLevel, STAGE_LEVEL_LABEL, type StageId } from '@/lib/journeyStages'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { ACCENT_CLASSES, navFor, type NavItem, type NavSection } from './nav'

// ─── وضع الجلسة (Session Mode) ──────────────────────────────────────
// يفلتر السايدبار بحسب نيّة المستخدم في الجلسة الحالية. الأقسام غير
// المرتبطة بمرحلة (العملاء، الخطة الاستراتيجيّة، المالي) تظهر دائماً.
// يُحفظ في localStorage ليدوم بين الجلسات.
type SessionMode = 'all' | 'analysis' | 'planning' | 'execution'

const SESSION_MODES: { key: SessionMode; icon: string; label: string; stages: StageId[]; descAr: string }[] = [
  { key: 'all',       icon: '📚', label: 'الكل',   stages: [],                                              descAr: 'كل الأدوات' },
  { key: 'analysis',  icon: '🔬', label: 'تحليل',  stages: ['environment', 'synthesis'],                    descAr: 'التحليل الشامل — ① التشخيص + ② التوليف فقط' },
  { key: 'planning',  icon: '🎯', label: 'تخطيط', stages: ['directions', 'indicators'],                    descAr: 'التخطيط — ③ التوجّه + ④ القياس فقط' },
  { key: 'execution', icon: '🚀', label: 'تنفيذ', stages: ['initiatives', 'execution'],                    descAr: 'التنفيذ — ⑤ المبادرات + ⑥ التنفيذ فقط' },
]

const SESSION_MODE_KEY = 'startix.sessionMode'

function useSessionMode(): [SessionMode, (m: SessionMode) => void] {
  const [mode, setMode] = useState<SessionMode>(() => {
    try {
      const stored = localStorage.getItem(SESSION_MODE_KEY) as SessionMode | null
      if (stored && SESSION_MODES.some((m) => m.key === stored)) return stored
    } catch { /* SSR/private mode */ }
    return 'all'
  })
  useEffect(() => {
    try { localStorage.setItem(SESSION_MODE_KEY, mode) } catch { /* ignore */ }
  }, [mode])
  return [mode, setMode]
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'صاحب أعمال',
  MANAGER: 'مدير',
  INVESTOR: 'مستثمر',
}

const PATH_LABEL: Record<'QUICK' | 'MEDIUM' | 'LONG', { icon: string; ar: string }> = {
  QUICK:  { icon: '⚡', ar: 'مسار تشغيلي (قصير)' },
  MEDIUM: { icon: '🎯', ar: 'مسار تكتيكي (متوسّط)' },
  LONG:   { icon: '🔭', ar: 'مسار استراتيجي (طويل)' },
}

// حالة القسم المرتبط بمرحلة (locked/available/complete) — نُقلت إلى المحرّك
// journey/stageStatus (الرقعة F)؛ مالك 🔒 الواحد. هنا خرائط العرض فقط.
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

// داخليّ فقط (لا مستهلك خارجيّ) — بلا export ليُرضي react-refresh (المكوّن وحده يُصدَّر).
function getSidebarMode(pathname: string, hasClientParam: boolean, isPro: boolean): SidebarMode {
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
  // المصدر الموحّد: يستهلك الطوارئ + التصنيف + منع الطريق المسدود داخليّاً.
  const guided = useGuidedNext(effectiveClientId)
  const gn = guided.next
  // نميّز no-client (تلميح «اختر عميلاً»، لا «اكتملت») عن بقيّة الحالات صراحةً.
  // نستخدم gn.to كما هو (لا نُلحق ?client أعمى) — الهوك بناه صحيحاً.
  const nextCard: { icon: string; label: string; reason: string; to: string } | null =
    gn ? { icon: gn.icon, label: gn.label, reason: gn.reason, to: gn.to ?? (gn.kind === 'no-client' ? '/manager/clients' : '/manager/clients') } : null
  const clientLevel = isPro ? guided.classification : null

  const mode = getSidebarMode(location.pathname, !!activeClientId, isPro)
  const strategyPath = user?.strategyPath ?? null
  const [sessionMode, setSessionMode] = useSessionMode()

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

  // 🎬 وضع الجلسة — يفلتر أقسام المراحل بحسب نيّة المستخدم في الجلسة.
  // الأقسام بلا stageId (العملاء، الخطة الاستراتيجيّة، البداية، المالي) تظهر دائماً.
  if (mode !== 'portfolio' && sessionMode !== 'all') {
    const activeStages = SESSION_MODES.find((m) => m.key === sessionMode)?.stages ?? []
    sections = sections.filter((s) => !s.stageId || activeStages.includes(s.stageId))
  }

  return (
    <aside className="w-72 shrink-0 border-l bg-card/40">
      {/* top-[5.75rem] = ارتفاع Topbar (3.5rem) + QuickNav (~2.25rem) */}
      <div className="sticky top-[5.75rem] flex h-[calc(100vh-5.75rem)] flex-col overflow-y-auto">
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

        {/* 🎬 وضع الجلسة — يفلتر السايدبار بحسب نيّة المستخدم */}
        {mode !== 'portfolio' && sections.some((s) => s.stageId) && (
          <div className="border-b bg-card/40 p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                🎬 وضع الجلسة
              </span>
              {sessionMode !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSessionMode('all')}
                  className="rounded px-1 text-[10px] text-muted-foreground hover:bg-muted"
                >
                  ↻ أظهر الكل
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {SESSION_MODES.map((m) => {
                const active = m.key === sessionMode
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setSessionMode(m.key)}
                    title={m.descAr}
                    className={cn(
                      'flex flex-col items-center gap-0.5 rounded-md border p-1.5 text-[10px] transition',
                      active
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'border-transparent bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <span className="text-sm leading-none">{m.icon}</span>
                    <span className="font-medium">{m.label}</span>
                  </button>
                )
              })}
            </div>
            {sessionMode !== 'all' && (
              <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                {SESSION_MODES.find((m) => m.key === sessionMode)?.descAr}
              </p>
            )}
          </div>
        )}

        {/* 🎯 التالي لك الآن — بطاقة ديناميكية أعلى السايدبار (المصدر الموحّد) */}
        {nextCard && (
          <div className="border-b bg-gradient-to-l from-amber-500/10 to-rose-500/10 p-3">
            {/* شارة المستوى المتكيّف — تظهر على كل صفحة (كانت نائمة) */}
            {clientLevel && clientLevel.level !== 'assess' && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="text-muted-foreground">المستوى:</span>
                <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-bold text-primary">
                  {clientLevel.icon} {clientLevel.labelAr}
                </span>
                {guided.resolution?.isStale && (
                  <span className={`rounded-full border px-1.5 py-0.5 font-bold ${guided.resolution.direction === 'upgrade' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-rose-300 bg-rose-50 text-rose-700'}`}>
                    {guided.resolution.direction === 'upgrade' ? '⬆️ ترقَّ' : '⚠️ راجِع'}
                  </span>
                )}
              </div>
            )}
            <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              🎯 التالي لك الآن
            </div>
            <NavLink
              to={nextCard.to}
              className="block rounded-lg border-2 border-primary/30 bg-card p-2.5 shadow-sm transition hover:border-primary hover:shadow-md"
            >
              <div className="flex items-start gap-2">
                <span className="text-xl leading-none">{nextCard.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{nextCard.label}</div>
                  <div className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                    {nextCard.reason}
                  </div>
                </div>
                <span className="text-xs text-primary">←</span>
              </div>
            </NavLink>
          </div>
        )}

        <nav className="flex flex-1 flex-col gap-4 p-3">
          {(() => {
            // ─── تجميع الأقسام بحسب الطبقة (SIDEBAR-STRUCTURE.md) ─
            const mainSections    = sections.filter((s) => (s.layer ?? 'main') === 'main')
            const contextSections = sections.filter((s) => s.layer === 'context')
            const pinnedSections  = sections.filter((s) => s.layer === 'pinned')

            function renderSection(section: NavSection) {
              const accent = ACCENT_CLASSES[section.accent]
              const status: StageStatus | null =
                isPro && effectiveClientId && section.stageId
                  ? stageStatus(section.stageId, completions)
                  : null
              const stageIcon = status ? STATUS_ICON[status] : ''
              const stageTitle = status ? STATUS_TITLE[status] : undefined
              const isLocked = status === 'locked'
              const inPath = section.stageId ? isStageInPath(section.stageId, strategyPath) : true
              // هويّة القسم فوق مستوى الخطة: يُوسَم بمستواه (تكتيكي/استراتيجي)
              // بدل مجرّد «خارج مسارك» — فيعرف المستخدم ماهيّته لا غيابه فقط.
              const levelLabel = section.stageId && !inPath
                ? STAGE_LEVEL_LABEL[stageLevel(section.stageId)]
                : null
              const isStrategicPlanSection = section.title === '📖 الخطة الاستراتيجيّة'
                || section.title === '📖 الخطة الاستراتيجية'
              const progressPct = isStrategicPlanSection && effectiveClientId
                ? overallProgressPct(completions, strategyPath)
                : null
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
                  levelLabel={levelLabel}
                  progressPct={progressPct}
                  isProminent={isStrategicPlanSection}
                />
              )
            }

            return (
              <>
                {/* ── الطبقة ١: مسار العمل الأساسي ── */}
                <div className="flex flex-col gap-5">
                  {mainSections.map(renderSection)}
                </div>

                {/* ── فاصل + الطبقة ٢: السياق ── */}
                {contextSections.length > 0 && (
                  <>
                    <LayerDivider label="الإدارة والسياق" />
                    <div className="flex flex-col gap-4">
                      {contextSections.map(renderSection)}
                    </div>
                  </>
                )}

                {/* ── فاصل + الطبقة ٣: مُثبَّت ── */}
                {pinnedSections.length > 0 && (
                  <>
                    <LayerDivider label="مثبَّت" />
                    <div className="flex flex-col gap-3">
                      {pinnedSections.map(renderSection)}
                    </div>
                  </>
                )}
              </>
            )
          })()}

          {/* Legend at the bottom — يشرح الشارات */}
          {isPro && effectiveClientId && sections.some((s) => s.stageId) && (
            <div className="mt-2 rounded-md border border-dashed bg-card/40 p-2 text-[10px] text-muted-foreground">
              <div className="mb-1 font-semibold">دليل الشارات:</div>
              <div className="flex flex-wrap gap-3">
                <span>🔒 مقفلة</span>
                <span>● قيد العمل</span>
                <span className="text-emerald-600">✓ مكتَملة</span>
                <span className="text-indigo-600">⏳ قريباً</span>
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
  levelLabel,
  progressPct,
  isProminent,
}: {
  section: NavSection
  accent: { dot: string; bgSoft: string; text: string }
  stageIcon: string
  stageTitle: string | undefined
  isLocked: boolean
  statusComplete: boolean
  inPath: boolean
  pathLabel: string | null
  levelLabel?: string | null
  progressPct?: number | null
  isProminent?: boolean
}) {
  // خارج المسار → مطويّة مبدئياً مع تلميح (لا حذف — يمكن الفتح يدوياً).
  const [outOfPathExpanded, setOutOfPathExpanded] = useState(false)
  const collapsedByPath = !inPath && !outOfPathExpanded

  return (
    <div
      className={cn(
        'flex flex-col gap-1',
        isLocked && 'opacity-50',
        isProminent && 'rounded-xl border-2 border-indigo-200 bg-gradient-to-l from-indigo-500/10 to-transparent p-2 shadow-sm'
      )}
    >
      <div className="group/section flex items-center gap-2 px-2 pb-1">
        {/* نقطة ملوّنة نابضة بلطف — يُعطي إحساساً حياً */}
        <span className={cn(
          'inline-block size-1.5 rounded-full transition-transform group-hover/section:scale-150',
          accent.dot,
        )} />
        <span className={cn(
          'flex-1 text-[11px] font-bold uppercase tracking-wider transition-colors',
          isProminent ? 'text-indigo-700' : 'text-muted-foreground group-hover/section:text-foreground',
        )}>
          {section.title}
        </span>
        {levelLabel && (
          <span
            className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700"
            title="مستوى هذه الأدوات — فوق مستوى خطتك الحاليّة"
          >
            {levelLabel}
          </span>
        )}
        {progressPct != null && (
          <span
            className="rounded-full bg-gradient-to-l from-indigo-100 to-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 shadow-sm ring-1 ring-indigo-200/50"
            title="نسبة اكتمال مراحل الخطة الاستراتيجيّة"
          >
            {progressPct}٪
          </span>
        )}
        {stageIcon && (
          <span
            className={cn(
              'text-[11px] transition-transform group-hover/section:scale-110',
              statusComplete && 'text-emerald-600',
            )}
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
  // ⌘K — نتحوّل من رابط PlaceholderPage إلى زر يفتح palette فوري.
  if (item.to === '/search') {
    return (
      <li>
        <button
          type="button"
          onClick={openCommandPalette}
          className={cn(
            'group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-all hover:bg-gradient-to-l hover:from-sky-50 hover:to-transparent hover:text-foreground hover:shadow-sm',
          )}
          title="افتح البحث السريع (⌘K)"
        >
          {item.icon && <span className="text-base leading-none transition-transform group-hover:scale-110">{item.icon}</span>}
          <span className="flex-1 truncate text-right">{item.label}</span>
          <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 transition group-hover:border-sky-400 group-hover:bg-sky-50 group-hover:text-sky-700">⌘K</kbd>
        </button>
      </li>
    )
  }

  const tooltipTitle = item.placeholder
    ? 'مخطّط عن قصد — قريباً'
    : item.optional
      ? 'أداة مساندة — لا تُحسب في اكتمال المرحلة'
      : undefined
  return (
    <li>
      <NavLink
        to={item.to}
        end
        className={({ isActive }) =>
          cn(
            // انسيابيّة + hover مع gradient خفيف + ظلّ ناعم
            'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all duration-200',
            isActive
              // 🌟 الحالة النشطة — accent bg + بولد + ظلّ صغير + شريط جانبي عبر ring-offset
              ? `${accent.bgSoft} ${accent.text} font-semibold shadow-sm`
              : 'text-muted-foreground hover:bg-gradient-to-l hover:from-muted hover:to-transparent hover:text-foreground hover:shadow-sm',
            item.optional && 'opacity-70',
            item.placeholder && 'italic'
          )
        }
        title={tooltipTitle}
      >
        {item.icon && (
          <span className="text-base leading-none transition-transform duration-200 group-hover:scale-110">
            {item.icon}
          </span>
        )}
        <span className="flex-1 truncate text-right">{item.label}</span>
        {item.placeholder && (
          <span
            className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700"
            title="مخطّط عن قصد — قريباً"
          >
            ⏳
          </span>
        )}
        {item.optional && !item.placeholder && (
          <span className="text-[9px] text-muted-foreground/70" title="مساندة">◇</span>
        )}
        {/* سهم الوصول عند hover — يظهر لطيفاً */}
        <span className="text-[10px] opacity-0 transition-opacity group-hover:opacity-60">←</span>
      </NavLink>
    </li>
  )
}

// ─── فاصل بين طبقات السايدبار (SIDEBAR-STRUCTURE.md) ─────────────
function LayerDivider({ label }: { label: string }) {
  return (
    <div className="my-2 flex items-center gap-2 px-2">
      {/* خطّ متدرّج ساحر — يبدأ شفافاً وينتهي شفافاً */}
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-border to-border/40" />
      <span className="rounded-full border border-border/30 bg-card/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70 shadow-sm backdrop-blur-sm">
        {label}
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-border/40" />
    </div>
  )
}
