import { createBrowserRouter, Navigate } from 'react-router-dom'

import { LandingPage } from '@/pages/LandingPage'
import { SelectTypePage } from '@/pages/SelectTypePage'
import { LoginPage } from '@/pages/LoginPage'
import { JoinPage } from '@/pages/JoinPage'
import { PricingPage } from '@/pages/PricingPage'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { RoleRoute } from '@/components/RoleRoute'
import { MainLayout } from '@/components/layouts/MainLayout'

// --- Owner pages ---------------------------------------------------------
import { DashboardPage } from '@/pages/owner/DashboardPage'
import { CEODashboardPage } from '@/pages/owner/CEODashboardPage'
import { CompaniesListPage } from '@/pages/owner/CompaniesListPage'
import { AddCompanyPage } from '@/pages/owner/AddCompanyPage'
import { DiagnosticOwnerPage } from '@/pages/owner/DiagnosticOwnerPage'
import { DiagnosticResultPage } from '@/pages/owner/DiagnosticResultPage'
import { CompanyHealthPage } from '@/pages/owner/CompanyHealthPage'
import { PESTELPage } from '@/pages/owner/PESTELPage'
import { PorterFiveForcesPage } from '@/pages/owner/PorterFiveForcesPage'
import { BenchmarkingPage } from '@/pages/owner/BenchmarkingPage'
import { StakeholdersPage } from '@/pages/owner/StakeholdersPage'
import { OrgDNAPage } from '@/pages/owner/OrgDNAPage'
import { ValueChainPage } from '@/pages/owner/ValueChainPage'
import { CoreCapabilitiesPage } from '@/pages/owner/CoreCapabilitiesPage'
import { SWOTPage } from '@/pages/owner/SWOTPage'
import { TOWSPage } from '@/pages/owner/TOWSPage'
import { GapAnalysisPage } from '@/pages/owner/GapAnalysisPage'
import { RiskMapPage } from '@/pages/owner/RiskMapPage'
import { AmbitionGapPage } from '@/pages/owner/AmbitionGapPage'
import { StrategicTensionsPage } from '@/pages/owner/StrategicTensionsPage'
import { DirectionsPage } from '@/pages/owner/DirectionsPage'
import { ScenariosPage } from '@/pages/owner/ScenariosPage'
import { ChoicesPage } from '@/pages/owner/ChoicesPage'
import { AnsoffMatrixPage } from '@/pages/owner/AnsoffMatrixPage'
import { BCGMatrixPage } from '@/pages/owner/BCGMatrixPage'
import { SPACEMatrixPage } from '@/pages/owner/SPACEMatrixPage'
import { QSPMPage } from '@/pages/owner/QSPMPage'
import { ThreeHorizonsPage } from '@/pages/owner/ThreeHorizonsPage'
import { ObjectivesPage } from '@/pages/owner/ObjectivesPage'
import { OGSMPage } from '@/pages/owner/OGSMPage'
import { AnnualPlanPage } from '@/pages/owner/AnnualPlanPage'
import { KPIsPage } from '@/pages/owner/KPIsPage'
import { OKRsPage } from '@/pages/owner/OKRsPage'
import { PriorityMatrixPage } from '@/pages/owner/PriorityMatrixPage'
import { InitiativesPage } from '@/pages/owner/InitiativesPage'
import { ProjectsPage } from '@/pages/owner/ProjectsPage'
import { GanttChartPage } from '@/pages/owner/GanttChartPage'
import { TasksPage } from '@/pages/owner/TasksPage'
import { KPIEntriesPage } from '@/pages/owner/KPIEntriesPage'
import { LiveBoardPage } from '@/pages/owner/LiveBoardPage'
import { ActivityFeedPage } from '@/pages/owner/ActivityFeedPage'
import { StrategicCalendarPage } from '@/pages/owner/StrategicCalendarPage'
import { ReviewsPage } from '@/pages/owner/ReviewsPage'
import { CorrectionsPage } from '@/pages/owner/CorrectionsPage'
import { ReportsPage } from '@/pages/owner/ReportsPage'
import { AICenterPage } from '@/pages/owner/AICenterPage'
import { AdvisorPage } from '@/pages/owner/AdvisorPage'
import { PresentationPage } from '@/pages/owner/PresentationPage'
import { PainScreenPage } from '@/pages/owner/PainScreenPage'
import { SimulationLabPage } from '@/pages/owner/SimulationLabPage'
import { AnalyticsDashboardPage } from '@/pages/owner/AnalyticsDashboardPage'

// --- Manager pages -------------------------------------------------------
import { DiagnosticManagerPage } from '@/pages/manager/DiagnosticManagerPage'
import { SelectDeptPage } from '@/pages/manager/SelectDeptPage'
import { DeptDashboardPage } from '@/pages/manager/DeptDashboardPage'
import { ProDashboardPage } from '@/pages/manager/ProDashboardPage'
import { DeptQuestionnairePage } from '@/pages/manager/DeptQuestionnairePage'
import { DeptDeepPage } from '@/pages/manager/DeptDeepPage'
import { DeptSmartPage } from '@/pages/manager/DeptSmartPage'
import { HRAuditPage } from '@/pages/manager/HRAuditPage'
import { FinanceAuditPage } from '@/pages/manager/FinanceAuditPage'
import { BreakEvenPage } from '@/pages/manager/BreakEvenPage'
import { SalesAuditPage } from '@/pages/manager/SalesAuditPage'
import { MarketingAuditPage } from '@/pages/manager/MarketingAuditPage'
import { OperationsAuditPage } from '@/pages/manager/OperationsAuditPage'
import { ITAuditPage } from '@/pages/manager/ITAuditPage'
import { CustomerServiceAuditPage } from '@/pages/manager/CustomerServiceAuditPage'
import { LogisticsAuditPage } from '@/pages/manager/LogisticsAuditPage'
import { LogisticsReformPlanPage } from '@/pages/manager/LogisticsReformPlanPage'
import { QualityAuditPage } from '@/pages/manager/QualityAuditPage'
import { ProjectsAuditPage } from '@/pages/manager/ProjectsAuditPage'
import { GovernanceAuditPage } from '@/pages/manager/GovernanceAuditPage'
import { GovernanceHubPage } from '@/pages/manager/GovernanceHubPage'
import { ComplianceAuditPage } from '@/pages/manager/ComplianceAuditPage'
import { ComplianceAuditProPage } from '@/pages/manager/ComplianceAuditProPage'
import { ComplianceReformPage } from '@/pages/manager/ComplianceReformPage'

// --- Investor pages ------------------------------------------------------
import { DiagnosticInvestorPage } from '@/pages/investor/DiagnosticInvestorPage'
import { InvestorDashboardPage } from '@/pages/investor/InvestorDashboardPage'
import { PortfolioPage } from '@/pages/investor/PortfolioPage'
import { CompanyDetailPage } from '@/pages/investor/CompanyDetailPage'

export const router = createBrowserRouter([
  // Public
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/join', element: <JoinPage /> },
  { path: '/select-type', element: <SelectTypePage /> },
  { path: '/pricing', element: <PricingPage /> },

  // Authenticated (any role)
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/onboarding', element: <OnboardingPage /> },
      // Owner area
      {
        element: <RoleRoute allow={['OWNER']} />,
        children: [
          {
            element: <MainLayout />,
            children: [
              { path: '/dashboard', element: <DashboardPage /> },
              { path: '/ceo-dashboard', element: <CEODashboardPage /> },
              { path: '/companies', element: <CompaniesListPage /> },
              { path: '/companies/add', element: <AddCompanyPage /> },
              { path: '/diagnostic/owner', element: <DiagnosticOwnerPage /> },
              { path: '/diagnostic/result', element: <DiagnosticResultPage /> },
              { path: '/company-health', element: <CompanyHealthPage /> },
              { path: '/pestel', element: <PESTELPage /> },
              { path: '/porter', element: <PorterFiveForcesPage /> },
              { path: '/benchmarking', element: <BenchmarkingPage /> },
              { path: '/stakeholders', element: <StakeholdersPage /> },
              { path: '/org-dna', element: <OrgDNAPage /> },
              { path: '/value-chain', element: <ValueChainPage /> },
              { path: '/core-capabilities', element: <CoreCapabilitiesPage /> },
              { path: '/swot', element: <SWOTPage /> },
              { path: '/tows', element: <TOWSPage /> },
              { path: '/gap-analysis', element: <GapAnalysisPage /> },
              { path: '/risk-map', element: <RiskMapPage /> },
              { path: '/ambition-gap', element: <AmbitionGapPage /> },
              { path: '/strategic-tensions', element: <StrategicTensionsPage /> },
              { path: '/directions', element: <DirectionsPage /> },
              { path: '/scenarios', element: <ScenariosPage /> },
              { path: '/choices', element: <ChoicesPage /> },
              { path: '/ansoff', element: <AnsoffMatrixPage /> },
              { path: '/bcg', element: <BCGMatrixPage /> },
              { path: '/space', element: <SPACEMatrixPage /> },
              { path: '/qspm', element: <QSPMPage /> },
              { path: '/three-horizons', element: <ThreeHorizonsPage /> },
              { path: '/objectives', element: <ObjectivesPage /> },
              { path: '/ogsm', element: <OGSMPage /> },
              { path: '/annual-plan', element: <AnnualPlanPage /> },
              { path: '/kpis', element: <KPIsPage /> },
              { path: '/okrs', element: <OKRsPage /> },
              { path: '/priority-matrix', element: <PriorityMatrixPage /> },
              { path: '/initiatives', element: <InitiativesPage /> },
              { path: '/projects', element: <ProjectsPage /> },
              { path: '/gantt-chart', element: <GanttChartPage /> },
              { path: '/tasks', element: <TasksPage /> },
              { path: '/kpi-entries', element: <KPIEntriesPage /> },
              { path: '/live-board', element: <LiveBoardPage /> },
              { path: '/activity-feed', element: <ActivityFeedPage /> },
              { path: '/strategic-calendar', element: <StrategicCalendarPage /> },
              { path: '/reviews', element: <ReviewsPage /> },
              { path: '/corrections', element: <CorrectionsPage /> },
              { path: '/reports', element: <ReportsPage /> },
              { path: '/ai-center', element: <AICenterPage /> },
              { path: '/ai/advisor', element: <AdvisorPage /> },
              { path: '/ai/presentation', element: <PresentationPage /> },
              { path: '/ai/pain-screen', element: <PainScreenPage /> },
              { path: '/ai/simulation', element: <SimulationLabPage /> },
              { path: '/analytics-dashboard', element: <AnalyticsDashboardPage /> },
            ],
          },
        ],
      },
      // Manager area
      {
        element: <RoleRoute allow={['MANAGER']} />,
        children: [
          {
            element: <MainLayout />,
            children: [
              { path: '/manager/diagnostic', element: <DiagnosticManagerPage /> },
              { path: '/manager/select-dept', element: <SelectDeptPage /> },
              { path: '/manager/dept-dashboard', element: <DeptDashboardPage /> },
              { path: '/manager/pro-dashboard', element: <ProDashboardPage /> },
              { path: '/manager/dept-questionnaire', element: <DeptQuestionnairePage /> },
              { path: '/manager/dept-deep', element: <DeptDeepPage /> },
              { path: '/manager/dept-smart', element: <DeptSmartPage /> },
              { path: '/manager/hr/audit', element: <HRAuditPage /> },
              { path: '/manager/finance/audit', element: <FinanceAuditPage /> },
              { path: '/manager/finance/break-even', element: <BreakEvenPage /> },
              { path: '/manager/sales/audit', element: <SalesAuditPage /> },
              { path: '/manager/marketing/audit', element: <MarketingAuditPage /> },
              { path: '/manager/operations/audit', element: <OperationsAuditPage /> },
              { path: '/manager/it/audit', element: <ITAuditPage /> },
              { path: '/manager/cs/audit', element: <CustomerServiceAuditPage /> },
              { path: '/manager/logistics/audit', element: <LogisticsAuditPage /> },
              { path: '/manager/logistics/reform', element: <LogisticsReformPlanPage /> },
              { path: '/manager/quality/audit', element: <QualityAuditPage /> },
              { path: '/manager/projects/audit', element: <ProjectsAuditPage /> },
              { path: '/manager/governance/audit', element: <GovernanceAuditPage /> },
              { path: '/manager/governance/hub', element: <GovernanceHubPage /> },
              { path: '/manager/compliance/audit', element: <ComplianceAuditPage /> },
              { path: '/manager/compliance/audit-pro', element: <ComplianceAuditProPage /> },
              { path: '/manager/compliance/reform', element: <ComplianceReformPage /> },
            ],
          },
        ],
      },
      // Investor area
      {
        element: <RoleRoute allow={['INVESTOR']} />,
        children: [
          {
            element: <MainLayout />,
            children: [
              { path: '/investor/diagnostic', element: <DiagnosticInvestorPage /> },
              { path: '/investor/dashboard', element: <InvestorDashboardPage /> },
              { path: '/investor/portfolio', element: <PortfolioPage /> },
              { path: '/investor/company/:id', element: <CompanyDetailPage /> },
            ],
          },
        ],
      },
    ],
  },

  // Catch-all → landing
  { path: '*', element: <Navigate to="/" replace /> },
])
