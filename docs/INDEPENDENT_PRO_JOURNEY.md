# مسار المدير المستقلّ (INDEPENDENT_PRO) — من الهبوط إلى الأدوات

> خريطة مؤصَّلة على الكود (file:line)، تتبّعها مستكشفان على طرفَي الرحلة.
> الغرض: توثيق المسار الأساسيّ + تنوّع المسارات + **كشف مسار التخصيص الثاني المتنازع**.

---

## الجزء ١ — المسار الكامل خطوةً خطوة

### ① صفحة الهبوط — `LandingPage.tsx`
مدخلان (كلاهما محايد للدور):
- «جرّب التشخيص · بدون تسجيل» → `/diagnostic/try` (سطر 77، 130)
- «ابدأ الآن» → `/select-type` (سطر 51)

### ② اختيار الدور والتخصّص — `SelectTypePage.tsx`
تسلسل ثلاثيّ للمدير المستقلّ:
1. **الدور:** «مدير / مستشار» → `chooseRole('MANAGER')` (سطر 104)
2. **نوع المدير:** «متابعة كمدير مستقل» → `chooseManagerType('INDEPENDENT_PRO')` (سطر 113)
3. **التخصّص:** ١٣ تخصّصاً → `setSelectedSpecialty(s)` (سطر 124)
4. **تفرّع:** إن كان للتخصّص تقييم نضج (`MATURITY_BY_SPECIALTY` = HR/FINANCE فقط) → `/diagnostic/m/{specialty}`؛ وإلّا → `/join` مباشرة (سطر 126)

### ③ التشخيص المجانيّ (اختياريّ) — مسـاران منفصلان
- **العامّ** `TryDiagnosticPage.tsx`: ٧ أسئلة للمدير — `departmentType · teamSize · experienceLevel · operationalMaturity · toolingMaturity · reportingQuality · decisionAuthority` → `useDiagnosticStore.managerDraft`؛ النتيجة `managerResult` **مؤقّتة (transient)**.
- **الخاصّ بالتخصّص** `MaturityPage.tsx`: يظهر لـHR/FINANCE فقط؛ مسودّة في **localStorage** (استثناء موثّق)، بلا استدعاء API.

> ⚠️ **ازدواج ①:** «الحجم» يُجمع مرّتين بوحدتين — `teamSize` (micro/small/…) في التشخيص، و`firstClientSize` (MICRO/…) في التسجيل. يُحوَّل الأوّل تقديراً ويُستبدَل بالثاني إن وُجد.

### ④ التسجيل — `JoinPage.tsx`
فرع INDEPENDENT_PRO:
- مطلوب: name/email/password + **`firstClientName`** (superRefine سطر 49–60)
- `firstClientMeta = { sector, size }` فقط (سطر 140–146) — **لا يحمل `strategyPath`**
- بعده `persistPendingDiagnosticAndPickHome` (سطر 179–217): للمدير المستقلّ، `managerResult` **يبقى مؤقّتاً لا يُحفظ** (سطر 176–178) → الوجهة `homeFor = /manager/clients`، لكن يمرّ عبر `/onboarding` أوّلاً (سطر 155–165).

### ⑤ التهيئة — `OnboardingPage.tsx`
شرائح المدير المستقلّ: **`['identity', 'pains', 'goals', 'path']`** (سطر 223–231)

| الشريحة | تجمع | تُملأ مسبقاً من |
|---|---|---|
| identity | OPEX أوّل عميل (team/budget/target/salary) | تقدير من `teamSize` التشخيص (سطر 167–180) |
| pains | آلام متعدّدة | أعلى ٢ للتخصّص `SPECIALTY_TOP_PAINS` (سطر 193–195) |
| goals | أهداف متعدّدة | أعلى ٢ للتخصّص (سطر 196–198) |
| **path** | المسار QUICK/MEDIUM/LONG | `pathRec?.path` من ماليّة **المالك** (سطر 199–200) |

يُحفظ: `{ pains, goals, strategyPath, firstCompany: { opex } }` (الشركة أُنشئت وقت التسجيل).

> ⚠️ **مفتاح المشكلة:** `pathRec` يُشتقّ من `diagnosticOwnerDraft.liquidity/financialTracking` — وهي **غائبة للمدير المستقلّ** (إشارات مالك لا مدير) ⇒ `pathRec = null` ⇒ **لا تحديد مسبق للمسار** ⇒ المدير يختار **أعمى** (لا شارة «موصى به»).

### ⑥ الوجهة — `/manager/clients` (وضع المحفظة)
`homeFor(MANAGER, INDEPENDENT_PRO) = /manager/clients` (nav.ts:556–567). لا مراحل تظهر حتى يُختار عميل → `/manager/clients/:id?client=X` → تظهر المراحل.

### ⑦ داخل التطبيق — الرحلة الموحّدة
- **٦ مراحل عالميّة** (`journeyStages.ts`): environment → synthesis → directions → indicators → initiatives → execution.
- **مسار المدير ٤ مراحل** (`managerPath.ts`): admin-diagnosis · financial-diagnosis · composite-analysis · guided-plan — **طبقة عرض فقط** تُخرَّط على العالميّة (سطر 1–5، 34–37)، لا محرّك ثانٍ.
- **الخطوة التالية** `useGuidedNext.ts`: أولويّة صارمة — **الطوارئ** (صحّة<٤٠) ثم **خطّة التحليل ①** ثم **التقدّم الطبيعيّ** (مُقيَّد بالمسار) ثم **بوّابات مصادر SWOT**.

---

## الجزء ٢ — تنوّع المسارات الاستراتيجيّة وأسبابها

`PATH_STAGES` (journeyStages.ts:257–261) — كل مسار = **مجموعة مراحل جزئيّة** من الستّ:

| المسار | المراحل | يُسقط | المدّة | السبب |
|---|---|---|---|---|
| **QUICK / تشغيليّ** | environment · synthesis · initiatives · execution | directions + indicators | ٠–٣ شهور | تشخيص → توليف → مبادرات → تنفيذ. لا صياغة توجّه ولا مؤشّرات — لوقف النزيف بسرعة |
| **MEDIUM / تكتيكيّ** | + directions | indicators | ٣–١٢ شهر | يضيف صياغة التوجّه الاستراتيجيّ؛ قرارات ربعيّة |
| **LONG / استراتيجيّ** | كل الستّ | — | ١٢–٣٦+ | + طبقة المؤشّرات (KPIs) — الرحلة الكاملة متعدّدة السنوات |

**الآليّة:** `isStageInPath` يقرّر الظهور، `canOpenStage` يقفل بالتسلسل **داخل المسار فقط** (مستخدم QUICK لا يُقفل على directions لأنها خارج مساره)، و`overallProgressPct` يحسب النسبة على مراحل المسار وحدها.

---

## الجزء ٣ — مسار التخصيص الثاني (مصحَّح بعد فحص الإصلاح القائم)

**تصحيح:** تأطيري الأوّل («ثلاثة مُقرِّرات على مقياس واحد يتنازعون») **غير دقيق**. إصلاح توحيد الرحلة القائم ([ROADMAP.md:80](ROADMAP.md)، [DISPLAY_VS_DECISION.md](DISPLAY_VS_DECISION.md)) **حسم الملكيّة سلفاً**، وميّز «خدعة العرض» عن «قفزة القرار». الصورة الصحيحة:

### ما هو محسوم (ليس تنازعاً)
| المحور | المالك الوحيد | الإشارة | ملاحظة |
|---|---|---|---|
| **مسار الرحلة** (أيّ مراحل) | `classify` فقط | الصحّة/`dangerZone` | QUICK/MEDIUM/LONG |
| **عمق التحليل** (أيّ أدوات في ①) | `analysisPlan` فقط | الحجم+القطاع+الصحّة | مختصر/موسّع/شامل |

هذان **محوران مختلفان** (مدًى مقابل عمق)، لا متنافسان — يتشاركان المفردات صدفةً. و«وسم ⬆️ ترقَّ/⚠️ راجِع» ليس عطلاً بل `reconcileLevel` **يعمل كما صُمّم**: يحذّر ولا يفرض (اليدويّ يبقى الفعّال).

### ما هو مفتوح فعلاً (متتبَّع في ROADMAP)
| المصدر | الحالة الحقيقيّة | البند |
|---|---|---|
| `NextStepCard` مصدر «تالٍ» موازٍ + خطأ مسار dept-deep | مُقرِّر موازٍ باقٍ للترحيل | ROADMAP #5 |
| تناقض §1.5 (analysisPlan) ↔ §2 (getNextStep) على تعريف «المصدر الداخليّ» | قرار توحيد معلّق | ROADMAP #6 |
| **`pathRecommendation` (الماليّة) بذرة مسار ثالثة عند التهيئة** | تُخالف «لا اشتقاق ثالث»؛ وللمدير المستقلّ = `null` ⇒ اختيار أعمى | يلامس #10 |
| **`classify` يشتقّ من `healthPct` فقط** (يتجاهل runway/trajectory/مرحلة) | **دَين أعلى قيمة** | ROADMAP #10 |
| تشتّت الأدوات / مسار المستقلّ الواحد الواضح | UX كبير | ROADMAP #16 |

### أين يقع نموذج الخطط المتداخلة
نموذجك (الاستراتيجيّة مظلّة للجميع · التشغيليّ/التكتيكيّ آفاقٌ داخلها · **الفجوات+العجلة تقود التركيز**) **ليس خطّة جديدة تنافس الإصلاح — بل هو الوجهة التي يقصدها البندان #10 و#16:**
- **#10** = إثراء مُدخَلات `classify` من «الصحّة فقط» إلى «الفجوات+العجلة» (شدّة التدقيق + runway + المرحلة) ⇒ مصدر التركيز الواحد المطلوب.
- **إعادة تأطير التهيئة** = تقاعد بذرة `pathRecommendation` المتنافسة، وعرض «الاستراتيجيّة مظلّتك · تركيزك هذا الربع تشغيليّ لأن هذه فجواتك» بدل «اختر واحداً أعمى».
- **#16** = المسار الواحد الواضح للمستقلّ يتبع ذلك.

∴ **لا أكتب خطّة توحيد موازية** (تلك مفارقة الموضوع) — أُوائم نموذجك مع الإصلاح القائم وأسلسل البنود.

---

## ملحق — الأدلّة (file:line) الأساسيّة
LandingPage.tsx:51,77,130 · SelectTypePage.tsx:104,113,124,126 · TryDiagnosticPage.tsx:483–557 · MaturityPage.tsx:13–66 · JoinPage.tsx:49–60,140–217 · OnboardingPage.tsx:199–200,223–231,270–294 · nav.ts:539–584 · journeyStages.ts:189–200,257–287 · managerPath.ts:11–52 · analysisPlan.ts:184–209 · classify.ts:49–129 · rescue.ts:49–166 · useGuidedNext.ts:48–145 · Sidebar.tsx:120–284
