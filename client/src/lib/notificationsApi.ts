import { api } from './api'

// ─── C15 — الإشعارات + الدعوات (كلاينت) ─────────────────────────────────────

export interface Notification {
  id: string
  userId: string
  type: string
  message: string
  read: boolean
  createdAt: string
}

export interface NotificationsPayload {
  notifications: Notification[]
  unread: number
}

export async function listMyNotifications(): Promise<NotificationsPayload> {
  const { data } = await api.get('/api/notifications/me')
  return data
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const { data } = await api.patch(`/api/notifications/${id}/read`)
  return data
}

// ─── Invitations ───────────────────────────────────────────────────────────

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export const INVITATION_STATUS_LABEL: Record<InvitationStatus, string> = {
  pending: 'قيد الانتظار',
  accepted: 'مقبولة',
  expired: 'منتهية',
  revoked: 'مُلغاة',
}

export type InvitationRole = 'owner' | 'manager' | 'member'

export const INVITATION_ROLE_LABEL: Record<InvitationRole, string> = {
  owner: 'مالك',
  manager: 'مدير',
  member: 'عضو',
}

export interface Invitation {
  id: string
  companyId: string
  email: string
  role: InvitationRole
  token: string
  status: InvitationStatus
  expiresAt: string
  createdAt: string
}

export interface CreateInvitationPayload {
  companyId: string
  email: string
  role: InvitationRole
  expiresInDays?: number
}

export async function createInvitation(payload: CreateInvitationPayload): Promise<Invitation> {
  const { data } = await api.post('/api/invitations', payload)
  return data
}

export async function listCompanyInvitations(companyId: string): Promise<Invitation[]> {
  const { data } = await api.get(`/api/invitations/company/${companyId}`)
  return data
}

export async function acceptInvitation(token: string): Promise<{ ok: true; companyId: string; role: InvitationRole }> {
  const { data } = await api.post(`/api/invitations/${token}/accept`, {})
  return data
}
