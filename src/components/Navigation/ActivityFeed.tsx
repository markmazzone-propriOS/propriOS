import { useState, useEffect } from 'react';
import { Bell, X, Check, Calendar, MessageSquare, FileText, UserPlus, Star, DollarSign, Home, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from './Router';

interface Activity {
  id: string;
  activity_type: string;
  title: string;
  description: string;
  reference_id: string;
  reference_type: string;
  metadata: any;
  read: boolean;
  created_at: string;
  actor_id: string;
}

export default function ActivityFeed() {
  const [isOpen, setIsOpen] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      loadActivities();
      subscribeToActivities();
    }
  }, [user]);

  const loadActivities = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('activity_feed')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setActivities(data || []);
      setUnreadCount(data?.filter(a => !a.read).length || 0);
    } catch (err) {
      console.error('Error loading activities:', err);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToActivities = () => {
    if (!user) return;

    const subscription = supabase
      .channel('activity_feed_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_feed',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadActivities();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const markAsRead = async (activityId: string) => {
    try {
      const { error } = await supabase
        .from('activity_feed')
        .update({ read: true })
        .eq('id', activityId);

      if (error) throw error;

      setActivities(prev =>
        prev.map(a => (a.id === activityId ? { ...a, read: true } : a))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking activity as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('activity_feed')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;

      setActivities(prev => prev.map(a => ({ ...a, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleActivityClick = (activity: Activity) => {
    markAsRead(activity.id);
    setIsOpen(false);

    // Navigate based on activity type and reference
    switch (activity.activity_type) {
      // Lead-related activities (for agents, service providers, property owners)
      case 'lead_received':
      case 'lead_responded':
      case 'prospect_created':
      case 'prospect_status_updated':
      case 'prospect_deleted':
      case 'prospect_invitation_sent':
        if (profile?.user_type === 'agent') {
          navigate('/prospects');
        } else if (profile?.user_type === 'service_provider') {
          navigate('/leads');
        } else if (profile?.user_type === 'property_owner') {
          navigate('/property-owner/leads');
        } else if (profile?.user_type === 'mortgage_lender') {
          navigate('/lender/leads');
        }
        break;

      // Message-related activities
      case 'message_received':
        if (activity.reference_type === 'conversation' && activity.reference_id) {
          navigate(`/messages?conversation=${activity.reference_id}`);
        } else {
          navigate('/messages');
        }
        break;

      // Offer-related activities
      case 'offer_received':
      case 'offer_accepted':
      case 'offer_rejected':
      case 'offer_countered':
        if (profile?.user_type === 'agent') {
          navigate('/agent/dashboard');
        } else if (profile?.user_type === 'seller') {
          navigate('/seller/dashboard');
        } else if (profile?.user_type === 'buyer') {
          navigate('/offers');
        }
        break;

      // Property-related activities
      case 'property_listed':
      case 'property_favorited':
      case 'property_viewed':
        if (activity.reference_type === 'property' && activity.reference_id) {
          navigate(`/property/${activity.reference_id}`);
        }
        break;

      // Viewing/Calendar activities
      case 'viewing_scheduled':
      case 'viewing_cancelled':
      case 'viewing_rescheduled':
      case 'viewing_reminder':
      case 'appointment_scheduled':
      case 'appointment_cancelled':
        if (profile?.user_type === 'buyer' || profile?.user_type === 'renter') {
          navigate('/buyer/calendar');
        } else if (profile?.user_type === 'service_provider') {
          navigate('/service-provider/calendar');
        } else if (profile?.user_type === 'property_owner') {
          navigate('/property-owner/calendar');
        } else {
          navigate('/dashboard');
        }
        break;

      // Document activities
      case 'document_shared':
      case 'document_signed':
      case 'signature_requested':
        navigate('/documents');
        break;

      // Invitation activities
      case 'invitation_received':
      case 'invitation_accepted':
        if (profile?.user_type === 'agent') {
          navigate('/agent/dashboard');
        }
        break;

      // Review activities
      case 'review_received':
        if (profile?.user_type === 'service_provider') {
          navigate('/reviews');
        } else {
          navigate('/dashboard');
        }
        break;

      // Invoice activities
      case 'invoice_sent':
      case 'invoice_paid':
        navigate('/invoices');
        break;

      // Journey/Progress activities
      case 'journey_updated':
      case 'stage_changed':
        navigate('/dashboard');
        break;

      // Prospect reminders
      case 'prospect_reminder':
      case 'prospect_reminder_set':
        if (profile?.user_type === 'agent') {
          navigate('/prospects');
        }
        break;

      // Default to dashboard
      default:
        navigate('/dashboard');
        break;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'property_listed':
      case 'property_favorited':
        return <Home className="w-5 h-5 text-blue-600" />;
      case 'offer_received':
      case 'offer_accepted':
      case 'offer_rejected':
      case 'offer_countered':
        return <DollarSign className="w-5 h-5 text-green-600" />;
      case 'viewing_scheduled':
      case 'viewing_cancelled':
      case 'viewing_rescheduled':
      case 'appointment_scheduled':
      case 'appointment_cancelled':
        return <Calendar className="w-5 h-5 text-purple-600" />;
      case 'message_received':
        return <MessageSquare className="w-5 h-5 text-blue-600" />;
      case 'document_shared':
        return <FileText className="w-5 h-5 text-gray-600" />;
      case 'invitation_received':
      case 'invitation_accepted':
      case 'agent_assigned':
        return <UserPlus className="w-5 h-5 text-indigo-600" />;
      case 'review_received':
        return <Star className="w-5 h-5 text-yellow-600" />;
      case 'lead_received':
      case 'prospect_created':
      case 'prospect_status_updated':
      case 'prospect_deleted':
      case 'prospect_invitation_sent':
        return <TrendingUp className="w-5 h-5 text-emerald-600" />;
      case 'invoice_sent':
      case 'invoice_paid':
        return <DollarSign className="w-5 h-5 text-green-600" />;
      default:
        return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const getActivityColor = (type: string) => {
    if (type.includes('accepted')) return 'bg-green-50 border-green-200';
    if (type.includes('rejected') || type.includes('cancelled') || type.includes('deleted')) return 'bg-red-50 border-red-200';
    if (type.includes('offer')) return 'bg-green-50 border-green-200';
    if (type.includes('message')) return 'bg-blue-50 border-blue-200';
    if (type.includes('review')) return 'bg-yellow-50 border-yellow-200';
    if (type.includes('lead') || type.includes('prospect') || type.includes('invoice_paid')) return 'bg-emerald-50 border-emerald-200';
    return 'bg-gray-50 border-gray-200';
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[600px] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Notifications
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Check className="w-4 h-4" />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="p-8 text-center text-gray-500">
                  Loading notifications...
                </div>
              ) : activities.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !activity.read ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => handleActivityClick(activity)}
                    >
                      <div className="flex gap-3">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border ${getActivityColor(activity.activity_type)}`}>
                          {getActivityIcon(activity.activity_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm ${!activity.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                              {activity.title}
                            </p>
                            {!activity.read && (
                              <span className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-1" />
                            )}
                          </div>
                          {activity.description && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {activity.description}
                              {activity.activity_type === 'prospect_reminder_set' && activity.metadata?.reminder_date && (
                                <span className="block text-xs text-gray-500 mt-1">
                                  Scheduled for: {new Date(activity.metadata.reminder_date).toLocaleString()}
                                </span>
                              )}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {formatTimeAgo(activity.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
