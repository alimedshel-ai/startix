import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { OpexHint } from '@/components/OpexHint'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useCompany } from '@/hooks/useCompany'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_LABEL, type DeptCode } from '@/lib/deptApi'
import { getArtifact, listInitiatives, upsertArtifact } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

// ─── أدوار افتراضية بحسب تخصّص المدير المستقل ──────────────────
const DEPT_DEFAULT_ROLES: Record<DeptCode, string[]> = {
  HR:               ['مدير الموارد البشرية', 'أخصائي استقطاب', 'أخصائي رواتب', 'شريك أعمال HR'],
  FINANCE:          ['مدير مالي', 'محاسب', 'مدقّق داخلي', 'محلّل مالي'],
  SALES:            ['مدير مبيعات', 'مندوب مبيعات', 'محلّل مبيعات', 'مدير حسابات'],
  MARKETING:        ['مدير تسويق', 'أخصائي محتوى', 'أخصائي إعلانات رقمية', 'محلّل تسويقي'],
  OPERATIONS:       ['مدير عمليات', 'مشرف إنتاج', 'ضابط جودة', 'مسؤول مستودع'],
  IT:               ['مدير تقنية', 'مطوّر', 'مهندس شبكات', 'أخصائي أمن سيبراني'],
  CUSTOMER_SERVICE: ['مدير خدمة العملاء', 'وكيل دعم', 'مشرف جودة الخدمة', 'محلّل تجربة'],
  SUPPORT:          ['مدير الدعم', 'مهندس دعم L1', 'مهندس دعم L2', 'مدير حسابات فنية'],
  LOGISTICS:        ['مدير لوجستيات', 'مشرف مستودع', 'أخصائي شحن', 'ضابط سلامة'],
  QUALITY:          ['مدير الجودة', 'مدقّق جودة', 'أخصائي ISO', 'محلّل عيوب'],
  PROJECTS:         ['مدير المشاريع', 'مدير مشروع', 'محلّل PMO', 'مسؤول جدولة'],
  COMPLIANCE:       ['رئيس الامتثال', 'مسؤول امتثال', 'مدقّق داخلي', 'مسؤول توعية'],
  GOVERNANCE:       ['سكرتير المجلس', 'مسؤول حوكمة', 'مستشار قانوني', 'مسؤول سياسات'],
}

// ─── R6.3 — مصفوفة RACI ────────────────────────────────────────────
// Task × Role → Responsible / Accountable / Consulted / Informed.
// R4.5 — يقترح توزيع أدوار افتراضية بناءً على opex.team.

type RaciCode = '' | 'R' | 'A' | 'C' | 'I'

interface RaciRow {
  id: string
  task: string
  assignments: Record<string, RaciCode>
}

interface RaciData {
  roles: string[]      // مثال: ['المدير', 'مسؤول التشغيل', 'المحاسب']
  rows: RaciRow[]
}

const DEFAULT_ROLES = ['المدير', 'مسؤول التشغيل', 'مسؤول المالية', 'الفريق']

const RACI_LABELS: Record<Exclude<RaciCode, ''>, { label: string; tint: string }> = {
  R: { label: 'مسؤول',       tint: 'bg-emerald-100 text-emerald-800' },
  A: { label: 'محاسِب',       tint: 'bg-primary/15 text-primary' },
  C: { label: 'مُستشار',      tint: 'bg-amber-100 text-amber-800' },
  I: { label: 'مُبلَّغ',        tint: 'bg-sky-100 text-sky-800' },
}

function nextCode(cur: RaciCode): RaciCode {
  const order: RaciCode[] = ['', 'R', 'A', 'C', 'I']
  const i = order.indexOf(cur)
  return order[(i + 1) % order.length]
}

export function RACIPage() {
  const [params] = useSearchParams()
  const client = params.get('client')
  const from = params.get('from')
  const parts = ['tab=raci']
  if (client) parts.push(`client=${client}`)
  if (from) parts.push(`from=${from}`)
  return <Navigate to={`/priority?${parts.join('&')}`} replace />
}

export function RACIView({ companyId }: { companyId: string }) {
  return <Editor companyId={companyId} />
}

function Editor({ companyId }: { companyId: string }) {
  const { company } = useCompany()
  const user = useAuthStore((s) => s.user)
  const specialty = user?.specialtyDeptType ?? null
  const deptRoles = specialty ? DEPT_DEFAULT_ROLES[specialty] : null
  const initialRoles = deptRoles ?? DEFAULT_ROLES
  const [data, setData] = useState<RaciData>({ roles: initialRoles, rows: [] })
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [newTask, setNewTask] = useState('')
  const [newRole, setNewRole] = useState('')
  // جاهزيّة أيزنهاور — هل فيه مهامّ «افعل الآن/جدولها» لتوزيع مسؤوليّاتها؟
  // نبدأ true (لا تحذير قبل الجلب)، ثمّ نضبطها. false → بانر يوجّه للخطوة السابقة.
  const [eisenReady, setEisenReady] = useState(true)

  useEffect(() => {
    getArtifact<RaciData>(companyId, 'RACI').then((row) => {
      if (row?.data) {
        setData({
          roles: Array.isArray(row.data.roles) && row.data.roles.length ? row.data.roles : initialRoles,
          rows: Array.isArray(row.data.rows) ? row.data.rows : [],
        })
      }
    }).catch(() => undefined)
    getArtifact<{ tasks?: Array<{ quadrant: string; title?: string }> }>(companyId, 'EISENHOWER')
      .then((a) => setEisenReady((a?.data?.tasks ?? []).some((t) => (t.quadrant === 'do' || t.quadrant === 'schedule') && !!t.title?.trim())))
      .catch(() => setEisenReady(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  // 🚨 توليد المهام من مصفوفة أيزنهاور — مناسب لوضع الطوارئ
  // (الأيزنهاور جاء من المخاطر → RACI يضيف المسؤول لكل مهمة)
  async function generateFromEisenhower() {
    setGenerating(true)
    try {
      const artifact = await getArtifact<{ tasks?: Array<{ id: string; title: string; quadrant: 'do' | 'schedule' | 'delegate' | 'delete' }> }>(companyId, 'EISENHOWER')
      const tasks = artifact?.data?.tasks ?? []
      // نستورد فقط «افعل الآن» + «جدولها» (الأولى بالتنفيذ الآن)
      const eligible = tasks.filter((t) => t.quadrant === 'do' || t.quadrant === 'schedule')
      if (eligible.length === 0) {
        toast.error('لا توجد مهام في «افعل الآن» أو «جدولها» — افتح مصفوفة أيزنهاور أوّلاً (الخطوة ٢).')
        return
      }
      const existing = new Set(data.rows.map((r) => r.task))
      const toAdd = eligible.filter((t) => t.title && !existing.has(t.title))
      if (toAdd.length === 0) {
        toast.message('كل المهام مضافة سلفاً كصفوف RACI.')
        return
      }
      const managerRole = data.roles[0] // أول دور = المدير
      setData((p) => ({
        ...p,
        rows: [
          ...p.rows,
          ...toAdd.map((t) => ({
            id: crypto.randomUUID(),
            task: t.title,
            // مهام «افعل الآن» → المدير هو A (المحاسَب)
            assignments: Object.fromEntries(p.roles.map((r) => [
              r,
              (r === managerRole && t.quadrant === 'do' ? 'A' : '') as RaciCode,
            ])),
          })),
        ],
      }))
      toast.success(`🚨 أُضيف ${toAdd.length} مهمة من أيزنهاور — عيّن R/A/C/I لكل خلية.`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر الاستيراد من أيزنهاور'))
    } finally {
      setGenerating(false)
    }
  }

  // 🧠 توليد المهام من المبادرات — كل مبادرة تُصبح مهمة في RACI بأدوار افتراضية.
  async function generateFromInitiatives() {
    setGenerating(true)
    try {
      const initiatives = await listInitiatives(companyId)
      if (initiatives.length === 0) {
        toast.error('لا مبادرات محفوظة — افتح /initiatives أوّلاً وأضف مبادرات.')
        return
      }
      const existing = new Set(data.rows.map((r) => r.task))
      const toAdd = initiatives
        .filter((i) => i.title && !existing.has(i.title))
        .slice(0, 12)
      if (toAdd.length === 0) {
        toast.message('كل المبادرات مضافة سلفاً كمهام RACI.')
        return
      }
      // للمبادرات الحرجة نضع «مدير الإدارة» A (المحاسَب) بشكل افتراضي.
      const managerRole = data.roles[0] // أول دور = المدير عادةً
      setData((p) => ({
        ...p,
        rows: [
          ...p.rows,
          ...toAdd.map((i) => ({
            id: crypto.randomUUID(),
            task: i.title,
            assignments: Object.fromEntries(p.roles.map((r) => [
              r,
              (r === managerRole && (i.priority === 'critical' || i.priority === 'high') ? 'A' : '') as RaciCode,
            ])),
          })),
        ],
      }))
      toast.success(`🧠 أُضيف ${toAdd.length} مهمة من المبادرات — عيّن R/A/C/I لكل خلية.`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر التوليد التلقائي'))
    } finally {
      setGenerating(false)
    }
  }

  function addRole() {
    const v = newRole.trim()
    if (!v || data.roles.includes(v)) return
    setData((p) => ({
      roles: [...p.roles, v],
      rows: p.rows.map((r) => ({ ...r, assignments: { ...r.assignments, [v]: '' } })),
    }))
    setNewRole('')
  }

  function removeRole(role: string) {
    setData((p) => ({
      roles: p.roles.filter((r) => r !== role),
      rows: p.rows.map((r) => {
        const { [role]: _removed, ...rest } = r.assignments
        return { ...r, assignments: rest }
      }),
    }))
  }

  function addTask() {
    const v = newTask.trim()
    if (!v) return
    setData((p) => ({
      ...p,
      rows: [...p.rows, {
        id: crypto.randomUUID(),
        task: v,
        assignments: Object.fromEntries(p.roles.map((r) => [r, '' as RaciCode])),
      }],
    }))
    setNewTask('')
  }

  function removeTask(id: string) {
    setData((p) => ({ ...p, rows: p.rows.filter((r) => r.id !== id) }))
  }

  function cycleCell(id: string, role: string) {
    setData((p) => ({
      ...p,
      rows: p.rows.map((r) =>
        r.id === id ? { ...r, assignments: { ...r.assignments, [role]: nextCode(r.assignments[role] ?? '') } } : r
      ),
    }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'RACI', data)
      toast.success('تم حفظ RACI')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  const teamSize = company?.opex?.team
  const roleWarning = teamSize != null && data.roles.length > teamSize
    ? `⚠️ لديك ${data.roles.length} أدوار على ${teamSize} أعضاء فريق — قد تحتاج ادوار مركّبة.`
    : null

  return (
    <>
      {/* بطاقة تعريف بالخدمة */}
      <Card className="border-primary/20 bg-gradient-to-l from-primary/5 to-transparent">
        <CardContent className="p-4 text-xs leading-relaxed">
          <div className="flex items-start gap-3">
            <div className="text-2xl leading-none">👥</div>
            <div className="flex-1">
              <div className="text-sm font-bold text-foreground">ما هي مصفوفة RACI؟</div>
              <p className="mt-1 text-muted-foreground">
                أداة لتوضيح <b className="text-foreground">من مسؤول عن ماذا</b> في كل مهمة —
                تمنع الفوضى والتداخل عبر ٤ أدوار لكل مهمة:
                <b className="text-emerald-700"> R</b> Responsible (منفّذ) ·
                <b className="text-primary"> A</b> Accountable (محاسَب واحد فقط) ·
                <b className="text-amber-700"> C</b> Consulted (مُستشار) ·
                <b className="text-sky-700"> I</b> Informed (مُبلَّغ).
              </p>
              <p className="mt-1 text-muted-foreground">
                <b className="text-foreground">استعملها عندما:</b> بدأت التنفيذ ولديك مبادرات + فريق متعدّد الأدوار.
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
              الأدوار الافتراضية مُخصّصة لتخصّصك — يمكنك تعديلها.
            </span>
          </CardContent>
        </Card>
      )}

      {/* 🧠 توليد المهام — من أيزنهاور (وضع الطوارئ) أو من المبادرات */}
      <Card className="border-primary/40 bg-gradient-to-l from-primary/15 to-primary/5">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="text-3xl" aria-hidden>🧠</div>
            <div>
              <div className="text-sm font-bold">توليد المهام</div>
              <div className="text-xs text-muted-foreground">
                من <b className="text-foreground">أيزنهاور</b> («افعل الآن» + «جدولها» → المدير A تلقائياً) —
                أو من <b className="text-foreground">المبادرات</b> (الحرجة/العالية → المدير A).
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={generateFromEisenhower} disabled={generating || saving} variant="outline" size="lg" className="border-rose-400 text-rose-800 hover:bg-rose-50">
              {generating ? 'جاري…' : '🚨 من أيزنهاور'}
            </Button>
            <Button onClick={generateFromInitiatives} disabled={generating || saving} size="lg">
              {generating ? 'جاري…' : '✨ من المبادرات'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* توجيه الخطوة السابقة — لا نترك المستخدم أمام «من أيزنهاور» يُخفق بصمت. */}
      {!eisenReady && data.rows.length === 0 && (
        <Card className="border-2 border-dashed border-rose-400 bg-rose-50/50">
          <CardContent className="p-4">
            <div className="text-sm font-bold text-rose-900">
              لا مهامّ لتوزيع مسؤوليّاتها بعد — أكمل ما قبلها أوّلاً بالترتيب:
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link to={`/risk-map?client=${companyId}&from=emergency`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                ① ⚠️ سجّل مخاطرك وقيّم خطورتها
              </Link>
              <Link to={`/eisenhower?client=${companyId}&from=emergency`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                ② 🎯 افرزها في أيزنهاور
              </Link>
            </div>
            <div className="mt-2 text-[11px] text-rose-800/80">
              بعد أن تصير مهامّ في «افعل الآن/جدولها» بأيزنهاور، ارجع هنا فتظهر لتوزيع R/A/C/I.
            </div>
          </CardContent>
        </Card>
      )}

      <OpexHint opex={company?.opex} focus={['team']} title="حجم الفريق يوجّه توزيع الأدوار" />

      {roleWarning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          {roleWarning}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle>المصفوفة</CardTitle>
            <CardDescription>{data.rows.length} مهمة · {data.roles.length} دور. اضغط الخلية للتبديل بين R/A/C/I.</CardDescription>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? 'جاري الحفظ…' : 'حفظ'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* إدارة الأدوار */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">الأدوار:</span>
            {data.roles.map((r) => (
              <span
                key={r}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs"
              >
                {r}
                <button
                  type="button"
                  onClick={() => removeRole(r)}
                  className="text-muted-foreground hover:text-rose-600"
                  title="حذف الدور"
                >
                  ×
                </button>
              </span>
            ))}
            <div className="flex gap-1">
              <Input
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRole())}
                placeholder="دور جديد…"
                className="h-8 w-40 text-xs"
              />
              <Button size="sm" variant="outline" onClick={addRole}>+</Button>
            </div>
          </div>

          {/* إضافة مهمة */}
          <div className="flex gap-2">
            <Input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTask())}
              placeholder="مهمة جديدة…"
            />
            <Button variant="outline" onClick={addTask}>+ مهمة</Button>
          </div>

          {/* الجدول */}
          {data.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-2 text-right">المهمة</th>
                    {data.roles.map((r) => (
                      <th key={r} className="p-2 text-center whitespace-nowrap">{r}</th>
                    ))}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.id} className="border-b">
                      <td className="p-2 font-medium">{row.task}</td>
                      {data.roles.map((r) => {
                        const code = row.assignments[r] ?? ''
                        return (
                          <td key={r} className="p-1 text-center">
                            <button
                              type="button"
                              onClick={() => cycleCell(row.id, r)}
                              className={`h-8 w-8 rounded-md border text-xs font-bold transition ${
                                code === '' ? 'border-dashed bg-card hover:bg-accent'
                                : RACI_LABELS[code].tint
                              }`}
                              title={code ? RACI_LABELS[code].label : 'فارغ'}
                            >
                              {code || '—'}
                            </button>
                          </td>
                        )
                      })}
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeTask(row.id)}
                          className="text-xs text-muted-foreground hover:text-rose-600"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-2 border-t pt-3 text-[10px] text-muted-foreground">
            <span>R = Responsible (مسؤول تنفيذ)</span>
            <span>· A = Accountable (المحاسَب)</span>
            <span>· C = Consulted (مُستشار)</span>
            <span>· I = Informed (مُبلَّغ)</span>
          </div>
        </CardContent>
      </Card>

      {/* 🎯 الخطوة التالية */}
      {data.rows.length > 0 && (
        <Card className="border-emerald-300 bg-emerald-50/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="flex items-start gap-3">
              <div className="text-2xl">📊</div>
              <div>
                <div className="text-sm font-bold text-emerald-900">
                  الخطوة التالية: رتّب المهام بحسب العاجل × المهم
                </div>
                <div className="text-xs text-emerald-800/80">
                  بعد تحديد المسؤوليات، استخدم مصفوفة أيزنهاور لتصنيف المهام إلى (افعل الآن / جدولها / فوّضها / احذفها).
                </div>
              </div>
            </div>
            <Link to="/eisenhower" className={buttonVariants({ variant: 'default' })}>
              افتح أيزنهاور ←
            </Link>
          </CardContent>
        </Card>
      )}
    </>
  )
}
