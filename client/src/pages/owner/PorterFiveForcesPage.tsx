import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadarChart } from '@/components/charts/RadarChart'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_LABEL, listDepartments, type DeptCode } from '@/lib/deptApi'
import { DEPT_PORTER, type ForceKey } from '@/lib/deptPorter'
import { getArtifact, upsertArtifact, type ArtifactType } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

interface Force {
  rating: 1 | 2 | 3 | 4 | 5
  notes: string
}

interface PorterData {
  rivalry: Force
  supplierPower: Force
  buyerPower: Force
  substitutes: Force
  newEntrants: Force
}

const EMPTY: PorterData = {
  rivalry:       { rating: 3, notes: '' },
  supplierPower: { rating: 3, notes: '' },
  buyerPower:    { rating: 3, notes: '' },
  substitutes:   { rating: 3, notes: '' },
  newEntrants:   { rating: 3, notes: '' },
}

const FORCES: { key: keyof PorterData; label: string; description: string; icon: string; tint: string }[] = [
  { key: 'rivalry',       label: 'حدة المنافسة',       description: 'حدّة التنافس بين المنافسين الحاليين.',  icon: '⚔️', tint: 'border-rose-200 bg-rose-50/50' },
  { key: 'supplierPower', label: 'قوة الموردين',        description: 'مدى قدرة الموردين على رفع الأسعار.',     icon: '🏭', tint: 'border-amber-200 bg-amber-50/50' },
  { key: 'buyerPower',    label: 'قوة المشترين',        description: 'مدى قدرة العملاء على الضغط لخفض السعر.',  icon: '🛒', tint: 'border-emerald-200 bg-emerald-50/50' },
  { key: 'substitutes',   label: 'تهديد البدائل',       description: 'بدائل من خارج الصناعة.',                  icon: '🔄', tint: 'border-violet-200 bg-violet-50/50' },
  { key: 'newEntrants',   label: 'تهديد الداخلين الجدد', description: 'سهولة دخول لاعبين جدد للسوق.',           icon: '🚪', tint: 'border-sky-200 bg-sky-50/50' },
]

// S2.1 — مقترحات جاهزة لكل قوة تُضاف إلى notes بضغطة واحدة.
const SUGGESTIONS: Record<keyof PorterData, string[]> = {
  rivalry: [
    'عدد كبير من المنافسين بحصص متقاربة',
    'تشابه المنتجات → منافسة سعرية',
    'تكاليف تبديل منخفضة للعميل',
    'نمو السوق بطيء → حرب حصص',
    'حواجز خروج عالية (استثمارات ثابتة)',
  ],
  supplierPower: [
    'عدد قليل من الموردين المسيطرين',
    'مواد أوّلية بلا بدائل قريبة',
    'تكلفة تبديل المورّد مرتفعة',
    'خطر تكامل رأسي أمامي من المورّد',
    'حجم مشترياتنا صغير مقارنة بحجم المورّد',
  ],
  buyerPower: [
    'عدد قليل من العملاء يمثّلون أغلب الإيرادات',
    'العملاء يشترون بكميات ضخمة',
    'المنتج قابل للاستبدال بسهولة',
    'العميل حساس جداً للسعر',
    'خطر تكامل عكسي (العميل يُصنع بنفسه)',
  ],
  substitutes: [
    'وجود بدائل رقمية للمنتج التقليدي',
    'بدائل بسعر أقل من خارج الصناعة',
    'تحسّن الأداء/الميّزات في البدائل',
    'ميل ثقافي للانتقال للبديل (استدامة، صحّة)',
    'تكلفة تبديل العميل للبديل منخفضة',
  ],
  newEntrants: [
    'رأس المال المطلوب للدخول منخفض',
    'التقنية متاحة ومفتوحة',
    'قنوات التوزيع سهلة (مثل الرقمي)',
    'لا توجد براءات اختراع أو حواجز تنظيمية',
    'ولاء العميل للعلامة ضعيف',
  ],
}

export function PorterFiveForcesPage() {
  const user = useAuthStore((s) => s.user)
  const isDeptScoped =
    user?.userType === 'MANAGER' &&
    user?.managerType === 'INDEPENDENT_PRO' &&
    user?.specialtyDeptType != null &&
    DEPT_PORTER[user.specialtyDeptType] != null
  const specialty = user?.specialtyDeptType ?? null
  const title = isDeptScoped
    ? `قوى بورتر — ${DEPT_LABEL[specialty as DeptCode]}`
    : 'قوى بورتر الخمس'
  const description = isDeptScoped
    ? 'قوى بورتر مُعاد تفسيرها في سياق إدارتك — كل قوة معناها مختلف عن التحليل الكلاسيكي للشركة.'
    : 'قيّم كل قوة من ١ (ضعيفة) إلى ٥ (قوية) مع ملاحظات.'
  return (
    <StrategicShell title={title} description={description}>
      {(companyId) => (
        <Editor companyId={companyId} specialty={isDeptScoped ? (specialty as DeptCode) : null} />
      )}
    </StrategicShell>
  )
}

function Editor({ companyId, specialty }: { companyId: string; specialty: DeptCode | null }) {
  const artifactType: ArtifactType = specialty ? `PORTER_${specialty}` : 'PORTER'
  const [data, setData] = useState<PorterData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    getArtifact<PorterData>(companyId, artifactType).then((row) => {
      if (row?.data) setData({ ...EMPTY, ...row.data })
    }).catch(() => undefined)
  }, [companyId, artifactType])

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, artifactType, data)
      toast.success('تم حفظ التحليل')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  // ─── 🧠 توليد تلقائي من التحليل السابق ──────────────────────────
  // يقرأ آخر تدقيق + البيئة الداخلية 7S + التحليل العميق (لو أيّ منها موجود)
  // ويستنبط:
  //   1) تقييم كل قوة (1..5) بناءً على درجات الصحة (منخفضة → قوى قوية).
  //   2) يُدرج مقترحات جاهزة من DEPT_PORTER إلى الملاحظات.
  async function generateFromContext() {
    setGenerating(true)
    try {
      let auditScores: { gov: number; fin: number; team: number; digital: number } | null = null
      if (specialty) {
        const deps = await listDepartments(companyId)
        const d = deps.find((x) => x.type === specialty)
        if (d?.auditData) {
          auditScores = {
            gov: d.auditData.governance,
            fin: d.auditData.financial,
            team: d.auditData.team,
            digital: d.auditData.digital,
          }
        }
      }

      let internalAvg: number | null = null
      const internalArt = await getArtifact<{ aspects: Record<string, { rating: number }> }>(
        companyId, specialty ? `INTERNAL_ENV_${specialty}` : 'INTERNAL_ENV',
      ).catch(() => null)
      if (internalArt?.data?.aspects) {
        const ratings = Object.values(internalArt.data.aspects).map((a) => a.rating)
        if (ratings.length > 0) {
          internalAvg = (ratings.reduce((s, v) => s + v, 0) / ratings.length) * 20 // → 0..100
        }
      }

      if (!auditScores && internalAvg == null) {
        toast.error('لا بيانات كافية — أَجرِ تدقيقاً أو أكمل البيئة الداخلية أوّلاً.')
        return
      }

      // مزج الإشارات → درجة صحّة إجمالية 0..100.
      const health =
        auditScores
          ? (auditScores.gov + auditScores.fin + auditScores.team + auditScores.digital) / 4
          : (internalAvg ?? 50)

      // كل قوة تُقيّم من إشارات مختلفة:
      //   • Rivalry     ← ضدّ digital (رقمي قوي = تميّز = منافسة أخفّ)
      //   • Supplier    ← ضدّ financial (مالي قوي = قوة تفاوض ضدّ الموردين)
      //   • Buyer       ← ضدّ (governance + team) (خدمة قوية = عميل أضعف)
      //   • Substitutes ← ضدّ digital (رقمي قوي = صعب استبداله)
      //   • Entrants    ← ضدّ (governance + financial) (حواجز أعلى)
      const toRating = (v: number): 1 | 2 | 3 | 4 | 5 => {
        // v = "قوة القوة" 0..100 (كلّما أعلى → القوة أشدّ ضغطاً علينا).
        if (v >= 80) return 5
        if (v >= 60) return 4
        if (v >= 40) return 3
        if (v >= 20) return 2
        return 1
      }
      const invert = (score: number) => 100 - score

      let ratings: Record<ForceKey, 1 | 2 | 3 | 4 | 5>
      if (auditScores) {
        ratings = {
          rivalry:       toRating(invert(auditScores.digital)),
          supplierPower: toRating(invert(auditScores.fin)),
          buyerPower:    toRating(invert((auditScores.gov + auditScores.team) / 2)),
          substitutes:   toRating(invert(auditScores.digital)),
          newEntrants:   toRating(invert((auditScores.gov + auditScores.fin) / 2)),
        }
      } else {
        // fallback على متوسط البيئة الداخلية.
        const uniform = toRating(invert(health))
        ratings = {
          rivalry: uniform, supplierPower: uniform, buyerPower: uniform,
          substitutes: uniform, newEntrants: uniform,
        }
      }

      // مقترحات نصية من بنك الإدارة (لو مدير مستقل).
      const deptConfig = specialty ? DEPT_PORTER[specialty] : null
      const nextData: PorterData = { ...data }
      let addedSuggestions = 0
      for (const f of FORCES) {
        const suggestions = deptConfig?.[f.key].suggestions ?? SUGGESTIONS[f.key]
        // نأخذ أول ٢-٣ اقتراحات ونُلحقها بالملاحظات بلا تكرار.
        const takeCount = ratings[f.key] >= 4 ? 3 : 2
        const current = nextData[f.key].notes.trim()
        const toAdd = suggestions.slice(0, takeCount).filter((s) => !current.includes(s))
        if (toAdd.length > 0) {
          const sep = current ? '\n• ' : '• '
          nextData[f.key] = {
            rating: ratings[f.key],
            notes: current + sep + toAdd.join('\n• '),
          }
          addedSuggestions += toAdd.length
        } else {
          nextData[f.key] = { ...nextData[f.key], rating: ratings[f.key] }
        }
      }
      setData(nextData)
      toast.success(
        auditScores
          ? `🧠 تم التوليد من التدقيق + ${addedSuggestions} اقتراح مخصّص لتخصّصك.`
          : `🧠 تم التوليد من البيئة الداخلية + ${addedSuggestions} اقتراح — يمكن تحسينه بتدقيق.`,
      )
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر التوليد التلقائي'))
    } finally {
      setGenerating(false)
    }
  }

  // بنك المقترحات: مخصّص للإدارة لو dept-scoped، وإلا العام.
  const deptConfig = specialty ? DEPT_PORTER[specialty] : null
  // لكل قوة: نصوص التسمية/الوصف (dept-scoped يعيد تفسير كل قوة).
  const forceMeta = (f: typeof FORCES[number]) => {
    if (deptConfig) {
      const d = deptConfig[f.key]
      return { label: d.labelAr, description: d.descAr, suggestions: d.suggestions }
    }
    return { label: f.label, description: f.description, suggestions: SUGGESTIONS[f.key] }
  }

  const radar = FORCES.map((f) => ({ axis: forceMeta(f).label, value: (data[f.key].rating / 5) * 100 }))

  return (
    <>
      {/* شارة السياق — يوضّح إن كانت أداة إدارة أو شركة كاملة */}
      {specialty && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3 p-3 text-xs">
            <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
              🎯 السياق: إدارة {DEPT_LABEL[specialty]} فقط
            </span>
            <span className="text-muted-foreground">
              كل قوة أُعيد تفسيرها لتناسب إدارتك (مثل: "المشترون" = العملاء الفعليون لخدمتك، ليس عملاء الشركة كلها).
            </span>
          </CardContent>
        </Card>
      )}

      {/* 🧠 توليد ذاتي من التحليل السابق */}
      <Card className="border-primary/40 bg-gradient-to-l from-primary/15 to-primary/5">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="text-3xl" aria-hidden>🧠</div>
            <div>
              <div className="text-sm font-bold">توليد تلقائي من التحليل السابق</div>
              <div className="text-xs text-muted-foreground">
                نقرأ التدقيق + البيئة الداخلية ونستنبط تقييمات الخمس قوى + مقترحات جاهزة لتخصّصك.
              </div>
            </div>
          </div>
          <Button onClick={generateFromContext} disabled={generating || saving} size="lg">
            {generating ? 'جاري التوليد…' : '✨ ولّد الآن'}
          </Button>
        </CardContent>
      </Card>

      {/* CTA لبدء التحليل السابق لو ما فيه بيانات */}
      {specialty && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="flex items-center gap-3 p-3 text-xs">
            <span>💡</span>
            <span className="flex-1">
              نتائج التوليد التلقائي أدق كلما زادت بياناتك — أَجرِ التدقيق الأساسي أو أكمل البيئة الداخلية أوّلاً.
            </span>
            <Link
              to={`/internal-environment?client=${companyId}`}
              className="rounded-md border bg-card px-3 py-1.5 hover:bg-accent"
            >
              البيئة الداخلية ←
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          {FORCES.map((f) => {
            const meta = forceMeta(f)
            return (
              <Card key={f.key} className={f.tint}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="text-xl">{f.icon}</span>
                    {meta.label}
                  </CardTitle>
                  <CardDescription>{meta.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">التقييم</Label>
                    <select
                      className="rounded-md border bg-background px-2 py-1 text-sm"
                      value={data[f.key].rating}
                      onChange={(e) => setData((p) => ({ ...p, [f.key]: { ...p[f.key], rating: Number(e.target.value) as Force['rating'] } }))}
                    >
                      {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <span className="text-xs text-muted-foreground">١ = ضعيفة · ٥ = قوية</span>
                  </div>
                  <Textarea
                    rows={3}
                    placeholder="ملاحظات…"
                    value={data[f.key].notes}
                    onChange={(e) => setData((p) => ({ ...p, [f.key]: { ...p[f.key], notes: e.target.value } }))}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {meta.suggestions.map((s) => {
                      const already = data[f.key].notes.includes(s)
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setData((p) => ({
                            ...p,
                            [f.key]: {
                              ...p[f.key],
                              notes: p[f.key].notes.trim() ? `${p[f.key].notes.trim()}\n• ${s}` : `• ${s}`,
                            },
                          }))}
                          disabled={already}
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] transition ${
                            already
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : 'border-muted-foreground/30 bg-card hover:bg-primary hover:text-primary-foreground'
                          }`}
                        >
                          {already ? '✓ ' : '＋ '}{s}
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          })}
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving || generating}>{saving ? 'جاري الحفظ…' : 'حفظ'}</Button>
          </div>
        </div>

        <Card className="bg-gradient-to-br from-primary/5 to-violet-500/5">
          <CardHeader>
            <CardTitle>الخماسي</CardTitle>
            <CardDescription>عرض مرئي لضغط القوى.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadarChart data={radar} height={360} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
