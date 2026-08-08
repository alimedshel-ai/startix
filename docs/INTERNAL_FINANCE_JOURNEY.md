# تصوّر تجربة العميل — مسار «المدير المالي الداخلي»

> **مَن:** مستخدمٌ نوعه `MANAGER` · `managerType = INTERNAL` (اختصاصه غالبًا `FINANCE`).
> **المدى:** من دعوة المالك حتى التنفيذ والمتابعة (الحلقة الكاملة) — لإدارة مالية **شركة المالك الواحدة**.
> **المصدر:** مبنيّة على الكود الفعليّ (مسارات، دوالّ قرار، تفرّعات `managerType`). كل مشهد يشير إلى الملف/المسار الحقيقيّ — لا شاشات متخيَّلة.
> **ملاحظة على الدور:** المدير المالي الداخلي **تابعٌ للمالك** — المالك هو من يُرسل له الدعوة (لا تسجيل ذاتيّ)، ويدير مالية شركته الواحدة، **ويشارك أهداف المالك** (دوره التنفيذ والمتابعة لا صياغة الأهداف). فوحدة العمل = (إدارة المالية داخل شركة المالك) — لا محفظة عملاء.
> **الفرق الجوهريّ عن المستقلّ:** المستقلّ ([FINANCE_MANAGER_JOURNEY.md](FINANCE_MANAGER_JOURNEY.md)) خبيرٌ يخدم عدّة شركات (وحدة العمل = عميل × إدارة)؛ الداخلي موظّفٌ في شركةٍ واحدة تابعٌ لمالكها.

---

## خريطة سريعة (العقد والقرارات)

```
دعوة المالك (بريد + توكن) → /invitations/accept أو /invitations/:token/register
        │ inviteIdentityPatch: MANAGER+null → MANAGER+INTERNAL
        ▼
   onboarding → homeFor(MANAGER, INTERNAL) = /manager/dept-dashboard
        │ (شركة واحدة تُحلّ تلقائيًّا عبر getMyFirstCompany — لا ?client=)
        ▼
   لوحة الإدارة ──► تدقيق المالية → التصنيف → الخطوة التالية → المراحل ①→⑥
        ▲                                                          │
        └──────── الحلقة المتكيّفة: قِس→صنّف→وجّه→نفّذ→أعِد القياس ◄─┘
                  (نفس محرّك المستقل/المالك — لا تفرّع managerType في classify/getNextStep)
```

الأهداف تأتي **من المالك** (`goalSource = 'fromOwner'`) — المدير الداخلي ينفّذ ويتابع، لا يؤلّف.

---

## الفصل ٠ — الدخول: دعوة المالك (لا تسجيل ذاتيّ)

| البند | التفصيل |
|---|---|
| **مَن يدعو** | المالك أو مديرٌ برتبة ≥ manager فقط ([invitations.ts:30-95](../server/src/controllers/invitations.ts) — «فقط المالك أو المدير يمكنه إرسال الدعوات»). |
| **آليّة الدعوة** | تُنشأ الدعوة بـ`role: 'manager'` + توكن، ويُرسَل بريدٌ برابط `/invitations/accept?token=…`. |
| **المبدأ الحاكم** | **«الدعوة مصدر المدير الداخليّ — لا التسجيل الذاتيّ»** ([invitations.ts:191-192](../server/src/controllers/invitations.ts)). لا يوجد مسار `/join` أو `SelectTypePage` يُنتج `INTERNAL`. |

> على النقيض من المستقلّ الذي يسجّل نفسه عبر `/join` ويختار تخصّصه، الداخلي **لا يظهر له خيار تسجيل ذاتيّ** — وجوده مشروطٌ بدعوة قائمة.

---

## الفصل ١ — قبول الدعوة / التسجيل عبرها

| المسار | البند |
|---|---|
| **مستخدم قائم** | `acceptInvitation` ([invitations.ts:155-214](../server/src/controllers/invitations.ts)): يتحقّق من التوكن، يطابق البريد، ينشئ رابط `CompanyUser` داخل معاملة، ثم يطبّق `inviteIdentityPatch`. |
| **مستخدم جديد** | `registerViaInvitation` ([invitations.ts:248-319](../server/src/controllers/invitations.ts)): المسار **الوحيد** الذي يُنتج `MANAGER+null`، ثم يحوّله فورًا لـ`INTERNAL` في المعاملة نفسها. |
| **بوّابة الهويّة** | `inviteIdentityPatch(user, role)` ([invitations.ts:125-133](../server/src/controllers/invitations.ts)): ثلاثة حرّاس — `role==='manager'` · `userType==='MANAGER'` · `managerType===null` — فلا يطمس `INDEPENDENT_PRO` قائمًا. النتيجة: `{ MANAGER, INTERNAL }`. |
| **أثر جانبيّ مقصود** | تُطلَق شارة `fromOwner` على الأهداف ([goalSource.ts:17](../client/src/lib/goalSource.ts))، ويُربط المدير بشركة المالك عبر `CompanyUser`. |

**مخرج الفصل:** مستخدم `MANAGER+INTERNAL` مربوطٌ بشركة المالك الواحدة، أهدافه `fromOwner`.

---

## الفصل ٢ — الهبوط الموحّد: لوحة الإدارة (شركة واحدة)

| البند | التفصيل |
|---|---|
| **الوجهة** | `homeFor(MANAGER, INTERNAL) = /manager/dept-dashboard` ([nav.ts:556-567](../client/src/components/layouts/nav.ts)) — **لا `/manager/clients`** (تلك للمستقلّ). |
| **هبوط موحّد** | `landingAfterOnboarding` يفوّض لـ`homeFor` ([nav.ts:578-584](../client/src/components/layouts/nav.ts)) — نفس الوجهة بعد التسجيل وبعد كل دخول. |
| **حلّ الشركة** | `useCompany` ([useCompany.ts:21-54](../client/src/hooks/useCompany.ts)): الداخلي والمالك يستعملان `getMyFirstCompany()` (شركة واحدة تلقائيّة) — **لا `?client=`** الخاص بمحفظة المستقلّ. |
| **التنقّل** | `navFor` ([nav.ts:517-554](../client/src/components/layouts/nav.ts)): الداخلي يحصل على `dept-dashboard` + الخطّة الاستراتيجيّة + بقيّة المراحل — **بلا قسم «العملاء والمحفظة»** (`proClientsSection` للمستقلّ فقط). |

**مخرج الفصل:** المدير الداخلي يرى لوحة إدارةٍ لشركةٍ واحدة تقوده للخطوة التالية — دون اختيار عميل.

---

## الفصل ٣ — الأهداف المشتركة (fromOwner): تنفيذ ومتابعة لا تأليف

| البند | التفصيل |
|---|---|
| **مصدر الأهداف** | `goalSourceFor(MANAGER, INTERNAL) = 'fromOwner'` ([goalSource.ts:11-19](../client/src/lib/goalSource.ts)) — يقابل `'manual'` للمستقلّ (يؤلّف لكل عميل). |
| **ما يراه** | يقرأ أهداف المالك نفسها (`Objective` بنفس `companyId` عبر رابط `CompanyUser`) — شارة **«🏛️ أهداف الشركة — من المالك؛ دورك التنفيذ والمتابعة»** ([ObjectivesPage.tsx:19-21](../client/src/pages/owner/ObjectivesPage.tsx)). |
| **طبيعة الشارة** | **شارة دورٍ لا آليّة نقل** ([goalSource.ts:8](../client/src/lib/goalSource.ts)) — العرض يوضّح المصدر؛ الأهداف صفٌّ واحد مشترك، لا نسخة منقولة. |

> راجع [[project_internal_manager_shares_owner_goals]]: المدير الداخلي والمالك يتشاركان نفس `companyId`/`Objective`؛ `fromOwner` شارة عرض. تمييز «مشترك مقابل مشتقّ» مؤجَّل.

---

## الفصل ٤ — تدقيق إدارة المالية (المرحلة ①، أوّل قياس)

نفس أدوات المستقلّ ومحرّكه، لكن **على شركة المالك الواحدة** لا على عميلٍ من محفظة:

| البند | التفصيل |
|---|---|
| **ما ينتج** | `healthPct` (٠–١٠٠) + `dangerZone` لإدارة المالية. |
| **طبقة الصحّة الماليّة** | `computeFinancialHealth` ([financialHealth.ts](../client/src/lib/financialHealth.ts)) — ١٢ مؤشّرًا مرجّحًا بفيتوات سيولة/تحصيل، **لكنّها دورمَنت**: لا طبقة بيانات معاملاتيّة تغذّيها بعد، فيقود `auditHealthPct` وحده ([classify.ts](../client/src/journey/classify.ts)). |
| **فجوة صادقة** | تلقين التحليل العميق للمالية = `GENERIC` (احتكاك أوّل مرّة، محتوى مؤجّل) — مشتركة مع المستقلّ. |

---

## الفصل ٥ — القيادة المتكيّفة: نفس المحرّك، بلا تفرّع للداخلي

**حقيقة جوهريّة:** محرّك الرحلة **لا يتفرّع بـ`managerType`** — الداخلي والمالك والمستقلّ يمرّون بالمنطق نفسه:

| المكوّن | الملف | تفرّع للداخلي؟ |
|---|---|---|
| التصنيف والمستوى | `classifyClient` ([classify.ts:49-89](../client/src/journey/classify.ts)) | **لا** — يشتقّ من الصحّة/`dangerZone` فقط |
| الخطوة التالية | `getNextStep`/`useGuidedNext` ([nextStep.ts:121-173](../client/src/journey/nextStep.ts)) | **لا** — فحص `isPro` لحالة «لا عميل» فقط؛ الداخلي كالمالك |
| فلترة المراحل | `PATH_STAGES`/`isStageInPath` ([journeyStages.ts:257-267](../client/src/lib/journeyStages.ts)) | **لا** — بالمسار (QUICK/MEDIUM/LONG) لا بالدور |
| استبدال الأدوات المُخصّصة للإدارة | `filterToolsForUser` ([journeyStages.ts:238-246](../client/src/lib/journeyStages.ts)) | **لا** — `isDeptScoped=true` للمستقلّ فقط؛ الداخلي يرى أدوات المالك (`/pestel` لا `/manager/dept-pestel`) |

**الحلقة المتكيّفة:** قِس (تدقيق) → صنّف (`classifyClient`) → وجّه (`useGuidedNext`) → نفّذ → أعِد القياس. المستوى يرتقي تلقائيًّا مع تحسّن الصحّة — تمامًا كالمستقلّ والمالك.

**فرع الطوارئ:** إن `level = emergency` (صحّة<٤٠) يُعرَض تسلسل الإنقاذ **risk → eisenhower → raci → gantt** كـ«التالي».

---

## الفصل ٦ — المراحل ①→⑥ (مفلترة بالمسار، أدوات بمستوى المالك)

نفس المراحل الستّ العالميّة ([journeyStages.ts](../client/src/lib/journeyStages.ts)) مفلترةً بـ`PATH_STAGES`، لكنّ الداخلي يرى **أدوات مستوى المالك** (لا نظائر `/manager/dept-*` الخاصّة بالمستقلّ):

| المرحلة | الأداة (مستوى المالك للداخلي) |
|---|---|
| **① البيئة** | `internal-environment` · `/pestel` · `value-chain` |
| **② التوليف** | `/swot` → `/tows` — بوّابة ثنائيّة المصدر (داخليّ نضج/تدقيق + خارجيّ PESTEL) |
| **③ التوجّهات** (MEDIUM/LONG) | `/directions` · `/bmc` · `/choices` · `/bcg` · `/ansoff` |
| **④ المؤشرات** (LONG) | `/measure` |
| **⑤ المبادرات** | `/priority` — مولّد `generateFromAll` + حارس الميزانيّة مقابل `Company.opex.budget` |
| **⑥ التنفيذ** | `/execute` — مشاريع + جانت + قياس دوريّ → إعادة تدقيق تُغلق الحلقة |

> بخلاف المستقلّ، الداخلي **لا يملك مسار المدير رباعيّ المراحل** (`managerPath`): `hasManagerPath('INTERNAL') = false` ([managerPath.ts:46,56-58](../client/src/journey/managerPath.ts)) — يدخل المراحل العالميّة مباشرةً بلا طبقة عرض تشخيصيّة رباعيّة.

---

## العمود الفقري (ملخّص القرارات وملفّاتها)

| القرار | الدالّة/الملف | يقود |
|---|---|---|
| إنشاء الداخلي بالدعوة | `inviteIdentityPatch` · [invitations.ts:125-133](../server/src/controllers/invitations.ts) | MANAGER+null → INTERNAL |
| الوجهة/الهبوط | `homeFor`/`landingAfterOnboarding` · [nav.ts:556-584](../client/src/components/layouts/nav.ts) | `/manager/dept-dashboard` |
| حلّ الشركة الواحدة | `getMyFirstCompany` · [useCompany.ts:21-54](../client/src/hooks/useCompany.ts) | شركة المالك بلا `?client=` |
| مصدر الأهداف | `goalSourceFor` · [goalSource.ts:17](../client/src/lib/goalSource.ts) | `fromOwner` (تنفيذ ومتابعة) |
| التصنيف/الخطوة | `classifyClient`/`getNextStep` · [classify.ts](../client/src/journey/classify.ts)، [nextStep.ts](../client/src/journey/nextStep.ts) | نفس محرّك الجميع (بلا تفرّع للداخلي) |

---

## الفروق عن المدير المالي المستقلّ (INDEPENDENT_PRO)

| المحور | الداخلي (INTERNAL) | المستقلّ (INDEPENDENT_PRO) |
|---|---|---|
| **الدخول** | دعوة المالك فقط | تسجيل ذاتيّ عبر `/join` |
| **وحدة العمل** | إدارة مالية شركة المالك الواحدة | محفظة عملاء (عميل × إدارة) |
| **الهبوط** | `/manager/dept-dashboard` | `/manager/clients` |
| **حلّ الشركة** | `getMyFirstCompany` تلقائيّ | `?client=` لكل عميل |
| **الأهداف** | `fromOwner` (ينفّذ ويتابع) | `manual` (يؤلّف لكل عميل) |
| **الأدوات** | مستوى المالك (`/pestel`) | مُخصّصة للإدارة (`/manager/dept-pestel`) |
| **مسار المدير الرباعيّ** | لا (`hasManagerPath=false`) | نعم (admin→financial→composite→guided) |
| **قسم المحفظة في التنقّل** | لا | نعم (`proClientsSection`) |

---

## الفجوات المكشوفة صراحةً (لا تُخفى)

1. **لا صفحات مخصّصة للداخلي** — كل ما يستعمله مشتركٌ مع المالك (`/manager/dept-dashboard` + أدوات مستوى المالك)، لا نظائر `/manager/dept-*`.
2. **دَين UX في لوحة الإدارة** — `DeptDashboardPage` تعرض حالة فارغة «اختر عميلاً للبدء» ([DeptDashboardPage.tsx:220-224](../client/src/pages/manager/DeptDashboardPage.tsx)) وهي مضلِّلة للداخلي (شركته تُحلّ تلقائيًّا دائمًا).
3. **طبقة الصحّة الماليّة دورمَنت** — `computeFinancialHealth` معزول ومختبَر لكن بلا مصدر بيانات معاملاتيّة يقود التصنيف بعد (أولويّة عليا مشتركة).
4. **الأهداف المشتركة للقراءة فقط ضمنيًّا** — `fromOwner` شارة عرض بلا حالة UI صريحة «قابل للتعديل / للقراءة فقط» في `ObjectivesPage`.
5. **لا مؤشّر دور صريح** — التنقّل لا يُبرز «مدير داخليّ» كشارة واضحة تُميّز الدور بصريًّا.
</content>
</invoke>
