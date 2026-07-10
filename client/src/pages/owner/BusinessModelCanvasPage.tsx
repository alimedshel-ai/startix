import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_LABEL, type DeptCode } from '@/lib/deptApi'
import { BLOCK_ORDER, DEPT_BMC, type BlockKey } from '@/lib/deptBMC'
import { getArtifact, upsertArtifact, type ArtifactType } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

// ─── R6.1 — نموذج الأعمال Canvas (BMC) ─────────────────────────────
// ٩ كتل: Osterwalder & Pigneur (2010).
//   • OWNER / INTERNAL manager → BMC كلاسيكي (شركة كاملة)، artifact 'BMC'.
//   • INDEPENDENT_PRO مع تخصّص → BMC للإدارة (كتل مُعادة التفسير)،
//     artifact 'BMC_<DEPT>'. الكتل نفسها لكن السياق والاقتراحات مخصّصة.

interface BMCData {
  blocks: Record<BlockKey, string>
}

const EMPTY: BMCData = {
  blocks: {
    partners: '', activities: '', resources: '',
    value: '', relationships: '', channels: '', segments: '',
    costs: '', revenue: '',
  },
}

// ─── Layout الكلاسيكي (شركة) ─────────────────────────────────────
interface ClassicBlockMeta {
  key: BlockKey
  labelAr: string
  icon: string
  placeholder: string
  tint: string
  colSpan: string
  rowSpan?: string
}

const CLASSIC_BLOCKS: ClassicBlockMeta[] = [
  { key: 'partners',      icon: '🤝', labelAr: 'الشركاء الرئيسيون', placeholder: 'مورّدون، تحالفات، شركاء استراتيجيون…',
    tint: 'bg-sky-50/50 border-sky-200',      colSpan: 'col-span-1', rowSpan: 'row-span-2' },
  { key: 'activities',    icon: '⚙️', labelAr: 'الأنشطة الرئيسية',   placeholder: 'ما هي الأنشطة الأهم لتقديم القيمة؟',
    tint: 'bg-emerald-50/50 border-emerald-200', colSpan: 'col-span-1' },
  { key: 'value',         icon: '💎', labelAr: 'القيمة المُقدَّمة',    placeholder: 'ما القيمة الفريدة التي تقدّمها؟',
    tint: 'bg-primary/10 border-primary/30', colSpan: 'col-span-1', rowSpan: 'row-span-2' },
  { key: 'relationships', icon: '❤️', labelAr: 'العلاقة مع العملاء', placeholder: 'كيف تبني علاقة معهم؟',
    tint: 'bg-rose-50/50 border-rose-200',    colSpan: 'col-span-1' },
  { key: 'segments',      icon: '👥', labelAr: 'شرائح العملاء',       placeholder: 'من هم عملاؤك الأساسيون؟',
    tint: 'bg-amber-50/50 border-amber-200',  colSpan: 'col-span-1', rowSpan: 'row-span-2' },
  { key: 'resources',     icon: '🏗️', labelAr: 'الموارد الرئيسية',    placeholder: 'بشرية، مالية، فكرية…',
    tint: 'bg-emerald-50/50 border-emerald-200', colSpan: 'col-span-1' },
  { key: 'channels',      icon: '📣', labelAr: 'القنوات',              placeholder: 'كيف يصلك العميل؟',
    tint: 'bg-rose-50/50 border-rose-200',    colSpan: 'col-span-1' },
  { key: 'costs',         icon: '💸', labelAr: 'هيكل التكاليف',        placeholder: 'التكاليف الثابتة والمتغيّرة…',
    tint: 'bg-orange-50/50 border-orange-200', colSpan: 'col-span-2' },
  { key: 'revenue',       icon: '💰', labelAr: 'مصادر الإيراد',        placeholder: 'كيف تُحقّق دخلاً؟ اشتراك، لكل استخدام…',
    tint: 'bg-emerald-50/50 border-emerald-200', colSpan: 'col-span-3' },
]

export function BusinessModelCanvasPage() {
  const user = useAuthStore((s) => s.user)
  const isDeptScoped =
    user?.userType === 'MANAGER' &&
    user?.managerType === 'INDEPENDENT_PRO' &&
    user?.specialtyDeptType != null &&
    DEPT_BMC[user.specialtyDeptType] != null
  const specialty = user?.specialtyDeptType ?? null
  const title = isDeptScoped
    ? `نموذج عمل الإدارة — ${DEPT_LABEL[specialty as DeptCode]}`
    : 'نموذج الأعمال Canvas'
  const description = isDeptScoped
    ? '٩ كتل تصف نموذج عمل إدارتك: عملاؤها الداخليون، قيمتها، مواردها، وكيف تُثبت أهميتها.'
    : '٩ كتل تلخّص نموذج عملك: من عملاؤك، ما القيمة، وكيف تُحقّقها بربحية.'
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

// ─── محرّر كلاسيكي (شركة كاملة) — بلا تغيير عن السابق ────────────

function ClassicEditor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<BMCData>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getArtifact<BMCData>(companyId, 'BMC').then((row) => {
      if (row?.data?.blocks) setData({ blocks: { ...EMPTY.blocks, ...row.data.blocks } })
    }).catch(() => undefined)
  }, [companyId])

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'BMC', data)
      toast.success('تم حفظ Canvas')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  const filledCount = (Object.values(data.blocks) as string[]).filter((v) => v.trim().length > 0).length

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle>Canvas</CardTitle>
            <CardDescription>{filledCount} من ٩ كتل مُدخَلة.</CardDescription>
          </div>
          <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ'}</Button>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {CLASSIC_BLOCKS.map((b) => (
          <div key={b.key} className={`${b.tint} ${b.colSpan} ${b.rowSpan ?? ''} rounded-xl border p-3`}>
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <span aria-hidden>{b.icon}</span>
              {b.labelAr}
            </div>
            <Textarea
              value={data.blocks[b.key]}
              onChange={(e) => setData((p) => ({ blocks: { ...p.blocks, [b.key]: e.target.value } }))}
              rows={4}
              placeholder={b.placeholder}
              className="min-h-[100px] resize-none bg-card/70"
            />
          </div>
        ))}
      </div>
    </>
  )
}

// ─── محرّر الإدارة (dept-scoped) ─────────────────────────────────
// شبكة أبسط (٣ أعمدة متساوية) لأن الكتل جميعها لها وزن مماثل في سياق
// إدارة (بدل الشركة الكاملة التي فيها blocks كبيرة كـcosts/revenue).

const TINTS: Record<BlockKey, string> = {
  segments:      'bg-amber-50/50 border-amber-200',
  value:         'bg-primary/10 border-primary/30',
  channels:      'bg-rose-50/50 border-rose-200',
  relationships: 'bg-rose-50/50 border-rose-200',
  revenue:       'bg-emerald-50/50 border-emerald-200',
  resources:     'bg-emerald-50/50 border-emerald-200',
  activities:    'bg-emerald-50/50 border-emerald-200',
  partners:      'bg-sky-50/50 border-sky-200',
  costs:         'bg-orange-50/50 border-orange-200',
}

function DeptEditor({ companyId, specialty }: { companyId: string; specialty: DeptCode }) {
  const artifactType: ArtifactType = `BMC_${specialty}`
  const config = DEPT_BMC[specialty]!
  const [data, setData] = useState<BMCData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    getArtifact<BMCData>(companyId, artifactType).then((row) => {
      if (row?.data?.blocks) {
        setData({ blocks: { ...EMPTY.blocks, ...row.data.blocks } })
        setSavedAt(row.updatedAt)
      }
    }).catch(() => undefined)
  }, [companyId, artifactType])

  async function save() {
    setSaving(true)
    try {
      const saved = await upsertArtifact(companyId, artifactType, data)
      setSavedAt(saved.updatedAt)
      toast.success('تم حفظ نموذج عمل الإدارة')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  function addSuggestion(key: BlockKey, suggestion: string) {
    setData((prev) => {
      const current = prev.blocks[key].trim()
      if (current.includes(suggestion)) return prev
      const sep = current ? '\n• ' : '• '
      return { blocks: { ...prev.blocks, [key]: current + sep + suggestion } }
    })
  }

  // 🧠 توليد تلقائي — يملأ الكتل الفارغة بالمقترحات الجاهزة لتخصّصك.
  async function generateAll() {
    setGenerating(true)
    try {
      setData((prev) => {
        const next: BMCData = { blocks: { ...prev.blocks } }
        let added = 0
        for (const key of BLOCK_ORDER) {
          const block = config[key]
          const current = next.blocks[key].trim()
          const lines: string[] = []
          for (const sug of block.suggestions.slice(0, 3)) {
            if (!current.includes(sug)) {
              lines.push(sug)
              added++
            }
          }
          if (lines.length > 0) {
            const sep = current ? '\n• ' : '• '
            next.blocks[key] = current + sep + lines.join('\n• ')
          }
        }
        if (added === 0) toast.error('كل المقترحات موجودة سلفاً.')
        else toast.success(`🧠 أُضيف ${added} مقترحاً على ٩ كتل — راجعها وعدّل ما يلزم.`)
        return next
      })
    } finally {
      setGenerating(false)
    }
  }

  const filledCount = (Object.values(data.blocks) as string[]).filter((v) => v.trim().length > 0).length

  return (
    <>
      {/* شارة السياق */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-wrap items-center gap-3 p-3 text-xs">
          <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
            🎯 السياق: إدارة {DEPT_LABEL[specialty]} فقط
          </span>
          <span className="text-muted-foreground">
            كل كتلة أُعيد تفسيرها لتناسب إدارتك (مثل: «العملاء» = العملاء الداخليون، «الإيرادات» = كيف نُثبت قيمتنا).
          </span>
          {savedAt && (
            <span className="ml-auto text-muted-foreground">
              آخر حفظ: {new Date(savedAt).toLocaleDateString('ar-SA')}
            </span>
          )}
        </CardContent>
      </Card>

      {/* 🧠 توليد تلقائي */}
      <Card className="border-primary/40 bg-gradient-to-l from-primary/15 to-primary/5">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="text-3xl" aria-hidden>🧠</div>
            <div>
              <div className="text-sm font-bold">توليد مسودّة تلقائية</div>
              <div className="text-xs text-muted-foreground">
                نُقدّم ٣ مقترحات لكل كتلة (٢٧ عنصر) مبنيّة على أفضل الممارسات لتخصّصك — عدّلها بحرية.
              </div>
            </div>
          </div>
          <Button onClick={generateAll} disabled={generating || saving} size="lg">
            {generating ? 'جاري التوليد…' : '✨ ولّد الآن'}
          </Button>
        </CardContent>
      </Card>

      {/* شريط الحفظ */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle>نموذج عمل إدارة {DEPT_LABEL[specialty]}</CardTitle>
            <CardDescription>{filledCount} من ٩ كتل مُدخَلة.</CardDescription>
          </div>
          <Button onClick={save} disabled={saving || generating}>{saving ? 'جاري الحفظ…' : 'حفظ'}</Button>
        </CardHeader>
      </Card>

      {/* الكتل التسع — شبكة ٣×٣ */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {BLOCK_ORDER.map((key) => {
          const block = config[key]
          return (
            <div key={key} className={`${TINTS[key]} rounded-xl border p-3`}>
              <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
                <span aria-hidden>{block.icon}</span>
                {block.labelAr}
              </div>
              <p className="mb-2 text-[11px] text-muted-foreground leading-relaxed">{block.descAr}</p>
              <Textarea
                value={data.blocks[key]}
                onChange={(e) => setData((p) => ({ blocks: { ...p.blocks, [key]: e.target.value } }))}
                rows={4}
                placeholder="اكتب أو اقبل من المقترحات أدناه…"
                className="min-h-[80px] resize-none bg-card/70"
              />
              {/* شارات المقترحات */}
              <div className="mt-2 flex flex-wrap gap-1">
                {block.suggestions.map((sug) => {
                  const already = data.blocks[key].includes(sug)
                  return (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => addSuggestion(key, sug)}
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
          )
        })}
      </div>
    </>
  )
}
