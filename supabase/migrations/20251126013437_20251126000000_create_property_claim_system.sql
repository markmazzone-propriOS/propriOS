/*
  # Create Property Claim System

  ## Overview
  This migration creates a system where agents in a geographical area can claim unassigned properties
  when buyers show interest. When a buyer views an unassigned property, nearby agents are notified
  and can claim the listing.

  ## New Tables

  ### `property_claim_requests`
  Tracks all property claim requests from agents
  - `id` (uuid, primary key)
  - `property_id` (uuid, references properties) - The property being claimed
  - `agent_id` (uuid, references profiles) - The agent requesting to claim
  - `status` (text) - pending, approved, rejected
  - `message` (text) - Optional message from agent explaining why they should get it
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  - `approved_at` (timestamptz, nullable)
  - `approved_by` (uuid, nullable) - Could be seller or admin who approved

  ### `agent_claim_notifications`
  Tracks which agents have been notified about unassigned properties
  - `id` (uuid, primary key)
  - `property_id` (uuid, references properties)
  - `agent_id` (uuid, references profiles)
  - `buyer_id` (uuid, references profiles) - The buyer who viewed the property
  - `notified_at` (timestamptz)
  - `viewed` (boolean) - Whether agent has seen the notification
  - `viewed_at` (timestamptz, nullable)

  ## Functions

  ### `notify_nearby_agents_on_property_view()`
  Triggered when a buyer views an unassigned property. Finds agents within 50 miles
  and creates notifications for them.

  ### `auto_approve_first_claim()`
  Automatically approves the first claim request for an unassigned property and assigns
  the agent to the property.

  ## Security
  - RLS enabled on all tables
  - Agents can view their own claim requests and notifications
  - Sellers can view claims for their properties
  - Only authenticated users can create claims
*/

-- Create property claim requests table
CREATE TABLE IF NOT EXISTS property_claim_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES profiles(id),
  UNIQUE(property_id, agent_id)
);

-- Create agent claim notifications table
CREATE TABLE IF NOT EXISTS agent_claim_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notified_at timestamptz DEFAULT now(),
  viewed boolean DEFAULT false,
  viewed_at timestamptz,
  UNIQUE(property_id, agent_id, buyer_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_claim_requests_property ON property_claim_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_claim_requests_agent ON property_claim_requests(agent_id);
CREATE INDEX IF NOT EXISTS idx_claim_requests_status ON property_claim_requests(status);
CREATE INDEX IF NOT EXISTS idx_claim_notifications_agent ON agent_claim_notifications(agent_id);
CREATE INDEX IF NOT EXISTS idx_claim_notifications_property ON agent_claim_notifications(property_id);
CREATE INDEX IF NOT EXISTS idx_claim_notifications_viewed ON agent_claim_notifications(viewed) WHERE viewed = false;

-- Enable RLS
ALTER TABLE property_claim_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_claim_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for property_claim_requests

-- Agents can view their own claims
CREATE POLICY "Agents can view own claim requests"
  ON property_claim_requests FOR SELECT
  TO authenticated
  USING (
    agent_id = auth.uid()
  );

-- Sellers can view claims for their properties
CREATE POLICY "Sellers can view claims for their properties"
  ON property_claim_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_claim_requests.property_id
      AND properties.seller_id = auth.uid()
    )
  );

-- Agents can create claim requests
CREATE POLICY "Agents can create claim requests"
  ON property_claim_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    agent_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'agent'
    )
  );

-- Agents can update their own pending claims
CREATE POLICY "Agents can update own pending claims"
  ON property_claim_requests FOR UPDATE
  TO authenticated
  USING (
    agent_id = auth.uid()
    AND status = 'pending'
  )
  WITH CHECK (
    agent_id = auth.uid()
  );

-- RLS Policies for agent_claim_notifications

-- Agents can view their own notifications
CREATE POLICY "Agents can view own notifications"
  ON agent_claim_notifications FOR SELECT
  TO authenticated
  USING (
    agent_id = auth.uid()
  );

-- Agents can update their own notifications (mark as viewed)
CREATE POLICY "Agents can update own notifications"
  ON agent_claim_notifications FOR UPDATE
  TO authenticated
  USING (
    agent_id = auth.uid()
  )
  WITH CHECK (
    agent_id = auth.uid()
  );

-- System can insert notifications
CREATE POLICY "System can insert notifications"
  ON agent_claim_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to notify nearby agents when buyer views unassigned property
CREATE OR REPLACE FUNCTION notify_nearby_agents_on_property_view()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_property RECORD;
  v_buyer RECORD;
  v_agent RECORD;
  v_notification_count integer := 0;
BEGIN
  -- Get property details
  SELECT p.*, p.agent_id, p.listing_type, p.latitude, p.longitude, p.city, p.state
  INTO v_property
  FROM properties p
  WHERE p.id = NEW.property_id;

  -- Only proceed if property is unassigned (no agent) and is for sale
  IF v_property.agent_id IS NOT NULL OR v_property.listing_type != 'sale' THEN
    RETURN NEW;
  END IF;

  -- Get buyer details
  SELECT * INTO v_buyer
  FROM profiles
  WHERE id = NEW.user_id
  AND user_type IN ('buyer', 'seller');

  -- Only proceed if viewer is a buyer
  IF v_buyer.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find nearby agents (within same state, prioritize same city)
  FOR v_agent IN
    SELECT DISTINCT a.id, a.city, a.state, p.full_name
    FROM agent_profiles a
    INNER JOIN profiles p ON p.id = a.id
    WHERE a.state = v_property.state
    AND p.user_type = 'agent'
    AND a.id != NEW.user_id
    ORDER BY
      CASE WHEN a.city = v_property.city THEN 0 ELSE 1 END,
      a.created_at DESC
    LIMIT 20
  LOOP
    -- Create notification record
    INSERT INTO agent_claim_notifications (
      property_id,
      agent_id,
      buyer_id,
      notified_at,
      viewed
    ) VALUES (
      NEW.property_id,
      v_agent.id,
      v_buyer.id,
      now(),
      false
    )
    ON CONFLICT (property_id, agent_id, buyer_id) DO NOTHING;

    v_notification_count := v_notification_count + 1;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger for buyer property views
DROP TRIGGER IF EXISTS trigger_notify_agents_on_view ON property_views;
CREATE TRIGGER trigger_notify_agents_on_view
  AFTER INSERT ON property_views
  FOR EACH ROW
  EXECUTE FUNCTION notify_nearby_agents_on_property_view();

-- Function to auto-approve first claim and assign agent to property
CREATE OR REPLACE FUNCTION auto_approve_first_claim()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_property RECORD;
  v_existing_claims integer;
BEGIN
  -- Only proceed for new pending claims
  IF NEW.status != 'pending' OR TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Get property details
  SELECT * INTO v_property
  FROM properties
  WHERE id = NEW.property_id;

  -- Only proceed if property is unassigned
  IF v_property.agent_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Check if this is the first claim
  SELECT COUNT(*) INTO v_existing_claims
  FROM property_claim_requests
  WHERE property_id = NEW.property_id
  AND id != NEW.id;

  -- If this is the first claim, auto-approve it
  IF v_existing_claims = 0 THEN
    -- Update the claim to approved
    UPDATE property_claim_requests
    SET
      status = 'approved',
      approved_at = now(),
      approved_by = NEW.agent_id,
      updated_at = now()
    WHERE id = NEW.id;

    -- Assign agent to property
    UPDATE properties
    SET
      agent_id = NEW.agent_id,
      updated_at = now()
    WHERE id = NEW.property_id;

    -- Create activity feed entry for agent
    INSERT INTO activity_feed (
      user_id,
      activity_type,
      title,
      description,
      related_entity_type,
      related_entity_id,
      created_at
    ) VALUES (
      NEW.agent_id,
      'property_claimed',
      'Property Claimed',
      'You successfully claimed a new property listing',
      'property',
      NEW.property_id,
      now()
    );

    -- Return the updated record
    SELECT * INTO NEW FROM property_claim_requests WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for auto-approving first claim
DROP TRIGGER IF EXISTS trigger_auto_approve_first_claim ON property_claim_requests;
CREATE TRIGGER trigger_auto_approve_first_claim
  AFTER INSERT ON property_claim_requests
  FOR EACH ROW
  EXECUTE FUNCTION auto_approve_first_claim();
