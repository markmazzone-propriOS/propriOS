import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Circle,
  Plus,
  Calendar,
  AlertCircle,
  Trash2,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useRouter } from '../Navigation/Router';

type ChecklistItem = {
  id: string;
  seller_id: string;
  property_id: string | null;
  item_name: string;
  description: string | null;
  category: string;
  is_completed: boolean;
  completed_at: string | null;
  due_date: string | null;
  sort_order: number;
  is_required: boolean;
  created_at: string;
  updated_at: string;
};

type GroupedItems = {
  [category: string]: ChecklistItem[];
};

const categoryOrder = [
  'Legal',
  'Financial',
  'Property Preparation',
  'Documentation',
  'Final Walkthrough',
  'Utilities',
  'Moving',
  'Post-Closing'
];

export function SellerClosingChecklist() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentRoute } = useRouter();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [generatingChecklist, setGeneratingChecklist] = useState(false);

  const propertyId = currentRoute.params?.propertyId;
  const propertyAddress = currentRoute.params?.address;

  useEffect(() => {
    if (propertyId && user) {
      loadChecklistItems();

      const channel = supabase
        .channel('seller-closing-checklist-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'seller_closing_checklist_items',
            filter: `seller_id=eq.${user.id}`,
          },
          () => {
            loadChecklistItems();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, propertyId]);

  const loadChecklistItems = async () => {
    if (!user || !propertyId) return;

    try {
      const { data, error } = await supabase
        .from('seller_closing_checklist_items')
        .select('*')
        .eq('seller_id', user.id)
        .eq('property_id', propertyId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading checklist:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateDefaultChecklist = async () => {
    if (!user || !propertyId) return;

    setGeneratingChecklist(true);
    try {
      const { error } = await supabase.rpc('create_default_seller_closing_checklist', {
        p_seller_id: user.id,
        p_property_id: propertyId
      });

      if (error) throw error;
      await loadChecklistItems();
    } catch (error) {
      console.error('Error generating checklist:', error);
      alert('Failed to generate checklist. Please try again.');
    } finally {
      setGeneratingChecklist(false);
    }
  };

  const toggleItemCompletion = async (item: ChecklistItem) => {
    try {
      const newCompletedState = !item.is_completed;
      const { error } = await supabase
        .from('seller_closing_checklist_items')
        .update({
          is_completed: newCompletedState,
          completed_at: newCompletedState ? new Date().toISOString() : null
        })
        .eq('id', item.id);

      if (error) throw error;
      await loadChecklistItems();
    } catch (error) {
      console.error('Error updating item:', error);
      alert('Failed to update item. Please try again.');
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const { error } = await supabase
        .from('seller_closing_checklist_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item. Please try again.');
    }
  };

  const groupItemsByCategory = (items: ChecklistItem[]): GroupedItems => {
    return items.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as GroupedItems);
  };

  const calculateProgress = () => {
    const requiredItems = items.filter(item => item.is_required);
    const completedRequired = requiredItems.filter(item => item.is_completed);
    const totalItems = items.length;
    const completedItems = items.filter(item => item.is_completed).length;

    return {
      requiredCompleted: completedRequired.length,
      requiredTotal: requiredItems.length,
      totalCompleted: completedItems,
      totalItems: totalItems,
      percentage: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0
    };
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  if (!propertyId) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition"
        >
          <ArrowLeft size={20} />
          Back to Dashboard
        </button>
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <AlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Property Selected
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Please select a property from your dashboard to view its closing checklist.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition"
        >
          <ArrowLeft size={20} />
          Back to Dashboard
        </button>
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <AlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Closing Checklist Yet
          </h3>
          <p className="text-gray-600 mb-4 max-w-md mx-auto">
            Generate a comprehensive closing checklist to help you track all the important tasks before closing on your property sale.
          </p>
          {propertyAddress && (
            <p className="text-sm text-gray-500 mb-6">
              Property: {propertyAddress}
            </p>
          )}
          <button
            onClick={generateDefaultChecklist}
            disabled={generatingChecklist}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {generatingChecklist ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="animate-spin" size={20} />
                Generating...
              </span>
            ) : (
              'Generate Closing Checklist'
            )}
          </button>
        </div>
      </div>
    );
  }

  const progress = calculateProgress();
  const groupedItems = groupItemsByCategory(items);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition"
      >
        <ArrowLeft size={20} />
        Back to Dashboard
      </button>

      <div className="space-y-6">
        <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg shadow-sm p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">Closing Checklist</h2>
            {propertyAddress && (
              <p className="text-green-100 text-sm mb-1">
                {propertyAddress}
              </p>
            )}
            <p className="text-green-100">
              Complete all required items before your closing date
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
          >
            <Plus size={20} />
            Add Item
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span className="font-semibold">{progress.totalCompleted} of {progress.totalItems} completed</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-3">
            <div
              className="bg-white rounded-full h-3 transition-all duration-500"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>

          {progress.requiredTotal > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle size={16} />
              <span>
                {progress.requiredCompleted} of {progress.requiredTotal} required items completed
              </span>
            </div>
          )}
        </div>
      </div>

      {categoryOrder.map(category => {
        const categoryItems = groupedItems[category];
        if (!categoryItems || categoryItems.length === 0) return null;

        const completedCount = categoryItems.filter(item => item.is_completed).length;

        return (
          <div key={category} className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="bg-gray-50 border-b px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{category}</h3>
                <span className="text-sm text-gray-600">
                  {completedCount} / {categoryItems.length}
                </span>
              </div>
            </div>

            <div className="divide-y">
              {categoryItems.map(item => (
                <div
                  key={item.id}
                  className={`p-6 hover:bg-gray-50 transition ${
                    item.is_completed ? 'bg-green-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <button
                      onClick={() => toggleItemCompletion(item)}
                      className={`flex-shrink-0 mt-1 ${
                        item.is_completed
                          ? 'text-green-600'
                          : 'text-gray-400 hover:text-gray-600'
                      } transition`}
                    >
                      {item.is_completed ? (
                        <CheckCircle2 size={24} />
                      ) : (
                        <Circle size={24} />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <div className="flex-1">
                          <h4 className={`font-medium ${
                            item.is_completed
                              ? 'text-gray-500 line-through'
                              : 'text-gray-900'
                          }`}>
                            {item.item_name}
                            {item.is_required && (
                              <span className="ml-2 text-red-600 text-sm">*Required</span>
                            )}
                          </h4>
                          {item.description && (
                            <p className="text-sm text-gray-600 mt-1">
                              {item.description}
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => deleteItem(item.id)}
                          className="text-gray-400 hover:text-red-600 transition p-1"
                          title="Delete item"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-sm">
                        {item.completed_at && (
                          <span className="text-green-600 flex items-center gap-1">
                            <CheckCircle2 size={14} />
                            Completed {formatDate(item.completed_at)}
                          </span>
                        )}
                        {item.due_date && !item.is_completed && (
                          <span className={`flex items-center gap-1 ${
                            isOverdue(item.due_date)
                              ? 'text-red-600 font-medium'
                              : 'text-gray-600'
                          }`}>
                            <Calendar size={14} />
                            Due {formatDate(item.due_date)}
                            {isOverdue(item.due_date) && ' (Overdue)'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

        {showAddModal && (
          <AddItemModal
            propertyId={propertyId}
            onClose={() => setShowAddModal(false)}
            onItemAdded={() => {
              loadChecklistItems();
              setShowAddModal(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

type AddItemModalProps = {
  propertyId: string;
  onClose: () => void;
  onItemAdded: () => void;
};

function AddItemModal({ propertyId, onClose, onItemAdded }: AddItemModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    item_name: '',
    description: '',
    category: 'Documentation',
    is_required: false,
    due_date: ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.item_name.trim()) return;

    setSaving(true);
    try {
      const { data: maxSortOrder } = await supabase
        .from('seller_closing_checklist_items')
        .select('sort_order')
        .eq('seller_id', user.id)
        .eq('property_id', propertyId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { error } = await supabase
        .from('seller_closing_checklist_items')
        .insert({
          seller_id: user.id,
          property_id: propertyId,
          item_name: formData.item_name.trim(),
          description: formData.description.trim() || null,
          category: formData.category,
          is_required: formData.is_required,
          due_date: formData.due_date || null,
          sort_order: (maxSortOrder?.sort_order || 0) + 1
        });

      if (error) throw error;
      onItemAdded();
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Failed to add item. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Add Checklist Item</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Item Name *
            </label>
            <input
              type="text"
              value={formData.item_name}
              onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category *
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              {categoryOrder.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Due Date
            </label>
            <input
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_required"
              checked={formData.is_required}
              onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_required" className="ml-2 text-sm text-gray-700">
              This is a required item
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formData.item_name.trim()}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
