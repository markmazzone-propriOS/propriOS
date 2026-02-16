import { X, Calendar, Clock, MapPin, User, Users, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type EventDetailModalProps = {
  eventId: string;
  onClose: () => void;
};

type EventDetail = {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  event_type: string;
  user_id: string;
  property_id: string | null;
  creator_name: string;
  property_address: string | null;
  attendees: Array<{
    id: string;
    name: string;
  }>;
};

export function BrokerageEventDetailModal({ eventId, onClose }: EventDetailModalProps) {
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEventDetails();
  }, [eventId]);

  const loadEventDetails = async () => {
    try {
      const { data: eventData, error: eventError } = await supabase
        .from('calendar_events')
        .select(`
          *,
          creator:profiles!calendar_events_user_id_fkey(full_name),
          property:properties(address_line1, city, state, zip_code)
        `)
        .eq('id', eventId)
        .maybeSingle();

      if (eventError) {
        console.error('Error loading event:', eventError);
        throw eventError;
      }

      if (!eventData) {
        console.error('No event data returned for id:', eventId);
        throw new Error('Event not found');
      }

      const creatorName = eventData.creator?.full_name || 'Unknown';
      const propertyAddress = eventData.property
        ? `${eventData.property.address_line1}, ${eventData.property.city}, ${eventData.property.state} ${eventData.property.zip_code}`
        : null;

      const { data: sharesData, error: sharesError } = await supabase
        .from('calendar_event_shares')
        .select(`
          id,
          shared_with_profile:profiles!calendar_event_shares_shared_with_fkey(full_name)
        `)
        .eq('event_id', eventId);

      if (sharesError) {
        console.error('Error loading shares:', sharesError);
      }

      const attendees: Array<{ id: string; name: string }> = sharesData?.map((share: any) => ({
        id: share.id,
        name: share.shared_with_profile?.full_name || 'Unknown',
      })) || [];

      const formattedEvent: EventDetail = {
        id: eventData.id,
        title: eventData.title,
        description: eventData.description,
        start_time: eventData.start_time,
        end_time: eventData.end_time,
        event_type: eventData.event_type,
        user_id: eventData.user_id || eventData.agent_id,
        property_id: eventData.property_id,
        creator_name: creatorName,
        property_address: propertyAddress,
        attendees: attendees,
      };

      setEvent(formattedEvent);
    } catch (error) {
      console.error('Error loading event details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'property_viewing':
        return 'Property Viewing';
      case 'appointment':
        return 'Appointment';
      case 'meeting':
        return 'Meeting';
      case 'inspection':
        return 'Inspection';
      default:
        return type;
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'property_viewing':
        return 'bg-blue-100 text-blue-800';
      case 'appointment':
        return 'bg-green-100 text-green-800';
      case 'meeting':
        return 'bg-purple-100 text-purple-800';
      case 'inspection':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8 max-w-2xl w-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8 max-w-2xl w-full">
          <p className="text-center text-gray-600">Event not found</p>
          <button
            onClick={onClose}
            className="mt-4 w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">Event Details</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-xl font-semibold text-gray-800">{event.title}</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getEventTypeColor(event.event_type)}`}>
                {getEventTypeLabel(event.event_type)}
              </span>
            </div>
            {event.description && (
              <p className="text-gray-600 mt-2">{event.description}</p>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="text-gray-400 mt-1 flex-shrink-0" size={20} />
              <div>
                <p className="font-medium text-gray-700">Date</p>
                <p className="text-gray-600">{formatDateTime(event.start_time)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="text-gray-400 mt-1 flex-shrink-0" size={20} />
              <div>
                <p className="font-medium text-gray-700">Time</p>
                <p className="text-gray-600">
                  {formatTime(event.start_time)} - {formatTime(event.end_time)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="text-gray-400 mt-1 flex-shrink-0" size={20} />
              <div>
                <p className="font-medium text-gray-700">Created By</p>
                <p className="text-gray-600">{event.creator_name}</p>
              </div>
            </div>

            {event.property_address && (
              <div className="flex items-start gap-3">
                <MapPin className="text-gray-400 mt-1 flex-shrink-0" size={20} />
                <div>
                  <p className="font-medium text-gray-700">Property</p>
                  <p className="text-gray-600">{event.property_address}</p>
                </div>
              </div>
            )}

            {event.attendees.length > 0 && (
              <div className="flex items-start gap-3">
                <Users className="text-gray-400 mt-1 flex-shrink-0" size={20} />
                <div className="flex-1">
                  <p className="font-medium text-gray-700 mb-2">Attendees ({event.attendees.length})</p>
                  <div className="space-y-2">
                    {event.attendees.map((attendee) => (
                      <div key={attendee.id} className="bg-gray-50 rounded-lg p-3">
                        <p className="font-medium text-gray-800">{attendee.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
