import { useState } from 'react'

import { upsertArtifact, type RescueChallengesData } from '@/lib/strategicApi'

// ─── شاشة «أضف تحدّياتك» (خطوة الإنقاذ الاختياريّة) ────────────────────
// العميل يعرف واقعه أكثر من التدقيق — يضيف حتى 3 تحدّيات تُوجّه الإجراء
// التصحيحيّ التالي. اختياريّة: «تخطّي» حالة مشروعة (يكتب { items:[], skipped:true }
// ليُميَّز عن كتابة فارغة فاشلة — لا يُمسَح كـ{}). كلاهما يُنشئ artifact
// RESCUE_CHALLENGES فيصير challengesVisited=true (بالوجود لا المحتوى — درس ق٥).

type Axis = 'governance' | 'financial' | 'team' | 'digital'
const AXES: { key: Axis; label: string }[] = [
  { key: 'governance', label: 'الحوكمة' },
  { key: 'financial', label: 'المالية' },
  { key: 'team', label: 'الفريق' },
  { key: 'digital', label: 'الرقمي' },
]
const MAX = 3

interface Row { text: string; axis?: Axis }

export function RescueChallengesStep({ cid, onDone }: { cid: string; onDone: () => void }) {
  const [rows, setRows] = useState<Row[]>([{ text: '' }])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const filled = rows.filter((r) => r.text.trim())
  const canAdd = rows.length < MAX

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }
  function addRow() { if (canAdd) setRows((rs) => [...rs, { text: '' }]) }
  function removeRow(i: number) { setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs)) }

  async function save() {
    setBusy(true); setErr('')
    try {
      const items = filled.slice(0, MAX).map((r, i) => ({ id: `c${i + 1}`, text: r.text.trim(), axis: r.axis }))
      await upsertArtifact<RescueChallengesData>(cid, 'RESCUE_CHALLENGES', { items })
      onDone()
    } catch { setErr('تعذّر الحفظ — حاول ثانية.'); setBusy(false) }
  }
  async function skip() {
    setBusy(true); setErr('')
    try {
      await upsertArtifact<RescueChallengesData>(cid, 'RESCUE_CHALLENGES', { items: [], skipped: true })
      onDone()
    } catch { setErr('تعذّر التخطّي — حاول ثانية.'); setBusy(false) }
  }

  return (
    <div className="mt-5 space-y-3">
      <p className="text-[11px] text-rose-800/70">
        رصدنا الأضعف من محاورك — لكنك تعرف واقعك أكثر. أضِف حتى <b>3</b> تحدّيات تُوجّه إجراءك التالي، أو تخطّاها.
      </p>

      {rows.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={r.text}
            onChange={(e) => setRow(i, { text: e.target.value })}
            placeholder={`التحدّي ${i + 1}…`}
            className="min-w-[200px] flex-1 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-500"
          />
          <select
            value={r.axis ?? ''}
            onChange={(e) => setRow(i, { axis: (e.target.value || undefined) as Axis | undefined })}
            className="rounded-lg border border-rose-200 bg-white px-2 py-2 text-xs text-rose-900 outline-none focus:border-rose-500"
          >
            <option value="">المحور (اختياريّ)</option>
            {AXES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
          {rows.length > 1 && (
            <button type="button" onClick={() => removeRow(i)} className="rounded-md px-2 py-1 text-xs text-rose-500 hover:bg-rose-100" aria-label="حذف">✕</button>
          )}
        </div>
      ))}

      {canAdd && (
        <button type="button" onClick={addRow} className="text-xs font-semibold text-rose-700 hover:underline">+ أضِف تحدّياً ({rows.length}/{MAX})</button>
      )}
      {err && <p className="text-[11px] text-rose-700">{err}</p>}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          disabled={busy || filled.length === 0}
          onClick={save}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition enabled:hover:-translate-y-0.5 enabled:hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'جارٍ الحفظ…' : `احفظ ${filled.length ? `(${filled.length})` : ''} وواصِل ←`}
        </button>
        <button type="button" disabled={busy} onClick={skip} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-rose-700 underline-offset-4 hover:underline disabled:opacity-50">
          تخطّي — ليس عندي تحدّيات إضافيّة
        </button>
      </div>
    </div>
  )
}
