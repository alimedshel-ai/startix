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

// ════════════════════════════════════════════════════════════════════
// النموذج الجديد (خطّة الإصلاح ن٢ · الموجة ١) — يحلّ محلّ ما فوق تدريجيّاً.
// ملاحظة: مضاف بجانب القديم عمداً؛ الأسطح تُرحَّل إليه في الموجة ٢ ثم يُحذف
// القديم. الفرق الجوهريّ: خطوات دلاليّة (المحور الأضعف → إجراء تصحيحيّ →
// مبادرة عاجلة → إعادة تدقيق) بدل أدوات (خريطة/أيزنهاور/RACI/جانت)، مع
// **منع الحلقة بنيويّاً**: إعادة التدقيق (٤) غير قابلة للعرض قبل إتمام ٢ و٣.
// شرط الخروج: التدقيق ≥ ٤٠٪ (criticalHealth=false) — لا إتمام الخطوات.
// ════════════════════════════════════════════════════════════════════

export type RescueStepId = 'axis' | 'challenges' | 'action' | 'initiative' | 'reaudit'
export type AuditAxis = 'governance' | 'financial' | 'team' | 'digital'

export interface RescuePlanStep {
  /** رقم الخطوة (١-٥) — الترتيب يمنع الحلقة بنيويّاً. */
  n: 1 | 2 | 3 | 4 | 5
  id: RescueStepId
  icon: string
  label: string
  /** لماذا هذه الخطوة الآن. */
  why: string
  /** شرط الانتقال للتي تليها (توثيق للسلوك). */
  transition: string
  /** خطوة اختياريّة (challenges): تُعرَض وتُمرَّر بالتخطّي، ولا تُعدّ في doneCount. */
  optional?: boolean
}

export const RESCUE_PLAN: RescuePlanStep[] = [
  { n: 1, id: 'axis',       icon: '🔍', label: 'حدّد المحور الأضعف', why: 'اختر المحور الأدنى من محاور الصحّة الأربعة (حوكمة/مالي/فريق/رقمي) لتركّز جهدك عليه.', transition: 'اختيار محور واحد' },
  // خطوة اختياريّة: العميل يعرف واقعه — يضيف حتى 3 تحدّيات تُثري الإجراء (التالي).
  // التخطّي مشروع (challengesVisited عبر وجود artifact، لا محتواه — درس ق٥).
  { n: 2, id: 'challenges', icon: '📝', label: 'أضف تحدّياتك (اختياريّ)', why: 'أضف حتى 3 تحدّيات تعرفها — تُوجّه الإجراء التصحيحيّ. أو تخطّاها وواصِل بالتشخيص.', transition: 'إضافة ≤3 أو تخطّي', optional: true },
  { n: 3, id: 'action',     icon: '🔧', label: 'إجراء تصحيحيّ واحد', why: 'نفّذ إجراءً واحداً من بنك المقترحات السعوديّ على المحور المختار.', transition: 'تسجيل الإجراء كمنفّذ' },
  // الخطوة ٣ — قرار محسوم: الإنشاء inline في شاشة الإنقاذ (ممنوع navigate إلى ⑤
  // لأنها قد تكون مقفلة في LONG). البيانات في فضاء ⑤ بوسم source:'rescue'
  // و linkedActionId (ربط بإجراء ٢)، وتظهر لاحقاً بشارة «من الإنقاذ 🚨».
  // الاكتمال عبر listInitiatives(clientId).some(i => i.source === 'rescue').
  { n: 4, id: 'initiative', icon: '💡', label: 'مبادرة عاجلة',       why: 'أنشئ مبادرة عاجلة مرتبطة بالإجراء التصحيحيّ في المرحلة ⑤.', transition: 'إنشاء المبادرة' },
  { n: 5, id: 'reaudit',    icon: '🔁', label: 'أعِد التدقيق',       why: 'الخروج من المنطقة الحمراء يتأكّد بإعادة التدقيق (≥٤٠٪)، لا بمجرّد فعل الخطوات.', transition: 'لا تُعرَض إلا بعد إتمام ٢ و٣' },
]

export interface RescueProgress {
  /** خطوة ١ — اختير المحور الأضعف. */
  axisPicked: boolean
  /** خطوة ٢ — سُجّل الإجراء التصحيحيّ كمنفّذ. */
  actionRecorded: boolean
  /** خطوة ٣ — أُنشئت المبادرة العاجلة (من listInitiatives). */
  initiativeCreated: boolean
  /** خطوة اختياريّة — زار العميل شاشة التحدّيات (أضاف أو تخطّى). اختياريّ للتوافق:
   *  غياب/undefined = لم يُزَر بعد. المصدر: **وجود** artifact RESCUE_CHALLENGES. */
  challengesVisited?: boolean
}

export interface RescuePlanState {
  /** الحالة الحرجة تفعّل الإنقاذ (درجة تدقيق < ٤٠٪). */
  criticalHealth: boolean
  healthPct: number | null
  progress: RescueProgress
}

export interface RescuePlanResult {
  kind: 'inactive' | 'active'
  /** الخطوة الحاليّة — فقط عند kind='active'. */
  step?: RescuePlanStep
  doneCount: number
  total: 4
  /** هل الخطوة الحاليّة هي إعادة التدقيق (٢و٣ تمّتا)؟ */
  atReaudit: boolean
}

/** نقيّة: تُرجع خطوة الإنقاذ الحاليّة بالترتيب الصارم (إعادة التدقيق بعد ٢و٣ حصراً). */
export function resolveRescuePlan(s: RescuePlanState): RescuePlanResult {
  const { axisPicked, challengesVisited, actionRecorded, initiativeCreated } = s.progress
  // doneCount = الإلزاميّة الثلاث فقط — challenges اختياريّ لا يُعدّ (total يبقى 4).
  const doneCount = [axisPicked, actionRecorded, initiativeCreated].filter(Boolean).length

  // (inactive) — لا طوارئ: المحرّك الطبيعيّ يتولّى «التالي». يشمل «لا صحّة بعد»
  // (بلا تدقيق لا تُقيَّم الحرجيّة → الإنقاذ غير نشط إطلاقاً).
  if (!s.criticalHealth) return { kind: 'inactive', doneCount, total: 4, atReaudit: false }

  // اختيار بالمعرّف لا بالموضع (صامد لترتيب المصفوفة). challenges اعتراضيّة اختياريّة
  // بعد axis وقبل action؛ التخطّي (challengesVisited=true) يمرّرها. الترتيب الصارم
  // يمنع الحلقة: إعادة التدقيق لا تُبلَغ إلا بعد ٢و٣.
  const byId = (id: RescueStepId) => RESCUE_PLAN.find((st) => st.id === id)!
  const step =
    !axisPicked ? byId('axis')
    : !challengesVisited ? byId('challenges')
    : !actionRecorded ? byId('action')
    : !initiativeCreated ? byId('initiative')
    : byId('reaudit')
  return { kind: 'active', step, doneCount, total: 4, atReaudit: step.id === 'reaudit' }
}

/** نقيّة: المحور الأدنى من الأربعة (خطوة ١ — تُشتقّ من التدقيق لا تُخزَّن). */
export function pickWeakestAxis(scores: Record<AuditAxis, number>): AuditAxis {
  const axes: AuditAxis[] = ['governance', 'financial', 'team', 'digital']
  return axes.reduce((min, a) => (scores[a] < scores[min] ? a : min), axes[0])
}
