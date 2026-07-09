import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api'
import { ONBOARDING_PAINS } from '@/lib/onboardingOptions'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'
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
  const [data, setData] = useState<EisenhowerData>(EMPTY)
  const [saving, setSaving] = useState(false)
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

  const userPains = user?.pains ?? []
  const suggestedPains = ONBOARDING_PAINS.filter((p) => userPains.includes(p.code))

  return (
    <>
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
                  <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs tabular-nums">
                    {tasks.length}
                  </span>
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
