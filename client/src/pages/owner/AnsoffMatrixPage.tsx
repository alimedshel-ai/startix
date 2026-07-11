import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { OpexHint } from '@/components/OpexHint'
import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useCompany } from '@/hooks/useCompany'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_LABEL, type DeptCode } from '@/lib/deptApi'
import { ANSOFF_DEPT_QUADRANTS, DEPT_ANSOFF_SUGGESTIONS, type AnsoffQuadrant } from '@/lib/deptAnsoff'
import { getArtifact, getSWOT, upsertArtifact, type ArtifactType } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

type Quadrant = AnsoffQuadrant

interface Initiative {
  id: string
  title: string
  quadrant: Quadrant
}

interface AnsoffData {
  initiatives: Initiative[]
}

const EMPTY: AnsoffData = { initiatives: [] }

// المصفوفة الكلاسيكية (شركة) — منتج × سوق. تُستخدم للـ OWNER و INTERNAL manager.
const CLASSIC_QUADRANTS: Record<Quadrant, { title: string; subtitle: string; risk: string; icon: string; tint: string }> = {
  marketPenetration:  { title: 'اختراق السوق',     subtitle: 'منتج حالي · سوق حالي',  risk: 'مخاطرة منخفضة', icon: '🎯', tint: 'border-emerald-300 bg-emerald-50/60' },
  productDevelopment: { title: 'تطوير المنتج',     subtitle: 'منتج جديد · سوق حالي',  risk: 'مخاطرة متوسطة', icon: '🛠️', tint: 'border-sky-300 bg-sky-50/60' },
  marketDevelopment:  { title: 'تطوير السوق',      subtitle: 'منتج حالي · سوق جديد',  risk: 'مخاطرة متوسطة', icon: '🌍', tint: 'border-amber-300 bg-amber-50/60' },
  diversification:    { title: 'التنويع',          subtitle: 'منتج جديد · سوق جديد',  risk: 'مخاطرة عالية',  icon: '🚀', tint: 'border-rose-300 bg-rose-50/60' },
}

export function AnsoffMatrixPage() {
  const user = useAuthStore((s) => s.user)
  const isDeptScoped =
    user?.userType === 'MANAGER' &&
    user?.managerType === 'INDEPENDENT_PRO' &&
    user?.specialtyDeptType != null &&
    DEPT_ANSOFF_SUGGESTIONS[user.specialtyDeptType] != null
  const specialty = user?.specialtyDeptType ?? null
  const title = isDeptScoped
    ? `مصفوفة أنسوف — ${DEPT_LABEL[specialty as DeptCode]}`
    : 'مصفوفة أنسوف'
  const description = isDeptScoped
    ? '٢×٢ مُعادة التفسير لإدارتك: خدمة × جمهور — أين تنمو؟ داخل نطاقك أم توسّعاً لجهات جديدة؟'
    : '2×2 منتج × سوق: اختراق السوق، تطوير المنتج، تطوير السوق، التنويع.'
  return (
    <StrategicShell title={title} description={description}>
      {(companyId) =>
        isDeptScoped
          ? <DeptEditor companyId={companyId} specialty={specialty as DeptCode} />
          : <ClassicEditor companyId={companyId} />
      }
    </StrategicShell>
  )
}

// ─── الكلاسيكي (شركة كاملة) — كما كان ────────────────────────────
function ClassicEditor({ companyId }: { companyId: string }) {
  const { company } = useCompany()
  const [data, setData] = useState<AnsoffData>(EMPTY)
  const [title, setTitle] = useState('')
  const [quad, setQuad] = useState<Quadrant>('marketPenetration')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getArtifact<AnsoffData>(companyId, 'ANSOFF').then((row) => {
      if (row?.data?.initiatives) setData({ initiatives: row.data.initiatives })
    }).catch(() => undefined)
  }, [companyId])

  function add() {
    const v = title.trim()
    if (!v) return
    setData((p) => ({ initiatives: [...p.initiatives, { id: crypto.randomUUID(), title: v, quadrant: quad }] }))
    setTitle('')
  }
  function move(id: string, q: Quadrant) {
    setData((p) => ({ initiatives: p.initiatives.map((i) => (i.id === id ? { ...i, quadrant: q } : i)) }))
  }
  function remove(id: string) {
    setData((p) => ({ initiatives: p.initiatives.filter((i) => i.id !== id) }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'ANSOFF', data)
      toast.success('تم حفظ مصفوفة أنسوف')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  const byQuad = (q: Quadrant) => data.initiatives.filter((i) => i.quadrant === q)

  return (
    <>
      <OpexHint opex={company?.opex} focus={['target', 'budget']} title="أهدف النمو والميزانية يوجّهان اختيار الربع" />

      <Card>
        <CardHeader>
          <CardTitle>إضافة مبادرة نمو</CardTitle>
          <CardDescription>{data.initiatives.length} مبادرة موزّعة.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Input
              className="flex-1 min-w-[220px]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
              placeholder="مثال: توسع لمدن جديدة، إطلاق نسخة Pro…"
            />
            <select
              className="rounded-md border bg-background px-3 text-sm"
              value={quad}
              onChange={(e) => setQuad(e.target.value as Quadrant)}
            >
              {(Object.keys(CLASSIC_QUADRANTS) as Quadrant[]).map((q) => (
                <option key={q} value={q}>{CLASSIC_QUADRANTS[q].title}</option>
              ))}
            </select>
            <Button onClick={add}>إضافة</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>المصفوفة 2×2</CardTitle>
          <CardDescription>الصف العلوي = سوق حالي. الصف السفلي = سوق جديد.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[100px_1fr_1fr] gap-2 text-sm">
            <div />
            <div className="text-center text-xs font-semibold text-muted-foreground">منتج حالي</div>
            <div className="text-center text-xs font-semibold text-muted-foreground">منتج جديد</div>

            <div className="flex items-center justify-center text-xs font-semibold text-muted-foreground">سوق حالي</div>
            <ClassicQuadrantBox q="marketPenetration" items={byQuad('marketPenetration')} onMove={move} onRemove={remove} />
            <ClassicQuadrantBox q="productDevelopment" items={byQuad('productDevelopment')} onMove={move} onRemove={remove} />

            <div className="flex items-center justify-center text-xs font-semibold text-muted-foreground">سوق جديد</div>
            <ClassicQuadrantBox q="marketDevelopment" items={byQuad('marketDevelopment')} onMove={move} onRemove={remove} />
            <ClassicQuadrantBox q="diversification" items={byQuad('diversification')} onMove={move} onRemove={remove} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ المصفوفة'}</Button>
      </div>
    </>
  )
}

function ClassicQuadrantBox({
  q, items, onMove, onRemove,
}: {
  q: Quadrant
  items: Initiative[]
  onMove: (id: string, q: Quadrant) => void
  onRemove: (id: string) => void
}) {
  const meta = CLASSIC_QUADRANTS[q]
  return (
    <div className={`rounded-xl border p-3 ${meta.tint}`}>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 font-semibold">
          <span>{meta.icon}</span>
          {meta.title}
        </span>
        <span className="rounded-md bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">{meta.risk}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs">
            <span className="flex-1">{i.title}</span>
            <select
              className="rounded-md border bg-background px-1 py-0.5 text-[10px]"
              value={i.quadrant}
              onChange={(e) => onMove(i.id, e.target.value as Quadrant)}
            >
              {(Object.keys(CLASSIC_QUADRANTS) as Quadrant[]).map((qk) => (
                <option key={qk} value={qk}>{CLASSIC_QUADRANTS[qk].title}</option>
              ))}
            </select>
            <button onClick={() => onRemove(i.id)} className="text-muted-foreground hover:text-destructive">×</button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="rounded-md border border-dashed p-2 text-center text-[10px] text-muted-foreground">
            لا توجد مبادرات
          </li>
        )}
      </ul>
    </div>
  )
}

// ─── DeptEditor (INDEPENDENT_PRO) — مُعاد التفسير لسياق الإدارة ──
function DeptEditor({ companyId, specialty }: { companyId: string; specialty: DeptCode }) {
  const artifactType: ArtifactType = `ANSOFF_${specialty}`
  const bank = DEPT_ANSOFF_SUGGESTIONS[specialty]
  const [data, setData] = useState<AnsoffData>(EMPTY)
  const [title, setTitle] = useState('')
  const [quad, setQuad] = useState<Quadrant>('marketPenetration')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    getArtifact<AnsoffData>(companyId, artifactType).then((row) => {
      if (row?.data?.initiatives) setData({ initiatives: row.data.initiatives })
    }).catch(() => undefined)
  }, [companyId, artifactType])

  function add(newTitle: string, targetQuad: Quadrant) {
    const t = newTitle.trim()
    if (!t) return false
    if (data.initiatives.some((i) => i.title === t)) return false
    setData((p) => ({
      initiatives: [...p.initiatives, { id: crypto.randomUUID(), title: t, quadrant: targetQuad }],
    }))
    return true
  }
  function addFromInput() {
    if (add(title, quad)) setTitle('')
  }
  function move(id: string, q: Quadrant) {
    setData((p) => ({ initiatives: p.initiatives.map((i) => (i.id === id ? { ...i, quadrant: q } : i)) }))
  }
  function remove(id: string) {
    setData((p) => ({ initiatives: p.initiatives.filter((i) => i.id !== id) }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, artifactType, data)
      toast.success('تم حفظ أنسوف')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  // 🧠 توليد تلقائي من التحليل السابق:
  //   1) عناوين الاتجاهات (DIRECTIONS) → تصنيف تلقائي بحسب الكلمات المفتاحية
  //   2) عناصر الآفاق الثلاثة (THREE_HORIZONS_<DEPT>) → H1→penetration، H2→productDev، H3→diversification
  //   3) فرص SWOT → marketDevelopment أو diversification
  //   4) بنك التخصّص → ملء الأرباع الفارغة
  async function generateFromContext() {
    setGenerating(true)
    try {
      const existing = new Set(data.initiatives.map((i) => i.title.trim()))
      const toAdd: { title: string; quadrant: Quadrant; source: string }[] = []

      // 1) الاتجاهات (Directions)
      try {
        const dirs = await getArtifact<{ directions?: { title: string; description?: string }[] }>(companyId, 'DIRECTIONS')
        for (const d of (dirs?.data?.directions ?? []).slice(0, 4)) {
          const clean = d.title.replace(/^\[[A-Z]{2}\]\s*/, '').trim()
          if (!clean || existing.has(clean)) continue
          const q = classifyText(clean + ' ' + (d.description ?? ''))
          toAdd.push({ title: clean, quadrant: q, source: 'الاتجاهات' })
          existing.add(clean)
        }
      } catch { /* skip */ }

      // 2) الآفاق الثلاثة
      try {
        const th = await getArtifact<{ initiatives?: { title: string; horizon: 'h1' | 'h2' | 'h3' }[] }>(companyId, `THREE_HORIZONS_${specialty}`)
        for (const i of (th?.data?.initiatives ?? []).slice(0, 4)) {
          if (existing.has(i.title.trim())) continue
          const q: Quadrant = i.horizon === 'h1' ? 'marketPenetration'
            : i.horizon === 'h2' ? 'productDevelopment'
            : 'diversification'
          toAdd.push({ title: i.title.trim(), quadrant: q, source: 'الآفاق الثلاثة' })
          existing.add(i.title.trim())
        }
      } catch { /* skip */ }

      // 3) فرص SWOT → marketDevelopment
      try {
        const swot = await getSWOT(companyId)
        for (const o of (swot?.opportunities ?? []).slice(0, 2)) {
          const short = o.length > 60 ? o.slice(0, 60) + '…' : o
          const t = `اقتناص: ${short}`
          if (existing.has(t)) continue
          toAdd.push({ title: t, quadrant: 'marketDevelopment', source: 'فرص SWOT' })
          existing.add(t)
        }
      } catch { /* skip */ }

      // 4) ملء الأرباع الفارغة من بنك التخصّص
      const currentCounts: Record<Quadrant, number> = {
        marketPenetration: 0, productDevelopment: 0,
        marketDevelopment: 0, diversification: 0,
      }
      for (const i of data.initiatives) currentCounts[i.quadrant]++
      for (const a of toAdd) currentCounts[a.quadrant]++
      for (const q of Object.keys(bank) as Quadrant[]) {
        if (currentCounts[q] === 0) {
          const suggestion = bank[q][0]
          if (suggestion && !existing.has(suggestion)) {
            toAdd.push({ title: suggestion, quadrant: q, source: 'بنك التخصّص' })
            existing.add(suggestion)
          }
        }
      }

      if (toAdd.length === 0) {
        toast.error('لا يوجد بيانات سابقة أو المقترحات مضافة سلفاً.')
        return
      }
      setData((p) => ({
        initiatives: [
          ...p.initiatives,
          ...toAdd.map((a) => ({
            id: crypto.randomUUID(),
            title: a.title,
            quadrant: a.quadrant,
          })),
        ],
      }))
      const sourceSummary = countSources(toAdd)
      toast.success(`🧠 أُضيف ${toAdd.length} مبادرة: ${sourceSummary}`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر التوليد التلقائي'))
    } finally {
      setGenerating(false)
    }
  }

  const byQuad = (q: Quadrant) => data.initiatives.filter((i) => i.quadrant === q)

  return (
    <>
      {/* شارة السياق — يوضّح أن الأرباع لإدارتك، ليس للشركة */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-wrap items-center gap-3 p-3 text-xs">
          <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
            🎯 السياق: إدارة {DEPT_LABEL[specialty]} فقط
          </span>
          <span className="text-muted-foreground">
            الأرباع مُعادة التفسير: «خدمة × جمهور» بدل «منتج × سوق» — نمو إدارتك عبر تعميق خدماتها أو توسيعها لجهات جديدة.
          </span>
        </CardContent>
      </Card>

      {/* 🧠 توليد تلقائي */}
      <Card className="border-primary/40 bg-gradient-to-l from-primary/15 to-primary/5">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="text-3xl" aria-hidden>🧠</div>
            <div>
              <div className="text-sm font-bold">توليد تلقائي من التحليل السابق</div>
              <div className="text-xs text-muted-foreground">
                نجلب من: الاتجاهات + الآفاق الثلاثة + فرص SWOT + بنك تخصّصك — ونصنّفها في الأرباع المناسبة.
              </div>
            </div>
          </div>
          <Button onClick={generateFromContext} disabled={generating || saving} size="lg">
            {generating ? 'جاري التوليد…' : '✨ ولّد الآن'}
          </Button>
        </CardContent>
      </Card>

      {/* إضافة يدوية */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">إضافة مبادرة يدوية</CardTitle>
          <CardDescription>
            {data.initiatives.length} مبادرة موزّعة عبر الأرباع الأربعة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Input
              className="flex-1 min-w-[220px]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFromInput())}
              placeholder="اكتب مبادرة مخصّصة لإدارتك…"
            />
            <select
              className="rounded-md border bg-background px-3 text-sm"
              value={quad}
              onChange={(e) => setQuad(e.target.value as Quadrant)}
            >
              {(Object.keys(ANSOFF_DEPT_QUADRANTS) as Quadrant[]).map((q) => (
                <option key={q} value={q}>{ANSOFF_DEPT_QUADRANTS[q].labelAr}</option>
              ))}
            </select>
            <Button onClick={addFromInput}>＋ إضافة</Button>
          </div>
        </CardContent>
      </Card>

      {/* المصفوفة ٢×٢ بعناوين مُعادة التفسير */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">مصفوفة أنسوف لإدارتك</CardTitle>
          <CardDescription>
            الصف العلوي = جمهور حالي (نفس الشركة). الصف السفلي = جمهور جديد (شركات/جهات أخرى).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[120px_1fr_1fr] gap-2 text-sm">
            <div />
            <div className="text-center text-xs font-semibold text-muted-foreground">خدمة حالية</div>
            <div className="text-center text-xs font-semibold text-muted-foreground">خدمة جديدة</div>

            <div className="flex items-center justify-center text-center text-xs font-semibold text-muted-foreground">
              جمهور حالي<br/><span className="text-[9px] font-normal">(داخل الشركة)</span>
            </div>
            <DeptQuadrantBox q="marketPenetration"  items={byQuad('marketPenetration')}  bank={bank} data={data} onMove={move} onRemove={remove} onAddSuggestion={add} />
            <DeptQuadrantBox q="productDevelopment" items={byQuad('productDevelopment')} bank={bank} data={data} onMove={move} onRemove={remove} onAddSuggestion={add} />

            <div className="flex items-center justify-center text-center text-xs font-semibold text-muted-foreground">
              جمهور جديد<br/><span className="text-[9px] font-normal">(شركات/جهات أخرى)</span>
            </div>
            <DeptQuadrantBox q="marketDevelopment"  items={byQuad('marketDevelopment')}  bank={bank} data={data} onMove={move} onRemove={remove} onAddSuggestion={add} />
            <DeptQuadrantBox q="diversification"    items={byQuad('diversification')}    bank={bank} data={data} onMove={move} onRemove={remove} onAddSuggestion={add} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || generating}>
          {saving ? 'جاري الحفظ…' : `حفظ (${data.initiatives.length} مبادرة)`}
        </Button>
      </div>
    </>
  )
}

function DeptQuadrantBox({
  q, items, bank, data, onMove, onRemove, onAddSuggestion,
}: {
  q: Quadrant
  items: Initiative[]
  bank: Record<Quadrant, string[]>
  data: AnsoffData
  onMove: (id: string, q: Quadrant) => void
  onRemove: (id: string) => void
  onAddSuggestion: (title: string, q: Quadrant) => boolean
}) {
  const meta = ANSOFF_DEPT_QUADRANTS[q]
  const suggestions = bank[q]
  return (
    <div className={`rounded-xl border p-3 ${meta.tint}`}>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 font-bold">
          <span className="text-lg">{meta.icon}</span>
          {meta.labelAr}
        </span>
        <span className="rounded-md bg-card px-1.5 py-0.5 text-[9px] font-medium">{meta.riskAr}</span>
      </div>
      <div className="mb-2 text-[10px] leading-relaxed text-muted-foreground">
        {meta.subtitleAr}
      </div>

      {/* رقائق مقترحات — نقرة تُضيف الاقتراح كمبادرة */}
      {suggestions.length > 0 && (
        <div className="mb-2 rounded-md border border-dashed bg-card/50 p-1.5">
          <div className="mb-1 text-[9px] uppercase tracking-wider text-muted-foreground">💡 مقترحات لتخصّصك:</div>
          <div className="flex flex-wrap gap-1">
            {suggestions.map((s) => {
              const already = data.initiatives.some((i) => i.title === s)
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onAddSuggestion(s, q)}
                  disabled={already}
                  className={`rounded-full border px-2 py-0.5 text-[9px] transition ${
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
        </div>
      )}

      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs">
            <span className="flex-1">{i.title}</span>
            <select
              className="rounded-md border bg-background px-1 py-0.5 text-[10px]"
              value={i.quadrant}
              onChange={(e) => onMove(i.id, e.target.value as Quadrant)}
            >
              {(Object.keys(ANSOFF_DEPT_QUADRANTS) as Quadrant[]).map((qk) => (
                <option key={qk} value={qk}>{ANSOFF_DEPT_QUADRANTS[qk].labelAr.split(' ')[0]}</option>
              ))}
            </select>
            <button onClick={() => onRemove(i.id)} className="text-muted-foreground hover:text-destructive">×</button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="rounded-md border border-dashed p-2 text-center text-[10px] text-muted-foreground">
            لا مبادرات — اضغط اقتراحاً أعلاه أو استخدم «إضافة يدوية».
          </li>
        )}
      </ul>
    </div>
  )
}

// ─── تصنيف نصّي مبسّط — يقرّر ربع أنسوف بحسب الكلمات المفتاحية ───
function classifyText(text: string): Quadrant {
  const t = text.toLowerCase()
  // جديد + جديد = تنويع
  if (/جديد.*جديد|تنويع|منتج جديد.*سوق جديد/.test(t)) return 'diversification'
  // توسع جغرافي / جمهور جديد
  if (/توسع|توسّع|فرع|مدن|منطقة|سوق جديد|قطاع جديد|جمهور جديد|شركاء|تحالف/.test(t)) return 'marketDevelopment'
  // خدمة/منتج جديد
  if (/جديد|إطلاق|منتج|خدمة|نسخة|version|pro|premium|ابتكار|تطوير/.test(t)) return 'productDevelopment'
  // افتراضي: اختراق (تعميق الحالي)
  return 'marketPenetration'
}

// ملخّص المصادر — «٣ من الاتجاهات + ٢ من SWOT»
function countSources(items: { source: string }[]): string {
  const counts: Record<string, number> = {}
  for (const i of items) counts[i.source] = (counts[i.source] ?? 0) + 1
  return Object.entries(counts).map(([src, n]) => `${n} من ${src}`).join(' + ')
}
