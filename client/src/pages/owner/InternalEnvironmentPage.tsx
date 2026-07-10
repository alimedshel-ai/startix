import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_LABEL, listDepartments, type Department, type DeptCode } from '@/lib/deptApi'
import { getArtifact, upsertArtifact, type ArtifactType } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

// ─── #1 في جدول المستخدم — البيئة الداخلية ────────────────────────
// أداة نموذج McKinsey 7S (٧ أبعاد لتقييم البيئة الداخلية):
//   Strategy / Structure / Systems / Style / Staff / Skills / Shared Values.
// كل بُعد: نص وصفي + قوالب نضج ٣ مستويات + درجة ١..٥.
//
// السلوك:
//   • OWNER أو manager بلا تخصّص → INTERNAL_ENV على الشركة كلها.
//   • INDEPENDENT_PRO مع تخصّص → INTERNAL_ENV_<DEPT> على إدارة العميل.
//   • لو /manager/deep-analysis عليه بيانات → نعرض متوسط الأربع محاور
//     الأولية (governance/financial/team/digital) كمرجع للمقارنة.

interface Aspect {
  key: string
  labelAr: string
  icon: string
  descAr: string
  templates: { text: string; rating: 1 | 2 | 3 | 4 | 5 }[]
}

const ASPECTS: Aspect[] = [
  {
    key: 'strategy', labelAr: 'الاستراتيجية', icon: '🎯',
    descAr: 'رؤية واضحة، اتجاه، تموضع تنافسي.',
    templates: [
      { text: 'قرارات عشوائية، لا توجّه معلن.', rating: 1 },
      { text: 'رؤية موثّقة + خطة سنوية معتمَدة.', rating: 3 },
      { text: 'استراتيجية مدفوعة بالبيانات + مراجعة دورية + مواءمة عبر الأقسام.', rating: 5 },
    ],
  },
  {
    key: 'structure', labelAr: 'الهيكل التنظيمي', icon: '🏢',
    descAr: 'التسلسل، فرق العمل، الأدوار، التقارير.',
    templates: [
      { text: 'هيكل غير رسمي، أدوار متداخلة.', rating: 1 },
      { text: 'هيكل موثّق + مسؤوليات موزّعة.', rating: 3 },
      { text: 'هيكل مرن يدعم الاستراتيجية + مراجعة دورية + مصفوفة RACI.', rating: 5 },
    ],
  },
  {
    key: 'systems', labelAr: 'الأنظمة', icon: '⚙️',
    descAr: 'الإجراءات، السياسات، الأدوات التقنية.',
    templates: [
      { text: 'عمليات يدوية، بلا SOPs.', rating: 1 },
      { text: 'SOPs مطبّقة + أنظمة أساسية (ERP/CRM).', rating: 3 },
      { text: 'أتمتة كاملة + BI + تكامل شامل بين الأنظمة.', rating: 5 },
    ],
  },
  {
    key: 'style', labelAr: 'النمط القيادي', icon: '👑',
    descAr: 'أسلوب اتخاذ القرار، ثقافة القيادة.',
    templates: [
      { text: 'قيادة تحكّمية أو غائبة.', rating: 1 },
      { text: 'قيادة تشاركية + تفويض واضح.', rating: 3 },
      { text: 'قيادة ملهمة تدعم الابتكار + Coaching + تمكين.', rating: 5 },
    ],
  },
  {
    key: 'staff', labelAr: 'الفريق', icon: '👥',
    descAr: 'الكفاءة، الحجم، التنوّع، الاحتفاظ.',
    templates: [
      { text: 'دوران عالٍ + نقص كفاءات.', rating: 1 },
      { text: 'فريق مستقر + برنامج تطوير سنوي.', rating: 3 },
      { text: 'فريق عالي الأداء + تخطيط تعاقب + خبرة متنوّعة.', rating: 5 },
    ],
  },
  {
    key: 'skills', labelAr: 'المهارات', icon: '🎓',
    descAr: 'الكفاءات الجوهرية، القدرات الفريدة.',
    templates: [
      { text: 'مهارات أساسية بلا تميّز.', rating: 1 },
      { text: 'مهارات موثّقة + تدريب دوري.', rating: 3 },
      { text: 'قدرات جوهرية استراتيجية + تعلّم مستمر + بناء داخلي.', rating: 5 },
    ],
  },
  {
    key: 'shared_values', labelAr: 'القيم المشتركة', icon: '💎',
    descAr: 'الثقافة، الرسالة، المبادئ التوجيهية.',
    templates: [
      { text: 'قيم غير معلنة أو غير مطبّقة.', rating: 1 },
      { text: 'قيم موثّقة + تُذكر في المناسبات.', rating: 3 },
      { text: 'قيم مطبّقة يومياً + تُقاس + جزء من التقييم.', rating: 5 },
    ],
  },
]

interface Data {
  aspects: Record<string, { text: string; rating: 1 | 2 | 3 | 4 | 5 }>
}

const EMPTY: Data = {
  aspects: Object.fromEntries(ASPECTS.map((a) => [a.key, { text: '', rating: 3 as const }])),
}

export function InternalEnvironmentPage() {
  const user = useAuthStore((s) => s.user)
  const isDeptScoped =
    user?.userType === 'MANAGER' &&
    user?.managerType === 'INDEPENDENT_PRO' &&
    user?.specialtyDeptType != null

  const specialty = user?.specialtyDeptType ?? null
  const title = isDeptScoped
    ? `البيئة الداخلية — إدارة ${DEPT_LABEL[specialty as DeptCode]}`
    : 'البيئة الداخلية'
  const description = isDeptScoped
    ? 'تقييم إدارة العميل بنموذج 7S — استراتيجية/هيكل/أنظمة/قيادة/فريق/مهارات/قيم.'
    : 'تقييم البيئة الداخلية للشركة بنموذج McKinsey 7S.'

  return (
    <StrategicShell title={title} description={description}>
      {(companyId) => (
        <Editor
          companyId={companyId}
          specialty={isDeptScoped ? (specialty as DeptCode) : null}
        />
      )}
    </StrategicShell>
  )
}

function Editor({ companyId, specialty }: { companyId: string; specialty: DeptCode | null }) {
  const artifactType: ArtifactType = specialty ? `INTERNAL_ENV_${specialty}` : 'INTERNAL_ENV'
  const [data, setData] = useState<Data>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [deptScores, setDeptScores] = useState<{ gov: number; fin: number; team: number; digital: number } | null>(null)

  useEffect(() => {
    getArtifact<Data>(companyId, artifactType).then((row) => {
      if (row?.data?.aspects) {
        setData({ aspects: { ...EMPTY.aspects, ...row.data.aspects } })
        setSavedAt(row.updatedAt)
      }
    }).catch(() => undefined)
    // آخر تدقيق لتخصّص المدير (لعرض بطاقة مرجعية).
    if (specialty) {
      listDepartments(companyId).then((deps: Department[]) => {
        const d = deps.find((x) => x.type === specialty)
        if (d?.auditData) {
          setDeptScores({
            gov: d.auditData.governance,
            fin: d.auditData.financial,
            team: d.auditData.team,
            digital: d.auditData.digital,
          })
        }
      }).catch(() => undefined)
    }
  }, [companyId, artifactType, specialty])

  function update(key: string, patch: Partial<{ text: string; rating: 1 | 2 | 3 | 4 | 5 }>) {
    setData((p) => ({
      aspects: {
        ...p.aspects,
        [key]: { ...(p.aspects[key] ?? { text: '', rating: 3 as const }), ...patch },
      },
    }))
  }

  async function save() {
    setSaving(true)
    try {
      const saved = await upsertArtifact(companyId, artifactType, data)
      setSavedAt(saved.updatedAt)
      toast.success('تم حفظ تقييم البيئة الداخلية')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  // ─── 🧠 توليد تلقائي من التحليل العميق + التدقيق ─────────────────
  // المصدر: DeptAudit.scores (governance/financial/team/digital) —
  // أرقام 0..100 محسوبة سلفاً. نُحوّلها إلى تقييم 7S بمعادلات ترجيح:
  //   Strategy       ← financial (100%)
  //   Structure      ← governance (100%)
  //   Systems        ← (financial + digital)/2
  //   Style          ← 0.7*governance + 0.3*team
  //   Staff          ← team (100%)
  //   Skills         ← 0.7*team + 0.3*digital
  //   Shared Values  ← 0.6*governance + 0.4*team
  // كل قيمة تُحوَّل إلى rating 1..5 ثم نختار القالب الأقرب.
  async function generateFromContext() {
    setGenerating(true)
    try {
      // مصدر ١: DeptAudit (الأولوية).
      let scores = deptScores
      if (!scores && specialty) {
        const deps = await listDepartments(companyId)
        const d = deps.find((x) => x.type === specialty)
        if (d?.auditData) {
          scores = {
            gov: d.auditData.governance,
            fin: d.auditData.financial,
            team: d.auditData.team,
            digital: d.auditData.digital,
          }
          setDeptScores(scores)
        }
      }

      // مصدر ٢: DEPT_DEEP_FULL كوصف نصّي داعم (ليس تقييماً).
      let deepAvailable = false
      try {
        const deep = await getArtifact<{ deptCode: string; answers: Record<string, string | string[]> }>(
          companyId, 'DEPT_DEEP_FULL',
        )
        deepAvailable = Boolean(deep?.data?.answers && Object.keys(deep.data.answers).length > 0)
      } catch { /* deep غير مطلوب — نتخطّى */ }

      if (!scores) {
        toast.error(
          deepAvailable
            ? 'التحليل العميق موجود لكن لا يوجد تدقيق برقم صحّة — أَجرِ تدقيقاً أساسياً أوّلاً.'
            : 'لا بيانات كافية — ابدأ بالتحليل العميق أو التدقيق الأساسي أوّلاً.',
        )
        return
      }

      // معادلات المزج → 0..100 → rating 1..5.
      const toRating = (v: number): 1 | 2 | 3 | 4 | 5 => {
        if (v >= 80) return 5
        if (v >= 60) return 4
        if (v >= 40) return 3
        if (v >= 20) return 2
        return 1
      }
      const RATINGS: Record<string, 1 | 2 | 3 | 4 | 5> = {
        strategy:      toRating(scores.fin),
        structure:     toRating(scores.gov),
        systems:       toRating((scores.fin + scores.digital) / 2),
        style:         toRating(scores.gov * 0.7 + scores.team * 0.3),
        staff:         toRating(scores.team),
        skills:        toRating(scores.team * 0.7 + scores.digital * 0.3),
        shared_values: toRating(scores.gov * 0.6 + scores.team * 0.4),
      }

      // اختر القالب الأقرب من الثلاثة (1/3/5) — يضبط النص والدرجة.
      const nextAspects: Data['aspects'] = { ...data.aspects }
      for (const asp of ASPECTS) {
        const target = RATINGS[asp.key]
        const template = asp.templates.reduce((best, t) =>
          Math.abs(t.rating - target) < Math.abs(best.rating - target) ? t : best,
        asp.templates[0])
        nextAspects[asp.key] = { text: template.text, rating: template.rating }
      }
      setData({ aspects: nextAspects })

      toast.success(
        deepAvailable
          ? '🧠 تم التوليد من التدقيق + التحليل العميق — راجع النصوص وعدّلها.'
          : '🧠 تم التوليد من التدقيق — يمكن تحسين النتائج بإكمال التحليل العميق.',
      )
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر التوليد التلقائي'))
    } finally {
      setGenerating(false)
    }
  }

  const avg = useMemo(() => {
    const list = ASPECTS.map((a) => data.aspects[a.key]?.rating ?? 3)
    return Math.round((list.reduce((s, v) => s + v, 0) / list.length) * 20)
  }, [data])

  return (
    <>
      {/* السياق — يوضّح النطاق: شركة أم إدارة */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-wrap items-center gap-3 p-3 text-xs">
          <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
            🎯 السياق: {specialty ? `إدارة ${DEPT_LABEL[specialty]} فقط` : 'الشركة كاملة'}
          </span>
          <span className="text-muted-foreground">
            نموذج McKinsey 7S — ٧ أبعاد ترسم صورة كاملة عن البيئة الداخلية.
          </span>
          {savedAt && (
            <span className="ml-auto text-muted-foreground">
              آخر حفظ: {new Date(savedAt).toLocaleDateString('ar-SA')}
            </span>
          )}
        </CardContent>
      </Card>

      {/* 🧠 توليد ذاتي من التحليل العميق + التدقيق — الزر الأهم */}
      <Card className="border-primary/40 bg-gradient-to-l from-primary/15 to-primary/5">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="text-3xl" aria-hidden>🧠</div>
            <div>
              <div className="text-sm font-bold">توليد تلقائي من بياناتك</div>
              <div className="text-xs text-muted-foreground">
                نقرأ التحليل العميق + التدقيق ونملأ الأبعاد السبعة تلقائياً بدرجات ونصوص مبنيّة على أرقامك.
              </div>
            </div>
          </div>
          <Button onClick={generateFromContext} disabled={generating || saving} size="lg">
            {generating ? 'جاري التوليد…' : '✨ ولّد الآن'}
          </Button>
        </CardContent>
      </Card>

      {/* بطاقة مرجعية من آخر تدقيق (لو دخلنا من مسار المدير) */}
      {deptScores && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">📊 مرجع من آخر تدقيق</CardTitle>
            <CardDescription>درجات ٤ محاور — تُستخدم لتوليد التقييم السباعي أعلاه.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-4">
            <RefScore label="حوكمة" value={deptScores.gov} />
            <RefScore label="مالي" value={deptScores.fin} />
            <RefScore label="فريق" value={deptScores.team} />
            <RefScore label="رقمي" value={deptScores.digital} />
          </CardContent>
        </Card>
      )}

      {/* لا تدقيق + مدير مستقل → CTA */}
      {!deptScores && specialty && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="flex items-center gap-3 p-3 text-xs">
            <span className="text-lg">💡</span>
            <span className="flex-1">
              التدقيق الأساسي يعطي درجات مرجعية لتقييم البيئة الداخلية أدناه بدقّة أعلى.
            </span>
            <Link
              to={`/manager/deep-analysis?client=${companyId}`}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              ابدأ التحليل العميق
            </Link>
          </CardContent>
        </Card>
      )}

      {/* متوسط النضج */}
      <Card className="overflow-hidden border-emerald-200 bg-gradient-to-bl from-emerald-500/10 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-teal-500 to-sky-500" />
        <CardHeader>
          <CardTitle>متوسط نضج البيئة الداخلية</CardTitle>
          <CardDescription>متوسط تقييم كل الأبعاد السبعة.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-3xl font-bold tabular-nums text-emerald-700">{avg}%</div>
          <Progress value={avg} className="h-2" />
        </CardContent>
      </Card>

      {/* الأبعاد السبعة */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ASPECTS.map((a) => (
          <AspectCard key={a.key} aspect={a} value={data.aspects[a.key] ?? { text: '', rating: 3 }} onChange={(patch) => update(a.key, patch)} />
        ))}
      </div>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-lg">
          {saving ? 'جاري الحفظ…' : 'حفظ البيئة الداخلية'}
        </Button>
      </div>
    </>
  )
}

function RefScore({ label, value }: { label: string; value: number }) {
  const v = Math.round(value)
  const tint = v >= 70 ? 'text-emerald-700 bg-emerald-50' : v >= 40 ? 'text-amber-700 bg-amber-50' : 'text-rose-700 bg-rose-50'
  return (
    <div className={`rounded-md border p-2 text-center ${tint}`}>
      <div className="text-[10px] uppercase tracking-wider">{label}</div>
      <div className="text-lg font-bold tabular-nums">{v}%</div>
    </div>
  )
}

function AspectCard({
  aspect, value, onChange,
}: {
  aspect: Aspect
  value: { text: string; rating: 1 | 2 | 3 | 4 | 5 }
  onChange: (patch: Partial<{ text: string; rating: 1 | 2 | 3 | 4 | 5 }>) => void
}) {
  return (
    <div className="rounded-xl border bg-sky-50/30 p-3">
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>{aspect.icon}</span>
        <h4 className="text-sm font-semibold">{aspect.labelAr}</h4>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{aspect.descAr}</p>
      <Textarea
        rows={2}
        className="mt-2 bg-background"
        value={value.text}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="وصف الحالة الراهنة…"
      />
      <div className="mt-2 space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">اختر ما يصفك:</div>
        {aspect.templates.map((t) => {
          const chosen = value.text === t.text
          return (
            <button
              key={t.text}
              type="button"
              onClick={() => onChange({ text: t.text, rating: t.rating })}
              className={`block w-full rounded-md border px-2 py-1 text-right text-[11px] transition ${
                chosen
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-muted-foreground/20 bg-background/60 hover:bg-primary/5'
              }`}
            >
              <span className="tabular-nums font-bold text-muted-foreground">{t.rating}★</span>
              <span className="mr-1.5">{t.text}</span>
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">النضج:</span>
        <select
          className="rounded-md border bg-background px-2 py-1"
          value={value.rating}
          onChange={(e) => onChange({ rating: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 })}
        >
          {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
    </div>
  )
}
