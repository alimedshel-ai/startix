// لقطة سلوكيّة D1+D2 على قاعدة البيانات الحيّة — تقيس انحراف «الوجود مقابل المحتوى»
// على عملاء حقيقيّين. تيّار قراءةٍ بحت: لا يكتب شيئاً. يُشغَّل مرّةً ويُلصَق مخرَجه.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// نسخة أمينة من client/src/lib/artifactContent.ts (deepHasContent) — لا نستورد
// من العميل (مسار/أنواع مختلفة)؛ المنطق سطرٌ واحد نتحقّق تطابقه.
function deepHasContent(v: unknown): boolean {
  if (v == null) return false
  if (Array.isArray(v)) return v.some(deepHasContent)
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).some(deepHasContent)
  if (typeof v === 'string') return v.trim().length > 0
  if (typeof v === 'number') return true
  return false
}

// المصادر الخارجيّة لبوّابة SWOT (useGuidedNext.ts:37).
const EXTERNAL_SWOT_BASES = ['PESTEL', 'PORTER', 'BENCHMARK', 'STAKEHOLDERS']

async function main() {
  const arts = await prisma.strategicArtifact.findMany({
    select: { companyId: true, type: true, data: true },
    orderBy: [{ companyId: 'asc' }, { type: 'asc' }],
  })
  const companies = await prisma.company.findMany({ select: { id: true, name: true } })
  const nameOf = new Map(companies.map((c) => [c.id, c.name]))

  console.log(`\n=== الأرض: ${arts.length} مرفقاً استراتيجيّاً عبر ${new Set(arts.map((a) => a.companyId)).size} عميلاً ===\n`)

  // ─── D1: كل مرفقٍ حاضرٍ فارغ (الوجود=مكتمل · المحتوى=لم يبدأ) ───
  const empties = arts.filter((a) => !deepHasContent(a.data))
  console.log('─── D1 · انحراف «الوجود مقابل المحتوى» (مرفقٌ حاضرٌ فارغ) ───')
  console.log('    القديم يعدّه «مكتملاً ✅» · المحرّك الجديد يعدّه «لم يبدأ ⬜ ويوجّه لملئه»\n')
  if (empties.length === 0) {
    console.log('    (صفر حالة حيّة اليوم — الانحراف قائمٌ بالكود لا بالبيانات؛ يُثبته اختبار الوحدة)\n')
  } else {
    for (const a of empties) {
      const ext = EXTERNAL_SWOT_BASES.includes(a.type) ? '  ⟵ مصدر SWOT خارجيّ (يقلب بوّابة D2)' : ''
      console.log(`    • ${nameOf.get(a.companyId) ?? a.companyId} × ${a.type}  =  {}${ext}`)
    }
    console.log('')
  }

  // ─── D2: بوّابة SWOT لكل عميل — هل مصدره الخارجيّ جاهزٌ بالمحتوى؟ ───
  console.log('─── D2 · بوّابة SWOT ثنائيّة المصدر لكل عميل ───')
  console.log('    externalReady = وجود أحد PESTEL/PORTER/BENCHMARK/STAKEHOLDERS بمحتوى\n')
  const byCompany = new Map<string, typeof arts>()
  for (const a of arts) {
    const list = byCompany.get(a.companyId) ?? []
    list.push(a)
    byCompany.set(a.companyId, list)
  }
  let divergent = 0
  for (const [cid, list] of byCompany) {
    const extPresent = list.filter((a) => EXTERNAL_SWOT_BASES.includes(a.type))
    if (extPresent.length === 0) continue // لا مصدر خارجيّ أصلاً — لا انحراف بوّابة
    const existenceReady = extPresent.length > 0 // القاعدة القديمة: الوجود يكفي
    const contentReady = extPresent.some((a) => deepHasContent(a.data)) // المحرّك: المحتوى
    if (existenceReady && !contentReady) {
      divergent++
      const types = extPresent.map((a) => a.type).join(', ')
      console.log(`    ✗ ${nameOf.get(cid) ?? cid}: خارجيّ حاضر (${types}) لكنه فارغ`)
      console.log(`        القديم: «SWOT مفتوح → اذهب إليه» · المحرّك: «أكمل PESTEL أوّلاً»`)
    }
  }
  if (divergent === 0) console.log('    (صفر عميلٍ عنده مصدرٌ خارجيّ حاضرٌ فارغ اليوم — الانحراف مُثبَتٌ بالكود+الاختبار)')
  console.log(`\n=== الخلاصة: D1 فوارغ=${empties.length} · D2 عملاء بوّابة منحرفة=${divergent} ===\n`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
