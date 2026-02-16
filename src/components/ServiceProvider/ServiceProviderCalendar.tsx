import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, User, Plus, X, AlertCircle, Send, XCircle, Trash2, Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

type Appointment = {
  id: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  status: string;
  calendar_invitation_sent: boolean;
  lead_id?: string;
};

type Reminder = {
  id: string;
  appointment_id: string;
  reminder_time: string;
  reminder_type: string;
  message?: string;
  is_sent: boolean;
  send_to_property_owner: boolean;
  property_owner_notified: boolean;
};

type Lead = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  property_owner_id?: string;
};

type PropertyOwner = {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
};

export function ServiceProviderCalendar() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week'>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [reminders, setReminders] = useState<Record<string, Reminder[]>>({});
  const [leads, setLeads] = useState<Lead[]>([]);
  const [propertyOwners, setPropertyOwners] = useState<PropertyOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reminderFormData, setReminderFormData] = useState({
    reminder_type: '1_hour',
    custom_hours: '',
    message: '',
    send_to_property_owner: false,
  });
  const [formData, setFormData] = useState({
    lead_id: '',
    property_owner_id: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    title: '',
    description: '',
    location: '',
    date: '',
    start_time: '',
    end_time: '',
  });

  useEffect(() => {
    if (user) {
      loadAppointments();
      loadReminders();
      loadLeads();
      loadPropertyOwners();
    }
  }, [user]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_provider_appointments')
        .select('*')
        .eq('service_provider_id', user?.id)
        .order('start_time', { ascending: true });

      if (error) throw error;
      if (data) setAppointments(data);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReminders = async () => {
    try {
      const { data, error } = await supabase
        .from('service_provider_appointment_reminders')
        .select('*')
        .eq('service_provider_id', user?.id)
        .order('reminder_time', { ascending: true });

      if (error) throw error;

      if (data) {
        const remindersByAppointment: Record<string, Reminder[]> = {};
        data.forEach(reminder => {
          if (!remindersByAppointment[reminder.appointment_id]) {
            remindersByAppointment[reminder.appointment_id] = [];
          }
          remindersByAppointment[reminder.appointment_id].push(reminder);
        });
        setReminders(remindersByAppointment);
      }
    } catch (error) {
      console.error('Error loading reminders:', error);
    }
  };

  const loadLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('service_provider_leads')
        .select('id, name, email, phone, property_owner_id')
        .eq('service_provider_id', user?.id)
        .in('status', ['new', 'contacted', 'qualified'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setLeads(data);
    } catch (error) {
      console.error('Error loading leads:', error);
    }
  };

  const loadPropertyOwners = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_property_owners_with_email');

      if (error) throw error;
      if (data) {
        setPropertyOwners(data.map((po: any) => ({
          id: po.id,
          full_name: po.full_name,
          email: po.email,
          phone: po.phone_number,
        })));
      }
    } catch (error) {
      console.error('Error loading property owners:', error);
    }
  };

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError('');

    try {
      const startDateTime = new Date(`${formData.date}T${formData.start_time}`);
      const endDateTime = new Date(`${formData.date}T${formData.end_time}`);

      const { data: appointmentData, error: insertError } = await supabase
        .from('service_provider_appointments')
        .insert({
          service_provider_id: user.id,
          lead_id: formData.lead_id || null,
          property_owner_id: formData.property_owner_id || null,
          client_name: formData.client_name,
          client_email: formData.client_email,
          client_phone: formData.client_phone || null,
          title: formData.title,
          description: formData.description || null,
          location: formData.location || null,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: 'scheduled',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-calendar-invitation`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            appointmentId: appointmentData.id,
            clientName: formData.client_name,
            clientEmail: formData.client_email,
            title: formData.title,
            description: formData.description,
            location: formData.location,
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
          }),
        }
      );

      if (!response.ok) {
        console.error('Failed to send calendar invitation');
      } else {
        await supabase
          .from('service_provider_appointments')
          .update({ calendar_invitation_sent: true })
          .eq('id', appointmentData.id);
      }

      // Send notification to property owner if one is assigned
      if (formData.property_owner_id) {
        try {
          const { data: ownerEmailData, error: ownerEmailError } = await supabase.rpc('get_user_email', {
            user_id: formData.property_owner_id
          });

          if (ownerEmailError) {
            console.error('Error fetching property owner email:', ownerEmailError);
            throw ownerEmailError;
          }

          const { data: providerEmailData, error: providerEmailError } = await supabase.rpc('get_user_email', {
            user_id: user.id
          });

          if (providerEmailError) {
            console.error('Error fetching provider email:', providerEmailError);
            throw providerEmailError;
          }

          const { data: propertyOwnerData, error: ownerDataError } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', formData.property_owner_id)
            .single();

          if (ownerDataError) {
            console.error('Error fetching property owner data:', ownerDataError);
            throw ownerDataError;
          }

          const { data: providerData, error: providerDataError } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

          if (providerDataError) {
            console.error('Error fetching provider data:', providerDataError);
            throw providerDataError;
          }

          if (ownerEmailData && providerEmailData && propertyOwnerData && providerData) {
            const notificationResponse = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-property-owner-appointment-notification`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  appointmentId: appointmentData.id,
                  propertyOwnerName: propertyOwnerData.full_name,
                  propertyOwnerEmail: ownerEmailData,
                  serviceProviderName: providerData.full_name,
                  serviceProviderEmail: providerEmailData,
                  title: formData.title,
                  description: formData.description,
                  location: formData.location,
                  startTime: startDateTime.toISOString(),
                  endTime: endDateTime.toISOString(),
                }),
              }
            );

            if (!notificationResponse.ok) {
              const errorText = await notificationResponse.text();
              console.error('Failed to send property owner notification:', errorText);
              alert('Appointment created successfully, but failed to send email notification to property owner. Check console for details.');
            } else {
              console.log('Property owner notification sent successfully');
              alert('Appointment created and email notification sent to property owner successfully!');
            }
          } else {
            console.warn('Missing required data to send property owner notification');
            alert('Appointment created successfully, but could not send email notification (missing data).');
          }
        } catch (err) {
          console.error('Failed to notify property owner:', err);
          alert('Appointment created successfully, but failed to send email notification: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
      } else {
        alert('Appointment created successfully! (No property owner assigned)');
      }

      setFormData({
        lead_id: '',
        property_owner_id: '',
        client_name: '',
        client_email: '',
        client_phone: '',
        title: '',
        description: '',
        location: '',
        date: '',
        start_time: '',
        end_time: '',
      });
      setShowAddModal(false);
      await loadAppointments();
    } catch (err: any) {
      setError(err.message || 'Failed to create appointment');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelAppointment = async (appointment: Appointment) => {
    if (!confirm('Are you sure you want to cancel this appointment? A cancellation email will be sent to the client.')) {
      return;
    }

    setCancellingId(appointment.id);

    try {
      const { error: updateError } = await supabase
        .from('service_provider_appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointment.id);

      if (updateError) throw updateError;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-appointment-cancellation`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            appointmentId: appointment.id,
            clientName: appointment.client_name,
            clientEmail: appointment.client_email,
            title: appointment.title,
            startTime: appointment.start_time,
            endTime: appointment.end_time,
            location: appointment.location,
          }),
        }
      );

      if (!response.ok) {
        console.error('Failed to send cancellation email');
      }

      await loadAppointments();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel appointment');
    } finally {
      setCancellingId(null);
    }
  };

  const handleDeleteAppointment = async (appointmentId: string) => {
    if (!confirm('Are you sure you want to permanently delete this appointment?')) {
      return;
    }

    setDeletingId(appointmentId);

    try {
      const { error } = await supabase
        .from('service_provider_appointments')
        .delete()
        .eq('id', appointmentId);

      if (error) throw error;

      await loadAppointments();
      await loadReminders();
    } catch (err: any) {
      alert(err.message || 'Failed to delete appointment');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetReminder = (appointmentId: string) => {
    setSelectedAppointmentId(appointmentId);
    setReminderFormData({
      reminder_type: '1_hour',
      custom_hours: '',
      message: '',
      send_to_property_owner: false,
    });
    setShowReminderModal(true);
  };

  const handleSaveReminder = async () => {
    if (!selectedAppointmentId || !user) return;

    const appointment = appointments.find(a => a.id === selectedAppointmentId);
    if (!appointment) return;

    setSaving(true);
    setError('');

    try {
      const appointmentTime = new Date(appointment.start_time);
      let reminderTime: Date;

      switch (reminderFormData.reminder_type) {
        case '15_minutes':
          reminderTime = new Date(appointmentTime.getTime() - 15 * 60 * 1000);
          break;
        case '1_hour':
          reminderTime = new Date(appointmentTime.getTime() - 60 * 60 * 1000);
          break;
        case '1_day':
          reminderTime = new Date(appointmentTime.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'custom':
          const hours = parseInt(reminderFormData.custom_hours);
          if (isNaN(hours) || hours <= 0) {
            setError('Please enter a valid number of hours');
            return;
          }
          reminderTime = new Date(appointmentTime.getTime() - hours * 60 * 60 * 1000);
          break;
        default:
          reminderTime = new Date(appointmentTime.getTime() - 60 * 60 * 1000);
      }

      const { error } = await supabase
        .from('service_provider_appointment_reminders')
        .insert({
          service_provider_id: user.id,
          appointment_id: selectedAppointmentId,
          reminder_time: reminderTime.toISOString(),
          reminder_type: reminderFormData.reminder_type,
          message: reminderFormData.message || null,
          send_to_property_owner: reminderFormData.send_to_property_owner,
        });

      if (error) throw error;

      await loadReminders();
      setShowReminderModal(false);
      setSelectedAppointmentId(null);

      const successMsg = reminderFormData.send_to_property_owner
        ? 'Reminder set successfully! Property owner will be notified.'
        : 'Reminder set successfully!';
      alert(successMsg);
    } catch (err: any) {
      setError(err.message || 'Failed to set reminder');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    if (!confirm('Are you sure you want to delete this reminder?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('service_provider_appointment_reminders')
        .delete()
        .eq('id', reminderId);

      if (error) throw error;

      await loadReminders();
    } catch (err: any) {
      alert(err.message || 'Failed to delete reminder');
    }
  };

  const scheduledAppointments = appointments.filter(
    a => a.status !== 'cancelled' && a.status !== 'completed'
  );

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter((appointment) => {
      const appointmentDate = new Date(appointment.start_time);
      return (
        appointmentDate.getFullYear() === date.getFullYear() &&
        appointmentDate.getMonth() === date.getMonth() &&
        appointmentDate.getDate() === date.getDate()
      );
    });
  };

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
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

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const weekDays = getWeekDays();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Work Calendar</h2>
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  const today = new Date();
                  setFormData({
                    ...formData,
                    date: today.toISOString().split('T')[0],
                  });
                  setShowAddModal(true);
                }}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
              >
                <Plus size={20} className="mr-2" />
                Schedule Appointment
              </button>
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setView('month')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                    view === 'month' ? 'bg-white text-gray-800 shadow' : 'text-gray-600'
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => setView('week')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                    view === 'week' ? 'bg-white text-gray-800 shadow' : 'text-gray-600'
                  }`}
                >
                  Week
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ChevronLeft size={24} />
            </button>
            <h3 className="text-xl font-semibold text-gray-800">{monthName}</h3>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>

        {view === 'month' ? (
          <div className="p-6">
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: startingDayOfWeek }).map((_, index) => (
                <div key={`empty-${index}`} className="aspect-square" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1;
                const date = new Date(year, month, day);
                const dayAppointments = getAppointmentsForDate(date);
                const today = isToday(date);

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(date)}
                    className={`aspect-square border rounded-lg p-2 hover:bg-gray-50 transition ${
                      today ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
                    } ${selectedDate?.toDateString() === date.toDateString() ? 'ring-2 ring-blue-400' : ''}`}
                  >
                    <div className="text-sm font-medium text-gray-800">{day}</div>
                    {dayAppointments.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {dayAppointments.slice(0, 2).map((appointment) => (
                          <div
                            key={appointment.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(date);
                            }}
                            className={`text-xs px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition ${
                              appointment.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                              appointment.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                              appointment.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {appointment.title}
                          </div>
                        ))}
                        {dayAppointments.length > 2 && (
                          <div className="text-xs text-gray-600">+{dayAppointments.length - 2} more</div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-7 gap-4">
              {weekDays.map((date, index) => {
                const dayAppointments = getAppointmentsForDate(date);
                const today = isToday(date);

                return (
                  <div key={index} className="min-h-[400px]">
                    <div
                      className={`text-center p-3 rounded-lg mb-2 ${
                        today ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <div className="text-sm font-medium">
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className="text-2xl font-bold">{date.getDate()}</div>
                    </div>

                    <div className="space-y-2">
                      {dayAppointments.map((appointment) => (
                        <div
                          key={appointment.id}
                          onClick={() => setSelectedDate(date)}
                          className={`p-2 rounded-lg text-xs border cursor-pointer hover:shadow-md transition ${
                            appointment.status === 'scheduled' ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100' :
                            appointment.status === 'confirmed' ? 'bg-green-50 border-green-200 hover:bg-green-100' :
                            appointment.status === 'completed' ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' :
                            'bg-gray-50 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div className="font-semibold text-gray-800 mb-1">{appointment.title}</div>
                          <div className="flex items-center text-gray-600 mb-1">
                            <Clock size={12} className="mr-1" />
                            {new Date(appointment.start_time).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                          <div className="flex items-center text-gray-600">
                            <User size={12} className="mr-1" />
                            {appointment.client_name}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-lg border-2 border-blue-200">
        <div className="p-6 border-b border-gray-200 bg-blue-50">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-800">
              <CalendarIcon className="inline mr-2" size={24} />
              {selectedDate
                ? `Appointments on ${selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`
                : 'Upcoming Appointments'
              }
            </h3>
            {selectedDate && (
              <button
                onClick={() => setSelectedDate(null)}
                className="text-gray-600 hover:text-gray-800 p-1 hover:bg-white rounded-lg transition"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>
        <div className="p-6">
          {(() => {
            const displayAppointments = selectedDate
              ? getAppointmentsForDate(selectedDate)
              : appointments.filter(apt => new Date(apt.start_time) >= new Date()).slice(0, 10);

            return displayAppointments.length === 0 ? (
              <div className="text-center py-8 text-gray-600">
                <CalendarIcon className="mx-auto mb-4 text-gray-400" size={48} />
                <p>{selectedDate ? 'No appointments scheduled for this day' : 'No upcoming appointments'}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {displayAppointments.map((appointment) => (
                  <div key={appointment.id} className="border-2 border-gray-300 rounded-lg p-4 hover:border-blue-400 transition">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-gray-800">{appointment.title}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            appointment.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                            appointment.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                            appointment.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                            appointment.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {appointment.status.replace('_', ' ')}
                          </span>
                          {appointment.calendar_invitation_sent && (
                            <span className="flex items-center text-xs text-green-600">
                              <Send size={12} className="mr-1" />
                              Invitation Sent
                            </span>
                          )}
                        </div>
                        {appointment.description && (
                          <p className="text-sm text-gray-600 mb-3">{appointment.description}</p>
                        )}
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center text-gray-600">
                            <Clock size={16} className="mr-2" />
                            {new Date(appointment.start_time).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })} - {new Date(appointment.end_time).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                          <div className="flex items-center text-gray-600">
                            <User size={16} className="mr-2" />
                            {appointment.client_name}
                          </div>
                          {appointment.location && (
                            <div className="flex items-center text-gray-600">
                              <MapPin size={16} className="mr-2" />
                              {appointment.location}
                            </div>
                          )}
                        </div>
                        {reminders[appointment.id] && reminders[appointment.id].length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs font-medium text-gray-700 mb-2">Active Reminders:</p>
                            {reminders[appointment.id].map(reminder => (
                              <div key={reminder.id} className="flex items-center justify-between text-xs mb-2">
                                <div className="flex flex-col gap-1">
                                  <span className="flex items-center text-gray-600">
                                    <Bell size={12} className="mr-1" />
                                    {reminder.reminder_type === '15_minutes' && '15 minutes before'}
                                    {reminder.reminder_type === '1_hour' && '1 hour before'}
                                    {reminder.reminder_type === '1_day' && '1 day before'}
                                    {reminder.reminder_type === 'custom' && new Date(reminder.reminder_time).toLocaleString()}
                                    {reminder.is_sent && ' (Sent)'}
                                  </span>
                                  {reminder.send_to_property_owner && (
                                    <span className={`text-xs ${reminder.property_owner_notified ? 'text-green-600' : 'text-blue-600'}`}>
                                      {reminder.property_owner_notified ? '✓ Property owner notified' : '→ Will notify property owner'}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleDeleteReminder(reminder.id)}
                                  className="text-red-600 hover:text-red-800"
                                  title="Delete reminder"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
                          <>
                            <button
                              onClick={() => handleSetReminder(appointment.id)}
                              className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                            >
                              <Bell size={16} className="mr-1" />
                              Set Reminder
                            </button>
                            <button
                              onClick={() => handleCancelAppointment(appointment)}
                              disabled={cancellingId === appointment.id}
                              className="flex items-center px-3 py-2 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <XCircle size={16} className="mr-1" />
                              {cancellingId === appointment.id ? 'Cancelling...' : 'Cancel'}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteAppointment(appointment.id)}
                          disabled={deletingId === appointment.id}
                          className="flex items-center px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={16} className="mr-1" />
                          {deletingId === appointment.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800">Schedule Appointment</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setError('');
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddAppointment} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-start">
                  <AlertCircle size={20} className="mr-2 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Lead (Optional)
                </label>
                <select
                  value={formData.lead_id}
                  onChange={(e) => {
                    const leadId = e.target.value;
                    const lead = leads.find(l => l.id === leadId);
                    setFormData({
                      ...formData,
                      lead_id: leadId,
                      property_owner_id: lead?.property_owner_id || '',
                      client_name: lead?.name || '',
                      client_email: lead?.email || '',
                      client_phone: lead?.phone || '',
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Manual Entry</option>
                  {leads.map(lead => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name} - {lead.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Property Owner (Optional)
                </label>
                <select
                  value={formData.property_owner_id}
                  onChange={(e) => setFormData({ ...formData, property_owner_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!!formData.lead_id}
                >
                  <option value="">None - Client Appointment Only</option>
                  {propertyOwners.map(owner => (
                    <option key={owner.id} value={owner.id}>
                      {owner.full_name} - {owner.email}
                    </option>
                  ))}
                </select>
                {formData.lead_id && (
                  <p className="text-xs text-gray-500 mt-1">
                    Property owner is auto-selected from the lead
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Appointment Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    placeholder="e.g., Home Inspection"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Email *
                  </label>
                  <input
                    type="email"
                    value={formData.client_email}
                    onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.client_phone}
                    onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Time *
                  </label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., 123 Main St, City, State"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder="Additional notes about the appointment..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  A calendar invitation (.ics file) will be sent to the client's email. {formData.property_owner_id && 'The selected property owner will also receive a calendar event and can view this appointment in their calendar.'}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <Send size={18} className="mr-2" />
                  {saving ? 'Scheduling...' : 'Schedule & Send Invitation'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setError('');
                  }}
                  disabled={saving}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReminderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 flex items-center">
                  <Bell className="mr-2" size={24} />
                  Set Appointment Reminder
                </h3>
                <button
                  onClick={() => {
                    setShowReminderModal(false);
                    setError('');
                  }}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start">
                  <AlertCircle className="text-red-600 mr-2 flex-shrink-0" size={20} />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reminder Time
                  </label>
                  <select
                    value={reminderFormData.reminder_type}
                    onChange={(e) => setReminderFormData({ ...reminderFormData, reminder_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="15_minutes">15 minutes before</option>
                    <option value="1_hour">1 hour before</option>
                    <option value="1_day">1 day before</option>
                    <option value="custom">Custom time</option>
                  </select>
                </div>

                {reminderFormData.reminder_type === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hours Before Appointment
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={reminderFormData.custom_hours}
                      onChange={(e) => setReminderFormData({ ...reminderFormData, custom_hours: e.target.value })}
                      placeholder="e.g., 2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Message (Optional)
                  </label>
                  <textarea
                    value={reminderFormData.message}
                    onChange={(e) => setReminderFormData({ ...reminderFormData, message: e.target.value })}
                    rows={3}
                    placeholder="Add a custom note for this reminder..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                  <label className="flex items-start cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reminderFormData.send_to_property_owner}
                      onChange={(e) => setReminderFormData({ ...reminderFormData, send_to_property_owner: e.target.checked })}
                      className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Notify Property Owner</span>
                      <p className="text-xs text-gray-600 mt-1">
                        Send a reminder notification to the property owner about this appointment with your custom message.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSaveReminder}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <Bell size={18} className="mr-2" />
                  {saving ? 'Setting...' : 'Set Reminder'}
                </button>
                <button
                  onClick={() => {
                    setShowReminderModal(false);
                    setError('');
                  }}
                  disabled={saving}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
