import { FINANCE_CONFIG } from './financeMaturity'
import { HR_CONFIG } from './hrMaturity'
import type { MaturityConfig } from './maturityEngine'

// ─── سجلّ إعدادات النضج — تخصّص واحد لكل config ─────────────────────
// إضافة تخصّص جديد = إضافة config هنا فقط (الإطار والواجهات مشتركة).
export const MATURITY_CONFIGS: MaturityConfig[] = [HR_CONFIG, FINANCE_CONFIG]

export const MATURITY_BY_SPECIALTY: Record<string, MaturityConfig | undefined> =
  Object.fromEntries(MATURITY_CONFIGS.map((c) => [c.specialty, c]))
