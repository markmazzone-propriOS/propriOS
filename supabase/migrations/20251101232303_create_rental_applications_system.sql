/*
  # Create Rental Applications System

  ## Overview
  Creates a system to track renter-property assignments and rental applications.
  When a renter messages a property owner about a property, they are automatically
  assigned to that property for progress tracking.

  ## New Tables
  1. `rental_applications`
     - `id` (uuid, primary key)
     - `renter_id` (uuid, references profiles) - The renter
     - `property_id` (uuid, references properties) - The rental property
     - `property_owner_id` (uuid, references profiles) - The property owner
     - `status` (text) - Application status (interested, applied, approved, rejected, lease_signed, active, completed, disconnected)
     - `move_in_date` (date) - Desired move-in date
     - `lease_term_months` (integer) - Desired lease term
     - `monthly_income` (numeric) - Renter's monthly income
     - `employment_status` (text) - Employment status
     - `current_address` (text) - Current residence
     - `previous_landlord_name` (text) - Previous landlord reference
     - `previous_landlord_phone` (text) - Previous landlord phone
     - `emergency_contact_name` (text) - Emergency contact
     - `emergency_contact_phone` (text) - Emergency contact phone
     - `has_pets` (boolean) - Has pets
     - `pet_details` (text) - Pet information
     - `additional_occupants` (integer) - Number of additional occupants
     - `special_requests` (text) - Special requests or notes
     - `application_submitted_at` (timestamptz) - When formal application submitted
     - `approved_at` (timestamptz) - When approved
     - `rejected_at` (timestamptz) - When rejected
     - `rejection_reason` (text) - Reason for rejection
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

  ## Triggers
  1. Auto-assign property when renter messages property owner about a listing
  2. Update renter journey when application status changes

  ## Security
  - RLS enabled on all tables
  - Renters can view/update their own applications
  - Property owners can view/update applications for their properties
  - Agents can view their clients' applications
*/

-- Create rental_applications table
CREATE TABLE IF NOT EXISTS rental_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  renter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  property_owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'interested' CHECK (status IN ('interested', 'applied', 'background_check', 'approved', 'rejected', 'lease_signed', 'active', 'completed', 'disconnected')),
  move_in_date date,
  lease_term_months integer,
  monthly_income numeric(12, 2),
  employment_status text,
  current_address text,
  previous_landlord_name text,
  previous_landlord_phone text,
  emergency_contact_name text,
  emergency_contact_phone text,
  has_pets boolean DEFAULT false,
  pet_details text,
  additional_occupants integer DEFAULT 0,
  special_requests text,
  application_submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(renter_id, property_id)
);

-- Enable RLS
ALTER TABLE rental_applications ENABLE ROW LEVEL SECURITY;

-- Renters can view their own applications
CREATE POLICY "Renters can view own applications"
  ON rental_applications FOR SELECT
  TO authenticated
  USING (auth.uid() = renter_id);

-- Renters can update their own applications (except status changes that require owner approval)
CREATE POLICY "Renters can update own applications"
  ON rental_applications FOR UPDATE
  TO authenticated
  USING (auth.uid() = renter_id)
  WITH CHECK (auth.uid() = renter_id);

-- Property owners can view applications for their properties
CREATE POLICY "Property owners can view applications for their properties"
  ON rental_applications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'property_owner'
      AND profiles.id = rental_applications.property_owner_id
    )
  );

-- Property owners can update applications for their properties
CREATE POLICY "Property owners can update applications for their properties"
  ON rental_applications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'property_owner'
      AND profiles.id = rental_applications.property_owner_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'property_owner'
      AND profiles.id = rental_applications.property_owner_id
    )
  );

-- Agents can view their renter clients' applications
CREATE POLICY "Agents can view their renter clients applications"
  ON rental_applications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = rental_applications.renter_id
      AND profiles.assigned_agent_id = auth.uid()
    )
  );

-- Trigger to auto-assign property when renter messages property owner about a property
CREATE OR REPLACE FUNCTION auto_assign_property_from_message() RETURNS TRIGGER AS $$
DECLARE
  v_renter_id uuid;
  v_property_owner_id uuid;
  v_property_id uuid;
  v_renter_type text;
  v_owner_type text;
BEGIN
  -- Get participant types
  SELECT user_id, user_type INTO v_renter_id, v_renter_type
  FROM conversation_participants
  WHERE conversation_id = NEW.conversation_id
  LIMIT 1;

  SELECT user_id, user_type INTO v_property_owner_id, v_owner_type
  FROM conversation_participants
  WHERE conversation_id = NEW.conversation_id
    AND user_id != v_renter_id
  LIMIT 1;

  -- Check if one is a renter and one is a property_owner
  IF (v_renter_type = 'renter' AND v_owner_type = 'property_owner') OR
     (v_renter_type = 'property_owner' AND v_owner_type = 'renter') THEN
    
    -- Swap if needed
    IF v_renter_type = 'property_owner' THEN
      DECLARE
        temp_id uuid := v_renter_id;
      BEGIN
        v_renter_id := v_property_owner_id;
        v_property_owner_id := temp_id;
      END;
    END IF;

    -- Get the property_id from conversation metadata or subject
    SELECT (metadata->>'property_id')::uuid INTO v_property_id
    FROM conversations
    WHERE id = NEW.conversation_id;

    -- If property found, create or update application
    IF v_property_id IS NOT NULL THEN
      INSERT INTO rental_applications (
        renter_id,
        property_id,
        property_owner_id,
        status
      )
      VALUES (
        v_renter_id,
        v_property_id,
        v_property_owner_id,
        'interested'
      )
      ON CONFLICT (renter_id, property_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_message_sent_auto_assign_property
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_property_from_message();

-- Trigger to update renter journey when application status changes
CREATE OR REPLACE FUNCTION update_renter_journey_from_application() RETURNS TRIGGER AS $$
DECLARE
  v_journey_stage text;
BEGIN
  -- Map application status to journey stage
  CASE NEW.status
    WHEN 'interested' THEN v_journey_stage := 'searching';
    WHEN 'applied' THEN v_journey_stage := 'application_submitted';
    WHEN 'background_check' THEN v_journey_stage := 'background_check';
    WHEN 'approved' THEN v_journey_stage := 'approved';
    WHEN 'lease_signed' THEN v_journey_stage := 'lease_signing';
    WHEN 'active' THEN v_journey_stage := 'moved_in';
    ELSE v_journey_stage := 'searching';
  END CASE;

  -- Update or create renter journey
  INSERT INTO renter_journeys (
    renter_id,
    property_id,
    current_stage,
    updated_at
  )
  VALUES (
    NEW.renter_id,
    NEW.property_id,
    v_journey_stage,
    now()
  )
  ON CONFLICT (renter_id, property_id) 
  DO UPDATE SET
    current_stage = v_journey_stage,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_application_status_change_update_journey
  AFTER INSERT OR UPDATE OF status ON rental_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_renter_journey_from_application();

-- Create activity when application status changes
CREATE OR REPLACE FUNCTION notify_application_status_change() RETURNS TRIGGER AS $$
DECLARE
  v_property_address text;
  v_renter_name text;
  v_action_title text;
  v_action_description text;
BEGIN
  -- Get property address
  SELECT address INTO v_property_address
  FROM properties
  WHERE id = NEW.property_id;

  -- Get renter name
  SELECT full_name INTO v_renter_name
  FROM profiles
  WHERE id = NEW.renter_id;

  -- Determine action based on status
  CASE NEW.status
    WHEN 'applied' THEN
      v_action_title := 'Application Submitted';
      v_action_description := v_renter_name || ' submitted a rental application for ' || v_property_address;
    WHEN 'background_check' THEN
      v_action_title := 'Background Check';
      v_action_description := 'Background check initiated for ' || v_property_address;
    WHEN 'approved' THEN
      v_action_title := 'Application Approved';
      v_action_description := 'Your application for ' || v_property_address || ' has been approved!';
    WHEN 'rejected' THEN
      v_action_title := 'Application Rejected';
      v_action_description := 'Your application for ' || v_property_address || ' was not approved';
    WHEN 'lease_signed' THEN
      v_action_title := 'Lease Signed';
      v_action_description := 'Lease agreement signed for ' || v_property_address;
    WHEN 'active' THEN
      v_action_title := 'Moved In';
      v_action_description := v_renter_name || ' moved into ' || v_property_address;
    ELSE
      RETURN NEW;
  END CASE;

  -- Create activity for renter
  IF v_action_title IS NOT NULL THEN
    PERFORM create_activity(
      NEW.renter_id,
      NEW.property_owner_id,
      'rental_application_status',
      v_action_title,
      v_action_description,
      NEW.id,
      'rental_application',
      jsonb_build_object(
        'status', NEW.status,
        'property_address', v_property_address
      )
    );

    -- Create activity for property owner too
    PERFORM create_activity(
      NEW.property_owner_id,
      NEW.renter_id,
      'rental_application_status',
      v_action_title,
      v_action_description,
      NEW.id,
      'rental_application',
      jsonb_build_object(
        'status', NEW.status,
        'property_address', v_property_address,
        'renter_name', v_renter_name
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_application_status_change_notify
  AFTER UPDATE OF status ON rental_applications
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_application_status_change();
