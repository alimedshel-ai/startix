import { getMyFirstCompany } from '@/lib/deptApi'
import { computeHrOverall, type HrAnswers } from '@/lib/hrMaturity'
import { upsertArtifact } from '@/lib/strategicApi'
import type { User } from '@/types/user'

// ─── نقل مسودّة تقييم نضج HR (قبل التسجيل) إلى الحساب ────────────────
// الزائر أجرى التقييم على /diagnostic/hr فحُفظت إجاباته محلياً. بعد أن
// يسجّل كمدير مستقل متخصّص في HR، ننقل المسودّة إلى artifact HR_MATURITY
// على أوّل عميل له، ثم نمسحها (نفس دورة draft → API → clear الموثّقة).

export const HR_MATURITY_DRAFT_KEY = 'startix-hr-maturity'

function readDraft(): HrAnswers | null {
  try {
    const raw = localStorage.getItem(HR_MATURITY_DRAFT_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    if (parsed && typeof parsed === 'object') {
      const clean: HrAnswers = {}
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === 'number') clean[k] = v
      }
      return Object.keys(clean).length > 0 ? clean : null
    }
  } catch { /* تجاهل */ }
  return null
}

/**
 * يُستدعى بعد التسجيل. لا يفعل شيئاً إلا إذا: المستخدم مدير مستقل بتخصّص HR،
 * وتوجد مسودّة، ولديه أوّل عميل. عند النجاح يمسح المسودّة؛ عند الفشل يتركها
 * لإعادة المحاولة لاحقاً.
 */
export async function applyPendingHrMaturity(user: User | null): Promise<void> {
  if (!user) return
  if (!(user.userType === 'MANAGER' && user.managerType === 'INDEPENDENT_PRO' && user.specialtyDeptType === 'HR')) return
  const answers = readDraft()
  if (!answers) return
  try {
    const { company } = await getMyFirstCompany()
    if (!company) return // لا عميل بعد — نُبقي المسودّة للمحاولة لاحقاً
    await upsertArtifact(company.id, 'HR_MATURITY', {
      answers,
      overallPct: computeHrOverall(answers).maturityPct,
    })
    localStorage.removeItem(HR_MATURITY_DRAFT_KEY)
  } catch {
    /* نُبقي المسودّة — سيُعاد المحاولة عند الدخول التالي */
  }
}
