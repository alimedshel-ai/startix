# المهمّة ٣ — ترحيل NextStepCard (يوم، بعد نجاح المهمّة ٢ · PR مستقلّ)

> اقرأ `docs/CURRENT_STATE.md` أوّلاً. تُلمَس ٣ أسطح: DeptAudit · DeptGap · StrategicShell.

## قبل البدء
- احسم «الرؤية الفوريّة» في المبسّط (`DeptDeepPage`) — **تُلتزَم أو تُحذف**، لا تُترَك معلّقة.

## الخطوات
1. احذف `ANALYSIS_SEQUENCE` + `AnalysisStageNextStep` من `NextStepCard.tsx`.
2. استبدل `findStage`/`curIdx`/`nextTool` بقراءة `useGuidedNext(companyId)` (المصدر الواحد).
3. تأكّد أن `useGuidedNext` يتعامل صحيحاً مع الثلاث صفحات:
   - **التدقيق** (`/manager/*/audit`) → يعرض «التالي» (لا صمت)
   - **العميق** (`/manager/deep-analysis`) → لا يلفّ للخلف للمبسّط
   - **المبسّط** (`/manager/dept-deep`) → إحماء ◇، لا يُحسب خطوةً

## معايير القبول
- `grep -rn "ANALYSIS_SEQUENCE" client/src/` = **صفر**
- صفحة التدقيق تعرض «التالي» (لا `return null`)
- التحليل العميق لا يلفّ للخلف (لا `[0]` fallback)
- **التدقيق = صفحة العميل = القمرة** تعرض نفس «التالي» لنفس العميل (مصدر واحد)
- الاختبارات خضراء + tsc/eslint نظيف

## لماذا الترحيل لا الترقيع (من CURRENT_STATE)
`ANALYSIS_SEQUENCE` ليس فيه deep.deptPath خطأ فقط — **ترتيبه كلّه يخالف `BASE_ORDER`** (value-chain/PESTEL قبل 7S)، ولا يحوي audit. فالترقيع (تصحيح deptPath) يُسكِت اللفّ لكن يُبقي الصفحة تخالف البيكون في التسلسل. الحلّ = مصدر واحد.
