// 🔓 تفضيل UI مقبول لـ localStorage — ليس بيانات عمل.
// القانون الأول يمنع تخزين بيانات العمل، لكن يسمح بـ "توكن الجلسة + تفضيل
// واجهة غير حرج". هذا الملف يحفظ فقط الاختيارات السابقة للتسجيل
// (`selectedType`, `selectedManagerType`, `selectedSpecialty`) — تفضيلات UI
// تنتقل من /select-type إلى /join حتى لا يعيد المستخدم إدخالها. `user`
// و`isAuthenticated` و`sessions` كلها من الـ API/الكوكيز، لا تُحفَظ
// محلياً (راجع partialize أسفل الملف الذي يقصر التخزين على هذه الحقول).

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { api } from '@/lib/api'
import type { ManagerType, OpexData, SpecialtyDeptType, User, UserType } from '@/types/user'

// R1 — بيانات onboarding transient (تُجمَع في UI قبل التسجيل، تُرسَل مع register).
// نحفظها في localStorage عبر partialize لتبقى مقاومة للانتقال بين الصفحات
// (/select-type → /diagnostic/... → /join)، وتُمسَح بعد التسجيل الناجح.
export interface OnboardingDraft {
  pains?: string[]
  goals?: string[]
  firstClientMeta?: {
    sector?: string
    subsector?: string
    entityType?: string
    size?: 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE'
    opex?: OpexData
  }
}

interface AuthState {
  user: User | null
  selectedType: UserType | null
  selectedManagerType: ManagerType | null
  selectedSpecialty: SpecialtyDeptType | null
  onboardingDraft: OnboardingDraft
  isAuthenticated: boolean
  setSelectedType: (t: UserType) => void
  setSelectedManagerType: (t: ManagerType | null) => void
  setSelectedSpecialty: (s: SpecialtyDeptType | null) => void
  setOnboardingDraft: (patch: Partial<OnboardingDraft>) => void
  clearOnboardingDraft: () => void
  setUser: (u: User | null) => void
  login: (email: string, password: string) => Promise<void>
  register: (input: {
    email: string
    password: string
    name: string
    userType: UserType
    managerType?: ManagerType
    specialtyDeptType?: SpecialtyDeptType
    firstClientName?: string
    firstClientMeta?: OnboardingDraft['firstClientMeta']
    pains?: string[]
    goals?: string[]
    phone?: string
  }) => Promise<User>
  logout: () => Promise<void>
  hydrate: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      selectedType: null,
      selectedManagerType: null,
      selectedSpecialty: null,
      onboardingDraft: {},
      isAuthenticated: false,

      setSelectedType: (t) => {
        // تغيير الدور الرئيسي يمسح اختيارات المدير الفرعية — منع تسرّب
        // تخصّص من محاولة سابقة إلى دور جديد (مثلاً owner ثم investor).
        if (t !== 'MANAGER') {
          set({ selectedType: t, selectedManagerType: null, selectedSpecialty: null })
        } else {
          set({ selectedType: t })
        }
      },
      setSelectedManagerType: (t) => {
        // تحويل الدور إلى داخلي يمسح التخصّص — التخصّص للمستقل فقط.
        if (t !== 'INDEPENDENT_PRO') {
          set({ selectedManagerType: t, selectedSpecialty: null })
        } else {
          set({ selectedManagerType: t })
        }
      },
      setSelectedSpecialty: (s) => set({ selectedSpecialty: s }),
      setOnboardingDraft: (patch) => set((state) => ({
        onboardingDraft: {
          ...state.onboardingDraft,
          ...patch,
          firstClientMeta: patch.firstClientMeta
            ? { ...state.onboardingDraft.firstClientMeta, ...patch.firstClientMeta }
            : state.onboardingDraft.firstClientMeta,
        },
      })),
      clearOnboardingDraft: () => set({ onboardingDraft: {} }),
      setUser: (u) => set({ user: u, isAuthenticated: !!u }),

      login: async (email, password) => {
        const { data } = await api.post<{ user: User }>('/api/auth/login', { email, password })
        set({ user: data.user, isAuthenticated: true })
      },

      register: async (input) => {
        const { data } = await api.post<{ user: User }>('/api/auth/register', input)
        return data.user
      },

      logout: async () => {
        try {
          await api.post('/api/auth/logout', {})
        } finally {
          set({ user: null, isAuthenticated: false })
        }
      },

      hydrate: async () => {
        try {
          const { data } = await api.get<{ user: User }>('/api/auth/me')
          set({ user: data.user, isAuthenticated: true })
        } catch {
          set({ user: null, isAuthenticated: false })
        }
      },
    }),
    {
      name: 'startix-auth',
      partialize: (s) => ({
        selectedType: s.selectedType,
        selectedManagerType: s.selectedManagerType,
        selectedSpecialty: s.selectedSpecialty,
        onboardingDraft: s.onboardingDraft,
      }),
    }
  )
)
