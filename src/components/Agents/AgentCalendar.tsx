import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, User, Mail, Phone, Check, X, Share2, ChevronLeft, ChevronRight, Plus, CalendarClock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ShareCalendarEventModal } from './ShareCalendarEventModal';
import { RescheduleEventModal } from './RescheduleEventModal';

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

export function AgentCalendar() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week' | 'list'>('list');

  useEffect(() => {
    if (user) {
      loadEvents();

      const channel = supabase
        .channel('calendar-events')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'calendar_events',
            filter: `agent_id=eq.${user.id}`,
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
        .order('start_time', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error('Error loading calendar events:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateEventStatus = async (eventId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('calendar_events')
        .update({ status })
        .eq('id', eventId);

      if (error) throw error;

      const { data: updatedEvent, error: fetchError } = await supabase
        .from('calendar_events')
        .select(`
          *,
          property:properties(address_line1, city, state)
        `)
        .eq('id', eventId)
        .single();

      if (fetchError) {
        console.error('Error fetching updated event:', fetchError);
      }

      if (status === 'confirmed' && updatedEvent?.requestor_email) {
        console.log('Sending confirmation email to:', updatedEvent.requestor_email);
        await sendConfirmationEmail(updatedEvent);
      }

      if (status === 'cancelled' && updatedEvent?.requestor_email) {
        console.log('Sending cancellation email to:', updatedEvent.requestor_email);
        await sendCancellationEmail(updatedEvent);
      }

      if (status === 'completed' && updatedEvent?.requestor_email) {
        console.log('Sending completion email to:', updatedEvent.requestor_email);
        await sendCompletionEmail(updatedEvent);
      }

      loadEvents();
    } catch (err) {
      console.error('Error updating event status:', err);
    }
  };

  const sendConfirmationEmail = async (event: CalendarEvent) => {
    try {
      console.log('Starting to send confirmation email for event:', event.id);
      console.log('Event requestor_email:', event.requestor_email);
      console.log('Event requestor_name:', event.requestor_name);

      if (!event.requestor_email) {
        console.error('Cannot send email: No requestor_email found in event');
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, phone_number')
        .eq('id', user?.id)
        .single();

      const startDate = new Date(event.start_time);
      const viewingDate = startDate.toISOString().split('T')[0];
      const viewingTime = startDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const propertyAddress = event.property
        ? `${event.property.address_line1}, ${event.property.city}, ${event.property.state}`
        : event.location || 'Property Address';

      const emailPayload = {
        visitorEmail: event.requestor_email,
        visitorName: event.requestor_name || 'Valued Client',
        propertyAddress: propertyAddress,
        viewingDate: viewingDate,
        viewingTime: viewingTime,
        agentName: profileData?.full_name || 'Your Agent',
        agentPhone: profileData?.phone_number || undefined,
      };

      console.log('Sending email with payload:', emailPayload);

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-viewing-confirmation`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });

      const result = await response.json();
      if (!response.ok) {
        console.error('Failed to send confirmation email. Status:', response.status);
        console.error('Error details:', result);
      } else {
        console.log('Confirmation email sent successfully:', result);
        alert('Confirmation email sent successfully!');
      }
    } catch (error) {
      console.error('Error sending confirmation email:', error);
      alert('Failed to send confirmation email. Check console for details.');
    }
  };

  const sendCancellationEmail = async (event: CalendarEvent) => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, phone_number')
        .eq('id', user?.id)
        .single();

      const startDate = new Date(event.start_time);
      const viewingDate = startDate.toISOString().split('T')[0];
      const viewingTime = startDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const propertyAddress = event.property
        ? `${event.property.address_line1}, ${event.property.city}, ${event.property.state}`
        : event.location || 'Property Address';

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-viewing-cancellation`;
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
          viewingDate: viewingDate,
          viewingTime: viewingTime,
          agentName: profileData?.full_name || 'Your Agent',
          agentPhone: profileData?.phone_number || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        console.error('Failed to send cancellation email:', result);
      } else {
        console.log('Cancellation email sent successfully');
      }
    } catch (error) {
      console.error('Error sending cancellation email:', error);
    }
  };

  const sendCompletionEmail = async (event: CalendarEvent) => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, phone_number, email')
        .eq('id', user?.id)
        .single();

      const startDate = new Date(event.start_time);
      const viewingDate = startDate.toISOString().split('T')[0];
      const viewingTime = startDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const propertyAddress = event.property
        ? `${event.property.address_line1}, ${event.property.city}, ${event.property.state}`
        : event.location || 'Property Address';

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-viewing-completion`;
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
          viewingDate: viewingDate,
          viewingTime: viewingTime,
          agentName: profileData?.full_name || 'Your Agent',
          agentPhone: profileData?.phone_number || undefined,
          agentEmail: profileData?.email || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        console.error('Failed to send completion email:', result);
      } else {
        console.log('Completion email sent successfully');
      }
    } catch (error) {
      console.error('Error sending completion email:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'completed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'viewing':
        return 'bg-blue-100 text-blue-800';
      case 'meeting':
        return 'bg-purple-100 text-purple-800';
      case 'closing':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const upcomingEvents = events.filter(
    (e) => new Date(e.start_time) >= new Date() && e.status !== 'cancelled'
  );

  const pendingEvents = events.filter((e) => e.status === 'pending');

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => {
      const eventDate = new Date(event.start_time);
      return (
        eventDate.getFullYear() === date.getFullYear() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getDate() === date.getDate() &&
        event.status !== 'cancelled'
      );
    });
  };

  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      return date;
    });
  };

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setView('list');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading calendar...</div>
      </div>
    );
  }

  const renderMonthView = () => {
    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate);
    const days = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="min-h-24 bg-gray-50 border border-gray-200"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayEvents = getEventsForDate(date);
      const isToday = new Date().toDateString() === date.toDateString();

      days.push(
        <div
          key={day}
          className={`min-h-24 border border-gray-200 p-2 ${isToday ? 'bg-blue-50 border-blue-300' : 'bg-white'}`}
        >
          <div className={`text-sm font-semibold mb-1 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
            {day}
          </div>
          <div className="space-y-1">
            {dayEvents.slice(0, 3).map((event) => (
              <div
                key={event.id}
                className={`text-xs p-1 rounded truncate cursor-pointer ${getStatusColor(event.status)}`}
                onClick={() => setSelectedEvent(event)}
                title={event.title}
              >
                {formatTime(event.start_time)} {event.title}
              </div>
            ))}
            {dayEvents.length > 3 && (
              <div className="text-xs text-gray-500 pl-1">+{dayEvents.length - 3} more</div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-7 gap-0 border-l border-t border-gray-200">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="bg-gray-100 border-r border-b border-gray-200 p-2 text-center font-semibold text-gray-700">
            {day}
          </div>
        ))}
        {days}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDays = getWeekDays();

    return (
      <div className="grid grid-cols-7 gap-0 border-l border-t border-gray-200">
        {weekDays.map((date, index) => {
          const dayEvents = getEventsForDate(date);
          const isToday = new Date().toDateString() === date.toDateString();

          return (
            <div key={index} className={`border-r border-b border-gray-200 ${isToday ? 'bg-blue-50' : 'bg-white'}`}>
              <div className={`text-center py-2 border-b border-gray-200 ${isToday ? 'bg-blue-100 font-bold text-blue-600' : 'bg-gray-50'}`}>
                <div className="text-xs text-gray-600">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className={`text-lg ${isToday ? 'text-blue-600' : 'text-gray-800'}`}>
                  {date.getDate()}
                </div>
              </div>
              <div className="p-2 space-y-2 min-h-96">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`text-xs p-2 rounded cursor-pointer ${getStatusColor(event.status)}`}
                    onClick={() => setSelectedEvent(event)}
                  >
                    <div className="font-semibold truncate">{formatTime(event.start_time)}</div>
                    <div className="truncate">{event.title}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="text-blue-600" />
            My Calendar
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition"
            >
              Today
            </button>
            <div className="flex bg-gray-100 rounded-md overflow-hidden">
              <button
                onClick={() => setView('month')}
                className={`px-4 py-2 text-sm transition ${
                  view === 'month' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setView('week')}
                className={`px-4 py-2 text-sm transition ${
                  view === 'week' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setView('list')}
                className={`px-4 py-2 text-sm transition ${
                  view === 'list' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                List
              </button>
            </div>
          </div>
        </div>

        {pendingEvents.length > 0 && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">
              Pending Requests ({pendingEvents.length})
            </h3>
            <p className="text-sm text-yellow-800 mb-3">
              You have viewing requests that need your attention
            </p>
          </div>
        )}

        {(view === 'month' || view === 'week') && (
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => (view === 'month' ? navigateMonth(-1) : navigateWeek(-1))}
              className="p-2 hover:bg-gray-100 rounded-full transition"
            >
              <ChevronLeft size={20} />
            </button>
            <h3 className="text-lg font-semibold text-gray-800">
              {currentDate.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </h3>
            <button
              onClick={() => (view === 'month' ? navigateMonth(1) : navigateWeek(1))}
              className="p-2 hover:bg-gray-100 rounded-full transition"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        {view === 'month' && renderMonthView()}
        {view === 'week' && renderWeekView()}
        {view === 'list' && (
          <div className="space-y-4">
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
                <p>No upcoming events</p>
              </div>
            ) : (
            upcomingEvents.map((event) => (
              <div
                key={event.id}
                className="border rounded-lg p-4 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getEventTypeColor(
                          event.event_type
                        )}`}
                      >
                        {event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)}
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                          event.status
                        )}`}
                      >
                        {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-800 mb-1">{event.title}</h3>
                    {event.description && (
                      <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setSelectedEvent(event);
                      setShowShareModal(true);
                    }}
                    className="text-gray-400 hover:text-blue-600 transition p-2"
                    title="Share event"
                  >
                    <Share2 size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar size={16} />
                    <span>{formatDate(event.start_time)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock size={16} />
                    <span>
                      {formatTime(event.start_time)} - {formatTime(event.end_time)}
                    </span>
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2 text-gray-600 md:col-span-2">
                      <MapPin size={16} />
                      <span>{event.location}</span>
                    </div>
                  )}
                </div>

                {(event.requestor_name || event.requestor_email || event.requestor_phone) && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-medium text-gray-700 mb-2">Contact Information</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                      {event.requestor_name && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <User size={14} />
                          <span>{event.requestor_name}</span>
                        </div>
                      )}
                      {event.requestor_email && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail size={14} />
                          <span className="truncate">{event.requestor_email}</span>
                        </div>
                      )}
                      {event.requestor_phone && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone size={14} />
                          <span>{event.requestor_phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {event.status === 'pending' && (
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => updateEventStatus(event.id, 'confirmed')}
                      className="flex-1 bg-green-600 text-white px-2 py-2 rounded-md hover:bg-green-700 transition flex items-center justify-center gap-1 text-sm"
                    >
                      <Check size={16} />
                      Confirm
                    </button>
                    <button
                      onClick={() => updateEventStatus(event.id, 'cancelled')}
                      className="flex-1 bg-red-600 text-white px-2 py-2 rounded-md hover:bg-red-700 transition flex items-center justify-center gap-1 text-sm"
                    >
                      <X size={16} />
                      Decline
                    </button>
                    <button
                      onClick={() => {
                        setSelectedEvent(event);
                        setShowRescheduleModal(true);
                      }}
                      className="flex-1 bg-amber-600 text-white px-2 py-2 rounded-md hover:bg-amber-700 transition flex items-center justify-center gap-1 text-sm"
                    >
                      <CalendarClock size={16} />
                      Reschedule
                    </button>
                  </div>
                )}

                {event.status === 'confirmed' && (
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => updateEventStatus(event.id, 'completed')}
                      className="flex-1 bg-gray-600 text-white px-2 py-2 rounded-md hover:bg-gray-700 transition flex items-center justify-center gap-1 text-sm"
                    >
                      <Check size={16} />
                      Complete
                    </button>
                    <button
                      onClick={() => updateEventStatus(event.id, 'cancelled')}
                      className="flex-1 bg-red-600 text-white px-2 py-2 rounded-md hover:bg-red-700 transition flex items-center justify-center gap-1 text-sm"
                    >
                      <X size={16} />
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setSelectedEvent(event);
                        setShowRescheduleModal(true);
                      }}
                      className="flex-1 bg-amber-600 text-white px-2 py-2 rounded-md hover:bg-amber-700 transition flex items-center justify-center gap-1 text-sm"
                    >
                      <CalendarClock size={16} />
                      Reschedule
                    </button>
                  </div>
                )}

                {event.status === 'completed' && (
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => updateEventStatus(event.id, 'confirmed')}
                      className="flex-1 bg-green-600 text-white px-2 py-2 rounded-md hover:bg-green-700 transition flex items-center justify-center gap-1 text-sm"
                    >
                      <Check size={16} />
                      Reopen
                    </button>
                    <button
                      onClick={() => updateEventStatus(event.id, 'cancelled')}
                      className="flex-1 bg-red-600 text-white px-2 py-2 rounded-md hover:bg-red-700 transition flex items-center justify-center gap-1 text-sm"
                    >
                      <X size={16} />
                      Cancel
                    </button>
                  </div>
                )}

                {event.status === 'cancelled' && (
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => updateEventStatus(event.id, 'confirmed')}
                      className="flex-1 bg-green-600 text-white px-2 py-2 rounded-md hover:bg-green-700 transition flex items-center justify-center gap-1 text-sm"
                    >
                      <Check size={16} />
                      Reactivate
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
          </div>
        )}
      </div>

      {selectedEvent && !showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getEventTypeColor(
                        selectedEvent.event_type
                      )}`}
                    >
                      {selectedEvent.event_type.charAt(0).toUpperCase() + selectedEvent.event_type.slice(1)}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                        selectedEvent.status
                      )}`}
                    >
                      {selectedEvent.status.charAt(0).toUpperCase() + selectedEvent.status.slice(1)}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800">{selectedEvent.title}</h3>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <X size={24} />
                </button>
              </div>

              {selectedEvent.description && (
                <p className="text-gray-600 mb-4">{selectedEvent.description}</p>
              )}

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-gray-700">
                  <Calendar size={20} className="text-gray-400" />
                  <span>{formatDate(selectedEvent.start_time)}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <Clock size={20} className="text-gray-400" />
                  <span>
                    {formatTime(selectedEvent.start_time)} - {formatTime(selectedEvent.end_time)}
                  </span>
                </div>
                {selectedEvent.location && (
                  <div className="flex items-center gap-3 text-gray-700">
                    <MapPin size={20} className="text-gray-400" />
                    <span>{selectedEvent.location}</span>
                  </div>
                )}
              </div>

              {(selectedEvent.requestor_name || selectedEvent.requestor_email || selectedEvent.requestor_phone) && (
                <div className="border-t pt-4 mb-6">
                  <h4 className="font-semibold text-gray-800 mb-3">Contact Information</h4>
                  <div className="space-y-2">
                    {selectedEvent.requestor_name && (
                      <div className="flex items-center gap-3 text-gray-700">
                        <User size={18} className="text-gray-400" />
                        <span>{selectedEvent.requestor_name}</span>
                      </div>
                    )}
                    {selectedEvent.requestor_email && (
                      <div className="flex items-center gap-3 text-gray-700">
                        <Mail size={18} className="text-gray-400" />
                        <span>{selectedEvent.requestor_email}</span>
                      </div>
                    )}
                    {selectedEvent.requestor_phone && (
                      <div className="flex items-center gap-3 text-gray-700">
                        <Phone size={18} className="text-gray-400" />
                        <span>{selectedEvent.requestor_phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {selectedEvent.status === 'pending' && (
                  <>
                    <button
                      onClick={() => {
                        updateEventStatus(selectedEvent.id, 'confirmed');
                        setSelectedEvent(null);
                      }}
                      className="flex-1 bg-green-600 text-white px-2 py-2 rounded-md hover:bg-green-700 transition flex items-center justify-center gap-1 text-sm"
                    >
                      <Check size={16} />
                      Confirm
                    </button>
                    <button
                      onClick={() => {
                        updateEventStatus(selectedEvent.id, 'cancelled');
                        setSelectedEvent(null);
                      }}
                      className="flex-1 bg-red-600 text-white px-2 py-2 rounded-md hover:bg-red-700 transition flex items-center justify-center gap-1 text-sm"
                    >
                      <X size={16} />
                      Decline
                    </button>
                    <button
                      onClick={() => {
                        setShowRescheduleModal(true);
                      }}
                      className="flex-1 bg-amber-600 text-white px-2 py-2 rounded-md hover:bg-amber-700 transition flex items-center justify-center gap-1 text-sm"
                    >
                      <CalendarClock size={16} />
                      Reschedule
                    </button>
                  </>
                )}

                {selectedEvent.status === 'confirmed' && (
                  <>
                    <button
                      onClick={() => {
                        updateEventStatus(selectedEvent.id, 'completed');
                        setSelectedEvent(null);
                      }}
                      className="flex-1 bg-gray-600 text-white px-2 py-2 rounded-md hover:bg-gray-700 transition flex items-center justify-center gap-1 text-sm"
                    >
                      <Check size={16} />
                      Complete
                    </button>
                    <button
                      onClick={() => {
                        updateEventStatus(selectedEvent.id, 'cancelled');
                        setSelectedEvent(null);
                      }}
                      className="flex-1 bg-red-600 text-white px-2 py-2 rounded-md hover:bg-red-700 transition flex items-center justify-center gap-1 text-sm"
                    >
                      <X size={16} />
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setShowRescheduleModal(true);
                      }}
                      className="flex-1 bg-amber-600 text-white px-2 py-2 rounded-md hover:bg-amber-700 transition flex items-center justify-center gap-1 text-sm"
                    >
                      <CalendarClock size={16} />
                      Reschedule
                    </button>
                  </>
                )}

                {selectedEvent.status === 'completed' && (
                  <>
                    <button
                      onClick={() => {
                        updateEventStatus(selectedEvent.id, 'confirmed');
                        setSelectedEvent(null);
                      }}
                      className="flex-1 bg-green-600 text-white px-2 py-2 rounded-md hover:bg-green-700 transition flex items-center justify-center gap-1 text-sm"
                    >
                      <Check size={16} />
                      Reopen
                    </button>
                    <button
                      onClick={() => {
                        updateEventStatus(selectedEvent.id, 'cancelled');
                        setSelectedEvent(null);
                      }}
                      className="flex-1 bg-red-600 text-white px-2 py-2 rounded-md hover:bg-red-700 transition flex items-center justify-center gap-1 text-sm"
                    >
                      <X size={16} />
                      Cancel
                    </button>
                  </>
                )}

                {selectedEvent.status === 'cancelled' && (
                  <button
                    onClick={() => {
                      updateEventStatus(selectedEvent.id, 'confirmed');
                      setSelectedEvent(null);
                    }}
                    className="flex-1 bg-green-600 text-white px-2 py-2 rounded-md hover:bg-green-700 transition flex items-center justify-center gap-1 text-sm"
                  >
                    <Check size={16} />
                    Reactivate
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowShareModal(true);
                  }}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-1 text-sm"
                >
                  <Share2 size={16} />
                  Share
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showShareModal && selectedEvent && (
        <ShareCalendarEventModal
          eventId={selectedEvent.id}
          eventTitle={selectedEvent.title}
          onClose={() => {
            setShowShareModal(false);
            setSelectedEvent(null);
          }}
        />
      )}

      {showRescheduleModal && selectedEvent && (
        <RescheduleEventModal
          event={selectedEvent}
          onClose={() => {
            setShowRescheduleModal(false);
            setSelectedEvent(null);
          }}
          onRescheduled={() => {
            loadEvents();
          }}
        />
      )}
    </div>
  );
}
