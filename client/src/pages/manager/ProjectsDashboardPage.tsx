import { Navigate } from 'react-router-dom'

// ─── /manager/projects-dashboard: مُوجَّه إلى /manager/clients ─────────
// للمدير المستقلّ: العميل = مشروع. لا داعي لصفحتين تعرضان نفس الوحدة.
// الوصول إلى مشاريع عميل بعينه يتمّ الآن من داخل ClientDetailPage.
// اُبقيت هذه الصفحة كـ redirect احتياطاً لأي bookmark/رابط قديم.
export function ProjectsDashboardPage() {
  return <Navigate to="/manager/clients" replace />
}
