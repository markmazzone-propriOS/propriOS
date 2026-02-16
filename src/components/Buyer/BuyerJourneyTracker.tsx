import { useState, useEffect } from 'react';
import { CheckCircle, Circle, Clock, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type JourneyStage = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  date: string | null;
  isCurrent: boolean;
};

type BuyerJourneyProgress = {
  id: string;
  buyer_id: string;
  property_id: string | null;
  current_stage: string;
  pre_approval_completed: boolean;
  pre_approval_date: string | null;
  house_hunting_started: boolean;
  house_hunting_date: string | null;
  offer_submitted: boolean;
  offer_submitted_date: string | null;
  offer_accepted: boolean;
  offer_accepted_date: string | null;
  inspection_completed: boolean;
  inspection_date: string | null;
  appraisal_completed: boolean;
  appraisal_date: string | null;
  loan_approved: boolean;
  loan_approved_date: string | null;
  closing_completed: boolean;
  closing_date: string | null;
};

export function BuyerJourneyTracker() {
  const [progress, setProgress] = useState<BuyerJourneyProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let { data, error } = await supabase
        .from('buyer_journey_progress')
        .select('*')
        .eq('buyer_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const { data: newProgress, error: insertError } = await supabase
          .from('buyer_journey_progress')
          .insert({
            buyer_id: user.id,
            current_stage: 'pre_approval'
          })
          .select()
          .single();

        if (insertError) throw insertError;
        data = newProgress;
      }

      setProgress(data);
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!progress) return;

    setResetting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('buyer_journey_progress')
        .update({
          current_stage: 'pre_approval',
          property_id: null,
          pre_approval_completed: false,
          pre_approval_date: null,
          house_hunting_started: false,
          house_hunting_date: null,
          offer_submitted: false,
          offer_submitted_date: null,
          offer_accepted: false,
          offer_accepted_date: null,
          inspection_completed: false,
          inspection_date: null,
          appraisal_completed: false,
          appraisal_date: null,
          loan_approved: false,
          loan_approved_date: null,
          closing_completed: false,
          closing_date: null
        })
        .eq('id', progress.id);

      if (error) throw error;

      await loadProgress();
      setShowResetModal(false);
    } catch (error) {
      console.error('Error resetting progress:', error);
      alert('Failed to reset journey tracker. Please try again.');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!progress) return null;

  const stageOrder = [
    'pre_approval',
    'house_hunting',
    'offer_submitted',
    'offer_accepted',
    'inspection',
    'appraisal',
    'loan_approval',
    'closing'
  ];

  const currentStageIndex = stageOrder.indexOf(progress.current_stage);

  const stages: JourneyStage[] = [
    {
      id: 'pre_approval',
      title: 'Pre-Approval',
      description: 'Get mortgage pre-approval',
      completed: progress.pre_approval_completed,
      date: progress.pre_approval_date,
      isCurrent: progress.current_stage === 'pre_approval' && !progress.pre_approval_completed
    },
    {
      id: 'house_hunting',
      title: 'House Hunting',
      description: 'Search for your dream home',
      completed: progress.house_hunting_started,
      date: progress.house_hunting_date,
      isCurrent: progress.current_stage === 'house_hunting' && !progress.house_hunting_started
    },
    {
      id: 'offer_submitted',
      title: 'Offer Submitted',
      description: 'Make an offer on a property',
      completed: progress.offer_submitted,
      date: progress.offer_submitted_date,
      isCurrent: progress.current_stage === 'offer_submitted' && !progress.offer_submitted
    },
    {
      id: 'offer_accepted',
      title: 'Offer Accepted',
      description: 'Seller accepts your offer',
      completed: progress.offer_accepted,
      date: progress.offer_accepted_date,
      isCurrent: progress.current_stage === 'offer_accepted' && !progress.offer_accepted
    },
    {
      id: 'inspection',
      title: 'Inspection',
      description: 'Home inspection completed',
      completed: progress.inspection_completed,
      date: progress.inspection_date,
      isCurrent: progress.current_stage === 'inspection' && !progress.inspection_completed
    },
    {
      id: 'appraisal',
      title: 'Appraisal',
      description: 'Property appraisal completed',
      completed: progress.appraisal_completed,
      date: progress.appraisal_date,
      isCurrent: progress.current_stage === 'appraisal' && !progress.appraisal_completed
    },
    {
      id: 'loan_approval',
      title: 'Loan Approval',
      description: 'Final loan approval',
      completed: progress.loan_approved,
      date: progress.loan_approved_date,
      isCurrent: progress.current_stage === 'loan_approval' && !progress.loan_approved
    },
    {
      id: 'closing',
      title: 'Closing',
      description: 'Final paperwork and keys',
      completed: progress.closing_completed,
      date: progress.closing_date,
      isCurrent: progress.current_stage === 'closing' && !progress.closing_completed
    }
  ];

  const completedCount = stages.filter(s => s.completed).length;
  const progressPercentage = (completedCount / stages.length) * 100;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg shadow-md p-6 mb-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Your Home Buying Journey</h2>
          <p className="text-gray-600">Track your progress from pre-approval to closing</p>
        </div>
        <button
          onClick={() => setShowResetModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          <RotateCcw size={16} />
          Reset Journey
        </button>
      </div>

      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Overall Progress</span>
          <span className="text-sm font-medium text-blue-600">{completedCount} of {stages.length} steps completed</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      <div className="relative">
        <div className="hidden md:block absolute top-12 left-0 right-0 h-0.5 bg-gray-200" style={{ top: '2rem' }}></div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {stages.map((stage, index) => (
            <div key={stage.id} className="relative">
              <div className="flex flex-col items-center text-center">
                <div className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center mb-3 transition-all ${
                  stage.completed
                    ? 'bg-green-500 text-white shadow-lg'
                    : stage.isCurrent
                    ? 'bg-blue-500 text-white shadow-lg animate-pulse'
                    : 'bg-gray-200 text-gray-400'
                }`}>
                  {stage.completed ? (
                    <CheckCircle size={32} />
                  ) : stage.isCurrent ? (
                    <Clock size={32} />
                  ) : (
                    <Circle size={32} />
                  )}
                </div>

                <h3 className={`font-semibold text-sm mb-1 ${
                  stage.completed ? 'text-green-600' : stage.isCurrent ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {stage.title}
                </h3>

                <p className="text-xs text-gray-500 mb-1">{stage.description}</p>

                {stage.date && (
                  <p className="text-xs text-gray-400">
                    {new Date(stage.date).toLocaleDateString()}
                  </p>
                )}

                {stage.isCurrent && !stage.completed && (
                  <span className="mt-2 inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                    In Progress
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {progress.current_stage === 'completed' && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
          <p className="text-green-800 font-semibold">Congratulations! You've completed your home buying journey! 🎉</p>
        </div>
      )}

      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Reset Journey Tracker?</h3>
            <p className="text-gray-600 mb-6">
              This will reset all your progress and start your home buying journey from the beginning.
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowResetModal(false)}
                disabled={resetting}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {resetting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Resetting...
                  </>
                ) : (
                  <>
                    <RotateCcw size={16} />
                    Reset Journey
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
