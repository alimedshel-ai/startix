# الحالة الحاليّة — ستارتكس (مرجع يُقرأ أوّلاً)

> آخر تحديث: 2026-07-25 · الفرع: `nav/guided-path`
> يُكتب/يُقرأ **قبل** أي مهمّة — منه تُقرأ أسماء الملفّات والقيم المؤكَّدة، فلا تخمين.

## المحرّك الموحّد (سليم — لا يُمَسّ في المهامّ ٢/٣)
- `journey/nextStep.ts` — `getNextStep` (بالمرحلة لا بالصفحة؛ **لا `deptPath`، لا `pathname`**)
- `hooks/useGuidedNext.ts` — يدمج: الإنقاذ → تسلسل analysisPlan (①.٥) → getNextStep (٢)
- `lib/analysisPlan.ts` — `BASE_ORDER` = audit → deep → 7S → value-chain → org-dna → pestel → …

## الرقع المُنجَزة (مُلتزَمة، مرفوعة)
- `b10b478` — الرقعة A: حذف `ESSENTIAL_SEQUENCE` من `ClientDetailPage` (بقي تعليق فقط، سطر 293) + ⭐ من `useGuidedNext` عبر `cardStateFor`
- `b10b478` — الرقعة C: `resolveRescuePlan` inline (`RescuePlanCockpit`)
- `36a1dbe` — الرقعة F: نقل `stageStatus` من Sidebar → `journey/stageStatus.ts` + حارس الترتيب
- `e9c0c30` — تنطيق `useCompany` (`useCompanyById`) · maturity-completes-deep · المرحلة أ (تسمية العمق: مختصر/موسّع/شامل)

## قيم مؤكَّدة (من الكود — لا تُفترَض)
- `types/user.ts:2` → `ManagerType = 'INTERNAL' | 'INDEPENDENT_PRO'` (القيمة = **`INDEPENDENT_PRO`**)
- `SelectTypePage.tsx:73` → `step = 'role' | 'managerType' | 'specialty'`، يبدأ دائماً من `'role'`؛ يقرأ `?role=` فقط → **لا مسار دخول مباشر لخطوة التخصّص** (تأكيد مسبق للمهمّة ٢)

## المتبقّي (المهامّ ٢ و٣)
- **`NextStepCard.tsx`** (المُقرِّر الموازي) — يقرأ من `ANALYSIS_SEQUENCE` (`NextStepCard.tsx:55`، منفصل عن المحرّك):
  - `deep.deptPath='/manager/dept-deep'` (المبسّط) ≠ صفحة العميق `/manager/deep-analysis` → السيناريو ب (يلفّ للخلف)
  - مسار التدقيق ليس في `journeyStages` environment.toolPaths → `findStage=null` → السيناريو أ/د (صمت)
  - ترتيب `ANALYSIS_SEQUENCE` يخالف `BASE_ORDER` (value-chain/PESTEL قبل 7S)
- **`nav.ts` — `landingAfterOnboarding`** — مستقل بلا `specialtyDeptType` → `homeFor` → `/manager/clients` (السيناريو ج). ملاحظة: مسار التخطّي في `OnboardingPage.tsx:257` يستخدم `user` من المتجر (مشتبه فقدان التخصّص).

## تشخيص مؤقّت حيّ (يُحذف بعد الاستخدام)
سجلّات `[TRACE:*]` مُثبَّتة في `nav.ts`/`JoinPage.tsx`/`OnboardingPage.tsx` — تكشف أين يُفقَد `specialty`. حذفها: `grep -rl "\[TRACE:" client/src`.
