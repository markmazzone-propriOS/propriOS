import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Home, Heart, Search, Calendar, MessageSquare, FileText, TrendingUp, DollarSign, User, Sliders } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface BuyerTutorialProps {
  onClose: () => void;
}

export function BuyerTutorial({ onClose }: BuyerTutorialProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);

  const tutorialSteps = [
    {
      icon: Home,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-100',
      title: 'Welcome to Your Home Buying Journey',
      description: 'This quick tutorial will guide you through all the features available to help you find and purchase your dream home.',
      features: [
        'Search and filter properties',
        'Track your favorites and viewings',
        'Make offers and negotiate',
        'Communicate with agents',
        'Manage documents and signatures'
      ]
    },
    {
      icon: Search,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-100',
      title: 'Search & Discover Properties',
      description: 'Use powerful search tools to find properties that match your criteria.',
      features: [
        'Browse all available properties',
        'Filter by price, bedrooms, bathrooms, and more',
        'View detailed property information and photos',
        'See properties on an interactive map',
        'Save time with smart search preferences'
      ],
      action: 'Navigate to Buy or Rent pages to start searching'
    },
    {
      icon: Heart,
      iconColor: 'text-red-600',
      bgColor: 'bg-red-100',
      title: 'Track Your Favorites',
      description: 'Save properties you love and keep track of what you\'ve seen.',
      features: [
        'Click the heart icon to favorite any property',
        'View all favorites in your dashboard',
        'Track properties you\'ve viewed',
        'Mark properties as rejected to keep your search organized',
        'Get notifications when favorited properties have price changes'
      ],
      action: 'Favorite properties appear in your dashboard'
    },
    {
      icon: Calendar,
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-100',
      title: 'Schedule Property Viewings',
      description: 'Book appointments to tour properties in person.',
      features: [
        'Request viewings directly from property pages',
        'View all scheduled viewings in your calendar',
        'Receive email reminders before viewings',
        'Reschedule or cancel viewings as needed',
        'Agents will confirm your viewing requests'
      ],
      action: 'Access your calendar from the dashboard or navigation menu'
    },
    {
      icon: DollarSign,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-100',
      title: 'Make Offers & Negotiate',
      description: 'Submit offers on properties and track their status.',
      features: [
        'Make offers directly on property pages',
        'Include contingencies and special terms',
        'Track offer status (pending, accepted, rejected, countered)',
        'View offer history for all your submissions',
        'Get notified when sellers respond to your offers'
      ],
      action: 'View all your offers in the dashboard'
    },
    {
      icon: TrendingUp,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-100',
      title: 'Track Your Journey',
      description: 'Monitor your progress through each stage of home buying.',
      features: [
        'See your current stage in the buying process',
        'Track from searching to closing',
        'View important milestones and tasks',
        'See timeline estimates for each stage',
        'Stay organized throughout the entire process'
      ],
      action: 'Journey tracker is visible on your dashboard'
    },
    {
      icon: MessageSquare,
      iconColor: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
      title: 'Communicate with Agents',
      description: 'Message your agent or sellers directly through the platform.',
      features: [
        'Send and receive messages in real-time',
        'Contact agents from their profiles',
        'Message sellers about specific properties',
        'Get notifications for new messages',
        'Keep all communication in one place'
      ],
      action: 'Access messages from the navigation menu'
    },
    {
      icon: FileText,
      iconColor: 'text-orange-600',
      bgColor: 'bg-orange-100',
      title: 'Manage Documents & Signatures',
      description: 'Upload, organize, and sign important documents.',
      features: [
        'Upload and store important documents securely',
        'Sign documents electronically',
        'Get notified when documents need your signature',
        'Track document status and history',
        'Share documents with your agent'
      ],
      action: 'Access documents from your dashboard or navigation menu'
    },
    {
      icon: Sliders,
      iconColor: 'text-teal-600',
      bgColor: 'bg-teal-100',
      title: 'Set Your Search Preferences',
      description: 'Save your criteria to get personalized property recommendations.',
      features: [
        'Set price range, bedrooms, bathrooms',
        'Choose preferred locations',
        'Specify property types (house, condo, etc.)',
        'Add desired features and amenities',
        'Update preferences anytime'
      ],
      action: 'Click "Search Preferences" on your dashboard'
    },
    {
      icon: User,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-100',
      title: 'Work with a Real Estate Agent',
      description: 'Get professional help throughout your home buying journey.',
      features: [
        'Browse and connect with local agents',
        'View agent profiles, ratings, and reviews',
        'Get assigned an agent for personalized service',
        'Receive expert advice and market insights',
        'Let agents handle negotiations and paperwork'
      ],
      action: 'Explore agents from the Agents page'
    }
  ];

  const handleClose = async () => {
    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ tutorial_completed: true })
          .eq('id', user.id);
      } catch (error) {
        console.error('Error updating tutorial status:', error);
      }
    }
    onClose();
  };

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = tutorialSteps[currentStep];
  const Icon = step.icon;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 ${step.bgColor} rounded-lg flex items-center justify-center`}>
              <Icon className={step.iconColor} size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{step.title}</h2>
              <p className="text-sm text-gray-500">
                Step {currentStep + 1} of {tutorialSteps.length}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
            aria-label="Close tutorial"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">{step.description}</p>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-6 border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-4 text-lg">Key Features:</h3>
            <ul className="space-y-3">
              {step.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold mt-0.5">
                    {index + 1}
                  </div>
                  <span className="text-gray-700 leading-relaxed">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {step.action && (
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 font-medium flex items-center gap-2">
                <TrendingUp size={18} />
                <span>{step.action}</span>
              </p>
            </div>
          )}
        </div>

        <div className="border-t p-6 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              {tutorialSteps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 rounded-full transition-all ${
                    index === currentStep
                      ? 'w-8 bg-blue-600'
                      : index < currentStep
                      ? 'w-2 bg-blue-400'
                      : 'w-2 bg-gray-300'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={handleClose}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              Skip Tutorial
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition ${
                currentStep === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <ChevronLeft size={20} />
              Previous
            </button>
            <button
              onClick={handleNext}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
            >
              {currentStep === tutorialSteps.length - 1 ? (
                <>
                  Get Started
                  <Home size={20} />
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
