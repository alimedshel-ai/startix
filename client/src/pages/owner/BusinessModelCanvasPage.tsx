import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

// ─── R6.1 — نموذج الأعمال Canvas (BMC) ─────────────────────────────
// ٩ كتل: الشركاء، الأنشطة، الموارد، القيمة، العلاقة، القنوات، الشرائح،
// التكاليف، الإيرادات. المصدر: Osterwalder & Pigneur (2010).
// حفظ: StrategicArtifact بنوع BMC، بمنظّم `{ blocks: {key: text} }`.

type BlockKey =
  | 'partners' | 'activities' | 'resources'
  | 'value' | 'relationships' | 'channels' | 'segments'
  | 'costs' | 'revenue'

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

interface BlockMeta {
  key: BlockKey
  labelAr: string
  icon: string
  placeholder: string
  tint: string
  colSpan: string
  rowSpan?: string
}

const BLOCKS: BlockMeta[] = [
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
  return (
    <StrategicShell
      title="نموذج الأعمال Canvas"
      description="٩ كتل تلخّص نموذج عملك: من عملاؤك، ما القيمة، وكيف تُحقّقها بربحية."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<BMCData>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getArtifact<BMCData>(companyId, 'BMC').then((row) => {
      if (row?.data?.blocks) {
        setData({ blocks: { ...EMPTY.blocks, ...row.data.blocks } })
      }
    }).catch(() => undefined)
  }, [companyId])

  function setBlock(key: BlockKey, value: string) {
    setData((p) => ({ blocks: { ...p.blocks, [key]: value } }))
  }

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
          <Button onClick={save} disabled={saving}>
            {saving ? 'جاري الحفظ…' : 'حفظ'}
          </Button>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {BLOCKS.map((b) => (
          <div
            key={b.key}
            className={`${b.tint} ${b.colSpan} ${b.rowSpan ?? ''} rounded-xl border p-3`}
          >
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <span aria-hidden>{b.icon}</span>
              {b.labelAr}
            </div>
            <Textarea
              value={data.blocks[b.key]}
              onChange={(e) => setBlock(b.key, e.target.value)}
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
