import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, getSWOT, upsertArtifact } from '@/lib/strategicApi'

interface Risk {
  id: string
  name: string
  probability: 1 | 2 | 3 | 4 | 5
  impact: 1 | 2 | 3 | 4 | 5
  mitigation: string
}

interface RiskData {
  risks: Risk[]
}

const EMPTY: RiskData = { risks: [] }

// Heatmap color: probability × impact = 1..25
function cellTint(score: number): { bg: string; label: string; text: string } {
  if (score >= 16) return { bg: 'bg-red-500/80', label: 'حرج', text: 'text-white' }
  if (score >= 10) return { bg: 'bg-orange-500/80', label: 'مرتفع', text: 'text-white' }
  if (score >= 5)  return { bg: 'bg-amber-400/80', label: 'متوسط', text: 'text-amber-900' }
  return { bg: 'bg-emerald-400/70', label: 'منخفض', text: 'text-emerald-900' }
}

export function RiskMapPage() {
  return (
    <StrategicShell
      title="خريطة المخاطر"
      description="سجل المخاطر مع شبكة احتمالية × أثر، وإجراءات التخفيف المقترحة لكل خطر."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<RiskData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    getArtifact<RiskData>(companyId, 'RISK_REGISTER').then((row) => {
      if (row?.data?.risks) setData({ risks: row.data.risks })
    }).catch(() => undefined)
  }, [companyId])

  function add() {
    setData((p) => ({
      risks: [
        ...p.risks,
        { id: crypto.randomUUID(), name: '', probability: 3, impact: 3, mitigation: '' },
      ],
    }))
  }
  function update(id: string, patch: Partial<Risk>) {
    setData((p) => ({ risks: p.risks.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))
  }
  function remove(id: string) {
    setData((p) => ({ risks: p.risks.filter((r) => r.id !== id) }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'RISK_REGISTER', data)
      toast.success('تم حفظ سجل المخاطر')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  // ─── ترابط: SWOT (Weaknesses + Threats) → Risk Register ────────
  // نقاط الضعف الداخلية والتهديدات الخارجية كلاهما مخاطر واجبة الرصد.
  // الافتراض: threats بأثر 4 (خارجية = فوق مسيطرتنا)، weaknesses بأثر 3
  // (داخلية = يمكن التحكم بها). كلاهما probability=3 (متوسط) للمراجعة.
  async function importFromSWOT() {
    setImporting(true)
    try {
      const swot = await getSWOT(companyId)
      const threats = swot.threats ?? []
      const weaknesses = swot.weaknesses ?? []
      if (threats.length === 0 && weaknesses.length === 0) {
        toast.error('لا تهديدات/ضعف مسجّلة في SWOT — افتح /swot أوّلاً.')
        return
      }
      const existing = new Set(data.risks.map((r) => r.name))
      const newRisks: Risk[] = []
      for (const t of threats) {
        const clean = t.trim()
        if (!clean) continue
        const name = `[تهديد] ${clean.slice(0, 80)}${clean.length > 80 ? '…' : ''}`
        if (existing.has(name)) continue
        newRisks.push({ id: crypto.randomUUID(), name, probability: 3, impact: 4, mitigation: '' })
      }
      for (const w of weaknesses) {
        const clean = w.trim()
        if (!clean) continue
        const name = `[ضعف] ${clean.slice(0, 80)}${clean.length > 80 ? '…' : ''}`
        if (existing.has(name)) continue
        newRisks.push({ id: crypto.randomUUID(), name, probability: 3, impact: 3, mitigation: '' })
      }
      if (newRisks.length === 0) {
        toast.error('كل التهديدات/الضعف مُستوردَة مسبقاً.')
        return
      }
      setData((p) => ({ risks: [...p.risks, ...newRisks] }))
      toast.success(`أُضيف ${newRisks.length} خطر من SWOT — راجع الاحتمالية والأثر ثم احفظ.`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر الاستيراد من SWOT'))
    } finally {
      setImporting(false)
    }
  }

  // Build a 5×5 grid: each cell counts risks at (impact, probability)
  const grid = useMemo(() => {
    const g: Risk[][][] = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => []))
    for (const r of data.risks) {
      if (r.name.trim()) g[r.impact - 1][r.probability - 1].push(r)
    }
    return g
  }, [data.risks])

  const ranked = [...data.risks]
    .filter((r) => r.name.trim())
    .sort((a, b) => b.probability * b.impact - a.probability * a.impact)

  const criticalCount = data.risks.filter((r) => r.probability * r.impact >= 16).length
  const highCount = data.risks.filter((r) => {
    const s = r.probability * r.impact
    return s >= 10 && s < 16
  }).length

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-red-200 bg-gradient-to-br from-red-500/15 to-transparent">
          <CardHeader>
            <CardDescription>مخاطر حرجة</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-red-700">{criticalCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-orange-200 bg-gradient-to-br from-orange-500/15 to-transparent">
          <CardHeader>
            <CardDescription>مخاطر مرتفعة</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-orange-700">{highCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-500/15 to-transparent">
          <CardHeader>
            <CardDescription>إجمالي المخاطر</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-emerald-700">{data.risks.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الشبكة الحرارية (احتمالية × أثر)</CardTitle>
          <CardDescription>
            الصفوف = الأثر (يقل من أعلى لأسفل). الأعمدة = الاحتمالية (تزيد من اليمين لليسار).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[40px_repeat(5,minmax(0,1fr))] gap-1 text-xs">
            <div />
            {[5, 4, 3, 2, 1].map((p) => (
              <div key={p} className="text-center font-semibold text-muted-foreground tabular-nums">
                احتمالية {p}
              </div>
            ))}
            {[5, 4, 3, 2, 1].map((impact) => (
              <ContextRow key={impact} impact={impact} row={grid[impact - 1]} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>سجل المخاطر</CardTitle>
          <CardDescription>{data.risks.length} خطر.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.risks.map((r) => {
            const score = r.probability * r.impact
            const tint = cellTint(score)
            return (
              <div key={r.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    className="min-w-[180px] flex-1"
                    value={r.name}
                    onChange={(e) => update(r.id, { name: e.target.value })}
                    placeholder="اسم الخطر…"
                  />
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">احتمالية</span>
                    <select
                      className="rounded-md border bg-background px-2 py-1"
                      value={r.probability}
                      onChange={(e) => update(r.id, { probability: Number(e.target.value) as Risk['probability'] })}
                    >
                      {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">أثر</span>
                    <select
                      className="rounded-md border bg-background px-2 py-1"
                      value={r.impact}
                      onChange={(e) => update(r.id, { impact: Number(e.target.value) as Risk['impact'] })}
                    >
                      {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tint.bg} ${tint.text}`}>
                    {tint.label} · {score}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>×</Button>
                </div>
                <Input
                  className="mt-2"
                  value={r.mitigation}
                  onChange={(e) => update(r.id, { mitigation: e.target.value })}
                  placeholder="إجراء التخفيف المقترح…"
                />
              </div>
            )
          })}
          {data.risks.length === 0 && (
            <p className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              لا توجد مخاطر مسجلة بعد.
            </p>
          )}
          <div className="flex justify-between pt-1">
            <Button variant="outline" size="sm" onClick={add}>+ خطر جديد</Button>
            <Button variant="outline" size="sm" onClick={importFromSWOT} disabled={importing || saving}>
              {importing ? 'جاري…' : '🧭 استورد من SWOT'}
            </Button>
            <Button onClick={save} disabled={saving || importing}>{saving ? 'جاري الحفظ…' : 'حفظ السجل'}</Button>
          </div>
        </CardContent>
      </Card>

      {ranked.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>أولوية المعالجة</CardTitle>
            <CardDescription>المخاطر مرتبة حسب احتمالية × أثر.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {ranked.slice(0, 10).map((r, i) => {
                const score = r.probability * r.impact
                const tint = cellTint(score)
                return (
                  <li key={r.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                    <span className="flex items-center gap-2">
                      <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground tabular-nums">{i + 1}</span>
                      <span className="font-medium">{r.name}</span>
                    </span>
                    <span className={`rounded-md px-2 py-0.5 text-xs ${tint.bg} ${tint.text}`}>
                      {tint.label} · {score}
                    </span>
                  </li>
                )
              })}
            </ol>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function ContextRow({ impact, row }: { impact: number; row: Risk[][] }) {
  return (
    <>
      <div className="flex items-center justify-center text-xs font-semibold text-muted-foreground tabular-nums">
        أثر {impact}
      </div>
      {[5, 4, 3, 2, 1].map((p) => {
        const cell = row[p - 1] ?? []
        const score = p * impact
        const tint = cellTint(score)
        return (
          <div
            key={p}
            className={`flex h-16 flex-col items-center justify-center rounded-md ${tint.bg} ${tint.text}`}
            title={`أثر ${impact} · احتمالية ${p} = ${score}`}
          >
            <span className="text-xs opacity-80">{tint.label}</span>
            <span className="text-lg font-bold tabular-nums">{cell.length || ''}</span>
          </div>
        )
      })}
    </>
  )
}
