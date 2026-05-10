import { createBrowserRouter } from 'react-router-dom'

import { LandingPage } from '@/pages/LandingPage'
import { SelectTypePage } from '@/pages/SelectTypePage'
import { LoginPage } from '@/pages/LoginPage'
import { JoinPage } from '@/pages/JoinPage'
import { PricingPage } from '@/pages/PricingPage'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/select-type', element: <SelectTypePage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/join', element: <JoinPage /> },
  { path: '/pricing', element: <PricingPage /> },
  {
    element: <ProtectedRoute />,
    children: [{ path: '/onboarding', element: <OnboardingPage /> }],
  },
])
