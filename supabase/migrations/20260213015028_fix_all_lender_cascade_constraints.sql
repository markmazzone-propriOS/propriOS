/*
  # Fix All Lender Cascade Constraints

  ## Overview
  Updates all foreign key constraints that reference mortgage_lender_profiles
  to cascade on delete, preventing errors when deleting lender accounts.

  ## Changes
  - Updates 10 foreign key constraints to cascade
  - Covers all tables that reference mortgage_lender_profiles
*/

-- Pre-approval letters
ALTER TABLE pre_approval_letters 
DROP CONSTRAINT IF EXISTS pre_approval_letters_lender_id_fkey;

ALTER TABLE pre_approval_letters
ADD CONSTRAINT pre_approval_letters_lender_id_fkey 
FOREIGN KEY (lender_id) 
REFERENCES mortgage_lender_profiles(id) 
ON DELETE CASCADE;

-- Lender team members
ALTER TABLE lender_team_members 
DROP CONSTRAINT IF EXISTS lender_team_members_lender_id_fkey;

ALTER TABLE lender_team_members
ADD CONSTRAINT lender_team_members_lender_id_fkey 
FOREIGN KEY (lender_id) 
REFERENCES mortgage_lender_profiles(id) 
ON DELETE CASCADE;

-- Lender consultations
ALTER TABLE lender_consultations 
DROP CONSTRAINT IF EXISTS lender_consultations_lender_id_fkey;

ALTER TABLE lender_consultations
ADD CONSTRAINT lender_consultations_lender_id_fkey 
FOREIGN KEY (lender_id) 
REFERENCES mortgage_lender_profiles(id) 
ON DELETE CASCADE;

-- Referral tracking
ALTER TABLE referral_tracking 
DROP CONSTRAINT IF EXISTS referral_tracking_lender_id_fkey;

ALTER TABLE referral_tracking
ADD CONSTRAINT referral_tracking_lender_id_fkey 
FOREIGN KEY (lender_id) 
REFERENCES mortgage_lender_profiles(id) 
ON DELETE CASCADE;

-- Lender reviews
ALTER TABLE lender_reviews 
DROP CONSTRAINT IF EXISTS lender_reviews_lender_id_fkey;

ALTER TABLE lender_reviews
ADD CONSTRAINT lender_reviews_lender_id_fkey 
FOREIGN KEY (lender_id) 
REFERENCES mortgage_lender_profiles(id) 
ON DELETE CASCADE;

-- Lender lead activities
ALTER TABLE lender_lead_activities 
DROP CONSTRAINT IF EXISTS lender_lead_activities_lender_id_fkey;

ALTER TABLE lender_lead_activities
ADD CONSTRAINT lender_lead_activities_lender_id_fkey 
FOREIGN KEY (lender_id) 
REFERENCES mortgage_lender_profiles(id) 
ON DELETE CASCADE;

-- Lender lead tasks
ALTER TABLE lender_lead_tasks 
DROP CONSTRAINT IF EXISTS lender_lead_tasks_lender_id_fkey;

ALTER TABLE lender_lead_tasks
ADD CONSTRAINT lender_lead_tasks_lender_id_fkey 
FOREIGN KEY (lender_id) 
REFERENCES mortgage_lender_profiles(id) 
ON DELETE CASCADE;

-- Invitations
ALTER TABLE invitations 
DROP CONSTRAINT IF EXISTS invitations_mortgage_lender_id_fkey;

ALTER TABLE invitations
ADD CONSTRAINT invitations_mortgage_lender_id_fkey 
FOREIGN KEY (mortgage_lender_id) 
REFERENCES mortgage_lender_profiles(id) 
ON DELETE CASCADE;

-- Lender lead reminders
ALTER TABLE lender_lead_reminders 
DROP CONSTRAINT IF EXISTS lender_lead_reminders_lender_id_fkey;

ALTER TABLE lender_lead_reminders
ADD CONSTRAINT lender_lead_reminders_lender_id_fkey 
FOREIGN KEY (lender_id) 
REFERENCES mortgage_lender_profiles(id) 
ON DELETE CASCADE;