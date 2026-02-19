import { ArrowLeft, Home, Users, DollarSign, FileText, Calendar, TrendingUp, Bell } from 'lucide-react';
import { useNavigate } from '../Navigation/Router';

export function PropertyOwnerFeatures() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Home,
      title: 'Rental Property Management',
      description: 'Create and manage rental listings with ease. Set rental prices, terms, and availability. Track multiple properties from a single dashboard.',
      screenshot: '/Property_Owner_Listing_Management_v2.png',
    },
    {
      icon: Users,
      title: 'Tenant Management',
      description: 'Manage rental agreements, track active renters, and maintain comprehensive tenant records. Handle lease renewals and track rental history.',
      screenshot: '/Tenant_Management_3_v2.png',
    },
    {
      icon: DollarSign,
      title: 'Rent Collection & Tracking',
      description: 'Track monthly rental income, payment due dates, and payment history. Generate financial reports and monitor your rental portfolio performance.',
      screenshot: '/Property Owner Rent Collection & Tracking.png',
    },
    {
      icon: FileText,
      title: 'Lease Agreement Management',
      description: 'Store and organize lease agreements digitally. Upload lease documents, link them to specific renters, and access them anytime, anywhere.',
      screenshot: '/Property Owner Lease Agreement Manager.png',
    },
    {
      icon: Calendar,
      title: 'Maintenance Scheduling',
      description: 'Schedule property maintenance and coordinate with service providers. Track maintenance history and ensure properties are always in top condition.',
      screenshot: '/Property Ower Maintenance Scheduling.png',
    },
    {
      icon: TrendingUp,
      title: 'Portfolio Analytics',
      description: 'Monitor your rental portfolio performance with detailed analytics. Track occupancy rates, revenue trends, and property appreciation over time.',
      screenshot: '/Property Owner Portfolio Analytics.png',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-cyan-600 transition mb-8 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Home</span>
        </button>

        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Property Owner Features</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Comprehensive rental property management tools. Manage tenants, track rent payments, and grow your rental portfolio with ease.
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
                  <div className="flex-shrink-0 inline-flex items-center justify-center w-16 h-16 bg-cyan-100 rounded-xl">
                    <feature.icon className="text-cyan-600" size={32} />
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

        <div className="mt-24 bg-gradient-to-r from-cyan-600 to-cyan-700 rounded-2xl p-12 text-center text-white shadow-xl">
          <Bell size={48} className="mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">Ready to Streamline Your Rental Business?</h2>
          <p className="text-xl mb-8 text-cyan-100">
            Join property owners who manage their rentals efficiently with Proprieta
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="bg-white text-cyan-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-cyan-50 transition shadow-lg"
          >
            Get Started Today
          </button>
        </div>
      </div>
    </div>
  );
}
