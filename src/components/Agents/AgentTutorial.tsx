import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Home, Calendar, Users, FileText, MessageSquare, TrendingUp, CheckCircle } from 'lucide-react';

interface AgentTutorialProps {
  onComplete: () => void;
  onSkip: () => void;
}

interface TutorialStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  image?: string;
  features: string[];
}

export default function AgentTutorial({ onComplete, onSkip }: AgentTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps: TutorialStep[] = [
    {
      title: 'Welcome to Your Agent Dashboard',
      description: 'Your central hub for managing all aspects of your real estate business. Let\'s take a quick tour of what you can do.',
      icon: <Home size={48} className="text-blue-600" />,
      image: '/Journey Tracker.png',
      features: [
        'View all your active listings at a glance',
        'Track pending offers and buyer interest',
        'Monitor your performance metrics',
        'Access quick actions for common tasks'
      ]
    },
    {
      title: 'Manage Your Listings',
      description: 'Create and manage property listings with ease. Add photos, detailed descriptions, and connect with potential buyers.',
      icon: <Home size={48} className="text-green-600" />,
      image: '/Listing Details Page.png',
      features: [
        'Create detailed property listings with photos',
        'Track views, favorites, and scheduled viewings',
        'Update prices and notify interested buyers',
        'View comprehensive listing analytics'
      ]
    },
    {
      title: 'Calendar & Scheduling',
      description: 'Keep track of property viewings, client meetings, and important deadlines all in one place.',
      icon: <Calendar size={48} className="text-orange-600" />,
      image: '/Buyer Viewing Scheduling.png',
      features: [
        'Schedule property viewings with buyers',
        'Manage your appointments and meetings',
        'Send automatic reminders to clients',
        'Sync with your personal calendar'
      ]
    },
    {
      title: 'Client & Prospect Management',
      description: 'Build and nurture relationships with buyers, sellers, and prospects using our CRM tools.',
      icon: <Users size={48} className="text-purple-600" />,
      image: '/Buyer Favorites Tracking.png',
      features: [
        'Track all your clients and prospects',
        'Log activities and follow-ups',
        'Set reminders for important contacts',
        'View client journey progress'
      ]
    },
    {
      title: 'Offers & Negotiations',
      description: 'Manage all incoming offers and guide your clients through the negotiation process.',
      icon: <FileText size={48} className="text-red-600" />,
      image: '/Offer Management.png',
      features: [
        'Review and respond to buyer offers',
        'Track offer status and history',
        'Collaborate with sellers on decisions',
        'Access digital document signing'
      ]
    },
    {
      title: 'Messaging & Communication',
      description: 'Stay connected with clients, buyers, and team members through our integrated messaging system.',
      icon: <MessageSquare size={48} className="text-teal-600" />,
      image: '/Seller Messages.png',
      features: [
        'Direct messaging with clients',
        'Group conversations with your team',
        'Share properties and documents',
        'Receive real-time notifications'
      ]
    },
    {
      title: 'Analytics & Insights',
      description: 'Make data-driven decisions with comprehensive analytics about your listings and performance.',
      icon: <TrendingUp size={48} className="text-indigo-600" />,
      image: '/Listing Analytics.png',
      features: [
        'Track listing views and engagement',
        'Monitor buyer interest trends',
        'Analyze market performance',
        'Generate reports for clients'
      ]
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleDotClick = (index: number) => {
    setCurrentStep(index);
  };

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 relative">
          <button
            onClick={onSkip}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition"
            aria-label="Close tutorial"
          >
            <X size={24} />
          </button>
          <div className="flex items-center gap-4">
            {currentStepData.icon}
            <div>
              <h2 className="text-2xl font-bold">{currentStepData.title}</h2>
              <p className="text-blue-100 mt-1">Step {currentStep + 1} of {steps.length}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-280px)]">
          <p className="text-gray-700 text-lg mb-6">{currentStepData.description}</p>

          {currentStepData.image && (
            <div className="mb-6 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
              <img
                src={currentStepData.image}
                alt={currentStepData.title}
                className="w-full h-auto"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <CheckCircle size={20} className="text-blue-600" />
              Key Features:
            </h3>
            <ul className="space-y-3">
              {currentStepData.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3 text-gray-700">
                  <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-semibold">
                    {index + 1}
                  </div>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {isLastStep && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                <CheckCircle size={20} className="text-green-600" />
                You're All Set!
              </h3>
              <p className="text-green-700">
                You now have an overview of all the powerful tools at your disposal. Click "Get Started" to begin using the platform and growing your real estate business.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          {/* Progress Dots */}
          <div className="flex justify-center gap-2 mb-4">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => handleDotClick(index)}
                className={`w-3 h-3 rounded-full transition ${
                  index === currentStep
                    ? 'bg-blue-600 w-8'
                    : index < currentStep
                    ? 'bg-blue-400 hover:bg-blue-500'
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium"
            >
              <ChevronLeft size={20} />
              Previous
            </button>

            <button
              onClick={onSkip}
              className="text-gray-600 hover:text-gray-800 transition font-medium"
            >
              Skip Tutorial
            </button>

            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium"
            >
              {isLastStep ? (
                <>
                  Get Started
                  <CheckCircle size={20} />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight size={20} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
