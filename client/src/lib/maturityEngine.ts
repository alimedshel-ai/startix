// ─── إطار تقييم النضج المعمّم (config-driven) ──────────────────────
// محرّك واحد يخدم كل التخصّصات: كل تخصّص = MaturityConfig (أقسامه وأسئلته
// المُنقّطة + فئات تصنيفه). يحلّ محلّ المحرّكات المكرّرة (HR، المالية، …).
//
// البنية: قسم = ١٠ أسئلة (عادةً)، كل سؤال اختيارات مُنقّطة (٠-١٠). درجة
// القسم = مجموع النقاط؛ نضج القسم٪ = الدرجة/الأقصى. النضج الكلّي = متوسّط
// نسب الأقسام. التصنيف من فئات الـconfig.

export interface MaturityOption { label: string; points: number }
export interface MaturityQuestion { id: string; text: string; options: MaturityOption[] }
export interface MaturitySection {
  key: string
  labelAr: string
  icon: string
  /** توصية تُعرض عند ضعف القسم (وتُستخدم لتوليد مبادرة). */
  recommendation: string
  questions: MaturityQuestion[]
}
/** فئة نضج — تُختار أعلى فئة `minPct` ≤ النسبة. */
export interface MaturityLevel {
  key: string
  minPct: number
  emoji: string
  labelAr: string
  cls: string
}
export interface MaturityConfig {
  /** رمز التخصّص (HR / FINANCE / …). */
  specialty: string
  titleAr: string
  descAr: string
  /** مفتاح مسودّة ما-قبل-التسجيل في localStorage. */
  draftKey: string
  sections: MaturitySection[]
  /** الفئات — أيّ ترتيب؛ يُرتَّب داخلياً تنازلياً بـ minPct. */
  levels: MaturityLevel[]
}

export type MaturityAnswers = Record<string, number> // questionId → option index

// ─── حسابات ────────────────────────────────────────────────────────
function questionMax(q: MaturityQuestion): number {
  return q.options.length ? Math.max(...q.options.map((o) => o.points)) : 0
}

export function sectionMax(section: MaturitySection): number {
  return section.questions.reduce((s, q) => s + questionMax(q), 0)
}

export function sectionScore(section: MaturitySection, answers: MaturityAnswers): number {
  return section.questions.reduce((sum, q) => {
    const idx = answers[q.id]
    return sum + (idx == null ? 0 : q.options[idx]?.points ?? 0)
  }, 0)
}

export function sectionAnswered(section: MaturitySection, answers: MaturityAnswers): number {
  return section.questions.filter((q) => answers[q.id] != null).length
}

export function levelOf(config: MaturityConfig, pct: number): MaturityLevel {
  const sorted = [...config.levels].sort((a, b) => b.minPct - a.minPct)
  return sorted.find((l) => pct >= l.minPct) ?? sorted[sorted.length - 1]
}

export interface SectionResult {
  key: string
  labelAr: string
  icon: string
  score: number
  max: number
  pct: number
  level: MaturityLevel
  recommendation: string
  answered: number
  total: number
}

export function computeResults(config: MaturityConfig, answers: MaturityAnswers): SectionResult[] {
  return config.sections.map((s) => {
    const score = sectionScore(s, answers)
    const max = sectionMax(s)
    const pct = max > 0 ? Math.round((score / max) * 100) : 0
    return {
      key: s.key, labelAr: s.labelAr, icon: s.icon,
      score, max, pct, level: levelOf(config, pct),
      recommendation: s.recommendation,
      answered: sectionAnswered(s, answers), total: s.questions.length,
    }
  })
}

export interface MaturityOverall {
  maturityPct: number
  level: MaturityLevel
  strongest: SectionResult | null
  weakest: SectionResult | null
  answeredTotal: number
  totalQuestions: number
}

export function computeOverall(config: MaturityConfig, answers: MaturityAnswers): MaturityOverall {
  const results = computeResults(config, answers)
  const maturityPct = results.length ? Math.round(results.reduce((a, r) => a + r.pct, 0) / results.length) : 0
  const sorted = [...results].sort((a, b) => b.pct - a.pct)
  const answeredTotal = results.reduce((a, r) => a + r.answered, 0)
  const totalQuestions = config.sections.reduce((a, s) => a + s.questions.length, 0)
  return {
    maturityPct,
    level: levelOf(config, maturityPct),
    strongest: sorted[0] ?? null,
    weakest: sorted[sorted.length - 1] ?? null,
    answeredTotal,
    totalQuestions,
  }
}

export function allAnswered(config: MaturityConfig, answers: MaturityAnswers): boolean {
  return config.sections.every((s) => sectionAnswered(s, answers) === s.questions.length)
}

// ─── مساعدة مشتركة للألوان: أوّل صنف bg- في cls ──────────────────────
export function barBgOf(level: MaturityLevel): string {
  return level.cls.split(' ').find((c) => c.startsWith('bg-')) ?? 'bg-primary'
}
