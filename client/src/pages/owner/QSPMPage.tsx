import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

interface QSPMFactor {
  id: string
  label: string
  weight: number          // 0..1 — يتم تطبيعها لمجموع 1
  scoresByAlternative: Record<string, number>  // 1..4 (Attractiveness Score)
}

interface QSPMAlternative {
  id: string
  name: string
}

interface QSPMData {
  factors: QSPMFactor[]
  alternatives: QSPMAlternative[]
}

const EMPTY: QSPMData = { factors: [], alternatives: [] }

const DEFAULT_ALTS = ['الاستراتيجية أ', 'الاستراتيجية ب']
const DEFAULT_FACTORS = [
  'نمو السوق',
  'قوة المنافسة',
  'القدرة المالية',
  'كفاءة الفريق',
  'الوضع التنظيمي',
]

function totalAttractiveness(data: QSPMData, altId: string): number {
  const totalWeight = data.factors.reduce((s, f) => s + f.weight, 0) || 1
  return data.factors.reduce((sum, f) => {
    const normalized = f.weight / totalWeight
    const score = f.scoresByAlternative[altId] ?? 0
    return sum + normalized * score
  }, 0)
}

export function QSPMPage() {
  return (
    <StrategicShell
      title="مصفوفة QSPM"
      description="التخطيط الاستراتيجي الكمي: وزّن العوامل، قيّم البدائل من 1 (غير جذاب) إلى 4 (جذاب جداً)، واحسب درجات الجاذبية الكلية."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<QSPMData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getArtifact<QSPMData>(companyId, 'QSPM').then((row) => {
      if (row?.data && (row.data.factors?.length || row.data.alternatives?.length)) {
        setData({
          factors: row.data.factors ?? [],
          alternatives: row.data.alternatives ?? [],
        })
      }
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [companyId])

  useEffect(() => {
    if (loaded && data.factors.length === 0 && data.alternatives.length === 0) {
      const alts: QSPMAlternative[] = DEFAULT_ALTS.map((n) => ({ id: crypto.randomUUID(), name: n }))
      const factors: QSPMFactor[] = DEFAULT_FACTORS.map((label) => ({
        id: crypto.randomUUID(),
        label,
        weight: 0.2,
        scoresByAlternative: Object.fromEntries(alts.map((a) => [a.id, 2])),
      }))
      setData({ factors, alternatives: alts })
    }
  }, [loaded, data.factors.length, data.alternatives.length])

  function addFactor() {
    setData((p) => ({
      ...p,
      factors: [
        ...p.factors,
        {
          id: crypto.randomUUID(),
          label: '',
          weight: 0.1,
          scoresByAlternative: Object.fromEntries(p.alternatives.map((a) => [a.id, 2])),
        },
      ],
    }))
  }
  function updateFactor(id: string, patch: Partial<QSPMFactor>) {
    setData((p) => ({ ...p, factors: p.factors.map((f) => (f.id === id ? { ...f, ...patch } : f)) }))
  }
  function removeFactor(id: string) {
    setData((p) => ({ ...p, factors: p.factors.filter((f) => f.id !== id) }))
  }
  function updateScore(factorId: string, altId: string, score: number) {
    setData((p) => ({
      ...p,
      factors: p.factors.map((f) =>
        f.id === factorId ? { ...f, scoresByAlternative: { ...f.scoresByAlternative, [altId]: score } } : f,
      ),
    }))
  }

  function addAlt() {
    setData((p) => {
      const newAlt: QSPMAlternative = { id: crypto.randomUUID(), name: `الاستراتيجية ${String.fromCharCode(0x0623 + p.alternatives.length)}` }
      return {
        alternatives: [...p.alternatives, newAlt],
        factors: p.factors.map((f) => ({
          ...f,
          scoresByAlternative: { ...f.scoresByAlternative, [newAlt.id]: 2 },
        })),
      }
    })
  }
  function updateAltName(id: string, name: string) {
    setData((p) => ({ ...p, alternatives: p.alternatives.map((a) => (a.id === id ? { ...a, name } : a)) }))
  }
  function removeAlt(id: string) {
    setData((p) => ({
      alternatives: p.alternatives.filter((a) => a.id !== id),
      factors: p.factors.map((f) => {
        const { [id]: _omit, ...rest } = f.scoresByAlternative
        return { ...f, scoresByAlternative: rest }
      }),
    }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'QSPM', data)
      toast.success('تم حفظ QSPM')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  const totalWeight = data.factors.reduce((s, f) => s + f.weight, 0)
  const ranked = [...data.alternatives]
    .map((a) => ({ alt: a, total: totalAttractiveness(data, a.id) }))
    .sort((a, b) => b.total - a.total)

  return (
    <>
      <Card className="overflow-hidden bg-gradient-to-bl from-amber-500/10 to-transparent">
        <CardHeader>
          <CardTitle>البدائل الاستراتيجية</CardTitle>
          <CardDescription>أضف بديلين أو ثلاثة لاختيار الأفضل.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {data.alternatives.map((a) => (
              <div key={a.id} className="flex items-center gap-1 rounded-md border bg-card px-2 py-1">
                <Input
                  value={a.name}
                  onChange={(e) => updateAltName(a.id, e.target.value)}
                  className="h-7 w-40"
                />
                <button onClick={() => removeAlt(a.id)} className="text-muted-foreground hover:text-destructive">×</button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addAlt}>+ بديل</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>العوامل والأوزان والدرجات</CardTitle>
          <CardDescription>
            {data.factors.length} عامل · مجموع الأوزان الحالية: <span className="tabular-nums">{totalWeight.toFixed(2)}</span> (يتم تطبيعها تلقائياً).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-right text-muted-foreground">
                  <th className="py-2 pl-2 min-w-[140px]">العامل</th>
                  <th className="py-2 px-2 w-24">الوزن</th>
                  {data.alternatives.map((a) => (
                    <th key={a.id} className="py-2 px-2 text-center min-w-[80px]">{a.name}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.factors.map((f) => (
                  <tr key={f.id} className="border-b align-top">
                    <td className="py-1 pl-2">
                      <Input
                        className="h-7"
                        value={f.label}
                        onChange={(e) => updateFactor(f.id, { label: e.target.value })}
                        placeholder="اسم العامل…"
                      />
                    </td>
                    <td className="py-1 px-2">
                      <Input
                        className="h-7 tabular-nums"
                        type="number"
                        step={0.05}
                        min={0}
                        max={1}
                        value={f.weight}
                        onChange={(e) => updateFactor(f.id, { weight: Math.max(0, Math.min(1, Number(e.target.value) || 0)) })}
                      />
                    </td>
                    {data.alternatives.map((a) => (
                      <td key={a.id} className="py-1 px-2 text-center">
                        <select
                          className="h-7 w-16 rounded-md border bg-background px-2"
                          value={f.scoresByAlternative[a.id] ?? 2}
                          onChange={(e) => updateScore(f.id, a.id, Number(e.target.value))}
                        >
                          {[1, 2, 3, 4].map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </td>
                    ))}
                    <td className="py-1">
                      <Button variant="ghost" size="sm" onClick={() => removeFactor(f.id)}>×</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td colSpan={2} className="py-2 pl-2 text-right">إجمالي الجاذبية</td>
                  {data.alternatives.map((a) => {
                    const t = totalAttractiveness(data, a.id)
                    const best = ranked[0]?.alt.id === a.id
                    return (
                      <td key={a.id} className={`py-2 px-2 text-center tabular-nums ${best ? 'text-emerald-700' : ''}`}>
                        {t.toFixed(2)}
                        {best && <span className="ml-1">🏆</span>}
                      </td>
                    )
                  })}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-3 flex justify-between">
            <Button variant="outline" size="sm" onClick={addFactor}>+ عامل</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ QSPM'}</Button>
          </div>
        </CardContent>
      </Card>

      {ranked.length > 0 && (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardHeader>
            <CardTitle>الترتيب النهائي</CardTitle>
            <CardDescription>البديل الأعلى درجة هو الموصى به.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {ranked.map((r, i) => (
                <li key={r.alt.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                  <span className="flex items-center gap-2">
                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground tabular-nums">{i + 1}</span>
                    <span className="font-medium">{r.alt.name}</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">{r.total.toFixed(2)}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </>
  )
}
