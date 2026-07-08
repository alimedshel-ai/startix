import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_ICON, DEPT_LABEL, dangerZoneColor, type DangerZone } from '@/lib/deptApi'
import { listMyClients, type ProClient } from '@/lib/proApi'
import { useAuthStore } from '@/store/authStore'

// ─── PRO-B — عملائي (شاشة المدير المستقل) ────────────────────────────────────
// تعرض قائمة الشركات التي يخدمها المدير عبر تخصّصه الواحد + آخر تدقيق لكل
// شركة. الوصول مقيّد على مستوى التنقّل (nav.ts) وعلى مستوى الـ API
// (server/src/controllers/pro.ts).

export function ClientsPage() {
  const user = useAuthStore((s) => s.user)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clients, setClients] = useState<ProClient[]>([])
  const [specialtyLabel, setSpecialtyLabel] = useState<string>('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    listMyClients()
      .then((res) => {
        if (!alive) return
        setClients(res.clients)
        setSpecialtyLabel(DEPT_LABEL[res.specialty])
      })
      .catch((err: unknown) => {
        if (!alive) return
        setError(apiErrorMessage(err, 'تعذّر تحميل قائمة عملائك'))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const isPro = user?.userType === 'MANAGER' && user?.managerType === 'INDEPENDENT_PRO'

  if (!isPro) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="عملائي" description="مسار مخصّص للمدير المستقل." />
        <EmptyState
          title="هذه الشاشة للمدير المستقل"
          description="خصّص حسابك كمدير مستقل واختر تخصّصاً واحداً لعرض قائمة عملائك هنا."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="عملائي"
        description={
          specialtyLabel
            ? `الشركات التي تشرف فيها على إدارة ${specialtyLabel}. افتح أي شركة لبدء التدقيق أو مراجعة آخر نتيجة.`
            : 'الشركات التي تخدمها عبر تخصّصك.'
        }
      />

      {loading && <LoadingSpinner fullPage label="جاري تحميل عملائك…" />}

      {!loading && error && (
        <EmptyState title="حدث خطأ" description={error} />
      )}

      {!loading && !error && clients.length === 0 && (
        <EmptyState
          title="لا يوجد عملاء بعد"
          description="عندما يدعوك مالك شركة أو تُربَط بشركة عبر إدارتك ستظهر هنا. اطلب من المالك دعوتك من صفحة الدعوات."
        />
      )}

      {!loading && !error && clients.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <ClientCard key={c.company.id} client={c} />
          ))}
        </div>
      )}
    </div>
  )
}

function ClientCard({ client }: { client: ProClient }) {
  const { company, department, latestAudit } = client

  return (
    <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">{company.name}</h3>
            <p className="text-xs text-muted-foreground">
              {company.sector ?? 'قطاع غير محدّد'} · {sizeLabel(company.size)}
              {company.stage ? ` · ${company.stage}` : ''}
            </p>
          </div>
          {department && (
            <span className="text-2xl" aria-hidden>
              {DEPT_ICON[department.type]}
            </span>
          )}
        </div>

        {latestAudit ? (
          <div className="flex items-center justify-between rounded-md border bg-muted/30 p-2 text-xs">
            <span className="text-muted-foreground">آخر تدقيق</span>
            <span
              className={`rounded-md border px-2 py-0.5 font-medium ${
                latestAudit.dangerZone
                  ? dangerZoneColor(latestAudit.dangerZone)
                  : 'text-muted-foreground bg-muted border-border'
              }`}
            >
              {Math.round(latestAudit.healthPct)}٪
              {latestAudit.dangerZone ? ` · ${zoneLabel(latestAudit.dangerZone)}` : ''}
            </span>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
            {department ? 'لم يُجرَ تدقيق بعد لهذه الإدارة.' : 'الإدارة غير مُنشأة في هذه الشركة بعد.'}
          </div>
        )}

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">دورك: {roleLabel(client.role)}</span>
          <Link to="/manager/select-dept" className="rounded-md border bg-card px-2.5 py-1.5 transition hover:bg-accent">
            فتح الإدارة ←
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function sizeLabel(size: ProClient['company']['size']): string {
  switch (size) {
    case 'MICRO':  return 'متناهية الصغر'
    case 'SMALL':  return 'صغيرة'
    case 'MEDIUM': return 'متوسطة'
    case 'LARGE':  return 'كبيرة'
  }
}

function zoneLabel(zone: DangerZone): string {
  switch (zone) {
    case 'GREEN':  return 'أخضر'
    case 'YELLOW': return 'أصفر'
    case 'ORANGE': return 'برتقالي'
    case 'RED':    return 'أحمر'
  }
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    OWNER: 'مالك',
    ADMIN: 'مشرف',
    MEMBER: 'عضو',
    VIEWER: 'مشاهد',
  }
  return map[role] ?? role
}
