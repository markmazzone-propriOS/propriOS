/*
  # Create Email Notification Logs

  Creates a table to log all email notification attempts for debugging.

  1. New Tables
    - `email_notification_logs`
      - `id` (uuid, primary key)
      - `function_name` (text) - Name of the edge function
      - `recipient_email` (text) - Email address sent to
      - `subject` (text) - Email subject line
      - `status` (text) - success or error
      - `resend_response` (jsonb) - Response from Resend API
      - `error_message` (text) - Error message if failed
      - `created_at` (timestamptz) - When the log was created

  2. Security
    - Enable RLS
    - Only admins can view logs
*/

CREATE TABLE IF NOT EXISTS email_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  recipient_email text NOT NULL,
  subject text,
  status text NOT NULL CHECK (status IN ('success', 'error')),
  resend_response jsonb,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email logs"
  ON email_notification_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_notification_logs(recipient_email);
