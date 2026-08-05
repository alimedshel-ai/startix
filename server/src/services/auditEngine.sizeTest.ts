// اختبار قيد الصحّة للتدقيق الواعي بالحجم (§1). لا مُشغِّل اختبار بالخادم بعد،
// فهذا سكربت assert مكتفٍ ذاتيّاً يُشغَّل بـ ts-node ويخرج بغير صفر عند الفشل:
//   npx ts-node src/services/auditEngine.sizeTest.ts   (أو: npm run test:size)
//
// يغطّي: (١) الحياد قبل وسم المحتوى · (٢) القيد الحاكم بسؤال موسوم اصطناعيّ:
// الفلترة، ثم عدم انكماش المقام على أسئلة لم تُطرح، ثم قابليّة المقارنة رغم
// اختلاف العدد، ثم كشف عيب «قُدِّم للصغير وقُيِّم بمقياس الكبير».

import assert from 'node:assert';
import {
  DEPT_BANKS,
  questionsForSizeAndVariant,
  type DeptQuestion,
} from '../lib/deptQuestions';
import { scoreBasicAuditFor, type AuditAnswer } from './auditEngine';

// كل الأجوبة "great" (score 3) → التدقيق التامّ = healthPct 100 مهما كان العدد.
const answersFor = (qs: DeptQuestion[]): AuditAnswer[] =>
  qs.map((q) => ({ questionId: q.id, value: 'great' }));

// ── (١) محتوى HR الواعي بالحجم (§2): 12 نواة · 16 متوسطة · 17 كبيرة ──
{
  const micro = questionsForSizeAndVariant('HR', 'basic', 'MICRO').length;
  const medium = questionsForSizeAndVariant('HR', 'basic', 'MEDIUM').length;
  const large = questionsForSizeAndVariant('HR', 'basic', 'LARGE').length;
  assert.strictEqual(micro, 12, `HR basic MICRO المتوقّع 12، الفعليّ ${micro}`);
  assert.strictEqual(medium, 16, `HR basic MEDIUM المتوقّع 16 (+4 موسومة MEDIUM)، الفعليّ ${medium}`);
  assert.strictEqual(large, 17, `HR basic LARGE المتوقّع 17 (+1 موسومة LARGE)، الفعليّ ${large}`);
  // النواة داخل كل حجم: الأكبر يشمل الأصغر بالحرف.
  const microIds = new Set(questionsForSizeAndVariant('HR', 'basic', 'MICRO').map((q) => q.id));
  const largeIds = questionsForSizeAndVariant('HR', 'basic', 'LARGE').map((q) => q.id);
  assert.ok([...microIds].every((id) => largeIds.includes(id)), 'نواة MICRO يجب أن تكون مجموعة جزئيّة من LARGE');
  console.log('✔ (١) محتوى HR: MICRO=12 · MEDIUM=16 · LARGE=17 (النواة متضمَّنة تصاعديّاً)');
}

// ── (١ب) محتوى FINANCE الواعي بالحجم (§2): 12 نواة · 16 متوسطة · 18 كبيرة ──
{
  const micro = questionsForSizeAndVariant('FINANCE', 'basic', 'MICRO').length;
  const medium = questionsForSizeAndVariant('FINANCE', 'basic', 'MEDIUM').length;
  const large = questionsForSizeAndVariant('FINANCE', 'basic', 'LARGE').length;
  assert.strictEqual(micro, 12, `FINANCE MICRO المتوقّع 12، الفعليّ ${micro}`);
  assert.strictEqual(medium, 16, `FINANCE MEDIUM المتوقّع 16 (+4 موسومة MEDIUM)، الفعليّ ${medium}`);
  assert.strictEqual(large, 18, `FINANCE LARGE المتوقّع 18 (+2 موسومة LARGE)، الفعليّ ${large}`);
  // SMALL = نواة عمداً (قرار ٨.٣: SMALL يشارك النواة، لا أسئلة موسومة SMALL).
  const small = questionsForSizeAndVariant('FINANCE', 'basic', 'SMALL').length;
  assert.strictEqual(small, 12, `FINANCE SMALL = نواة 12 (قرار الشرائح الثلاث)، الفعليّ ${small}`);
  console.log('✔ (١ب) محتوى FINANCE: MICRO=12 · SMALL=12 · MEDIUM=16 · LARGE=18');
}

// ── (٢) القيد الحاكم عبر سؤال موسوم اصطناعيّ (minSize: LARGE) في محور digital ──
{
  const SYNTHETIC: DeptQuestion = {
    id: 'hr_syn_large_only',
    axis: 'digital',
    prompt: 'سؤال بنيويّ اصطناعيّ للكبيرة فقط',
    options: [
      { value: 'none', label: '-', score: 0 },
      { value: 'partial', label: '-', score: 1 },
      { value: 'good', label: '-', score: 2 },
      { value: 'great', label: '-', score: 3 },
    ],
    minSize: 'LARGE',
  };

  const baseMicro = questionsForSizeAndVariant('HR', 'basic', 'MICRO').length;
  const baseLarge = questionsForSizeAndVariant('HR', 'basic', 'LARGE').length;
  DEPT_BANKS.HR.basic.push(SYNTHETIC); // حقن مؤقّت
  try {
    const servedMicro = questionsForSizeAndVariant('HR', 'basic', 'MICRO');
    const servedLarge = questionsForSizeAndVariant('HR', 'basic', 'LARGE');

    // ٢أ — الفلترة: الصغير لا يرى الموسوم، الكبير يراه (فرق سؤال واحد بالضبط).
    assert.strictEqual(servedMicro.length, baseMicro, 'MICRO يجب ألّا يرى الموسوم LARGE');
    assert.strictEqual(servedLarge.length, baseLarge + 1, 'LARGE يجب أن يرى الموسوم الإضافيّ');
    assert.ok(
      !servedMicro.some((q) => q.id === SYNTHETIC.id) &&
        servedLarge.some((q) => q.id === SYNTHETIC.id),
      'وجود السؤال الموسوم يجب أن يتبع الحجم'
    );

    // ٢ب — قابليّة المقارنة: كلاهما يجيب مجموعته كاملةً "great" → 100 رغم اختلاف العدد.
    const microScore = scoreBasicAuditFor('HR', answersFor(servedMicro), 'MICRO');
    const largeScore = scoreBasicAuditFor('HR', answersFor(servedLarge), 'LARGE');
    assert.strictEqual(microScore.healthPct, 100, 'MICRO تامّ = 100 (المقام لم ينكمش)');
    assert.strictEqual(largeScore.healthPct, 100, 'LARGE تامّ = 100 (تطبيع رغم +1 سؤال)');

    // ٢ج — كشف العيب: لو قُدِّم للصغير (12) وقُيِّم بمقياس الكبير (13) — السؤال
    // غير المطروح = 0 → healthPct ينهار دون 100. هذا ما يمنعه المصدر الواحد.
    const buggy = scoreBasicAuditFor('HR', answersFor(servedMicro), 'LARGE');
    assert.ok(
      buggy.healthPct < 100,
      `العيب المتوقّع: تقييم إجابات الصغير بمقياس الكبير يُنقص الصحّة، الفعليّ ${buggy.healthPct}`
    );
    console.log(
      `✔ (٢) القيد: filter ${servedMicro.length}/${servedLarge.length} · MICRO=100 · LARGE=100 · العيب المكتشَف=${buggy.healthPct}`
    );
  } finally {
    DEPT_BANKS.HR.basic.pop(); // إزالة الحقن مهما حدث
  }
}

// ── تأكيد النظافة بعد الحقن ──
assert.strictEqual(
  questionsForSizeAndVariant('HR', 'basic', 'LARGE').length,
  17,
  'يجب أن يعود البنك إلى 17 (بنك HR الحقيقيّ) بعد إزالة الحقن'
);

console.log('\n✅ كل اختبارات قيد الحجم نجحت');
