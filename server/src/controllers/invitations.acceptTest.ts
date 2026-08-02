// اختبار المنتِج — القرار النقيّ لنوع المدير بعد قبول دعوة (ق١+ق٣). لا مُشغِّل
// اختبار بالخادم، فهذا سكربت assert مكتفٍ ذاتيّاً يُشغَّل بـ ts-node ويخرج بغير
// صفر عند الفشل:
//   npx ts-node src/controllers/invitations.acceptTest.ts   (أو: npm run test:invite)
//
// يُنتج قيم القرار (لا يقرؤها) لكل حالة — ومنها حافّة OWNER+manager التي راجعها
// المستخدم: يجب ألّا تُنتِج تركيبة OWNER+INTERNAL غير المتّسقة.

import assert from 'node:assert';

import { managerTypeAfterAccept } from './invitations';

type Case = {
  desc: string;
  role: string;
  user: { userType: string; managerType: string | null };
  expect: 'INTERNAL' | null;
};

const CASES: Case[] = [
  // الوصل يُطلَق: مدير بلا نوع + دعوة manager → داخليّ (يرث سياق المالك، fromOwner).
  { desc: 'MANAGER(null) + role=manager → INTERNAL',
    role: 'manager', user: { userType: 'MANAGER', managerType: null }, expect: 'INTERNAL' },

  // الحرّاس (لا تغيير):
  { desc: 'INDEPENDENT_PRO + role=manager → null (لا يُدهَس المستقلّ)',
    role: 'manager', user: { userType: 'MANAGER', managerType: 'INDEPENDENT_PRO' }, expect: null },
  { desc: 'OWNER + role=manager → null (حافّة: لا OWNER+INTERNAL)',
    role: 'manager', user: { userType: 'OWNER', managerType: null }, expect: null },
  { desc: 'INVESTOR + role=manager → null (لا يمسّ المستثمر)',
    role: 'manager', user: { userType: 'INVESTOR', managerType: null }, expect: null },
  { desc: 'MANAGER(null) + role=member → null (دعوة غير manager)',
    role: 'member', user: { userType: 'MANAGER', managerType: null }, expect: null },
  { desc: 'MANAGER(null) + role=owner → null (دعوة غير manager)',
    role: 'owner', user: { userType: 'MANAGER', managerType: null }, expect: null },

  // موجود داخليّاً سلفاً + دعوة manager → يبقى داخليّاً (متسِق).
  { desc: 'INTERNAL + role=manager → INTERNAL (ثابت)',
    role: 'manager', user: { userType: 'MANAGER', managerType: 'INTERNAL' }, expect: 'INTERNAL' },
];

for (const c of CASES) {
  const got = managerTypeAfterAccept(c.role, c.user);
  console.log(`  ${c.role.padEnd(8)} × ${c.user.userType}(${c.user.managerType ?? 'null'}) → ${String(got)}`);
  assert.strictEqual(got, c.expect, `فشل: ${c.desc} — المتوقّع ${String(c.expect)}، الفعليّ ${String(got)}`);
}

// تأكيد صريح للحافّة التي أثارها المستخدم: لا مسارٍ يُنتج OWNER+INTERNAL.
const ownerCombos = ['owner', 'manager', 'member'].map((r) =>
  managerTypeAfterAccept(r, { userType: 'OWNER', managerType: null }),
);
assert.ok(ownerCombos.every((v) => v === null), 'حافّة: OWNER لا يصير INTERNAL بأيّ دور دعوة');

console.log(`✔ acceptInvitation: ${CASES.length} حالة (منها حافّة OWNER+manager) — القرار النقيّ صحيح`);
