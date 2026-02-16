import { useState, useEffect } from 'react';
import { UserPlus, Phone, Mail, Plus, X, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';

type Lead = {
  id: string;
  lender_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  lead_source: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  contacted_at: string | null;
};

export function LeadsManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [leadNotes, setLeadNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lender_leads')
        .select('*')
        .eq('lender_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (err) {
      console.error('Error loading leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const leadData = {
        lender_id: user!.id,
        name,
        email: email || null,
        phone: phone || null,
        lead_source: leadSource || null,
        notes: leadNotes || null,
        status: 'new'
      };

      if (editingLead) {
        const { error } = await supabase
          .from('lender_leads')
          .update(leadData)
          .eq('id', editingLead.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('lender_leads')
          .insert(leadData);

        if (error) throw error;
      }

      resetForm();
      loadLeads();
    } catch (err) {
      console.error('Error saving lead:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const updateLeadStatus = async (leadId: string, status: string) => {
    try {
      const updateData: any = { status };
      if (status === 'contacted') {
        updateData.contacted_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('lender_leads')
        .update(updateData)
        .eq('id', leadId);

      if (error) throw error;
      loadLeads();
    } catch (err) {
      console.error('Error updating lead status:', err);
    }
  };

  const deleteLead = async (leadId: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;

    try {
      const { error } = await supabase
        .from('lender_leads')
        .delete()
        .eq('id', leadId);

      if (error) throw error;
      loadLeads();
    } catch (err) {
      console.error('Error deleting lead:', err);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setLeadSource('');
    setLeadNotes('');
    setEditingLead(null);
    setShowNew(false);
  };

  const startEdit = (lead: Lead) => {
    setEditingLead(lead);
    setName(lead.name);
    setEmail(lead.email || '');
    setPhone(lead.phone || '');
    setLeadSource(lead.lead_source || '');
    setLeadNotes(lead.notes || '');
    setShowNew(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'contacted':
        return 'bg-yellow-100 text-yellow-800';
      case 'qualified':
        return 'bg-green-100 text-green-800';
      case 'converted':
        return 'bg-purple-100 text-purple-800';
      case 'lost':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredLeads = filterStatus === 'all'
    ? leads
    : leads.filter(lead => lead.status === filterStatus);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading leads...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/lender/dashboard')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4 transition"
      >
        <ArrowLeft size={20} />
        <span>Back to Dashboard</span>
      </button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-800">Lead Management</h2>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Leads</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="converted">Converted</option>
            <option value="lost">Lost</option>
          </select>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          <Plus size={20} />
          <span>Add Lead</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredLeads.map((lead) => (
          <div key={lead.id} className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-600">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800 mb-1">{lead.name}</h3>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
                  {lead.status}
                </span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => startEdit(lead)}
                  className="p-1 text-blue-600 hover:bg-blue-50 rounded transition"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => deleteLead(lead.id)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm mb-3">
              {lead.email && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail size={14} />
                  <a href={`mailto:${lead.email}`} className="hover:text-blue-600 truncate">
                    {lead.email}
                  </a>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone size={14} />
                  <a href={`tel:${lead.phone}`} className="hover:text-blue-600">
                    {lead.phone}
                  </a>
                </div>
              )}
              {lead.lead_source && (
                <p className="text-xs text-gray-500">Source: {lead.lead_source}</p>
              )}
            </div>

            {lead.notes && (
              <p className="text-xs text-gray-600 bg-gray-50 rounded p-2 mb-3 line-clamp-2">
                {lead.notes}
              </p>
            )}

            <div className="flex flex-wrap gap-1">
              {lead.status === 'new' && (
                <button
                  onClick={() => updateLeadStatus(lead.id, 'contacted')}
                  className="px-2 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700 transition"
                >
                  Mark Contacted
                </button>
              )}
              {lead.status === 'contacted' && (
                <button
                  onClick={() => updateLeadStatus(lead.id, 'qualified')}
                  className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition"
                >
                  Qualify
                </button>
              )}
              {['qualified', 'contacted'].includes(lead.status) && (
                <>
                  <button
                    onClick={() => updateLeadStatus(lead.id, 'converted')}
                    className="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition"
                  >
                    Convert
                  </button>
                  <button
                    onClick={() => updateLeadStatus(lead.id, 'lost')}
                    className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition"
                  >
                    Lost
                  </button>
                </>
              )}
            </div>

            <p className="text-xs text-gray-400 mt-3">
              Added {new Date(lead.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>

      {filteredLeads.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <UserPlus size={64} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No leads found</h3>
          <p className="text-gray-600 mb-6">
            {filterStatus === 'all'
              ? 'Start adding leads to track your pipeline'
              : `No leads with status: ${filterStatus}`}
          </p>
          {filterStatus === 'all' && (
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              <Plus size={20} />
              <span>Add Your First Lead</span>
            </button>
          )}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              {editingLead ? 'Edit Lead' : 'Add New Lead'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lead Source
                </label>
                <input
                  type="text"
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value)}
                  placeholder="e.g., Website, Referral, Advertisement"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={leadNotes}
                  onChange={(e) => setLeadNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingLead ? 'Update' : 'Add Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
