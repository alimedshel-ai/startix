// 🔓 تفضيل UI مقبول لـ localStorage — ليس بيانات عمل.
// القانون الأول يمنع تخزين بيانات العمل، لكن يسمح بـ "توكن الجلسة + تفضيل
// واجهة غير حرج". هذا الملف يحفظ فقط `selectedType` (الدور المُختار على
// شاشة /select-type قبل التسجيل) — تفضيل UI بحت. `user` و`isAuthenticated`
// و`sessions` كلها من الـ API/الكوكيز، لا تُحفَظ محلياً (راجع partialize
// أسفل الملف الذي يقصر التخزين على `selectedType` فقط).

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { api } from '@/lib/api'
import type { User, UserType } from '@/types/user'

interface AuthState {
  user: User | null
  selectedType: UserType | null
  isAuthenticated: boolean
  setSelectedType: (t: UserType) => void
  setUser: (u: User | null) => void
  login: (email: string, password: string) => Promise<void>
  register: (input: {
    email: string
    password: string
    name: string
    userType: UserType
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
      isAuthenticated: false,

      setSelectedType: (t) => set({ selectedType: t }),
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
      partialize: (s) => ({ selectedType: s.selectedType }),
    }
  )
)
