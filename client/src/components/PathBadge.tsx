import type { StrategicPath } from '@/lib/diagnosticQuestions'
import type { JourneyProgress } from '@/lib/strategicApi'
import { cn } from '@/lib/utils'

const PATH_META: Record<StrategicPath, { label: string; tone: string }> = {
  EMERGENCY_RISK: {
    label: 'إنقاذ / خطر',
    tone: 'bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-300',
  },
  NASCENT_CAUTIOUS: {
    label: 'نشأة / حذر',
    tone: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300',
  },
  GROWING_CHAOTIC: {
    label: 'نمو / فوضى',
    tone: 'bg-orange-500/10 text-orange-700 border-orange-500/30 dark:text-orange-300',
  },
  MATURE_COMPETITIVE: {
    label: 'نضج / تنافسية',
    tone: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
  },
  DEFAULT_STRATEGIC: {
    label: 'مسار افتراضي',
    tone: 'bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300',
  },
}

interface Props {
  path: StrategicPath
  className?: string
}

export function PathBadge({ path, className }: Props) {
  const meta = PATH_META[path]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium',
        meta.tone,
        className
      )}
    >
      {meta.label}
    </span>
  )
}

export function pathLabel(path: StrategicPath): string {
  return PATH_META[path].label
}

// ─── مؤشر رحلة المراحل 1→6 ────────────────────────────────────────────────
// شارة مصاحبة تعرض أول مرحلة غير مكتملة (أو "الرحلة مكتملة").
// لا تغيّر سلوك PathBadge القائم — استعمال منفصل ومستقل.

const STAGE_LABEL: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
  1: 'التشخيص',
  2: 'مسح البيئة',
  3: 'التركيب (SWOT/TOWS)',
  4: 'اختيار المسار',
  5: 'بناء الأهداف والمؤشرات',
  6: 'التنفيذ ومتابعة المهام',
}

const STAGE_TONE: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
  1: 'bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-300',
  2: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300',
  3: 'bg-orange-500/10 text-orange-700 border-orange-500/30 dark:text-orange-300',
  4: 'bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300',
  5: 'bg-violet-500/10 text-violet-700 border-violet-500/30 dark:text-violet-300',
  6: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
}

const COMPLETE_TONE = 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300'

export function nextStageLabel(progress: JourneyProgress): string {
  if (progress.nextStage === null) return 'الرحلة مكتملة'
  return STAGE_LABEL[progress.nextStage]
}

interface JourneyBadgeProps {
  progress: JourneyProgress
  className?: string
}

export function JourneyBadge({ progress, className }: JourneyBadgeProps) {
  const stage = progress.nextStage
  const tone = stage === null ? COMPLETE_TONE : STAGE_TONE[stage]
  const label = stage === null
    ? '✅ الرحلة مكتملة'
    : `المرحلة ${stage} من 6 · ${STAGE_LABEL[stage]}`
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium',
        tone,
        className
      )}
    >
      {label}
    </span>
  )
}
