import { ArrowLeft, Search, Heart, FileText, MessageSquare, Calendar, TrendingUp, Bell } from 'lucide-react';
import { useNavigate } from '../Navigation/Router';

export function BuyerFeatures() {
  const navigate = useNavigate();

  const features = [
    {
      icon: TrendingUp,
      title: 'Buyer Journey Tracker',
      description: 'Like ordering a pizza, follow your home buying process with our comprehensive journey tracker. Stay organized from initial search to closing day.',
      screenshot: '/Buyer_Journey_Tracker_v2.png',
    },
    {
      icon: Search,
      title: 'Advanced Property Search',
      description: 'Search and filter properties by location, price, size, and other criteria. View properties on an interactive map or in a grid layout.',
      screenshot: '/Buyer Properties Search.png',
    },
    {
      icon: Heart,
      title: 'Favorites & Tracking',
      description: 'Save your favorite properties and track them over time. Get instant notifications when prices change.',
      screenshot: '/Buyer Favorites Tracking.png',
    },
    {
      icon: MessageSquare,
      title: 'Direct Agent Communication',
      description: 'Connect directly with listing agents through our built-in messaging system. Schedule viewings and ask questions in real-time.',
      screenshot: '/buyer_messages_2.png',
    },
    {
      icon: FileText,
      title: 'Make & Track Offers',
      description: 'Submit offers directly through the platform and track their status. Review and manage all your active offers in one place.',
      screenshot: '/Buyer Offer Tracking.png',
    },
    {
      icon: Calendar,
      title: 'Schedule Property Viewings',
      description: 'Book property viewings at your convenience. Receive calendar invitations and automated reminders for upcoming appointments.',
      screenshot: '/Buyer Viewing Scheduling.png',
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
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Buyer Features</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Everything you need to find and purchase your dream home. Advanced search tools, real-time communication, and comprehensive tracking.
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
          <h2 className="text-3xl font-bold mb-4">Ready to Find Your Dream Home?</h2>
          <p className="text-xl mb-8 text-blue-100">
            Join thousands of buyers who have found their perfect property with Proprieta
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
