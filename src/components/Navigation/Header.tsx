import { Home, Building2, Users, MessageSquare, LayoutDashboard, Settings, Target, Tag, DollarSign, FileText, Briefcase, Shield, FolderOpen, List, ChevronDown, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from './Router';
import ActivityFeed from './ActivityFeed';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

export function Header() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPropriosMenu, setShowPropriosMenu] = useState(false);
  const [showMarketplacesMenu, setShowMarketplacesMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const marketplacesMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function checkAdminStatus() {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data } = await supabase
        .from('admin_users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      setIsAdmin(!!data);
    }

    checkAdminStatus();
  }, [user]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowPropriosMenu(false);
      }
      if (marketplacesMenuRef.current && !marketplacesMenuRef.current.contains(event.target as Node)) {
        setShowMarketplacesMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const propriosMenuItems = [
    { label: 'Buyer Features', path: '/features/buyer' },
    { label: 'Seller Features', path: '/features/seller' },
    { label: 'Renter Features', path: '/features/renter' },
    { label: 'Agent Features', path: '/features/agent' },
    { label: 'Property Owner Features', path: '/features/property-owner' },
    { label: 'Service Provider Features', path: '/features/service-provider' },
    { label: 'Brokerage Features', path: '/features/brokerage' },
    { label: 'Mortgage Lender Features', path: '/features/mortgage-lender' },
  ];

  return (
    <header className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <button
            onClick={() => navigate('/')}
            className="flex items-center hover:opacity-80 transition"
          >
            <img
              src="/logo-b2.png"
              alt="Proprieta"
              className="h-12 w-auto object-contain"
            />
          </button>

          <nav className="flex items-center gap-6">
            {!user && (
              <>
                <button
                  onClick={() => navigate('/buy')}
                  className="text-gray-700 hover:text-blue-600 transition font-medium"
                >
                  Buy
                </button>

                <button
                  onClick={() => navigate('/rent')}
                  className="text-gray-700 hover:text-blue-600 transition font-medium"
                >
                  Rent
                </button>

                <button
                  onClick={() => navigate('/agents')}
                  className="text-gray-700 hover:text-blue-600 transition font-medium"
                >
                  Find an Agent
                </button>

                <button
                  onClick={() => navigate('/service-providers')}
                  className="text-gray-700 hover:text-blue-600 transition font-medium"
                >
                  Find Services
                </button>

                <div className="h-6 w-px bg-gray-300"></div>

                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setShowPropriosMenu(!showPropriosMenu)}
                    className="flex items-center gap-1 text-gray-700 hover:text-blue-600 transition font-medium"
                  >
                    <span>PropriOS</span>
                    <ChevronDown size={16} className={`transition-transform ${showPropriosMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showPropriosMenu && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
                      {propriosMenuItems.map((item) => (
                        <button
                          key={item.path}
                          onClick={() => {
                            navigate(item.path);
                            setShowPropriosMenu(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 text-gray-700 hover:text-blue-600 transition font-medium"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => navigate('/about')}
                  className="text-gray-700 hover:text-blue-600 transition font-medium"
                >
                  About
                </button>
              </>
            )}

            {user ? (
              <>
                {(profile?.user_type === 'buyer' || profile?.user_type === 'renter' || profile?.user_type === 'seller' || profile?.user_type === 'property_owner' || profile?.user_type === 'agent' || profile?.user_type === 'service_provider' || profile?.user_type === 'mortgage_lender') && (
                  <button
                    onClick={() => navigate(
                      profile?.user_type === 'property_owner' ? '/property-owner/dashboard' :
                      profile?.user_type === 'mortgage_lender' ? '/lender/dashboard' :
                      '/dashboard'
                    )}
                    className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition font-medium"
                  >
                    <LayoutDashboard size={20} />
                    <span>Dashboard</span>
                  </button>
                )}
                <div className="relative" ref={marketplacesMenuRef}>
                  <button
                    onClick={() => setShowMarketplacesMenu(!showMarketplacesMenu)}
                    className="flex items-center gap-1 text-gray-700 hover:text-blue-600 transition font-medium"
                  >
                    <span>Marketplaces</span>
                    <ChevronDown size={16} className={`transition-transform ${showMarketplacesMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showMarketplacesMenu && (
                    <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
                      {profile?.user_type !== 'property_owner' && (
                        <button
                          onClick={() => {
                            navigate('/properties');
                            setShowMarketplacesMenu(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 text-gray-700 hover:text-blue-600 transition font-medium flex items-center gap-3"
                        >
                          <Building2 size={18} />
                          <span>Properties</span>
                        </button>
                      )}
                      {profile?.user_type !== 'property_owner' && (
                        <button
                          onClick={() => {
                            navigate('/agents');
                            setShowMarketplacesMenu(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 text-gray-700 hover:text-blue-600 transition font-medium flex items-center gap-3"
                        >
                          <Users size={18} />
                          <span>Agents</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          navigate('/service-providers');
                          setShowMarketplacesMenu(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 text-gray-700 hover:text-blue-600 transition font-medium flex items-center gap-3"
                      >
                        <Briefcase size={18} />
                        <span>Services</span>
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => navigate('/messages')}
                  className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition font-medium"
                >
                  <MessageSquare size={20} />
                  <span>Messages</span>
                </button>
                {profile?.user_type === 'mortgage_lender' && (
                  <button
                    onClick={() => navigate('/lender/leads')}
                    className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition font-medium"
                  >
                    <Target size={20} />
                    <span>Lead CRM</span>
                  </button>
                )}
                {(profile?.user_type === 'buyer' || profile?.user_type === 'renter') && (
                  <button
                    onClick={() => navigate('/buyer/calendar')}
                    className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition font-medium"
                  >
                    <Calendar size={20} />
                    <span>Viewings</span>
                  </button>
                )}
                {(profile?.user_type === 'buyer' || profile?.user_type === 'renter' || profile?.user_type === 'seller' || profile?.user_type === 'agent' || profile?.user_type === 'property_owner') && (
                  <button
                    onClick={() => navigate('/documents')}
                    className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition font-medium"
                  >
                    <FolderOpen size={20} />
                    <span>Documents</span>
                  </button>
                )}
                {profile?.user_type === 'buyer' || profile?.user_type === 'seller' || profile?.user_type === 'agent' ? (
                  <button
                    onClick={() => navigate('/offers')}
                    className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition font-medium"
                  >
                    <Tag size={20} />
                    <span>Offers</span>
                  </button>
                ) : null}
                {profile?.user_type === 'agent' && (
                  <button
                    onClick={() => navigate('/prospects')}
                    className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition font-medium"
                  >
                    <Target size={20} />
                    <span>Leads</span>
                  </button>
                )}
                {profile?.user_type === 'property_owner' && (
                  <button
                    onClick={() => navigate('/property-owner/leads')}
                    className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition font-medium"
                  >
                    <Target size={20} />
                    <span>Leads</span>
                  </button>
                )}
                {profile?.user_type === 'service_provider' && (
                  <>
                    <button
                      onClick={() => navigate('/leads')}
                      className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition font-medium"
                    >
                      <Target size={20} />
                      <span>Leads</span>
                    </button>
                    <button
                      onClick={() => navigate('/invoices')}
                      className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition font-medium"
                    >
                      <FileText size={20} />
                      <span>Invoices</span>
                    </button>
                    <button
                      onClick={() => navigate('/revenue')}
                      className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition font-medium"
                    >
                      <DollarSign size={20} />
                      <span>Revenue</span>
                    </button>
                  </>
                )}
                <ActivityFeed />
                {isAdmin && (
                  <button
                    onClick={() => navigate('/admin')}
                    className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition font-medium"
                  >
                    <Shield size={20} />
                    <span>Admin</span>
                  </button>
                )}
                <button
                  onClick={() => navigate('/settings')}
                  className="flex items-center text-gray-700 hover:text-blue-600 transition"
                  title="Settings"
                >
                  <Settings size={20} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate('/auth')}
                  className="text-gray-700 hover:text-blue-600 transition font-medium"
                >
                  Sign In
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition font-medium"
                >
                  Sign Up
                </button>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
