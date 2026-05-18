import type { StrategicPath } from '@/lib/diagnosticQuestions'
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
