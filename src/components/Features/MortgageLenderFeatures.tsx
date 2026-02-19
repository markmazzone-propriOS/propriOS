import { ArrowLeft, FileText, Users, TrendingUp, CheckCircle, Calculator, Clock, Bell } from 'lucide-react';
import { useNavigate } from '../Navigation/Router';

export function MortgageLenderFeatures() {
  const navigate = useNavigate();

  const features = [
    {
      icon: FileText,
      title: 'Loan Application Management',
      description: 'Receive and manage loan applications from qualified buyers. Track application status, review documents, and streamline your approval process.',
      screenshot: '/Mortgage_Lender_Loan_Application_Management_v2.png',
    },
    {
      icon: Users,
      title: 'Client Communication',
      description: 'Stay connected with applicants through built-in messaging. Answer questions, request additional documentation, and provide real-time updates.',
      screenshot: '/Mortgage_Lender_Client_Communication_v2.png',
    },
    {
      icon: Calculator,
      title: 'Loan Product Showcase',
      description: 'Display your loan products, rates, and terms. Help buyers understand their financing options and attract qualified applicants to your services.',
      screenshot: '/Mortgage_Lender_Loan_Product_Showcase_v2.png',
    },
    {
      icon: CheckCircle,
      title: 'Application Review & Approval',
      description: 'Efficiently review loan applications with all information organized in one place. Approve, request modifications, or decline applications with detailed feedback.',
      screenshot: '/Mortgage_Lender_Application_Review_&_Approval_v2.png',
    },
    {
      icon: Clock,
      title: 'Pre-Approval Request Management',
      description: 'Track your loan pre-approval pipeline from beginning to end. Monitor approval stages and ensure timely process for all requests.',
      screenshot: '/mortgage_lender_pre-approval_management.png',
    },
    {
      icon: TrendingUp,
      title: 'Performance Analytics',
      description: 'Track key metrics including application volume, approval rates, and average processing time. Make data-driven decisions to optimize your lending operations.',
      screenshot: '/mortgage_lender_performance_analytics.png',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-teal-600 transition mb-8 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Home</span>
        </button>

        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Mortgage Lender Features</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Streamline your mortgage lending operations. Manage applications, communicate with clients, and grow your lending business efficiently.
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
                  <div className="flex-shrink-0 inline-flex items-center justify-center w-16 h-16 bg-teal-100 rounded-xl">
                    <feature.icon className="text-teal-600" size={32} />
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

        <div className="mt-24 bg-gradient-to-r from-teal-600 to-teal-700 rounded-2xl p-12 text-center text-white shadow-xl">
          <Bell size={48} className="mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">Ready to Streamline Your Lending Process?</h2>
          <p className="text-xl mb-8 text-teal-100">
            Join mortgage lenders who are efficiently managing their loan pipeline with Proprieta
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="bg-white text-teal-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-teal-50 transition shadow-lg"
          >
            Get Started Today
          </button>
        </div>
      </div>
    </div>
  );
}
