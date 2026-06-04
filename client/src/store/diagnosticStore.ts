import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { OwnerAnswers, OwnerDiagnosticResult } from '@/lib/diagnosticQuestions'

interface DiagnosticState {
  draft: Partial<OwnerAnswers>
  step: number // 0..8، 9 خطوات (1 تعريف + 8 موزّنة)
  result: OwnerDiagnosticResult | null
  // علم: التشخيص جاء من المسار العام (قبل التسجيل) ولم يُحفظ بعد.
  // يستهلكه أول صفحة محمية بعد التسجيل/الدخول لحفظه فعلياً عبر /api/diagnostic/owner.
  pendingPersist: boolean
  setDraft: (patch: Partial<OwnerAnswers>) => void
  setStep: (step: number) => void
  reset: () => void
  setResult: (r: OwnerDiagnosticResult | null) => void
  markPendingPersist: () => void
  clearPendingPersist: () => void
}

export const useDiagnosticStore = create<DiagnosticState>()(
  persist(
    (set) => ({
      draft: {},
      step: 0,
      result: null,
      pendingPersist: false,
      setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      setStep: (step) => set({ step }),
      reset: () => set({ draft: {}, step: 0, result: null, pendingPersist: false }),
      setResult: (result) => set({ result }),
      markPendingPersist: () => set({ pendingPersist: true }),
      clearPendingPersist: () => set({ pendingPersist: false }),
    }),
    {
      name: 'startix-diagnostic',
      // result + pendingPersist لا بد أن يبقيا بعد إعادة تحميل الصفحة وبعد التسجيل.
      partialize: (s) => ({
        draft: s.draft,
        step: s.step,
        result: s.result,
        pendingPersist: s.pendingPersist,
      }),
    }
  )
)
