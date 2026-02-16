import { useState, useEffect } from 'react';
import { CheckSquare, Square, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type ChecklistItem = {
  id: string;
  label: string;
  completed: boolean;
  notes?: string;
};

type ComplianceChecklist = {
  id: string;
  application_id: string;
  checklist_name: string;
  items: ChecklistItem[];
  completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
};

const DEFAULT_CHECKLISTS = [
  {
    name: 'Initial Application Review',
    items: [
      { label: 'Verify borrower identity', completed: false },
      { label: 'Check credit report authorization', completed: false },
      { label: 'Review income documentation', completed: false },
      { label: 'Verify employment', completed: false },
      { label: 'Assess debt-to-income ratio', completed: false }
    ]
  },
  {
    name: 'Underwriting Checklist',
    items: [
      { label: 'Property appraisal ordered', completed: false },
      { label: 'Title search completed', completed: false },
      { label: 'Homeowners insurance verified', completed: false },
      { label: 'Review assets and reserves', completed: false },
      { label: 'Verify down payment source', completed: false },
      { label: 'Check for any red flags', completed: false }
    ]
  },
  {
    name: 'Final Approval',
    items: [
      { label: 'All conditions satisfied', completed: false },
      { label: 'Final credit check completed', completed: false },
      { label: 'Closing disclosure sent', completed: false },
      { label: 'Loan documents prepared', completed: false },
      { label: 'Funding approval obtained', completed: false }
    ]
  }
];

const CHECKLIST_ORDER = [
  'Initial Application Review',
  'Underwriting Checklist',
  'Final Approval'
];

export function ComplianceChecklist({ applicationId }: { applicationId: string }) {
  const { user } = useAuth();
  const [checklists, setChecklists] = useState<ComplianceChecklist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChecklists();
  }, [applicationId]);

  const loadChecklists = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('compliance_checklists')
        .select('*')
        .eq('application_id', applicationId);

      if (error) throw error;

      if (!data || data.length === 0) {
        await initializeChecklists();
      } else {
        // Sort checklists by the defined order
        const sortedData = data.sort((a, b) => {
          const indexA = CHECKLIST_ORDER.indexOf(a.checklist_name);
          const indexB = CHECKLIST_ORDER.indexOf(b.checklist_name);
          return indexA - indexB;
        });
        setChecklists(sortedData);
      }
    } catch (err) {
      console.error('Error loading checklists:', err);
    } finally {
      setLoading(false);
    }
  };

  const initializeChecklists = async () => {
    try {
      const { error } = await supabase
        .from('compliance_checklists')
        .insert(
          DEFAULT_CHECKLISTS.map((checklist) => ({
            application_id: applicationId,
            checklist_name: checklist.name,
            items: checklist.items.map((item, index) => ({
              id: `${index}`,
              ...item
            })),
            completed: false
          }))
        );

      if (error) throw error;
      loadChecklists();
    } catch (err) {
      console.error('Error initializing checklists:', err);
    }
  };

  const toggleItem = async (checklistId: string, itemId: string) => {
    const checklist = checklists.find((c) => c.id === checklistId);
    if (!checklist) return;

    const updatedItems = checklist.items.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );

    const allCompleted = updatedItems.every((item) => item.completed);

    try {
      const updateData: any = {
        items: updatedItems,
        completed: allCompleted
      };

      if (allCompleted && !checklist.completed) {
        updateData.completed_by = user!.id;
        updateData.completed_at = new Date().toISOString();
      } else if (!allCompleted && checklist.completed) {
        updateData.completed_by = null;
        updateData.completed_at = null;
      }

      const { error } = await supabase
        .from('compliance_checklists')
        .update(updateData)
        .eq('id', checklistId);

      if (error) throw error;
      loadChecklists();
    } catch (err) {
      console.error('Error updating checklist:', err);
    }
  };

  const getProgress = (items: ChecklistItem[]) => {
    const completed = items.filter((item) => item.completed).length;
    return Math.round((completed / items.length) * 100);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-600">Loading checklists...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Compliance Checklists</h3>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>
            {checklists.filter((c) => c.completed).length} of {checklists.length} completed
          </span>
        </div>
      </div>

      {checklists.map((checklist) => {
        const progress = getProgress(checklist.items);

        return (
          <div key={checklist.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-800">{checklist.checklist_name}</h4>
                {checklist.completed ? (
                  <span className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    <CheckCircle size={16} />
                    Complete
                  </span>
                ) : (
                  <span className="flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                    <AlertCircle size={16} />
                    In Progress
                  </span>
                )}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    checklist.completed ? 'bg-green-600' : 'bg-blue-600'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-1">{progress}% complete</p>
            </div>

            <div className="p-6">
              <div className="space-y-3">
                {checklist.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition cursor-pointer"
                    onClick={() => toggleItem(checklist.id, item.id)}
                  >
                    {item.completed ? (
                      <CheckSquare size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Square size={20} className="text-gray-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p
                        className={`text-sm ${
                          item.completed
                            ? 'text-gray-500 line-through'
                            : 'text-gray-800 font-medium'
                        }`}
                      >
                        {item.label}
                      </p>
                      {item.notes && (
                        <p className="text-xs text-gray-500 mt-1">{item.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {checklist.completed && checklist.completed_at && (
              <div className="bg-green-50 px-6 py-3 border-t border-green-100">
                <p className="text-sm text-green-800">
                  Completed on {new Date(checklist.completed_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
