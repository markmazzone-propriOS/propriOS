import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, User, Mail, Phone, Check, X, Eye, Briefcase, FileText, Home, Calendar as CalendarIcon, Wrench } from 'lucide-react';
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
  requestor_name: string | null;
  requestor_email: string | null;
  requestor_phone: string | null;
  created_at: string;
  property?: {
    address_line1: string;
    city: string;
    state: string;
  };
  agent?: {
    full_name: string;
    email: string;
  };
  service_provider?: {
    company_name: string;
    business_email: string;
  };
};

export function SellerCalendar() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'viewing' | 'appointment' | 'meeting' | 'closing' | 'other'>('all');

  useEffect(() => {
    if (user) {
      loadEvents();

      const channel = supabase
        .channel('calendar-events-seller')
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
      const { data, error } = await supabase
        .from('calendar_events')
        .select(`
          *,
          property:properties(address_line1, city, state)
        `)
        .eq('property_owner_id', user.id)
        .order('start_time', { ascending: true });

      if (error) throw error;

      // Fetch additional info for agents and service providers
      const eventsWithDetails = await Promise.all(
        (data || []).map(async (event) => {
          let agentInfo = null;
          let serviceProviderInfo = null;

          // If event has an agent_id, fetch agent details
          if (event.agent_id) {
            const { data: agentData } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', event.agent_id)
              .maybeSingle();
            agentInfo = agentData;
          }

          // For appointment events, try to find the service provider via the user_id
          if (event.event_type === 'appointment' && event.user_id) {
            const { data: providerData } = await supabase
              .from('service_provider_profiles')
              .select('company_name, business_email')
              .eq('id', event.user_id)
              .maybeSingle();
            serviceProviderInfo = providerData;
          }

          return {
            ...event,
            agent: agentInfo,
            service_provider: serviceProviderInfo,
          };
        })
      );

      setEvents(eventsWithDetails);
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
        await sendConfirmationEmail(updatedEvent);
      }

      loadEvents();
      setSelectedEvent(null);
    } catch (err) {
      console.error('Error updating event status:', err);
      alert('Failed to update viewing status');
    }
  };

  const sendConfirmationEmail = async (event: CalendarEvent) => {
    try {
      if (!event.requestor_email) {
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
        agentName: profileData?.full_name || 'Property Owner',
        agentPhone: profileData?.phone_number || undefined,
      };

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-viewing-confirmation`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });

      if (!response.ok) {
        console.error('Failed to send confirmation email');
      }
    } catch (error) {
      console.error('Error sending confirmation email:', error);
    }
  };

  const filteredEvents = events.filter(event => {
    const statusMatch = statusFilter === 'all' || event.status === statusFilter;
    const typeMatch = typeFilter === 'all' || event.event_type === typeFilter;
    return statusMatch && typeMatch;
  });

  const upcomingEvents = filteredEvents.filter(e => new Date(e.start_time) >= new Date());
  const pastEvents = filteredEvents.filter(e => new Date(e.start_time) < new Date());

  const getEventTypeInfo = (type: string) => {
    switch (type) {
      case 'viewing':
        return { icon: Eye, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Property Viewing' };
      case 'appointment':
        return { icon: Wrench, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Service Appointment' };
      case 'meeting':
        return { icon: Briefcase, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Meeting' };
      case 'closing':
        return { icon: FileText, color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'Closing' };
      default:
        return { icon: CalendarIcon, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Other Event' };
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading viewing requests...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3 mb-2">
          <Calendar size={32} className="text-blue-600" />
          Property Calendar
        </h1>
        <p className="text-gray-600">
          Manage viewings, appointments, and events for your properties
        </p>
      </div>

      <div className="mb-6 space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Filter by Status</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({events.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                statusFilter === 'pending'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pending ({events.filter(e => e.status === 'pending').length})
            </button>
            <button
              onClick={() => setStatusFilter('confirmed')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                statusFilter === 'confirmed'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Confirmed ({events.filter(e => e.status === 'confirmed').length})
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                statusFilter === 'completed'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Completed ({events.filter(e => e.status === 'completed').length})
            </button>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Filter by Event Type</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                typeFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Events
            </button>
            <button
              onClick={() => setTypeFilter('viewing')}
              className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                typeFilter === 'viewing'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Eye size={16} />
              Viewings ({events.filter(e => e.event_type === 'viewing').length})
            </button>
            <button
              onClick={() => setTypeFilter('appointment')}
              className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                typeFilter === 'appointment'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Wrench size={16} />
              Appointments ({events.filter(e => e.event_type === 'appointment').length})
            </button>
            <button
              onClick={() => setTypeFilter('meeting')}
              className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                typeFilter === 'meeting'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Briefcase size={16} />
              Meetings ({events.filter(e => e.event_type === 'meeting').length})
            </button>
            <button
              onClick={() => setTypeFilter('closing')}
              className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                typeFilter === 'closing'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <FileText size={16} />
              Closings ({events.filter(e => e.event_type === 'closing').length})
            </button>
            <button
              onClick={() => setTypeFilter('other')}
              className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                typeFilter === 'other'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <CalendarIcon size={16} />
              Other ({events.filter(e => e.event_type === 'other').length})
            </button>
          </div>
        </div>
      </div>

      {upcomingEvents.length === 0 && pastEvents.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Calendar size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Events Found</h3>
          <p className="text-gray-500">
            When you have scheduled viewings, appointments, or other events for your properties, they will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {upcomingEvents.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">Upcoming Events</h2>
              <div className="grid gap-4">
                {upcomingEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onSelect={setSelectedEvent}
                    getEventTypeInfo={getEventTypeInfo}
                  />
                ))}
              </div>
            </div>
          )}

          {pastEvents.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">Past Events</h2>
              <div className="grid gap-4">
                {pastEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onSelect={setSelectedEvent}
                    getEventTypeInfo={getEventTypeInfo}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onUpdateStatus={updateEventStatus}
        />
      )}
    </div>
  );
}

function EventCard({
  event,
  onSelect,
  getEventTypeInfo
}: {
  event: CalendarEvent;
  onSelect: (event: CalendarEvent) => void;
  getEventTypeInfo: (type: string) => { icon: any; color: string; bgColor: string; label: string };
}) {
  const startDate = new Date(event.start_time);
  const isPast = startDate < new Date();
  const typeInfo = getEventTypeInfo(event.event_type);
  const TypeIcon = typeInfo.icon;

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    confirmed: 'bg-green-100 text-green-800 border-green-300',
    cancelled: 'bg-red-100 text-red-800 border-red-300',
    completed: 'bg-gray-100 text-gray-800 border-gray-300',
  };

  return (
    <div
      onClick={() => onSelect(event)}
      className={`bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition ${
        isPast ? 'opacity-75' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 ${typeInfo.bgColor} ${typeInfo.color}`}>
              <TypeIcon size={16} />
              {typeInfo.label}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusColors[event.status as keyof typeof statusColors]}`}>
              {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-800">{event.title}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="flex items-start gap-2 text-gray-600">
          <Clock size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium">{startDate.toLocaleDateString()}</div>
            <div className="text-gray-500">
              {startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        {event.property && (
          <div className="flex items-start gap-2 text-gray-600">
            <MapPin size={16} className="mt-0.5 flex-shrink-0" />
            <div>
              {event.property.address_line1}, {event.property.city}, {event.property.state}
            </div>
          </div>
        )}

        {event.requestor_name && (
          <div className="flex items-center gap-2 text-gray-600">
            <User size={16} className="flex-shrink-0" />
            <span>{event.requestor_name}</span>
          </div>
        )}

        {event.agent && (
          <div className="flex items-center gap-2 text-gray-600">
            <User size={16} className="flex-shrink-0" />
            <span>Agent: {event.agent.full_name}</span>
          </div>
        )}

        {event.service_provider && (
          <div className="flex items-center gap-2 text-gray-600">
            <Wrench size={16} className="flex-shrink-0" />
            <span>Provider: {event.service_provider.company_name}</span>
          </div>
        )}

        {event.requestor_email && (
          <div className="flex items-center gap-2 text-gray-600">
            <Mail size={16} className="flex-shrink-0" />
            <span className="truncate">{event.requestor_email}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function EventDetailsModal({
  event,
  onClose,
  onUpdateStatus,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onUpdateStatus: (eventId: string, status: string) => void;
}) {
  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);
  const isPast = startDate < new Date();

  const eventTypeLabel = {
    viewing: 'Property Viewing',
    appointment: 'Service Appointment',
    meeting: 'Meeting',
    closing: 'Closing Event',
    other: 'Event'
  }[event.event_type] || 'Event';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">{eventTypeLabel} Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">{event.title}</h3>
            {event.description && (
              <p className="text-gray-600 mb-4">{event.description}</p>
            )}
          </div>

          <div className="grid gap-4">
            <div className="flex items-start gap-3">
              <Clock size={20} className="text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium text-gray-800">
                  {startDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
                <p className="text-gray-600">
                  {startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  {' - '}
                  {endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {event.property && (
              <div className="flex items-start gap-3">
                <MapPin size={20} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-800">Property Location</p>
                  <p className="text-gray-600">
                    {event.property.address_line1}, {event.property.city}, {event.property.state}
                  </p>
                </div>
              </div>
            )}

            {event.requestor_name && (
              <div className="flex items-start gap-3">
                <User size={20} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-800">Requested By</p>
                  <p className="text-gray-600">{event.requestor_name}</p>
                </div>
              </div>
            )}

            {event.agent && (
              <div className="flex items-start gap-3">
                <User size={20} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-800">Agent</p>
                  <p className="text-gray-600">{event.agent.full_name}</p>
                  {event.agent.email && (
                    <a
                      href={`mailto:${event.agent.email}`}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      {event.agent.email}
                    </a>
                  )}
                </div>
              </div>
            )}

            {event.service_provider && (
              <div className="flex items-start gap-3">
                <Wrench size={20} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-800">Service Provider</p>
                  <p className="text-gray-600">{event.service_provider.company_name}</p>
                  {event.service_provider.business_email && (
                    <a
                      href={`mailto:${event.service_provider.business_email}`}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      {event.service_provider.business_email}
                    </a>
                  )}
                </div>
              </div>
            )}

            {event.requestor_email && (
              <div className="flex items-start gap-3">
                <Mail size={20} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-800">Email</p>
                  <a
                    href={`mailto:${event.requestor_email}`}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    {event.requestor_email}
                  </a>
                </div>
              </div>
            )}

            {event.requestor_phone && (
              <div className="flex items-start gap-3">
                <Phone size={20} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-800">Phone</p>
                  <a
                    href={`tel:${event.requestor_phone}`}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    {event.requestor_phone}
                  </a>
                </div>
              </div>
            )}

            {event.location && !event.property && (
              <div className="flex items-start gap-3">
                <MapPin size={20} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-800">Location</p>
                  <p className="text-gray-600">{event.location}</p>
                </div>
              </div>
            )}
          </div>

          {!isPast && event.status === 'pending' && (
            <div className="flex gap-3 pt-4 border-t">
              <button
                onClick={() => onUpdateStatus(event.id, 'confirmed')}
                className="flex-1 bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 transition font-medium flex items-center justify-center gap-2"
              >
                <Check size={20} />
                Confirm Viewing
              </button>
              <button
                onClick={() => onUpdateStatus(event.id, 'cancelled')}
                className="flex-1 bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 transition font-medium flex items-center justify-center gap-2"
              >
                <X size={20} />
                Decline
              </button>
            </div>
          )}

          {!isPast && event.status === 'confirmed' && (
            <div className="flex gap-3 pt-4 border-t">
              <button
                onClick={() => onUpdateStatus(event.id, 'completed')}
                className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
              >
                <Check size={20} />
                Mark as Completed
              </button>
              <button
                onClick={() => onUpdateStatus(event.id, 'cancelled')}
                className="flex-1 bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 transition font-medium flex items-center justify-center gap-2"
              >
                <X size={20} />
                Cancel Viewing
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
