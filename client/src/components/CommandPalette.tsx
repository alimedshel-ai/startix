import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { navFor, type NavItem, type NavSection } from '@/components/layouts/nav'
import {
  getSWOT,
  listInitiatives,
  listKPIs,
  listObjectives,
  listProjects,
} from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

// ─── ⌘K CommandPalette ────────────────────────────────────────────
// palette موحّد يفتح بـ Cmd+K / Ctrl+K. يبحث في:
//   ١) صفحات السايدبار (فوري — من nav.ts)
//   ٢) محتوى العميل النشط: SWOT · Objectives · KPIs · Initiatives · Projects
//      — يُحمَّل عند الفتح فقط إن كان هناك ?client=X.
// النقر أو Enter → ينتقل. Esc → يغلق.

type ResultKind = 'page' | 'swot' | 'objective' | 'kpi' | 'initiative' | 'project'

interface Result {
  kind: ResultKind
  icon: string
  label: string
  hint?: string   // مسار أو سياق قصير
  to: string
}

// ─── حالة عالميّة بسيطة ─────────────────────────────────────────
let openPaletteImpl: (() => void) | null = null
export function openCommandPalette() { openPaletteImpl?.() }

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [content, setContent] = useState<Result[]>([])
  const [loadingContent, setLoadingContent] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const navigate = useNavigate()
  const [params] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const companyId = params.get('client')

  // ─── ربط الفتح العالمي + مفتاح Cmd/Ctrl+K ─────────────────────
  useEffect(() => {
    openPaletteImpl = () => setOpen(true)
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      openPaletteImpl = null
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  // reset عند الإغلاق
  useEffect(() => {
    if (!open) {
      setQuery('')
      setSelectedIdx(0)
    } else {
      // autofocus بعد رسم DOM
      setTimeout(() => inputRef.current?.focus(), 20)
    }
  }, [open])

  // ─── جلب محتوى العميل عند الفتح ─────────────────────────────
  useEffect(() => {
    if (!open || !companyId) return
    let alive = true
    setLoadingContent(true)
    ;(async () => {
      try {
        const clientQS = `?client=${companyId}`
        const [swot, objs, kpis, inits, prjs] = await Promise.all([
          getSWOT(companyId).catch(() => null),
          listObjectives(companyId).catch(() => []),
          listKPIs(companyId).catch(() => []),
          listInitiatives(companyId).catch(() => []),
          listProjects(companyId).catch(() => []),
        ])
        if (!alive) return
        const results: Result[] = []

        // SWOT — أرباع بنودها (نستخرج النصّ النظيف بلا علامات ⟪⟫)
        const cleanText = (s: string) => s.replace(/\s?⟪[^⟫]*⟫/g, '').trim()
        const swotSections = swot ? [
          { key: 'strengths', label: 'قوّة', icon: '💪', items: swot.strengths ?? [] },
          { key: 'weaknesses', label: 'ضعف', icon: '🔻', items: swot.weaknesses ?? [] },
          { key: 'opportunities', label: 'فرصة', icon: '🌱', items: swot.opportunities ?? [] },
          { key: 'threats', label: 'تهديد', icon: '⚠️', items: swot.threats ?? [] },
        ] : []
        for (const sec of swotSections) {
          for (const raw of sec.items) {
            const text = cleanText(raw)
            if (text) results.push({
              kind: 'swot', icon: sec.icon, label: text,
              hint: `SWOT · ${sec.label}`, to: `/swot${clientQS}`,
            })
          }
        }

        // Objectives
        for (const o of objs) {
          results.push({
            kind: 'objective', icon: '🎯', label: o.title,
            hint: 'هدف استراتيجي', to: `/measure?tab=objectives&client=${companyId}`,
          })
        }
        // KPIs
        for (const k of kpis) {
          results.push({
            kind: 'kpi', icon: '📊', label: k.name,
            hint: 'مؤشّر أداء', to: `/measure?tab=kpis&client=${companyId}`,
          })
        }
        // Initiatives
        for (const i of inits) {
          results.push({
            kind: 'initiative', icon: '💡', label: i.title,
            hint: 'مبادرة', to: `/priority?tab=initiatives&client=${companyId}`,
          })
        }
        // Projects (خطوات تنفيذ)
        for (const p of prjs) {
          results.push({
            kind: 'project', icon: '📁', label: p.title,
            hint: 'خطوة تنفيذ', to: `/manager/projects/${p.id}?client=${companyId}`,
          })
        }

        setContent(results)
      } catch {
        if (alive) setContent([])
      } finally {
        if (alive) setLoadingContent(false)
      }
    })()
    return () => { alive = false }
  }, [open, companyId])

  // ─── الصفحات — من navFor فوراً (بلا شبكة) ─────────────────────
  const pageResults: Result[] = useMemo(() => {
    if (!user?.userType) return []
    const sections: NavSection[] = navFor(user.userType, user.managerType ?? null, user.specialtyDeptType ?? null)
    const clientQS = companyId ? `?client=${companyId}` : ''
    const out: Result[] = []
    for (const s of sections) {
      for (const it of s.items as NavItem[]) {
        if (it.placeholder) continue
        // نُلحق ?client= لو موجود، إلا إذا كان الرابط يحوي بالفعل query
        const to = it.to.includes('?') ? it.to : `${it.to}${clientQS}`
        out.push({
          kind: 'page',
          icon: it.icon ?? '📄',
          label: it.label,
          hint: s.title.replace(/^[^\s]+\s/, ''), // بدون الإيموجي
          to,
        })
      }
    }
    return out
  }, [user, companyId])

  // ─── فلترة الفزّي (matches بسيطة substring case-insensitive) ─
  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    const all = [...pageResults, ...content]
    if (!q) return all.slice(0, 40)
    return all.filter((r) => (
      r.label.toLowerCase().includes(q) ||
      (r.hint ?? '').toLowerCase().includes(q)
    )).slice(0, 60)
  }, [pageResults, content, q])

  // reset selectedIdx عند تغيير الفلترة
  useEffect(() => { setSelectedIdx(0) }, [q, filtered.length])

  // ─── لوحة المفاتيح داخل الـpalette ────────────────────────────
  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') {
      const r = filtered[selectedIdx]
      if (r) { navigate(r.to); setOpen(false) }
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/40 p-4 pt-20 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* الإدخال */}
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <span className="text-lg">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="ابحث في الصفحات، الأهداف، المؤشّرات، المبادرات، الخطط..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
          <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">Esc</kbd>
        </div>

        {/* حالة السياق */}
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-1.5 text-[10px] text-slate-500">
          {companyId
            ? loadingContent
              ? '⏳ جاري تحميل محتوى العميل...'
              : `✓ ${filtered.length} نتيجة · العميل النشط: ${companyId.slice(0, 8)}…`
            : 'صفحات فقط — اختر عميلاً لتوسيع البحث إلى المحتوى'}
        </div>

        {/* النتائج */}
        <div className="max-h-[400px] overflow-y-auto">
          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500">
              لا نتائج لـ«{query}»
            </div>
          )}
          {filtered.map((r, i) => {
            const active = i === selectedIdx
            return (
              <button
                key={`${r.kind}-${r.to}-${i}`}
                type="button"
                onMouseEnter={() => setSelectedIdx(i)}
                onClick={() => { navigate(r.to); setOpen(false) }}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-right transition ${
                  active ? 'bg-indigo-50' : 'hover:bg-slate-50'
                }`}
              >
                <span className="text-lg">{r.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-sm font-medium ${active ? 'text-indigo-900' : 'text-slate-800'}`}>
                    {r.label}
                  </div>
                  {r.hint && (
                    <div className="truncate text-[10px] text-slate-500">{r.hint}</div>
                  )}
                </div>
                <KindChip kind={r.kind} />
              </button>
            )
          })}
        </div>

        {/* التذييل — تلميحات المفاتيح */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[10px] text-slate-500">
          <div className="flex items-center gap-3">
            <span><kbd className="rounded border bg-white px-1">↑↓</kbd> تنقّل</span>
            <span><kbd className="rounded border bg-white px-1">Enter</kbd> اذهب</span>
            <span><kbd className="rounded border bg-white px-1">Esc</kbd> إغلاق</span>
          </div>
          <div>⌘K / Ctrl+K</div>
        </div>
      </div>
    </div>
  )
}

const KIND_LABEL: Record<ResultKind, { label: string; className: string }> = {
  page:       { label: 'صفحة',    className: 'bg-slate-100 text-slate-600' },
  swot:       { label: 'SWOT',    className: 'bg-violet-100 text-violet-700' },
  objective:  { label: 'هدف',     className: 'bg-emerald-100 text-emerald-700' },
  kpi:        { label: 'KPI',     className: 'bg-sky-100 text-sky-700' },
  initiative: { label: 'مبادرة',  className: 'bg-amber-100 text-amber-700' },
  project:    { label: 'خطة',     className: 'bg-rose-100 text-rose-700' },
}

function KindChip({ kind }: { kind: ResultKind }) {
  const meta = KIND_LABEL[kind]
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  )
}
