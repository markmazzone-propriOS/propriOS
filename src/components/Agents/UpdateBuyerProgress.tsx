import { useState, useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type BuyerJourneyProgress = {
  id: string;
  buyer_id: string;
  current_stage: string;
  pre_approval_completed: boolean;
  house_hunting_started: boolean;
  offer_submitted: boolean;
  offer_accepted: boolean;
  inspection_completed: boolean;
  appraisal_completed: boolean;
  loan_approved: boolean;
  closing_completed: boolean;
};

type UpdateBuyerProgressProps = {
  buyerId: string;
  buyerName: string;
  onClose: () => void;
  onUpdate: () => void;
};

export function UpdateBuyerProgress({ buyerId, buyerName, onClose, onUpdate }: UpdateBuyerProgressProps) {
  const [progress, setProgress] = useState<BuyerJourneyProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProgress();
  }, [buyerId]);

  const loadProgress = async () => {
    try {
      const { data, error } = await supabase
        .from('buyer_journey_progress')
        .select('*')
        .eq('buyer_id', buyerId)
        .maybeSingle();

      if (error) throw error;
      console.log('Loaded buyer progress:', data);
      setProgress(data);
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (field: string, value: boolean) => {
    if (!progress) return;

    setSaving(true);
    try {
      let dateField: string;
      if (field.endsWith('_completed')) {
        dateField = field.replace('_completed', '_date');
      } else {
        dateField = field + '_date';
      }

      const updates: any = {
        [field]: value,
        [dateField]: value ? new Date().toISOString() : null
      };

      const { error } = await supabase
        .from('buyer_journey_progress')
        .update(updates)
        .eq('id', progress.id);

      if (error) throw error;

      await loadProgress();
      onUpdate();
    } catch (error) {
      console.error('Error updating progress:', error);
      alert('Failed to update progress');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-2xl w-full p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="space-y-3">
              <div className="h-12 bg-gray-200 rounded"></div>
              <div className="h-12 bg-gray-200 rounded"></div>
              <div className="h-12 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-2xl w-full p-6">
          <div className="text-center">
            <p className="text-gray-600 mb-4">No progress record found for this buyer</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const stages = [
    { field: 'pre_approval_completed', label: 'Pre-Approval Completed', description: 'Buyer has mortgage pre-approval' },
    { field: 'inspection_completed', label: 'Home Inspection Completed', description: 'Property inspection has been done' },
    { field: 'appraisal_completed', label: 'Appraisal Completed', description: 'Property appraisal has been done' },
    { field: 'loan_approved', label: 'Final Loan Approval', description: 'Mortgage lender approved final loan' },
    { field: 'closing_completed', label: 'Closing Completed', description: 'Final paperwork and keys handed over' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Update Buyer Progress</h2>
            <p className="text-gray-600 text-sm mt-1">{buyerName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              Current Stage: <strong className="capitalize">{progress.current_stage.replace('_', ' ')}</strong>
            </p>
          </div>

          <div className="space-y-3">
            {stages.map((stage) => {
              const fieldValue = progress[stage.field as keyof BuyerJourneyProgress];
              const isCompleted = Boolean(fieldValue);
              console.log(`Stage ${stage.field}:`, {
                fieldValue,
                type: typeof fieldValue,
                isCompleted,
                rawProgress: progress
              });

              return (
                <div
                  key={stage.field}
                  className={`border rounded-lg p-4 transition-all ${
                    isCompleted ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {isCompleted && <CheckCircle size={20} className="text-green-600" />}
                        <h3 className="font-semibold text-gray-800">{stage.label}</h3>
                      </div>
                      <p className="text-sm text-gray-600">{stage.description}</p>
                    </div>
                    {isCompleted ? (
                      <div className="ml-4 px-4 py-2 rounded-lg font-medium bg-green-100 text-green-700 flex items-center gap-2">
                        <CheckCircle size={18} />
                        Completed
                      </div>
                    ) : (
                      <button
                        onClick={() => handleUpdate(stage.field, true)}
                        disabled={saving}
                        className="ml-4 px-4 py-2 rounded-lg font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Mark Complete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Note:</strong> Some stages are automatically updated when the buyer performs actions
              (viewing properties, submitting offers, etc.). Use this panel to manually update stages that
              require agent verification.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
