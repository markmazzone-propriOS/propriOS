/*
  # Fix All User Deletion Foreign Keys

  ## Overview
  This migration comprehensively fixes all foreign key constraints that reference
  auth.users or profiles to ensure user accounts can be deleted without violations.

  ## Strategy
  - CASCADE: For tracking/activity data that should be deleted with the user
  - SET NULL: For historical/audit data that should be preserved
  
  ## Tables Fixed
  1. properties.seller_id - SET NULL (preserve property records)
  2. lender_team_members.user_id - CASCADE (team member record is meaningless without user)
  3. application_notes.lender_user_id - SET NULL (preserve notes for history)
  4. lender_consultations.buyer_id - SET NULL (preserve consultation records)
  5. application_assignments - SET NULL (preserve assignment history)
  6. referral_tracking.buyer_id - SET NULL (preserve referral data)
  7. pre_approval_letters.buyer_id - SET NULL (preserve letter history)
  8. compliance_checklists.completed_by - SET NULL (preserve who completed it)
  9. property_views_detailed.viewer_id - CASCADE (tracking data)
  10. property_search_discoveries.user_id - CASCADE (user-specific data)
  11. property_claims.approved_by - SET NULL (preserve approval history)
  12. lender_external_reviews.imported_by - SET NULL (preserve import history)
  13. lender_leads.assigned_to - SET NULL (preserve lead history)
  14. lender_lead_activities.created_by - SET NULL (preserve activity history)
*/

-- 1. Fix properties.seller_id
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'properties' AND column_name = 'seller_id'
  ) THEN
    -- Drop constraint if exists
    ALTER TABLE properties 
    DROP CONSTRAINT IF EXISTS properties_seller_id_fkey;
    
    -- Recreate with SET NULL
    ALTER TABLE properties 
    ADD CONSTRAINT properties_seller_id_fkey 
    FOREIGN KEY (seller_id) 
    REFERENCES profiles(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Fix lender_team_members.user_id
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lender_team_members' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE lender_team_members 
    DROP CONSTRAINT IF EXISTS lender_team_members_user_id_fkey;
    
    ALTER TABLE lender_team_members 
    ADD CONSTRAINT lender_team_members_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Fix application_notes.lender_user_id
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'application_notes' AND column_name = 'lender_user_id'
  ) THEN
    ALTER TABLE application_notes 
    DROP CONSTRAINT IF EXISTS application_notes_lender_user_id_fkey;
    
    ALTER TABLE application_notes 
    ADD CONSTRAINT application_notes_lender_user_id_fkey 
    FOREIGN KEY (lender_user_id) 
    REFERENCES profiles(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Fix lender_consultations.buyer_id
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lender_consultations' AND column_name = 'buyer_id'
  ) THEN
    ALTER TABLE lender_consultations 
    DROP CONSTRAINT IF EXISTS lender_consultations_buyer_id_fkey;
    
    ALTER TABLE lender_consultations 
    ADD CONSTRAINT lender_consultations_buyer_id_fkey 
    FOREIGN KEY (buyer_id) 
    REFERENCES profiles(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Fix application_assignments.assigned_to
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'application_assignments' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE application_assignments 
    DROP CONSTRAINT IF EXISTS application_assignments_assigned_to_fkey;
    
    ALTER TABLE application_assignments 
    ADD CONSTRAINT application_assignments_assigned_to_fkey 
    FOREIGN KEY (assigned_to) 
    REFERENCES profiles(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- 6. Fix application_assignments.assigned_by
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'application_assignments' AND column_name = 'assigned_by'
  ) THEN
    ALTER TABLE application_assignments 
    DROP CONSTRAINT IF EXISTS application_assignments_assigned_by_fkey;
    
    ALTER TABLE application_assignments 
    ADD CONSTRAINT application_assignments_assigned_by_fkey 
    FOREIGN KEY (assigned_by) 
    REFERENCES profiles(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- 7. Fix referral_tracking.buyer_id
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'referral_tracking' AND column_name = 'buyer_id'
  ) THEN
    ALTER TABLE referral_tracking 
    DROP CONSTRAINT IF EXISTS referral_tracking_buyer_id_fkey;
    
    ALTER TABLE referral_tracking 
    ADD CONSTRAINT referral_tracking_buyer_id_fkey 
    FOREIGN KEY (buyer_id) 
    REFERENCES profiles(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- 8. Fix pre_approval_letters.buyer_id
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pre_approval_letters' AND column_name = 'buyer_id'
  ) THEN
    ALTER TABLE pre_approval_letters 
    DROP CONSTRAINT IF EXISTS pre_approval_letters_buyer_id_fkey;
    
    ALTER TABLE pre_approval_letters 
    ADD CONSTRAINT pre_approval_letters_buyer_id_fkey 
    FOREIGN KEY (buyer_id) 
    REFERENCES profiles(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- 9. Fix compliance_checklists.completed_by
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'compliance_checklists' AND column_name = 'completed_by'
  ) THEN
    ALTER TABLE compliance_checklists 
    DROP CONSTRAINT IF EXISTS compliance_checklists_completed_by_fkey;
    
    ALTER TABLE compliance_checklists 
    ADD CONSTRAINT compliance_checklists_completed_by_fkey 
    FOREIGN KEY (completed_by) 
    REFERENCES profiles(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- 10. Fix property_views_detailed.viewer_id
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'property_views_detailed' AND column_name = 'viewer_id'
  ) THEN
    ALTER TABLE property_views_detailed 
    DROP CONSTRAINT IF EXISTS property_views_detailed_viewer_id_fkey;
    
    ALTER TABLE property_views_detailed 
    ADD CONSTRAINT property_views_detailed_viewer_id_fkey 
    FOREIGN KEY (viewer_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- 11. Fix property_search_discoveries.user_id
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'property_search_discoveries' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE property_search_discoveries 
    DROP CONSTRAINT IF EXISTS property_search_discoveries_user_id_fkey;
    
    ALTER TABLE property_search_discoveries 
    ADD CONSTRAINT property_search_discoveries_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- 12. Fix property_claims.approved_by
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'property_claims' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE property_claims 
    DROP CONSTRAINT IF EXISTS property_claims_approved_by_fkey;
    
    ALTER TABLE property_claims 
    ADD CONSTRAINT property_claims_approved_by_fkey 
    FOREIGN KEY (approved_by) 
    REFERENCES profiles(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- 13. Fix lender_external_reviews.imported_by
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lender_external_reviews' AND column_name = 'imported_by'
  ) THEN
    ALTER TABLE lender_external_reviews 
    DROP CONSTRAINT IF EXISTS lender_external_reviews_imported_by_fkey;
    
    ALTER TABLE lender_external_reviews 
    ADD CONSTRAINT lender_external_reviews_imported_by_fkey 
    FOREIGN KEY (imported_by) 
    REFERENCES profiles(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- 14. Fix lender_leads.assigned_to
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lender_leads' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE lender_leads 
    DROP CONSTRAINT IF EXISTS lender_leads_assigned_to_fkey;
    
    ALTER TABLE lender_leads 
    ADD CONSTRAINT lender_leads_assigned_to_fkey 
    FOREIGN KEY (assigned_to) 
    REFERENCES profiles(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- 15. Fix lender_lead_activities.created_by
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lender_lead_activities' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE lender_lead_activities 
    DROP CONSTRAINT IF EXISTS lender_lead_activities_created_by_fkey;
    
    ALTER TABLE lender_lead_activities 
    ADD CONSTRAINT lender_lead_activities_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES profiles(id) 
    ON DELETE SET NULL;
  END IF;
END $$;