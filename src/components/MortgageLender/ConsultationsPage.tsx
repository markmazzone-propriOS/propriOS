import { useState, useEffect } from 'react';
import { Calendar, Video, Phone, MapPin, Plus, X, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';

type Consultation = {
  id: string;
  lender_id: string;
  buyer_id: string;
  consultation_date: string;
  duration_minutes: number;
  consultation_type: string;
  notes: string | null;
  status: string;
  created_at: string;
  buyer_name?: string;
  buyer_email?: string;
};

export function ConsultationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [buyerEmail, setBuyerEmail] = useState('');
  const [consultationDate, setConsultationDate] = useState('');
  const [consultationType, setConsultationType] = useState('phone');
  const [duration, setDuration] = useState('30');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadConsultations();
  }, []);

  const loadConsultations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lender_consultations')
        .select(`
          *,
          profiles!lender_consultations_buyer_id_fkey(full_name, email)
        `)
        .eq('lender_id', user!.id)
        .order('consultation_date', { ascending: true });

      if (error) throw error;

      const formatted = data.map((consult: any) => ({
        ...consult,
        buyer_name: consult.profiles?.full_name || 'Unknown',
        buyer_email: consult.profiles?.email || ''
      }));

      setConsultations(formatted);
    } catch (err) {
      console.error('Error loading consultations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const { data: buyer } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', buyerEmail)
        .maybeSingle();

      if (!buyer) {
        setError('Buyer not found');
        setSubmitting(false);
        return;
      }

      const { error: insertError } = await supabase
        .from('lender_consultations')
        .insert({
          lender_id: user!.id,
          buyer_id: buyer.id,
          consultation_date: consultationDate,
          duration_minutes: parseInt(duration),
          consultation_type: consultationType,
          notes: notes || null,
          status: 'scheduled'
        });

      if (insertError) throw insertError;

      setBuyerEmail('');
      setConsultationDate('');
      setConsultationType('phone');
      setDuration('30');
      setNotes('');
      setShowNew(false);
      loadConsultations();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule consultation');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (consultationId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('lender_consultations')
        .update({ status })
        .eq('id', consultationId);

      if (error) throw error;
      loadConsultations();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video size={20} className="text-blue-600" />;
      case 'in_person':
        return <MapPin size={20} className="text-green-600" />;
      default:
        return <Phone size={20} className="text-orange-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'no_show':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading consultations...</p>
        </div>
      </div>
    );
  }

  const upcoming = consultations.filter(c => c.status === 'scheduled' && new Date(c.consultation_date) > new Date());
  const past = consultations.filter(c => c.status !== 'scheduled' || new Date(c.consultation_date) <= new Date());

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b mb-8">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <button
            onClick={() => navigate('/lender/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4 transition"
          >
            <ArrowLeft size={20} />
            <span>Back to Dashboard</span>
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Consultations</h1>
              <p className="text-gray-600 mt-2">Manage buyer consultations and meetings</p>
            </div>
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              <Plus size={20} />
              <span>Schedule Consultation</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-12 space-y-8">
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4">Upcoming Consultations</h2>
          {upcoming.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <Calendar size={48} className="mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600">No upcoming consultations</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcoming.map((consult) => (
                <div key={consult.id} className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1">
                      {getTypeIcon(consult.consultation_type)}
                      <div>
                        <h3 className="font-semibold text-gray-800">{consult.buyer_name}</h3>
                        <p className="text-sm text-gray-500">{consult.buyer_email}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(consult.status)}`}>
                      {consult.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} />
                      <span>{formatDateTime(consult.consultation_date)}</span>
                    </div>
                    <span>•</span>
                    <span>{consult.duration_minutes} minutes</span>
                    <span>•</span>
                    <span className="capitalize">{consult.consultation_type.replace('_', ' ')}</span>
                  </div>
                  {consult.notes && (
                    <p className="text-sm text-gray-700 bg-gray-50 rounded p-3 mb-4">{consult.notes}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateStatus(consult.id, 'completed')}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition text-sm"
                    >
                      <CheckCircle size={16} />
                      <span>Mark Complete</span>
                    </button>
                    <button
                      onClick={() => updateStatus(consult.id, 'cancelled')}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition text-sm"
                    >
                      <XCircle size={16} />
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4">Past Consultations</h2>
          {past.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <p className="text-gray-600">No past consultations</p>
            </div>
          ) : (
            <div className="space-y-4">
              {past.map((consult) => (
                <div key={consult.id} className="bg-white rounded-lg shadow-md p-6 opacity-75">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {getTypeIcon(consult.consultation_type)}
                      <div>
                        <h3 className="font-semibold text-gray-800">{consult.buyer_name}</h3>
                        <p className="text-sm text-gray-500">{formatDateTime(consult.consultation_date)}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(consult.status)}`}>
                      {consult.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Schedule Consultation</h2>

            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSchedule} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Buyer Email *
                </label>
                <input
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date & Time *
                </label>
                <input
                  type="datetime-local"
                  value={consultationDate}
                  onChange={(e) => setConsultationDate(e.target.value)}
                  required
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type *
                  </label>
                  <select
                    value={consultationType}
                    onChange={(e) => setConsultationType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="phone">Phone</option>
                    <option value="video">Video</option>
                    <option value="in_person">In Person</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration *
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">1 hour</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowNew(false);
                    setError('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {submitting ? 'Scheduling...' : 'Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
