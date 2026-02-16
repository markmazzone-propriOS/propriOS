import { useState, useEffect } from 'react';
import { Bell, X, Clock, Check, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type Reminder = {
  id: string;
  lead_id: string;
  reminder_date: string;
  reminder_type: string;
  notes: string | null;
  completed: boolean;
  completed_at: string | null;
  lead_name?: string;
  lead_email?: string;
};

type LenderLeadRemindersProps = {
  leadId: string;
  leadName: string;
  onReminderSet?: () => void;
};

const REMINDER_TYPES = [
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' }
];

export function LenderLeadReminders({ leadId, leadName, onReminderSet }: LenderLeadRemindersProps) {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    reminder_date: '',
    reminder_time: '',
    reminder_type: 'follow_up',
    notes: ''
  });

  useEffect(() => {
    loadReminders();
  }, [leadId]);

  const loadReminders = async () => {
    try {
      const { data, error } = await supabase
        .from('lender_lead_reminders')
        .select('*')
        .eq('lead_id', leadId)
        .order('reminder_date', { ascending: true });

      if (error) throw error;
      setReminders(data || []);
    } catch (error) {
      console.error('Error loading reminders:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const reminderDateTime = new Date(`${formData.reminder_date}T${formData.reminder_time}`);

      const { error } = await supabase
        .from('lender_lead_reminders')
        .insert({
          lead_id: leadId,
          lender_id: user?.id,
          reminder_date: reminderDateTime.toISOString(),
          reminder_type: formData.reminder_type,
          notes: formData.notes || null
        });

      if (error) throw error;

      setFormData({
        reminder_date: '',
        reminder_time: '',
        reminder_type: 'follow_up',
        notes: ''
      });
      setShowForm(false);
      await loadReminders();
      onReminderSet?.();
    } catch (error) {
      console.error('Error creating reminder:', error);
      alert('Failed to create reminder');
    } finally {
      setLoading(false);
    }
  };

  const completeReminder = async (reminderId: string) => {
    try {
      const { error } = await supabase.rpc('complete_lender_lead_reminder', {
        p_reminder_id: reminderId
      });

      if (error) throw error;
      await loadReminders();
    } catch (error) {
      console.error('Error completing reminder:', error);
      alert('Failed to complete reminder');
    }
  };

  const deleteReminder = async (reminderId: string) => {
    if (!confirm('Delete this reminder?')) return;

    try {
      const { error } = await supabase
        .from('lender_lead_reminders')
        .delete()
        .eq('id', reminderId);

      if (error) throw error;
      await loadReminders();
    } catch (error) {
      console.error('Error deleting reminder:', error);
      alert('Failed to delete reminder');
    }
  };

  const upcomingReminders = reminders.filter(r => !r.completed);
  const completedReminders = reminders.filter(r => r.completed);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-800 flex items-center gap-2">
          <Bell size={18} />
          Reminders ({upcomingReminders.length})
        </h4>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          <Plus size={16} />
          Set Reminder
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={formData.reminder_date}
                onChange={(e) => setFormData({ ...formData, reminder_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time
              </label>
              <input
                type="time"
                required
                value={formData.reminder_time}
                onChange={(e) => setFormData({ ...formData, reminder_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reminder Type
            </label>
            <select
              value={formData.reminder_type}
              onChange={(e) => setFormData({ ...formData, reminder_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {REMINDER_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="What do you need to discuss?"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:bg-gray-400"
            >
              {loading ? 'Setting...' : 'Set Reminder'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {upcomingReminders.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-600">Upcoming</h5>
          {upcomingReminders.map(reminder => (
            <div
              key={reminder.id}
              className="flex items-start justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-md"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={14} className="text-yellow-600" />
                  <span className="text-sm font-medium text-gray-800 capitalize">
                    {reminder.reminder_type}
                  </span>
                  <span className="text-sm text-gray-600">
                    {new Date(reminder.reminder_date).toLocaleString()}
                  </span>
                </div>
                {reminder.notes && (
                  <p className="text-sm text-gray-600 ml-5">{reminder.notes}</p>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => completeReminder(reminder.id)}
                  className="p-1 text-green-600 hover:bg-green-100 rounded transition"
                  title="Mark as completed"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => deleteReminder(reminder.id)}
                  className="p-1 text-red-600 hover:bg-red-100 rounded transition"
                  title="Delete reminder"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {completedReminders.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-600">Completed</h5>
          {completedReminders.map(reminder => (
            <div
              key={reminder.id}
              className="flex items-start justify-between p-3 bg-gray-50 border border-gray-200 rounded-md opacity-60"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Check size={14} className="text-green-600" />
                  <span className="text-sm font-medium text-gray-800 capitalize line-through">
                    {reminder.reminder_type}
                  </span>
                  <span className="text-sm text-gray-600">
                    {new Date(reminder.reminder_date).toLocaleString()}
                  </span>
                </div>
                {reminder.notes && (
                  <p className="text-sm text-gray-600 ml-5">{reminder.notes}</p>
                )}
              </div>
              <button
                onClick={() => deleteReminder(reminder.id)}
                className="p-1 text-red-600 hover:bg-red-100 rounded transition"
                title="Delete reminder"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {reminders.length === 0 && !showForm && (
        <p className="text-sm text-gray-500 text-center py-4">
          No reminders set. Click "Set Reminder" to add one.
        </p>
      )}
    </div>
  );
}
