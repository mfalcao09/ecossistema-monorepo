import ClmSettings from "@/pages/ClmSettings";
import ClmCobranca from "@/pages/ClmCobranca";
import ClmAprovacoes from "@/pages/ClmAprovacoes";
import ClmRelatorios from "@/pages/ClmRelatorios";
import ClmCompliance from "@/pages/ClmCompliance";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { BrandingProvider } from "@/components/BrandingProvider";
import { AppLayout } from "@/components/AppLayout";
import Auth from "@/pages/Auth";
import Onboarding from "@/pages/Onboarding";
import Home from "@/pages/Home";
import MinhasTarefas from "@/pages/MinhasTarefas";
import Atalhos from "@/pages/Atalhos";
import ConfiguracoesHome from "@/pages/ConfiguracoesHome";
import Dashboard from "@/pages/Dashboard";
import People from "@/pages/People";
import Contracts from "@/pages/Contracts";
import ContractClauses from "@/pages/ContractClauses";
import ClmAnalytics from "@/pages/ClmAnalytics";
import ContractTemplates from "@/pages/ContractTemplates";
import ClmCommandCenter from "@/pages/ClmCommandCenter";
import Placeholder from "@/pages/Placeholder";
import Properties from "@/pages/Properties";
import PropertyDetail from "@/pages/PropertyDetail";
import NewDeal from "@/pages/NewDeal";
import DealsList from "@/pages/DealsList";
import LeadsCRM from "@/pages/LeadsCRM";
import Legal from "@/pages/Legal";
import GuaranteeTypes from "@/pages/GuaranteeTypes";
import MaintenanceInspections from "@/pages/MaintenanceInspections";
import ClientRelationship from "@/pages/ClientRelationship";
import Terminations from "@/pages/Terminations";
import RentAdjustmentsPage from "@/pages/RentAdjustments";
import ContractRenewals from "@/pages/ContractRenewals";
import GuaranteeReleasesPage from "@/pages/GuaranteeReleases";
import SlaDetails from "@/pages/SlaDetails";
import HelpDesk from "@/pages/HelpDesk";
import FinanceReceivables from "@/pages/finance/FinanceReceivables";
import FinancePayables from "@/pages/finance/FinancePayables";
import FinanceCashFlow from "@/pages/finance/FinanceCashFlow";
import FinanceDefaulters from "@/pages/finance/FinanceDefaulters";
import FinanceReports from "@/pages/finance/FinanceReports";
import FinanceBankAccounts from "@/pages/finance/FinanceBankAccounts";
import FinanceCommissions from "@/pages/finance/FinanceCommissions";
import FinanceTransfers from "@/pages/finance/FinanceTransfers";
import FinanceIRWithholding from "@/pages/finance/FinanceIRWithholding";
import FinanceDIMOB from "@/pages/finance/FinanceDIMOB";
import FinanceIssuedInvoices from "@/pages/finance/FinanceIssuedInvoices";
import FinanceBankReconciliation from "@/pages/finance/FinanceBankReconciliation";
import FinanceLeaseGuarantees from "@/pages/finance/FinanceLeaseGuarantees";
import FinanceServiceInvoices from "@/pages/finance/FinanceServiceInvoices";
import FinanceDRE from "@/pages/finance/FinanceDRE";
import FinanceCostCenters from "@/pages/finance/FinanceCostCenters";
import FinanceAdvances from "@/pages/finance/FinanceAdvances";
import FinanceSettings from "@/pages/finance/FinanceSettings";
import FinanceAutomations from "@/pages/finance/FinanceAutomations";
import FinanceChartOfAccounts from "@/pages/finance/FinanceChartOfAccounts";
import FinanceJournalEntries from "@/pages/finance/FinanceJournalEntries";
import FinanceGeneralLedger from "@/pages/finance/FinanceGeneralLedger";
import FinanceTrialBalance from "@/pages/finance/FinanceTrialBalance";
import FinanceBalanceSheet from "@/pages/finance/FinanceBalanceSheet";
import FinanceOwnerStatements from "@/pages/finance/FinanceOwnerStatements";
import FinanceAccountingPeriods from "@/pages/finance/FinanceAccountingPeriods";
import FinanceExpenseApportionment from "@/pages/finance/FinanceExpenseApportionment";
import FinanceAccountingExport from "@/pages/finance/FinanceAccountingExport";
import FinanceAccountingReconciliation from "@/pages/finance/FinanceAccountingReconciliation";
import FinanceAccountingDashboard from "@/pages/finance/FinanceAccountingDashboard";
import DueDiligence from "@/pages/DueDiligence";
import LegalTemplates from "@/pages/juridico/LegalTemplates";
import LegalPowersOfAttorney from "@/pages/juridico/LegalPowersOfAttorney";
import LegalNotifications from "@/pages/juridico/LegalNotifications";
import LegalProceedings from "@/pages/juridico/LegalProceedings";
import LegalCompliance from "@/pages/juridico/LegalCompliance";
import LegalSignatures from "@/pages/juridico/LegalSignatures";
import LegalDispatch from "@/pages/juridico/LegalDispatch";
import LegalLGPD from "@/pages/juridico/LegalLGPD";
import LegalRegistryOCR from "@/pages/juridico/LegalRegistryOCR";
import LegalDocumentReports from "@/pages/juridico/LegalDocumentReports";
import LegalDesk from "@/pages/juridico/LegalDesk";
import LegalJurimetrics from "@/pages/juridico/LegalJurimetrics";
import LegalCorporateEntities from "@/pages/juridico/LegalCorporateEntities";
import LegalMandatoryInsurance from "@/pages/juridico/LegalMandatoryInsurance";
import LegalOccupationChecks from "@/pages/juridico/LegalOccupationChecks";
import LegalTaxCompliance from "@/pages/juridico/LegalTaxCompliance";
import PublicShowcase from "@/pages/PublicShowcase";
import PublicShowcaseDetail from "@/pages/PublicShowcaseDetail";
import UserManagement from "@/pages/UserManagement";
import SiteSettings from "@/pages/SiteSettings";
import CompanyData from "@/pages/CompanyData";
import MyPlan from "@/pages/MyPlan";
import TenantInvoices from "@/pages/TenantInvoices";
import Developments from "@/pages/Developments";
import ChatPlatform from "@/pages/ChatPlatform";
import SalesMirror from "@/pages/developments/SalesMirror";
import SalesPipeline from "@/pages/developments/SalesPipeline";
import DevProposals from "@/pages/developments/DevProposals";
import DevContracts from "@/pages/developments/DevContracts";
import DevDashboard from "@/pages/developments/DevDashboard";
import DevTasks from "@/pages/developments/DevTasks";
import SuperAdminDashboard from "@/pages/superadmin/SuperAdminDashboard";
import SuperAdminTenants from "@/pages/superadmin/SuperAdminTenants";
import SuperAdminUsers from "@/pages/superadmin/SuperAdminUsers";
import SuperAdminPlans from "@/pages/superadmin/SuperAdminPlans";
import SuperAdminFinance from "@/pages/superadmin/SuperAdminFinance";
import SuperAdminBankIntegration from "@/pages/superadmin/SuperAdminBankIntegration";
import SuperAdminIdentity from "@/pages/superadmin/SuperAdminIdentity";
import SuperAdminComercial from "@/pages/superadmin/SuperAdminComercial";
import SuperAdminChatPlans from "@/pages/superadmin/SuperAdminChatPlans";
import SuperAdminAddonProducts from "@/pages/superadmin/SuperAdminAddonProducts";
import SuperAdminAIPersonas from "@/pages/superadmin/SuperAdminAIPersonas";
import AddonModules from "@/pages/AddonModules";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AIKnowledgeBase from "@/pages/admin/AIKnowledgeBase";
import GlobalSettings from "@/pages/admin/GlobalSettings";
import CommercialDashboard from "@/pages/CommercialDashboard";
import CommercialSlaDetails from "@/pages/CommercialSlaDetails";
import CommercialVisits from "@/pages/comercial/CommercialVisits";
import CommercialAvailability from "@/pages/comercial/CommercialAvailability";
import BrokerGoals from "@/pages/comercial/BrokerGoals";
import MarketEvaluations from "@/pages/comercial/MarketEvaluations";
import CommercialAutomations from "@/pages/comercial/CommercialAutomations";
import PipelineManager from "@/pages/comercial/PipelineManager";
import PulseFeed from "@/pages/comercial/PulseFeed";
import LeadDistributionSettings from "@/pages/comercial/LeadDistributionSettings";
import ExclusivityContracts from "@/pages/comercial/ExclusivityContracts";
import CommercialReports from "@/pages/comercial/CommercialReports";
import PipelineAnalytics from "@/pages/comercial/PipelineAnalytics";
import { SalesAssistantDashboard } from "@/pages/comercial/SalesAssistantDashboard";
import { LeadDeduplication } from "@/pages/comercial/LeadDeduplication";
import { LeadCaptureSettings } from "@/pages/comercial/LeadCaptureSettings";
import { WinLossAnalysis } from "@/pages/comercial/WinLossAnalysis";
import { ChannelROIAnalysis } from "@/pages/comercial/ChannelROIAnalysis";
import { NarrativeReport } from "@/pages/comercial/NarrativeReport";
import { RevenueForecast } from "@/pages/comercial/RevenueForecast";
import { PropertyMatchingPage } from "@/pages/comercial/PropertyMatchingPage";
import { ConversationIntelligencePage } from "@/pages/comercial/ConversationIntelligencePage";
import ConversationIntelligenceAdvancedPage from "@/pages/comercial/ConversationIntelligenceAdvancedPage";
import CoachingAIPage from "@/pages/comercial/CoachingAIPage";
import AdvancedFiltersPage from "@/pages/comercial/AdvancedFiltersPage";
import { EmailCRM } from "@/pages/comercial/EmailCRM";
import { SlaMonitor } from "@/pages/comercial/SlaMonitor";
import ProspectorAIPage from "@/pages/comercial/ProspectorAIPage";
import NurturingCampaignsPage from "@/pages/comercial/NurturingCampaignsPage";
import GamificationRanking from "@/pages/comercial/GamificationRanking";
import DealForecastPage from "@/pages/comercial/DealForecastPage";
import PortalIntegrationPage from "@/pages/comercial/PortalIntegrationPage";
import SmartFollowUpPage from "@/pages/comercial/SmartFollowUpPage";
import RelationshipAutomations from "@/pages/RelationshipAutomations";
import RelationshipSurveys from "@/pages/RelationshipSurveys";
import RelationshipCommunication from "@/pages/RelationshipCommunication";
import RelationshipInsurance from "@/pages/RelationshipInsurance";
import RelationshipReports from "@/pages/RelationshipReports";
import ChurnRadar360 from "@/pages/ChurnRadar360";
import ClientDNA from "@/pages/ClientDNA";
import SentimentScanner from "@/pages/SentimentScanner";
import ChurnInterceptor from "@/pages/ChurnInterceptor";
import IntelliHome from "@/pages/IntelliHome";
import PropertyDigitalTwin from "@/pages/PropertyDigitalTwin";
import LifeEventsEngine from "@/pages/LifeEventsEngine";
import NextBestAction from "@/pages/NextBestAction";
import RevenueLtvPredictor from "@/pages/RevenueLtvPredictor";
import ExitExperience from "@/pages/ExitExperience";
import FeedbackIntelligence from "@/pages/FeedbackIntelligence";
import PublicPropertyDocuments from "@/pages/PublicPropertyDocuments";
import Favorites from "@/pages/Favorites";
import ParcelamentoDashboard from "@/pages/parcelamento/ParcelamentoDashboard";
import ParcelamentoProjetos from "@/pages/parcelamento/ParcelamentoProjetos";
import ParcelamentoBiblioteca from "@/pages/parcelamento/ParcelamentoBiblioteca";
import ParcelamentoDrive from "@/pages/parcelamento/ParcelamentoDrive";
import ParcelamentoConfig from "@/pages/parcelamento/ParcelamentoConfig";
import ParcelamentoDetalhe from "@/pages/parcelamento/ParcelamentoDetalhe";
// ParcelamentoFinanceiro e ParcelamentoConformidade agora são lazy imports dentro de ParcelamentoDetalhe (sessão 150/151)
import ParcelamentoLixeira from "@/pages/parcelamento/ParcelamentoLixeira";
import ParcelamentoComparar from "@/pages/parcelamento/ParcelamentoComparar";
import ParcelamentoCAD from "@/pages/parcelamento/ParcelamentoCAD";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <BrandingProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/vitrine" element={<PublicShowcase />} />
            <Route path="/vitrine/:id" element={<PublicShowcaseDetail />} />
            <Route path="/imoveis/:id/documentos" element={<PublicPropertyDocuments />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/tarefas" element={<MinhasTarefas />} />
              <Route path="/atalhos" element={<Atalhos />} />
              <Route path="/configuracoes" element={<ConfiguracoesHome />} />
              <Route path="/imoveis" element={<Properties />} />
              <Route path="/imoveis/:id" element={<PropertyDetail />} />
              <Route path="/favoritos" element={<Favorites />} />
              <Route path="/pessoas" element={<People />} />
              <Route path="/contratos" element={<Contracts />} />
              <Route path="/contratos/clausulas" element={<ContractClauses />} />
              <Route path="/contratos/analytics" element={<ClmAnalytics />} />
              <Route path="/contratos/minutario" element={<ContractTemplates />} />
              <Route path="/contratos/command-center" element={<ClmCommandCenter />} />
              <Route path="/contratos/configuracoes" element={<ClmSettings />} />
              <Route path="/contratos/cobranca" element={<ClmCobranca />} />
              <Route path="/contratos/aprovacoes" element={<ClmAprovacoes />} />
              <Route path="/contratos/relatorios" element={<ClmRelatorios />} />
              <Route path="/contratos/compliance" element={<ClmCompliance />} />
              <Route path="/garantias" element={<GuaranteeTypes />} />
              <Route path="/comercial/dashboard" element={<CommercialDashboard />} />
              <Route path="/comercial/sla-detalhes" element={<CommercialSlaDetails />} />
              <Route path="/comercial/agenda" element={<CommercialVisits />} />
              <Route path="/comercial/disponibilidade" element={<CommercialAvailability />} />
              <Route path="/comercial/metas" element={<BrokerGoals />} />
              <Route path="/comercial/avaliacoes" element={<MarketEvaluations />} />
              <Route path="/comercial/automacoes" element={<CommercialAutomations />} />
              <Route path="/comercial/funis" element={<PipelineManager />} />
              <Route path="/comercial/pulse" element={<PulseFeed />} />
              <Route path="/comercial/distribuicao-leads" element={<LeadDistributionSettings />} />
              <Route path="/comercial/exclusividades" element={<ExclusivityContracts />} />
              <Route path="/comercial/relatorios" element={<CommercialReports />} />
              <Route path="/comercial/analytics" element={<PipelineAnalytics />} />
              <Route path="/comercial/assistente-ia" element={<SalesAssistantDashboard />} />
              <Route path="/comercial/deduplicacao" element={<LeadDeduplication />} />
              <Route path="/comercial/captacao-canais" element={<LeadCaptureSettings />} />
              <Route path="/comercial/win-loss" element={<WinLossAnalysis />} />
              <Route path="/comercial/roi-canais" element={<ChannelROIAnalysis />} />
              <Route path="/comercial/relatorio-ia" element={<NarrativeReport />} />
              <Route path="/comercial/forecast" element={<RevenueForecast />} />
              <Route path="/comercial/matching" element={<PropertyMatchingPage />} />
              <Route path="/comercial/conversation-intelligence" element={<ConversationIntelligencePage />} />
              <Route path="/comercial/conversation-intelligence-advanced" element={<ConversationIntelligenceAdvancedPage />} />
              <Route path="/comercial/coaching-ia" element={<CoachingAIPage />} />
              <Route path="/comercial/filtros-avancados" element={<AdvancedFiltersPage />} />
              <Route path="/comercial/email" element={<EmailCRM />} />
              <Route path="/comercial/sla" element={<SlaMonitor />} />
              <Route path="/comercial/ranking" element={<GamificationRanking />} />
              <Route path="/comercial/follow-up" element={<SmartFollowUpPage />} />
              <Route path="/comercial/prospector" element={<ProspectorAIPage />} />
              <Route path="/comercial/nurturing" element={<NurturingCampaignsPage />} />
              <Route path="/comercial/deal-forecast" element={<DealForecastPage />} />
              <Route path="/comercial/portais" element={<PortalIntegrationPage />} />
              <Route path="/novos-negocios" element={<NewDeal />} />
              <Route path="/negocios" element={<DealsList />} />
              <Route path="/leads" element={<LeadsCRM />} />
              <Route path="/relacionamento" element={<ClientRelationship />} />
              <Route path="/relacionamento/automacoes" element={<RelationshipAutomations />} />
              <Route path="/relacionamento/pesquisas" element={<RelationshipSurveys />} />
              <Route path="/relacionamento/regua" element={<RelationshipCommunication />} />
              <Route path="/relacionamento/seguros" element={<RelationshipInsurance />} />
              <Route path="/relacionamento/relatorios" element={<RelationshipReports />} />
              <Route path="/relacionamento/churn-radar" element={<ChurnRadar360 />} />
              <Route path="/relacionamento/dna-cliente" element={<ClientDNA />} />
              <Route path="/relacionamento/sentiment-scanner" element={<SentimentScanner />} />
              <Route path="/relacionamento/churn-interceptor" element={<ChurnInterceptor />} />
              <Route path="/relacionamento/intellihome" element={<IntelliHome />} />
              <Route path="/relacionamento/digital-twin" element={<PropertyDigitalTwin />} />
              <Route path="/relacionamento/life-events" element={<LifeEventsEngine />} />
              <Route path="/relacionamento/next-best-action" element={<NextBestAction />} />
              <Route path="/relacionamento/revenue-ltv" element={<RevenueLtvPredictor />} />
              <Route path="/relacionamento/exit-experience" element={<ExitExperience />} />
              <Route path="/relacionamento/feedback-intelligence" element={<FeedbackIntelligence />} />
              <Route path="/rescisoes" element={<Terminations />} />
              <Route path="/reajustes" element={<RentAdjustmentsPage />} />
              <Route path="/renovacoes" element={<ContractRenewals />} />
              <Route path="/liberacao-garantias" element={<GuaranteeReleasesPage />} />
              <Route path="/sla-detalhes" element={<SlaDetails />} />
              <Route path="/atendimento" element={<HelpDesk />} />
              <Route path="/financeiro/receitas" element={<FinanceReceivables />} />
              <Route path="/financeiro/despesas" element={<FinancePayables />} />
              <Route path="/financeiro/caixa" element={<FinanceCashFlow />} />
              <Route path="/financeiro/inadimplencia" element={<FinanceDefaulters />} />
              <Route path="/financeiro/relatorios" element={<FinanceReports />} />
              <Route path="/financeiro/contas" element={<FinanceBankAccounts />} />
              <Route path="/financeiro/comissoes" element={<FinanceCommissions />} />
              <Route path="/financeiro/repasses" element={<FinanceTransfers />} />
              <Route path="/financeiro/ir" element={<FinanceIRWithholding />} />
              <Route path="/financeiro/dimob" element={<FinanceDIMOB />} />
              <Route path="/financeiro/faturas-emitidas" element={<FinanceIssuedInvoices />} />
              <Route path="/financeiro/conciliacao" element={<FinanceBankReconciliation />} />
              <Route path="/financeiro/garantias-locaticias" element={<FinanceLeaseGuarantees />} />
              <Route path="/financeiro/notas-fiscais" element={<FinanceServiceInvoices />} />
              <Route path="/financeiro/dre" element={<FinanceDRE />} />
              <Route path="/financeiro/centros-custo" element={<FinanceCostCenters />} />
              <Route path="/financeiro/antecipacao" element={<FinanceAdvances />} />
              <Route path="/financeiro/configuracoes" element={<FinanceSettings />} />
              <Route path="/financeiro/automacoes" element={<FinanceAutomations />} />
              <Route path="/financeiro/plano-contas" element={<FinanceChartOfAccounts />} />
              <Route path="/financeiro/livro-diario" element={<FinanceJournalEntries />} />
              <Route path="/financeiro/livro-razao" element={<FinanceGeneralLedger />} />
              <Route path="/financeiro/balancete" element={<FinanceTrialBalance />} />
              <Route path="/financeiro/balanco" element={<FinanceBalanceSheet />} />
              <Route path="/financeiro/prestacao-contas" element={<FinanceOwnerStatements />} />
              <Route path="/financeiro/fechamento" element={<FinanceAccountingPeriods />} />
              <Route path="/financeiro/rateio" element={<FinanceExpenseApportionment />} />
              <Route path="/financeiro/exportacao-contabil" element={<FinanceAccountingExport />} />
              <Route path="/financeiro/conciliacao-contabil" element={<FinanceAccountingReconciliation />} />
              <Route path="/financeiro/contabil-dashboard" element={<FinanceAccountingDashboard />} />
              <Route path="/due-diligence" element={<DueDiligence />} />
              <Route path="/juridico/modelos" element={<LegalTemplates />} />
              <Route path="/juridico/procuracoes" element={<LegalPowersOfAttorney />} />
              <Route path="/juridico/notificacoes" element={<LegalNotifications />} />
              <Route path="/juridico/processos" element={<LegalProceedings />} />
              <Route path="/juridico/compliance" element={<LegalCompliance />} />
              <Route path="/juridico/assinaturas" element={<LegalSignatures />} />
              <Route path="/juridico/despacho" element={<LegalDispatch />} />
              <Route path="/juridico/lgpd" element={<LegalLGPD />} />
              <Route path="/juridico/ocr-matriculas" element={<LegalRegistryOCR />} />
              <Route path="/juridico/relatorios-documentos" element={<LegalDocumentReports />} />
              <Route path="/juridico/legal-desk" element={<LegalDesk />} />
              <Route path="/juridico/jurimetria" element={<LegalJurimetrics />} />
              <Route path="/juridico/societario" element={<LegalCorporateEntities />} />
              <Route path="/juridico/seguros-obrigatorios" element={<LegalMandatoryInsurance />} />
              <Route path="/juridico/ocupacao" element={<LegalOccupationChecks />} />
              <Route path="/juridico/conformidade-tributaria" element={<LegalTaxCompliance />} />
              <Route path="/juridico" element={<Legal />} />
              <Route path="/manutencao" element={<MaintenanceInspections />} />
              <Route path="/atendimento-whatsapp" element={<ChatPlatform />} />
              <Route path="/lancamentos" element={<Developments />} />
              <Route path="/lancamentos/espelho" element={<SalesMirror />} />
              <Route path="/lancamentos/pipeline" element={<SalesPipeline />} />
              <Route path="/lancamentos/propostas" element={<DevProposals />} />
              <Route path="/lancamentos/contratos" element={<DevContracts />} />
              <Route path="/lancamentos/dashboard" element={<DevDashboard />} />
              <Route path="/lancamentos/tarefas" element={<DevTasks />} />
              <Route path="/parcelamento" element={<ParcelamentoDashboard />} />
              {/* Rotas específicas DEVEM vir antes de /parcelamento/:id */}
              <Route path="/parcelamento/projetos" element={<ParcelamentoProjetos />} />
              <Route path="/parcelamento/biblioteca" element={<ParcelamentoBiblioteca />} />
              <Route path="/parcelamento/drive" element={<ParcelamentoDrive />} />
              <Route path="/parcelamento/config" element={<ParcelamentoConfig />} />
              {/* Bloco L — Sessão 147 */}
              <Route path="/parcelamento/lixeira" element={<ParcelamentoLixeira />} />
              <Route path="/parcelamento/comparar" element={<ParcelamentoComparar />} />
              <Route path="/parcelamento/:id" element={<ParcelamentoDetalhe />} />
              {/* Financeiro e Conformidade agora são tabs inline dentro de ParcelamentoDetalhe (sessão 150) */}
              {/* Bloco E — Sessão 149: CAD Studio */}
              <Route path="/parcelamento/:id/cad" element={<ParcelamentoCAD />} />
              <Route path="/dados-empresa" element={<CompanyData />} />
              <Route path="/meu-plano" element={<MyPlan />} />
              <Route path="/faturas" element={<TenantInvoices />} />
              <Route path="/usuarios" element={<UserManagement />} />
              <Route path="/configuracoes-site" element={<SiteSettings />} />
              <Route path="/sa" element={<SuperAdminDashboard />} />
              <Route path="/sa/empresas" element={<SuperAdminTenants />} />
              <Route path="/sa/planos" element={<SuperAdminPlans />} />
              <Route path="/sa/financeiro" element={<SuperAdminFinance />} />
              <Route path="/sa/integracao-bancaria" element={<SuperAdminBankIntegration />} />
              <Route path="/sa/usuarios" element={<SuperAdminUsers />} />
              <Route path="/sa/identidade" element={<SuperAdminIdentity />} />
              <Route path="/sa/comercial" element={<SuperAdminComercial />} />
              <Route path="/sa/addon-whatsapp" element={<SuperAdminChatPlans />} />
              <Route path="/sa/addon-produtos" element={<SuperAdminAddonProducts />} />
              <Route path="/sa/ia-personas" element={<SuperAdminAIPersonas />} />
              <Route path="/modulos-extras" element={<AddonModules />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/ia-conhecimento" element={<AIKnowledgeBase />} />
              <Route path="/admin/configuracoes" element={<GlobalSettings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </BrandingProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;