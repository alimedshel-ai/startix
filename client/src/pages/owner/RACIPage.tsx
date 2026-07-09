import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { OpexHint } from '@/components/OpexHint'
import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useCompany } from '@/hooks/useCompany'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

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
  return (
    <StrategicShell
      title="مصفوفة RACI"
      description="من مسؤول عن ماذا؟ Responsible / Accountable / Consulted / Informed."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const { company } = useCompany()
  const [data, setData] = useState<RaciData>({ roles: DEFAULT_ROLES, rows: [] })
  const [saving, setSaving] = useState(false)
  const [newTask, setNewTask] = useState('')
  const [newRole, setNewRole] = useState('')

  useEffect(() => {
    getArtifact<RaciData>(companyId, 'RACI').then((row) => {
      if (row?.data) {
        setData({
          roles: Array.isArray(row.data.roles) && row.data.roles.length ? row.data.roles : DEFAULT_ROLES,
          rows: Array.isArray(row.data.rows) ? row.data.rows : [],
        })
      }
    }).catch(() => undefined)
  }, [companyId])

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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    </>
  )
}
