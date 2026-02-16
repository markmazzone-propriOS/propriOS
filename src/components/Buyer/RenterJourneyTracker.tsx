import { useState, useEffect } from 'react';
import { CheckCircle, Circle, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type JourneyStage = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  date: string | null;
  isCurrent: boolean;
};

type RenterJourneyProgress = {
  id: string;
  renter_id: string;
  property_id: string | null;
  current_stage: string;
  budget_determined: boolean;
  budget_determined_date: string | null;
  property_search_started: boolean;
  property_search_date: string | null;
  viewing_scheduled: boolean;
  viewing_scheduled_date: string | null;
  application_submitted: boolean;
  application_submitted_date: string | null;
  background_check_completed: boolean;
  background_check_date: string | null;
  lease_signed: boolean;
  lease_signed_date: string | null;
  deposit_paid: boolean;
  deposit_paid_date: string | null;
  move_in_inspection: boolean;
  move_in_inspection_date: string | null;
};

export function RenterJourneyTracker() {
  const [progress, setProgress] = useState<RenterJourneyProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgress();

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('renter-journey-progress')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'renter_journey_progress',
            filter: `renter_id=eq.${user.id}`,
          },
          () => {
            loadProgress();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupSubscription();
  }, []);

  const loadProgress = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let { data, error } = await supabase
        .from('renter_journey_progress')
        .select('*')
        .eq('renter_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const { data: newProgress, error: insertError } = await supabase
          .from('renter_journey_progress')
          .insert({
            renter_id: user.id,
            current_stage: 'budget_determination'
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
    'budget_determination',
    'property_search',
    'viewing_scheduled',
    'application_submitted',
    'background_check',
    'lease_signing',
    'deposit_payment',
    'move_in_inspection'
  ];

  const currentStageIndex = stageOrder.indexOf(progress.current_stage);

  const stages: JourneyStage[] = [
    {
      id: 'budget_determination',
      title: 'Budget & Requirements',
      description: 'Determine rental budget',
      completed: progress.budget_determined || currentStageIndex > 0,
      date: progress.budget_determined_date,
      isCurrent: progress.current_stage === 'budget_determination'
    },
    {
      id: 'property_search',
      title: 'Property Search',
      description: 'Browse available rentals',
      completed: progress.property_search_started || currentStageIndex > 1,
      date: progress.property_search_date,
      isCurrent: progress.current_stage === 'property_search'
    },
    {
      id: 'viewing_scheduled',
      title: 'Schedule Viewings',
      description: 'Book property tours',
      completed: progress.viewing_scheduled || currentStageIndex > 2,
      date: progress.viewing_scheduled_date,
      isCurrent: progress.current_stage === 'viewing_scheduled'
    },
    {
      id: 'application_submitted',
      title: 'Application Submitted',
      description: 'Submit rental application',
      completed: progress.application_submitted || currentStageIndex > 3,
      date: progress.application_submitted_date,
      isCurrent: progress.current_stage === 'application_submitted'
    },
    {
      id: 'background_check',
      title: 'Background Check',
      description: 'Credit & employment verification',
      completed: progress.background_check_completed || currentStageIndex > 4,
      date: progress.background_check_date,
      isCurrent: progress.current_stage === 'background_check'
    },
    {
      id: 'lease_signing',
      title: 'Lease Signing',
      description: 'Review and sign lease',
      completed: progress.lease_signed || currentStageIndex > 5,
      date: progress.lease_signed_date,
      isCurrent: progress.current_stage === 'lease_signing'
    },
    {
      id: 'deposit_payment',
      title: 'Security Deposit',
      description: 'Pay deposit and first month',
      completed: progress.deposit_paid || currentStageIndex > 6,
      date: progress.deposit_paid_date,
      isCurrent: progress.current_stage === 'deposit_payment'
    },
    {
      id: 'move_in_inspection',
      title: 'Move-In Inspection',
      description: 'Document property condition',
      completed: progress.move_in_inspection,
      date: progress.move_in_inspection_date,
      isCurrent: progress.current_stage === 'move_in_inspection'
    }
  ];

  const completedCount = stages.filter(s => s.completed).length;
  const progressPercentage = (completedCount / stages.length) * 100;

  // Calculate visual progress bar width to stop at the last completed stage
  // This ensures the bar doesn't extend past the completed circles
  const visualProgressPercentage = completedCount > 0
    ? ((completedCount - 1) / (stages.length - 1)) * 100
    : 0;

  // Debug logging
  console.log('Renter Journey Debug:', {
    currentStage: progress.current_stage,
    currentStageIndex,
    completedCount,
    progressPercentage,
    visualProgressPercentage,
    progressData: {
      viewing_scheduled: progress.viewing_scheduled,
      property_search_started: progress.property_search_started,
      budget_determined: progress.budget_determined
    },
    stages: stages.map(s => ({ id: s.id, completed: s.completed, isCurrent: s.isCurrent }))
  });

  return (
    <div className="bg-gradient-to-br from-green-50 to-white rounded-lg shadow-md p-6 mb-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Your Rental Journey</h2>
        <p className="text-gray-600">Track your progress from search to move-in</p>
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

      {progress.current_stage === 'completed' && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
          <p className="text-green-800 font-semibold">Congratulations! You've completed your rental journey!</p>
        </div>
      )}
    </div>
  );
}
