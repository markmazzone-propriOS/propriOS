import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, User, Mail, Phone, Check, X, AlertCircle, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type CalendarEvent = {
  id: string;
  property_id: string | null;
  event_type: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  status: string;
  reschedule_status: string | null;
  original_start_time: string | null;
  original_end_time: string | null;
  reschedule_requested_at: string | null;
  requestor_name: string | null;
  requestor_email: string | null;
  requestor_phone: string | null;
  created_at: string;
  property?: {
    address_line1: string;
    city: string;
    state: string;
  };
};

export function BuyerCalendar() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');

  useEffect(() => {
    if (user) {
      loadEvents();

      const urlParams = new URLSearchParams(window.location.search);
      const action = urlParams.get('action');
      const eventId = urlParams.get('eventId');

      if (action && eventId) {
        handleEmailAction(action, eventId);
      }

      const channel = supabase
        .channel('buyer-calendar-events')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'calendar_events',
            filter: `requester_id=eq.${user.id}`,
          },
          () => {
            loadEvents();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const loadEvents = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select(`
          *,
          property:properties(address_line1, city, state)
        `)
        .eq('requester_id', user.id)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error('Error loading calendar events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAction = async (action: string, eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (event) {
      setSelectedEvent(event);
      if (action === 'confirm') {
        await handleConfirmReschedule(eventId);
      } else if (action === 'decline') {
        await handleDeclineReschedule(eventId);
      }
    }
  };

  const handleConfirmReschedule = async (eventId: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('calendar_events')
        .update({
          reschedule_status: 'confirmed',
          reschedule_confirmed_at: new Date().toISOString(),
          status: 'confirmed',
        })
        .eq('id', eventId);

      if (error) throw error;

      alert('Reschedule confirmed! Your viewing has been updated.');

      window.history.replaceState({}, '', window.location.pathname);

      loadEvents();
    } catch (error) {
      console.error('Error confirming reschedule:', error);
      alert('Failed to confirm reschedule. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineReschedule = async (eventId: string) => {
    setActionLoading(true);
    try {
      const event = events.find(e => e.id === eventId);
      if (!event) throw new Error('Event not found');

      const { error } = await supabase
        .from('calendar_events')
        .update({
          reschedule_status: 'declined',
          start_time: event.original_start_time || event.start_time,
          end_time: event.original_end_time || event.end_time,
          status: 'pending',
        })
        .eq('id', eventId);

      if (error) throw error;

      alert('Reschedule declined. Your viewing has been restored to the original time. Please contact your agent to arrange a new time.');

      window.history.replaceState({}, '', window.location.pathname);

      loadEvents();
    } catch (error) {
      console.error('Error declining reschedule:', error);
      alert('Failed to decline reschedule. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelViewing = async (eventId: string) => {
    if (!confirm('Are you sure you want to cancel this viewing? This action cannot be undone.')) {
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('calendar_events')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', eventId);

      if (error) throw error;

      alert('Your viewing has been cancelled. The agent will be notified.');
      loadEvents();
    } catch (error) {
      console.error('Error cancelling viewing:', error);
      alert('Failed to cancel viewing. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestReschedule = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowRescheduleModal(true);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setRescheduleDate(tomorrow.toISOString().split('T')[0]);
    setRescheduleTime('10:00');
    setRescheduleReason('');
  };

  const submitRescheduleRequest = async () => {
    if (!selectedEvent || !rescheduleDate || !rescheduleTime) {
      alert('Please select a date and time for the reschedule.');
      return;
    }

    setActionLoading(true);
    try {
      const newStartTime = new Date(`${rescheduleDate}T${rescheduleTime}`);
      const newEndTime = new Date(newStartTime);
      newEndTime.setHours(newEndTime.getHours() + 1);

      const { error } = await supabase
        .from('calendar_events')
        .update({
          original_start_time: selectedEvent.start_time,
          original_end_time: selectedEvent.end_time,
          start_time: newStartTime.toISOString(),
          end_time: newEndTime.toISOString(),
          reschedule_status: 'pending_confirmation',
          reschedule_requested_at: new Date().toISOString(),
          status: 'pending',
        })
        .eq('id', selectedEvent.id);

      if (error) throw error;

      alert('Your reschedule request has been sent. The agent will be notified and can confirm or suggest an alternative time.');
      setShowRescheduleModal(false);
      setSelectedEvent(null);
      loadEvents();
    } catch (error) {
      console.error('Error requesting reschedule:', error);
      alert('Failed to request reschedule. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (event: CalendarEvent) => {
    if (event.reschedule_status === 'pending_confirmation') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
          <AlertCircle size={14} className="mr-1" />
          Reschedule Pending
        </span>
      );
    }

    switch (event.status) {
      case 'pending':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">Pending</span>;
      case 'confirmed':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">Confirmed</span>;
      case 'cancelled':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">Cancelled</span>;
      case 'completed':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">Completed</span>;
      default:
        return null;
    }
  };

  const upcomingEvents = events.filter(e => new Date(e.start_time) >= new Date() && e.status !== 'cancelled');
  const pastEvents = events.filter(e => new Date(e.start_time) < new Date() || e.status === 'cancelled');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading your viewings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">My Property Viewings</h1>
        <p className="text-gray-600">Manage your scheduled property viewings</p>
      </div>

      {upcomingEvents.length === 0 && pastEvents.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Viewings Scheduled</h3>
          <p className="text-gray-600">Browse properties and schedule viewings to see them here.</p>
        </div>
      ) : (
        <>
          {upcomingEvents.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Upcoming Viewings</h2>
              <div className="space-y-4">
                {upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`bg-white rounded-lg shadow-md p-6 transition hover:shadow-lg ${
                      event.reschedule_status === 'pending_confirmation' ? 'border-2 border-yellow-400' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">{event.title}</h3>
                        {event.property && (
                          <p className="text-gray-600 text-sm mt-1">
                            {event.property.address_line1}, {event.property.city}, {event.property.state}
                          </p>
                        )}
                      </div>
                      {getStatusBadge(event)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center text-gray-700">
                        <Calendar size={18} className="mr-2 text-blue-600" />
                        <span>
                          {new Date(event.start_time).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center text-gray-700">
                        <Clock size={18} className="mr-2 text-blue-600" />
                        <span>
                          {new Date(event.start_time).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </span>
                      </div>
                      {event.location && (
                        <div className="flex items-center text-gray-700 md:col-span-2">
                          <MapPin size={18} className="mr-2 text-blue-600" />
                          <span>{event.location}</span>
                        </div>
                      )}
                    </div>

                    {event.reschedule_status === 'pending_confirmation' && (
                      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-4">
                        <div className="flex items-start">
                          <AlertCircle size={20} className="text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-yellow-800 mb-2">
                              Your agent has requested to reschedule this viewing
                            </h4>
                            {event.original_start_time && (
                              <p className="text-sm text-yellow-700 mb-3">
                                Original time: {new Date(event.original_start_time).toLocaleDateString()} at{' '}
                                {new Date(event.original_start_time).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true,
                                })}
                              </p>
                            )}
                            <div className="flex gap-3">
                              <button
                                onClick={() => handleConfirmReschedule(event.id)}
                                disabled={actionLoading}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50"
                              >
                                <Check size={16} />
                                Confirm New Time
                              </button>
                              <button
                                onClick={() => handleDeclineReschedule(event.id)}
                                disabled={actionLoading}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50"
                              >
                                <X size={16} />
                                Decline
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {event.description && (
                      <div className="mt-4 text-sm text-gray-600">
                        <p>{event.description}</p>
                      </div>
                    )}

                    {event.status !== 'cancelled' && event.reschedule_status !== 'pending_confirmation' && (
                      <div className="mt-4 pt-4 border-t border-gray-200 flex gap-3">
                        <button
                          onClick={() => handleRequestReschedule(event)}
                          disabled={actionLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          <Edit2 size={16} />
                          Request Reschedule
                        </button>
                        <button
                          onClick={() => handleCancelViewing(event.id)}
                          disabled={actionLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50"
                        >
                          <Trash2 size={16} />
                          Cancel Viewing
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {pastEvents.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">Past Viewings</h2>
              <div className="space-y-4">
                {pastEvents.map((event) => (
                  <div key={event.id} className="bg-gray-50 rounded-lg shadow-md p-6 opacity-75">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-700">{event.title}</h3>
                        {event.property && (
                          <p className="text-gray-500 text-sm mt-1">
                            {event.property.address_line1}, {event.property.city}, {event.property.state}
                          </p>
                        )}
                      </div>
                      {getStatusBadge(event)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center text-gray-600">
                        <Calendar size={18} className="mr-2" />
                        <span>
                          {new Date(event.start_time).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Clock size={18} className="mr-2" />
                        <span>
                          {new Date(event.start_time).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showRescheduleModal && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Request Reschedule</h3>

            <div className="mb-4 p-3 bg-blue-50 rounded-md">
              <p className="text-sm text-gray-700">
                <strong>Current Time:</strong><br />
                {new Date(selectedEvent.start_time).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })} at {new Date(selectedEvent.start_time).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred New Date
              </label>
              <input
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Time
              </label>
              <input
                type="time"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason (Optional)
              </label>
              <textarea
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                placeholder="Let the agent know why you need to reschedule..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={submitRescheduleRequest}
                disabled={actionLoading}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
              >
                {actionLoading ? 'Sending...' : 'Send Request'}
              </button>
              <button
                onClick={() => {
                  setShowRescheduleModal(false);
                  setSelectedEvent(null);
                }}
                disabled={actionLoading}
                className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 transition disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
