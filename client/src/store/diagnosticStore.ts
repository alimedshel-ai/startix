import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { OwnerAnswers, OwnerDiagnosticResult } from '@/lib/diagnosticQuestions'

interface DiagnosticState {
  draft: Partial<OwnerAnswers>
  step: number // 0..8, 9 steps total (1 identification + 8 weighted)
  result: OwnerDiagnosticResult | null
  setDraft: (patch: Partial<OwnerAnswers>) => void
  setStep: (step: number) => void
  reset: () => void
  setResult: (r: OwnerDiagnosticResult | null) => void
}

export const useDiagnosticStore = create<DiagnosticState>()(
  persist(
    (set) => ({
      draft: {},
      step: 0,
      result: null,
      setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      setStep: (step) => set({ step }),
      reset: () => set({ draft: {}, step: 0, result: null }),
      setResult: (result) => set({ result }),
    }),
    {
      name: 'startix-diagnostic',
      partialize: (s) => ({ draft: s.draft, step: s.step }),
    }
  )
)
