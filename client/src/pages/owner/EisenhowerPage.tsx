import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_LABEL, type DeptCode } from '@/lib/deptApi'
import { ONBOARDING_PAINS } from '@/lib/onboardingOptions'
import { getArtifact, listInitiatives, upsertArtifact } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

// ─── R6.4 — مصفوفة أيزنهاور (Urgent × Important) ────────────────────
// المصدر: ملف الاقتراح — «مصفوفة أيزنهاور تتغذّى من الآلام الـ٦».
// تُقسَم المهام على ٤ أرباع: افعل الآن، جدولها، فوّضها، احذفها.
// حفظ: StrategicArtifact بنوع EISENHOWER.

type Quadrant = 'do' | 'schedule' | 'delegate' | 'delete'

interface EisenhowerTask {
  id: string
  title: string
  quadrant: Quadrant
  linkedPain?: string // كود ألم من ONBOARDING_PAINS (اختياري).
}

interface EisenhowerData {
  tasks: EisenhowerTask[]
}

const EMPTY: EisenhowerData = { tasks: [] }

const QUADRANTS: Record<Quadrant, { title: string; subtitle: string; icon: string; tint: string }> = {
  do:       { title: 'افعل الآن',   subtitle: 'مهم + عاجل',        icon: '🔥', tint: 'bg-rose-50/50 border-rose-300' },
  schedule: { title: 'جدولها',      subtitle: 'مهم + غير عاجل',    icon: '📅', tint: 'bg-emerald-50/50 border-emerald-300' },
  delegate: { title: 'فوّضها',       subtitle: 'غير مهم + عاجل',    icon: '🤝', tint: 'bg-amber-50/50 border-amber-300' },
  delete:   { title: 'احذفها',      subtitle: 'غير مهم + غير عاجل', icon: '🗑️', tint: 'bg-muted/30 border-muted' },
}

export function EisenhowerPage() {
  return (
    <StrategicShell
      title="مصفوفة أيزنهاور"
      description="٢×٢ عاجل × مهم — لترتيب المهام حسب الأولوية الفعلية."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const user = useAuthStore((s) => s.user)
  const specialty = user?.specialtyDeptType ?? null
  const [data, setData] = useState<EisenhowerData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  // نتذكّر آخر دفعة مُولَّدة لدعم زر «↩️ تراجع».
  const [lastGeneratedIds, setLastGeneratedIds] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [quad, setQuad] = useState<Quadrant>('do')
  const [linkedPain, setLinkedPain] = useState('')

  useEffect(() => {
    getArtifact<EisenhowerData>(companyId, 'EISENHOWER').then((row) => {
      if (row?.data?.tasks) setData({ tasks: row.data.tasks })
    }).catch(() => undefined)
  }, [companyId])

  function addTask() {
    const v = title.trim()
    if (!v) return
    setData((p) => ({
      tasks: [
        ...p.tasks,
        { id: crypto.randomUUID(), title: v, quadrant: quad, linkedPain: linkedPain || undefined },
      ],
    }))
    setTitle('')
    setLinkedPain('')
  }

  function move(id: string, q: Quadrant) {
    setData((p) => ({ tasks: p.tasks.map((t) => (t.id === id ? { ...t, quadrant: q } : t)) }))
  }

  function remove(id: string) {
    setData((p) => ({ tasks: p.tasks.filter((t) => t.id !== id) }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'EISENHOWER', data)
      toast.success('تم حفظ المصفوفة')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  // 🧠 توليد من المبادرات — التصنيف بحسب المعنى الحقيقي لأيزنهاور:
  //   • critical → do        (عاجل ومهم — أزمة/مخاطر فوريّة)
  //   • high     → schedule  (مهم لكن غير عاجل — استراتيجي)
  //   • medium   → schedule  (مهم يستحقّ الجدولة، لا الحذف!)
  //   • low      → delegate  (يمكن تفويضه، لا حذفه بلا مراجعة)
  //   • ✕ لا نضع أيّاً منها في «احذفها» تلقائياً — الحذف قرار المدير الواعي.
  async function generateFromInitiatives() {
    setGenerating(true)
    try {
      const initiatives = await listInitiatives(companyId)
      if (initiatives.length === 0) {
        toast.error('لا مبادرات محفوظة — افتح /initiatives أوّلاً.')
        return
      }
      // مقارنة بلا تحسّس لحالة الأحرف/الفراغات → يمنع تكرار العناوين المتشابهة.
      const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
      const existing = new Set(data.tasks.map((t) => norm(t.title)))
      const priorityMap: Record<string, Quadrant> = {
        critical: 'do',
        high:     'schedule',
        medium:   'schedule',
        low:      'delegate',
      }
      const toAdd = initiatives
        .filter((i) => i.title && !existing.has(norm(i.title)))
        .slice(0, 16)
      if (toAdd.length === 0) {
        toast.message('كل المبادرات مضافة سلفاً — لا شيء جديد لتوليده.')
        return
      }
      const newTasks = toAdd.map((i) => ({
        id: crypto.randomUUID(),
        title: i.title,
        quadrant: priorityMap[i.priority] ?? 'schedule',
      }))
      setData((p) => ({ tasks: [...p.tasks, ...newTasks] }))
      setLastGeneratedIds(newTasks.map((t) => t.id))
      const counts: Record<Quadrant, number> = { do: 0, schedule: 0, delegate: 0, delete: 0 }
      for (const t of newTasks) counts[t.quadrant]++
      const parts: string[] = []
      if (counts.do)       parts.push(`${counts.do} افعل الآن`)
      if (counts.schedule) parts.push(`${counts.schedule} جدولها`)
      if (counts.delegate) parts.push(`${counts.delegate} فوّضها`)
      toast.success(`🧠 أُضيف ${newTasks.length} مهمة (${parts.join(' · ')}) — يمكنك التراجع.`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر التوليد التلقائي'))
    } finally {
      setGenerating(false)
    }
  }

  // ↩️ تراجع عن التوليد الأخير — يحذف فقط الدفعة الأخيرة.
  function undoLastGenerate() {
    if (lastGeneratedIds.length === 0) {
      toast.message('لا توجد دفعة توليد لتراجع عنها.')
      return
    }
    const idsToRemove = new Set(lastGeneratedIds)
    setData((p) => ({ tasks: p.tasks.filter((t) => !idsToRemove.has(t.id)) }))
    setLastGeneratedIds([])
    toast.success('تراجعنا عن آخر توليد.')
  }

  // 🗑️ مسح كل المهام
  function clearAll() {
    if (data.tasks.length === 0) return
    if (!confirm(`مسح كل ${data.tasks.length} مهمة؟ لا يمكن التراجع.`)) return
    setData(EMPTY)
    setLastGeneratedIds([])
    toast.success('تمّ المسح.')
  }

  // مسح مهام ربع واحد
  function clearQuadrant(q: Quadrant) {
    const count = data.tasks.filter((t) => t.quadrant === q).length
    if (count === 0) return
    if (!confirm(`مسح ${count} مهمة من «${QUADRANTS[q].title}»؟`)) return
    setData((p) => ({ tasks: p.tasks.filter((t) => t.quadrant !== q) }))
  }

  const userPains = user?.pains ?? []
  const suggestedPains = ONBOARDING_PAINS.filter((p) => userPains.includes(p.code))

  return (
    <>
      {/* بطاقة تعريف */}
      <Card className="border-primary/20 bg-gradient-to-l from-primary/5 to-transparent">
        <CardContent className="p-4 text-xs leading-relaxed">
          <div className="flex items-start gap-3">
            <div className="text-2xl leading-none">🎯</div>
            <div className="flex-1">
              <div className="text-sm font-bold text-foreground">ما هي مصفوفة أيزنهاور؟</div>
              <p className="mt-1 text-muted-foreground">
                أداة لترتيب المهام بحسب <b className="text-foreground">العاجل × المهم</b> — تُظهر
                لك أين تُنفق وقتك:
                <b className="text-rose-700"> 🔥 افعل الآن</b> (مهم+عاجل — الأزمات) ·
                <b className="text-emerald-700"> 📅 جدولها</b> (مهم+غير عاجل — الاستراتيجي) ·
                <b className="text-amber-700"> 🤝 فوّضها</b> (غير مهم+عاجل — التشتيت) ·
                <b className="text-slate-600"> 🗑️ احذفها</b> (غير مهم+غير عاجل — الضياع).
              </p>
              <p className="mt-1 text-muted-foreground">
                <b className="text-foreground">القيمة الحقيقية</b> في الربع الأخضر «جدولها» — هناك الاستراتيجية تحدث.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* شارة سياق المدير المستقل */}
      {specialty && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3 p-3 text-xs">
            <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
              🎯 السياق: إدارة {DEPT_LABEL[specialty as DeptCode]}
            </span>
            <span className="text-muted-foreground">
              يمكنك توليد المهام من المبادرات — أولويتها تحدّد الربع تلقائياً.
            </span>
          </CardContent>
        </Card>
      )}

      {/* 🧠 توليد من المبادرات + أزرار تحكّم */}
      <Card className="border-primary/40 bg-gradient-to-l from-primary/15 to-primary/5">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="text-3xl" aria-hidden>🧠</div>
            <div>
              <div className="text-sm font-bold">توليد المهام من المبادرات</div>
              <div className="text-xs text-muted-foreground">
                الأولوية → الربع: <b className="text-foreground">حرجة</b> → افعل الآن ·
                <b className="text-foreground"> عالية/متوسطة</b> → جدولها · <b className="text-foreground">منخفضة</b> → فوّضها.
                لا شيء يُوضع في «احذفها» تلقائياً — الحذف قرارك.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {lastGeneratedIds.length > 0 && (
              <Button variant="outline" onClick={undoLastGenerate} size="sm">
                ↩️ تراجع عن التوليد
              </Button>
            )}
            {data.tasks.length > 0 && (
              <Button variant="outline" onClick={clearAll} size="sm">
                🗑️ مسح الكل
              </Button>
            )}
            <Button onClick={generateFromInitiatives} disabled={generating || saving} size="lg">
              {generating ? 'جاري…' : '✨ ولّد الآن'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* R4-derived — اقتراحات آلية من user.pains */}
      {suggestedPains.length > 0 && data.tasks.length === 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">💡 آلامك من التسجيل — تحويلها إلى مهام أولوية</CardTitle>
            <CardDescription>اضغط أي ألم لإضافته كمهمة في «افعل الآن».</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {suggestedPains.map((p) => (
              <button
                key={p.code}
                type="button"
                onClick={() => setData((prev) => ({
                  tasks: [...prev.tasks, {
                    id: crypto.randomUUID(),
                    title: `معالجة: ${p.labelAr}`,
                    quadrant: 'do',
                    linkedPain: p.code,
                  }],
                }))}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs hover:bg-primary hover:text-primary-foreground"
              >
                <span aria-hidden>{p.icon}</span>
                {p.labelAr}
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle>مهمة جديدة</CardTitle>
            <CardDescription>{data.tasks.length} مهمة موزّعة.</CardDescription>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? 'جاري الحفظ…' : 'حفظ'}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Input
              className="flex-1 min-w-[200px]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTask())}
              placeholder="اكتب مهمة…"
            />
            <select
              className="rounded-md border bg-background px-3 text-sm"
              value={quad}
              onChange={(e) => setQuad(e.target.value as Quadrant)}
            >
              {(Object.keys(QUADRANTS) as Quadrant[]).map((q) => (
                <option key={q} value={q}>{QUADRANTS[q].icon} {QUADRANTS[q].title}</option>
              ))}
            </select>
            {userPains.length > 0 && (
              <select
                className="rounded-md border bg-background px-3 text-sm"
                value={linkedPain}
                onChange={(e) => setLinkedPain(e.target.value)}
              >
                <option value="">ألم مرتبط (اختياري)…</option>
                {suggestedPains.map((p) => (
                  <option key={p.code} value={p.code}>{p.icon} {p.labelAr}</option>
                ))}
              </select>
            )}
            <Button variant="outline" onClick={addTask}>+ إضافة</Button>
          </div>
        </CardContent>
      </Card>

      {/* 🎯 الخطوة التالية — عندما توجد مهام في «جدولها» أو «افعل الآن» */}
      {data.tasks.filter((t) => t.quadrant === 'do' || t.quadrant === 'schedule').length > 0 && (
        <Card className="border-emerald-300 bg-emerald-50/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="flex items-start gap-3">
              <div className="text-2xl">📅</div>
              <div>
                <div className="text-sm font-bold text-emerald-900">
                  الخطوة التالية: خطّط الجدول الزمني في جانت
                </div>
                <div className="text-xs text-emerald-800/80">
                  المهام في «افعل الآن» و«جدولها» تحتاج تواريخ بداية ونهاية — ضعها في مخطّط جانت.
                </div>
              </div>
            </div>
            <Link to="/gantt-chart" className={buttonVariants({ variant: 'default' })}>
              افتح مخطّط جانت ←
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {(Object.keys(QUADRANTS) as Quadrant[]).map((q) => {
          const meta = QUADRANTS[q]
          const tasks = data.tasks.filter((t) => t.quadrant === q)
          return (
            <Card key={q} className={meta.tint}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span aria-hidden>{meta.icon}</span>
                  {meta.title}
                  <span className="text-xs font-normal text-muted-foreground">· {meta.subtitle}</span>
                  <span className="mr-auto rounded-full bg-card px-2 py-0.5 text-xs tabular-nums">
                    {tasks.length}
                  </span>
                  {tasks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => clearQuadrant(q)}
                      className="rounded-md border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-rose-100 hover:text-rose-700"
                      title={`مسح ${tasks.length} مهمة من هذا الربع`}
                    >
                      🗑️ مسح
                    </button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {tasks.length === 0 && (
                  <p className="text-xs text-muted-foreground/70">لا مهام هنا.</p>
                )}
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 rounded-md border bg-card/80 p-2 text-sm"
                  >
                    <span className="flex-1">{t.title}</span>
                    {t.linkedPain && (
                      <span
                        className="text-xs text-muted-foreground"
                        title={ONBOARDING_PAINS.find((p) => p.code === t.linkedPain)?.labelAr}
                      >
                        {ONBOARDING_PAINS.find((p) => p.code === t.linkedPain)?.icon}
                      </span>
                    )}
                    <select
                      value={t.quadrant}
                      onChange={(e) => move(t.id, e.target.value as Quadrant)}
                      className="rounded border bg-background px-1 text-xs"
                    >
                      {(Object.keys(QUADRANTS) as Quadrant[]).map((qq) => (
                        <option key={qq} value={qq}>{QUADRANTS[qq].icon}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => remove(t.id)}
                      className="text-xs text-muted-foreground hover:text-rose-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}
