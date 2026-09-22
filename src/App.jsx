import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import SettingsPage from './pages/SettingsPage';
import ClubManagementPage from './pages/ClubManagement';
import ClubDetailsPage from './pages/ClubDetails';
import ClubResponsesPage from './pages/ClubResponses';
import JoinClubPage from './pages/JoinClub';
import SessionsPage from './pages/SessionsPage';
import StravaCallbackPage from './pages/StravaCallback';
import ObjectiveDataPage from './pages/ObjectiveData';
import CoachPermissionsPage from './pages/CoachPermissionsPage';
import CoachHomeIndividualPage from './pages/CoachHomeIndividual';
import CoachDailyQuestionnairePage from './pages/CoachDailyQuestionnaire';
import CoachFillAthleteQuestionnairePage from './pages/CoachFillAthleteQuestionnaire';
import CoachDailyResponsesPage from './pages/CoachDailyResponses';
import OnboardingPage from './pages/Onboarding';
import PendingApprovalPage from './pages/PendingApproval';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout
  ? <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

// ─── Routeur principal basé sur authState ────────────────────────────────────
const AppRouter = () => {
  const { authState, isPasswordRecovery } = useAuth();

  // 0. Lien de réinitialisation de mot de passe → formulaire nouveau mot de passe
  if (isPasswordRecovery) {
    return (
      <Routes>
        <Route path="*" element={<ResetPasswordPage />} />
      </Routes>
    );
  }

  // 1. Chargement de la session
  if (authState === 'loading') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  // 2. Non connecté → login
  if (authState === 'unauthenticated') {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  // 3. Profil incomplet (prénom manquant) → onboarding
  if (authState === 'incomplete') {
    return (
      <Routes>
        <Route path="*" element={<OnboardingPage />} />
      </Routes>
    );
  }

  // 4. En attente d'approbation admin
  if (authState === 'pending') {
    return (
      <Routes>
        <Route path="*" element={<PendingApprovalPage />} />
      </Routes>
    );
  }

  // 5. Connecté et approuvé → app complète
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route key={path} path={`/${path}`} element={
          <LayoutWrapper currentPageName={path}><Page /></LayoutWrapper>
        } />
      ))}
      <Route path="/Settings"           element={<LayoutWrapper currentPageName="Settings"><SettingsPage /></LayoutWrapper>} />
      <Route path="/Sessions"           element={<LayoutWrapper currentPageName="Sessions"><SessionsPage /></LayoutWrapper>} />
      <Route path="/ClubManagement"     element={<LayoutWrapper currentPageName="ClubManagement"><ClubManagementPage /></LayoutWrapper>} />
      <Route path="/ClubDetails"        element={<LayoutWrapper currentPageName="ClubDetails"><ClubDetailsPage /></LayoutWrapper>} />
      <Route path="/ClubResponses"      element={<LayoutWrapper currentPageName="ClubResponses"><ClubResponsesPage /></LayoutWrapper>} />
      <Route path="/ObjectiveData"      element={<LayoutWrapper currentPageName="ObjectiveData"><ObjectiveDataPage /></LayoutWrapper>} />
      <Route path="/CoachPermissions"   element={<LayoutWrapper currentPageName="CoachPermissions"><CoachPermissionsPage /></LayoutWrapper>} />
      <Route path="/CoachHomeIndividual" element={<LayoutWrapper currentPageName="CoachHomeIndividual"><CoachHomeIndividualPage /></LayoutWrapper>} />
      <Route path="/CoachDailyQuestionnaire" element={<LayoutWrapper currentPageName="CoachDailyQuestionnaire"><CoachDailyQuestionnairePage /></LayoutWrapper>} />
      <Route path="/CoachFillAthleteQuestionnaire" element={<LayoutWrapper currentPageName="CoachFillAthleteQuestionnaire"><CoachFillAthleteQuestionnairePage /></LayoutWrapper>} />
      <Route path="/CoachDailyResponses" element={<LayoutWrapper currentPageName="CoachDailyResponses"><CoachDailyResponsesPage /></LayoutWrapper>} />
      <Route path="/JoinClub"           element={<JoinClubPage />} />
      <Route path="/StravaCallback"     element={<StravaCallbackPage />} />
      <Route path="*"                   element={<PageNotFound />} />
    </Routes>
  );
};

// ─── App root ────────────────────────────────────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AppRouter />
        </Router>
        <Toaster />
        <SonnerToaster richColors position="top-right" />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
