import { ArrowLeft, Building2, Users, Calendar, Target, FileText, Star, Bell, RefreshCw, BarChart3 } from 'lucide-react';
import { useNavigate } from '../Navigation/Router';
import { useState } from 'react';

export function AgentFeatures() {
  const navigate = useNavigate();
  const [isFlipped, setIsFlipped] = useState(false);

  const features = [
    {
      icon: Building2,
      title: 'Property Management',
      description: 'Create and manage unlimited property listings. Upload photos, set pricing, and update availability in real-time. Track performance metrics for each listing.',
      screenshot: '/Agent Listings.png',
      secondaryScreenshot: '/Listings Analytics 2.png',
    },
    {
      icon: BarChart3,
      title: 'Advanced Analytics & Insights',
      description: 'Make data-driven decisions with comprehensive analytics dashboards. Track listing performance, monitor engagement metrics, analyze market trends, and measure your success with detailed reports. Get real-time insights on views, favorites, showings, and conversion rates to optimize your selling strategy.',
      screenshot: '/Listings_Analytics_2_v2.png',
    },
    {
      icon: Target,
      title: 'Lead & Prospect CRM',
      description: 'Manage all your leads in one place. Track buyer and seller prospects, log activities, set reminders, and never miss a follow-up opportunity.',
      screenshot: '/Leads_&_CRM_Screenshot_v2.png',
    },
    {
      icon: Calendar,
      title: 'Appointment Scheduling',
      description: 'Coordinate property viewings with an integrated calendar system. Send invitations, manage cancellations, and sync with your personal calendar.',
      screenshot: '/Appointment_Scheduling_v2.png',
    },
    {
      icon: Users,
      title: 'Client Management',
      description: 'Track buyer and seller journeys from first contact to closing. Assign clients, manage relationships, and provide exceptional service throughout the process.',
      screenshot: '/Client_Management_Assign_Seller_v2.png',
    },
    {
      icon: FileText,
      title: 'Document Management',
      description: 'Store, organize, and share documents securely with clients. Manage contracts, disclosures, and transaction documents all in one place. Send documents securely for e-signatures as needed.',
      screenshot: '/Document Management.png',
    },
    {
      icon: Star,
      title: 'Reviews & Reputation',
      description: 'Build your professional reputation with client reviews. Showcase your expertise, track your ratings, and attract more quality leads.',
      screenshot: '/Reviews and Ratings.png',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-orange-600 transition mb-8 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Home</span>
        </button>

        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Agent Features</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Complete real estate business management platform. Manage listings, track leads, schedule viewings, and grow your business all in one place.
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
                  <div className="flex-shrink-0 inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-xl">
                    <feature.icon className="text-orange-600" size={32} />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900">{feature.title}</h2>
                </div>
                <p className="text-lg text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
              <div className="flex-1">
                {feature.secondaryScreenshot ? (
                  <div className="relative">
                    <div className="relative perspective-1000">
                      {/* Main container with flip animation */}
                      <div
                        className="relative w-full transition-transform duration-700 transform-style-3d"
                        style={{
                          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                          transformStyle: 'preserve-3d',
                        }}
                      >
                        {/* Front: Listings Screenshot */}
                        <div
                          className="backface-hidden rounded-2xl overflow-hidden shadow-2xl border-4 border-white"
                          style={{ backfaceVisibility: 'hidden' }}
                        >
                          <img
                            src={feature.screenshot}
                            alt={`${feature.title} - Listings`}
                            className="w-full h-auto"
                          />
                        </div>

                        {/* Back: Analytics Screenshot */}
                        <div
                          className="absolute inset-0 backface-hidden rounded-2xl overflow-hidden shadow-2xl border-4 border-white"
                          style={{
                            backfaceVisibility: 'hidden',
                            transform: 'rotateY(180deg)',
                          }}
                        >
                          <img
                            src={feature.secondaryScreenshot}
                            alt={`${feature.title} - Analytics`}
                            className="w-full h-auto"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Flip Button */}
                    <button
                      onClick={() => setIsFlipped(!isFlipped)}
                      className="mt-4 mx-auto flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold transition shadow-lg hover:shadow-xl group"
                    >
                      <RefreshCw size={20} className="group-hover:rotate-180 transition-transform duration-500" />
                      {isFlipped ? 'View Listings' : 'View Analytics'}
                    </button>
                  </div>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white">
                    <img
                      src={feature.screenshot}
                      alt={feature.title}
                      className="w-full h-auto"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-24 bg-gradient-to-r from-orange-600 to-orange-700 rounded-2xl p-12 text-center text-white shadow-xl">
          <Bell size={48} className="mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">Ready to Grow Your Real Estate Business?</h2>
          <p className="text-xl mb-8 text-orange-100">
            Join top-performing agents using Proprieta to manage their business efficiently
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="bg-white text-orange-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-orange-50 transition shadow-lg"
          >
            Get Started Today
          </button>
        </div>
      </div>
    </div>
  );
}
