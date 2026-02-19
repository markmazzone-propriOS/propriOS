import { ArrowLeft, Building2, Users, TrendingUp, Calendar, BarChart3, Shield, Bell } from 'lucide-react';
import { useNavigate } from '../Navigation/Router';

export function BrokerageFeatures() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Building2,
      title: 'Brokerage Management',
      description: 'Create and manage your brokerage profile with ease. Showcase your brand, services, and team to attract both agents and clients. Build a professional presence that sets you apart.',
      screenshot: '/Brokerage_Management_v2.png',
    },
    {
      icon: Users,
      title: 'Agent Team Management',
      description: 'Recruit, onboard, and manage your agent team all in one place. Send invitations, track performance, and support your agents with the tools they need to succeed.',
      screenshot: '/agent_team_management.png',
    },
    {
      icon: TrendingUp,
      title: 'Performance Analytics',
      description: 'Track brokerage-wide metrics and individual agent performance. Monitor listing activity, sales volume, and transaction velocity to make data-driven decisions.',
      screenshot: '/performance_analytics_2.png',
    },
    {
      icon: Calendar,
      title: 'Shared Calendar System',
      description: 'Coordinate showings, meetings, and events across your entire team. View agent availability, prevent scheduling conflicts, and optimize team productivity.',
      screenshot: '/shared_calendar_system.png',
    },
    {
      icon: BarChart3,
      title: 'Listing Portfolio Overview',
      description: 'Access a comprehensive view of all listings managed by your brokerage. Track status, analyze trends, and identify opportunities to support your agents better.',
      screenshot: '/listing_portfolio_overview.png',
    },
    {
      icon: Shield,
      title: 'Compliance & Security',
      description: 'Maintain regulatory compliance with built-in tools for secure document management. Protect your brokerage and clients with the security of our platform.',
      screenshot: '/compliance_&_security.png',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition mb-8 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Home</span>
        </button>

        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Brokerage Features</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Comprehensive brokerage management platform. Manage your team, track performance, and grow your business with powerful analytics and collaboration tools.
          </p>
        </div>

        <div className="space-y-24">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`flex flex-col ${
                index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'
              } gap-12 items-center`}
            >
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-xl">
                    <feature.icon className="text-blue-600" size={32} />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900">{feature.title}</h2>
                </div>
                <p className="text-lg text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
              <div className="flex-1">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white">
                  <img
                    src={feature.screenshot}
                    alt={feature.title}
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-24 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-12 text-center text-white shadow-xl">
          <Bell size={48} className="mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">Ready to Grow Your Brokerage?</h2>
          <p className="text-xl mb-8 text-blue-100">
            Join leading brokerages using Proprieta to manage their teams and drive success
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-50 transition shadow-lg"
          >
            Get Started Today
          </button>
        </div>
      </div>
    </div>
  );
}
