import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { OwnerAnswers, OwnerDiagnosticResult } from '@/lib/diagnosticQuestions'
import type { ManagerAnswers, ManagerResult, InvestorAnswers, InvestorResult } from '@/lib/managerInvestorQuestions'

export type DiagnosticRole = 'OWNER' | 'MANAGER' | 'INVESTOR'

interface DiagnosticState {
  // الدور المُختار في المعالج العام
  role: DiagnosticRole | null

  // مالك
  ownerDraft: Partial<OwnerAnswers>
  ownerStep: number
  ownerResult: OwnerDiagnosticResult | null

  // مدير
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
