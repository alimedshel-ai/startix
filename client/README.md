# ستارتكس — واجهة الويب

واجهة المستخدم لمنصّة **ستارتكس** — منصّة الإدارة الاستراتيجية للسوق السعودي.
تُبنى بـ React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui (بنية Base UI)،
وتتصل بـ REST API على `../server`.

المنصّة موجّهة لثلاثة أدوار: **صاحب أعمال (Owner)**، **مدير قسم (Manager)**،
**مستثمر (Investor)** — كلٌّ منها له تدفّقه الخاص عبر التشخيص → التخطيط
الاستراتيجي → التنفيذ.

---

## المتطلبات

- **Node.js ≥ 18** (يُوصى بـ 20 LTS).
- **npm ≥ 9** (المتضمَّن مع Node 18+).
- سيرفر Startix API يعمل على `http://localhost:5001` أثناء التطوير المحلي.

## التشغيل

```bash
npm install          # تثبيت الاعتمادات
npm run dev          # خادم التطوير على http://localhost:5173
npm run build        # بناء إنتاج → dist/
npm run preview      # معاينة البناء الإنتاجي محلياً
npm run lint         # فحص ESLint
```

## متغيّرات البيئة

| المتغيّر | افتراضي | الغرض |
|---------|--------|--------|
| `VITE_API_URL` | (فارغ في الإنتاج) | عنوان الـ API. اتركه فارغاً حين ينشر Vercel مع rewrite `/api/*` (نفس-الأصل). فقط في التطوير: يعود لـ `http://localhost:5001`. |

في الإنتاج على Vercel، احذف هذا المتغيّر من إعدادات المشروع
حتى يستعمل client المسار النسبي `/api/...` عبر إعادة توجيه `vercel.json`.

## بنية `src/pages`

الصفحات مرتّبة حسب الدور. كلٌّ منها تُصدَّر باسم (`export function XPage`)
وتُسجَّل في `src/router/index.tsx`.

```
src/pages/
├── LandingPage.tsx                 صفحة الهبوط العامّة
├── LoginPage.tsx  JoinPage.tsx     دخول + تسجيل
├── SelectTypePage.tsx              اختيار الدور بعد الهبوط
├── OnboardingPage.tsx              أوّل صفحة بعد التسجيل — تحفظ التشخيص المُعلَّق
├── PricingPage.tsx                 الأسعار (Stripe checkout + billing portal)
├── TryDiagnosticPage.tsx           التشخيص المجاني قبل التسجيل (3 أدوار)
│
├── owner/                          صفحات صاحب الأعمال (55+ صفحة)
│   ├── DashboardPage / CEODashboardPage / ExecDashboardPage / …
│   ├── DiagnosticOwnerPage / DiagnosticResultPage
│   ├── SWOTPage / TOWSPage / PESTELPage / PorterFiveForcesPage / …
│   ├── ObjectivesPage / OKRsPage / KPIsPage / TasksPage / …
│   ├── AICenterPage / AdvisorPage / PresentationPage / …
│   └── ReportsPage / ReportPrintPage / AnalyticsDashboardPage / …
│
├── manager/                        صفحات مدير القسم
│   ├── DiagnosticManagerPage / SelectDeptPage
│   ├── DeptDashboardPage / ProDashboardPage
│   ├── {Dept}AuditPage × 13 قسماً (HR, Finance, Sales, …)
│   ├── BreakEvenPage                (Finance)
│   └── ComplianceAuditPage / ComplianceAuditProPage / ComplianceReformPage
│
└── investor/                       صفحات المستثمر
    ├── DiagnosticInvestorPage / InvestorDashboardPage
    ├── PortfolioPage                 محفظة الشركات
    └── CompanyDetailPage             تفاصيل شركة (تشخيص + رادار)
```

## بنية `src/`

- **`components/`** — مكوّنات مشتركة (Card, Button, RadarChart, PathBadge, EmptyState, ErrorBoundary…).
  - **`components/layouts/`** — MainLayout + Topbar + Sidebar + nav.ts (خريطة التنقّل).
  - **`components/ui/`** — عناصر shadcn (Button, Card, Input, Dialog…).
- **`lib/`** — طبقة الـ API + الوظائف المساعدة.
  - **`api.ts`** — axios instance (`withCredentials: true`).
  - **`strategicApi.ts`** — Objectives / OKRs / KPIs / Projects / Tasks / Artifacts.
  - **`deptApi.ts`** — Companies + Departments.
  - **`aiApi.ts`** — AI Center (Advisor, Smart Guide, Presentation).
  - **`paymentsApi.ts`, `reportsApi.ts`, `diagnosticQuestions.ts`, `managerInvestorQuestions.ts`**.
- **`store/`** — Zustand stores.
  - **`authStore.ts`** — المستخدم + الدور المختار.
  - **`diagnosticStore.ts`** — دفتر التشخيص المجاني قبل التسجيل (الاستثناء الوحيد المعتمد لـ localStorage).
- **`router/index.tsx`** — تعريف كل المسارات (عامّة + محمية).
- **`types/`** — أنواع مشتركة (User, PlanTier, StrategicPath…).

## قواعد المشروع

- **العربية RTL إجبارية** في كل الواجهة. النصوص الإنجليزية فقط للـ code identifiers والـ enums.
- **مصدر الحقيقة الوحيد = القاعدة عبر API.** ممنوع استخدام `localStorage`
  لتخزين بيانات العمل (تشخيصات، SWOT، أهداف، KPIs، تقارير، مالية).
  - الاستثناء الوحيد: `diagnosticStore.ts` — تدفّق "جرّب قبل التسجيل"، يُحفظ
    مؤقتاً حتى ينقله `OnboardingPage` للقاعدة بعد تسجيل الزائر.
- **لا mock/dummy في الواجهة.** كل ما يُعرض من `/api/*`. اعرض `EmptyState`
  عند غياب البيانات.
- **RTL + Arabic font**: `IBM Plex Sans Arabic` مُحمَّل عبر `@fontsource`.

## النشر

- الكلاينت يُنشر على **Vercel** (من فرع `main`).
- الفرع `main` يُدمج من فرع التطوير `التطوير` عبر PR.
- إعدادات Vercel:
  - Framework: Vite
  - Root Directory: `client`
  - `vercel.json` يوجّه `/api/*` و `/health*` إلى Render API — لذلك احذف
    `VITE_API_URL` من متغيّرات البيئة على Vercel لاستعمال المسار النسبي.

## روابط ذات صلة

- **السيرفر (API)**: `../server/README.md` (إن وُجد).
- **قاعدة البيانات**: Supabase Postgres — schema في `../server/prisma/schema.prisma`.
- **نشر الإنتاج**: `../DEPLOYMENT.md`.
