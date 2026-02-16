import { ArrowLeft, Shield, Users, MessageCircle, Heart, Target, Award } from 'lucide-react';
import { useNavigate } from '../Navigation/Router';

export function AboutPage() {
  const navigate = useNavigate();

  const values = [
    {
      icon: Shield,
      title: 'Servant Leadership',
      description: 'We exist to serve our customers, but more importantly, team members of all spectrums, from the new hire to senior leaders, exist to serve and empower one another to bring their best selves and best ideas to work every day.',
    },
    {
      icon: Users,
      title: 'Customer Obsession',
      description: 'Customers are why we do what we do. Without them, we are without a mission and direction. One of our main responsibilities is to obsess over their problems and build more effective and efficient solutions.',
    },
    {
      icon: MessageCircle,
      title: 'Communication',
      description: 'Without communication, there can be no mission. When communication breaks down, so does trust and the pillars that keep an organization standing. Candor, even when uncomfortable, is encouraged. Respect is given in both directions during the exchange, and anyone is allowed to bring ideas to senior leaders no matter their position in the company.',
    },
    {
      icon: Heart,
      title: 'Commitment',
      description: 'For some people coming to work is just a job. For others, it\'s who they are. No matter where you fit on the spectrum, we want to see you wholly committed to what you do and the skills and expertise you bring to make that happen. No matter if you\'re here for a short time and brushing up your skills or you\'re a more tenured employee, commitment to each other and the mission allows us to be who we are and bring value to the customers and each other.',
    },
    {
      icon: Target,
      title: 'Trust',
      description: 'An organization without trust is broken. We cannot succeed when team members don\'t trust each other or their leadership. To that end, things like open communication and candor help bring that trust to the company so we know we can ultimately rely on each other to reach the finish line together for projects and tasks large and small no matter the size. Trust every day means doing the right thing no matter who is around or the situation you find yourself in.',
    },
    {
      icon: Award,
      title: 'Empowerment',
      description: 'We empower real estate professionals and property seekers with the tools, information, and resources they need to succeed. By democratizing access to quality real estate services, we help everyone achieve their goals.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition mb-8 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Home</span>
        </button>

        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">About Proprieta</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Transforming the real estate experience through innovation, integrity, and community. Real estate. Better.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-12 mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Who We Are</h2>
          <div className="space-y-4 text-gray-700 text-lg leading-relaxed">
            <p>
              Proprieta, or "property" in Italian, is a proptech startup focused on the real estate industry and the value it not only brings to realtors and real estate agents but also buyers, sellers, renters, and service providers.
            </p>
            <p>
              It was started by a US Army veteran who has resided in eastern North Carolina for most of his life, apart from his active duty time, brief stint in Maryland, and two Iraq tours in support of Operation Iraqi Freedom while as a soldier.
            </p>
            <p>
              The need for the platform appeared after several discussions with friends and family about their experiences buying a home, from both experienced home buyers and those new to the market. Two of his friends, one of whom was a Marine veteran (along with those same family members) gave him valuable insights into what goes into being a real estate agent, and that turned into what Proprieta became.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-12 mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">What We Are</h2>
          <div className="space-y-4 text-gray-700 text-lg leading-relaxed">
            <p>
              Proprieta was founded with a simple yet powerful vision: to create a comprehensive platform that connects everyone in the real estate ecosystem. From buyers and sellers to agents, property owners, and service providers, we bring all the essential players together in one seamless experience with what is called PropriOS.
            </p>
            <p>
              We understand that real estate transactions can be complex and overwhelming. That is why we have built a platform that simplifies every step of the journey, whether you are buying your first home, managing rental properties, or growing your real estate business.
            </p>
            <p>
              Our technology-driven approach combines powerful tools with an intuitive user experience, making it easier than ever to find properties, connect with professionals, manage documents, and close deals. We are more than just a listings platform—we are your partner in every real estate endeavor.
            </p>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-4xl font-bold text-gray-900 text-center mb-4">Our Mission</h2>
          <p className="text-xl text-gray-600 text-center max-w-4xl mx-auto mb-12">
            To revolutionize the real estate industry by providing innovative tools and seamless connections that empower everyone to achieve their property goals with confidence and ease.
          </p>
        </div>

        <div className="mb-16">
          <h2 className="text-4xl font-bold text-gray-900 text-center mb-12">Our Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {values.map((value, index) => {
              return (
                <div
                  key={index}
                  className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow"
                >
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{value.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{value.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-lg p-12 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Join the Proprieta Community</h2>
          <p className="text-xl mb-8 opacity-90">
            Whether you are buying, selling, or managing properties, we are here to support your journey every step of the way.
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="bg-white text-blue-600 px-8 py-4 rounded-lg hover:bg-gray-100 transition text-lg font-semibold shadow-lg"
          >
            Get Started Today
          </button>
        </div>
      </div>
    </div>
  );
}
