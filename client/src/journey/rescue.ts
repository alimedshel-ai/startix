// ─── منطق «وعي الطوارئ» — نقيّ، طبقة فوق المحرّك (لا داخله) ───────────
// ⚠️ هذا الملف لا يستورد useJourney ولا أيّ سطح — دالّة صرفة قابلة للاختبار
// معزولةً، تماماً كنمط journey/nextStep.ts. تُربط لاحقاً *فوق* القمرة فقط،
// فتبقى مراحل المحرّك المشترك والأسطح الـ٢٥ سليمة تماماً.
//
// القاعدة (مُعتمَدة على الورق قبل الكود):
//   • التفعيل: criticalHealth (درجة تدقيق الإدارة < ٤٠٪). غيرها → inactive.
//   • التسلسل: خريطة المخاطر → أيزنهاور → RACI → جانت (خطّيّ، «التالي» = أوّل ناقصة).
//   • الخروج: الأربع تمّت → rescue-done · الصحّة تعافت → inactive (لا يُفعَّل).

export interface RescueDone {
  risk: boolean
  eisenhower: boolean
  raci: boolean
  gantt: boolean
}

export interface RescueState {
  /** الحالة الحرجة تفعّل الإنقاذ (درجة تدقيق < ٤٠٪). */
  criticalHealth: boolean
  /** اكتمال كل خطوة إنقاذ (من artifacts/مشاريع — يحسبها الغلاف، لا هذه الدالّة). */
  done: RescueDone
}

export type RescueKind = 'inactive' | 'rescue' | 'rescue-done'

export interface RescueStep {
  id: keyof RescueDone
  icon: string
  /** فعل مختصر. */
  label: string
  /** اسم الأداة. */
  tool: string
  /** وجهة الأداة — بلا ?client (يُضيفه الغلاف). */
  toolPath: string
  /** لماذا هذه الخطوة الآن. */
  why: string
}

export interface RescueResult {
  kind: RescueKind
  /** الخطوة التالية — فقط عند kind='rescue'. */
  step?: RescueStep
  doneCount: number
  total: number
}

// التسلسل الثابت لخطة الإنقاذ العاجلة (٩٠ يوم — إيقاف النزيف أوّلاً).
export const RESCUE_SEQUENCE: RescueStep[] = [
  { id: 'risk',       icon: '⚠️', label: 'أوقف النزيف',   tool: 'خريطة المخاطر', toolPath: '/risk-map',    why: 'احصر ما يستنزفك الآن وسجّله قبل أيّ شيء آخر.' },
  { id: 'eisenhower', icon: '🎯', label: 'اُفرز فوراً',    tool: 'أيزنهاور',      toolPath: '/eisenhower',  why: 'افرز المشاكل: افعل الآن / فوّض / احذف.' },
  { id: 'raci',       icon: '👥', label: 'حدّد المسؤول',   tool: 'RACI',          toolPath: '/raci',        why: 'من مسؤول عن كل تحرّك عاجل — بلا فراغ.' },
  { id: 'gantt',      icon: '📅', label: 'راقب أسبوعياً',  tool: 'مخطّط جانت',    toolPath: '/gantt-chart', why: 'رتّب الأفعال على خطّ زمنيّ للأسابيع الـ١٢.' },
]

/** نقيّة: تأخذ الحالة وتُرجع خطوة الإنقاذ التالية (أو inactive/done). */
export function getRescueNext(s: RescueState): RescueResult {
  const flags = RESCUE_SEQUENCE.map((step) => s.done[step.id])
  const doneCount = flags.filter(Boolean).length
  const total = RESCUE_SEQUENCE.length

  // (inactive) — لا طوارئ: المحرّك الطبيعيّ يتولّى «التالي».
  if (!s.criticalHealth) return { kind: 'inactive', doneCount, total }

  // «التالي» = أوّل خطوة ناقصة بالترتيب (يفرض التسلسل: لا جانت قبل المخاطر).
  const idx = flags.findIndex((done) => !done)

  // (rescue-done) — كل خطوات الإنقاذ نُفِّذت، **لكن الصحّة ما زالت حرجة**
  // (criticalHealth). فعْل الخطوات ≠ الخروج من الحمراء — الغلاف يوجّه لإعادة
  // التدقيق للتأكّد من التعافي. حين يتعافى فعلاً → criticalHealth=false → inactive.
  if (idx === -1) return { kind: 'rescue-done', doneCount, total }

  return { kind: 'rescue', step: RESCUE_SEQUENCE[idx], doneCount, total }
}
