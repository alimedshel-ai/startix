import { describe, expect, it } from 'vitest'

import finQuantDeriveSrc from './finQuantDerive.ts?raw'

// ─── حارس «المصدر الواحد» لمؤشّرَي التداخل §أ (FIN_QUANT_CROSSOVER) ──────────
// القرار (المالك): المصدر الوحيد لصيغة «الإيراد/موظّف» و«تكلفة العمالة/إيراد» هو
// طبقة HR (KPI_STR_06 / KPI_STR_01)؛ finQuantDerive يقرأهما عبر deriveQuantActual
// ولا يعيد حسابهما. هذا الاختبار يحوّل القرار إلى قيدٍ آليّ يفشل عند ظهور حسابٍ موازٍ.
//
// ما يفحصه بالضبط (موثَّق — وحدوده معلومة):
//  (١) [موجب] finQuantDerive.ts يقرأ الحقلين عبر deriveQuantActual('KPI_STR_06'|'KPI_STR_01').
//  (٢) [سالب] لا ملفّ آخر تحت src/ (عدا القائمة البيضاء) يُسنِد أحد الحقلين إلى تعبيرٍ
//      **حسابيّ** (فيه قسمة `/`) — أي «صيغة موازية».
//
// نمط المنع (regex):  (?<!['"])\b<KEY>\b\s*[:=]\s*[^\n'"]*\/
//   • (?<!['"]) قبل المفتاح: يستثني ظهوره **كسلسلة** ('payrollToRevenue' في مصفوفة/مفتاح مُقتبَس).
//   • [^\n'"]*\/ : يلتقط قسمةً بين المفتاح و`/` **دون عبور أيّ اقتباس** — فالتسميات النصّيّة
//     مثل 'تكلفة العمالة/إيراد' لا تُلتقط (الاقتباس يوقف المطابقة قبل السلاش).
//  حدٌّ معلوم: الفحص نصّيّ؛ قسمةٌ على سطرين أو عبر دالّة وسيطة قد تفلت — لذا القاعدة
//  الموجبة (١) هي الحصن الأساس، و(٢) شبكةٌ ضدّ الأنماط الشائعة.

const GUARDED_KEYS = ['revenuePerDirectEmployee', 'payrollToRevenue']
// ملفّات يُسمح فيها بظهور الحقلين بحساب/قسمة مشروعة:
//  hrQuantDerive = مصدر الحقيقة · financialHealth = المستهلِك (تسجيل الدرجة) ·
//  finQuantDerive = الجسر المُصرَّح (يقرأ عبر deriveQuantActual) · *.test = الاختبارات.
const ALLOW = [/hrQuantDerive\.ts$/, /financialHealth\.ts$/, /finQuantDerive\.ts$/, /\.test\.tsx?$/]

// كل ملفّات src نصًّا عبر vite ?raw — بلا الحاجة لأنواع node/fs.
const FILES = import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const forbidden = (key: string) => new RegExp(String.raw`(?<!['"])\b${key}\b\s*[:=]\s*[^\n'"]*\/`)

describe('finSingleSourceGuard — منع مصدرٍ ثانٍ لمؤشّرَي التداخل (§أ)', () => {
  it('(١) finQuantDerive يقرأ KPI_STR_06 و KPI_STR_01 من طبقة HR (لا حساب مستقلّ)', () => {
    expect(finQuantDeriveSrc).toMatch(/deriveQuantActual\(\s*'KPI_STR_06'/)
    expect(finQuantDeriveSrc).toMatch(/deriveQuantActual\(\s*'KPI_STR_01'/)
    for (const key of GUARDED_KEYS) expect(forbidden(key).test(finQuantDeriveSrc)).toBe(false)
  })

  it('(٢) لا ملفّ آخر تحت src/ يحسب أحد الحقلين بصيغةٍ موازية', () => {
    const violations: string[] = []
    for (const [path, text] of Object.entries(FILES)) {
      if (ALLOW.some((re) => re.test(path))) continue
      text.split('\n').forEach((line: string, i: number) => {
        for (const key of GUARDED_KEYS) {
          if (forbidden(key).test(line)) violations.push(`${path}:${i + 1} — ${key}: ${line.trim()}`)
        }
      })
    }
    expect(violations).toEqual([])
  })
})
