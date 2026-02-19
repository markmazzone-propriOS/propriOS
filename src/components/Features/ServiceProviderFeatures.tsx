import { ArrowLeft, Briefcase, Target, Calendar, DollarSign, Star, Camera, Bell } from 'lucide-react';
import { useNavigate } from '../Navigation/Router';

export function ServiceProviderFeatures() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Briefcase,
      title: 'Professional Business Profile',
      description: 'Create a comprehensive business profile showcasing your services, experience, and expertise. Upload your logo and build your brand presence.',
      screenshot: '/Service_Provider_Professional_Profile_v2.png',
    },
    {
      icon: Target,
      title: 'Lead Management System',
      description: 'Receive and manage service requests from property owners and homebuyers. Track lead status, respond quickly, and convert inquiries into jobs.',
      screenshot: '/Service_Provider_Lead_Management_v2.png',
    },
    {
      icon: Calendar,
      title: 'Appointment Scheduling',
      description: 'Manage your service appointments efficiently. Schedule consultations, site visits, and service calls. Send automated reminders to clients.',
      screenshot: '/Service_Provider_Appointment_Scheduling_v2.png',
    },
    {
      icon: DollarSign,
      title: 'Invoicing & Revenue Tracking',
      description: 'Create and send professional invoices directly through the platform. Track payments, manage outstanding invoices, and monitor your revenue growth.',
      screenshot: '/Service_Provider_Invoice_Management_v2.png',
    },
    {
      icon: Camera,
      title: 'Portfolio Gallery',
      description: 'Showcase your best work with a photo gallery. Upload before-and-after images, highlight completed projects, and attract more clients.',
      screenshot: '/Service Providers Photo Gallery.png',
    },
    {
      icon: Star,
      title: 'Reviews & Ratings',
      description: 'Build trust with client reviews and ratings. Display testimonials on your profile and establish credibility in your service category.',
      screenshot: '/Service Provider Ratings & Reviews.png',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-amber-600 transition mb-8 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Home</span>
        </button>

        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Service Provider Features</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Everything you need to grow your home services business. From lead management to invoicing, streamline your operations and attract more clients.
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
                  <div className="flex-shrink-0 inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-xl">
                    <feature.icon className="text-amber-600" size={32} />
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

        <div className="mt-24 bg-gradient-to-r from-amber-600 to-amber-700 rounded-2xl p-12 text-center text-white shadow-xl">
          <Bell size={48} className="mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">Ready to Grow Your Service Business?</h2>
          <p className="text-xl mb-8 text-amber-100">
            Join service professionals who are expanding their client base with Proprieta
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="bg-white text-amber-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-amber-50 transition shadow-lg"
          >
            Get Started Today
          </button>
        </div>
      </div>
    </div>
  );
}
