/*
  # Fix Email Reply Activity Trigger

  ## Overview
  Updates the email reply trigger to store full email content in lead activities.

  ## Changes
  1. Modify `log_email_reply_to_activities` function to include:
     - email_subject field
     - email_body field (from body_text)
  2. Set created_by to the service provider's ID (from the lead)

  ## Security
  - No RLS changes needed
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS after_email_reply_insert ON lead_email_replies;
DROP FUNCTION IF EXISTS log_email_reply_to_activities();

-- Create improved function to log email replies with full content
CREATE OR REPLACE FUNCTION log_email_reply_to_activities()
RETURNS TRIGGER AS $$
DECLARE
  provider_id uuid;
BEGIN
  -- Get the service provider ID from the lead
  SELECT service_provider_id INTO provider_id
  FROM service_provider_leads
  WHERE id = NEW.lead_id;

  -- Insert activity with full email content
  INSERT INTO lead_activities (
    lead_id,
    activity_type,
    description,
    email_subject,
    email_body,
    created_by,
    created_at
  )
  VALUES (
    NEW.lead_id,
    'email_received',
    'Email received: "' || COALESCE(NEW.subject, '(no subject)') || '"',
    NEW.subject,
    NEW.body_text,
    provider_id,
    NEW.received_at
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER after_email_reply_insert
  AFTER INSERT ON lead_email_replies
  FOR EACH ROW
  EXECUTE FUNCTION log_email_reply_to_activities();
