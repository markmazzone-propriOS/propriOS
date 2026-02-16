import { useState, useEffect } from 'react';
import { CheckCircle, Circle, Clock, RotateCcw, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type JourneyStage = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  date: string | null;
  isCurrent: boolean;
};

type SellerJourneyProgress = {
  id: string;
  seller_id: string;
  property_id: string | null;
  current_stage: string;
  preparation_completed: boolean;
  preparation_date: string | null;
  listed: boolean;
  listed_date: string | null;
  showings_started: boolean;
  showings_date: string | null;
  offer_received: boolean;
  offer_received_date: string | null;
  under_contract: boolean;
  under_contract_date: string | null;
  inspection_completed: boolean;
  inspection_date: string | null;
  appraisal_completed: boolean;
  appraisal_date: string | null;
  closing_completed: boolean;
  closing_date: string | null;
};

interface PropertyJourneyTrackerProps {
  propertyId: string;
  propertyAddress: string;
  onClose?: () => void;
  compact?: boolean;
}

export function PropertyJourneyTracker({ propertyId, propertyAddress, onClose, compact = false }: PropertyJourneyTrackerProps) {
  const [progress, setProgress] = useState<SellerJourneyProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    loadProgress();
  }, [propertyId]);

  const loadProgress = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      let { data, error } = await supabase
        .from('seller_journey_progress')
        .select('*')
        .eq('seller_id', user.id)
        .eq('property_id', propertyId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading progress:', error);
        setLoading(false);
        return;
      }

      if (!data) {
        const { data: newProgress, error: insertError } = await supabase
          .from('seller_journey_progress')
          .insert({
            seller_id: user.id,
            property_id: propertyId,
            current_stage: 'preparation'
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating progress:', insertError);
          setLoading(false);
          return;
        }
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
      const { error } = await supabase
        .from('seller_journey_progress')
        .update({
          current_stage: 'preparation',
          preparation_completed: false,
          preparation_date: null,
          listed: false,
          listed_date: null,
          showings_started: false,
          showings_date: null,
          offer_received: false,
          offer_received_date: null,
          under_contract: false,
          under_contract_date: null,
          inspection_completed: false,
          inspection_date: null,
          appraisal_completed: false,
          appraisal_date: null,
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
    'preparation',
    'listed',
    'showings',
    'offer_received',
    'under_contract',
    'inspection',
    'appraisal',
    'final_steps_closing'
  ];

  const currentStageIndex = stageOrder.indexOf(progress.current_stage);

  const stages: JourneyStage[] = [
    {
      id: 'preparation',
      title: 'Preparation',
      description: 'Getting property ready to list',
      completed: progress.preparation_completed || currentStageIndex > 0,
      date: progress.preparation_date,
      isCurrent: progress.current_stage === 'preparation'
    },
    {
      id: 'listed',
      title: 'Listed',
      description: 'Property is on the market',
      completed: progress.listed || currentStageIndex > 1,
      date: progress.listed_date,
      isCurrent: progress.current_stage === 'listed'
    },
    {
      id: 'showings',
      title: 'Showings',
      description: 'Actively showing property',
      completed: progress.showings_started || currentStageIndex > 2,
      date: progress.showings_date,
      isCurrent: progress.current_stage === 'showings'
    },
    {
      id: 'offer_received',
      title: 'Offer Received',
      description: 'Evaluating buyer offers',
      completed: progress.offer_received || currentStageIndex > 3,
      date: progress.offer_received_date,
      isCurrent: progress.current_stage === 'offer_received'
    },
    {
      id: 'under_contract',
      title: 'Under Contract',
      description: 'Offer accepted',
      completed: progress.under_contract || currentStageIndex > 4,
      date: progress.under_contract_date,
      isCurrent: progress.current_stage === 'under_contract'
    },
    {
      id: 'inspection',
      title: 'Inspection',
      description: 'Property inspection',
      completed: progress.inspection_completed || currentStageIndex > 5,
      date: progress.inspection_date,
      isCurrent: progress.current_stage === 'inspection'
    },
    {
      id: 'appraisal',
      title: 'Appraisal',
      description: 'Property appraisal',
      completed: progress.appraisal_completed || currentStageIndex > 6,
      date: progress.appraisal_date,
      isCurrent: progress.current_stage === 'appraisal'
    },
    {
      id: 'final_steps_closing',
      title: 'Final Steps & Closing',
      description: 'Finalizing and closing sale',
      completed: progress.closing_completed,
      date: progress.closing_date,
      isCurrent: progress.current_stage === 'final_steps_closing'
    }
  ];

  const completedCount = stages.filter(s => s.completed).length;
  const progressPercentage = (completedCount / stages.length) * 100;

  if (compact) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Selling Progress</span>
          <span className="text-xs font-medium text-green-600">{completedCount}/{stages.length}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div
            className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        <div className="text-xs text-gray-600">
          Current: <span className="font-medium text-blue-600">{stages.find(s => s.isCurrent)?.title}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-green-50 to-white rounded-lg shadow-lg p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Selling Journey</h2>
          <p className="text-gray-600">{propertyAddress}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowResetModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <RotateCcw size={16} />
            Reset
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Overall Progress</span>
          <span className="text-sm font-medium text-green-600">{completedCount} of {stages.length} steps completed</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      <div className="relative">
        <div className="hidden md:block absolute top-12 left-0 right-0 h-0.5 bg-gray-200" style={{ top: '2rem' }}></div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {stages.map((stage) => (
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

      {progress.closing_completed && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
          <p className="text-green-800 font-semibold">Congratulations! This property sale is complete!</p>
        </div>
      )}

      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Reset Journey Tracker?</h3>
            <p className="text-gray-600 mb-6">
              This will reset all progress for this property and start the selling journey from the beginning.
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
