import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

console.log('[SUPABASE] Initializing Supabase client...');

const supabaseUrl = config.supabase.url;
const supabaseAnonKey = config.supabase.anonKey;

console.log('[SUPABASE] Config:', {
  url: supabaseUrl,
  hasKey: !!supabaseAnonKey,
  keyLength: supabaseAnonKey?.length
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[SUPABASE] ❌ Missing Supabase configuration');
  throw new Error('Supabase configuration is missing. Please check your configuration.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-web'
    }
  },
  db: {
    schema: 'public'
  }
});

console.log('[SUPABASE] ✅ Client created successfully');

// Test connection
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('[SUPABASE] ❌ Connection test failed:', error);
  } else {
    console.log('[SUPABASE] ✅ Connection test successful');
  }
}).catch(err => {
  console.error('[SUPABASE] ❌ Connection test error:', err);
});

export type UserType = 'buyer' | 'seller' | 'renter' | 'property_owner' | 'agent' | 'service_provider' | 'mortgage_lender' | 'brokerage' | 'managed_user';

export type Profile = {
  id: string;
  user_type: UserType;
  full_name: string;
  phone_number: string | null;
  profile_photo_url: string | null;
  assigned_agent_id: string | null;
  is_suspended: boolean;
  suspended_at: string | null;
  suspension_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentProfile = {
  id: string;
  license_number: string;
  star_rating: number;
  languages: string[];
  locations: string[];
  meet_in_person: boolean;
  video_chat: boolean;
  bio: string;
  profile_photo_url: string | null;
  tutorial_completed?: boolean;
  created_at: string;
  updated_at: string;
  profile?: Profile;
};

export type Property = {
  id: string;
  listed_by: string;
  agent_id: string | null;
  listing_type: 'sale' | 'rent';
  price: number;
  estimated_monthly: number | null;
  bedrooms: number;
  bathrooms: number;
  square_footage: number;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip_code: string;
  latitude: number | null;
  longitude: number | null;
  description: string;
  year_built: number | null;
  status: 'active' | 'pending' | 'sold' | 'rented';
  created_at: string;
  updated_at: string;
};

export type PropertyPhoto = {
  id: string;
  property_id: string;
  photo_url: string;
  display_order: number;
  created_at: string;
};

export type Conversation = {
  id: string;
  created_at: string;
  updated_at: string;
  property_id: string | null;
  subject: string | null;
};

export type ConversationParticipant = {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
};

export type BuyerJourneyProgress = {
  id: string;
  buyer_id: string;
  property_id: string | null;
  current_stage: string;
  pre_approval_completed: boolean;
  pre_approval_date: string | null;
  house_hunting_started: boolean;
  house_hunting_date: string | null;
  offer_submitted: boolean;
  offer_submitted_date: string | null;
  offer_accepted: boolean;
  offer_accepted_date: string | null;
  inspection_completed: boolean;
  inspection_date: string | null;
  appraisal_completed: boolean;
  appraisal_date: string | null;
  loan_approved: boolean;
  loan_approved_date: string | null;
  closing_completed: boolean;
  closing_date: string | null;
  created_at: string;
  updated_at: string;
};

export type PropertyFavorite = {
  id: string;
  user_id: string;
  property_id: string;
  created_at: string;
};

export type PropertyView = {
  id: string;
  user_id: string;
  property_id: string;
  viewed_at: string;
  view_count: number;
};

export type PropertyRejection = {
  id: string;
  user_id: string;
  property_id: string;
  rejected_at: string;
  reason: string | null;
};

export type PropertyShare = {
  id: string;
  property_id: string;
  shared_by_user_id: string;
  shared_with_user_id: string;
  conversation_id: string | null;
  message_id: string | null;
  created_at: string;
};

export type Team = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

export type TeamMember = {
  id: string;
  team_id: string;
  agent_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  invited_by: string | null;
  created_at: string;
};

export type TeamInvitation = {
  id: string;
  team_id: string;
  inviter_id: string;
  invitee_email: string;
  invitee_name: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  created_at: string;
  updated_at: string;
};

export type MortgageLender = {
  id: string;
  name: string;
  logo_url: string | null;
  description: string;
  website_url: string;
  phone_number: string | null;
  email: string | null;
  minimum_credit_score: number | null;
  interest_rate_range: string | null;
  loan_types: string[];
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type MortgageLenderProfile = {
  id: string;
  company_name: string;
  nmls_number: string;
  logo_url: string | null;
  bio: string;
  website_url: string | null;
  phone_number: string | null;
  email: string | null;
  minimum_credit_score: number | null;
  interest_rate_range: string | null;
  loan_types: string[];
  years_experience: number | null;
  total_loans_closed: number;
  average_rating: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  profile?: Profile;
};

export type AdminRole = {
  id: string;
  role_name: string;
  can_view_users: boolean;
  can_suspend_users: boolean;
  can_delete_users: boolean;
  can_manage_listings: boolean;
  can_manage_agents: boolean;
  can_manage_lenders: boolean;
  can_manage_providers: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminUser = {
  id: string;
  role_id: string;
  created_at: string;
  updated_at: string;
  role?: AdminRole;
};

export type DocuSignEnvelope = {
  id: string;
  docusign_envelope_id: string | null;
  sender_id: string;
  property_id: string | null;
  subject: string;
  message: string | null;
  status: 'created' | 'sent' | 'delivered' | 'signed' | 'completed' | 'declined' | 'voided';
  sent_at: string | null;
  completed_at: string | null;
  declined_at: string | null;
  voided_at: string | null;
  voided_reason: string | null;
  envelope_metadata: any;
  created_at: string;
  updated_at: string;
  sender?: Profile;
};

export type DocuSignRecipient = {
  id: string;
  envelope_id: string;
  user_id: string | null;
  recipient_email: string;
  recipient_name: string;
  recipient_type: 'signer' | 'carbon_copy' | 'certified_delivery' | 'in_person_signer';
  routing_order: number;
  status: 'created' | 'sent' | 'delivered' | 'signed' | 'completed' | 'declined' | 'authentication_failed' | 'autoresponded';
  sent_at: string | null;
  delivered_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  declined_reason: string | null;
  docusign_recipient_id: string | null;
  recipient_metadata: any;
  created_at: string;
  updated_at: string;
};

export type DocuSignDocument = {
  id: string;
  envelope_id: string;
  document_id: string | null;
  document_name: string;
  document_url: string | null;
  document_order: number;
  docusign_document_id: string | null;
  created_at: string;
};

export type Brokerage = {
  id: string;
  super_admin_id: string;
  company_name: string;
  license_number: string | null;
  phone_number: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
};

export type BrokerageAgent = {
  id: string;
  brokerage_id: string;
  agent_id: string;
  joined_at: string;
  status: 'active' | 'inactive';
};

export type BrokerageInvitation = {
  id: string;
  brokerage_id: string;
  inviter_id: string;
  invitee_email: string;
  invitee_name: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  created_at: string;
  accepted_at: string | null;
};
