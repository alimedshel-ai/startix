import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, ReferenceLine } from 'recharts'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api'
import { CATEGORY_META, categorize, DEPT_BCG_SUGGESTIONS, type Category } from '@/lib/directionCategory'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

interface Product {
  id: string
  name: string
  marketShare: number   // 0-100 (relative to leader)
  marketGrowth: number  // 0-100 (annual %)
  revenue: number       // SAR
}

interface BCGData { products: Product[] }
const EMPTY: BCGData = { products: [] }

type QuadrantKey = 'star' | 'cow' | 'question' | 'dog'

// ─── تفاصيل الأرباع الأربعة — أيقونات + توصية استراتيجية موجزة ───
interface QuadrantMeta {
  key: QuadrantKey
  icon: string
  labelAr: string
  advice: string
  actionAr: string
  actionTo: string
  colorHex: string
  tintCls: string
  headerCls: string
}

const QUADRANTS: Record<QuadrantKey, QuadrantMeta> = {
  star: {
    key: 'star', icon: '⭐', labelAr: 'نجوم', advice: 'استثمر بقوّة — سوق ينمو وحصّتك عالية. حافظ على القيادة.',
    actionAr: 'حوّلها إلى مبادرات نمو ←', actionTo: '/initiatives',
    colorHex: '#f59e0b', tintCls: 'border-amber-300 bg-amber-50/60', headerCls: 'text-amber-800',
  },
  cow: {
    key: 'cow', icon: '🐄', labelAr: 'بقرات حلوب', advice: 'اقطف الربح — سوق ناضج وحصّتك عالية. مولّد نقد لتمويل النجوم.',
    actionAr: 'اربطها بمصادر إيراد في BMC ←', actionTo: '/bmc',
    colorHex: '#10b981', tintCls: 'border-emerald-300 bg-emerald-50/60', headerCls: 'text-emerald-800',
  },
  question: {
    key: 'question', icon: '❓', labelAr: 'علامات استفهام', advice: 'استثمر بحذر أو تخلّى — سوق ينمو لكن حصّتك ضعيفة. قرار: تحويل لنجم أو خروج.',
    actionAr: 'قارِن بأنسوف قبل الاستثمار ←', actionTo: '/ansoff',
    colorHex: '#8b5cf6', tintCls: 'border-violet-300 bg-violet-50/60', headerCls: 'text-violet-800',
  },
  dog: {
    key: 'dog', icon: '🐕', labelAr: 'كلاب', advice: 'قلّص أو تخلّى — نمو منخفض وحصّة منخفضة. يستهلك موارد دون عائد.',
    actionAr: 'خطّط لخروج مدروس ←', actionTo: '/three-horizons',
    colorHex: '#64748b', tintCls: 'border-slate-300 bg-slate-50/60', headerCls: 'text-slate-800',
  },
}

function classify(p: Product): QuadrantMeta {
  const highGrowth = p.marketGrowth >= 50
  const highShare  = p.marketShare >= 50
  if (highGrowth && highShare)  return QUADRANTS.star
  if (highGrowth && !highShare) return QUADRANTS.question
  if (!highGrowth && highShare) return QUADRANTS.cow
  return QUADRANTS.dog
}

export function BCGMatrixPage() {
  return (
    <StrategicShell
      title="مصفوفة BCG"
      description="صنّف منتجاتك/خدماتك لأربعة أرباع (نجوم/بقرات/علامات استفهام/كلاب). المنصّة تقترح توصية استراتيجية لكل ربع + أدوات جلب البيانات من تحليلاتك السابقة."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const user = useAuthStore((s) => s.user)
  const specialty = user?.specialtyDeptType ?? null
  const deptBank = specialty ? DEPT_BCG_SUGGESTIONS[specialty] ?? [] : []
  const [data, setData] = useState<BCGData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [filter, setFilter] = useState<QuadrantKey | null>(null)

  useEffect(() => {
    getArtifact<BCGData>(companyId, 'BCG').then((row) => {
      if (row?.data?.products) setData({ products: row.data.products })
    }).catch(() => undefined)
  }, [companyId])

  function add(name = '', marketShare = 30, marketGrowth = 30, revenue = 100_000) {
    setData((p) => ({
      products: [
        ...p.products,
        { id: crypto.randomUUID(), name, marketShare, marketGrowth, revenue },
      ],
    }))
  }
  function addNamed(name: string) {
    if (!name.trim()) return
    if (data.products.some((p) => p.name === name)) {
      toast.message(`«${name}» مضاف مسبقاً.`)
      return
    }
    add(name)
    toast.success(`أُضيف: ${name} — عدّل الحصة والنمو والإيراد.`)
  }
  function update(id: string, patch: Partial<Product>) {
    setData((p) => ({ products: p.products.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
  }
  function remove(id: string) {
    setData((p) => ({ products: p.products.filter((x) => x.id !== id) }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'BCG', data)
      toast.success('تم حفظ BCG')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  // 🧠 توليد تلقائي — يجلب أسماء منتجات/خدمات من:
  //   1) BMC.activities + BMC.value + BMC.revenue (سطور مفصولة بسطر جديد أو فاصلة).
  //   2) Directions (عناوين).
  //   3) بنك تخصّص المدير (إن كان INDEPENDENT_PRO).
  async function generateFromContext() {
    setGenerating(true)
    try {
      const existing = new Set(data.products.map((p) => p.name.trim()).filter(Boolean))
      const toAdd: string[] = []
      // BMC
      try {
        const bmc = await getArtifact<{ blocks?: Record<string, string> }>(companyId, 'BMC')
        const blocks = bmc?.data?.blocks
        if (blocks) {
          const raw = [blocks.activities, blocks.value, blocks.revenue].filter(Boolean).join('\n')
          for (const line of splitLines(raw).slice(0, 4)) {
            if (!existing.has(line)) { toAdd.push(line); existing.add(line) }
          }
        }
      } catch { /* skip */ }
      // Directions
      try {
        const dirs = await getArtifact<{ directions?: { title: string }[] }>(companyId, 'DIRECTIONS')
        for (const d of (dirs?.data?.directions ?? []).slice(0, 3)) {
          const clean = d.title.replace(/^\[[A-Z]{2}\]\s*/, '').trim()
          if (clean && !existing.has(clean)) { toAdd.push(clean); existing.add(clean) }
        }
      } catch { /* skip */ }
      // Dept bank fallback
      if (deptBank.length > 0 && toAdd.length < 3) {
        for (const s of deptBank.slice(0, 3 - toAdd.length)) {
          if (!existing.has(s)) { toAdd.push(s); existing.add(s) }
        }
      }
      if (toAdd.length === 0) {
        toast.error('لا يوجد بيانات سابقة أو المقترحات مضافة سلفاً.')
        return
      }
      setData((p) => ({
        products: [
          ...p.products,
          ...toAdd.map((name) => ({
            id: crypto.randomUUID(), name, marketShare: 30, marketGrowth: 30, revenue: 100_000,
          })),
        ],
      }))
      toast.success(`🧠 أُضيف ${toAdd.length} منتج/خدمة — عدّل الحصة والنمو والإيراد.`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر التوليد التلقائي'))
    } finally {
      setGenerating(false)
    }
  }

  // مخطط الفقاعات
  const scatter = data.products
    .filter((p) => p.name.trim())
    .map((p) => ({
      name: p.name, x: p.marketShare, y: p.marketGrowth,
      z: Math.max(50, Math.sqrt(p.revenue) * 2),
      fill: classify(p).colorHex,
    }))

  // العدّ لكل ربع
  const counts: Record<QuadrantKey, number> = { star: 0, cow: 0, question: 0, dog: 0 }
  const totalRevenue: Record<QuadrantKey, number> = { star: 0, cow: 0, question: 0, dog: 0 }
  for (const p of data.products) {
    const key = classify(p).key
    counts[key]++
    totalRevenue[key] += p.revenue
  }

  const filteredProducts = filter
    ? data.products.filter((p) => classify(p).key === filter)
    : data.products

  return (
    <>
      {/* بطاقات الأرباع — عدّ + إيراد + توصية + زر مسار */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(['star', 'cow', 'question', 'dog'] as QuadrantKey[]).map((k) => {
          const q = QUADRANTS[k]
          const active = filter === k
          return (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(active ? null : k)}
              className={`rounded-xl border p-3 text-right transition ${q.tintCls} ${
                active ? 'ring-2 ring-primary shadow-md' : 'hover:shadow'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={`flex items-center gap-2 font-bold ${q.headerCls}`}>
                  <span className="text-2xl">{q.icon}</span>
                  <span>{q.labelAr}</span>
                </div>
                <span className="rounded-full border bg-card px-2 py-0.5 text-xs font-bold tabular-nums">
                  {counts[k]}
                </span>
              </div>
              <div className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                {q.advice}
              </div>
              {counts[k] > 0 && (
                <div className="mt-2 text-[10px] text-muted-foreground">
                  إيراد إجمالي: <span className="tabular-nums font-medium text-foreground">{fmtSAR(totalRevenue[k])}</span>
                </div>
              )}
              {active && <div className="mt-2 text-[10px] text-primary">✓ مفلتَر — اضغط للإلغاء</div>}
            </button>
          )
        })}
      </div>

      {/* 🧠 توليد تلقائي + اقتراحات التخصّص */}
      <Card className="border-primary/30 bg-gradient-to-l from-primary/10 to-primary/5">
        <CardContent className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="text-3xl" aria-hidden>🧠</div>
            <div>
              <div className="text-sm font-bold">توليد تلقائي من التحليل السابق</div>
              <div className="text-xs text-muted-foreground">
                نقرأ أنشطة/قيمة/إيراد من BMC + عناوين الاتجاهات{specialty && ' + بنك تخصّصك'} — راجعها وعدّل.
              </div>
            </div>
          </div>
          <Button onClick={generateFromContext} disabled={generating || saving} size="lg">
            {generating ? 'جاري التوليد…' : '✨ ولّد منتجات/خدمات'}
          </Button>
        </CardContent>
      </Card>

      {/* رقائق مقترحة (بنك التخصّص) — للمدير المستقل */}
      {deptBank.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              💡 مقترحات جاهزة لتخصّصك
            </CardTitle>
            <CardDescription className="text-xs">
              اضغط لإضافتها كمنتج/خدمة — ثم عدّل الحصة والنمو والإيراد لتصنيفها.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {deptBank.map((s) => {
                const already = data.products.some((p) => p.name === s)
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addNamed(s)}
                    disabled={already}
                    className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                      already
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-primary/30 bg-card hover:bg-primary hover:text-primary-foreground'
                    }`}
                  >
                    {already ? '✓ ' : '＋ '}{s}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* المخطط الفقاعي */}
      <Card>
        <CardHeader>
          <CardTitle>المخطط الفقاعي</CardTitle>
          <CardDescription>
            حجم الفقاعة = الإيراد. المحور X = الحصة السوقية. المحور Y = نمو السوق.
            الخطّان المتقاطعان (50/50) يقسّمان الأرباع.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scatter.length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              أضف منتجاً وأعطه اسماً لظهوره هنا — أو اضغط «✨ ولّد» أعلاه.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={380}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" name="حصة سوقية" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} reversed />
                <YAxis type="number" dataKey="y" name="نمو السوق" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} />
                <ZAxis type="number" dataKey="z" range={[60, 400]} />
                <ReferenceLine x={50} stroke="hsl(220 5% 60%)" strokeDasharray="3 3" />
                <ReferenceLine y={50} stroke="hsl(220 5% 60%)" strokeDasharray="3 3" />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as typeof scatter[number]
                    return (
                      <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md">
                        <div className="font-semibold">{d.name}</div>
                        <div className="text-muted-foreground">حصة: {d.x}% · نمو: {d.y}%</div>
                      </div>
                    )
                  }}
                />
                <Scatter data={scatter} />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* قائمة المنتجات */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>المنتجات/الخدمات</CardTitle>
              <CardDescription>
                {filteredProducts.length}{filter ? ` من ${data.products.length}` : ''} —
                {filter ? ` مفلتَر: ${QUADRANTS[filter].labelAr}` : ' كل التصنيفات'}.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => add()}>+ منتج جديد</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredProducts.map((p) => {
            const c = classify(p)
            const cat: Category = categorize(p.name)
            const catMeta = CATEGORY_META[cat]
            return (
              <div key={p.id} className={`rounded-xl border bg-card p-3 ${p.name.trim() ? '' : 'border-dashed opacity-70'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xl" title={catMeta.labelAr}>{catMeta.icon}</span>
                  <Input
                    className="min-w-[180px] flex-1"
                    value={p.name}
                    onChange={(e) => update(p.id, { name: e.target.value })}
                    placeholder="اسم المنتج/الخدمة…"
                  />
                  <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${c.tintCls} ${c.headerCls}`}>
                    <span>{c.icon}</span>
                    <span>{c.labelAr}</span>
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => remove(p.id)} aria-label="حذف">×</Button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <SliderField label="حصة سوقية %" value={p.marketShare} onChange={(v) => update(p.id, { marketShare: v })} />
                  <SliderField label="نمو السوق %" value={p.marketGrowth} onChange={(v) => update(p.id, { marketGrowth: v })} />
                  <div className="text-xs">
                    <div className="mb-1 text-muted-foreground">الإيراد السنوي (SAR)</div>
                    <Input
                      type="number"
                      value={p.revenue}
                      onChange={(e) => update(p.id, { revenue: Number(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                {/* توصية عمل واضحة + رابط للأداة المطابقة */}
                {p.name.trim() && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-[11px]">
                    <span className="text-muted-foreground">💡 {c.advice}</span>
                    <Link to={c.actionTo} className="text-primary underline-offset-4 hover:underline">
                      {c.actionAr}
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
          {filteredProducts.length === 0 && data.products.length > 0 && (
            <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
              لا منتجات في «{filter && QUADRANTS[filter].labelAr}» — امسح الفلترة لعرض الكل.
            </p>
          )}
          {data.products.length === 0 && (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              لا منتجات بعد — اضغط «✨ ولّد» أعلاه أو «+ منتج جديد».
            </p>
          )}
          <div className="flex justify-between pt-1">
            <span className="self-center text-xs text-muted-foreground">
              💾 التصنيف يُحدَّث تلقائياً عند تغيير الحصة/النمو.
            </span>
            <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : `حفظ (${data.products.length})`}</Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

function SliderField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="text-xs">
      <div className="mb-1 flex justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  )
}

// نصّ حرّ → قائمة نظيفة (سطور أو فواصل). نُصفّر الفراغ ونحدّ ٦٠ حرف/بند.
function splitLines(raw: string): string[] {
  return raw
    .split(/[\n,،؛;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 60)
}

function fmtSAR(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M SAR`
  if (v >= 1_000)      return `${(v / 1_000).toFixed(0)}K SAR`
  return `${v} SAR`
}
