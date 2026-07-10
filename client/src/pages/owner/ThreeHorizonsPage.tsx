import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_LABEL, type DeptCode } from '@/lib/deptApi'
import { DEPT_THREE_HORIZONS, HORIZON_META, type Horizon } from '@/lib/deptThreeHorizons'
import { getArtifact, getSWOT, listInitiatives, upsertArtifact, type ArtifactType } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'
import type { StrategyPath } from '@/types/user'

// أفق ما داخل مسار المدير؟ QUICK→H1، MEDIUM→H1+H2، LONG (أو null)→كلها.
function isHorizonInPath(h: Horizon, path: StrategyPath | null): boolean {
  if (!path || path === 'LONG') return true
  if (path === 'QUICK') return h === 'h1'
  if (path === 'MEDIUM') return h === 'h1' || h === 'h2'
  return true
}

interface Initiative {
  id: string
  title: string
  horizon: Horizon
  progress: number  // 0-100
}

interface ThreeHData {
  initiatives: Initiative[]
}

const EMPTY: ThreeHData = { initiatives: [] }

export function ThreeHorizonsPage() {
  const user = useAuthStore((s) => s.user)
  const isDeptScoped =
    user?.userType === 'MANAGER' &&
    user?.managerType === 'INDEPENDENT_PRO' &&
    user?.specialtyDeptType != null &&
    DEPT_THREE_HORIZONS[user.specialtyDeptType] != null
  const specialty = user?.specialtyDeptType ?? null
  const title = isDeptScoped
    ? `الآفاق الثلاثة — ${DEPT_LABEL[specialty as DeptCode]}`
    : 'الآفاق الثلاثة'
  const description = isDeptScoped
    ? 'ثلاثة آفاق لتطوير إدارتك: تحسينات اليوم، قدرات ناشئة، رهانات المستقبل.'
    : 'نموذج McKinsey للأفق الثلاثي: حافظ على الجوهر، اصنع النمو، استثمر في المستقبل.'
  return (
    <StrategicShell title={title} description={description}>
      {(companyId) => (
        <Editor
          companyId={companyId}
          specialty={isDeptScoped ? (specialty as DeptCode) : null}
        />
      )}
    </StrategicShell>
  )
}

function Editor({ companyId, specialty }: { companyId: string; specialty: DeptCode | null }) {
  // ⚠️ نستخدم artifact مختلف عندما dept-scoped حتى تنفصل بيانات الإدارة عن الشركة.
  const artifactType: ArtifactType = specialty ? `THREE_HORIZONS_${specialty}` : 'THREE_HORIZONS'
  const suggestions = specialty ? DEPT_THREE_HORIZONS[specialty] ?? [] : []
  const strategyPath = useAuthStore((s) => s.user?.strategyPath ?? null)
  const [data, setData] = useState<ThreeHData>(EMPTY)
  const [title, setTitle] = useState('')
  const [horizon, setHorizon] = useState<Horizon>('h1')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    getArtifact<ThreeHData>(companyId, artifactType).then((row) => {
      if (row?.data?.initiatives) setData({ initiatives: row.data.initiatives })
    }).catch(() => undefined)
  }, [companyId, artifactType])

  function add(newTitle: string, targetHorizon: Horizon) {
    const t = newTitle.trim()
    if (!t) return
    if (data.initiatives.some((i) => i.title === t)) return
    setData((p) => ({
      initiatives: [...p.initiatives, { id: crypto.randomUUID(), title: t, horizon: targetHorizon, progress: 10 }],
    }))
  }
  function addFromInput() {
    add(title, horizon)
    setTitle('')
  }
  function update(id: string, patch: Partial<Initiative>) {
    setData((p) => ({ initiatives: p.initiatives.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))
  }
  function remove(id: string) {
    setData((p) => ({ initiatives: p.initiatives.filter((i) => i.id !== id) }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, artifactType, data)
      toast.success('تم حفظ الآفاق')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  // ─── 🧠 توليد تلقائي من التحليل السابق ─────────────────────────
  // المصادر (بأولوية):
  //   1) المبادرات الحالية (Initiatives model) → H1 كأنشطة أساسية
  //      تعمل عليها الإدارة الآن.
  //   2) SWOT.opportunities → H2 كقدرات ناشئة يجب استغلالها.
  //   3) SWOT.weaknesses → H2 كإصلاحات ناضجة يجب البدء فيها.
  //   4) بنك المقترحات لتخصّصك → H3 كرهانات مستقبلية.
  // كل مصدر يُضاف بعد فحص التكرار (dedupe بالعنوان).
  async function generateFromContext() {
    setGenerating(true)
    try {
      const existing = new Set(data.initiatives.map((i) => i.title))
      const toAdd: Initiative[] = []
      let h1Count = 0, h2Count = 0, h3Count = 0

      // 1) المبادرات الحالية → H1
      try {
        const initiatives = await listInitiatives(companyId)
        for (const i of initiatives.slice(0, 5)) {
          if (existing.has(i.title)) continue
          toAdd.push({ id: crypto.randomUUID(), title: i.title, horizon: 'h1', progress: 30 })
          existing.add(i.title)
          h1Count++
        }
      } catch { /* skip */ }

      // 2) SWOT → H2 (opportunities + weaknesses)
      try {
        const swot = await getSWOT(companyId)
        if (swot) {
          const opps = (swot.opportunities ?? []).slice(0, 3)
          const wks = (swot.weaknesses ?? []).slice(0, 2)
          for (const o of opps) {
            const short = o.slice(0, 60) + (o.length > 60 ? '…' : '')
            const t = `اقتناص: ${short}`
            if (existing.has(t)) continue
            toAdd.push({ id: crypto.randomUUID(), title: t, horizon: 'h2', progress: 10 })
            existing.add(t)
            h2Count++
          }
          for (const w of wks) {
            const short = w.slice(0, 60) + (w.length > 60 ? '…' : '')
            const t = `معالجة: ${short}`
            if (existing.has(t)) continue
            toAdd.push({ id: crypto.randomUUID(), title: t, horizon: 'h2', progress: 10 })
            existing.add(t)
            h2Count++
          }
        }
      } catch { /* skip */ }

      // 3) بنك التخصّص → H3 (يظهر فقط للمدير المستقل بتخصّص)
      if (specialty && suggestions.length > 0) {
        const h3Bank = suggestions.filter((s) => s.horizon === 'h3').slice(0, 4)
        for (const s of h3Bank) {
          if (existing.has(s.title)) continue
          toAdd.push({ id: crypto.randomUUID(), title: s.title, horizon: 'h3', progress: 0 })
          existing.add(s.title)
          h3Count++
        }
      }

      if (toAdd.length === 0) {
        toast.error('لا يوجد بيانات سابقة أو المقترحات مضافة سلفاً.')
        return
      }
      setData((p) => ({ initiatives: [...p.initiatives, ...toAdd] }))
      toast.success(
        `🧠 أُضيف ${toAdd.length} مبادرة: ${h1Count} H1 (من مبادراتك) + ${h2Count} H2 (من SWOT) + ${h3Count} H3 (من بنك تخصّصك).`,
      )
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر التوليد التلقائي'))
    } finally {
      setGenerating(false)
    }
  }

  const byH = (h: Horizon) => data.initiatives.filter((i) => i.horizon === h)

  return (
    <>
      {/* شارة السياق */}
      {specialty && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3 p-3 text-xs">
            <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
              🎯 السياق: إدارة {DEPT_LABEL[specialty]} فقط
            </span>
            <span className="text-muted-foreground">
              الآفاق الثلاثة مُعادة تفسيرها لإدارتك — H1 = تحسينات اليوم، H2 = قدرات ناشئة، H3 = رهانات ٣+ سنوات.
            </span>
          </CardContent>
        </Card>
      )}

      {/* 🧠 توليد تلقائي — يقرأ المبادرات + SWOT + بنك التخصّص */}
      <Card className="border-primary/40 bg-gradient-to-l from-primary/15 to-primary/5">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="text-3xl" aria-hidden>🧠</div>
            <div>
              <div className="text-sm font-bold">توليد تلقائي من التحليل السابق</div>
              <div className="text-xs text-muted-foreground">
                نقرأ مبادراتك الحالية (H1) + فرص/ضعف من SWOT (H2){specialty && ' + بنك تخصّصك (H3)'} — راجعها وعدّل.
              </div>
            </div>
          </div>
          <Button onClick={generateFromContext} disabled={generating || saving} size="lg">
            {generating ? 'جاري التوليد…' : '✨ ولّد الآن'}
          </Button>
        </CardContent>
      </Card>

      {/* شريط إضافة يدوي */}
      <Card>
        <CardHeader>
          <CardTitle>إضافة مبادرة يدوياً</CardTitle>
          <CardDescription>{data.initiatives.length} مبادرة موزّعة عبر الآفاق الثلاثة.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Input
              className="flex-1 min-w-[220px]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFromInput())}
              placeholder="اكتب مبادرة مخصّصة…"
            />
            <select
              className="rounded-md border bg-background px-3 text-sm"
              value={horizon}
              onChange={(e) => setHorizon(e.target.value as Horizon)}
            >
              {(['h1', 'h2', 'h3'] as Horizon[]).map((h) => (
                <option key={h} value={h}>{HORIZON_META[h].labelAr}</option>
              ))}
            </select>
            <Button onClick={addFromInput}>＋ إضافة</Button>
          </div>
        </CardContent>
      </Card>

      {/* الآفاق الثلاثة */}
      <div className="grid gap-3 lg:grid-cols-3">
        {(['h1', 'h2', 'h3'] as Horizon[]).map((h) => {
          const meta = HORIZON_META[h]
          const items = byH(h)
          // مقترحات تخصّصية لكل أفق
          const hSuggestions = specialty
            ? suggestions.filter((s) => s.horizon === h)
            : []
          // إبراز الأفق المطابق لمسار المدير: QUICK→H1، MEDIUM→H1+H2، LONG→الكل.
          const emphasized = isHorizonInPath(h, strategyPath)
          return (
            <Card
              key={h}
              className={`${meta.colorClass} ${emphasized ? 'ring-2 ring-primary/40' : 'opacity-70'}`}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="text-xl">{meta.icon}</span>
                  {meta.labelAr}
                </CardTitle>
                <CardDescription className="flex items-center justify-between">
                  <span>{meta.descAr}</span>
                  <span className="rounded-md bg-card px-2 py-0.5 text-[10px] font-medium">{meta.timeline}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* مقترحات نقرة (للمدير المستقل) */}
                {hSuggestions.length > 0 && (
                  <div className="rounded-lg border border-dashed bg-card/60 p-2">
                    <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      💡 مقترحات لتخصّصك:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {hSuggestions.map((s) => {
                        const already = data.initiatives.some((i) => i.title === s.title)
                        return (
                          <button
                            key={s.title}
                            type="button"
                            onClick={() => add(s.title, h)}
                            disabled={already}
                            className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                              already
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                : 'border-primary/30 bg-card hover:bg-primary hover:text-primary-foreground'
                            }`}
                          >
                            {already ? '✓ ' : '＋ '}{s.title}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                {/* المبادرات المُضافة */}
                <ul className="space-y-2">
                  {items.map((i) => (
                    <li key={i.id} className="space-y-2 rounded-lg border bg-card p-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="flex-1">{i.title}</span>
                        <select
                          className="rounded-md border bg-background px-1.5 py-0.5 text-[10px]"
                          value={i.horizon}
                          onChange={(e) => update(i.id, { horizon: e.target.value as Horizon })}
                        >
                          {(['h1', 'h2', 'h3'] as Horizon[]).map((hk) => (
                            <option key={hk} value={hk}>{HORIZON_META[hk].labelAr.split('—')[0]}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => remove(i.id)}
                          className="text-muted-foreground transition hover:text-destructive"
                          aria-label="حذف"
                        >
                          ×
                        </button>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>التقدم</span>
                          <span className="tabular-nums">{i.progress}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={i.progress}
                          onChange={(e) => update(i.id, { progress: Number(e.target.value) })}
                          className="w-full"
                        />
                        <Progress value={i.progress} className="mt-0.5 h-1" />
                      </div>
                    </li>
                  ))}
                  {items.length === 0 && (
                    <li className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                      لا مبادرات — استخدم «✨ ولّد» أو انقر مقترحاً أعلاه.
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || generating}>
          {saving ? 'جاري الحفظ…' : `حفظ الآفاق (${data.initiatives.length} مبادرة)`}
        </Button>
      </div>
    </>
  )
}
