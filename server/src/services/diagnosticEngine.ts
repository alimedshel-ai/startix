import {
  OwnerAnswers,
  WEIGHTED_QUESTIONS,
  TOTAL_MAX_POINTS,
  DiagnosticQuestion,
} from '../lib/diagnosticQuestions';

export type StrategicPath =
  | 'EMERGENCY_RISK'
  | 'NASCENT_CAUTIOUS'
  | 'GROWING_CHAOTIC'
  | 'MATURE_COMPETITIVE'
  | 'DEFAULT_STRATEGIC';

export interface RadarDatum {
  axis: 'Governance' | 'Financial' | 'Team' | 'Digital';
  value: number; // 0-100
}

export interface Weakness {
  key: keyof OwnerAnswers;
  label: string;
  pct: number; // 0-100, lower = weaker
}

export interface RoadmapAction {
  title: string;
  detail: string;
  source: keyof OwnerAnswers;
}

export interface ScenarioPreview {
  name: 'optimistic' | 'pessimistic';
  headline: string;
  detail: string;
}

export interface OwnerDiagnosticResult {
  strategicPath: StrategicPath;
  pathScores: Record<StrategicPath, number>;
  maturityScore: number;
  pointsBreakdown: { key: keyof OwnerAnswers; label: string; points: number; max: number }[];
  radarData: RadarDatum[];
  weaknesses: Weakness[];
  roadmap: RoadmapAction[];
  scenarios: ScenarioPreview[];
}

function pointsFor<Q extends DiagnosticQuestion>(q: Q, value: string): number {
  const opt = q.options.find((o) => o.value === value);
  if (!opt) throw new Error(`Unknown option ${value} for ${q.key}`);
  return opt.points;
}

export function calculateOwnerPath(answers: OwnerAnswers): OwnerDiagnosticResult {
  const breakdown = WEIGHTED_QUESTIONS.map((q) => ({
    key: q.key,
    label: q.label,
    points: pointsFor(q, answers[q.key] as string),
    max: q.maxPoints,
  }));
  const total = breakdown.reduce((s, b) => s + b.points, 0);
  const maturityScore = Math.round((total / TOTAL_MAX_POINTS) * 100);

  const stagePts = breakdown.find((b) => b.key === 'stage')!.points;
  const sizePts = breakdown.find((b) => b.key === 'size')!.points;
  const depPts = breakdown.find((b) => b.key === 'ownerDependency')!.points;
  const finPts = breakdown.find((b) => b.key === 'financialTracking')!.points;
  const liqPts = breakdown.find((b) => b.key === 'liquidity')!.points;
  const govPts = breakdown.find((b) => b.key === 'governance')!.points;
  const scalPts = breakdown.find((b) => b.key === 'scalability')!.points;

  // Radar (each axis 0-100)
  const radarData: RadarDatum[] = [
    { axis: 'Governance', value: Math.round((govPts / 30) * 100) },
    { axis: 'Financial', value: Math.round(((finPts + liqPts) / 60) * 100) },
    { axis: 'Team', value: Math.round(((sizePts + depPts) / 30) * 100) },
    { axis: 'Digital', value: Math.round(((scalPts + finPts / 2) / 20) * 100) },
  ];

  // Path fit scoring
  const stage = answers.stage;
  const liq = answers.liquidity;
  const gov = answers.governance;
  const dep = answers.ownerDependency;
  const fin = answers.financialTracking;
  const size = answers.size;
  const scal = answers.scalability;

  const pathScores: Record<StrategicPath, number> = {
    EMERGENCY_RISK: 0,
    NASCENT_CAUTIOUS: 0,
    GROWING_CHAOTIC: 0,
    MATURE_COMPETITIVE: 0,
    DEFAULT_STRATEGIC: 0,
  };

  if (liq === 'critical') pathScores.EMERGENCY_RISK += 60;
  if (stage === 'struggle') pathScores.EMERGENCY_RISK += 30;
  if (dep === 'total') pathScores.EMERGENCY_RISK += 10;
  if (fin === 'none') pathScores.EMERGENCY_RISK += 10;

  if (stage === 'startup') pathScores.NASCENT_CAUTIOUS += 50;
  if (gov === 'none' || gov === 'partial') pathScores.NASCENT_CAUTIOUS += 20;
  if (fin === 'none' || fin === 'manual') pathScores.NASCENT_CAUTIOUS += 15;
  if (size === 'micro' || size === 'small') pathScores.NASCENT_CAUTIOUS += 10;

  if (stage === 'scaling') pathScores.GROWING_CHAOTIC += 50;
  if (gov === 'none' || gov === 'partial') pathScores.GROWING_CHAOTIC += 20;
  if (dep === 'high' || dep === 'total') pathScores.GROWING_CHAOTIC += 20;
  if (scal === 'none' || scal === 'mid') pathScores.GROWING_CHAOTIC += 10;

  if (stage === 'stable') pathScores.MATURE_COMPETITIVE += 40;
  if (gov === 'system' || gov === 'board') pathScores.MATURE_COMPETITIVE += 20;
  if (liq === 'mid' || liq === 'high') pathScores.MATURE_COMPETITIVE += 20;
  if (fin === 'perfect') pathScores.MATURE_COMPETITIVE += 10;
  if (scal === 'easy') pathScores.MATURE_COMPETITIVE += 10;

  const ranked = (Object.entries(pathScores) as [StrategicPath, number][])
    .filter(([k]) => k !== 'DEFAULT_STRATEGIC')
    .sort((a, b) => b[1] - a[1]);

  let strategicPath: StrategicPath;
  if (ranked[0][1] === 0) {
    strategicPath = 'DEFAULT_STRATEGIC';
  } else if (ranked[0][1] - ranked[1][1] < 5) {
    strategicPath = 'DEFAULT_STRATEGIC';
  } else {
    strategicPath = ranked[0][0];
  }
  pathScores.DEFAULT_STRATEGIC =
    strategicPath === 'DEFAULT_STRATEGIC' ? Math.max(ranked[0][1], 1) : 0;

  const weaknesses: Weakness[] = [...breakdown]
    .map((b) => ({ key: b.key, label: b.label, pct: Math.round((b.points / b.max) * 100) }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 4);

  const roadmap: RoadmapAction[] = weaknesses.map((w) => buildAction(w));
  const scenarios = buildScenarios(strategicPath, maturityScore);

  return {
    strategicPath,
    pathScores,
    maturityScore,
    pointsBreakdown: breakdown,
    radarData,
    weaknesses,
    roadmap,
    scenarios,
  };
}

const ACTION_BY_KEY: Record<keyof OwnerAnswers, (label: string) => RoadmapAction> = {
  companyName: () => ({
    title: 'أكّد الكيان القانوني',
    detail: 'تحقّق من الاسم التجاري ورقم السجل التجاري.',
    source: 'companyName',
  }),
  sector: () => ({
    title: 'حدّد موقعك في القطاع',
    detail: 'اختر قطاعاً رئيسياً واكتب عرض القيمة في سطرين.',
    source: 'sector',
  }),
  stage: () => ({
    title: 'ثبّت إيقاع التشغيل',
    detail: 'اجتماع قيادي أسبوعي لمدة 8 أسابيع، وتتبّع 3 مؤشرات حرجة.',
    source: 'stage',
  }),
  size: () => ({
    title: 'اضبط حجم الفريق',
    detail: 'اربط كل وظيفة بالإيراد لكل رأس، وأجّل التوظيف حتى تتجاوز نسبة الإشغال 70%.',
    source: 'size',
  }),
  ownerDependency: () => ({
    title: 'قلّل الاعتماد على المالك',
    detail: 'وثّق أهم 10 قرارات وفوّض ثلاثة منها خلال 30 يوماً.',
    source: 'ownerDependency',
  }),
  financialTracking: () => ({
    title: 'أقفل الدفاتر شهرياً',
    detail: 'فعّل نظام محاسبة + قائمة أرباح من 5 أسطر مع نهاية الشهر القادم.',
    source: 'financialTracking',
  }),
  liquidity: () => ({
    title: 'اشتر مدى زمنياً للشركة',
    detail: 'اخفض المصروفات الاختيارية 20% واستهدف سيولة 90+ يوماً خلال 60 يوماً.',
    source: 'liquidity',
  }),
  governance: () => ({
    title: 'ركّب حوكمة خفيفة',
    detail: 'اعتمد مصفوفة تفويض من صفحة واحدة، واعقد مراجعة شهرية للأعمال.',
    source: 'governance',
  }),
  scalability: () => ({
    title: 'حوّل أعلى عرض ربحية إلى منتج',
    detail: 'اختر عرضاً واحداً واحذف كل المسارات المخصّصة من التسليم.',
    source: 'scalability',
  }),
  exitStrategy: () => ({
    title: 'اختر اتجاه قصة الخروج',
    detail: 'اختر بين الطرح العام / الاستحواذ / العائلة، وحاذِ التقارير مع الجمهور المناسب.',
    source: 'exitStrategy',
  }),
};

function buildAction(w: Weakness): RoadmapAction {
  return ACTION_BY_KEY[w.key](w.label);
}

const SCENARIOS_BY_PATH: Record<StrategicPath, ScenarioPreview[]> = {
  EMERGENCY_RISK: [
    {
      name: 'optimistic',
      headline: 'النجاة في الـ 90 يوماً القادمة',
      detail: 'نفّذ خطة حماية النقد وصِل لنقطة التعادل قبل نهاية الربع.',
    },
    {
      name: 'pessimistic',
      headline: 'إعادة هيكلة قسرية',
      detail: 'بدون تدخّل سريع، تسريح موظفين أو بيع اضطراري خلال 3 أشهر.',
    },
  ],
  NASCENT_CAUTIOUS: [
    {
      name: 'optimistic',
      headline: 'الوصول لملاءمة المنتج للسوق',
      detail: 'احصل على 5 عملاء يدفعون وقناة استحواذ قابلة للتكرار خلال 90 يوماً.',
    },
    {
      name: 'pessimistic',
      headline: 'العَلَق في حلقة التجارب',
      detail: 'معدّل الإنفاق يتجاوز إثبات الفرضيات؛ تحوّل في الاتجاه أو إغلاق خلال ربعين.',
    },
  ],
  GROWING_CHAOTIC: [
    {
      name: 'optimistic',
      headline: 'تأطير النموّ تشغيلياً',
      detail: 'انهيارات الجودة تختفي، وهامش الربح الإجمالي يستردّ مع لحاق الأنظمة.',
    },
    {
      name: 'pessimistic',
      headline: 'انهيار ناتج عن النموّ',
      detail: 'ارتفاع التسرّب، خروج المواهب القيادية، وتوقّف النموّ خلال ربعين.',
    },
  ],
  MATURE_COMPETITIVE: [
    {
      name: 'optimistic',
      headline: 'تعميق الميزة التنافسية',
      detail: 'توسّع جانبي يضيف 15–25% من الإيرادات بدون تكاليف ثابتة جديدة.',
    },
    {
      name: 'pessimistic',
      headline: 'تآكل بطيء',
      detail: 'منافس أكثر مرونة يستحوذ على حصة، وضغط الأسعار يقلّص الهامش.',
    },
  ],
  DEFAULT_STRATEGIC: [
    {
      name: 'optimistic',
      headline: 'اختيار اتجاه واضح',
      detail: 'التزم بمسار استراتيجي واحد خلال 30 يوماً وحاذِ الموارد معه.',
    },
    {
      name: 'pessimistic',
      headline: 'استمرار التشتّت',
      detail: 'بدون مسار محدّد، تتشظّى الطاقة ويتوقّف الزخم.',
    },
  ],
};

function buildScenarios(path: StrategicPath, _maturity: number): ScenarioPreview[] {
  return SCENARIOS_BY_PATH[path];
}
