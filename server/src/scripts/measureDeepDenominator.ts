// قياس أثر ٢أ-B: تغيير مقام تقدّم ClientDetailPage من 3 → 4 (إدخال deep).
// السؤال: كم شركة كانت 100% تحت المقام الثلاثيّ (audit ∧ s7 ∧ pestel)
// وتهبط الآن إلى 75% لأنّ DEPT_DEEP_FULL غير منجَز؟ (معيار مقام الصفحة تحديداً)
// يطابق دلالة isToolDone في ClientDetailPage (مع fallback `${type}_${specialty}`).
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      name: true,
      departments: { select: { audits: { select: { healthPct: true } } } },
      artifacts: { select: { type: true } },
    },
  })

  let scanned = 0
  let old100 = 0        // audit ∧ s7 ∧ pestel (المقام الثلاثيّ القديم)
  let regressed = 0     // old100 ∧ ¬deep  → 100% → 75%
  const regressedNames: string[] = []

  for (const c of companies) {
    const types = new Set(c.artifacts.map((a) => a.type))
    const has = (p: string) => [...types].some((t) => t === p || t.startsWith(`${p}_`))
    // audit: hasAnyAudit && healthPct != null (أيّ قسم لديه تدقيق بنسبة صحّة)
    const auditDone = c.departments.some((d) => d.audits.some((a) => a.healthPct != null))
    const s7 = has('INTERNAL_ENV')
    const pestel = has('PESTEL')
    const deep = has('DEPT_DEEP_FULL')
    if (c.departments.length === 0 && types.size === 0) continue // شركة فارغة — تجاهُل
    scanned++
    if (auditDone && s7 && pestel) {
      old100++
      if (!deep) { regressed++; regressedNames.push(c.name) }
    }
  }

  console.log(JSON.stringify({
    scanned,
    old_three_at_100pct: old100,
    regressed_100_to_75: regressed,
    regressedNames,
  }, null, 2))
}

main().finally(() => prisma.$disconnect())
