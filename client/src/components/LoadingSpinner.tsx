import { cn } from '@/lib/utils'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  fullPage?: boolean
  label?: string
  className?: string
}

const SIZES = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-4',
}

export function LoadingSpinner({ size = 'md', fullPage, label, className }: Props) {
  const spinner = (
    <span
      role="status"
      aria-label={label ?? 'Loading'}
      className={cn(
        'inline-block animate-spin rounded-full border-muted-foreground/30 border-t-foreground',
        SIZES[size],
        className
      )}
    />
  )

  if (!fullPage) return spinner

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      {spinner}
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  )
}
