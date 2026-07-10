import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api'
import { COMPANY_PESTEL_SUGGESTIONS, DEFAULT_IMPACT } from '@/lib/companyPESTEL'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

interface Factor {
  id: string
  text: string
  impact: 1 | 2 | 3 | 4 | 5
}

type Section = 'political' | 'economic' | 'social' | 'technological' | 'environmental' | 'legal'

interface PESTELData {
  political: Factor[]
  economic: Factor[]
  social: Factor[]
  technological: Factor[]
  environmental: Factor[]
  legal: Factor[]
}

const SECTIONS: { key: Section; label: string; gradient: string; icon: string; hint: string }[] = [
  { key: 'political',     label: 'سياسي',    icon: '🏛️', gradient: 'from-rose-500/15 to-rose-500/0 border-rose-200',       hint: 'سياسات، تشريعات، استقرار، دعم قطاعي' },
  { key: 'economic',      label: 'اقتصادي',   icon: '💰', gradient: 'from-amber-500/15 to-amber-500/0 border-amber-200',    hint: 'تضخم، فوائد، قوّة شرائية، أسعار نفط' },
  { key: 'social',        label: 'اجتماعي',   icon: '👥', gradient: 'from-yellow-500/15 to-yellow-500/0 border-yellow-200', hint: 'ديموغرافيا، ثقافة، تفضيلات، أنماط استهلاك' },
  { key: 'technological', label: 'تقني',     icon: '💻', gradient: 'from-emerald-500/15 to-emerald-500/0 border-emerald-200', hint: 'أتمتة، ذكاء اصطناعي، سحابة، أمن سيبراني' },
  { key: 'environmental', label: 'بيئي',     icon: '🌿', gradient: 'from-sky-500/15 to-sky-500/0 border-sky-200',          hint: 'استدامة، طاقة، انبعاثات، ESG' },
  { key: 'legal',         label: 'قانوني',   icon: '⚖️', gradient: 'from-violet-500/15 to-violet-500/0 border-violet-200', hint: 'لوائح، عقود، بيانات، امتثال' },
]

const EMPTY: PESTELData = {
  political: [], economic: [], social: [], technological: [], environmental: [], legal: [],
}

export function PESTELPage() {
  return (
    <StrategicShell
      title="تحليل PESTEL"
      description="مسح للبيئة الخارجية عبر ٦ أبعاد — استخدم بنك المقترحات الجاهزة أو ولّد الكل تلقائياً، ثم عدّل الأثر (١-٥)."
    >
      {(companyId) => <PESTELEditor companyId={companyId} />}
    </StrategicShell>
  )
}

function PESTELEditor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<PESTELData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    getArtifact<PESTELData>(companyId, 'PESTEL').then((row) => {
      if (row?.data) setData({ ...EMPTY, ...row.data })
    }).catch(() => undefined)
  }, [companyId])

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'PESTEL', data)
      toast.success('تم حفظ تحليل PESTEL')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  function addWith(section: Section, text: string, impact: Factor['impact'] = DEFAULT_IMPACT) {
    // منع تكرار نفس النص داخل نفس المحور.
    if (data[section].some((f) => f.text.trim() === text.trim())) return false
    setData((prev) => ({
      ...prev,
      [section]: [...prev[section], { id: crypto.randomUUID(), text, impact }],
    }))
    return true
  }
  function add(section: Section) {
    addWith(section, '')
  }
  function update(section: Section, id: string, patch: Partial<Factor>) {
    setData((prev) => ({
      ...prev,
      [section]: prev[section].map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }))
  }
  function remove(section: Section, id: string) {
    setData((prev) => ({ ...prev, [section]: prev[section].filter((f) => f.id !== id) }))
  }

  // 🧠 توليد تلقائي — يُضيف كل المقترحات الست عشر لكل المحاور دفعة واحدة.
  function generateAll() {
    setGenerating(true)
    let added = 0
    setData((prev) => {
      const next: PESTELData = { ...prev }
      for (const s of SECTIONS) {
        const existing = new Set(next[s.key].map((f) => f.text.trim()))
        const toAdd: Factor[] = []
        for (const sug of COMPANY_PESTEL_SUGGESTIONS[s.key]) {
          if (!existing.has(sug)) {
            toAdd.push({ id: crypto.randomUUID(), text: sug, impact: DEFAULT_IMPACT })
            existing.add(sug)
            added++
          }
        }
        next[s.key] = [...next[s.key], ...toAdd]
      }
      return next
    })
    setGenerating(false)
    if (added === 0) toast.error('كل المقترحات موجودة سلفاً.')
    else toast.success(`🧠 أُضيف ${added} عنصراً — أثر افتراضي ${DEFAULT_IMPACT}/٥. عدّل الأثر واحذف غير المناسب.`)
  }

  // إحصائيات علوية.
  const totalFactors = SECTIONS.reduce((sum, s) => sum + data[s.key].length, 0)
  const highImpactCount = SECTIONS.reduce(
    (sum, s) => sum + data[s.key].filter((f) => f.impact >= 4).length, 0,
  )
  const avgImpact = totalFactors > 0
    ? Math.round(
        (SECTIONS.reduce((sum, s) => sum + data[s.key].reduce((x, f) => x + f.impact, 0), 0) / totalFactors) * 10,
      ) / 10
    : 0

  return (
    <>
      {/* لوحة إحصاءات + توليد تلقائي */}
      <Card className="border-primary/40 bg-gradient-to-l from-primary/15 to-primary/5">
        <CardContent className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="text-3xl" aria-hidden>🧠</div>
            <div>
              <div className="text-sm font-bold">توليد تلقائي — بنك مقترحات جاهز للسياق السعودي</div>
              <div className="text-xs text-muted-foreground">
                نُضيف ٥ عوامل مقترحة لكل محور (٣٠ إجمالاً) بسياق السوق السعودي. راجع الأثر وعدّل.
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                <span>📊 <b className="text-foreground tabular-nums">{totalFactors}</b> عامل مُدخَل</span>
                <span>⚡ <b className="text-foreground tabular-nums">{highImpactCount}</b> عالي الأثر (٤+)</span>
                {totalFactors > 0 && (
                  <span>🎯 متوسط الأثر: <b className="text-foreground tabular-nums">{avgImpact}</b>/٥</span>
                )}
              </div>
            </div>
          </div>
          <Button onClick={generateAll} disabled={generating || saving} size="lg">
            {generating ? 'جاري…' : '✨ ولّد الكل'}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map((s) => {
          const suggestions = COMPANY_PESTEL_SUGGESTIONS[s.key]
          const existingTexts = new Set(data[s.key].map((f) => f.text.trim()))
          return (
            <Card key={s.key} className={`bg-gradient-to-br ${s.gradient}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="text-xl">{s.icon}</span>
                  {s.label}
                </CardTitle>
                <CardDescription>
                  <span className="tabular-nums font-semibold">{data[s.key].length}</span> عامل — {s.hint}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* رقائق مقترحة نقرة — تُضيف عاملاً بأثر افتراضي ٣ */}
                <div className="rounded-lg border border-dashed bg-card/50 p-2">
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    💡 مقترحات جاهزة — اضغط لإضافة:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {suggestions.map((sug) => {
                      const already = existingTexts.has(sug)
                      return (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => {
                            const ok = addWith(s.key, sug)
                            if (!ok) toast.message('مضاف سلفاً.')
                          }}
                          disabled={already}
                          className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                            already
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : 'border-primary/30 bg-card hover:bg-primary hover:text-primary-foreground'
                          }`}
                        >
                          {already ? '✓ ' : '＋ '}{sug}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* العوامل المُدخَلة */}
                {data[s.key].map((f) => (
                  <div key={f.id} className="flex items-center gap-2">
                    <Input
                      value={f.text}
                      placeholder="وصف العامل"
                      onChange={(e) => update(s.key, f.id, { text: e.target.value })}
                    />
                    <select
                      className={`rounded-md border bg-background px-2 py-1 text-xs tabular-nums ${
                        f.impact >= 4 ? 'border-rose-400 text-rose-700' : f.impact <= 2 ? 'text-muted-foreground' : ''
                      }`}
                      value={f.impact}
                      onChange={(e) => update(s.key, f.id, { impact: Number(e.target.value) as Factor['impact'] })}
                      title={`أثر ${f.impact}/٥`}
                    >
                      {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>أثر {v}</option>)}
                    </select>
                    <Button variant="ghost" size="sm" onClick={() => remove(s.key, f.id)} aria-label="حذف">×</Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => add(s.key)}>+ عامل حرّ</Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || generating}>
          {saving ? 'جاري الحفظ…' : `حفظ التحليل (${totalFactors} عامل)`}
        </Button>
      </div>
    </>
  )
}
