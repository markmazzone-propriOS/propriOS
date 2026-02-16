/*
  # Create Activity Feed System

  ## Overview
  Creates a comprehensive activity feed system to track important actions across all user types (buyers, sellers, agents, and service providers).

  ## New Tables
  1. `activity_feed`
    - `id` (uuid, primary key)
    - `user_id` (uuid, references profiles) - User who will see this activity
    - `actor_id` (uuid, references profiles) - User who performed the action (optional)
    - `activity_type` (text) - Type of activity
    - `title` (text) - Activity title/summary
    - `description` (text) - Detailed description
    - `reference_id` (uuid) - ID of related entity (property, offer, appointment, etc.)
    - `reference_type` (text) - Type of related entity
    - `metadata` (jsonb) - Additional flexible data
    - `read` (boolean) - Whether user has read this activity
    - `created_at` (timestamptz)

  ## Activity Types
  - property_listed
  - property_favorited
  - offer_received
  - offer_accepted
  - offer_rejected
  - offer_countered
  - viewing_scheduled
  - viewing_cancelled
  - viewing_rescheduled
  - message_received
  - document_shared
  - invitation_received
  - invitation_accepted
  - review_received
  - appointment_scheduled
  - appointment_cancelled
  - lead_received
  - invoice_sent
  - invoice_paid
  - agent_assigned
  - property_sold

  ## Security
  - RLS enabled
  - Users can only view their own activities
  - Activities created by system triggers
*/

-- Create activity_feed table
CREATE TABLE IF NOT EXISTS activity_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  activity_type text NOT NULL,
  title text NOT NULL,
  description text,
  reference_id uuid,
  reference_type text,
  metadata jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_feed_user ON activity_feed(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_read ON activity_feed(user_id, read);
CREATE INDEX IF NOT EXISTS idx_activity_feed_type ON activity_feed(activity_type);

-- Enable RLS
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;

-- Users can view their own activities
CREATE POLICY "Users can view own activities"
  ON activity_feed FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own activities (mark as read)
CREATE POLICY "Users can update own activities"
  ON activity_feed FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- System can insert activities (through triggers)
CREATE POLICY "System can insert activities"
  ON activity_feed FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to create activity
CREATE OR REPLACE FUNCTION create_activity(
  p_user_id uuid,
  p_actor_id uuid,
  p_activity_type text,
  p_title text,
  p_description text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid AS $$
DECLARE
  v_activity_id uuid;
BEGIN
  INSERT INTO activity_feed (
    user_id,
    actor_id,
    activity_type,
    title,
    description,
    reference_id,
    reference_type,
    metadata
  ) VALUES (
    p_user_id,
    p_actor_id,
    p_activity_type,
    p_title,
    p_description,
    p_reference_id,
    p_reference_type,
    p_metadata
  ) RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new property listings (notify agent)
CREATE OR REPLACE FUNCTION notify_agent_property_listed() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.agent_id IS NOT NULL THEN
    PERFORM create_activity(
      NEW.agent_id,
      NEW.seller_id,
      'property_listed',
      'New Property Listed',
      'A new property has been listed at ' || NEW.address,
      NEW.id,
      'property',
      jsonb_build_object('address', NEW.address, 'price', NEW.price)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_property_listed
  AFTER INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION notify_agent_property_listed();

-- Trigger for offer received (notify seller and agent)
CREATE OR REPLACE FUNCTION notify_offer_received() RETURNS TRIGGER AS $$
DECLARE
  v_property record;
BEGIN
  SELECT * INTO v_property FROM properties WHERE id = NEW.property_id;
  
  -- Notify seller
  IF v_property.seller_id IS NOT NULL THEN
    PERFORM create_activity(
      v_property.seller_id,
      NEW.buyer_id,
      'offer_received',
      'New Offer Received',
      'You received an offer of $' || NEW.offer_amount || ' on your property',
      NEW.id,
      'offer',
      jsonb_build_object('property_address', v_property.address, 'offer_amount', NEW.offer_amount)
    );
  END IF;
  
  -- Notify agent
  IF v_property.agent_id IS NOT NULL THEN
    PERFORM create_activity(
      v_property.agent_id,
      NEW.buyer_id,
      'offer_received',
      'New Offer on Property',
      'An offer of $' || NEW.offer_amount || ' was received for ' || v_property.address,
      NEW.id,
      'offer',
      jsonb_build_object('property_address', v_property.address, 'offer_amount', NEW.offer_amount)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_offer_received
  AFTER INSERT ON property_offers
  FOR EACH ROW
  EXECUTE FUNCTION notify_offer_received();

-- Trigger for offer status changes (notify buyer)
CREATE OR REPLACE FUNCTION notify_offer_status_change() RETURNS TRIGGER AS $$
DECLARE
  v_property record;
  v_title text;
  v_description text;
BEGIN
  IF OLD.offer_status != NEW.offer_status THEN
    SELECT * INTO v_property FROM properties WHERE id = NEW.property_id;
    
    CASE NEW.offer_status
      WHEN 'accepted' THEN
        v_title := 'Offer Accepted!';
        v_description := 'Your offer of $' || NEW.offer_amount || ' has been accepted';
      WHEN 'rejected' THEN
        v_title := 'Offer Declined';
        v_description := 'Your offer of $' || NEW.offer_amount || ' was declined';
      WHEN 'countered' THEN
        v_title := 'Counter Offer Received';
        v_description := 'The seller countered with $' || NEW.counter_amount;
      ELSE
        RETURN NEW;
    END CASE;
    
    PERFORM create_activity(
      NEW.buyer_id,
      NULL,
      'offer_' || NEW.offer_status,
      v_title,
      v_description,
      NEW.id,
      'offer',
      jsonb_build_object('property_address', v_property.address, 'status', NEW.offer_status)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_offer_status_change
  AFTER UPDATE ON property_offers
  FOR EACH ROW
  EXECUTE FUNCTION notify_offer_status_change();

-- Trigger for viewing requests (notify agent)
CREATE OR REPLACE FUNCTION notify_viewing_scheduled() RETURNS TRIGGER AS $$
DECLARE
  v_property record;
BEGIN
  SELECT * INTO v_property FROM properties WHERE id = NEW.property_id;
  
  IF v_property.agent_id IS NOT NULL THEN
    PERFORM create_activity(
      v_property.agent_id,
      NEW.user_id,
      'viewing_scheduled',
      'New Viewing Scheduled',
      'A viewing has been scheduled for ' || v_property.address,
      NEW.id,
      'viewing',
      jsonb_build_object('property_address', v_property.address, 'start_time', NEW.start_time)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_viewing_scheduled
  AFTER INSERT ON calendar_events
  FOR EACH ROW
  WHEN (NEW.event_type = 'viewing')
  EXECUTE FUNCTION notify_viewing_scheduled();

-- Trigger for new messages (notify recipient)
CREATE OR REPLACE FUNCTION notify_new_message() RETURNS TRIGGER AS $$
DECLARE
  v_participant record;
  v_sender_name text;
BEGIN
  SELECT full_name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;
  
  FOR v_participant IN 
    SELECT user_id FROM conversation_participants 
    WHERE conversation_id = NEW.conversation_id AND user_id != NEW.sender_id
  LOOP
    PERFORM create_activity(
      v_participant.user_id,
      NEW.sender_id,
      'message_received',
      'New Message',
      v_sender_name || ' sent you a message',
      NEW.conversation_id,
      'conversation',
      jsonb_build_object('preview', substring(NEW.content, 1, 100))
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();

-- Trigger for document sharing (notify recipient)
CREATE OR REPLACE FUNCTION notify_document_shared() RETURNS TRIGGER AS $$
DECLARE
  v_document record;
  v_sharer_name text;
BEGIN
  SELECT * INTO v_document FROM documents WHERE id = NEW.document_id;
  SELECT full_name INTO v_sharer_name FROM profiles WHERE id = NEW.shared_by;
  
  PERFORM create_activity(
    NEW.shared_with,
    NEW.shared_by,
    'document_shared',
    'Document Shared',
    v_sharer_name || ' shared "' || v_document.title || '" with you',
    NEW.document_id,
    'document',
    jsonb_build_object('document_title', v_document.title, 'document_type', v_document.document_type)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_document_shared
  AFTER INSERT ON document_shares
  FOR EACH ROW
  EXECUTE FUNCTION notify_document_shared();

-- Trigger for invitation received
CREATE OR REPLACE FUNCTION notify_invitation_received() RETURNS TRIGGER AS $$
DECLARE
  v_sender_name text;
BEGIN
  SELECT full_name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;
  
  -- Only create activity if email matches a user
  IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND email = NEW.invitee_email) THEN
    PERFORM create_activity(
      auth.uid(),
      NEW.sender_id,
      'invitation_received',
      'New Invitation',
      v_sender_name || ' invited you to join as their ' || NEW.invitee_type,
      NEW.id,
      'invitation',
      jsonb_build_object('invitee_type', NEW.invitee_type)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_invitation_received
  AFTER INSERT ON invitations
  FOR EACH ROW
  EXECUTE FUNCTION notify_invitation_received();

-- Trigger for agent reviews (notify agent)
CREATE OR REPLACE FUNCTION notify_review_received() RETURNS TRIGGER AS $$
DECLARE
  v_reviewer_name text;
BEGIN
  SELECT full_name INTO v_reviewer_name FROM profiles WHERE id = NEW.reviewer_id;
  
  PERFORM create_activity(
    NEW.agent_id,
    NEW.reviewer_id,
    'review_received',
    'New Review Received',
    v_reviewer_name || ' left you a ' || NEW.rating || '-star review',
    NEW.id,
    'review',
    jsonb_build_object('rating', NEW.rating)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_review_received
  AFTER INSERT ON agent_reviews
  FOR EACH ROW
  EXECUTE FUNCTION notify_review_received();

-- Trigger for service provider appointments
CREATE OR REPLACE FUNCTION notify_appointment_scheduled() RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_activity(
    NEW.service_provider_id,
    NULL,
    'appointment_scheduled',
    'New Appointment',
    'New appointment scheduled: ' || NEW.title,
    NEW.id,
    'appointment',
    jsonb_build_object('client_name', NEW.client_name, 'start_time', NEW.start_time)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_appointment_scheduled
  AFTER INSERT ON service_provider_appointments
  FOR EACH ROW
  EXECUTE FUNCTION notify_appointment_scheduled();

-- Trigger for service provider leads
CREATE OR REPLACE FUNCTION notify_lead_received() RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_activity(
    NEW.service_provider_id,
    NULL,
    'lead_received',
    'New Lead Received',
    'New lead from ' || NEW.name || ' via ' || NEW.source,
    NEW.id,
    'lead',
    jsonb_build_object('lead_name', NEW.name, 'source', NEW.source)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_lead_received
  AFTER INSERT ON service_provider_leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_lead_received();

-- Trigger for invoices
CREATE OR REPLACE FUNCTION notify_invoice_sent() RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_activity(
    NEW.service_provider_id,
    NULL,
    'invoice_sent',
    'Invoice Sent',
    'Invoice #' || NEW.invoice_number || ' sent to ' || NEW.client_name,
    NEW.id,
    'invoice',
    jsonb_build_object('invoice_number', NEW.invoice_number, 'amount', NEW.total_amount)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_invoice_sent
  AFTER INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION notify_invoice_sent();

-- Trigger for invoice payment status change
CREATE OR REPLACE FUNCTION notify_invoice_paid() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != 'paid' AND NEW.status = 'paid' THEN
    PERFORM create_activity(
      NEW.service_provider_id,
      NULL,
      'invoice_paid',
      'Invoice Paid',
      'Invoice #' || NEW.invoice_number || ' has been paid',
      NEW.id,
      'invoice',
      jsonb_build_object('invoice_number', NEW.invoice_number, 'amount', NEW.total_amount)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_invoice_paid
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION notify_invoice_paid();

-- Trigger for agent assignment to buyer (notify buyer)
CREATE OR REPLACE FUNCTION notify_agent_assigned() RETURNS TRIGGER AS $$
DECLARE
  v_agent_name text;
BEGIN
  IF OLD.agent_id IS NULL AND NEW.agent_id IS NOT NULL THEN
    SELECT full_name INTO v_agent_name FROM agent_profiles WHERE id = NEW.agent_id;
    
    PERFORM create_activity(
      NEW.id,
      NEW.agent_id,
      'agent_assigned',
      'Agent Assigned',
      v_agent_name || ' is now your real estate agent',
      NEW.agent_id,
      'agent',
      jsonb_build_object('agent_name', v_agent_name)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_agent_assigned
  AFTER UPDATE ON profiles
  FOR EACH ROW
  WHEN (NEW.user_type = 'buyer')
  EXECUTE FUNCTION notify_agent_assigned();

-- Trigger for property favorites
CREATE OR REPLACE FUNCTION notify_property_favorited() RETURNS TRIGGER AS $$
DECLARE
  v_property record;
  v_buyer_name text;
BEGIN
  SELECT * INTO v_property FROM properties WHERE id = NEW.property_id;
  SELECT full_name INTO v_buyer_name FROM profiles WHERE id = NEW.user_id;
  
  -- Notify agent if property has one
  IF v_property.agent_id IS NOT NULL THEN
    PERFORM create_activity(
      v_property.agent_id,
      NEW.user_id,
      'property_favorited',
      'Property Favorited',
      v_buyer_name || ' favorited ' || v_property.address,
      v_property.id,
      'property',
      jsonb_build_object('property_address', v_property.address)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_property_favorited
  AFTER INSERT ON favorites
  FOR EACH ROW
  EXECUTE FUNCTION notify_property_favorited();