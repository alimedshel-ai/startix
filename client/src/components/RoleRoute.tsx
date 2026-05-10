import { Navigate, Outlet } from 'react-router-dom'

import { useAuthStore } from '@/store/authStore'
import type { UserType } from '@/types/user'

interface Props {
  allow: UserType[]
}

export function RoleRoute({ allow }: Props) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!allow.includes(user.userType)) return <Navigate to="/" replace />
  return <Outlet />
}
