// ═══════════════════════════════════════════════════════════════════════════
// 🔒 استثناء موثّق للقانون الأول — لا استثناءات أخرى في كامل الكلاينت.
// ═══════════════════════════════════════════════════════════════════════════
//
// القانون الأول لـ startix: مصدر الحقيقة الوحيد لبيانات العمل = القاعدة عبر API.
// ممنوع استخدام localStorage/sessionStorage/persist لتخزين تشخيصات، SWOT، أهداف،
// KPIs، تقارير، مالية، أو تقويم استراتيجي.
//
// هذا الملف يكسر القانون بشكل ضيّق ومقصود — بموافقة صريحة موثّقة — لسبب واحد:
//
//   دعم تدفّق "جرّب التشخيص قبل التسجيل" (TryDiagnosticPage). الزائر مجهول ولا
//   يملك حساباً بعد، لذا لا يمكن الكتابة للـ API. نحفظ إجاباته + النتيجة محلياً
//   عبر Zustand `persist` تحت المفتاح `startix-diagnostic` بشكل انتقالي، حتى
//   يسجّل حساباً فيتولّى OnboardingPage نقل هذه البيانات للقاعدة الرسمية.
//
// دورة الحياة الكاملة:
//   1. زائر يفتح /diagnostic/try → يختار دوره → يجيب الأسئلة.
//   2. عند إكمال الأسئلة يُستدعى POST /api/diagnostic/preview[/manager|investor]
//      (نقاط عامة بدون auth، تحسب النتيجة بلا حفظ). نحفظ الإجابات + النتيجة
//      + العلم `pendingPersist = true` هنا (localStorage).
//   3. الزائر يضغط "احفظ نتيجتي" → يُوجَّه لـ /select-type ثم /join للتسجيل.
//   4. بعد نجاح التسجيل تفتح OnboardingPage. useEffect يلاحظ `pendingPersist`،
//      فيستدعي POST /api/diagnostic/{owner|manager|investor} بالإجابات المحفوظة،
//      ثم `clearPendingPersist()` (يُفرِغ العلم — البيانات الآن مُخزَّنة رسمياً
//      في جدول Diagnostic بالقاعدة).
//   5. بقية جلسات المستخدم المصادَق: DiagnosticResultPage تستعمل `ownerResult`
//      من هذا المتجر **كذاكرة تخزين مؤقّتة فقط**. لو لم يجدها، يعود لـ
//      GET /api/diagnostic/me/latest — القاعدة تظلّ مصدر الحقيقة.
//
// تحذير: أيّ حقل عمل جديد يُضاف هنا لاحقاً (مثل ownerCompanyDraft، auditsDraft...)
// يجب أن يمرّ بنفس الدورة (draft → API → clear) وإلا يُخلّ بالعقد. أيّ شيء لا
// يتعلّق بتدفّق ما-قبل-التسجيل يجب ألّا يوضع هنا — استعمل استدعاء API مباشرة.
// ═══════════════════════════════════════════════════════════════════════════

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { OwnerAnswers, OwnerDiagnosticResult } from '@/lib/diagnosticQuestions'
import type { ManagerAnswers, ManagerResult, InvestorAnswers, InvestorResult } from '@/lib/managerInvestorQuestions'
import type { ManagerType } from '@/types/user'

export type DiagnosticRole = 'OWNER' | 'MANAGER' | 'INVESTOR'

interface DiagnosticState {
  // الدور المُختار في المعالج العام
  role: DiagnosticRole | null

  // مالك
  ownerDraft: Partial<OwnerAnswers>
  ownerStep: number
  ownerResult: OwnerDiagnosticResult | null

  // مدير — الحقل managerType خارج managerDraft لأنه لا يُرسل للمحرّك؛
  // يُستهلك فقط لضبط تدفّق التسجيل (INTERNAL vs INDEPENDENT_PRO).
  managerType: ManagerType | null
  managerDraft: Partial<ManagerAnswers>
  managerStep: number
  managerResult: ManagerResult | null

  // مستثمر
  investorDraft: Partial<InvestorAnswers>
  investorStep: number
  investorResult: InvestorResult | null

  // علم: التشخيص جاء من المسار العام (قبل التسجيل) ولم يُحفظ بعد.
  // OnboardingPage يستهلكه ويحفظ الإجابات في حساب المستخدم الجديد.
  pendingPersist: boolean

  setRole: (r: DiagnosticRole | null) => void
  setOwnerDraft: (patch: Partial<OwnerAnswers>) => void
  setOwnerStep: (step: number) => void
  setOwnerResult: (r: OwnerDiagnosticResult | null) => void
  setManagerType: (t: ManagerType | null) => void
  setManagerDraft: (patch: Partial<ManagerAnswers>) => void
  setManagerStep: (step: number) => void
  setManagerResult: (r: ManagerResult | null) => void
  setInvestorDraft: (patch: Partial<InvestorAnswers>) => void
  setInvestorStep: (step: number) => void
  setInvestorResult: (r: InvestorResult | null) => void
  markPendingPersist: () => void
  clearPendingPersist: () => void
  reset: () => void
}

const EMPTY = {
  role: null as DiagnosticRole | null,
  ownerDraft: {} as Partial<OwnerAnswers>,
  ownerStep: 0,
  ownerResult: null as OwnerDiagnosticResult | null,
  managerType: null as ManagerType | null,
  managerDraft: {} as Partial<ManagerAnswers>,
  managerStep: 0,
  managerResult: null as ManagerResult | null,
  investorDraft: {} as Partial<InvestorAnswers>,
  investorStep: 0,
  investorResult: null as InvestorResult | null,
  pendingPersist: false,
}

export const useDiagnosticStore = create<DiagnosticState>()(
  persist(
    (set) => ({
      ...EMPTY,
      setRole: (role) => set({ role }),
      setOwnerDraft: (patch) => set((s) => ({ ownerDraft: { ...s.ownerDraft, ...patch } })),
      setOwnerStep: (ownerStep) => set({ ownerStep }),
      setOwnerResult: (ownerResult) => set({ ownerResult }),
      setManagerType: (managerType) => set({ managerType }),
      setManagerDraft: (patch) => set((s) => ({ managerDraft: { ...s.managerDraft, ...patch } })),
      setManagerStep: (managerStep) => set({ managerStep }),
      setManagerResult: (managerResult) => set({ managerResult }),
      setInvestorDraft: (patch) => set((s) => ({ investorDraft: { ...s.investorDraft, ...patch } })),
      setInvestorStep: (investorStep) => set({ investorStep }),
      setInvestorResult: (investorResult) => set({ investorResult }),
      markPendingPersist: () => set({ pendingPersist: true }),
      clearPendingPersist: () => set({ pendingPersist: false }),
      reset: () => set(EMPTY),
    }),
    {
      name: 'startix-diagnostic',
      partialize: (s) => ({
        role: s.role,
        ownerDraft: s.ownerDraft,
        ownerStep: s.ownerStep,
        ownerResult: s.ownerResult,
        managerType: s.managerType,
        managerDraft: s.managerDraft,
        managerStep: s.managerStep,
        managerResult: s.managerResult,
        investorDraft: s.investorDraft,
        investorStep: s.investorStep,
        investorResult: s.investorResult,
        pendingPersist: s.pendingPersist,
      }),
    }
  )
)
