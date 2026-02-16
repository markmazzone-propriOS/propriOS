import { useState, useEffect } from 'react';
import { X, Check, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type SellerJourneyProgress = {
  id: string;
  seller_id: string;
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

type UpdateSellerProgressProps = {
  sellerId: string;
  sellerName: string;
  onClose: () => void;
};

export function UpdateSellerProgress({ sellerId, sellerName, onClose }: UpdateSellerProgressProps) {
  const [progress, setProgress] = useState<SellerJourneyProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadProgress();
  }, [sellerId]);

  const loadProgress = async () => {
    try {
      console.log('Loading seller journey progress for seller:', sellerId);

      // Get the most recent journey progress (prioritize NULL property_id as general progress)
      const { data: journeys, error } = await supabase
        .from('seller_journey_progress')
        .select('*')
        .eq('seller_id', sellerId)
        .order('property_id', { nullsFirst: true })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading seller journey:', error);
        throw error;
      }

      console.log('Seller journey data:', journeys);

      let data = journeys && journeys.length > 0 ? journeys[0] : null;

      if (!data) {
        console.log('No journey found, creating new one...');
        const { data: newProgress, error: insertError } = await supabase
          .from('seller_journey_progress')
          .insert({
            seller_id: sellerId,
            current_stage: 'preparation'
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating seller journey:', insertError);
          throw insertError;
        }
        data = newProgress;
        console.log('Created new journey:', data);
      }

      setProgress(data);
    } catch (error: any) {
      console.error('Caught error in loadProgress:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStageUpdate = async (stage: string, completed: boolean) => {
    if (!progress) return;

    setSaving(true);
    setError('');

    try {
      const updates: any = {};
      const dateField = `${stage}_date`;

      updates[stage] = completed;
      updates[dateField] = completed ? new Date().toISOString() : null;

      if (completed) {
        updates.current_stage = getNextStage(stage);
      }

      const { error: updateError } = await supabase
        .from('seller_journey_progress')
        .update(updates)
        .eq('id', progress.id);

      if (updateError) throw updateError;

      await loadProgress();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const getNextStage = (currentStage: string): string => {
    const stages = [
      'preparation',
      'listed',
      'showings',
      'offer_received',
      'under_contract',
      'inspection',
      'appraisal',
      'final_steps_closing'
    ];

    const currentIndex = stages.indexOf(currentStage);
    if (currentIndex < stages.length - 1) {
      return stages[currentIndex + 1];
    }
    return 'final_steps_closing';
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!progress) return null;

  const stages = [
    {
      id: 'preparation',
      title: 'Preparation',
      description: 'Getting property ready to list',
      completed: progress.preparation_completed,
      date: progress.preparation_date
    },
    {
      id: 'listed',
      title: 'Listed',
      description: 'Property is on the market',
      completed: progress.listed,
      date: progress.listed_date
    },
    {
      id: 'showings',
      title: 'Showings',
      description: 'Actively showing property',
      completed: progress.showings_started,
      date: progress.showings_date
    },
    {
      id: 'offer_received',
      title: 'Offer Received',
      description: 'Evaluating buyer offers',
      completed: progress.offer_received,
      date: progress.offer_received_date
    },
    {
      id: 'under_contract',
      title: 'Under Contract',
      description: 'Offer accepted',
      completed: progress.under_contract,
      date: progress.under_contract_date
    },
    {
      id: 'inspection',
      title: 'Inspection',
      description: 'Property inspection',
      completed: progress.inspection_completed,
      date: progress.inspection_date
    },
    {
      id: 'appraisal',
      title: 'Appraisal',
      description: 'Property appraisal',
      completed: progress.appraisal_completed,
      date: progress.appraisal_date
    },
    {
      id: 'final_steps_closing',
      title: 'Final Steps & Closing',
      description: 'Finalizing and closing sale',
      completed: progress.closing_completed,
      date: progress.closing_date
    }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Update Seller Progress</h2>
            <p className="text-gray-600 mt-1">{sellerName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {stages.map((stage) => (
              <div
                key={stage.id}
                className={`p-4 border-2 rounded-lg transition ${
                  progress.current_stage === stage.id
                    ? 'border-blue-500 bg-blue-50'
                    : stage.completed
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {stage.completed ? (
                        <Check className="text-green-600" size={20} />
                      ) : progress.current_stage === stage.id ? (
                        <Clock className="text-blue-600" size={20} />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                      )}
                      <h3 className="font-semibold text-gray-800">{stage.title}</h3>
                      {progress.current_stage === stage.id && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 ml-7">{stage.description}</p>
                    {stage.date && (
                      <p className="text-xs text-gray-400 ml-7 mt-1">
                        {new Date(stage.date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {stage.completed ? (
                    <div className="px-4 py-2 rounded-lg font-medium bg-green-100 text-green-700 flex items-center gap-2">
                      <Check size={18} />
                      Completed
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStageUpdate(stage.id, true)}
                      disabled={saving}
                      className="px-4 py-2 rounded font-medium transition disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Mark Complete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Current Stage: <span className="font-semibold capitalize">{progress.current_stage.replace(/_/g, ' ')}</span>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
