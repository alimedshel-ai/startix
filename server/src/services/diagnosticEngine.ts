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
  companyName: (label) => ({ title: 'Confirm legal entity', detail: 'Verify trade name and CR.', source: 'companyName' }),
  sector: (label) => ({ title: 'Sharpen sector positioning', detail: 'Pick a primary sector and 2-line value prop.', source: 'sector' }),
  stage: (label) => ({
    title: 'Stabilize the operating cadence',
    detail: 'Run a weekly leadership huddle for 8 weeks; track 3 critical KPIs.',
    source: 'stage',
  }),
  size: (label) => ({
    title: 'Right-size the team',
    detail: 'Map roles to revenue per head; defer hires until utilization exceeds 70%.',
    source: 'size',
  }),
  ownerDependency: (label) => ({
    title: 'Reduce owner dependency',
    detail: 'Document top-10 decisions and delegate three within 30 days.',
    source: 'ownerDependency',
  }),
  financialTracking: (label) => ({
    title: 'Close the books monthly',
    detail: 'Stand up an accounting system + a 5-line P&L by next month-end.',
    source: 'financialTracking',
  }),
  liquidity: (label) => ({
    title: 'Buy runway',
    detail: 'Cut discretionary spend 20% and target 90+ days of cash within 60 days.',
    source: 'liquidity',
  }),
  governance: (label) => ({
    title: 'Install lightweight governance',
    detail: 'Adopt a 1-page delegation matrix and run a monthly business review.',
    source: 'governance',
  }),
  scalability: (label) => ({
    title: 'Productize the highest-margin offering',
    detail: 'Pick one offering and remove all custom paths from delivery.',
    source: 'scalability',
  }),
  exitStrategy: (label) => ({
    title: 'Pick a directional exit story',
    detail: 'Choose IPO / M&A / family and align reporting to that audience.',
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
      headline: 'Survive the next 90 days',
      detail: 'Execute cash-protection plan; reach break-even by end of quarter.',
    },
    {
      name: 'pessimistic',
      headline: 'Forced restructuring',
      detail: 'Without intervention, layoffs or distressed sale within 3 months.',
    },
  ],
  NASCENT_CAUTIOUS: [
    {
      name: 'optimistic',
      headline: 'Reach product-market fit',
      detail: 'Lock in 5 paying customers and a repeatable acquisition channel within 90 days.',
    },
    {
      name: 'pessimistic',
      headline: 'Stuck in pilot loop',
      detail: 'Burn rate outpaces validation; pivot or shut down within 2 quarters.',
    },
  ],
  GROWING_CHAOTIC: [
    {
      name: 'optimistic',
      headline: 'Operationalize the growth',
      detail: 'Quality drops disappear; gross margin recovers as systems catch up.',
    },
    {
      name: 'pessimistic',
      headline: 'Growth-induced collapse',
      detail: 'Churn spikes, top talent leaves, growth stalls within 2 quarters.',
    },
  ],
  MATURE_COMPETITIVE: [
    {
      name: 'optimistic',
      headline: 'Compound the moat',
      detail: 'Adjacent expansion adds 15-25% revenue without new fixed cost.',
    },
    {
      name: 'pessimistic',
      headline: 'Slow erosion',
      detail: 'A nimbler entrant captures share; price competition trims margin.',
    },
  ],
  DEFAULT_STRATEGIC: [
    {
      name: 'optimistic',
      headline: 'Pick a clear direction',
      detail: 'Commit to one strategic path within 30 days and align resources.',
    },
    {
      name: 'pessimistic',
      headline: 'Drift continues',
      detail: 'Without a chosen path, energy fragments and momentum stalls.',
    },
  ],
};

function buildScenarios(path: StrategicPath, _maturity: number): ScenarioPreview[] {
  return SCENARIOS_BY_PATH[path];
}
