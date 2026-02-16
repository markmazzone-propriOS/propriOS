import { useState } from 'react';
import { X, Mail, User, Phone, MessageSquare, Send, CheckCircle, AlertCircle, Home, DollarSign } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

type ContactLenderModalProps = {
  lenderId: string;
  lenderName: string;
  onClose: () => void;
  onSuccess?: () => void;
};

export function ContactLenderModal({ lenderId, lenderName, onClose, onSuccess }: ContactLenderModalProps) {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [contactType, setContactType] = useState<'buyer' | 'seller' | 'refinancing' | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
    propertyType: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contactType) {
      setError('Please select your inquiry type');
      return;
    }

    setSending(true);
    setError('');

    try {
      if (user) {
        const { data: existingConversation, error: convCheckError } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', user.id);

        if (convCheckError) throw convCheckError;

        let conversationId = null;

        if (existingConversation && existingConversation.length > 0) {
          const convIds = existingConversation.map(p => p.conversation_id);
          const { data: lenderConvs } = await supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', lenderId)
            .in('conversation_id', convIds);

          if (lenderConvs && lenderConvs.length > 0) {
            conversationId = lenderConvs[0].conversation_id;
          }
        }

        if (!conversationId) {
          const { data: newConversation, error: convError } = await supabase
            .from('conversations')
            .insert({})
            .select()
            .single();

          if (convError) throw convError;
          conversationId = newConversation.id;

          await supabase
            .from('conversation_participants')
            .insert([
              { conversation_id: conversationId, user_id: user.id },
              { conversation_id: conversationId, user_id: lenderId },
            ]);
        }

        const messageContent = `${formData.message}${formData.propertyType ? `\n\nProperty Type: ${formData.propertyType}` : ''}`;

        await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: messageContent,
          });

        const { data: userProfile } = await supabase
          .from('profiles')
          .select('full_name, email, phone_number')
          .eq('id', user.id)
          .maybeSingle();

        const { data: existingLead } = await supabase
          .from('lender_leads')
          .select('id')
          .eq('lender_id', lenderId)
          .eq('email', userProfile?.email || '')
          .maybeSingle();

        const leadNotes = `Contact Type: ${contactType}\n${formData.message}${formData.propertyType ? `\nProperty Type: ${formData.propertyType}` : ''}`;

        if (!existingLead && userProfile) {
          await supabase
            .from('lender_leads')
            .insert({
              lender_id: lenderId,
              name: userProfile.full_name || 'Unknown',
              email: userProfile.email || '',
              phone: userProfile.phone_number || null,
              lead_source: 'website',
              status: 'new',
              notes: leadNotes,
              contact_type: contactType,
              property_type: formData.propertyType || null,
              priority: 'medium',
              contacted_at: new Date().toISOString(),
            });
        } else if (existingLead) {
          await supabase
            .from('lender_leads')
            .update({
              notes: leadNotes,
              contact_type: contactType,
              property_type: formData.propertyType || null,
              contacted_at: new Date().toISOString(),
            })
            .eq('id', existingLead.id);
        }

        try {
          const emailApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-lead-notification`;
          await fetch(emailApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              lenderId,
              leadName: userProfile?.full_name || 'Unknown',
              leadEmail: userProfile?.email || '',
              leadPhone: userProfile?.phone_number || null,
              message: messageContent,
              isAuthenticated: true,
            }),
          });
        } catch (emailError) {
          console.error('Failed to send email notification:', emailError);
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
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-lender-lead`;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            lenderId,
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            message: formData.message,
            contactType,
            propertyType: formData.propertyType,
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
            if (confirm('Your inquiry has been sent to the lender! Would you like to create an account to track your conversations?')) {
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
          <h2 className="text-2xl font-bold text-gray-800">Contact {lenderName}</h2>
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
              I'm interested in: *
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setContactType('buyer')}
                className={`py-3 px-4 rounded-md border-2 transition font-medium ${
                  contactType === 'buyer'
                    ? 'border-green-600 bg-green-50 text-green-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                <Home size={20} className="mx-auto mb-1" />
                <span className="text-xs">Buying</span>
              </button>
              <button
                type="button"
                onClick={() => setContactType('seller')}
                className={`py-3 px-4 rounded-md border-2 transition font-medium ${
                  contactType === 'seller'
                    ? 'border-green-600 bg-green-50 text-green-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                <DollarSign size={20} className="mx-auto mb-1" />
                <span className="text-xs">Selling</span>
              </button>
              <button
                type="button"
                onClick={() => setContactType('refinancing')}
                className={`py-3 px-4 rounded-md border-2 transition font-medium ${
                  contactType === 'refinancing'
                    ? 'border-green-600 bg-green-50 text-green-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                <Home size={20} className="mx-auto mb-1" />
                <span className="text-xs">Refinancing</span>
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
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
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
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
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
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Property Type
            </label>
            <select
              value={formData.propertyType}
              onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Select property type</option>
              <option value="Single Family Home">Single Family Home</option>
              <option value="Condo">Condo</option>
              <option value="Townhouse">Townhouse</option>
              <option value="Multi-Family">Multi-Family</option>
              <option value="Investment Property">Investment Property</option>
            </select>
          </div>

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
                placeholder="Tell the lender about your financing needs..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {!user && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                <strong>Tip:</strong> Create an account to track your conversations and get faster responses from lenders.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={sending || success}
              className="flex-1 flex items-center justify-center bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
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
