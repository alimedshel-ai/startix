// اختبار المنتِج — رقعة الهويّة النقيّة بعد قبول دعوة (ق١+ق٣). لا مُشغِّل اختبار
// بلاحقة .test.ts بالخادم (نفيٌ موثّق: `find server -name '*.test.ts'` = 0)، لكنّ
// للمستودع اصطلاح ts-node assert (test:size) — هذا يتبعه:
//   npx ts-node src/controllers/invitations.acceptTest.ts   (أو: npm run test:invite)
//
// يُنتج رقعة القرار (لا يقرؤها) لكل حالة — ومنها حافّة OWNER التي راجعها المستخدم.

import assert from 'node:assert';

import { inviteIdentityPatch } from './invitations';

type Patch = { userType: 'MANAGER'; managerType: 'INTERNAL' } | null;
type Case = {
  desc: string;
  role: string;
  user: { userType: string; managerType: string | null };
  expect: Patch;
};

const PATCH: Patch = { userType: 'MANAGER', managerType: 'INTERNAL' };

const CASES: Case[] = [
  // الدلالة ٤ — الوصل يُطلَق: مدير بلا هويّة + دعوة manager → رقعة كاملة.
  { desc: 'MANAGER(null) + manager → patch',
    role: 'manager', user: { userType: 'MANAGER', managerType: null }, expect: PATCH },

  // الدلالة ٣ — لا يُدهَس المضبوط سلفاً:
  { desc: 'INDEPENDENT_PRO + manager → null',
    role: 'manager', user: { userType: 'MANAGER', managerType: 'INDEPENDENT_PRO' }, expect: null },
  { desc: 'INTERNAL + manager → null (ثابت)',
    role: 'manager', user: { userType: 'MANAGER', managerType: 'INTERNAL' }, expect: null },

  // الدلالة ٢ — OWNER محروس (الحافّة):
  { desc: 'OWNER + manager → null (حافّة: لا OWNER+INTERNAL)',
    role: 'manager', user: { userType: 'OWNER', managerType: null }, expect: null },

  // الدلالة ١ — دور غير manager:
  { desc: 'MANAGER(null) + member → null',
    role: 'member', user: { userType: 'MANAGER', managerType: null }, expect: null },
  { desc: 'MANAGER(null) + owner → null',
    role: 'owner', user: { userType: 'MANAGER', managerType: null }, expect: null },

  // ⚠️ توتّر مكشوف: الجدول (يُرقّي كلّ غير-OWNER) يُنتج رقعةً لمستثمرٍ بلا managerType،
  // أي يُعيد كتابة هويّة INVESTOR قائمة — وهو ما يوتّر مع مبدأ «لا تعيد كتابة هويّة».
  // القيمة مُنتَجة صراحةً هنا ليراها المالك ويقرّ إبقاءها أو إضافة حارس INVESTOR.
  { desc: 'INVESTOR(null) + manager → patch (⚠️ يُرقّي المستثمر — توتّر مع المبدأ)',
    role: 'manager', user: { userType: 'INVESTOR', managerType: null }, expect: PATCH },
];

for (const c of CASES) {
  const got = inviteIdentityPatch(c.user, c.role);
  console.log(`  ${c.role.padEnd(8)} × ${c.user.userType}(${c.user.managerType ?? 'null'}) → ${JSON.stringify(got)}`);
  assert.deepStrictEqual(got, c.expect, `فشل: ${c.desc}`);
}

// تأكيد صريح للحافّة: لا مسارٍ يُنتج OWNER+INTERNAL (بأيّ دور دعوة).
const ownerCombos = ['owner', 'manager', 'member'].map((r) =>
  inviteIdentityPatch({ userType: 'OWNER', managerType: null }, r),
);
assert.ok(ownerCombos.every((v) => v === null), 'حافّة: OWNER لا يصير INTERNAL بأيّ دور دعوة');

console.log(`✔ inviteIdentityPatch: ${CASES.length} حالة — الرقعة النقيّة صحيحة (الحافّة OWNER محروسة؛ توتّر INVESTOR مكشوف)`);
