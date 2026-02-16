import { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, Mail, Phone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ScheduleViewingModalProps {
  propertyId: string;
  agentId?: string;
  ownerId?: string;
  propertyAddress: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ScheduleViewingModal({ propertyId, agentId, ownerId, propertyAddress, onClose, onSuccess }: ScheduleViewingModalProps) {
  const { user, profile } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && profile) {
      setName(profile.full_name || '');
      setEmail(user.email || '');
      setPhone(profile.phone_number || '');
    }
  }, [user, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (!name || !email) {
        throw new Error('Please provide your name and email');
      }

      if (!preferredDate || !preferredTime) {
        throw new Error('Please select a date and time for the viewing');
      }

      const startDateTime = new Date(`${preferredDate}T${preferredTime}`);
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

      // Only create prospects for agents, not property owners
      if (agentId) {
        const { data: existingProspect } = await supabase
          .from('prospects')
          .select('id')
          .eq('agent_id', agentId)
          .eq('email', email)
          .maybeSingle();

        if (!existingProspect) {
          const { error: prospectError } = await supabase
            .from('prospects')
            .insert({
              agent_id: agentId,
              full_name: name,
              email: email,
              phone_number: phone,
              status: 'new',
              source: 'property_inquiry',
              message: `Requested viewing for property: ${propertyAddress}`,
              property_id: propertyId,
            });

          if (prospectError) {
            console.error('Error creating prospect:', prospectError);
          }
        }
      }

      const getOrCreateSessionId = () => {
        let sessionId = sessionStorage.getItem('anonymous_session_id');
        if (!sessionId) {
          sessionId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          sessionStorage.setItem('anonymous_session_id', sessionId);
        }
        return sessionId;
      };

      const { error: insertError } = await supabase
        .from('calendar_events')
        .insert({
          agent_id: agentId || null,
          property_owner_id: ownerId || null,
          property_id: propertyId,
          event_type: 'viewing',
          title: `Property Viewing: ${propertyAddress}`,
          description: message || `Viewing request from ${name}`,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          location: propertyAddress,
          status: 'pending',
          requester_id: user?.id || null,
          session_id: user ? null : getOrCreateSessionId(),
          requestor_name: name,
          requestor_email: email,
          requestor_phone: phone,
        });

      if (insertError) {
        console.error('Calendar event insert error:', insertError);
        throw new Error(`Failed to create viewing: ${insertError.message || insertError.code || 'Unknown error'}`)
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Error scheduling viewing:', err);
      setError(err instanceof Error ? err.message : 'Failed to schedule viewing');
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">Schedule a Viewing</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800 font-medium mb-1">Property</p>
            <p className="text-sm text-blue-700">{propertyAddress}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Name *
            </label>
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="John Doe"
                disabled={!!user}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="john@example.com"
                disabled={!!user}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number *
            </label>
            <div className="relative">
              <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="(555) 123-4567"
              />
            </div>
            {!phone && user && (
              <p className="mt-1 text-xs text-amber-600">Please add your phone number in your profile settings</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preferred Date *
              </label>
              <div className="relative">
                <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  required
                  min={today}
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preferred Time *
              </label>
              <div className="relative">
                <Clock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="time"
                  required
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message (Optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Any specific requirements or questions..."
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Scheduling...' : 'Schedule Viewing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
