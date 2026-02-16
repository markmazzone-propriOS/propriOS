/*
  # Create Lead Email Replies System

  1. New Tables
    - `lead_email_replies`
      - `id` (uuid, primary key)
      - `lead_id` (uuid, foreign key to service_provider_leads)
      - `from_email` (text) - Email address of the sender
      - `subject` (text) - Email subject
      - `body_text` (text) - Plain text body
      - `body_html` (text) - HTML body
      - `received_at` (timestamptz) - When the email was received
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `lead_email_replies` table
    - Add policy for service providers to view their own lead email replies

  3. Notes
    - This table stores incoming email replies from leads
    - Emails are matched to leads by email address
    - Replies are automatically logged to the activity timeline via trigger
*/

-- Create lead email replies table
CREATE TABLE IF NOT EXISTS lead_email_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES service_provider_leads(id) ON DELETE CASCADE,
  from_email text NOT NULL,
  subject text,
  body_text text,
  body_html text,
  received_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE lead_email_replies ENABLE ROW LEVEL SECURITY;

-- Policy for service providers to view their own lead email replies
CREATE POLICY "Service providers can view their own lead email replies"
  ON lead_email_replies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_provider_leads
      WHERE service_provider_leads.id = lead_email_replies.lead_id
      AND service_provider_leads.service_provider_id = auth.uid()
    )
  );

-- Create trigger to log email replies to activity timeline
CREATE OR REPLACE FUNCTION log_email_reply_to_activities()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO lead_activities (
    lead_id,
    activity_type,
    description,
    created_at
  )
  VALUES (
    NEW.lead_id,
    'email_received',
    'Email received: "' || COALESCE(NEW.subject, '(no subject)') || '"',
    NEW.received_at
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_email_reply_insert
  AFTER INSERT ON lead_email_replies
  FOR EACH ROW
  EXECUTE FUNCTION log_email_reply_to_activities();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_lead_email_replies_lead_id ON lead_email_replies(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_email_replies_from_email ON lead_email_replies(from_email);
