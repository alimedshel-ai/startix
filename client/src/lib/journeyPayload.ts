// ─── R2 — بناء payload التسلسل الاستراتيجي (Handoff) ────────────────
// المصدر: ملف الاقتراح — بعد إكمال التشخيص أو أي DeptAudit، بدل شاشة
// "النتائج" المغلقة نُشغّل التسلسل ونحقن فيه كل بيانات المدير + العميل +
// آخر تدقيق. هذا الملف يحتوي على الشكل ودالة البناء النقيّة (بلا side effects)
// لتُختبر بسهولة في R8.

import type { OverviewClient } from './proApi'
import type { User } from '@/types/user'

export interface JourneyPayload {
  companyId: string
  companyName: string
  specialty: string          // DeptCode
  sector: string | null
  size: OverviewClient['size']
  pains: string[]
  goals: string[]
  hasAnyAudit: boolean
  healthPct: number | null
  lastAuditAt: string | null
  // R5 يُوسّع لاحقاً بـopex + deptAnswers.
}

export function buildJourneyPayload(
  user: Pick<User, 'pains' | 'goals' | 'specialtyDeptType'>,
  client: Pick<
    OverviewClient,
    'companyId' | 'companyName' | 'specialty' | 'sector' | 'size'
    | 'hasAnyAudit' | 'healthPct' | 'lastAuditAt'
  >,
): JourneyPayload {
  return {
    companyId: client.companyId,
    companyName: client.companyName,
    specialty: user.specialtyDeptType ?? client.specialty,
    sector: client.sector,
    size: client.size,
    pains: user.pains ?? [],
    goals: user.goals ?? [],
    hasAnyAudit: client.hasAnyAudit,
    healthPct: client.healthPct,
    lastAuditAt: client.lastAuditAt,
  }
}
