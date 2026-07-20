import { getMyFirstCompany } from '@/lib/deptApi'
import { computeOverall, type MaturityAnswers, type MaturityConfig } from '@/lib/maturityEngine'
import { upsertArtifact } from '@/lib/strategicApi'
import type { User } from '@/types/user'

// ─── نقل مسودّة تقييم النضج (قبل التسجيل) إلى الحساب (معمّم) ─────────
// بعد التسجيل: إن كان المستخدم مدير مستقل بتخصّص له config نضج، وتوجد
// مسودّة، ننقلها إلى artifact MATURITY على أوّل عميل ثم نمسحها.

function readDraft(key: string): MaturityAnswers | null {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    if (parsed && typeof parsed === 'object') {
      const clean: MaturityAnswers = {}
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) if (typeof v === 'number') clean[k] = v
      return Object.keys(clean).length > 0 ? clean : null
    }
  } catch { /* تجاهل */ }
  return null
}

export async function applyPendingMaturity(user: User | null, configs: MaturityConfig[]): Promise<void> {
  if (!user) return
  if (!(user.userType === 'MANAGER' && user.managerType === 'INDEPENDENT_PRO' && user.specialtyDeptType)) return
  const config = configs.find((c) => c.specialty === user.specialtyDeptType)
  if (!config) return
  const answers = readDraft(config.draftKey)
  if (!answers) return
  try {
    const { company } = await getMyFirstCompany()
    if (!company) return
    await upsertArtifact(company.id, 'MATURITY', {
      specialty: config.specialty, answers, overallPct: computeOverall(config, answers).maturityPct,
    })
    localStorage.removeItem(config.draftKey)
  } catch { /* نُبقي المسودّة لإعادة المحاولة */ }
}
