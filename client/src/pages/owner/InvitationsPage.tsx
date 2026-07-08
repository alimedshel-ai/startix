import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiErrorMessage } from '@/lib/api'
import { getMyFirstCompany, type Company } from '@/lib/deptApi'
import {
  createInvitation,
  listCompanyInvitations,
  INVITATION_ROLE_LABEL,
  INVITATION_STATUS_LABEL,
  type Invitation,
  type InvitationRole,
  type InvitationStatus,
} from '@/lib/notificationsApi'

// ─── C15 — دعوات الشركة ────────────────────────────────────────────────────

const STATUS_TONE: Record<InvitationStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-800 border-amber-500/30 dark:text-amber-300',
  accepted: 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30 dark:text-emerald-300',
  expired: 'bg-slate-500/10 text-slate-700 border-slate-500/30 dark:text-slate-300',
  revoked: 'bg-rose-500/10 text-rose-800 border-rose-500/30 dark:text-rose-300',
}

export function InvitationsPage() {
  return (
    <ErrorBoundary>
      <InvitationsContent />
    </ErrorBoundary>
  )
}

function InvitationsContent() {
  const [company, setCompany] = useState<Company | null>(null)
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const { company: co } = await getMyFirstCompany()
        if (cancel || !co) return
        setCompany(co)
        const rows = await listCompanyInvitations(co.id)
        if (!cancel) setInvitations(rows)
      } catch (err) {
        if (!cancel) toast.error(apiErrorMessage(err, 'تعذّر تحميل الدعوات'))
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [])

  async function onCreate(payload: { email: string; role: InvitationRole }) {
    if (!company) return
    try {
      const row = await createInvitation({ companyId: company.id, ...payload })
      setInvitations((rows) => [row, ...rows])
      toast.success('تم إرسال الدعوة')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر إرسال الدعوة'))
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="دعوات الفريق" />
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" label="جاري التحميل…" />
        </div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="دعوات الفريق" />
        <EmptyState
          title="لا توجد شركة مرتبطة بحسابك"
          description="أنشئ شركة أوّلاً من لوحة القيادة لدعوة الفريق."
          icon={<span className="text-4xl">🏢</span>}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="دعوات الفريق"
        description={`أرسل روابط انضمام لأعضاء ${company.name}.`}
      />

      <InvitationForm onSubmit={onCreate} />

      <Card>
        <CardHeader>
          <CardTitle>الدعوات المُرسَلة</CardTitle>
          <CardDescription>
            {invitations.length === 0
              ? 'لا توجد دعوات بعد.'
              : `${invitations.length} دعوة إجمالاً.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              الدعوات ستظهر هنا بعد إرسالها. أدخل بريد المدعو أعلاه لإنشاء أول دعوة.
            </p>
          ) : (
            <ul className="grid gap-2">
              {invitations.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm"
                >
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-medium">{inv.email}</div>
                    <div className="text-xs text-muted-foreground">
                      دور {INVITATION_ROLE_LABEL[inv.role]} · تنتهي في {new Date(inv.expiresAt).toLocaleDateString('ar-SA')}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${STATUS_TONE[inv.status]}`}
                  >
                    {INVITATION_STATUS_LABEL[inv.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function InvitationForm({
  onSubmit,
}: {
  onSubmit: (payload: { email: string; role: InvitationRole }) => Promise<void> | void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InvitationRole>('manager')
  const [busy, setBusy] = useState(false)

  async function submit() {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !trimmed.includes('@')) {
      toast.error('بريد إلكتروني صالح مطلوب')
      return
    }
    setBusy(true)
    try {
      await onSubmit({ email: trimmed, role })
      setEmail('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>دعوة جديدة</CardTitle>
        <CardDescription>يستلم المدعو بريداً برابط قبول ينتهي خلال 7 أيام.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <div className="space-y-1">
          <Label htmlFor="inv_email">البريد الإلكتروني</Label>
          <Input
            id="inv_email"
            type="email"
            dir="ltr"
            className="text-left"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="inv_role">الدور</Label>
          <select
            id="inv_role"
            value={role}
            onChange={(e) => setRole(e.target.value as InvitationRole)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="owner">{INVITATION_ROLE_LABEL.owner}</option>
            <option value="manager">{INVITATION_ROLE_LABEL.manager}</option>
            <option value="member">{INVITATION_ROLE_LABEL.member}</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={submit} disabled={busy} className="w-full md:w-auto">
            {busy ? 'جاري الإرسال…' : 'إرسال الدعوة'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
