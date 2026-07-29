import { describe, expect, it } from 'vitest'

// ─── تريبواير — لا عودة للمُوصّي المنشقّ (خرّاطة عَرَض→أداة خارج المحرّك) ─────
// الأنماط الأربعة المحذوفة (انظر docs/TASK_UNIFY.md) كانت تقرّر «التالي» بمنطق
// محلّيّ، فتقفز من ① لأداة ⑤ قد تكون مقفلة. حُذفت، ومصدر «التالي» صار واحداً
// (useGuidedNext). هذا الاختبار يقفلها ضدّ **العودة بالاسم**.
//
// ⚠️ حدّه الصريح: يمسك العودة **بالاسم** لا شكلاً جديداً باسم خامس. ذاك يمسكه
// الجرد البصريّ (نقرة على المسار الكامل بعد كل إغلاق). القاعدتان معاً — لا إحداهما.
//
// نقرأ مصادر src عبر import.meta.glob (?raw) بدل node:fs — يبقى الاختبار متوافقاً
// مع أنواع العميل (لا @types/node) ويعمل تحت vitest/vite دون تلويث البناء.
const FORBIDDEN = ['ANALYSIS_SEQUENCE', 'getSmartActions', 'recommendedMove', 'INSIGHT_ROUTES', 'DEFAULT_MOVE']

const SELF = 'divergentNextGuard.test.ts'

const sources = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const entries = Object.entries(sources).filter(([path]) => !path.endsWith(SELF))

describe('تريبواير — لا مصدر «تالٍ» منشقّ يعود بالاسم', () => {
  for (const name of FORBIDDEN) {
    it(`«${name}» يبقى صفراً في src (مصدر «التالي» واحد: useGuidedNext)`, () => {
      const hits = entries.filter(([, src]) => src.includes(name)).map(([path]) => path)
      expect(hits).toEqual([])
    })
  }
})
