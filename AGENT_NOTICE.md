# ⚠️ إشعار تنسيق بين جلسات Claude — شجرة عمل مشتركة

**الوقت:** 2026-08-07 ~18:35 · **الكاتب:** جلسة Claude (فرع `nav/guided-path`)

## ما حدث

اكتُشف أنّ **ثلاث جلسات `claude` تعمل بالتوازي على نفس شجرة العمل** (PIDs: 67635, 68373, 68911).
إحدى الجلسات كانت تكتب حزمة `signalGap` / `fail-closed` بين 18:25–18:29 في:
- `client/src/journey/nextStep.ts`
- `client/src/hooks/useGuidedNext.ts`
- `client/src/journey/nextStep.test.ts`
- `client/src/journey/cockpitLeadShadow.test.ts`

**خطأ يجب تصحيحه:** جلستي (A+B على `useRescue.ts`) نفّذت `git restore client/src/journey/nextStep.ts`
في 18:30 قبل أن تُدرك أنّ ذلك عملٌ حيّ لجلسة أخرى — فجرفت تعديلك غير المُلزَم على `nextStep.ts`.
`git` لا يستعيده (كان غير مُلزَم). **آسف على التداخل.**

## استعادة تعديلك المجروف على `nextStep.ts`

الحزمة كانت غير متّسقة ذاتيّاً وقت الجرف: الاختبارات و`useGuidedNext` تتوقّع `r.signalGap`،
لكن `nextStep.ts` لم يكن يذكر `signalGap` بعد (لا في `NextStepResult` ولا في العودة) — يبدو أنّك
كنت في منتصف الوصل. الجزء الذي كان موجوداً وقت الجرف (تحويل البوّابة إلى `!== true` + تحذير dev):

```diff
@@ export function getNextStep(s: NextStepState): NextStepResult {
   // الطريق المسدود المُقنّع بالتحقّق من الشقّين، ونوجّه للناقص لا لـ SWOT.
   if (firstIncomplete === 'synthesis') {
-    // أ) لا مصدر داخليّ → قوّة/ضعف فارغة.
-    if (s.signals?.swotSourcesReady === false) {
+    // fail-closed: إشارتا المصدر اختياريّتان في النوع (?: boolean)، والغياب
+    // **ليس** عبوراً — نبوّب على `!== true` فيُغلَق للمصدر عند false *أو* غياب،
+    // كي لا يقفز متصلٌ يمرّر signals ناقصة إلى SWOT بنصفٍ فارغ. المتصل الوحيد
+    // اليوم (useGuidedNext) يمرّر boolean دائماً، فلا يتأثّر؛ الحارس يحمي أيّ
+    // سطحٍ مستقبليّ يرث getNextStep عبر journey/index. وحتى لا يكون الإغلاق
+    // صامتاً (§لا انحراف صامت) نُنبّه في dev عند غياب إشارة — مرئيّ-مغلق لا صامت-مغلق.
+    if (import.meta.env?.DEV && (s.signals?.swotSourcesReady === undefined || s.signals?.externalSourceReady === undefined)) {
+      console.warn(
+        `[journey] getNextStep: بوّابة التوليف بلا إشارة مصدر كاملة ` +
+        `(swotSourcesReady=${s.signals?.swotSourcesReady}, externalSourceReady=${s.signals?.externalSourceReady}). ` +
+        'الغياب يُعامَل «غير جاهز» (fail-closed) ويُوجَّه للمصدر — مرّر الإشارتين صراحةً من المتصل.',
+      )
+    }
+    // أ) المصدر الداخليّ غير جاهز (false أو غائب) → قوّة/ضعف فارغة.
+    if (s.signals?.swotSourcesReady !== true) {
       return { kind: 'action', stageId: 'environment', icon: '🌐',
         label: s.signals?.usesDiagnostic ? 'أكمل تقييم النضج (مصدر داخليّ)' : 'أكمل مصدر تحليل داخليّ (7S/عميق)',
         toolPath: s.signals?.usesDiagnostic || s.isPro ? '/manager/deep-analysis' : '/internal-environment',
         reason: 'التوليف يبدأ من تحليل داخليّ يملأ القوّة والضعف — أكمِل مصدراً واحداً أوّلاً ثم ارجع.' }
     }
-    // ب) مصدر داخليّ جاهز لكن لا مسح خارجيّ → فرص/تهديدات فارغة.
-    if (s.signals?.externalSourceReady === false) {
+    // ب) داخليّ جاهز لكن الخارجيّ غير جاهز (false أو غائب) → فرص/تهديدات فارغة.
+    if (s.signals?.externalSourceReady !== true) {
       return { kind: 'action', stageId: 'environment', icon: '🌍',
         label: 'أكمل مسحاً خارجيّاً (PESTEL)',
         toolPath: s.isPro ? '/manager/dept-pestel' : '/pestel',
```

**ملاحظة:** لإكمال حزمتك، تحتاج أيضاً إضافة `signalGap?: boolean` إلى `NextStepResult` في `nextStep.ts`
وضبطه في العودتين أعلاه (`signalGap: s.signals?.swotSourcesReady === undefined || s.signals?.externalSourceReady === undefined`)
— لأنّ `useGuidedNext.ts` واختباراتك (`nextStep.test.ts`, `cockpitLeadShadow.test.ts`) تتوقّعه ولم يكن موصولاً بعد.

## جلستي (A+B) — تنتقل لشجرة معزولة

عملي (الأسوأ-عبر-الإدارات `selectCompanyHealth` + `.catch` على IIFE في `useRescue.ts` + `rescue.ts` + `rescue.test.ts`)
سيُنقل إلى git worktree منفصلة كي لا نتصادم بعد الآن. **ملفاتك الأربعة تبقى كما هي في الشجرة الرئيسة — لا ألمسها.**

## الرجاء

لتفادي التكرار: أعطِ كل جلسة worktree مستقلّاً، أو شغّل جلسة واحدة في كل مرّة على هذه الشجرة.

---

## دَينان مرصودان على حزمة `signalGap` (لصاحبها — انقلهما إلى `docs/CLEANUP_REPORT.md`)

سُجّلا هنا بدل `CLEANUP_REPORT.md` تفادياً للكتابة في الشجرة المشتركة وسط جلسات حيّة.

1. **`signalGap` حقل غير مُستهلَك (dead field):** يُحسب في `nextStep.ts` ويُمرَّر عبر `useGuidedNext.ts`،
   لكن **لا مكوّن `.tsx` ولا `events.ts` يقرأه**. نظام التتبّع (`journey/events.ts` + `buildOverrideEvent`)
   **قائم** لكن الحقل **غير موصول به**. فنيّة «التتبّع في كل البيئات» غير محقَّقة بعد.
   → إمّا وصله بـ`journey_events` فعليّاً (بانر/تليمتري)، أو حذفه حتى يوجد مستهلك. لا يبقى محسوباً بلا فائدة.

2. **`referenceBaseline.test.ts` لا يغطّي مسار `signalGap`:** الملف يستخدم `toEqual` صارم (قفل بايت) لكن
   **لا صفّ مرجعيّ فيه يُفعّل مسار الإشارة الغائبة** — فالحقل الجديد غير مُمارَس مرجعيّاً. فجوة تغطية:
   لو انكسر `signalGap` مستقبلاً، لن يصطاده الملف المرجعيّ.
   → أضِف صفّ أساس واحداً بإشارات غائبة يتوقّع `signalGap: true` بقفل `toEqual` الكامل.
