import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, User, Mail, Phone, Check, X, ArrowLeft, Briefcase } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';
import JobDetailsModal from '../ServiceProvider/JobDetailsModal';

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

export function PropertyOwnerCalendar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'in_progress' | 'completed'>('all');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [loadingJobId, setLoadingJobId] = useState(false);

  useEffect(() => {
    if (user) {
      loadEvents();

      const channel = supabase
        .channel('property-owner-calendar')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'calendar_events',
            filter: `property_owner_id=eq.${user.id}`,
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
      console.log('Loading events for user:', user.id);

      // Fetch events where user is property owner
      const { data: ownerEvents, error: ownerError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('property_owner_id', user.id);

      if (ownerError) {
        console.error('Error fetching owner events:', ownerError);
        throw ownerError;
      }

      // Fetch events where user is the user_id
      const { data: userEvents, error: userError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id);

      if (userError) {
        console.error('Error fetching user events:', userError);
        throw userError;
      }

      // Combine and deduplicate events
      const allEvents = [...(ownerEvents || []), ...(userEvents || [])];
      const uniqueEvents = Array.from(
        new Map(allEvents.map(event => [event.id, event])).values()
      );

      // Fetch property details for events that have property_id
      const propertyIds = uniqueEvents
        .filter(event => event.property_id)
        .map(event => event.property_id);

      if (propertyIds.length > 0) {
        const { data: properties } = await supabase
          .from('properties')
          .select('id, address_line1, city, state')
          .in('id', propertyIds);

        // Attach property data to events
        uniqueEvents.forEach(event => {
          if (event.property_id) {
            event.property = properties?.find(p => p.id === event.property_id);
          }
        });
      }

      // Sort by start_time
      const data = uniqueEvents.sort((a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );

      console.log('Loaded events:', data);
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

      const { data: updatedEvent } = await supabase
        .from('calendar_events')
        .select(`
          *,
          property:properties(address_line1, city, state)
        `)
        .eq('id', eventId)
        .single();

      if (status === 'confirmed' && updatedEvent?.requestor_email) {
        await sendConfirmationEmail(updatedEvent);
      }

      if (status === 'cancelled' && updatedEvent?.requestor_email) {
        await sendCancellationEmail(updatedEvent);
      }

      loadEvents();
    } catch (err) {
      console.error('Error updating event status:', err);
    }
  };

  const handleViewJobDetails = async (eventId: string) => {
    setLoadingJobId(true);
    try {
      // First get the calendar event to find the linked appointment_id
      const { data: calendarEvent, error: eventError } = await supabase
        .from('calendar_events')
        .select('appointment_id')
        .eq('id', eventId)
        .maybeSingle();

      if (eventError) {
        console.error('Error finding calendar event:', eventError);
        alert('Unable to find calendar event details');
        return;
      }

      if (!calendarEvent?.appointment_id) {
        alert('This event is not linked to an appointment. No job details available.');
        return;
      }

      // Now find the job linked to this appointment
      const { data: job, error: jobError } = await supabase
        .from('service_provider_jobs')
        .select('id')
        .eq('appointment_id', calendarEvent.appointment_id)
        .maybeSingle();

      if (jobError) {
        console.error('Error finding job:', jobError);
        alert('Unable to find job details for this appointment');
        return;
      }

      if (!job) {
        alert('No job found for this appointment. The service provider may not have created a job yet.');
        return;
      }

      setSelectedJobId(job.id);
    } catch (err: any) {
      console.error('Error loading job:', err);
      alert(`Failed to load job details: ${err.message}`);
    } finally {
      setLoadingJobId(false);
    }
  };

  const sendConfirmationEmail = async (event: CalendarEvent) => {
    try {
      if (!event.requestor_email) return;

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
      });

      await supabase.functions.invoke('send-viewing-confirmation', {
        body: {
          to_email: event.requestor_email,
          requestor_name: event.requestor_name,
          property_address: event.location,
          viewing_date: viewingDate,
          viewing_time: viewingTime,
          owner_name: profileData?.full_name,
          owner_phone: profileData?.phone_number,
        },
      });
    } catch (error) {
      console.error('Error sending confirmation email:', error);
    }
  };

  const sendCancellationEmail = async (event: CalendarEvent) => {
    try {
      if (!event.requestor_email) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, phone_number')
        .eq('id', user?.id)
        .single();

      await supabase.functions.invoke('send-viewing-cancellation', {
        body: {
          to_email: event.requestor_email,
          requestor_name: event.requestor_name,
          property_address: event.location,
          owner_name: profileData?.full_name,
        },
      });
    } catch (error) {
      console.error('Error sending cancellation email:', error);
    }
  };

  const filteredEvents = events.filter((event) => {
    if (filter === 'all') return true;
    return event.status === filter;
  });

  const upcomingEvents = filteredEvents.filter(
    (event) => new Date(event.start_time) >= new Date() && event.status !== 'cancelled'
  );
  const pastEvents = filteredEvents.filter(
    (event) => new Date(event.start_time) < new Date() || event.status === 'cancelled'
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-orange-100 text-orange-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'In Progress';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-gray-200 rounded-lg transition"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Calendar</h1>
              <p className="text-gray-600 mt-1">Manage all your scheduled events and appointments</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <div className="flex gap-2 p-4">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({events.length})
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === 'pending'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pending ({events.filter((e) => e.status === 'pending').length})
              </button>
              <button
                onClick={() => setFilter('confirmed')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === 'confirmed'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Confirmed ({events.filter((e) => e.status === 'confirmed').length})
              </button>
              <button
                onClick={() => setFilter('in_progress')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === 'in_progress'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                In Progress ({events.filter((e) => e.status === 'in_progress').length})
              </button>
              <button
                onClick={() => setFilter('completed')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === 'completed'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Completed ({events.filter((e) => e.status === 'completed').length})
              </button>
            </div>
          </div>
        </div>

        {upcomingEvents.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Upcoming Events</h2>
            <div className="space-y-4">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
                        {event.event_type === 'appointment' && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                            Service Appointment
                          </span>
                        )}
                        {event.event_type === 'viewing' && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                            Property Viewing
                          </span>
                        )}
                      </div>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                          event.status
                        )}`}
                      >
                        {getStatusText(event.status)}
                      </span>
                    </div>
                    {event.event_type !== 'appointment' && event.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateEventStatus(event.id, 'confirmed')}
                          className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                          title="Confirm viewing"
                        >
                          <Check size={20} />
                        </button>
                        <button
                          onClick={() => updateEventStatus(event.id, 'cancelled')}
                          className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                          title="Cancel viewing"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    )}
                    {event.event_type !== 'appointment' && event.status === 'confirmed' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateEventStatus(event.id, 'completed')}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                        >
                          Mark Complete
                        </button>
                        <button
                          onClick={() => updateEventStatus(event.id, 'cancelled')}
                          className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                          title="Cancel viewing"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    )}
                    {event.event_type === 'appointment' && (
                      <button
                        onClick={() => handleViewJobDetails(event.id)}
                        disabled={loadingJobId}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        <Briefcase size={18} />
                        {loadingJobId ? 'Loading...' : 'View Job Details'}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-600">
                    <div className="flex items-start gap-2">
                      <Clock size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">
                          {new Date(event.start_time).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="text-sm">
                          {new Date(event.start_time).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          -{' '}
                          {new Date(event.end_time).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>

                    {event.location && (
                      <div className="flex items-start gap-2">
                        <MapPin size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <p>{event.location}</p>
                      </div>
                    )}

                    {event.requestor_name && (
                      <div className="flex items-start gap-2">
                        <User size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <p>{event.requestor_name}</p>
                      </div>
                    )}

                    {event.requestor_email && (
                      <div className="flex items-start gap-2">
                        <Mail size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <p>{event.requestor_email}</p>
                      </div>
                    )}

                    {event.requestor_phone && (
                      <div className="flex items-start gap-2">
                        <Phone size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <p>{event.requestor_phone}</p>
                      </div>
                    )}
                  </div>

                  {event.description && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">{event.description}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {pastEvents.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Past Events</h2>
            <div className="space-y-4">
              {pastEvents.map((event) => (
                <div key={event.id} className="bg-white rounded-lg shadow p-6 opacity-75">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
                        {event.event_type === 'appointment' && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                            Service Appointment
                          </span>
                        )}
                        {event.event_type === 'viewing' && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                            Property Viewing
                          </span>
                        )}
                      </div>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                          event.status
                        )}`}
                      >
                        {getStatusText(event.status)}
                      </span>
                    </div>
                    {event.event_type === 'appointment' && (
                      <button
                        onClick={() => handleViewJobDetails(event.id)}
                        disabled={loadingJobId}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        <Briefcase size={18} />
                        {loadingJobId ? 'Loading...' : 'View Job Details'}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-600">
                    <div className="flex items-start gap-2">
                      <Clock size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">
                          {new Date(event.start_time).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="text-sm">
                          {new Date(event.start_time).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>

                    {event.location && (
                      <div className="flex items-start gap-2">
                        <MapPin size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <p>{event.location}</p>
                      </div>
                    )}

                    {event.requestor_name && (
                      <div className="flex items-start gap-2">
                        <User size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <p>{event.requestor_name}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredEvents.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Calendar className="mx-auto text-gray-400 mb-4" size={64} />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No events scheduled</h3>
            <p className="text-gray-600">
              {filter === 'all'
                ? 'You have no scheduled events yet.'
                : `You have no ${filter} events.`}
            </p>
          </div>
        )}
      </div>

      {selectedJobId && (
        <JobDetailsModal
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
          onUpdate={() => {
            setSelectedJobId(null);
            loadEvents();
          }}
          isPropertyOwner={true}
        />
      )}
    </div>
  );
}
