import type { ManagerType, UserType } from '@/types/user'

// ─── مصدر الأهداف — مشتقّ من الدور، لا حقل ولا تخزين ────────────────
// يوضّح «من أين تأتي أهداف هذا المستخدم» لعرض شارة توضيحيّة فقط:
//   INDEPENDENT_PRO → 'manual'    (يؤلّف أهداف عميله بنفسه)
//   INTERNAL        → 'fromOwner' (يتشارك أهداف شركة المالك — نفس الصفوف)
//   OWNER / غيره    → null        (يملك أهدافه — لا شارة)
// ملاحظة: 'fromOwner' شارة دور لا آليّة نقل — انظر ذاكرة المشروع.
export type GoalSource = 'manual' | 'fromOwner'

export function goalSourceFor(
  userType: UserType | null | undefined,
  managerType: ManagerType | null | undefined,
): GoalSource | null {
  if (userType !== 'MANAGER') return null
  if (managerType === 'INDEPENDENT_PRO') return 'manual'
  if (managerType === 'INTERNAL') return 'fromOwner'
  return null
}
