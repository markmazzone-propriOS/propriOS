import { useState, useEffect } from 'react';
import { Mail, Plus, Edit2, Trash2, Power, Clock, Calendar, ArrowRight, Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_status: string;
  created_at: string;
};

type Template = {
  id: string;
  campaign_id: string;
  sequence_number: number;
  delay_days: number;
  subject: string;
  message: string;
};

const STATUS_OPTIONS = [
  { value: 'new', label: 'New Leads' },
  { value: 'contacted', label: 'Contacted Leads' },
  { value: 'qualified', label: 'Qualified Leads' },
];

export function FollowUpCampaigns() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Record<string, Template[]>>({});

  useEffect(() => {
    if (user) {
      loadCampaigns();
    }
  }, [user]);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('follow_up_campaigns')
        .select('*')
        .eq('agent_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);

      for (const campaign of data || []) {
        await loadTemplates(campaign.id);
      }
    } catch (error) {
      console.error('Error loading campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async (campaignId: string) => {
    try {
      const { data, error } = await supabase
        .from('follow_up_templates')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('sequence_number', { ascending: true });

      if (error) throw error;
      setTemplates((prev) => ({ ...prev, [campaignId]: data || [] }));
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const toggleCampaign = async (campaignId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('follow_up_campaigns')
        .update({ is_active: !currentStatus })
        .eq('id', campaignId);

      if (error) throw error;
      loadCampaigns();
    } catch (error) {
      console.error('Error toggling campaign:', error);
      alert('Failed to update campaign status');
    }
  };

  const deleteCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign? All scheduled follow-ups will be removed.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('follow_up_campaigns')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;
      loadCampaigns();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      alert('Failed to delete campaign');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Mail size={28} className="text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Automated Follow-Up Campaigns</h2>
              <p className="text-gray-600 text-sm">Set up automated email sequences for your leads</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingCampaign(null);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            Create Campaign
          </button>
        </div>
      </div>

      <div className="p-6">
        {campaigns.length === 0 ? (
          <div className="text-center py-12">
            <Mail size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg mb-2">No campaigns yet</p>
            <p className="text-gray-400 text-sm mb-4">
              Create automated email sequences to nurture your leads
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition"
            >
              Create Your First Campaign
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                <div className="p-4 bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-800">{campaign.name}</h3>
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            campaign.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {campaign.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {campaign.description && (
                        <p className="text-sm text-gray-600 mb-2">{campaign.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          Triggers on: {STATUS_OPTIONS.find(s => s.value === campaign.trigger_status)?.label}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail size={14} />
                          {templates[campaign.id]?.length || 0} emails
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleCampaign(campaign.id, campaign.is_active)}
                        className={`p-2 rounded-md transition ${
                          campaign.is_active
                            ? 'text-green-600 hover:bg-green-50'
                            : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title={campaign.is_active ? 'Deactivate' : 'Activate'}
                      >
                        <Power size={18} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingCampaign(campaign);
                          setShowCreateModal(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => deleteCampaign(campaign.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-md transition"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button
                        onClick={() => setExpandedCampaign(expandedCampaign === campaign.id ? null : campaign.id)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition"
                      >
                        <ArrowRight size={18} className={`transform transition ${expandedCampaign === campaign.id ? 'rotate-90' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {expandedCampaign === campaign.id && (
                  <div className="p-4 border-t border-gray-200">
                    <h4 className="font-semibold text-gray-700 mb-3">Email Sequence</h4>
                    {templates[campaign.id]?.length > 0 ? (
                      <div className="space-y-3">
                        {templates[campaign.id].map((template, index) => (
                          <div key={template.id} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                              {template.sequence_number}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-gray-800">{template.subject}</span>
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <Clock size={12} />
                                  {template.delay_days === 0 ? 'Immediate' : `${template.delay_days} day${template.delay_days > 1 ? 's' : ''} later`}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 line-clamp-2">{template.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No emails configured yet</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateCampaignModal
          campaign={editingCampaign}
          onClose={() => {
            setShowCreateModal(false);
            setEditingCampaign(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setEditingCampaign(null);
            loadCampaigns();
          }}
        />
      )}
    </div>
  );
}

function CreateCampaignModal({
  campaign,
  onClose,
  onSuccess,
}: {
  campaign: Campaign | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(campaign?.name || '');
  const [description, setDescription] = useState(campaign?.description || '');
  const [triggerStatus, setTriggerStatus] = useState(campaign?.trigger_status || 'new');
  const [templates, setTemplates] = useState<Omit<Template, 'id' | 'campaign_id'>[]>([
    { sequence_number: 1, delay_days: 0, subject: '', message: '' },
  ]);

  useEffect(() => {
    if (campaign) {
      loadExistingTemplates();
    }
  }, [campaign]);

  const loadExistingTemplates = async () => {
    if (!campaign) return;

    try {
      const { data, error } = await supabase
        .from('follow_up_templates')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('sequence_number', { ascending: true });

      if (error) throw error;
      if (data && data.length > 0) {
        setTemplates(data.map(t => ({
          sequence_number: t.sequence_number,
          delay_days: t.delay_days,
          subject: t.subject,
          message: t.message,
        })));
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const addTemplate = () => {
    setTemplates([
      ...templates,
      {
        sequence_number: templates.length + 1,
        delay_days: templates.length > 0 ? 3 : 0,
        subject: '',
        message: '',
      },
    ]);
  };

  const removeTemplate = (index: number) => {
    const newTemplates = templates.filter((_, i) => i !== index);
    newTemplates.forEach((t, i) => {
      t.sequence_number = i + 1;
    });
    setTemplates(newTemplates);
  };

  const updateTemplate = (index: number, field: keyof Omit<Template, 'id' | 'campaign_id'>, value: any) => {
    const newTemplates = [...templates];
    newTemplates[index] = { ...newTemplates[index], [field]: value };
    setTemplates(newTemplates);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (templates.some(t => !t.subject || !t.message)) {
      alert('Please fill in all email templates');
      return;
    }

    setLoading(true);
    try {
      let campaignId = campaign?.id;

      if (campaignId) {
        const { error: updateError } = await supabase
          .from('follow_up_campaigns')
          .update({
            name,
            description: description || null,
            trigger_status: triggerStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', campaignId);

        if (updateError) throw updateError;

        await supabase
          .from('follow_up_templates')
          .delete()
          .eq('campaign_id', campaignId);
      } else {
        const { data: newCampaign, error: campaignError } = await supabase
          .from('follow_up_campaigns')
          .insert({
            agent_id: user.id,
            name,
            description: description || null,
            trigger_status: triggerStatus,
            is_active: true,
          })
          .select()
          .single();

        if (campaignError) throw campaignError;
        campaignId = newCampaign.id;
      }

      const { error: templatesError } = await supabase
        .from('follow_up_templates')
        .insert(
          templates.map((t) => ({
            campaign_id: campaignId,
            sequence_number: t.sequence_number,
            delay_days: t.delay_days,
            subject: t.subject,
            message: t.message,
          }))
        );

      if (templatesError) throw templatesError;

      onSuccess();
    } catch (error: any) {
      console.error('Error saving campaign:', error);
      alert(error.message || 'Failed to save campaign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-800">
            {campaign ? 'Edit Campaign' : 'Create Follow-Up Campaign'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Campaign Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., New Lead Welcome Series"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this campaign for?"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trigger When Lead Status Is *
            </label>
            <select
              required
              value={triggerStatus}
              onChange={(e) => setTriggerStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              This campaign will automatically start when a lead reaches this status
            </p>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-800">Email Sequence</h4>
              <button
                type="button"
                onClick={addTemplate}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus size={16} />
                Add Email
              </button>
            </div>

            <div className="space-y-4">
              {templates.map((template, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-gray-700">Email #{template.sequence_number}</span>
                    {templates.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTemplate(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Send After *
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        required
                        min="0"
                        value={template.delay_days}
                        onChange={(e) => updateTemplate(index, 'delay_days', parseInt(e.target.value))}
                        className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-600">
                        {template.delay_days === 0 ? 'day (sent immediately)' : `day${template.delay_days > 1 ? 's' : ''}`}
                      </span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subject Line *
                    </label>
                    <input
                      type="text"
                      required
                      value={template.subject}
                      onChange={(e) => updateTemplate(index, 'subject', e.target.value)}
                      placeholder="Email subject"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Message *
                    </label>
                    <textarea
                      required
                      value={template.message}
                      onChange={(e) => updateTemplate(index, 'message', e.target.value)}
                      placeholder="Email message..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Save size={18} />
              {loading ? 'Saving...' : campaign ? 'Update Campaign' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
