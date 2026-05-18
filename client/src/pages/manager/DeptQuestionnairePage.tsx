import { Navigate } from 'react-router-dom'

// The 12-question audit lives behind /manager/<dept>/audit pages now (one per
// department). This route stays as a friendly redirect for older links.
export function DeptQuestionnairePage() {
  return <Navigate to="/manager/select-dept" replace />
}
