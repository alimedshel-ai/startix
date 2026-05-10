import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuthStore } from '@/store/authStore'

export function ProtectedRoute() {
  const { isAuthenticated, hydrate } = useAuthStore()
  const [checked, setChecked] = useState(isAuthenticated)
  const location = useLocation()

  useEffect(() => {
    if (isAuthenticated) {
      setChecked(true)
      return
    }
    hydrate().finally(() => setChecked(true))
  }, [isAuthenticated, hydrate])

  if (!checked) return null
  if (!useAuthStore.getState().isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}
