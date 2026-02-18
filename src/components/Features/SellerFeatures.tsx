import { ArrowLeft, Tag, Camera, BarChart3, Users, FileCheck, TrendingUp, Bell } from 'lucide-react';
import { useNavigate } from '../Navigation/Router';

export function SellerFeatures() {
  const navigate = useNavigate();

  const features = [
    {
      icon: TrendingUp,
      title: 'Seller Journey Tracker',
      description: 'Monitor your selling progress from listing to closing. Stay organized with automated reminders for important milestones and deadlines.',
      screenshot: '/Selling_Journey_.png',
    },
    {
      icon: Camera,
      title: 'Professional Property Listings',
      description: 'Create stunning listings with multiple high-quality photos, detailed descriptions, and virtual tours where applicable. Showcase your property to buyers.',
      screenshot: '/Listing_Details_Page.png',
    },
    {
      icon: Tag,
      title: 'Offer Management',
      description: 'Review, accept, or counter offers in real-time. Manage multiple offers efficiently and negotiate directly with buyers through the platform.',
      screenshot: '/Offer Management copy.png',
    },
    {
      icon: BarChart3,
      title: 'Property Performance Analytics',
      description: 'Track how many buyers have viewed your listing, saved it as a favorite, and scheduled viewings. Make data-driven pricing decisions.',
      screenshot: '/Listing Analytics.png',
    },
    {
      icon: Users,
      title: 'Agent Collaboration',
      description: 'Work seamlessly with your listing agent. Share documents, track progress, and stay updated on all activities related to your property sale.',
      screenshot: '/Seller Messages.png',
    },
    {
      icon: FileCheck,
      title: 'Document Management',
      description: 'Store and organize all sale-related documents securely. Share contracts, disclosures, and inspection reports with authorized parties.',
      screenshot: '/Seller Document Management.png',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-emerald-600 transition mb-8 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Home</span>
        </button>

        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Seller Features</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Powerful tools to help you sell your property quickly and efficiently. From listing creation to closing, we've got you covered.
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
                  <div className="flex-shrink-0 inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-xl">
                    <feature.icon className="text-emerald-600" size={32} />
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

        <div className="mt-24 bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-2xl p-12 text-center text-white shadow-xl">
          <Bell size={48} className="mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">Ready to Sell Your Property?</h2>
          <p className="text-xl mb-8 text-emerald-100">
            List your property with confidence using our comprehensive seller tools
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="bg-white text-emerald-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-emerald-50 transition shadow-lg"
          >
            Get Started Today
          </button>
        </div>
      </div>
    </div>
  );
}
