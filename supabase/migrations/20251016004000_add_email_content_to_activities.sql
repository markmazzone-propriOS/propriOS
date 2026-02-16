/*
  # Add Email Content Fields to Lead Activities

  ## Overview
  Adds fields to store full email content in lead activities so sent emails can be viewed in the activity feed.

  ## Changes
  1. Add `email_subject` field to store email subject line
  2. Add `email_body` field to store email message content
  3. Add `email_attachment_url` field to store attachment URL
  4. Add `email_attachment_name` field to store attachment file name

  ## Security
  - No RLS changes needed (existing policies apply)
*/

-- Add email content fields to lead_activities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_activities' AND column_name = 'email_subject'
  ) THEN
    ALTER TABLE lead_activities ADD COLUMN email_subject text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_activities' AND column_name = 'email_body'
  ) THEN
    ALTER TABLE lead_activities ADD COLUMN email_body text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_activities' AND column_name = 'email_attachment_url'
  ) THEN
    ALTER TABLE lead_activities ADD COLUMN email_attachment_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_activities' AND column_name = 'email_attachment_name'
  ) THEN
    ALTER TABLE lead_activities ADD COLUMN email_attachment_name text;
  END IF;
END $$;
