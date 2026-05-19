import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { aiSmartGuide } from '@/lib/aiApi'
import { useCompany } from '@/hooks/useCompany'

const STORAGE_OPEN_KEY = 'startix-smartguide-open'

/**
 * Floating bottom-left button that fetches a 1-2 sentence next-best-action
 * hint from Claude based on the current route + company context. Tucked
 * behind a toggle so it doesn't auto-fetch on every page change.
 */
export function SmartGuide() {
  const location = useLocation()
  const { company } = useCompany()
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(STORAGE_OPEN_KEY) === '1'
  })
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [configured, setConfigured] = useState<boolean>(true)
  const [fetchedPath, setFetchedPath] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_OPEN_KEY, open ? '1' : '0')
    }
  }, [open])

  async function refresh() {
    if (!company) return
    setLoading(true)
    try {
      const res = await aiSmartGuide({ companyId: company.id, path: location.pathname })
      setSuggestion(res.suggestion)
      setConfigured(res.configured)
      setFetchedPath(location.pathname)
    } catch {
      setSuggestion('تعذّر الاتصال بمولّد الإرشاد.')
    } finally {
      setLoading(false)
    }
  }

  // Auto-refresh when opened or when the path changes while open
  useEffect(() => {
    if (open && company && location.pathname !== fetchedPath) {
      refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, location.pathname, company?.id])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="المرشد الذكي"
        className="fixed bottom-5 left-5 z-40 grid size-12 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-2xl text-white shadow-lg transition hover:scale-105 active:scale-95"
      >
        {open ? '×' : '💡'}
      </button>

      {open && (
        <div className="fixed bottom-20 left-5 z-40 w-[min(360px,calc(100vw-2.5rem))] rounded-2xl border bg-card shadow-xl">
          <div className="flex items-center gap-2 border-b bg-gradient-to-bl from-violet-500/10 to-fuchsia-500/5 px-4 py-3">
            <span className="grid size-7 place-items-center rounded-lg bg-violet-500 text-sm text-white">🤖</span>
            <div className="flex-1">
              <div className="text-sm font-semibold">المرشد الذكي</div>
              <div className="text-[10px] text-muted-foreground">اقتراح ذكي للصفحة الحالية</div>
            </div>
            <Button variant="ghost" size="sm" onClick={refresh} disabled={loading || !company}>
              {loading ? '…' : '🔄'}
            </Button>
          </div>
          <div className="p-4 text-sm leading-relaxed">
            {!company && <p className="text-muted-foreground">سجّل الدخول أولاً لرؤية الاقتراحات.</p>}
            {company && !configured && (
              <p className="text-muted-foreground">
                لم يُعدّ مفتاح Claude. أضف <code className="rounded bg-muted px-1">ANTHROPIC_API_KEY</code> في <code className="rounded bg-muted px-1">server/.env</code>.
              </p>
            )}
            {company && configured && !suggestion && !loading && (
              <p className="text-muted-foreground">اضغط 🔄 لجلب اقتراح.</p>
            )}
            {loading && <p className="text-muted-foreground">جاري التفكير…</p>}
            {suggestion && configured && <p>{suggestion}</p>}
          </div>
        </div>
      )}
    </>
  )
}
