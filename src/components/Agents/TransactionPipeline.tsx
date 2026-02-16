import { useState, useEffect } from 'react';
import { DollarSign, Calendar, User, Building2, TrendingUp, ArrowRight, Plus, X, Edit2, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Transaction {
  id: string;
  agent_id: string;
  client_id: string | null;
  property_id: string | null;
  transaction_type: 'buyer_side' | 'seller_side';
  stage: string;
  status: 'active' | 'won' | 'lost';
  deal_value: number;
  commission_percentage: number;
  commission_amount: number;
  expected_close_date: string | null;
  actual_close_date: string | null;
  notes: string;
  lead_source: string;
  created_at: string;
  updated_at: string;
  stage_updated_at: string;
  client?: { full_name: string };
  property?: { address_line1: string; city: string; state: string; zip_code: string };
}

interface Stage {
  id: string;
  name: string;
  color: string;
}

const PIPELINE_STAGES: Stage[] = [
  { id: 'lead', name: 'Lead', color: 'bg-gray-100 border-gray-300 text-gray-800' },
  { id: 'contact_made', name: 'Contact Made', color: 'bg-blue-100 border-blue-300 text-blue-800' },
  { id: 'showing_scheduled', name: 'Showing Scheduled', color: 'bg-cyan-100 border-cyan-300 text-cyan-800' },
  { id: 'showing_completed', name: 'Showing Done', color: 'bg-teal-100 border-teal-300 text-teal-800' },
  { id: 'offer_preparation', name: 'Preparing Offer', color: 'bg-yellow-100 border-yellow-300 text-yellow-800' },
  { id: 'offer_submitted', name: 'Offer Submitted', color: 'bg-orange-100 border-orange-300 text-orange-800' },
  { id: 'under_contract', name: 'Under Contract', color: 'bg-green-100 border-green-300 text-green-800' },
  { id: 'inspection', name: 'Inspection', color: 'bg-emerald-100 border-emerald-300 text-emerald-800' },
  { id: 'appraisal', name: 'Appraisal', color: 'bg-lime-100 border-lime-300 text-lime-800' },
  { id: 'financing', name: 'Financing', color: 'bg-amber-100 border-amber-300 text-amber-800' },
  { id: 'final_walkthrough', name: 'Final Walkthrough', color: 'bg-green-100 border-green-300 text-green-800' },
  { id: 'closing', name: 'Closing', color: 'bg-blue-100 border-blue-300 text-blue-800' },
];

export function TransactionPipeline() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'buyer_side' | 'seller_side'>('all');
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(PIPELINE_STAGES.map(s => s.id)));

  useEffect(() => {
    loadTransactions();
  }, [user, filterType]);

  const loadTransactions = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from('transactions')
        .select(`
          *,
          client:profiles!transactions_client_id_fkey(full_name),
          property:properties(address_line1, city, state, zip_code)
        `)
        .eq('agent_id', user.id)
        .eq('status', 'active')
        .order('stage_updated_at', { ascending: false });

      if (filterType !== 'all') {
        query = query.eq('transaction_type', filterType);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const moveToStage = async (transactionId: string, newStage: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ stage: newStage })
        .eq('id', transactionId);

      if (error) throw error;
      await loadTransactions();
    } catch (error) {
      console.error('Error moving transaction:', error);
    }
  };

  const toggleStage = (stageId: string) => {
    const newExpanded = new Set(expandedStages);
    if (newExpanded.has(stageId)) {
      newExpanded.delete(stageId);
    } else {
      newExpanded.add(stageId);
    }
    setExpandedStages(newExpanded);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getTransactionsForStage = (stageId: string) => {
    return transactions.filter(t => t.stage === stageId);
  };

  const getTotalValue = (stageId: string) => {
    return getTransactionsForStage(stageId).reduce((sum, t) => sum + (t.deal_value || 0), 0);
  };

  const getTotalCommission = (stageId: string) => {
    return getTransactionsForStage(stageId).reduce((sum, t) => sum + (t.commission_amount || 0), 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Transaction Pipeline</h2>
          <p className="text-gray-600 mt-1">Track deals from lead to close</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-300 p-1">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                filterType === 'all' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('buyer_side')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                filterType === 'buyer_side' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Buyer Side
            </button>
            <button
              onClick={() => setFilterType('seller_side')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                filterType === 'seller_side' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Seller Side
            </button>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            New Transaction
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {PIPELINE_STAGES.map((stage) => {
          const stageTransactions = getTransactionsForStage(stage.id);
          const isExpanded = expandedStages.has(stage.id);
          const totalValue = getTotalValue(stage.id);
          const totalCommission = getTotalCommission(stage.id);

          return (
            <div key={stage.id} className="bg-white rounded-lg border border-gray-200">
              <button
                onClick={() => toggleStage(stage.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                  <span className={`px-3 py-1 rounded-full text-sm font-medium border ${stage.color}`}>
                    {stage.name}
                  </span>
                  <span className="text-sm font-semibold text-gray-700">
                    {stageTransactions.length} {stageTransactions.length === 1 ? 'deal' : 'deals'}
                  </span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-1 text-gray-600">
                    <DollarSign size={16} />
                    <span className="font-medium">{formatCurrency(totalValue)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-600">
                    <TrendingUp size={16} />
                    <span className="font-medium">{formatCurrency(totalCommission)} est. commission</span>
                  </div>
                </div>
              </button>

              {isExpanded && stageTransactions.length > 0 && (
                <div className="px-4 pb-4 space-y-2">
                  {stageTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      onClick={() => {
                        setSelectedTransaction(transaction);
                        setShowDetailsModal(true);
                      }}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-blue-300 hover:shadow-sm transition cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs px-2 py-1 rounded ${
                              transaction.transaction_type === 'buyer_side'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {transaction.transaction_type === 'buyer_side' ? 'Buyer Side' : 'Seller Side'}
                            </span>
                          </div>
                          {transaction.property && (
                            <div className="flex items-center gap-2 text-gray-700 mb-1">
                              <Building2 size={16} className="text-gray-400" />
                              <span className="font-medium">
                                {transaction.property.address_line1}, {transaction.property.city}, {transaction.property.state} {transaction.property.zip_code}
                              </span>
                            </div>
                          )}
                          {transaction.client && (
                            <div className="flex items-center gap-2 text-gray-600 text-sm">
                              <User size={14} className="text-gray-400" />
                              <span>{transaction.client.full_name}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-800">{formatCurrency(transaction.deal_value)}</div>
                          <div className="text-sm text-green-600 font-medium">{formatCurrency(transaction.commission_amount)}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-200">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          <span>Close: {formatDate(transaction.expected_close_date)}</span>
                        </div>
                        {transaction.lead_source && (
                          <span className="text-gray-400">Source: {transaction.lead_source}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showAddModal && (
        <AddTransactionModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadTransactions();
          }}
        />
      )}

      {showDetailsModal && selectedTransaction && (
        <TransactionDetailsModal
          transaction={selectedTransaction}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedTransaction(null);
          }}
          onUpdate={() => {
            loadTransactions();
          }}
          onMove={moveToStage}
        />
      )}
    </div>
  );
}

function AddTransactionModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    transaction_type: 'buyer_side',
    deal_value: '',
    commission_percentage: '3',
    expected_close_date: '',
    lead_source: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          agent_id: user.id,
          transaction_type: formData.transaction_type,
          deal_value: parseFloat(formData.deal_value) || 0,
          commission_percentage: parseFloat(formData.commission_percentage) || 0,
          expected_close_date: formData.expected_close_date || null,
          lead_source: formData.lead_source,
          notes: formData.notes,
          stage: 'lead',
          status: 'active'
        })
        .select();

      if (error) {
        console.error('Error creating transaction:', error);
        alert(`Failed to create transaction: ${error.message}`);
        return;
      }

      console.log('Transaction created successfully:', data);
      onSuccess();
    } catch (error: any) {
      console.error('Error creating transaction:', error);
      alert(`Failed to create transaction: ${error?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">New Transaction</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Type</label>
            <select
              value={formData.transaction_type}
              onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="buyer_side">Buyer Side</option>
              <option value="seller_side">Seller Side</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Deal Value</label>
            <input
              type="number"
              value={formData.deal_value}
              onChange={(e) => setFormData({ ...formData, deal_value: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="300000"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Commission %</label>
            <input
              type="number"
              step="0.1"
              value={formData.commission_percentage}
              onChange={(e) => setFormData({ ...formData, commission_percentage: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="3"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Expected Close Date</label>
            <input
              type="date"
              value={formData.expected_close_date}
              onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Lead Source</label>
            <input
              type="text"
              value={formData.lead_source}
              onChange={(e) => setFormData({ ...formData, lead_source: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Referral, Website, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Add any notes about this transaction..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TransactionDetailsModal({
  transaction,
  onClose,
  onUpdate,
  onMove
}: {
  transaction: Transaction;
  onClose: () => void;
  onUpdate: () => void;
  onMove: (id: string, stage: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    deal_value: transaction.deal_value.toString(),
    commission_percentage: transaction.commission_percentage.toString(),
    expected_close_date: transaction.expected_close_date || '',
    notes: transaction.notes
  });

  const handleUpdate = async () => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          deal_value: parseFloat(formData.deal_value),
          commission_percentage: parseFloat(formData.commission_percentage),
          expected_close_date: formData.expected_close_date || null,
          notes: formData.notes
        })
        .eq('id', transaction.id);

      if (error) throw error;
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating transaction:', error);
    }
  };

  const handleMarkAsWon = async () => {
    await onMove(transaction.id, 'closed');
    onClose();
  };

  const handleMarkAsLost = async () => {
    await onMove(transaction.id, 'lost');
    onClose();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">Transaction Details</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <Edit2 size={20} />
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              transaction.transaction_type === 'buyer_side'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-green-100 text-green-700'
            }`}>
              {transaction.transaction_type === 'buyer_side' ? 'Buyer Side' : 'Seller Side'}
            </span>
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Deal Value</label>
                <input
                  type="number"
                  value={formData.deal_value}
                  onChange={(e) => setFormData({ ...formData, deal_value: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Commission %</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.commission_percentage}
                  onChange={(e) => setFormData({ ...formData, commission_percentage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Expected Close Date</label>
                <input
                  type="date"
                  value={formData.expected_close_date}
                  onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Deal Value</p>
                  <p className="text-xl font-bold text-gray-800">{formatCurrency(transaction.deal_value)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Commission</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(transaction.commission_amount)}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Current Stage</p>
                <select
                  value={transaction.stage}
                  onChange={(e) => onMove(transaction.id, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {PIPELINE_STAGES.map((stage) => (
                    <option key={stage.id} value={stage.id}>{stage.name}</option>
                  ))}
                </select>
              </div>

              {transaction.notes && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Notes</p>
                  <p className="text-gray-800 bg-gray-50 rounded-lg p-3">{transaction.notes}</p>
                </div>
              )}

              {transaction.lead_source && (
                <div>
                  <p className="text-sm text-gray-600">Lead Source</p>
                  <p className="text-gray-800">{transaction.lead_source}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleMarkAsWon}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  <DollarSign size={18} />
                  Mark as Won
                </button>
                <button
                  onClick={handleMarkAsLost}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  <X size={18} />
                  Mark as Lost
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
