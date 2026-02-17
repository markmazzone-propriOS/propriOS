import { useState } from 'react';
import { Search, Building2, Users, TrendingUp, Briefcase, MapPin, LifeBuoy, Calculator, Wrench, BarChart3, Calendar, FileText, CheckCircle } from 'lucide-react';
import { useNavigate } from '../Navigation/Router';
import { useAuth } from '../../contexts/AuthContext';
import { PublicSupportForm } from '../Support/PublicSupportForm';

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showSupportForm, setShowSupportForm] = useState(false);

  return (
    <div>
      <section className="relative h-[600px] flex items-center overflow-hidden bg-gray-900">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute top-0 left-0 w-full h-full object-cover"
          poster="https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=1920"
        >
          <source src="/hero-video.mp4" type="video/mp4" />
        </video>
        <div className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-40"></div>
        <div className="relative max-w-7xl mx-auto px-4 text-center z-10">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Grow Your Real Estate Business
          </h1>
          <p className="text-xl md:text-2xl text-white mb-8">
            Connect with qualified buyers and sellers, manage your entire client pipeline, and close more deals with our all-in-one platform built for real estate professionals.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <button
                onClick={() => navigate('/properties')}
                className="bg-blue-600 text-white px-8 py-4 rounded-md hover:bg-blue-700 transition text-lg font-medium"
              >
                Browse Properties
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/signup')}
                  className="bg-blue-600 text-white px-8 py-4 rounded-md hover:bg-blue-700 transition text-lg font-medium"
                >
                  Get Started
                </button>
                <button
                  onClick={() => navigate('/auth')}
                  className="bg-white text-gray-800 px-8 py-4 rounded-md hover:bg-gray-100 transition text-lg font-medium"
                >
                  Sign In
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-gray-800 text-center mb-12">
            How Agents Grow with PropriOS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <Users size={32} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Attract Leads</h3>
              <p className="text-gray-600">
                Connect with buyers and sellers actively searching for representation
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <Briefcase size={32} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Manage Clients</h3>
              <p className="text-gray-600">
                Track every interaction, document, and milestone with built-in CRM tools
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <TrendingUp size={32} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Market Listings</h3>
              <p className="text-gray-600">
                Showcase properties with rich media, analytics, and seamless offer management
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <Building2 size={32} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Close Transactions</h3>
              <p className="text-gray-600">
                Coordinate viewings, negotiate offers, and complete deals with digital workflows
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-gray-800 text-center mb-4">
            Explore PropriOS Features
          </h2>
          <p className="text-lg text-gray-600 text-center mb-12 max-w-3xl mx-auto">
            Discover powerful tools and features designed specifically for your role in real estate
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <button
              onClick={() => navigate('/features/buyer')}
              className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-6 text-left group"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-lg mb-4 group-hover:bg-blue-600 transition">
                <Search className="text-blue-600 group-hover:text-white transition" size={28} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition">Buyer</h3>
              <p className="text-gray-600 text-sm">
                Discover your dream home with smart search tools and journey tracking
              </p>
            </button>

            <button
              onClick={() => navigate('/features/seller')}
              className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-6 text-left group"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-lg mb-4 group-hover:bg-green-600 transition">
                <TrendingUp className="text-green-600 group-hover:text-white transition" size={28} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-green-600 transition">Seller</h3>
              <p className="text-gray-600 text-sm">
                List and market your property while evaluating offers effortlessly
              </p>
            </button>

            <button
              onClick={() => navigate('/features/renter')}
              className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-6 text-left group"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 bg-purple-100 rounded-lg mb-4 group-hover:bg-purple-600 transition">
                <MapPin className="text-purple-600 group-hover:text-white transition" size={28} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-purple-600 transition">Renter</h3>
              <p className="text-gray-600 text-sm">
                Browse rentals, submit applications, and handle lease agreements
              </p>
            </button>

            <button
              onClick={() => navigate('/features/agent')}
              className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-6 text-left group"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 bg-orange-100 rounded-lg mb-4 group-hover:bg-orange-600 transition">
                <Briefcase className="text-orange-600 group-hover:text-white transition" size={28} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-orange-600 transition">Agent</h3>
              <p className="text-gray-600 text-sm">
                Build your client base with powerful CRM and lead nurturing tools
              </p>
            </button>

            <button
              onClick={() => navigate('/features/property-owner')}
              className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-6 text-left group"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 bg-teal-100 rounded-lg mb-4 group-hover:bg-teal-600 transition">
                <Building2 className="text-teal-600 group-hover:text-white transition" size={28} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-teal-600 transition">Property Owner</h3>
              <p className="text-gray-600 text-sm">
                Oversee your rental portfolio with tenant and financial insights
              </p>
            </button>

            <button
              onClick={() => navigate('/features/service-provider')}
              className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-6 text-left group"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-100 rounded-lg mb-4 group-hover:bg-amber-600 transition">
                <Wrench className="text-amber-600 group-hover:text-white transition" size={28} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-amber-600 transition">Service Provider</h3>
              <p className="text-gray-600 text-sm">
                Win new clients, schedule appointments, and invoice seamlessly
              </p>
            </button>

            <button
              onClick={() => navigate('/features/mortgage-lender')}
              className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-6 text-left group"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-100 rounded-lg mb-4 group-hover:bg-indigo-600 transition">
                <Calculator className="text-indigo-600 group-hover:text-white transition" size={28} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-indigo-600 transition">Mortgage Lender</h3>
              <p className="text-gray-600 text-sm">
                Process loan applications and provide pre-approvals efficiently
              </p>
            </button>

            <button
              onClick={() => navigate('/features/brokerage')}
              className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-6 text-left group"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 bg-slate-100 rounded-lg mb-4 group-hover:bg-slate-600 transition">
                <Building2 className="text-slate-600 group-hover:text-white transition" size={28} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-slate-600 transition">Brokerage</h3>
              <p className="text-gray-600 text-sm">
                Lead your agents with centralized analytics and team collaboration
              </p>
            </button>
          </div>
        </div>
      </section>

      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Everything You Need to Succeed as an Agent
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              PropriOS gives you the professional tools to manage leads, close deals, and grow your business all in one place.
            </p>
          </div>

          <div className="space-y-32">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-2xl transform rotate-3"></div>
                  <div className="relative bg-gray-900 rounded-2xl shadow-2xl p-3 transform -rotate-1 hover:rotate-0 transition-transform duration-300">
                    <div className="bg-gray-800 rounded-t-lg px-4 py-3 flex items-center gap-2">
                      <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      </div>
                      <div className="flex-1 text-center text-gray-400 text-xs font-medium">PropriOS - Leads & CRM</div>
                    </div>
                    <div className="bg-white rounded-b-lg overflow-hidden">
                      <img
                        src="/Leads & CRM Screenshot.png"
                        alt="Leads and CRM Management"
                        className="w-full h-auto"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-6">
                  <Users className="text-blue-600" size={24} />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-4">
                  Intelligent Lead Management
                </h3>
                <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                  Never lose track of a potential client again. Our powerful CRM automatically captures and organizes leads from multiple sources, tracks every interaction, and reminds you when it's time to follow up. Smart prioritization helps you focus on the hottest opportunities.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                    <span className="text-gray-700">Automated lead capture and scoring</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                    <span className="text-gray-700">Activity timeline tracking</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                    <span className="text-gray-700">Smart follow-up reminders</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-6">
                  <BarChart3 className="text-blue-600" size={24} />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-4">
                  Real-Time Listing Analytics
                </h3>
                <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                  Make data-driven decisions with comprehensive analytics for every listing. Track views, favorites, showings, and offers in real-time. Understand what's working and optimize your marketing strategy to sell properties faster at better prices.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                    <span className="text-gray-700">Engagement metrics and viewer insights</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                    <span className="text-gray-700">Market comparison tools</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                    <span className="text-gray-700">Performance benchmarking</span>
                  </li>
                </ul>
              </div>
              <div>
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-2xl transform -rotate-3"></div>
                  <div className="relative bg-gray-900 rounded-2xl shadow-2xl p-3 transform rotate-1 hover:rotate-0 transition-transform duration-300">
                    <div className="bg-gray-800 rounded-t-lg px-4 py-3 flex items-center gap-2">
                      <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      </div>
                      <div className="flex-1 text-center text-gray-400 text-xs font-medium">PropriOS - Listing Analytics</div>
                    </div>
                    <div className="bg-white rounded-b-lg overflow-hidden">
                      <img
                        src="/Listing Analytics.png"
                        alt="Listing Analytics Dashboard"
                        className="w-full h-auto"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-2xl transform rotate-3"></div>
                  <div className="relative bg-gray-900 rounded-2xl shadow-2xl p-3 transform -rotate-1 hover:rotate-0 transition-transform duration-300">
                    <div className="bg-gray-800 rounded-t-lg px-4 py-3 flex items-center gap-2">
                      <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      </div>
                      <div className="flex-1 text-center text-gray-400 text-xs font-medium">PropriOS - Calendar</div>
                    </div>
                    <div className="bg-white rounded-b-lg overflow-hidden">
                      <img
                        src="/Appointment Scheduling.png"
                        alt="Appointment Scheduling"
                        className="w-full h-auto"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-6">
                  <Calendar className="text-blue-600" size={24} />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-4">
                  Seamless Scheduling & Coordination
                </h3>
                <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                  Stay organized and never miss an appointment. Our integrated calendar syncs viewings, inspections, closings, and client meetings. Automated reminders keep everyone on track, and your clients can book showings directly through your profile.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                    <span className="text-gray-700">Online booking for property viewings</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                    <span className="text-gray-700">Automatic email reminders</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                    <span className="text-gray-700">Team calendar sharing</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-6">
                  <FileText className="text-blue-600" size={24} />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-4">
                  Professional Document Management
                </h3>
                <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                  Keep every contract, disclosure, and agreement organized and accessible. Upload, share, and request e-signatures on documents. Create folders for each client and transaction so everything is always at your fingertips when you need it.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                    <span className="text-gray-700">Secure cloud storage</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                    <span className="text-gray-700">E-signature integration</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                    <span className="text-gray-700">Client document sharing</span>
                  </li>
                </ul>
              </div>
              <div>
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-2xl transform -rotate-3"></div>
                  <div className="relative bg-gray-900 rounded-2xl shadow-2xl p-3 transform rotate-1 hover:rotate-0 transition-transform duration-300">
                    <div className="bg-gray-800 rounded-t-lg px-4 py-3 flex items-center gap-2">
                      <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      </div>
                      <div className="flex-1 text-center text-gray-400 text-xs font-medium">PropriOS - Documents</div>
                    </div>
                    <div className="bg-white rounded-b-lg overflow-hidden">
                      <img
                        src="/Document Management.png"
                        alt="Document Management"
                        className="w-full h-auto"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-2xl transform rotate-3"></div>
                  <div className="relative bg-gray-900 rounded-2xl shadow-2xl p-3 transform -rotate-1 hover:rotate-0 transition-transform duration-300">
                    <div className="bg-gray-800 rounded-t-lg px-4 py-3 flex items-center gap-2">
                      <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      </div>
                      <div className="flex-1 text-center text-gray-400 text-xs font-medium">PropriOS - Analytics Dashboard</div>
                    </div>
                    <div className="bg-white rounded-b-lg overflow-hidden">
                      <img
                        src="/business_analytics.png"
                        alt="Business Analytics Dashboard"
                        className="w-full h-auto"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-6">
                  <BarChart3 className="text-blue-600" size={24} />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-4">
                  Comprehensive Business Analytics
                </h3>
                <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                  Get a complete view of your business performance with powerful analytics dashboards. Track your revenue, commission earnings, pipeline value, and conversion rates all in one place. Analyze your deals by type, identify your top lead sources, and make informed decisions to accelerate your growth.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                    <span className="text-gray-700">Revenue and commission tracking</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                    <span className="text-gray-700">Pipeline value and conversion metrics</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                    <span className="text-gray-700">Lead source analysis and deal insights</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-blue-600 text-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-4xl font-bold mb-6">Ready to Get Started?</h2>
          <p className="text-xl mb-8">
            Join thousands of buyers, sellers, and agents using Proprieta
          </p>
          <button
            onClick={() => navigate(user ? '/properties' : '/signup')}
            className="bg-white text-blue-600 px-8 py-4 rounded-md hover:bg-gray-100 transition text-lg font-medium"
          >
            {user ? 'Browse Properties' : 'Create Account'}
          </button>
        </div>
      </section>

      <footer className="bg-gray-800 text-white py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-4 md:mb-0">
              <p className="text-gray-400 text-sm">
                &copy; 2026 Proprieta. All rights reserved.
              </p>
            </div>
            <button
              onClick={() => setShowSupportForm(true)}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition font-medium"
            >
              <LifeBuoy size={20} />
              Need Help? Contact Support
            </button>
          </div>
          <div className="mt-4 text-center">
            <p className="text-gray-400 text-sm">
              Having trouble logging in? Click the support button above to submit a ticket.
            </p>
          </div>
        </div>
      </footer>

      {showSupportForm && (
        <PublicSupportForm onClose={() => setShowSupportForm(false)} />
      )}
    </div>
  );
}
