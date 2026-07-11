import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { NextStepCard } from '@/components/strategic/NextStepCard'
import { StageBanner } from '@/components/strategic/StageBanner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useClientScopedCompany } from '@/hooks/useClientScopedCompany'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_ICON, DEPT_LABEL } from '@/lib/deptApi'
import { DEPT_PESTEL_SUGGESTIONS, PESTEL_AXES, type PESTELAxis } from '@/lib/deptPESTEL'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

// ─── PESTEL على مستوى إدارة العميل — منهجية القديم ────────────────────
// مصدر: stratix legacy — pestel.html (per-dept PESTEL with tailored
// suggestions). يحفظ الإجابات كـ StrategicArtifact بنوع
// `PESTEL_<DEPT>`. المدير الخبير ينقر مقترحاً → يُضاف إلى textarea
// تلقائياً، أو يكتب حراً.

interface PESTELData {
  political: string
  economic: string
  social: string
  technological: string
  environmental: string
  legal: string
}

function emptyData(): PESTELData {
  return {
    political: '', economic: '', social: '', technological: '', environmental: '', legal: '',
  }
}

export function DeptPESTELPage() {
  const user = useAuthStore((s) => s.user)
  const scope = useClientScopedCompany()
  const specialty = user?.specialtyDeptType ?? null
  const [data, setData] = useState<PESTELData>(emptyData)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  // نحفظ حالة ما قبل التوليد الأخير لتمكين زر «↩️ تراجع».
  const [preGenSnapshot, setPreGenSnapshot] = useState<PESTELData | null>(null)

  useEffect(() => {
    if (!scope.company || !specialty) return
    let alive = true
    setLoading(true)
    setData(emptyData())
    setSavedAt(null)
    ;(async () => {
      try {
        const artifact = await getArtifact<PESTELData>(scope.company!.id, `PESTEL_${specialty}`)
        if (!alive) return
        if (artifact?.data) {
          setData({ ...emptyData(), ...(artifact.data as Partial<PESTELData>) })
          setSavedAt(artifact.updatedAt)
        }
      } catch (err) {
        if (alive) toast.error(apiErrorMessage(err, 'تعذّر تحميل PESTEL السابق'))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [scope.company, specialty])

  function addSuggestion(axis: PESTELAxis, suggestion: string) {
    setData((prev) => {
      const current = prev[axis].trim()
      if (current.includes(suggestion)) return prev
      const separator = current ? '\n• ' : '• '
      return { ...prev, [axis]: current + separator + suggestion }
    })
  }

  // ✕ حذف مقترح مضاف من النص — يبحث ويحذف السطر الذي يبدأ به.
  function removeSuggestion(axis: PESTELAxis, suggestion: string) {
    setData((prev) => {
      const lines = prev[axis].split('\n')
      const filtered = lines.filter((l) => {
        const clean = l.replace(/^[•\-·]\s*/, '').trim()
        return clean !== suggestion.trim()
      })
      return { ...prev, [axis]: filtered.join('\n').trim() }
    })
  }

  // 🗑️ مسح محور كامل
  function clearAxis(axis: PESTELAxis) {
    const current = data[axis].trim()
    if (!current) return
    const lineCount = current.split('\n').filter(Boolean).length
    if (!confirm(`مسح ${lineCount} عنصر من محور «${PESTEL_AXES.find((a) => a.key === axis)?.labelAr}»؟`)) return
    setData((prev) => ({ ...prev, [axis]: '' }))
  }

  // 🗑️ مسح الكلّ
  function clearAll() {
    const total = PESTEL_AXES.reduce((sum, a) => sum + data[a.key].split('\n').filter((l) => l.trim()).length, 0)
    if (total === 0) return
    if (!confirm(`مسح جميع الـ${total} عنصر عبر المحاور الستة؟ لا يمكن التراجع بعد الحفظ.`)) return
    setData(emptyData())
    setPreGenSnapshot(null)
  }

  // ↩️ تراجع عن التوليد الأخير — يستعيد اللقطة قبل التوليد.
  function undoLastGenerate() {
    if (!preGenSnapshot) return
    setData(preGenSnapshot)
    setPreGenSnapshot(null)
    toast.success('تراجعنا عن آخر توليد — استعدنا حالة ما قبله.')
  }

  // ─── 🧠 توليد تلقائي — يُضيف كل المقترحات مرّة واحدة ─────────────
  function generateAll() {
    if (!specialty) return
    const suggestions = DEPT_PESTEL_SUGGESTIONS[specialty]
    // حفظ لقطة قبل التغيير لدعم التراجع.
    setPreGenSnapshot({ ...data })
    setData((prev) => {
      const next = { ...prev }
      let added = 0
      for (const axis of PESTEL_AXES) {
        const bank = suggestions[axis.key]
        const current = next[axis.key].trim()
        const lines: string[] = []
        for (const sug of bank) {
          if (!current.includes(sug)) {
            lines.push(sug)
            added++
          }
        }
        if (lines.length > 0) {
          const separator = current ? '\n• ' : '• '
          next[axis.key] = current + separator + lines.join('\n• ')
        }
      }
      if (added === 0) {
        toast.error('كل المقترحات موجودة سلفاً.')
        setPreGenSnapshot(null)
      }
      else toast.success(`🧠 أُضيف ${added} عنصراً — يمكنك التراجع أو تعديل ما يلزم.`)
      return next
    })
  }

  async function save() {
    if (!scope.company || !specialty) return
    const filled = PESTEL_AXES.filter((a) => data[a.key].trim().length > 0).length
    if (filled === 0) {
      toast.error('اكتب عاملاً واحداً على الأقل قبل الحفظ.')
      return
    }
    setSaving(true)
    try {
      const saved = await upsertArtifact<PESTELData>(
        scope.company.id, `PESTEL_${specialty}`, data
      )
      setSavedAt(saved.updatedAt)
      toast.success(`تم حفظ PESTEL — ${filled} من ٦ عوامل مُدخَلة`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  // حالات فشل
  if (!specialty) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="PESTEL" />
        <EmptyState title="لا يوجد تخصّص محدّد" description="حدّث تخصّصك من إعدادات الحساب." />
      </div>
    )
  }
  if (scope.loading || loading) return <LoadingSpinner fullPage label="جاري التحميل…" />
  if (!scope.company) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="PESTEL" />
        <EmptyState title={scope.error ?? 'لا شركة مرتبطة'} description="اختر عميلاً من عملائي." />
      </div>
    )
  }

  const suggestions = DEPT_PESTEL_SUGGESTIONS[specialty]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`تحليل PESTEL — إدارة ${DEPT_LABEL[specialty]}`}
        description={
          savedAt
            ? `لعميل ${scope.company.name} · آخر حفظ ${new Date(savedAt).toLocaleString('ar-SA')}`
            : `لعميل ${scope.company.name} · اضغط مقترحاً لإضافته إلى الحقل`
        }
      />

      {/* شريط تسلسل المرحلة — يعرض قبل/بعد ويربطها بمسارات مُصفَّاة للمدير */}
      <StageBanner clientQuery={`?client=${scope.company.id}`} />

      {/* 🧠 توليد تلقائي + أزرار التحكّم */}
      <Card className="border-primary/40 bg-gradient-to-l from-primary/15 to-primary/5">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="text-3xl" aria-hidden>🧠</div>
            <div>
              <div className="text-sm font-bold">توليد تلقائي لتخصّصك</div>
              <div className="text-xs text-muted-foreground">
                نضيف ٣ مقترحات لكل محور من الست (١٨ عنصر) لتخصّص {DEPT_LABEL[specialty]}.
                <b className="text-foreground"> يمكنك التراجع أو المسح أو الحذف الفردي بعدها.</b>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {preGenSnapshot && (
              <Button variant="outline" onClick={undoLastGenerate} size="sm">
                ↩️ تراجع عن التوليد
              </Button>
            )}
            <Button
              variant="outline"
              onClick={clearAll}
              size="sm"
              disabled={PESTEL_AXES.every((a) => !data[a.key].trim())}
            >
              🗑️ مسح الكلّ
            </Button>
            <Button onClick={generateAll} size="lg">
              ✨ ولّد الكل الآن
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {PESTEL_AXES.map((axis) => {
          const filled = data[axis.key].split('\n').filter((l) => l.trim()).length
          return (
          <Card key={axis.key} className="overflow-hidden">
            <div className="h-1 bg-gradient-to-l from-primary/60 to-primary/10" />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span aria-hidden>{axis.icon}</span>
                    {axis.labelAr}
                    {filled > 0 && (
                      <span className="rounded-full border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground tabular-nums">
                        {filled} عنصر
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {DEPT_ICON[specialty]} مقترحات موصى بها لتخصّص {DEPT_LABEL[specialty]}:
                  </CardDescription>
                </div>
                {filled > 0 && (
                  <button
                    type="button"
                    onClick={() => clearAxis(axis.key)}
                    className="rounded-md border bg-card px-2 py-1 text-[10px] text-muted-foreground hover:bg-rose-100 hover:text-rose-700"
                    title="مسح كل عناصر هذا المحور"
                  >
                    🗑️ مسح المحور
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {suggestions[axis.key].map((sug) => {
                  const already = data[axis.key].includes(sug)
                  return (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => already ? removeSuggestion(axis.key, sug) : addSuggestion(axis.key, sug)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        already
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700'
                          : 'border-primary/30 bg-primary/5 text-foreground hover:bg-primary hover:text-primary-foreground'
                      }`}
                      title={already ? 'مضاف — اضغط لحذفه' : 'اضغط لإضافته'}
                    >
                      {already ? '✓ ' : '＋ '}{sug}
                    </button>
                  )
                })}
              </div>
              <div className="text-[10px] text-muted-foreground">
                💡 يمكنك أيضاً الكتابة الحرّة في المربّع أدناه — أي نصّ تضيفه هنا يُحفظ.
              </div>
              <Textarea
                value={data[axis.key]}
                onChange={(e) => setData((prev) => ({ ...prev, [axis.key]: e.target.value }))}
                rows={5}
                placeholder={axis.placeholder}
              />
            </CardContent>
          </Card>
          )
        })}
      </div>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-lg">
          {saving ? 'جاري الحفظ…' : 'حفظ PESTEL في القاعدة'}
        </Button>
      </div>

      {/* بطاقة الأداة التالية — انتقال مباشر للخطوة القادمة في التسلسل */}
      <NextStepCard clientQuery={`?client=${scope.company.id}`} />
    </div>
  )
}
