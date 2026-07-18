import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_LABEL, type DeptCode } from '@/lib/deptApi'
import { CATEGORY_META, categorize } from '@/lib/directionCategory'
import { ONBOARDING_PAINS } from '@/lib/onboardingOptions'
import { getArtifact, listInitiatives, upsertArtifact } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

type Quadrant = 'doFirst' | 'schedule' | 'delegate' | 'eliminate'

interface Item {
  id: string
  title: string
  quadrant: Quadrant
}

interface PriorityData {
  items: Item[]
}

const EMPTY: PriorityData = { items: [] }

const QUADRANTS: Record<Quadrant, { title: string; subtitle: string; icon: string; tint: string }> = {
  doFirst:   { title: 'افعلها أولاً', subtitle: 'أثر عالٍ × جهد منخفض', icon: '🔥', tint: 'border-emerald-300 bg-gradient-to-br from-emerald-500/15 to-transparent' },
  schedule:  { title: 'جدولها',       subtitle: 'أثر عالٍ × جهد عالٍ', icon: '🗓️', tint: 'border-sky-300 bg-gradient-to-br from-sky-500/15 to-transparent' },
  delegate:  { title: 'فوّضها',        subtitle: 'أثر منخفض × جهد منخفض', icon: '🤝', tint: 'border-amber-300 bg-gradient-to-br from-amber-500/15 to-transparent' },
  eliminate: { title: 'احذفها',       subtitle: 'أثر منخفض × جهد عالٍ', icon: '🗑️', tint: 'border-rose-300 bg-gradient-to-br from-rose-500/15 to-transparent' },
}

export function PriorityMatrixPage() {
  const [params] = useSearchParams()
  const client = params.get('client')
  const q = client ? `&client=${client}` : ''
  return <Navigate to={`/priority?tab=matrix${q}`} replace />
}

export function PriorityMatrixView({ companyId }: { companyId: string }) {
  return <Editor companyId={companyId} />
}

function Editor({ companyId }: { companyId: string }) {
  const user = useAuthStore((s) => s.user)
  const specialty = user?.specialtyDeptType ?? null
  const [data, setData] = useState<PriorityData>(EMPTY)
  const [newTitle, setNewTitle] = useState('')
  const [newQuad, setNewQuad] = useState<Quadrant>('doFirst')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  // ─── ترابط: user.pains → Priority Matrix (doFirst) ──────────────
  // الآلام التي اختارها المدير في /onboarding ملحّة بطبيعتها → تُقتَرَح
  // كعناصر في ربع "افعلها أولاً". المدير ينقر لإضافتها.
  const pains = user?.pains ?? []
  const suggestedPains = ONBOARDING_PAINS.filter((p) => pains.includes(p.code))
  function addPain(painLabel: string) {
    const title = `معالجة: ${painLabel}`
    if (data.items.some((x) => x.title === title)) return
    setData((prev) => ({
      items: [...prev.items, { id: crypto.randomUUID(), title, quadrant: 'doFirst' }],
    }))
  }

  useEffect(() => {
    getArtifact<PriorityData>(companyId, 'PRIORITY_MATRIX').then((row) => {
      if (row?.data?.items) setData({ items: row.data.items })
    }).catch(() => undefined)
  }, [companyId])

  function add() {
    const v = newTitle.trim()
    if (!v) return
    setData((p) => ({ items: [...p.items, { id: crypto.randomUUID(), title: v, quadrant: newQuad }] }))
    setNewTitle('')
  }
  function move(id: string, quadrant: Quadrant) {
    setData((p) => ({ items: p.items.map((i) => (i.id === id ? { ...i, quadrant } : i)) }))
  }
  function remove(id: string) {
    setData((p) => ({ items: p.items.filter((i) => i.id !== id) }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'PRIORITY_MATRIX', data)
      toast.success('تم حفظ المصفوفة')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  // 🧠 توليد ذكيّ — من المبادرات + قرار Choices:
  //   • مبادرة ⭐ [قرار] X       → doFirst (الأثر الأعلى)
  //   • critical/high + growth/efficiency → doFirst (أثر ↑ + جهد ↓)
  //   • critical/high + innovation/digital → schedule (أثر ↑ + جهد ↑)
  //   • medium + customer/quality → delegate (أثر ↓ + جهد ↓)
  //   • low + exit → eliminate (أثر ↓ + جهد ↑)
  async function generateFromInitiatives() {
    setGenerating(true)
    try {
      const initiatives = await listInitiatives(companyId)
      if (initiatives.length === 0) {
        toast.error('لا مبادرات — افتح /initiatives لتوليدها أوّلاً.')
        return
      }
      const existing = new Set(data.items.map((i) => i.title))
      const toAdd: Item[] = []
      const highImpactLowEffort = new Set(['growth', 'efficiency', 'customer'])
      const highImpactHighEffort = new Set(['innovation', 'digital', 'partnership'])
      const lowImpactLowEffort   = new Set(['quality', 'people', 'compliance'])
      for (const init of initiatives) {
        if (!init.title || existing.has(init.title)) continue
        const cat = categorize(init.title + ' ' + (init.description ?? ''))
        const isStar = init.title.startsWith('⭐')
        let quadrant: Quadrant = 'schedule'
        if (isStar) quadrant = 'doFirst'
        else if (init.priority === 'critical' || init.priority === 'high') {
          quadrant = highImpactLowEffort.has(cat) ? 'doFirst' : highImpactHighEffort.has(cat) ? 'schedule' : 'doFirst'
        } else if (init.priority === 'medium') {
          quadrant = lowImpactLowEffort.has(cat) ? 'delegate' : 'schedule'
        } else {
          quadrant = cat === 'exit' ? 'eliminate' : 'delegate'
        }
        toAdd.push({ id: crypto.randomUUID(), title: init.title, quadrant })
      }
      if (toAdd.length === 0) {
        toast.message('كل المبادرات مضافة سلفاً.')
        return
      }
      setData((p) => ({ items: [...p.items, ...toAdd] }))
      const counts: Record<Quadrant, number> = { doFirst: 0, schedule: 0, delegate: 0, eliminate: 0 }
      for (const t of toAdd) counts[t.quadrant]++
      const parts: string[] = []
      if (counts.doFirst) parts.push(`${counts.doFirst} في «افعلها أوّلاً»`)
      if (counts.schedule) parts.push(`${counts.schedule} في «جدولها»`)
      if (counts.delegate) parts.push(`${counts.delegate} في «فوّضها»`)
      if (counts.eliminate) parts.push(`${counts.eliminate} في «احذفها»`)
      toast.success(`🧠 أُضيف ${toAdd.length} مبادرة: ${parts.join(' · ')}`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر التوليد التلقائي'))
    } finally {
      setGenerating(false)
    }
  }

  const byQuad = (q: Quadrant) => data.items.filter((i) => i.quadrant === q)

  return (
    <>
      {/* بطاقة تعريف */}
      <Card className="border-primary/20 bg-gradient-to-l from-primary/5 to-transparent">
        <CardContent className="p-4 text-xs leading-relaxed">
          <div className="flex items-start gap-3">
            <div className="text-2xl leading-none">⚡</div>
            <div className="flex-1">
              <div className="text-sm font-bold text-foreground">ما الفرق بين مصفوفة الأولوية وأيزنهاور؟</div>
              <p className="mt-1 text-muted-foreground">
                <b className="text-foreground">أيزنهاور = عاجل × مهم</b> (للمهام اليومية والأزمات).<br/>
                <b className="text-foreground">الأولوية = أثر × جهد</b> (للمبادرات الاستراتيجية) — أنسب لاختيار «ماذا نُطلق أوّلاً».
              </p>
              <p className="mt-1 text-muted-foreground">
                <b className="text-foreground">القاعدة الذهبيّة:</b> ابدأ بربع
                <b className="text-emerald-700"> 🔥 افعلها أوّلاً</b> (أثر ↑ + جهد ↓) — أعلى عائد بأقلّ تكلفة.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* شارة السياق */}
      {specialty && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3 p-3 text-xs">
            <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
              🎯 السياق: إدارة {DEPT_LABEL[specialty as DeptCode]}
            </span>
            <span className="text-muted-foreground">
              التصنيف يعتمد على أولوية المبادرة وفئتها (نمو → أثر عالٍ، ابتكار → جهد عالٍ، …).
            </span>
          </CardContent>
        </Card>
      )}

      {/* 🧠 توليد من المبادرات */}
      <Card className="border-primary/40 bg-gradient-to-l from-primary/15 to-primary/5">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="text-3xl" aria-hidden>🧠</div>
            <div>
              <div className="text-sm font-bold">توليد ذكيّ من المبادرات</div>
              <div className="text-xs text-muted-foreground">
                يصنّف المبادرات بحسب الأولوية والفئة:
                القرار ⭐ + الأولوية العالية للفئات (نمو/كفاءة/عميل) → افعلها أوّلاً؛
                الابتكار/الرقمنة → جدولها؛ الجودة/الفريق → فوّضها؛ خروج → احذفها.
              </div>
            </div>
          </div>
          <Button onClick={generateFromInitiatives} disabled={generating || saving} size="lg">
            {generating ? 'جاري…' : '✨ ولّد الآن'}
          </Button>
        </CardContent>
      </Card>

      {suggestedPains.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">💡 آلامك من التسجيل — تحويلها إلى «افعلها أولاً»</CardTitle>
            <CardDescription>اضغط الألم لإضافته كعنصر أولوية قصوى.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {suggestedPains.map((p) => {
              const already = data.items.some((x) => x.title === `معالجة: ${p.labelAr}`)
              return (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => addPain(p.labelAr)}
                  disabled={already}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                    already
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-primary/40 bg-card hover:bg-primary hover:text-primary-foreground'
                  }`}
                >
                  <span aria-hidden>{p.icon}</span>
                  {already ? '✓ ' : '＋ '}{p.labelAr}
                </button>
              )
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>إضافة مبادرة</CardTitle>
          <CardDescription>{data.items.length} عنصر في المصفوفة.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Input
              className="flex-1 min-w-[200px]"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
              placeholder="اسم المبادرة…"
            />
            <select
              className="rounded-md border bg-background px-3 text-sm"
              value={newQuad}
              onChange={(e) => setNewQuad(e.target.value as Quadrant)}
            >
              {(Object.keys(QUADRANTS) as Quadrant[]).map((q) => (
                <option key={q} value={q}>{QUADRANTS[q].title}</option>
              ))}
            </select>
            <Button onClick={add}>إضافة</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {(['doFirst', 'schedule', 'delegate', 'eliminate'] as Quadrant[]).map((q) => {
          const meta = QUADRANTS[q]
          const items = byQuad(q)
          return (
            <Card key={q} className={meta.tint}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="text-xl">{meta.icon}</span>
                  {meta.title}
                  <span className="mr-auto text-xs font-normal text-muted-foreground tabular-nums">({items.length})</span>
                </CardTitle>
                <CardDescription>{meta.subtitle}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {items.map((i) => {
                    const cat = categorize(i.title)
                    const catMeta = CATEGORY_META[cat]
                    return (
                    <li key={i.id} className="flex items-center gap-2 rounded-lg border bg-card p-2 text-sm">
                      <span className="text-base" title={catMeta.labelAr}>{catMeta.icon}</span>
                      <span className="flex-1">{i.title}</span>
                      <select
                        className="rounded-md border bg-background px-1.5 py-1 text-xs"
                        value={i.quadrant}
                        onChange={(e) => move(i.id, e.target.value as Quadrant)}
                      >
                        {(Object.keys(QUADRANTS) as Quadrant[]).map((qk) => (
                          <option key={qk} value={qk}>{QUADRANTS[qk].title}</option>
                        ))}
                      </select>
                      <button onClick={() => remove(i.id)} className="text-muted-foreground hover:text-destructive">×</button>
                    </li>
                    )
                  })}
                  {items.length === 0 && (
                    <li className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                      لا توجد عناصر — أضف من فوق.
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ المصفوفة'}</Button>
      </div>

      {/* 🎯 الخطوة التالية — عناصر «افعلها أوّلاً» تُصبح مبادرات فعلية */}
      {byQuad('doFirst').length > 0 && (
        <Card className="border-emerald-300 bg-emerald-50/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="flex items-start gap-3">
              <div className="text-2xl">💡</div>
              <div>
                <div className="text-sm font-bold text-emerald-900">
                  الخطوة التالية: حوّل «افعلها أوّلاً» إلى مبادرات ومشاريع
                </div>
                <div className="text-xs text-emerald-800/80">
                  {byQuad('doFirst').length} عنصر جاهز للتنفيذ — أضِفها للمبادرات ثم أنشئ مشاريع بتواريخ.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/initiatives" className={buttonVariants({ variant: 'outline' })}>💡 المبادرات</Link>
              <Link to="/projects" className={buttonVariants({ variant: 'default' })}>📁 المشاريع ←</Link>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
