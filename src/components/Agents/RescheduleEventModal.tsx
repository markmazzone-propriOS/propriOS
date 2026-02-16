import { useState } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location?: string;
  requestor_email?: string;
  requestor_name?: string;
  property?: {
    address_line1: string;
    city: string;
    state: string;
  };
}

interface RescheduleEventModalProps {
  event: CalendarEvent;
  onClose: () => void;
  onRescheduled: () => void;
}

export function RescheduleEventModal({ event, onClose, onRescheduled }: RescheduleEventModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const newStartDateTime = new Date(`${newDate}T${newStartTime}`);
      const newEndDateTime = new Date(`${newDate}T${newEndTime}`);

      if (newEndDateTime <= newStartDateTime) {
        alert('End time must be after start time');
        setLoading(false);
        return;
      }

      const oldStartDate = new Date(event.start_time);
      const oldViewingDate = oldStartDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const oldViewingTime = oldStartDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      const { error: updateError } = await supabase
        .from('calendar_events')
        .update({
          original_start_time: event.start_time,
          original_end_time: event.end_time,
          start_time: newStartDateTime.toISOString(),
          end_time: newEndDateTime.toISOString(),
          status: 'pending',
          reschedule_status: 'pending_confirmation',
          reschedule_requested_at: new Date().toISOString(),
        })
        .eq('id', event.id);

      if (updateError) throw updateError;

      if (event.requestor_email) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, email, phone_number')
          .eq('id', user?.id)
          .single();

        const newViewingDate = newStartDateTime.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const newViewingTime = newStartDateTime.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });

        const propertyAddress = event.property
          ? `${event.property.address_line1}, ${event.property.city}, ${event.property.state}`
          : event.location || 'Property Address';

        const formatDateTimeForCalendar = (date: Date) => {
          return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-viewing-reschedule`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            visitorEmail: event.requestor_email,
            visitorName: event.requestor_name || 'Valued Client',
            propertyAddress: propertyAddress,
            oldViewingDate: oldViewingDate,
            oldViewingTime: oldViewingTime,
            newViewingDate: newViewingDate,
            newViewingTime: newViewingTime,
            agentName: profileData?.full_name || 'Your Agent',
            agentEmail: profileData?.email || undefined,
            agentPhone: profileData?.phone_number || undefined,
            calendarEventId: event.id,
            startDateTime: formatDateTimeForCalendar(newStartDateTime),
            endDateTime: formatDateTimeForCalendar(newEndDateTime),
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          console.error('Failed to send reschedule email:', result);
        } else {
          console.log('Reschedule email sent successfully');
        }
      }

      onRescheduled();
      onClose();
    } catch (error) {
      console.error('Error rescheduling event:', error);
      alert('Failed to reschedule event. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">Reschedule Viewing</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleReschedule} className="p-6">
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2">Current Details</h3>
            <p className="text-sm text-gray-600">
              {new Date(event.start_time).toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Calendar size={16} />
                New Date
              </label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                required
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Clock size={16} />
                New Start Time
              </label>
              <input
                type="time"
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Clock size={16} />
                New End Time
              </label>
              <input
                type="time"
                value={newEndTime}
                onChange={(e) => setNewEndTime(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Rescheduling...' : 'Reschedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
