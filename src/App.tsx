import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { RouterProvider, useRouter, useNavigate } from './components/Navigation/Router';
import { supabase } from './lib/supabase';
import { Header } from './components/Navigation/Header';
import { HomePage } from './components/Home/HomePage';
import { SignIn } from './components/Auth/SignIn';
import { SignUp } from './components/Auth/SignUp';
import { PropertyList } from './components/Properties/PropertyList';
import { BuyPage } from './components/Properties/BuyPage';
import { RentPage } from './components/Properties/RentPage';
import { PropertyDetail } from './components/Properties/PropertyDetail';
import { CreateListing } from './components/Properties/CreateListing';
import { EditListing } from './components/Properties/EditListing';
import { AllAgentsPage } from './components/Agents/AllAgentsPage';
import { AllServiceProvidersPage } from './components/ServiceProvider/AllServiceProvidersPage';
import { AgentProfile } from './components/Agents/AgentProfile';
import { AgentSetup } from './components/Agents/AgentSetup';
import { ConversationList } from './components/Messages/ConversationList';
import { ConversationView } from './components/Messages/ConversationView';
import { NewConversation } from './components/Messages/NewConversation';
import { BuyerDashboard } from './components/Buyer/BuyerDashboard';
import { AgentDashboard } from './components/Agents/AgentDashboard';
import { SellerDashboard } from './components/Seller/SellerDashboard';
import { SellerCalendar } from './components/Seller/SellerCalendar';
import { BuyerCalendar } from './components/Buyer/BuyerCalendar';
import { LoanApplications } from './components/Buyer/LoanApplications';
import { UniversalDocumentManager } from './components/Documents/UniversalDocumentManager';
import { AcceptInvitation } from './components/Auth/AcceptInvitation';
import { UserProfile } from './components/Settings/UserProfile';
import { ProspectsPage } from './components/Agents/ProspectsPage';
import { AgentPublicProfile } from './components/Agents/AgentPublicProfile';
import { OfferHistory } from './components/Buyer/OfferHistory';
import { InspectionManagement } from './components/Buyer/InspectionManagement';
import { AppraisalManagement } from './components/Buyer/AppraisalManagement';
import { CompletedJobReports } from './components/Buyer/CompletedJobReports';
import { ClosingChecklist } from './components/Buyer/ClosingChecklist';
import { OffersManagement } from './components/Agents/OffersManagement';
import { SellerOffersManagement } from './components/Seller/SellerOffersManagement';
import { SellerClosingChecklist } from './components/Seller/SellerClosingChecklist';
import { ServiceProviderDashboard } from './components/ServiceProvider/ServiceProviderDashboard';
import { ServiceProviderSetup } from './components/ServiceProvider/ServiceProviderSetup';
import { RevenuePage } from './components/ServiceProvider/RevenuePage';
import { InvoicesPage } from './components/ServiceProvider/InvoicesPage';
import { ServiceProviderPublicProfile } from './components/ServiceProvider/ServiceProviderPublicProfile';
import { ReviewsPage } from './components/ServiceProvider/ReviewsPage';
import { LeadsPage } from './components/ServiceProvider/LeadsPage';
import { ServiceProviderSearch } from './components/ServiceProvider/ServiceProviderSearch';
import { ServiceProviderCalendar } from './components/ServiceProvider/ServiceProviderCalendar';
import { JobsManagement } from './components/ServiceProvider/JobsManagement';
import { JobDetails } from './components/ServiceProvider/JobDetails';
import { LenderSetup } from './components/MortgageLender/LenderSetup';
import { LenderDashboard } from './components/MortgageLender/LenderDashboard';
import { ApplicationsManagement } from './components/MortgageLender/ApplicationsManagement';
import { ApplicationDetailPage } from './components/MortgageLender/ApplicationDetailPage';
import { MortgageCalculator } from './components/MortgageLender/MortgageCalculator';
import { TeamManagementPage } from './components/MortgageLender/TeamManagementPage';
import { LenderAnalytics } from './components/MortgageLender/LenderAnalytics';
import { ConsultationsPage } from './components/MortgageLender/ConsultationsPage';
import { LenderCRM } from './components/MortgageLender/LenderCRM';
import { PreApprovalRequestForm } from './components/MortgageLender/PreApprovalRequestForm';
import { SendFinalLoanApproval } from './components/MortgageLender/SendFinalLoanApproval';
import { PreApprovalRequestsManagement } from './components/MortgageLender/PreApprovalRequestsManagement';
import { PreApprovalDetailPage } from './components/MortgageLender/PreApprovalDetailPage';
import { CreateLoanApplication } from './components/MortgageLender/CreateLoanApplication';
import { AdminDashboard } from './components/Admin/AdminDashboard';
import { AdminAccountsManagement } from './components/Admin/AdminAccountsManagement';
import { AdminListingsManagement } from './components/Admin/AdminListingsManagement';
import AdminSupportManagement from './components/Admin/AdminSupportManagement';
import SupportTicketAnalytics from './components/Admin/SupportTicketAnalytics';
import { UserGrowthAnalytics } from './components/Admin/UserGrowthAnalytics';
import { ResetPassword } from './components/Auth/ResetPassword';
import { PropertyOwnerSetup } from './components/PropertyOwner/PropertyOwnerSetup';
import { PropertyOwnerDashboard } from './components/PropertyOwner/PropertyOwnerDashboard';
import { PropertyOwnerListings } from './components/PropertyOwner/PropertyOwnerListings';
import TenantManagement from './components/PropertyOwner/TenantManagement';
import { PropertyOwnerLeadsPage } from './components/PropertyOwner/PropertyOwnerLeadsPage';
import { PropertyOwnerCalendar } from './components/PropertyOwner/PropertyOwnerCalendar';
import { CreateRentalListing } from './components/PropertyOwner/CreateRentalListing';
import { EditRentalListing } from './components/PropertyOwner/EditRentalListing';
import { FinancialReports } from './components/PropertyOwner/FinancialReports';
import { BuyerFeatures } from './components/Features/BuyerFeatures';
import { SellerFeatures } from './components/Features/SellerFeatures';
import { RenterFeatures } from './components/Features/RenterFeatures';
import { AgentFeatures } from './components/Features/AgentFeatures';
import { PropertyOwnerFeatures } from './components/Features/PropertyOwnerFeatures';
import { ServiceProviderFeatures } from './components/Features/ServiceProviderFeatures';
import { MortgageLenderFeatures } from './components/Features/MortgageLenderFeatures';
import { BrokerageFeatures } from './components/Features/BrokerageFeatures';
import { AboutPage } from './components/About/AboutPage';
import { BuyerPreferences } from './components/Buyer/BuyerPreferences';
import { BuyerPreApprovalRequests } from './components/Buyer/BuyerPreApprovalRequests';
import { EnhancedPropertyAnalytics } from './components/Seller/EnhancedPropertyAnalytics';
import { PropertyOwnerAnalytics } from './components/PropertyOwner/PropertyOwnerAnalytics';
import { PendingSignatures } from './components/Buyer/PendingSignatures';
import { RentalAgreementManager } from './components/PropertyOwner/RentalAgreementManager';
import { ComprehensiveAnalytics } from './components/PropertyOwner/ComprehensiveAnalytics';
import { ManagedUserDashboard } from './components/ManagedUser/ManagedUserDashboard';
import { BrokerageSetup } from './components/Brokerage/BrokerageSetup';
import { BrokerageDashboard } from './components/Brokerage/BrokerageDashboard';
import { BrokerageAgentProfile } from './components/Brokerage/BrokerageAgentProfile';
import { BrokerageListingAnalytics } from './components/Brokerage/BrokerageListingAnalytics';
import { BrokerageAgentAnalytics } from './components/Brokerage/BrokerageAgentAnalytics';
import { AcceptBrokerageInvitation } from './components/Brokerage/AcceptBrokerageInvitation';
import { BrokeragePublicProfile } from './components/Brokerage/BrokeragePublicProfile';
import { LenderPublicProfile } from './components/MortgageLender/LenderPublicProfile';
import TicketReplyPage from './components/Support/TicketReplyPage';

function AuthPage() {
  const { currentRoute } = useRouter();
  const isSignUpRoute = currentRoute.path === '/signup' || currentRoute.path.includes('signup=true') ||
    (window.location.hash && window.location.hash.includes('/signup'));
  const [isSignUp, setIsSignUp] = useState(isSignUpRoute);

  useEffect(() => {
    const shouldShowSignUp = currentRoute.path === '/signup' || currentRoute.path.includes('signup=true') ||
      (window.location.hash && window.location.hash.includes('/signup'));
    setIsSignUp(shouldShowSignUp);
  }, [currentRoute.path]);

  const getRedirectPath = () => {
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const redirect = urlParams.get('redirect');
    return redirect || currentRoute.path;
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      {isSignUp ? (
        <SignUp onToggle={() => setIsSignUp(false)} redirectPath={getRedirectPath()} />
      ) : (
        <SignIn onToggle={() => setIsSignUp(true)} redirectPath={getRedirectPath()} />
      )}
    </div>
  );
}

function AppContent() {
  const { currentRoute } = useRouter();
  const { loading, user, profile } = useAuth();
  const navigate = useNavigate();

  const checkAgentProfile = useCallback(async () => {
    if (!user || !profile) return;
    if (profile.user_type !== 'agent') return;

    const { data } = await supabase
      .from('agent_profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (data) {
      navigate('/dashboard');
    } else {
      navigate('/agent/setup');
    }
  }, [user, profile, navigate]);

  const checkServiceProviderProfile = useCallback(async () => {
    if (!user || !profile) return;
    if (profile.user_type !== 'service_provider') return;

    const { data } = await supabase
      .from('service_provider_profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (data) {
      navigate('/dashboard');
    } else {
      navigate('/service-provider/setup');
    }
  }, [user, profile, navigate]);

  const checkLenderProfile = useCallback(async () => {
    if (!user || !profile) return;
    if (profile.user_type !== 'mortgage_lender') return;

    const { data } = await supabase
      .from('mortgage_lender_profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (data) {
      navigate('/lender/dashboard');
    } else {
      navigate('/lender/setup');
    }
  }, [user, profile, navigate]);

  const checkPropertyOwnerProfile = useCallback(async () => {
    if (!user || !profile) return;
    if (profile.user_type !== 'property_owner') return;

    const { data } = await supabase
      .from('property_owner_profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (data) {
      navigate('/property-owner/dashboard');
    } else {
      navigate('/property-owner/setup');
    }
  }, [user, profile, navigate]);

  const checkBrokerageProfile = useCallback(async () => {
    if (!user || !profile) return;
    if (profile.user_type !== 'brokerage') return;

    const { data } = await supabase
      .from('brokerages')
      .select('id')
      .eq('super_admin_id', user.id)
      .maybeSingle();

    if (data) {
      navigate('/brokerage/dashboard');
    } else {
      navigate('/brokerage/setup');
    }
  }, [user, profile, navigate]);

  useEffect(() => {
    // Check for invitation query parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const invitationToken = urlParams.get('invitation');

    if (invitationToken) {
      console.log('Found invitation token, setting hash route');
      // Clear the query parameter and set the hash route
      window.history.replaceState({}, '', window.location.pathname);
      window.location.hash = `#/invite/${invitationToken}`;
      return;
    }

    if (!loading && user && profile) {
      if (currentRoute.path === '/auth' || currentRoute.path === '/' || currentRoute.path === '/signup' || currentRoute.path === '/signin') {
        if (profile.user_type === 'agent') {
          checkAgentProfile();
        } else if (profile.user_type === 'service_provider') {
          checkServiceProviderProfile();
        } else if (profile.user_type === 'mortgage_lender') {
          checkLenderProfile();
        } else if (profile.user_type === 'property_owner') {
          checkPropertyOwnerProfile();
        } else if (profile.user_type === 'brokerage') {
          checkBrokerageProfile();
        } else if (profile.user_type === 'managed_user') {
          navigate('/dashboard');
        } else if (profile.user_type === 'buyer' || profile.user_type === 'renter' || profile.user_type === 'seller') {
          navigate('/dashboard');
        } else {
          navigate('/properties');
        }
      }
    }
  }, [user, profile, loading, currentRoute.path, navigate, checkAgentProfile, checkServiceProviderProfile, checkLenderProfile, checkPropertyOwnerProfile, checkBrokerageProfile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (currentRoute.path === '/reset-password') {
      return <ResetPassword />;
    }

    // Public routes that don't require authentication
    const publicRoutes = [
      '/',
      '/auth',
      '/signup',
      '/about',
      '/mortgage-calculator',
      '/ticket-reply',
      '/features/buyer',
      '/features/seller',
      '/features/renter',
      '/features/agent',
      '/features/property-owner',
      '/features/service-provider',
      '/features/mortgage-lender',
      '/features/brokerage',
    ];

    const isPublicRoute = publicRoutes.includes(currentRoute.path) ||
      currentRoute.path === '/properties' ||
      currentRoute.path === '/buy' ||
      currentRoute.path === '/rent' ||
      currentRoute.path === '/agents' ||
      currentRoute.path === '/service-providers' ||
      currentRoute.path === '/brokerage/accept-invitation' ||
      currentRoute.path === '/pre-approval-form' ||
      currentRoute.path.startsWith('/agent-profile/') ||
      currentRoute.path.startsWith('/provider/') ||
      currentRoute.path.startsWith('/lender/') ||
      currentRoute.path.startsWith('/invite/') ||
      currentRoute.path.startsWith('/properties/') ||
      currentRoute.path.startsWith('/brokerage/');

    console.log('Route check - path:', currentRoute.path, 'isPublicRoute:', isPublicRoute, 'user:', user ? 'logged in' : 'not logged in');

    if (!user && !isPublicRoute) {
      console.log('Redirecting to AuthPage - not public route and no user');
      return <AuthPage />;
    }

    if (currentRoute.path === '/auth' || currentRoute.path === '/signup') {
      return <AuthPage />;
    }

    if (currentRoute.path === '/dashboard') {
      if (!user) return <AuthPage />;
      if (profile?.user_type === 'agent') {
        return (
          <div className="min-h-screen bg-gray-100">
            <AgentDashboard />
          </div>
        );
      }
      if (profile?.user_type === 'seller') {
        return (
          <div className="min-h-screen bg-gray-100">
            <SellerDashboard />
          </div>
        );
      }
      if (profile?.user_type === 'service_provider') {
        return (
          <div className="min-h-screen bg-gray-100">
            <ServiceProviderDashboard />
          </div>
        );
      }
      if (profile?.user_type === 'mortgage_lender') {
        return (
          <div className="min-h-screen bg-gray-100">
            <LenderDashboard />
          </div>
        );
      }
      if (profile?.user_type === 'property_owner') {
        return (
          <div className="min-h-screen bg-gray-100">
            <PropertyOwnerDashboard />
          </div>
        );
      }
      if (profile?.user_type === 'brokerage') {
        return (
          <div className="min-h-screen bg-gray-100">
            <BrokerageDashboard />
          </div>
        );
      }
      if (profile?.user_type === 'managed_user') {
        return <ManagedUserDashboard />;
      }
      return (
        <div className="min-h-screen bg-gray-100">
          <BuyerDashboard />
        </div>
      );
    }

    if (currentRoute.path === '/agent/dashboard') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <AgentDashboard />
        </div>
      );
    }

    if (currentRoute.path === '/properties/create') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100 py-12 px-4">
          <CreateListing />
        </div>
      );
    }

    if (currentRoute.path.match(/^\/properties\/[^\/]+\/edit$/)) {
      if (!user) return <AuthPage />;
      const parts = currentRoute.path.split('/');
      const propertyId = parts[2];
      return (
        <div className="min-h-screen bg-gray-100 py-12 px-4">
          <EditListing propertyId={propertyId} />
        </div>
      );
    }

    if (currentRoute.path.startsWith('/property-analytics/')) {
      if (!user) return <AuthPage />;
      const parts = currentRoute.path.split('/');
      const propertyId = parts[2];
      const propertyAddress = currentRoute.params?.address || 'Property';
      return <EnhancedPropertyAnalytics propertyId={propertyId} propertyAddress={propertyAddress} />;
    }

    if (currentRoute.path.match(/^\/properties\/[^\/]+\/analytics$/)) {
      if (!user) return <AuthPage />;
      const parts = currentRoute.path.split('/');
      const propertyId = parts[2];
      const propertyAddress = currentRoute.params?.address || 'Property';
      return <EnhancedPropertyAnalytics propertyId={propertyId} propertyAddress={propertyAddress} />;
    }

    if ((currentRoute.path.startsWith('/properties/') && currentRoute.path !== '/properties') ||
        (currentRoute.path.startsWith('/property/') && currentRoute.path !== '/property')) {
      const propertyId = currentRoute.path.split('/')[2];
      return (
        <div className="min-h-screen bg-gray-100">
          <PropertyDetail propertyId={propertyId} />
        </div>
      );
    }

    if (currentRoute.path === '/properties') {
      return (
        <div className="min-h-screen bg-gray-100">
          <PropertyList />
        </div>
      );
    }

    if (currentRoute.path === '/buy') {
      return (
        <div className="min-h-screen bg-gray-100">
          <BuyPage />
        </div>
      );
    }

    if (currentRoute.path === '/rent') {
      return (
        <div className="min-h-screen bg-gray-100">
          <RentPage />
        </div>
      );
    }

    if (currentRoute.path.startsWith('/agent-profile/')) {
      const agentId = currentRoute.path.split('/')[2];
      return <AgentPublicProfile agentId={agentId} />;
    }

    if (currentRoute.path.startsWith('/provider/')) {
      const providerId = currentRoute.path.split('/')[2];
      return <ServiceProviderPublicProfile providerId={providerId} />;
    }

    if (currentRoute.path.startsWith('/lender/') &&
        currentRoute.path !== '/lender/setup' &&
        currentRoute.path !== '/lender/dashboard' &&
        currentRoute.path !== '/lender/applications' &&
        currentRoute.path !== '/lender/applications/new' &&
        currentRoute.path !== '/lender/calculator' &&
        currentRoute.path !== '/lender/team' &&
        currentRoute.path !== '/lender/analytics' &&
        currentRoute.path !== '/lender/consultations' &&
        currentRoute.path !== '/lender/leads' &&
        currentRoute.path !== '/lender/pre-approval-requests' &&
        currentRoute.path !== '/lender/send-final-loan' &&
        !currentRoute.path.startsWith('/lender/applications/') &&
        !currentRoute.path.startsWith('/lender/pre-approval/')) {
      const lenderId = currentRoute.path.split('/')[2];
      return <LenderPublicProfile lenderId={lenderId} />;
    }

    if (currentRoute.path.startsWith('/brokerage/') &&
        currentRoute.path !== '/brokerage/setup' &&
        currentRoute.path !== '/brokerage/accept' &&
        currentRoute.path !== '/brokerage/dashboard' &&
        currentRoute.path !== '/brokerage/agent-analytics' &&
        !currentRoute.path.startsWith('/brokerage/agents/') &&
        !currentRoute.path.startsWith('/brokerage/listings/') &&
        currentRoute.path !== '/brokerage/accept-invitation') {
      const brokerageId = currentRoute.path.split('/')[2];
      return <BrokeragePublicProfile brokerageId={brokerageId} />;
    }

    if (currentRoute.path.startsWith('/agents/') && currentRoute.path !== '/agents') {
      if (!user) return <AuthPage />;
      const agentId = currentRoute.path.split('/')[2];
      return (
        <div className="min-h-screen bg-gray-100">
          <AgentProfile agentId={agentId} />
        </div>
      );
    }

    if (currentRoute.path === '/agents') {
      return (
        <div className="min-h-screen bg-gray-100">
          <AllAgentsPage />
        </div>
      );
    }

    if (currentRoute.path === '/service-providers') {
      return (
        <div className="min-h-screen bg-gray-100">
          <AllServiceProvidersPage />
        </div>
      );
    }

    if (currentRoute.path === '/agent/setup') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100 py-12 px-4">
          <AgentSetup />
        </div>
      );
    }

    if (currentRoute.path === '/service-provider/setup') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <ServiceProviderSetup />
        </div>
      );
    }

    if (currentRoute.path === '/lender/setup') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <LenderSetup />
        </div>
      );
    }

    if (currentRoute.path === '/lender/dashboard') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <LenderDashboard />
        </div>
      );
    }

    if (currentRoute.path === '/lender/applications') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <ApplicationsManagement />
        </div>
      );
    }

    if (currentRoute.path === '/lender/applications/new') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <CreateLoanApplication />
        </div>
      );
    }

    if (currentRoute.path.startsWith('/lender/applications/')) {
      if (!user) return <AuthPage />;
      const applicationId = currentRoute.path.split('/').pop();
      return (
        <div className="min-h-screen bg-gray-100">
          <ApplicationDetailPage applicationId={applicationId!} />
        </div>
      );
    }

    if (currentRoute.path === '/mortgage-calculator') {
      return (
        <div className="min-h-screen bg-gray-100">
          <Header />
          <div className="max-w-7xl mx-auto px-4 py-12">
            <MortgageCalculator />
          </div>
        </div>
      );
    }

    if (currentRoute.path === '/lender/calculator') {
      if (!user) return <AuthPage />;
      return (
        <div className="max-w-7xl mx-auto px-4 py-12">
          <MortgageCalculator />
        </div>
      );
    }

    if (currentRoute.path === '/lender/team') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <TeamManagementPage />
        </div>
      );
    }

    if (currentRoute.path === '/lender/analytics') {
      if (!user) return <AuthPage />;
      return (
        <div className="max-w-7xl mx-auto px-4 py-12">
          <LenderAnalytics />
        </div>
      );
    }

    if (currentRoute.path === '/lender/consultations') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <ConsultationsPage />
        </div>
      );
    }

    if (currentRoute.path === '/lender/leads') {
      if (!user) return <AuthPage />;
      return (
        <div className="max-w-7xl mx-auto px-4 py-12">
          <LenderCRM />
        </div>
      );
    }

    if (currentRoute.path === '/lender/pre-approval-requests') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <PreApprovalRequestsManagement />
        </div>
      );
    }

    if (currentRoute.path.startsWith('/lender/pre-approval/')) {
      if (!user) return <AuthPage />;
      const requestId = currentRoute.path.split('/').pop();
      return (
        <div className="min-h-screen bg-gray-100">
          <PreApprovalDetailPage requestId={requestId!} />
        </div>
      );
    }

    if (currentRoute.path === '/lender/send-final-loan') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <SendFinalLoanApproval />
        </div>
      );
    }

    if (currentRoute.path === '/pre-approval-form') {
      return (
        <div className="min-h-screen bg-gray-100">
          <PreApprovalRequestForm />
        </div>
      );
    }

    if (currentRoute.path === '/property-owner/dashboard') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <PropertyOwnerDashboard />
        </div>
      );
    }

    if (currentRoute.path === '/property-owner/setup') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <PropertyOwnerSetup />
        </div>
      );
    }

    if (currentRoute.path === '/property-owner/listings') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <PropertyOwnerListings />
        </div>
      );
    }

    if (currentRoute.path === '/property-owner/tenants') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <TenantManagement />
        </div>
      );
    }

    if (currentRoute.path === '/property-owner/leads') {
      if (!user) return <AuthPage />;
      return <PropertyOwnerLeadsPage />;
    }

    if (currentRoute.path === '/property-owner/calendar') {
      if (!user) return <AuthPage />;
      return <PropertyOwnerCalendar />;
    }

    if (currentRoute.path === '/property-owner/financial-reports') {
      if (!user) return <AuthPage />;
      return <FinancialReports />;
    }

    if (currentRoute.path === '/property-owner/analytics') {
      if (!user) return <AuthPage />;
      return <ComprehensiveAnalytics />;
    }

    if (currentRoute.path === '/property-owner/listings/create') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <CreateRentalListing />
        </div>
      );
    }

    if (currentRoute.path.startsWith('/property-owner/listings/') && currentRoute.path.endsWith('/analytics')) {
      if (!user) return <AuthPage />;
      const parts = currentRoute.path.split('/');
      const propertyId = parts[3];
      const propertyAddress = currentRoute.params?.address || 'Property';
      return <PropertyOwnerAnalytics propertyId={propertyId} propertyAddress={propertyAddress} />;
    }

    if (currentRoute.path.startsWith('/property-owner/listings/') && currentRoute.path.endsWith('/edit')) {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <EditRentalListing />
        </div>
      );
    }

    if (currentRoute.path === '/messages/new') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <NewConversation />
        </div>
      );
    }

    if (currentRoute.path.startsWith('/messages/') && currentRoute.path !== '/messages') {
      if (!user) return <AuthPage />;
      const conversationId = currentRoute.path.split('/')[2];
      return <ConversationView conversationId={conversationId} />;
    }

    if (currentRoute.path === '/messages') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <ConversationList />
        </div>
      );
    }

    if (currentRoute.path === '/documents') {
      if (!user) return <AuthPage />;

      return (
        <div className="min-h-screen bg-gray-100">
          <UniversalDocumentManager />
        </div>
      );
    }

    if (currentRoute.path === '/prospects') {
      if (!user) return <AuthPage />;
      return <ProspectsPage />;
    }

    if (currentRoute.path === '/offers') {
      if (!user) return <AuthPage />;
      if (profile?.user_type === 'agent') {
        return (
          <div className="min-h-screen bg-gray-100">
            <OffersManagement />
          </div>
        );
      }
      if (profile?.user_type === 'seller') {
        return (
          <div className="min-h-screen bg-gray-100">
            <SellerOffersManagement propertyId={currentRoute.params?.propertyId} />
          </div>
        );
      }
      if (profile?.user_type === 'buyer') {
        return (
          <div className="min-h-screen bg-gray-100">
            <OfferHistory />
          </div>
        );
      }
      // Redirect renters and others to home
      navigate('/');
      return null;
    }

    if (currentRoute.path === '/preferences') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <BuyerPreferences />
        </div>
      );
    }

    if (currentRoute.path === '/buyer/calendar') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100 py-12 px-4">
          <BuyerCalendar />
        </div>
      );
    }

    if (currentRoute.path === '/buyer/inspections') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <InspectionManagement />
        </div>
      );
    }

    if (currentRoute.path === '/buyer/appraisals') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <AppraisalManagement />
        </div>
      );
    }

    if (currentRoute.path === '/buyer/closing-checklist') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <ClosingChecklist />
        </div>
      );
    }

    if (currentRoute.path === '/buyer/service-reports') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <CompletedJobReports />
        </div>
      );
    }

    if (currentRoute.path === '/seller/calendar') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <SellerCalendar />
        </div>
      );
    }

    if (currentRoute.path === '/seller/closing-checklist') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <SellerClosingChecklist />
        </div>
      );
    }

    if (currentRoute.path === '/buyer/pre-approvals') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <BuyerPreApprovalRequests />
        </div>
      );
    }

    if (currentRoute.path === '/buyer/loan-applications') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <LoanApplications />
        </div>
      );
    }

    if (currentRoute.path === '/settings') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <UserProfile />
        </div>
      );
    }

    if (currentRoute.path === '/revenue') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <RevenuePage />
        </div>
      );
    }

    if (currentRoute.path === '/invoices') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <InvoicesPage />
        </div>
      );
    }

    if (currentRoute.path === '/reviews') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <ReviewsPage />
        </div>
      );
    }

    if (currentRoute.path === '/leads') {
      if (!user) return <AuthPage />;
      return <LeadsPage />;
    }

    if (currentRoute.path === '/service-provider/calendar') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <ServiceProviderCalendar />
        </div>
      );
    }

    if (currentRoute.path === '/service-provider/jobs') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <JobsManagement />
        </div>
      );
    }

    if (currentRoute.path.startsWith('/service-provider/jobs/')) {
      if (!user) return <AuthPage />;
      const jobId = currentRoute.path.split('/')[3];
      return (
        <div className="min-h-screen bg-gray-100">
          <JobDetails jobId={jobId} />
        </div>
      );
    }

    if (currentRoute.path === '/service-provider/dashboard') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <ServiceProviderDashboard />
        </div>
      );
    }

    if (currentRoute.path.startsWith('/service-provider/') && currentRoute.path !== '/service-provider/setup') {
      const providerId = currentRoute.path.split('/')[2];
      return <ServiceProviderPublicProfile providerId={providerId} />;
    }

    if (currentRoute.path === '/service-providers') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <ServiceProviderSearch />
        </div>
      );
    }

    if (currentRoute.path.startsWith('/invite/')) {
      const token = currentRoute.path.split('/')[2];
      console.log('Rendering AcceptInvitation - currentRoute.path:', currentRoute.path);
      console.log('Extracted token:', token);
      return <AcceptInvitation token={token} />;
    }

    if (currentRoute.path === '/admin') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <AdminDashboard />
        </div>
      );
    }

    if (currentRoute.path === '/admin/accounts') {
      if (!user) return <AuthPage />;
      return <AdminAccountsManagement />;
    }

    if (currentRoute.path === '/admin/listings') {
      if (!user) return <AuthPage />;
      return <AdminListingsManagement />;
    }

    if (currentRoute.path === '/admin/support') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <AdminSupportManagement />
        </div>
      );
    }

    if (currentRoute.path === '/admin/support/analytics') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <SupportTicketAnalytics />
        </div>
      );
    }

    if (currentRoute.path === '/admin/user-growth') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <UserGrowthAnalytics />
        </div>
      );
    }

    if (currentRoute.path === '/features/buyer') {
      return <BuyerFeatures />;
    }

    if (currentRoute.path === '/features/seller') {
      return <SellerFeatures />;
    }

    if (currentRoute.path === '/features/renter') {
      return <RenterFeatures />;
    }

    if (currentRoute.path === '/features/agent') {
      return <AgentFeatures />;
    }

    if (currentRoute.path === '/features/property-owner') {
      return <PropertyOwnerFeatures />;
    }

    if (currentRoute.path === '/features/service-provider') {
      return <ServiceProviderFeatures />;
    }

    if (currentRoute.path === '/features/mortgage-lender') {
      return <MortgageLenderFeatures />;
    }

    if (currentRoute.path === '/features/brokerage') {
      return <BrokerageFeatures />;
    }

    if (currentRoute.path === '/about') {
      return <AboutPage />;
    }

    if (currentRoute.path === '/ticket-reply') {
      return <TicketReplyPage />;
    }

    if (currentRoute.path === '/pending-signatures') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100 py-12 px-4">
          <div className="max-w-7xl mx-auto">
            <PendingSignatures />
          </div>
        </div>
      );
    }

    if (currentRoute.path === '/rental-agreements') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100 py-12 px-4">
          <div className="max-w-7xl mx-auto">
            <RentalAgreementManager />
          </div>
        </div>
      );
    }

    if (currentRoute.path === '/brokerage/setup') {
      if (!user) return <AuthPage />;
      return <BrokerageSetup />;
    }

    if (currentRoute.path === '/brokerage/dashboard') {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <BrokerageDashboard />
        </div>
      );
    }

    if (currentRoute.path === '/brokerage/agent-analytics') {
      if (!user) return <AuthPage />;
      return <BrokerageAgentAnalytics />;
    }

    if (currentRoute.path === '/brokerage/accept-invitation') {
      console.log('Rendering AcceptBrokerageInvitation - user:', user ? 'logged in' : 'not logged in', 'params:', currentRoute.params);
      return <AcceptBrokerageInvitation />;
    }

    if (currentRoute.path.startsWith('/brokerage/listings/') && currentRoute.path.includes('/analytics')) {
      if (!user) return <AuthPage />;
      const propertyId = currentRoute.path.split('/')[3];
      return <BrokerageListingAnalytics propertyId={propertyId} />;
    }

    if (currentRoute.path.startsWith('/brokerage/agents/')) {
      if (!user) return <AuthPage />;
      return (
        <div className="min-h-screen bg-gray-100">
          <BrokerageAgentProfile />
        </div>
      );
    }

    console.log('Rendering HomePage - path:', currentRoute.path);
    return <HomePage />;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      {renderContent()}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <RouterProvider>
          <AppContent />
        </RouterProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
