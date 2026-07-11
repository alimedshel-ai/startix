import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useCompany } from '@/hooks/useCompany'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_LABEL } from '@/lib/deptApi'
import { DEPT_SCENARIO_BANK } from '@/lib/deptScenarios'
import { createScenario, deleteScenario, getArtifact, getSWOT, listScenarios, type Scenario, type ScenarioProjection } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'
import type { StrategyPath } from '@/types/user'

// ─── ثوابت السيناريوهات ────────────────────────────────────────
type PresetName = 'متفائل' | 'محايد' | 'متشائم'

interface PresetMeta {
  name: PresetName
  icon: string
  color: string
  accent: string
  growthRate: number   // نمو سنوي افتراضي (متفائل +25%, محايد +10%, متشائم -5%)
  marginRate: number   // هامش ربح افتراضي
  hint: string          // لماذا هذا السيناريو مفيد؟
}

const PRESETS: PresetMeta[] = [
  { name: 'متفائل', icon: '🚀', color: '#10b981', accent: 'border-emerald-300 bg-emerald-50/60', growthRate: 0.25, marginRate: 0.18, hint: 'يستند إلى فرص السوق ونقاط قوّتك — يوجّه قرارات النمو والاستثمار.' },
  { name: 'محايد',  icon: '🎯', color: '#0ea5e9', accent: 'border-sky-300 bg-sky-50/60',         growthRate: 0.10, marginRate: 0.12, hint: 'مسار الأعمال المعتاد — الأساس المرجعي لأي مقارنة مع البدائل.' },
  { name: 'متشائم', icon: '🛡️', color: '#f43f5e', accent: 'border-rose-300 bg-rose-50/60',       growthRate: -0.05, marginRate: 0.05, hint: 'يستند إلى التهديدات ونقاط ضعفك — يُثبت خطط الطوارئ ومصدّات المخاطر.' },
]

const COLORS = ['#10b981', '#0ea5e9', '#f43f5e', '#8b5cf6', '#f59e0b']

// المسار يحدّد أفق الإسقاط ولذلك ترتيب الأولوية.
function pathHorizon(path: StrategyPath | null): { years: number; label: string; icon: string } {
  if (path === 'QUICK')  return { years: 1, label: 'سريع ٠-١٢ شهر', icon: '⚡' }
  if (path === 'MEDIUM') return { years: 3, label: 'متوسّط ١-٣ سنوات', icon: '🎯' }
  return { years: 5, label: 'طويل ٣-٥+ سنوات', icon: '🔭' }
}

// ترتيب البريستات حسب المسار — من الأولى بالتنفيذ للأخيرة.
function orderedPresets(path: StrategyPath | null): PresetMeta[] {
  const p = PRESETS
  // QUICK → متشائم أوّلاً (مصدّات مخاطر قبل النمو حين الوقت قصير).
  if (path === 'QUICK')  return [p[2], p[1], p[0]]
  // MEDIUM → محايد أوّلاً (خطّ الأساس)، ثم متفائل، ثم متشائم.
  if (path === 'MEDIUM') return [p[1], p[0], p[2]]
  // LONG أو null → متفائل أوّلاً (الأفق البعيد يحتمل الرهانات).
  return [p[0], p[1], p[2]]
}

// الأولوية المُوصى بها (الأول في الترتيب).
function recommendedPreset(path: StrategyPath | null): PresetName {
  return orderedPresets(path)[0].name
}

export function ScenariosPage() {
  return (
    <StrategicShell
      title="السيناريوهات"
      description="ابنِ ٣ سيناريوهات مبنيّة على تحليلاتك السابقة (OPEX + SWOT + PESTEL) — مرتّبة حسب مسارك الاستراتيجي."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const { company } = useCompany()
  const user = useAuthStore((s) => s.user)
  const strategyPath = user?.strategyPath ?? null
  const horizon = pathHorizon(strategyPath)
  // إعادة تفسير للمدير المستقل — نستبدل المعدّلات والافتراضات والتسميات ببنك تخصّصه.
  const specialty = user?.specialtyDeptType ?? null
  const isDeptScoped =
    user?.userType === 'MANAGER' &&
    user?.managerType === 'INDEPENDENT_PRO' &&
    specialty != null &&
    DEPT_SCENARIO_BANK[specialty] != null
  const deptBank = isDeptScoped ? DEPT_SCENARIO_BANK[specialty!] : null
  const revenueLabelAr = deptBank?.context.revenueLabelAr ?? 'الإيراد'
  const profitLabelAr = deptBank?.context.profitLabelAr ?? 'الربح'
  // نطبّق المعدّلات/التلميحات من بنك الإدارة عند وجودها.
  const effectivePresets = useMemo<PresetMeta[]>(() => {
    if (!deptBank) return PRESETS
    return PRESETS.map((p) => {
      const dp = deptBank.presets[p.name]
      return dp ? { ...p, growthRate: dp.growthRate, marginRate: dp.marginRate, hint: dp.hint } : p
    })
  }, [deptBank])
  const orderedPS = useMemo<PresetMeta[]>(() => {
    if (strategyPath === 'QUICK')  return [effectivePresets[2], effectivePresets[1], effectivePresets[0]]
    if (strategyPath === 'MEDIUM') return [effectivePresets[1], effectivePresets[0], effectivePresets[2]]
    return [effectivePresets[0], effectivePresets[1], effectivePresets[2]]
  }, [effectivePresets, strategyPath])
  const recommendedName = recommendedPreset(strategyPath)

  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  // جاهزية المصادر — تُشرَح للمدير قبل ما يضغط التوليد.
  const [sources, setSources] = useState<{
    opex: boolean
    swot: boolean
    pestel: boolean
    hasSwotOpps: number
    hasSwotThreats: number
  } | null>(null)

  useEffect(() => {
    listScenarios(companyId).then(setScenarios).catch(() => undefined).finally(() => setLoading(false))
    // فحص جاهزية المصادر بالتوازي.
    ;(async () => {
      let hasOpex = !!(company?.opex?.target || company?.opex?.budget)
      let hasSwot = false, opps = 0, threats = 0
      let hasPestel = false
      try {
        const swot = await getSWOT(companyId)
        opps = swot?.opportunities?.length ?? 0
        threats = swot?.threats?.length ?? 0
        hasSwot = opps + threats + (swot?.strengths?.length ?? 0) + (swot?.weaknesses?.length ?? 0) > 0
      } catch { /* skip */ }
      try {
        const pestel = await getArtifact(companyId, 'PESTEL')
        hasPestel = !!pestel
      } catch { /* skip */ }
      setSources({ opex: hasOpex, swot: hasSwot, pestel: hasPestel, hasSwotOpps: opps, hasSwotThreats: threats })
    })()
  }, [companyId, company])

  // إضافة بريست يدوياً — مع أرقام من OPEX إن وجدت.
  async function addPreset(preset: PresetMeta) {
    try {
      const baseYear = new Date().getFullYear()
      const baseRevenue = pickBaseRevenue(company?.opex?.target, company?.opex?.budget)
      const projections: ScenarioProjection[] = Array.from({ length: horizon.years }, (_, i) => {
        // نمو مركّب سنوياً
        const revenue = Math.round(baseRevenue * Math.pow(1 + preset.growthRate, i + 1))
        const profit  = Math.round(revenue * preset.marginRate)
        return { year: baseYear + i, revenue, profit }
      })
      const s = await createScenario({
        companyId,
        name: preset.name,
        // نستخدم افتراضات بنك التخصّص إن وجدت — أدقّ من العامّة.
        assumptions: deptBank?.presets[preset.name]?.assumptions ?? defaultAssumptions(preset.name, strategyPath),
        projections,
      })
      setScenarios((p) => [...p, s])
      toast.success(`تم إنشاء سيناريو ${preset.name} · ${horizon.years} ${horizon.years === 1 ? 'سنة' : 'سنوات'}`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الإنشاء'))
    }
  }

  // 🧠 توليد ٣ سيناريوهات كاملة من التحليل السابق (OPEX + SWOT + PESTEL).
  async function generateAll() {
    if (!sources) return
    setGenerating(true)
    try {
      const baseYear = new Date().getFullYear()
      const baseRevenue = pickBaseRevenue(company?.opex?.target, company?.opex?.budget)
      const swot = await getSWOT(companyId).catch(() => null)
      const pestelArt = await getArtifact<{ political?: unknown; economic?: unknown }>(companyId, 'PESTEL').catch(() => null)

      const existing = new Set(scenarios.map((s) => s.name))
      let added = 0
      for (const preset of orderedPS) {
        if (existing.has(preset.name)) continue
        const projections: ScenarioProjection[] = Array.from({ length: horizon.years }, (_, i) => {
          const revenue = Math.round(baseRevenue * Math.pow(1 + preset.growthRate, i + 1))
          const profit  = Math.round(revenue * preset.marginRate)
          return { year: baseYear + i, revenue, profit }
        })
        // بنك الإدارة يقدّم افتراضات تخصّصية — نلصقها فوق ما يُبنى من SWOT/OPEX.
        const deptAssumptions = deptBank?.presets[preset.name]?.assumptions ?? []
        const assumptions = [
          ...buildAssumptions({
            preset: preset.name,
            path: strategyPath,
            opex: company?.opex ?? null,
            swot,
            hasPestel: !!pestelArt,
          }),
          ...deptAssumptions,
        ]
        try {
          const s = await createScenario({ companyId, name: preset.name, assumptions, projections })
          setScenarios((p) => [...p, s])
          added++
        } catch { /* تخطّى الفشل الفردي */ }
      }
      if (added === 0) toast.message('كل السيناريوهات مضافة سلفاً.')
      else toast.success(`🧠 أُنشئ ${added} سيناريو من: OPEX${sources.swot ? ' + SWOT' : ''}${sources.pestel ? ' + PESTEL' : ''} · أفق ${horizon.years} ${horizon.years === 1 ? 'سنة' : 'سنوات'}.`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر التوليد'))
    } finally {
      setGenerating(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('حذف هذا السيناريو؟')) return
    try {
      await deleteScenario(id)
      setScenarios((p) => p.filter((s) => s.id !== id))
      toast.success('تم الحذف')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحذف'))
    }
  }

  // Merge all projections into a single chart series by year.
  const chartData = useMemo(() => {
    const byYear = new Map<number, Record<string, number>>()
    scenarios.forEach((s) => {
      s.projections.forEach((p) => {
        const row = byYear.get(p.year) ?? { year: p.year }
        row[s.name] = p.revenue
        byYear.set(p.year, row)
      })
    })
    return [...byYear.entries()].map(([, v]) => v).sort((a, b) => (a.year as number) - (b.year as number))
  }, [scenarios])

  return (
    <>
      {/* شارة السياق — مسارك + تخصّصك (إن وُجد) يحدّدان أفق الإسقاط والتفسير */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-wrap items-center gap-3 p-3 text-xs">
          {isDeptScoped && (
            <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
              🎯 السياق: إدارة {DEPT_LABEL[specialty!]}
            </span>
          )}
          <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
            {horizon.icon} مسارك: {horizon.label}
          </span>
          <span className="text-muted-foreground">
            {deptBank
              ? deptBank.context.contextHintAr + ` · أفق ${horizon.years} ${horizon.years === 1 ? 'سنة' : 'سنوات'}.`
              : `أفق السيناريوهات = ${horizon.years} ${horizon.years === 1 ? 'سنة' : 'سنوات'} · البريستات مرتّبة بحسب أولوية مسارك (الأول: ${recommendedName}).`}
          </span>
        </CardContent>
      </Card>

      {/* لوحة جاهزية المصادر — تشرح ما يقرأه المولّد قبل الضغط */}
      {sources && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🔗 المصادر التي يتغذّى منها المولّد</CardTitle>
            <CardDescription className="text-xs">
              كل مصدر يزوّد التوليد التلقائي بأرقام أو افتراضات أدقّ. اضغط مصدراً ناقصاً لإكماله.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            <SourceRow
              done={sources.opex}
              icon="💰"
              label="OPEX (الميزانية/المستهدف)"
              hint={sources.opex ? 'يُغذّي إيرادات السنة الأولى الأساسيّة.' : 'بلاه سنُستخدم رقم افتراضي عام — أدقّ لو تُدخل OPEX.'}
              to="/settings/opex"
            />
            <SourceRow
              done={sources.swot}
              icon="🧭"
              label="SWOT"
              hint={sources.swot
                ? `${sources.hasSwotOpps} فرصة · ${sources.hasSwotThreats} تهديد → افتراضات المتفائل والمتشائم.`
                : 'أدخِل SWOT للحصول على افتراضات ذكيّة بدل الجاهزة.'}
              to="/swot"
            />
            <SourceRow
              done={sources.pestel}
              icon="🌐"
              label="PESTEL"
              hint={sources.pestel ? 'يزوّد الافتراضات بالعوامل الاقتصادية/السياسية.' : 'اختياري — يعطي افتراضات أعمق.'}
              to="/pestel"
            />
          </CardContent>
        </Card>
      )}

      {/* 🧠 توليد الكل + إضافة يدوية */}
      <Card className="overflow-hidden bg-gradient-to-bl from-primary/15 to-primary/5">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-start gap-3">
              <div className="text-3xl leading-none">🧠</div>
              <div>
                <CardTitle className="text-base">توليد ٣ سيناريوهات كاملة</CardTitle>
                <CardDescription className="text-xs">
                  يقرأ OPEX + SWOT + PESTEL ويُنشئ الثلاثة بأرقام واقعية.
                </CardDescription>
              </div>
            </div>
            <Button onClick={generateAll} disabled={generating || !sources} size="lg">
              {generating ? 'جاري…' : '✨ ولّد ٣ سيناريوهات'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* بريستات مرتّبة بحسب المسار — يمكن إضافة كل واحد على حدة */}
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            أو أضِف واحداً بضغطة (بترتيب أولوية مسارك):
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {orderedPS.map((preset, i) => {
              const exists = scenarios.some((s) => s.name === preset.name)
              const isRecommended = preset.name === recommendedName
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => addPreset(preset)}
                  disabled={exists}
                  className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-right transition ${
                    exists
                      ? 'border-emerald-300 bg-emerald-50/40 opacity-70'
                      : isRecommended
                        ? 'border-primary bg-primary/5 shadow-sm hover:-translate-y-0.5 hover:shadow'
                        : preset.accent + ' hover:-translate-y-0.5 hover:shadow'
                  }`}
                >
                  <div className="flex w-full items-center gap-2">
                    <span
                      className="inline-flex size-6 items-center justify-center rounded-full text-[10px] font-bold tabular-nums"
                      style={{ backgroundColor: preset.color, color: 'white' }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-xl">{preset.icon}</span>
                    <span className="flex-1 font-bold">{preset.name}</span>
                    {isRecommended && !exists && (
                      <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                        ⭐ الأولى لمسارك
                      </span>
                    )}
                    {exists && (
                      <span className="rounded-full border border-emerald-300 bg-card px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">
                        ✓ مضاف
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] leading-relaxed text-muted-foreground">
                    {preset.hint}
                  </div>
                  <div className="text-[10px] tabular-nums text-muted-foreground/80">
                    نمو {(preset.growthRate * 100).toFixed(0)}% · هامش {(preset.marginRate * 100).toFixed(0)}% · {horizon.years} {horizon.years === 1 ? 'سنة' : 'سنوات'}
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>
      )}

      {!loading && scenarios.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            لا توجد سيناريوهات بعد — اضغط «✨ ولّد ٣ سيناريوهات» أعلاه أو اختر بريستاً واحداً.
          </CardContent>
        </Card>
      )}

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>مقارنة {revenueLabelAr}</CardTitle>
            <CardDescription>{revenueLabelAr} المتوقّع عبر السنوات لكل سيناريو — أفق {horizon.years} {horizon.years === 1 ? 'سنة' : 'سنوات'} بحسب مسارك.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip formatter={(v) => new Intl.NumberFormat('ar-SA', { notation: 'compact' }).format(Number(v))} />
                <Legend />
                {scenarios.map((s, i) => (
                  <Line key={s.id} type="monotone" dataKey={s.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {scenarios.map((s, i) => {
          const preset = PRESETS.find((p) => p.name === s.name)
          const rank = orderedPS.findIndex((p) => p.name === s.name) + 1
          return (
            <Card key={s.id} className={preset?.accent ?? ''}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {rank > 0 && (
                    <span
                      className="inline-flex size-6 items-center justify-center rounded-full text-[10px] font-bold tabular-nums"
                      style={{ backgroundColor: preset?.color ?? COLORS[i % COLORS.length], color: 'white' }}
                    >
                      #{rank}
                    </span>
                  )}
                  <span>{preset?.icon}</span>
                  <span className="flex-1">{s.name}</span>
                </CardTitle>
                <CardDescription>{s.assumptions.length} افتراض · {s.projections.length} سنة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">الافتراضات</div>
                  <ul className="mt-1 space-y-1 text-xs">
                    {s.assumptions.map((a, idx) => (
                      <li key={idx} className="rounded-md border bg-card px-2 py-1">{a}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">الإسقاطات</div>
                  <table className="mt-1 w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-right">السنة</th>
                        <th className="text-right">{revenueLabelAr}</th>
                        <th className="text-right">{profitLabelAr}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.projections.map((p) => (
                        <tr key={p.year} className="border-t">
                          <td className="py-1 tabular-nums">{p.year}</td>
                          <td className="py-1 tabular-nums">{new Intl.NumberFormat('ar-SA', { notation: 'compact' }).format(p.revenue)}</td>
                          <td className="py-1 tabular-nums">{new Intl.NumberFormat('ar-SA', { notation: 'compact' }).format(p.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => remove(s.id)}>حذف</Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}

// ─── سطر مصدر في لوحة الجاهزية ─────────────────────────────────
function SourceRow({ done, icon, label, hint, to }: { done: boolean; icon: string; label: string; hint: string; to: string }) {
  return (
    <div className={`rounded-lg border p-2 ${done ? 'border-emerald-300 bg-emerald-50/40' : 'border-amber-300 bg-amber-50/40'}`}>
      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-lg">{icon}</span>
        <span className="flex-1 font-semibold">{label}</span>
        <span
          className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${
            done
              ? 'border-emerald-400 bg-emerald-100 text-emerald-800'
              : 'border-rose-300 bg-rose-50 text-rose-700'
          }`}
        >
          {done ? '✓' : '✗'}
        </span>
      </div>
      <div className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{hint}</div>
      {!done && (
        <a
          href={to}
          className="mt-1 inline-block text-[10px] text-primary underline-offset-2 hover:underline"
        >
          افتحه ←
        </a>
      )}
    </div>
  )
}

// ─── منطق مساعد ────────────────────────────────────────────────

// إيراد السنة الأساسية — من OPEX.target أو budget، وإلا رقم افتراضي.
function pickBaseRevenue(target: number | undefined, budget: number | undefined): number {
  if (target != null && target > 0) return target
  if (budget != null && budget > 0) return budget
  return 3_000_000
}

// افتراضات افتراضية — تُستخدم في addPreset (بلا مصادر مقروءة).
function defaultAssumptions(name: PresetName, path: StrategyPath | null): string[] {
  const horizon = pathHorizon(path)
  const base = [
    `الأفق: ${horizon.label}`,
    'استقرار العملة ومعدل الفائدة',
  ]
  if (name === 'متفائل') base.push('نمو الطلب فوق المتوسط', 'تنفيذ خطة التوسّع دون معوّقات')
  if (name === 'محايد')   base.push('استمرار السوق على وتيرته', 'أداء تنفيذي وفق الخطة')
  if (name === 'متشائم')  base.push('تباطؤ الطلب', 'ضغوط تكلفة على الهامش')
  return base
}

// افتراضات ذكيّة — تُستخدم في generateAll (تقرأ SWOT + OPEX).
function buildAssumptions({
  preset, path, opex, swot, hasPestel,
}: {
  preset: PresetName
  path: StrategyPath | null
  opex: { target?: number; budget?: number } | null
  swot: { opportunities?: string[]; threats?: string[] } | null
  hasPestel: boolean
}): string[] {
  const horizon = pathHorizon(path)
  const list: string[] = [`الأفق: ${horizon.label}`]
  if (opex?.target) list.push(`أساس الإيراد: ${Math.round(opex.target).toLocaleString('ar-SA')} SAR (من OPEX.target)`)
  else if (opex?.budget) list.push(`أساس الإيراد: مشتقّ من الميزانية ${Math.round(opex.budget).toLocaleString('ar-SA')} SAR`)
  if (hasPestel) list.push('تُؤخذ العوامل الاقتصادية والسياسية من PESTEL')

  if (preset === 'متفائل' && swot?.opportunities?.length) {
    const opp = swot.opportunities[0]
    list.push(`اقتناص فرصة: ${opp.length > 60 ? opp.slice(0, 60) + '…' : opp}`)
    if (swot.opportunities[1]) {
      const o2 = swot.opportunities[1]
      list.push(`دعم: ${o2.length > 60 ? o2.slice(0, 60) + '…' : o2}`)
    }
  }
  if (preset === 'متشائم' && swot?.threats?.length) {
    const t = swot.threats[0]
    list.push(`تحقّق تهديد: ${t.length > 60 ? t.slice(0, 60) + '…' : t}`)
    if (swot.threats[1]) {
      const t2 = swot.threats[1]
      list.push(`ضغط إضافي: ${t2.length > 60 ? t2.slice(0, 60) + '…' : t2}`)
    }
  }
  if (preset === 'محايد') {
    list.push('استمرار الأداء الحالي دون قفزات', 'تنفيذ الخطة كما هي بلا تعديل')
  }

  return list.length > 1 ? list : defaultAssumptions(preset, path)
}
