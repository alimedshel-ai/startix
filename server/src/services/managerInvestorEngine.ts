// محرّكات تشخيص مبسّطة للمدير والمستثمر — تستعملها معاينة `/preview`
// المسجّلة (POST /api/diagnostic/preview/{manager,investor}) لتعطي الزائر
// نتيجة سريعة قبل التسجيل.

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

export interface ManagerAnswers {
  departmentType: string;
  experienceYears: number;
  teamSize: number;
  toolingMaturity: 'none' | 'basic' | 'modern' | 'advanced';
  topChallenge: string;
}

export interface ManagerResult {
  departmentLabel: string;
  capacityScore: number;     // 0-100
  toolingScore: number;      // 0-100
  experienceScore: number;   // 0-100
  overallScore: number;      // 0-100
  band: 'متعثّر' | 'يحتاج تطوير' | 'فعّال' | 'متقدّم';
  insights: { axis: 'الفريق' | 'الأدوات' | 'الخبرة'; pct: number }[];
  recommendations: { title: string; detail: string }[];
}

const TOOLING_PTS: Record<ManagerAnswers['toolingMaturity'], number> = {
  none: 10, basic: 40, modern: 75, advanced: 95,
};

function bandManager(score: number): ManagerResult['band'] {
  if (score < 30) return 'متعثّر';
  if (score < 55) return 'يحتاج تطوير';
  if (score < 80) return 'فعّال';
  return 'متقدّم';
}

export function calculateManagerResult(a: ManagerAnswers): ManagerResult {
  // الخبرة: 0–10 سنة = خط أساس، >10 يصل لـ 100
  const experienceScore = Math.min(100, Math.round((a.experienceYears / 10) * 100));
  // الفريق: حجم معقول 8–25 = 100، أصغر أو أكبر بكثير يقلّ
  const teamSize = a.teamSize;
  let capacityScore: number;
  if (teamSize === 0) capacityScore = 10;
  else if (teamSize < 5) capacityScore = 50;
  else if (teamSize <= 25) capacityScore = 90;
  else if (teamSize <= 100) capacityScore = 75;
  else capacityScore = 60;
  const toolingScore = TOOLING_PTS[a.toolingMaturity];

  const overallScore = Math.round((capacityScore + toolingScore + experienceScore) / 3);
  const band = bandManager(overallScore);

  const insights: ManagerResult['insights'] = [
    { axis: 'الفريق', pct: capacityScore },
    { axis: 'الأدوات', pct: toolingScore },
    { axis: 'الخبرة', pct: experienceScore },
  ];

  const recommendations: ManagerResult['recommendations'] = [];
  if (toolingScore < 60) recommendations.push({
    title: 'حدّث الأدوات الرقمية',
    detail: 'انتقل من الجداول اليدوية إلى منظومة سحابية تخصّ قسمك (ERP / CRM / HRIS).',
  });
  if (capacityScore < 60) recommendations.push({
    title: 'أعد ضبط حجم الفريق',
    detail: 'اربط كل دور بمسؤولية واضحة وقابلة للقياس قبل أي توظيف جديد.',
  });
  if (experienceScore < 50) recommendations.push({
    title: 'استثمر في التدريب القيادي',
    detail: 'برنامج إرشاد مع قائد أكثر خبرة + شهادتان متخصّصتان خلال 6 أشهر.',
  });
  if (a.topChallenge.length >= 3) recommendations.push({
    title: 'عالج تحدّيك الأكبر',
    detail: `أنشئ خطة إجراءات لـ "${a.topChallenge}" خلال 30 يوماً، مع مؤشّر قياس واحد.`,
  });
  // ضمان 3 توصيات على الأقل
  while (recommendations.length < 3) {
    recommendations.push({
      title: 'أنشئ دورة مراجعة شهرية',
      detail: 'اجتماع 60 دقيقة شهرياً مع فريقك لمراجعة المؤشّرات والقرارات.',
    });
  }

  return {
    departmentLabel: DEPT_LABEL[a.departmentType] ?? a.departmentType,
    capacityScore,
    toolingScore,
    experienceScore,
    overallScore,
    band,
    insights,
    recommendations: recommendations.slice(0, 4),
  };
}

// ─── المستثمر ───────────────────────────────────────────────────────────────

export interface InvestorAnswers {
  portfolioSize: '1' | '2-5' | '6-15' | '16+';
  investmentStage: 'seed' | 'early' | 'growth' | 'late';
  monitoringCadence: 'monthly' | 'quarterly' | 'annual';
}

export interface InvestorResult {
  breadthScore: number;          // اتّساع المحفظة
  disciplineScore: number;       // انضباط المتابعة
  riskAppetiteLabel: string;     // وصف شهية المخاطر
  overallScore: number;
  band: 'مبتدئ' | 'متطوّر' | 'متقدّم' | 'مؤسسي';
  insights: { axis: 'اتّساع المحفظة' | 'انضباط المتابعة' | 'مرحلة الاستثمار'; pct: number }[];
  recommendations: { title: string; detail: string }[];
}

const PORTFOLIO_PTS: Record<InvestorAnswers['portfolioSize'], number> = {
  '1': 20, '2-5': 50, '6-15': 80, '16+': 95,
};
const CADENCE_PTS: Record<InvestorAnswers['monitoringCadence'], number> = {
  monthly: 95, quarterly: 70, annual: 35,
};
const STAGE_PTS: Record<InvestorAnswers['investmentStage'], number> = {
  seed: 30, early: 50, growth: 75, late: 90,
};
const STAGE_LABEL: Record<InvestorAnswers['investmentStage'], string> = {
  seed: 'تأسيس عالي المخاطر/عائد',
  early: 'مرحلة مبكّرة موزّعة',
  growth: 'نموّ متوازن',
  late: 'متأخّرة/مدرجة منخفضة المخاطر',
};

function bandInvestor(score: number): InvestorResult['band'] {
  if (score < 35) return 'مبتدئ';
  if (score < 60) return 'متطوّر';
  if (score < 85) return 'متقدّم';
  return 'مؤسسي';
}

export function calculateInvestorResult(a: InvestorAnswers): InvestorResult {
  const breadthScore = PORTFOLIO_PTS[a.portfolioSize];
  const disciplineScore = CADENCE_PTS[a.monitoringCadence];
  const stageScore = STAGE_PTS[a.investmentStage];

  const overallScore = Math.round((breadthScore + disciplineScore + stageScore) / 3);
  const band = bandInvestor(overallScore);

  const insights: InvestorResult['insights'] = [
    { axis: 'اتّساع المحفظة', pct: breadthScore },
    { axis: 'انضباط المتابعة', pct: disciplineScore },
    { axis: 'مرحلة الاستثمار', pct: stageScore },
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
  if (a.investmentStage === 'seed') recommendations.push({
    title: 'احتسب مخاطر مرحلة التأسيس',
    detail: 'احتفظ بـ 30%+ من الالتزامات لجولات Follow-on في الشركات الواعدة.',
  });
  while (recommendations.length < 3) {
    recommendations.push({
      title: 'أنشئ لوحة محفظة موحّدة',
      detail: 'لوحة واحدة تجمع MRR، الـ Burn، الـ Runway، والتقدّم نحو الـ Milestones.',
    });
  }

  return {
    breadthScore,
    disciplineScore,
    riskAppetiteLabel: STAGE_LABEL[a.investmentStage],
    overallScore,
    band,
    insights,
    recommendations: recommendations.slice(0, 4),
  };
}
