import { useState } from 'react';
import { X, Mail, User, Phone, MessageSquare, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

type ContactProviderModalProps = {
  providerId: string;
  providerName: string;
  onClose: () => void;
  onSuccess?: () => void;
};

export function ContactProviderModal({ providerId, providerName, onClose, onSuccess }: ContactProviderModalProps) {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [contactType, setContactType] = useState<'buyer' | 'seller' | 'agent' | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contactType) {
      setError('Please select your role (Buyer, Seller, or Agent)');
      return;
    }

    setSending(true);
    setError('');

    try {
      if (user) {
        // Authenticated users: create conversation, send message, and create lead
        // Check if a conversation already exists between agent and provider
        const { data: userConvs, error: userConvsError } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', user.id);

        if (userConvsError) throw userConvsError;

        let existingConversation = null;
        if (userConvs && userConvs.length > 0) {
          const convIds = userConvs.map(p => p.conversation_id);
          const { data: providerConvs, error: providerConvsError } = await supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', providerId)
            .in('conversation_id', convIds);

          if (providerConvsError) throw providerConvsError;

          if (providerConvs && providerConvs.length > 0) {
            existingConversation = providerConvs[0];
          }
        }

        let conversationId = existingConversation?.conversation_id;

        if (!conversationId) {
          const { data: newConversation, error: convError } = await supabase
            .from('conversations')
            .insert({})
            .select()
            .single();

          if (convError) {
            console.error('Error creating conversation:', convError);
            throw convError;
          }
          if (!newConversation) {
            throw new Error('Failed to create conversation');
          }

          conversationId = newConversation.id;

          const { error: participantsError } = await supabase
            .from('conversation_participants')
            .insert([
              { conversation_id: conversationId, user_id: user.id },
              { conversation_id: conversationId, user_id: providerId },
            ]);

          if (participantsError) throw participantsError;
        }

        const { error: messageError } = await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: formData.message,
          });

        if (messageError) throw messageError;

        // Get user profile info for the lead
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('full_name, email, phone_number')
          .eq('id', user.id)
          .maybeSingle();

        // Create lead for the service provider (check if lead already exists)
        const { data: existingLead } = await supabase
          .from('service_provider_leads')
          .select('id')
          .eq('service_provider_id', providerId)
          .eq('email', userProfile?.email || '')
          .maybeSingle();

        if (!existingLead && userProfile) {
          await supabase
            .from('service_provider_leads')
            .insert({
              service_provider_id: providerId,
              name: userProfile.full_name || 'Unknown',
              email: userProfile.email || '',
              phone: userProfile.phone_number || null,
              source: 'website',
              status: 'new',
              priority: 'medium',
              project_description: formData.message,
              conversation_id: conversationId,
              last_contact_date: new Date().toISOString(),
              contact_type: contactType,
            });
        } else if (existingLead) {
          await supabase
            .from('service_provider_leads')
            .update({
              conversation_id: conversationId,
              last_contact_date: new Date().toISOString(),
              project_description: formData.message,
              contact_type: contactType,
            })
            .eq('id', existingLead.id);
        }

        // Send email notification to service provider
        if (userProfile) {
          try {
            const emailApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-lead-notification`;
            await fetch(emailApiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                providerId,
                leadName: userProfile.full_name || 'Unknown',
                leadEmail: userProfile.email || '',
                leadPhone: userProfile.phone_number || null,
                message: formData.message,
                isAuthenticated: true,
              }),
            });
          } catch (emailError) {
            console.error('Failed to send email notification:', emailError);
          }
        }

        setSuccess(true);
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          } else {
            onClose();
            window.location.href = `/messages/${conversationId}`;
          }
        }, 1500);
      } else {
        // Unauthenticated users: create lead via edge function
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-provider-lead`;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            providerId,
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            message: formData.message,
            contactType,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to send inquiry');
        }

        setSuccess(true);
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          } else {
            onClose();
            if (confirm('Your inquiry has been sent to the service provider! Would you like to create an account to track your conversations?')) {
              window.location.href = '/signup';
            }
          }
        }, 1500);
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">Contact {providerName}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-start">
              <AlertCircle size={20} className="mr-2 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded flex items-start">
              <CheckCircle size={20} className="mr-2 flex-shrink-0 mt-0.5" />
              <span>Message sent successfully!</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              I am a: *
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setContactType('buyer')}
                className={`py-3 px-4 rounded-md border-2 transition font-medium ${
                  contactType === 'buyer'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                Buyer
              </button>
              <button
                type="button"
                onClick={() => setContactType('seller')}
                className={`py-3 px-4 rounded-md border-2 transition font-medium ${
                  contactType === 'seller'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                Seller
              </button>
              <button
                type="button"
                onClick={() => setContactType('agent')}
                className={`py-3 px-4 rounded-md border-2 transition font-medium ${
                  contactType === 'agent'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                Agent
              </button>
            </div>
          </div>

          {!user && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="John Doe"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    placeholder="john@example.com"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message *
            </label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-3 text-gray-400" size={20} />
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
                rows={5}
                placeholder="Tell the service provider about your project or needs..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {!user && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Tip:</strong> Create an account to track your conversations and get faster responses from service providers.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={sending || success}
              className="flex-1 flex items-center justify-center bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              <Send size={20} className="mr-2" />
              {sending ? 'Sending...' : 'Send Message'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
