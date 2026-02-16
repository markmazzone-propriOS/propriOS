import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, User, Home, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CreateBrokerageEventModal } from './CreateBrokerageEventModal';
import { BrokerageEventDetailModal } from './BrokerageEventDetailModal';
import { useAuth } from '../../contexts/AuthContext';

type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  event_type: string;
  agent_id: string;
  property_id: string | null;
  agent_name: string;
  property_address: string | null;
};

type BrokerageSharedCalendarProps = {
  brokerageId: string;
};

export function BrokerageSharedCalendar({ brokerageId }: BrokerageSharedCalendarProps) {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    loadAgentIds();
  }, [brokerageId]);

  useEffect(() => {
    if (agentIds.length > 0 || user) {
      loadEvents();
    }
  }, [currentDate, agentIds, user]);

  const loadAgentIds = async () => {
    try {
      const { data, error } = await supabase
        .from('brokerage_agents')
        .select('agent_id')
        .eq('brokerage_id', brokerageId)
        .eq('status', 'active');

      if (error) throw error;

      setAgentIds(data?.map(a => a.agent_id) || []);
    } catch (error) {
      console.error('Error loading agent IDs:', error);
    }
  };

  const loadEvents = async () => {
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

      const userIdsToQuery = user ? [...agentIds, user.id] : agentIds;

      if (userIdsToQuery.length === 0) {
        setLoading(false);
        return;
      }

      const { data: eventsData, error: eventsError } = await supabase
        .from('calendar_events')
        .select(`
          *,
          agent:profiles!calendar_events_user_id_fkey(full_name),
          property:properties(address_line1, city, state)
        `)
        .in('user_id', userIdsToQuery)
        .gte('start_time', startOfMonth.toISOString())
        .lte('start_time', endOfMonth.toISOString())
        .order('start_time', { ascending: true });

      if (eventsError) throw eventsError;

      const formattedEvents = (eventsData || []).map((event: any) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        start_time: event.start_time,
        end_time: event.end_time,
        event_type: event.event_type,
        agent_id: event.user_id,
        property_id: event.property_id,
        agent_name: event.agent?.full_name || 'Brokerage',
        property_address: event.property
          ? `${event.property.address_line1}, ${event.property.city}, ${event.property.state}`
          : null,
      }));

      setEvents(formattedEvents);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const getEventsForDay = (day: number) => {
    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return events.filter((event) => {
      const eventDate = new Date(event.start_time);
      return (
        eventDate.getDate() === day &&
        eventDate.getMonth() === currentDate.getMonth() &&
        eventDate.getFullYear() === currentDate.getFullYear()
      );
    });
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'property_viewing':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'appointment':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'meeting':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'inspection':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <CalendarIcon size={28} />
          Brokerage Calendar
        </h2>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition font-medium"
          >
            <Plus size={20} />
            Create Event
          </button>
          <button
            onClick={previousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-lg font-semibold text-gray-800 min-w-[200px] text-center">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {dayNames.map((day) => (
          <div key={day} className="text-center font-semibold text-gray-600 py-2 text-sm">
            {day}
          </div>
        ))}

        {getDaysInMonth().map((day, index) => {
          const dayEvents = day ? getEventsForDay(day) : [];
          const isToday =
            day === new Date().getDate() &&
            currentDate.getMonth() === new Date().getMonth() &&
            currentDate.getFullYear() === new Date().getFullYear();

          return (
            <div
              key={index}
              className={`min-h-[120px] border rounded-lg p-2 ${
                day ? 'bg-white hover:bg-gray-50' : 'bg-gray-50'
              } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
            >
              {day && (
                <>
                  <div className={`text-sm font-semibold mb-2 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                    {day}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        onClick={() => setSelectedEventId(event.id)}
                        className={`text-xs p-1 rounded border ${getEventTypeColor(event.event_type)} cursor-pointer truncate hover:opacity-80 transition`}
                        title={`${event.title} - ${event.agent_name}`}
                      >
                        <div className="font-medium truncate">{event.title}</div>
                        <div className="flex items-center gap-1 text-xs opacity-75">
                          <User size={10} />
                          <span className="truncate">{event.agent_name}</span>
                        </div>
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-gray-600 font-medium">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-6 border-t">
        <h3 className="font-semibold text-gray-800 mb-3">Event Types</h3>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
            <span className="text-sm text-gray-600">Property Viewing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
            <span className="text-sm text-gray-600">Appointment</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-100 border border-purple-300 rounded"></div>
            <span className="text-sm text-gray-600">Meeting</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></div>
            <span className="text-sm text-gray-600">Inspection</span>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateBrokerageEventModal
          brokerageId={brokerageId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            loadEvents();
            setShowCreateModal(false);
          }}
        />
      )}

      {selectedEventId && (
        <BrokerageEventDetailModal
          eventId={selectedEventId}
          onClose={() => setSelectedEventId(null)}
        />
      )}
    </div>
  );
}
