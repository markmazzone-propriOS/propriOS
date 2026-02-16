import { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Phone,
  Mail,
  Calendar,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertCircle,
  Star,
  Tag,
  ChevronRight,
  ArrowLeft,
  X,
  User,
  Building,
  TrendingUp,
  FileText,
  Edit2,
  Trash2,
  UserPlus
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';
import { SendLenderInvitation } from './SendLenderInvitation';
import { LenderLeadReminders } from './LenderLeadReminders';

type Lead = {
  id: string;
  lender_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  lead_source: string | null;
  status: string;
  priority: string;
  notes: string | null;
  contact_type: string | null;
  property_type: string | null;
  expected_close_date: string | null;
  lead_score: number;
  last_activity_at: string;
  created_at: string;
  contacted_at: string | null;
};

type Activity = {
  id: string;
  lead_id: string;
  activity_type: string;
  subject: string | null;
  description: string;
  created_at: string;
  created_by: string | null;
};

type Task = {
  id: string;
  lead_id: string;
  title: string;
  description: string | null;
  due_date: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
};

type LeadTag = {
  id: string;
  lead_id: string;
  tag: string;
};

export function LenderCRM() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tags, setTags] = useState<LeadTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showNewLead, setShowNewLead] = useState(false);
  const [showInvitation, setShowInvitation] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [selectedLeadForAction, setSelectedLeadForAction] = useState<Lead | null>(null);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);

  useEffect(() => {
    loadLeads();
  }, []);

  useEffect(() => {
    if (selectedLead) {
      loadLeadDetails(selectedLead.id);
    }
  }, [selectedLead]);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lender_leads')
        .select('*')
        .eq('lender_id', user!.id)
        .order('last_activity_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (err) {
      console.error('Error loading leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLeadDetails = async (leadId: string) => {
    try {
      const [activitiesRes, tasksRes, tagsRes] = await Promise.all([
        supabase
          .from('lender_lead_activities')
          .select('*')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false }),
        supabase
          .from('lender_lead_tasks')
          .select('*')
          .eq('lead_id', leadId)
          .order('due_date', { ascending: true }),
        supabase
          .from('lender_lead_tags')
          .select('*')
          .eq('lead_id', leadId)
      ]);

      if (activitiesRes.data) setActivities(activitiesRes.data);
      if (tasksRes.data) setTasks(tasksRes.data);
      if (tagsRes.data) setTags(tagsRes.data);
    } catch (err) {
      console.error('Error loading lead details:', err);
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !searchQuery ||
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone?.includes(searchQuery);

    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || lead.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'contacted': return 'bg-yellow-100 text-yellow-800';
      case 'qualified': return 'bg-green-100 text-green-800';
      case 'converted': return 'bg-green-600 text-white';
      case 'lost': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <AlertCircle className="text-red-600" size={16} />;
      case 'high': return <TrendingUp className="text-orange-600" size={16} />;
      case 'medium': return <Star className="text-yellow-600" size={16} />;
      case 'low': return <Star className="text-gray-400" size={16} />;
      default: return null;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone size={16} />;
      case 'email': return <Mail size={16} />;
      case 'meeting': return <Calendar size={16} />;
      case 'note': return <MessageSquare size={16} />;
      case 'status_change': return <TrendingUp size={16} />;
      case 'task_completed': return <CheckCircle size={16} />;
      default: return <FileText size={16} />;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading CRM...</p>
      </div>
    );
  }

  if (selectedLead) {
    return <LeadDetailView
      lead={selectedLead}
      activities={activities}
      tasks={tasks}
      tags={tags}
      onBack={() => {
        setSelectedLead(null);
        loadLeads();
      }}
      onUpdate={loadLeads}
    />;
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/lender/dashboard')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition"
      >
        <ArrowLeft size={20} />
        <span>Back to Dashboard</span>
      </button>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Lead CRM</h2>
        <button
          onClick={() => setShowNewLead(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={20} />
          <span>New Lead</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leads by name, email, or phone..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition ${
              showFilters ? 'bg-blue-50 border-blue-600 text-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter size={20} />
            <span>Filters</span>
          </button>
        </div>

        {showFilters && (
          <div className="flex gap-4 pt-2 border-t">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="converted">Converted</option>
              <option value="lost">Lost</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        )}
      </div>

      <div className="grid gap-4">
        {filteredLeads.map((lead) => (
          <div
            key={lead.id}
            className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition border-l-4 border-blue-600"
          >
            <div className="flex items-start justify-between">
              <div
                className="flex-1 cursor-pointer"
                onClick={() => setSelectedLead(lead)}
              >
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-800">{lead.name}</h3>
                  {getPriorityIcon(lead.priority)}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
                    {lead.status}
                  </span>
                  {lead.lead_score > 0 && (
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Star size={14} className="text-yellow-500" />
                      <span>{lead.lead_score}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                  {lead.email && (
                    <div className="flex items-center gap-2">
                      <Mail size={14} />
                      <span className="truncate">{lead.email}</span>
                    </div>
                  )}
                  {lead.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={14} />
                      <span>{lead.phone}</span>
                    </div>
                  )}
                  {lead.contact_type && (
                    <div className="flex items-center gap-2">
                      <User size={14} />
                      <span>{lead.contact_type}</span>
                    </div>
                  )}
                  {lead.property_type && (
                    <div className="flex items-center gap-2">
                      <Building size={14} />
                      <span>{lead.property_type}</span>
                    </div>
                  )}
                </div>

                {lead.notes && (
                  <p className="mt-2 text-sm text-gray-600 line-clamp-2">{lead.notes}</p>
                )}

                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                  <span>Created {new Date(lead.created_at).toLocaleDateString()}</span>
                  <span>Last activity {new Date(lead.last_activity_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 ml-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedLeadForAction(lead);
                    setShowInvitation(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 transition whitespace-nowrap"
                  title="Send Invitation"
                >
                  <UserPlus size={14} />
                  <span>Invite</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedLeadForAction(lead);
                    setShowReminder(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition whitespace-nowrap"
                  title="Set Reminder"
                >
                  <Clock size={14} />
                  <span>Remind</span>
                </button>
                <button
                  onClick={() => setSelectedLead(lead)}
                  className="flex items-center justify-center p-1.5 text-gray-400 hover:text-gray-600 transition"
                  title="View Details"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredLeads.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <User size={64} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No leads found</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Start tracking your leads with the CRM'}
            </p>
          </div>
        )}
      </div>

      {showNewLead && (
        <NewLeadModal
          onClose={() => setShowNewLead(false)}
          onSuccess={() => {
            setShowNewLead(false);
            loadLeads();
          }}
        />
      )}

      {showInvitation && selectedLeadForAction && (
        <SendLenderInvitation
          prefilledEmail={selectedLeadForAction.email || ''}
          prefilledName={selectedLeadForAction.name}
          onClose={() => {
            setShowInvitation(false);
            setSelectedLeadForAction(null);
          }}
          onInvitationSent={() => {
            setShowInvitation(false);
            setSelectedLeadForAction(null);
            loadLeads();
          }}
        />
      )}

      {showReminder && selectedLeadForAction && (
        <ReminderModal
          leadId={selectedLeadForAction.id}
          leadName={selectedLeadForAction.name}
          onClose={() => {
            setShowReminder(false);
            setSelectedLeadForAction(null);
          }}
          onSuccess={() => {
            setShowReminder(false);
            setSelectedLeadForAction(null);
            loadLeads();
          }}
        />
      )}
    </div>
  );
}

function LeadDetailView({
  lead,
  activities,
  tasks,
  tags,
  onBack,
  onUpdate
}: {
  lead: Lead;
  activities: Activity[];
  tasks: Task[];
  tags: LeadTag[];
  onBack: () => void;
  onUpdate: () => void;
}) {
  const { user } = useAuth();
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const updateLeadStatus = async (status: string) => {
    try {
      const { error } = await supabase
        .from('lender_leads')
        .update({ status })
        .eq('id', lead.id);

      if (error) throw error;
      onUpdate();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const updateLeadPriority = async (priority: string) => {
    try {
      const { error } = await supabase
        .from('lender_leads')
        .update({ priority })
        .eq('id', lead.id);

      if (error) throw error;
      onUpdate();
    } catch (err) {
      console.error('Error updating priority:', err);
    }
  };

  const toggleTaskComplete = async (task: Task) => {
    try {
      const { error } = await supabase
        .from('lender_lead_tasks')
        .update({
          completed: !task.completed,
          completed_at: !task.completed ? new Date().toISOString() : null
        })
        .eq('id', task.id);

      if (error) throw error;

      if (!task.completed) {
        await supabase
          .from('lender_lead_activities')
          .insert({
            lead_id: lead.id,
            lender_id: user!.id,
            activity_type: 'task_completed',
            subject: task.title,
            description: `Completed task: ${task.title}`,
            created_by: user!.id
          });
      }

      onUpdate();
    } catch (err) {
      console.error('Error updating task:', err);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;

    try {
      const { error } = await supabase
        .from('lender_lead_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      onUpdate();
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const openTasksCount = tasks.filter(t => !t.completed).length;
  const overdueTasksCount = tasks.filter(t =>
    !t.completed && new Date(t.due_date) < new Date()
  ).length;

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition"
      >
        <ArrowLeft size={20} />
        <span>Back to Leads</span>
      </button>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{lead.name}</h2>
            <div className="flex items-center gap-3">
              <select
                value={lead.status}
                onChange={(e) => updateLeadStatus(e.target.value)}
                className={`px-3 py-1 rounded-full text-sm font-medium border-2 ${getStatusColor(lead.status)}`}
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="converted">Converted</option>
                <option value="lost">Lost</option>
              </select>

              <select
                value={lead.priority}
                onChange={(e) => updateLeadPriority(e.target.value)}
                className="px-3 py-1 rounded-lg text-sm border border-gray-300"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
          >
            <Edit2 size={16} />
            <span>Edit Lead</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Contact Information</h3>
            <div className="space-y-2">
              {lead.email && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Mail size={16} />
                  <a href={`mailto:${lead.email}`} className="hover:text-blue-600">{lead.email}</a>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Phone size={16} />
                  <a href={`tel:${lead.phone}`} className="hover:text-blue-600">{lead.phone}</a>
                </div>
              )}
              {lead.contact_type && (
                <div className="flex items-center gap-2 text-gray-700">
                  <User size={16} />
                  <span>{lead.contact_type}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Lead Details</h3>
            <div className="space-y-2 text-sm text-gray-700">
              {lead.property_type && <p><strong>Property Type:</strong> {lead.property_type}</p>}
              {lead.lead_source && <p><strong>Source:</strong> {lead.lead_source}</p>}
              {lead.expected_close_date && (
                <p><strong>Expected Close:</strong> {new Date(lead.expected_close_date).toLocaleDateString()}</p>
              )}
              <p><strong>Lead Score:</strong> {lead.lead_score}</p>
            </div>
          </div>
        </div>

        {lead.notes && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Notes</h3>
            <p className="text-gray-700 bg-gray-50 rounded-lg p-3">{lead.notes}</p>
          </div>
        )}

        {tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {tags.map(tag => (
              <span key={tag.id} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                <Tag size={12} />
                {tag.tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">Open Tasks</h3>
            <Clock className="text-blue-600" size={20} />
          </div>
          <p className="text-3xl font-bold text-gray-800 mt-2">{openTasksCount}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">Overdue</h3>
            <AlertCircle className="text-red-600" size={20} />
          </div>
          <p className="text-3xl font-bold text-gray-800 mt-2">{overdueTasksCount}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">Activities</h3>
            <TrendingUp className="text-green-600" size={20} />
          </div>
          <p className="text-3xl font-bold text-gray-800 mt-2">{activities.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Tasks</h3>
            <button
              onClick={() => setShowTaskModal(true)}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
            >
              <Plus size={16} />
              <span className="text-sm">Add Task</span>
            </button>
          </div>

          <div className="space-y-3">
            {tasks.map(task => (
              <div
                key={task.id}
                className={`p-3 rounded-lg border ${
                  task.completed ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => toggleTaskComplete(task)}
                      className="mt-1 h-4 w-4 text-blue-600 rounded"
                    />
                    <div className="flex-1">
                      <h4 className={`font-medium ${task.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                        {task.title}
                      </h4>
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs">
                        <span className={`flex items-center gap-1 ${
                          !task.completed && new Date(task.due_date) < new Date()
                            ? 'text-red-600 font-medium'
                            : 'text-gray-500'
                        }`}>
                          <Calendar size={12} />
                          {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-gray-400 hover:text-red-600 ml-2"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            {tasks.length === 0 && (
              <p className="text-center text-gray-500 py-8">No tasks yet</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Activity Timeline</h3>
            <button
              onClick={() => setShowActivityModal(true)}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
            >
              <Plus size={16} />
              <span className="text-sm">Log Activity</span>
            </button>
          </div>

          <div className="space-y-4">
            {activities.map(activity => (
              <div key={activity.id} className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                  {getActivityIcon(activity.activity_type)}
                </div>
                <div className="flex-1">
                  {activity.subject && (
                    <h4 className="font-medium text-gray-800">{activity.subject}</h4>
                  )}
                  <p className="text-sm text-gray-600">{activity.description}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(activity.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}

            {activities.length === 0 && (
              <p className="text-center text-gray-500 py-8">No activities yet</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <LenderLeadReminders
          leadId={lead.id}
          leadName={lead.name}
          onReminderSet={onUpdate}
        />
      </div>

      {showActivityModal && (
        <ActivityModal
          leadId={lead.id}
          lenderId={user!.id}
          onClose={() => setShowActivityModal(false)}
          onSuccess={() => {
            setShowActivityModal(false);
            onUpdate();
          }}
        />
      )}

      {showTaskModal && (
        <TaskModal
          leadId={lead.id}
          lenderId={user!.id}
          onClose={() => setShowTaskModal(false)}
          onSuccess={() => {
            setShowTaskModal(false);
            onUpdate();
          }}
        />
      )}

      {showEditModal && (
        <EditLeadModal
          lead={lead}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            onUpdate();
          }}
        />
      )}
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'new': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'contacted': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'qualified': return 'bg-green-100 text-green-800 border-green-200';
    case 'converted': return 'bg-green-600 text-white border-green-700';
    case 'lost': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'call': return <Phone size={16} />;
    case 'email': return <Mail size={16} />;
    case 'meeting': return <Calendar size={16} />;
    case 'note': return <MessageSquare size={16} />;
    case 'status_change': return <TrendingUp size={16} />;
    case 'task_completed': return <CheckCircle size={16} />;
    default: return <FileText size={16} />;
  }
}

function NewLeadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    leadSource: '',
    notes: '',
    contactType: '',
    propertyType: '',
    priority: 'medium',
    status: 'new'
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('lender_leads')
        .insert({
          lender_id: user!.id,
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          lead_source: formData.leadSource || null,
          notes: formData.notes || null,
          contact_type: formData.contactType || null,
          property_type: formData.propertyType || null,
          priority: formData.priority,
          status: formData.status
        });

      if (error) throw error;
      onSuccess();
    } catch (err) {
      console.error('Error creating lead:', err);
      alert('Failed to create lead');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Add New Lead</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lead Source</label>
              <input
                type="text"
                value={formData.leadSource}
                onChange={(e) => setFormData({ ...formData, leadSource: e.target.value })}
                placeholder="e.g., Website, Referral"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contact Type</label>
              <select
                value={formData.contactType}
                onChange={(e) => setFormData({ ...formData, contactType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select type</option>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="refinancing">Refinancing</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Property Type</label>
              <select
                value={formData.propertyType}
                onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select type</option>
                <option value="Single Family Home">Single Family Home</option>
                <option value="Condo">Condo</option>
                <option value="Townhouse">Townhouse</option>
                <option value="Multi-Family">Multi-Family</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditLeadModal({ lead, onClose, onSuccess }: { lead: Lead; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: lead.name,
    email: lead.email || '',
    phone: lead.phone || '',
    leadSource: lead.lead_source || '',
    notes: lead.notes || '',
    contactType: lead.contact_type || '',
    propertyType: lead.property_type || '',
    priority: lead.priority,
    status: lead.status
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('lender_leads')
        .update({
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          lead_source: formData.leadSource || null,
          notes: formData.notes || null,
          contact_type: formData.contactType || null,
          property_type: formData.propertyType || null,
          priority: formData.priority,
          status: formData.status
        })
        .eq('id', lead.id);

      if (error) throw error;
      onSuccess();
    } catch (err) {
      console.error('Error updating lead:', err);
      alert('Failed to update lead');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Edit Lead</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lead Source</label>
              <input
                type="text"
                value={formData.leadSource}
                onChange={(e) => setFormData({ ...formData, leadSource: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contact Type</label>
              <select
                value={formData.contactType}
                onChange={(e) => setFormData({ ...formData, contactType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select type</option>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="refinancing">Refinancing</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Property Type</label>
              <select
                value={formData.propertyType}
                onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select type</option>
                <option value="Single Family Home">Single Family Home</option>
                <option value="Condo">Condo</option>
                <option value="Townhouse">Townhouse</option>
                <option value="Multi-Family">Multi-Family</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="converted">Converted</option>
                <option value="lost">Lost</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ActivityModal({
  leadId,
  lenderId,
  onClose,
  onSuccess
}: {
  leadId: string;
  lenderId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [activityType, setActivityType] = useState('note');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('lender_lead_activities')
        .insert({
          lead_id: leadId,
          lender_id: lenderId,
          activity_type: activityType,
          subject: subject || null,
          description,
          created_by: user!.id
        });

      if (error) throw error;
      onSuccess();
    } catch (err) {
      console.error('Error creating activity:', err);
      alert('Failed to log activity');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Log Activity</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Activity Type *</label>
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="call">Phone Call</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting</option>
              <option value="note">Note</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Initial consultation call"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              placeholder="Details about this activity..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Logging...' : 'Log Activity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TaskModal({
  leadId,
  lenderId,
  onClose,
  onSuccess
}: {
  leadId: string;
  lenderId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('lender_lead_tasks')
        .insert({
          lead_id: leadId,
          lender_id: lenderId,
          title,
          description: description || null,
          due_date: dueDate
        });

      if (error) throw error;
      onSuccess();
    } catch (err) {
      console.error('Error creating task:', err);
      alert('Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Add Task</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Task Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g., Follow up call"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Additional details..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Due Date *</label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReminderModal({
  leadId,
  leadName,
  onClose,
  onSuccess
}: {
  leadId: string;
  leadName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [reminderType, setReminderType] = useState('follow_up');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const REMINDER_TYPES = [
    { value: 'follow_up', label: 'Follow Up' },
    { value: 'call', label: 'Call' },
    { value: 'email', label: 'Email' },
    { value: 'meeting', label: 'Meeting' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const reminderDateTime = new Date(`${reminderDate}T${reminderTime}`);

      const { error } = await supabase
        .from('lender_lead_reminders')
        .insert({
          lead_id: leadId,
          lender_id: user?.id,
          reminder_date: reminderDateTime.toISOString(),
          reminder_type: reminderType,
          notes: notes || null
        });

      if (error) throw error;
      onSuccess();
    } catch (err) {
      console.error('Error creating reminder:', err);
      alert('Failed to create reminder');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Set Reminder for {leadName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
              <input
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                required
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Time *</label>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reminder Type *</label>
            <select
              value={reminderType}
              onChange={(e) => setReminderType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {REMINDER_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="What do you need to discuss?"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Setting...' : 'Set Reminder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
