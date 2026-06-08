// محرّكات تشخيص للمدير والمستثمر — كل الأسئلة اختيارات (Multiple Choice)،
// لا حقول رقمية أو نصية يدوية. تستعملها معاينة `/preview/{manager,investor}`
// لإعطاء الزائر نتيجة فورية قبل التسجيل.

const DEPT_LABEL: Record<string, string> = {
  HR: 'الموارد البشرية',
  FINANCE: 'المالية',
  SALES: 'المبيعات',
  MARKETING: 'التسويق',
  OPERATIONS: 'العمليات',
  IT: 'تقنية المعلومات',
  CUSTOMER_SERVICE: 'خدمة العملاء',
  SUPPORT: 'الإمداد والدعم',
  LOGISTICS: 'اللوجستيات',
  QUALITY: 'الجودة',
  PROJECTS: 'المشاريع',
  GOVERNANCE: 'الحوكمة',
  COMPLIANCE: 'الامتثال',
};

// ═══════════════════════════════════════════════════════════════════════════
//   المدير — 7 أسئلة كلها enums
// ═══════════════════════════════════════════════════════════════════════════

export interface ManagerAnswers {
  departmentType: string;
  teamSize: 'micro' | 'small' | 'medium' | 'large';
  experienceLevel: 'junior' | 'mid' | 'senior' | 'expert';
  operationalMaturity: 'none' | 'partial' | 'good' | 'great';
  toolingMaturity: 'none' | 'basic' | 'modern' | 'advanced';
  reportingQuality: 'none' | 'partial' | 'good' | 'great';
  decisionAuthority: 'operational' | 'tactical' | 'strategic';
}

export interface ManagerResult {
  departmentLabel: string;
  capacityScore: number;
  toolingScore: number;
  experienceScore: number;
  governanceScore: number;
  overallScore: number;
  band: 'متعثّر' | 'يحتاج تطوير' | 'فعّال' | 'متقدّم';
  insights: { axis: 'الفريق' | 'الأدوات' | 'الخبرة' | 'الحوكمة'; pct: number }[];
  recommendations: { title: string; detail: string }[];
}

const TEAM_PTS: Record<ManagerAnswers['teamSize'], number> = {
  micro: 30, small: 90, medium: 80, large: 65,
};
const EXP_PTS: Record<ManagerAnswers['experienceLevel'], number> = {
  junior: 25, mid: 55, senior: 85, expert: 95,
};
const OPS_PTS: Record<ManagerAnswers['operationalMaturity'], number> = {
  none: 10, partial: 40, good: 75, great: 95,
};
const TOOL_PTS: Record<ManagerAnswers['toolingMaturity'], number> = {
  none: 10, basic: 40, modern: 75, advanced: 95,
};
const REPORT_PTS: Record<ManagerAnswers['reportingQuality'], number> = {
  none: 10, partial: 40, good: 75, great: 95,
};
const AUTH_PTS: Record<ManagerAnswers['decisionAuthority'], number> = {
  operational: 35, tactical: 70, strategic: 95,
};

function bandManager(score: number): ManagerResult['band'] {
  if (score < 30) return 'متعثّر';
  if (score < 55) return 'يحتاج تطوير';
  if (score < 80) return 'فعّال';
  return 'متقدّم';
}

export function calculateManagerResult(a: ManagerAnswers): ManagerResult {
  const capacityScore = TEAM_PTS[a.teamSize];
  const experienceScore = EXP_PTS[a.experienceLevel];
  const toolingScore = TOOL_PTS[a.toolingMaturity];
  // الحوكمة = متوسط نضج العمليات + جودة التقارير + سلطة القرار
  const governanceScore = Math.round((OPS_PTS[a.operationalMaturity] + REPORT_PTS[a.reportingQuality] + AUTH_PTS[a.decisionAuthority]) / 3);
  const overallScore = Math.round((capacityScore + experienceScore + toolingScore + governanceScore) / 4);
  const band = bandManager(overallScore);

  const insights: ManagerResult['insights'] = [
    { axis: 'الفريق', pct: capacityScore },
    { axis: 'الخبرة', pct: experienceScore },
    { axis: 'الأدوات', pct: toolingScore },
    { axis: 'الحوكمة', pct: governanceScore },
  ];

  const recommendations: ManagerResult['recommendations'] = [];
  if (toolingScore < 60) recommendations.push({
    title: 'حدّث الأدوات الرقمية',
    detail: 'انتقل من الجداول اليدوية إلى منظومة سحابية تخصّ قسمك (ERP / CRM / HRIS).',
  });
  if (OPS_PTS[a.operationalMaturity] < 60) recommendations.push({
    title: 'وثّق إجراءات التشغيل',
    detail: 'اكتب SOP لأهم 5 عمليات يومية، وراجعها مع الفريق كل ربع.',
  });
  if (REPORT_PTS[a.reportingQuality] < 60) recommendations.push({
    title: 'أنشئ لوحة تقارير شهرية',
    detail: '5 مؤشّرات حرجة بلوحة واحدة، تُرسل تلقائياً للقيادة كل شهر.',
  });
  if (AUTH_PTS[a.decisionAuthority] < 60) recommendations.push({
    title: 'فاوض على صلاحيات أوسع',
    detail: 'حدّد 3 قرارات تتأخّر بسبب التصعيد، واطلب تفويضاً مكتوباً.',
  });
  if (experienceScore < 50) recommendations.push({
    title: 'استثمر في التدريب القيادي',
    detail: 'برنامج إرشاد مع قائد أكثر خبرة + شهادتان متخصّصتان خلال 6 أشهر.',
  });
  if (a.teamSize === 'micro') recommendations.push({
    title: 'وسّع الفريق تدريجياً',
    detail: 'حدّد 2 وظائف مفقودة بأعلى أثر على الإنتاجية، وابدأ بالتوظيف.',
  });
  if (a.teamSize === 'large') recommendations.push({
    title: 'قسّم الفريق لوحدات أصغر',
    detail: 'فرق من 8–12 مع قائد فرعي لتسريع القرارات وتعميق الملكية.',
  });
  while (recommendations.length < 3) {
    recommendations.push({
      title: 'دورة مراجعة شهرية',
      detail: 'اجتماع 60 دقيقة شهرياً مع فريقك لمراجعة المؤشّرات والقرارات.',
    });
  }

  return {
    departmentLabel: DEPT_LABEL[a.departmentType] ?? a.departmentType,
    capacityScore,
    toolingScore,
    experienceScore,
    governanceScore,
    overallScore,
    band,
    insights,
    recommendations: recommendations.slice(0, 4),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//   المستثمر — 6 أسئلة كلها enums
// ═══════════════════════════════════════════════════════════════════════════

export interface InvestorAnswers {
  portfolioSize: '1' | '2-5' | '6-15' | '16+';
  investmentStage: 'seed' | 'early' | 'growth' | 'late';
  monitoringCadence: 'monthly' | 'quarterly' | 'annual';
  sectorFocus: 'single' | 'diverse' | 'opportunistic';
  involvementType: 'active_board' | 'observer' | 'passive';
  ticketSize: 'under_100k' | '100k_1m' | '1m_10m' | '10m_plus';
}

export interface InvestorResult {
  breadthScore: number;
  disciplineScore: number;
  involvementScore: number;
  capitalScore: number;
  riskAppetiteLabel: string;
  overallScore: number;
  band: 'مبتدئ' | 'متطوّر' | 'متقدّم' | 'مؤسسي';
  insights: {
    axis: 'اتّساع المحفظة' | 'انضباط المتابعة' | 'مستوى المشاركة' | 'حجم رأس المال';
    pct: number;
  }[];
  recommendations: { title: string; detail: string }[];
}

const PORTFOLIO_PTS: Record<InvestorAnswers['portfolioSize'], number> = {
  '1': 20, '2-5': 50, '6-15': 80, '16+': 95,
};
const CADENCE_PTS: Record<InvestorAnswers['monitoringCadence'], number> = {
  monthly: 95, quarterly: 70, annual: 35,
};
const STAGE_LABEL: Record<InvestorAnswers['investmentStage'], string> = {
  seed: 'تأسيس عالي المخاطر/عائد',
  early: 'مرحلة مبكّرة موزّعة',
  growth: 'نموّ متوازن',
  late: 'متأخّرة/مدرجة منخفضة المخاطر',
};
const FOCUS_PTS: Record<InvestorAnswers['sectorFocus'], number> = {
  single: 60, diverse: 90, opportunistic: 45,
};
const INVOLVE_PTS: Record<InvestorAnswers['involvementType'], number> = {
  active_board: 95, observer: 65, passive: 35,
};
const TICKET_PTS: Record<InvestorAnswers['ticketSize'], number> = {
  under_100k: 30, '100k_1m': 60, '1m_10m': 85, '10m_plus': 95,
};

function bandInvestor(score: number): InvestorResult['band'] {
  if (score < 35) return 'مبتدئ';
  if (score < 60) return 'متطوّر';
  if (score < 85) return 'متقدّم';
  return 'مؤسسي';
}

export function calculateInvestorResult(a: InvestorAnswers): InvestorResult {
  // الاتّساع = حجم المحفظة + التركيز القطاعي
  const breadthScore = Math.round((PORTFOLIO_PTS[a.portfolioSize] + FOCUS_PTS[a.sectorFocus]) / 2);
  // الانضباط = تواتر المراجعة (المؤشّر الأقوى)
  const disciplineScore = CADENCE_PTS[a.monitoringCadence];
  // المشاركة = نوع التورّط مع شركات المحفظة
  const involvementScore = INVOLVE_PTS[a.involvementType];
  // رأس المال = حجم التذكرة الواحدة
  const capitalScore = TICKET_PTS[a.ticketSize];

  const overallScore = Math.round((breadthScore + disciplineScore + involvementScore + capitalScore) / 4);
  const band = bandInvestor(overallScore);

  const insights: InvestorResult['insights'] = [
    { axis: 'اتّساع المحفظة', pct: breadthScore },
    { axis: 'انضباط المتابعة', pct: disciplineScore },
    { axis: 'مستوى المشاركة', pct: involvementScore },
    { axis: 'حجم رأس المال', pct: capitalScore },
  ];

  const recommendations: InvestorResult['recommendations'] = [];
  if (disciplineScore < 60) recommendations.push({
    title: 'كثّف وتيرة المراجعة',
    detail: 'انتقل لمراجعة شهرية مع كل شركة محفظة لتتبّع 5 مؤشّرات رئيسية.',
  });
  if (breadthScore < 50) recommendations.push({
    title: 'نوّع محفظتك',
    detail: 'استهدف 6–10 استثمارات في 3 قطاعات لتقليل التركّز.',
  });
  if (a.sectorFocus === 'opportunistic') recommendations.push({
    title: 'حدّد أطروحة استثمار',
    detail: 'اكتب 2–3 معايير اختيار صارمة قبل أي صفقة جديدة، لتقليل التشتّت.',
  });
  if (involvementScore < 60) recommendations.push({
    title: 'فعّل دورك مع شركات المحفظة',
    detail: 'احصل على مقعد مراقب أو مجلس على الأقل في أكبر 3 استثمارات.',
  });
  if (a.investmentStage === 'seed') recommendations.push({
    title: 'احتسب مخاطر مرحلة التأسيس',
    detail: 'احتفظ بـ 30%+ من الالتزامات لجولات Follow-on في الشركات الواعدة.',
  });
  if (capitalScore < 50) recommendations.push({
    title: 'كبّر حجم التذكرة تدريجياً',
    detail: 'ركّز رأس المال في أعلى 5 قناعات بدلاً من تشتيت الالتزامات.',
  });
  while (recommendations.length < 4) {
    recommendations.push({
      title: 'لوحة محفظة موحّدة',
      detail: 'لوحة واحدة تجمع MRR، الـ Burn، الـ Runway، والتقدّم نحو الـ Milestones.',
    });
  }

  return {
    breadthScore,
    disciplineScore,
    involvementScore,
    capitalScore,
    riskAppetiteLabel: STAGE_LABEL[a.investmentStage],
    overallScore,
    band,
    insights,
    recommendations: recommendations.slice(0, 4),
  };
}
