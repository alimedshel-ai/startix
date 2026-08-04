// اختبار المنتِج — رقعة الهويّة النقيّة بعد قبول دعوة (ق١+ق٣). لا مُشغِّل اختبار
// بلاحقة .test.ts بالخادم (نفيٌ موثّق: `find server -name '*.test.ts'` = 0)، لكنّ
// للمستودع اصطلاح ts-node assert (test:size) — هذا يتبعه:
//   npx ts-node src/controllers/invitations.acceptTest.ts   (أو: npm run test:invite)
//
// يُنتج رقعة القرار (لا يقرؤها) لكل حالة — ومنها حافّة OWNER التي راجعها المستخدم.

import assert from 'node:assert';

import { inviteIdentityPatch, invitationGateReason, type InviteGate } from './invitations';

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

  // D-٣ محسوم (قرار المالك): حارس INVESTOR مُضاف — أيّ هويّة قائمة (userType ≠ MANAGER)
  // محروسة، فلا يُعاد كتابتها. المستثمر لا يُرقّى إلى مدير داخليّ.
  { desc: 'INVESTOR(null) + manager → null (D-٣: هويّة قائمة محروسة)',
    role: 'manager', user: { userType: 'INVESTOR', managerType: null }, expect: null },
];

for (const c of CASES) {
  const got = inviteIdentityPatch(c.user, c.role);
  console.log(`  ${c.role.padEnd(8)} × ${c.user.userType}(${c.user.managerType ?? 'null'}) → ${JSON.stringify(got)}`);
  assert.deepStrictEqual(got, c.expect, `فشل: ${c.desc}`);
}

// تأكيد صريح: لا هويّة قائمة (OWNER/INVESTOR) تُعاد كتابتها بأيّ دور دعوة (D-٣).
for (const ut of ['OWNER', 'INVESTOR']) {
  const combos = ['owner', 'manager', 'member'].map((r) =>
    inviteIdentityPatch({ userType: ut, managerType: null }, r),
  );
  assert.ok(combos.every((v) => v === null), `هويّة قائمة (${ut}) لا تُعاد كتابتها بأيّ دور`);
}

console.log(`✔ inviteIdentityPatch: ${CASES.length} حالة — الرقعة النقيّة صحيحة (كلّ هويّة قائمة محروسة؛ D-٣ محسوم)`);

// ─── الدلالة ٦+٧: حارس التوكن — منتهٍ/مستخدم/مُبطَل ⇒ رفض (بالتشغيل) ──────────
const NOW = new Date('2026-08-03T00:00:00Z');
const FUTURE = new Date('2026-09-01T00:00:00Z');
const PAST = new Date('2026-07-01T00:00:00Z');
type GateCase = { desc: string; inv: { status: string; expiresAt: Date } | null; expect: InviteGate };
const GATE_CASES: GateCase[] = [
  { desc: 'null → missing (توكن غير موجود)',              inv: null,                                      expect: 'missing' },
  { desc: 'accepted → not-pending (مستخدم)',             inv: { status: 'accepted',  expiresAt: FUTURE }, expect: 'not-pending' },
  { desc: 'cancelled → not-pending (مُبطَل)',            inv: { status: 'cancelled', expiresAt: FUTURE }, expect: 'not-pending' },
  { desc: 'pending + expiresAt ماضٍ → expired (منتهٍ)',  inv: { status: 'pending',   expiresAt: PAST },   expect: 'expired' },
  { desc: 'pending + صالح → ok',                         inv: { status: 'pending',   expiresAt: FUTURE }, expect: 'ok' },
];
for (const c of GATE_CASES) {
  const got = invitationGateReason(c.inv, NOW);
  console.log(`  توكن ${c.inv ? `${c.inv.status}/${c.inv.expiresAt < NOW ? 'منتهٍ' : 'صالح'}` : 'null'} → ${got}`);
  assert.strictEqual(got, c.expect, `فشل: ${c.desc} — المتوقّع ${c.expect}، الفعليّ ${got}`);
}
// تأكيد صريح: منتهٍ/مستخدم/مُبطَل كلّها رفض (ليست ok).
assert.ok(
  (['expired', 'not-pending', 'not-pending'] as InviteGate[]).every((g) => g !== 'ok'),
  'منتهٍ/مستخدم/مُبطَل يجب أن تُرفض جميعاً',
);
console.log(`✔ invitationGateReason: ${GATE_CASES.length} حالة — التوكن يُرفض قبل أيّ إنشاء (الدلالة ٦+٧)`);
