import { ArrowLeft, Home, Search, FileText, MessageSquare, Star, Bell } from 'lucide-react';
import { useNavigate } from '../Navigation/Router';

export function RenterFeatures() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Search,
      title: 'Property Search & Discovery',
      description: 'Browse available rental properties with detailed filters. Search by location, price, availability, and other factors.',
      screenshot: '/Rental_Properties_and_Filter_v2.png',
    },
    {
      icon: Home,
      title: 'Virtual Tours & Viewings',
      description: 'Schedule property viewings at your convenience. Access high-quality photos and virtual tours as applicable. Get instant notifications for viewing confirmations and reminders.',
      screenshot: '/Renter Property Viewings.png',
    },
    {
      icon: FileText,
      title: 'Digital Application Process',
      description: 'Submit rental applications online with ease. Upload required documents securely. Track your application status in real-time and receive instant updates.',
      screenshot: '/Rental Applications 2.png',
    },
    {
      icon: FileText,
      title: 'Lease Agreement Management',
      description: 'Review and sign lease agreements digitally. Store all rental documents in one secure place. Access your lease terms anytime, anywhere.',
      screenshot: '/Rental Pending Signatures.png',
    },
    {
      icon: MessageSquare,
      title: 'Direct Communication',
      description: 'Message property owners and landlords directly through the platform. Ask questions, request maintenance, and coordinate move-in details. Keep all communications organized in one place.',
      screenshot: '/Renter Messaging.png',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-emerald-600 transition mb-8 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Home</span>
        </button>

        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Renter Features</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Find your perfect rental home with ease. Search properties, submit applications, and manage your rental journey all in one place.
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

        <div className="mt-24 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-12 text-center text-white shadow-xl">
          <Bell size={48} className="mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">Ready to Find Your Next Home?</h2>
          <p className="text-xl mb-8 text-emerald-100">
            Join renters who found their perfect place with Proprieta
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
