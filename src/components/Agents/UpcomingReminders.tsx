import { useState, useEffect } from 'react';
import { Bell, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type ReminderWithProspect = {
  id: string;
  prospect_id: string;
  reminder_date: string;
  reminder_type: string;
  notes: string | null;
  prospect: {
    full_name: string;
    email: string;
    phone_number: string | null;
  };
};

export function UpcomingReminders() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<ReminderWithProspect[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadReminders();
    }
  }, [user]);

  const loadReminders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('prospect_reminders')
        .select(`
          id,
          prospect_id,
          reminder_date,
          reminder_type,
          notes,
          prospects:prospect_id (
            full_name,
            email,
            phone_number
          )
        `)
        .eq('agent_id', user?.id)
        .eq('completed', false)
        .gte('reminder_date', new Date().toISOString())
        .order('reminder_date', { ascending: true })
        .limit(5);

      if (error) throw error;

      const formatted = (data || []).map(item => ({
        ...item,
        prospect: Array.isArray(item.prospects) ? item.prospects[0] : item.prospects
      }));

      setReminders(formatted);
    } catch (error) {
      console.error('Error loading reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  const completeReminder = async (reminderId: string) => {
    try {
      const { error } = await supabase.rpc('complete_prospect_reminder', {
        p_reminder_id: reminderId
      });

      if (error) throw error;
      await loadReminders();
    } catch (error) {
      console.error('Error completing reminder:', error);
      alert('Failed to complete reminder');
    }
  };

  const isOverdue = (reminderDate: string) => {
    return new Date(reminderDate) < new Date();
  };

  const isToday = (reminderDate: string) => {
    const today = new Date();
    const reminder = new Date(reminderDate);
    return today.toDateString() === reminder.toDateString();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Bell className="text-blue-600" />
          Upcoming Reminders
        </h3>
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Bell className="text-blue-600" />
        Upcoming Reminders
      </h3>

      {reminders.length === 0 ? (
        <div className="text-center py-8">
          <Bell size={48} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-500">No upcoming reminders</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reminders.map(reminder => {
            const overdue = isOverdue(reminder.reminder_date);
            const today = isToday(reminder.reminder_date);

            return (
              <div
                key={reminder.id}
                className={`p-4 rounded-lg border-l-4 ${
                  overdue
                    ? 'bg-red-50 border-red-500'
                    : today
                    ? 'bg-yellow-50 border-yellow-500'
                    : 'bg-blue-50 border-blue-500'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock size={16} className={overdue ? 'text-red-600' : today ? 'text-yellow-600' : 'text-blue-600'} />
                      <span className="font-semibold text-gray-800">
                        {reminder.prospect?.full_name}
                      </span>
                      {overdue && (
                        <span className="px-2 py-0.5 text-xs bg-red-600 text-white rounded-full">
                          OVERDUE
                        </span>
                      )}
                      {today && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-600 text-white rounded-full">
                          TODAY
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 ml-5">
                      <p className="capitalize font-medium">{reminder.reminder_type}</p>
                      <p className="text-xs">
                        {new Date(reminder.reminder_date).toLocaleString()}
                      </p>
                      {reminder.notes && (
                        <p className="mt-1 text-gray-700">{reminder.notes}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => completeReminder(reminder.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition whitespace-nowrap"
                    title="Mark as completed"
                  >
                    <CheckCircle size={14} />
                    Complete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
