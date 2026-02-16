/*
  # Create SMS Notification System

  1. New Tables
    - `sms_notification_preferences`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles) - User who owns preferences
      - `phone_number` (text) - Phone number for SMS notifications (E.164 format)
      - `verified` (boolean) - Whether phone number is verified
      - `enabled` (boolean) - Master switch for all SMS notifications
      - `notify_on_offer` (boolean) - Send SMS when offer received
      - `notify_on_message` (boolean) - Send SMS for new messages
      - `notify_on_viewing_scheduled` (boolean) - Send SMS when viewing scheduled
      - `notify_on_viewing_reminder` (boolean) - Send SMS for viewing reminders
      - `notify_on_price_change` (boolean) - Send SMS when favorited property price changes
      - `notify_on_prospect_reminder` (boolean) - Send SMS for prospect reminders (agents)
      - `notify_on_lead_received` (boolean) - Send SMS when new lead received
      - `notify_on_appointment` (boolean) - Send SMS for appointment confirmations
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `sms_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles) - User who received SMS
      - `phone_number` (text) - Phone number SMS was sent to
      - `message_body` (text) - SMS message content
      - `notification_type` (text) - Type of notification
      - `reference_id` (uuid) - ID of related entity (property, offer, etc)
      - `reference_type` (text) - Type of related entity
      - `status` (text) - sent, failed, delivered, etc
      - `external_id` (text) - Twilio message SID
      - `error_message` (text) - Error details if failed
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Users can view and update their own preferences
    - Users can view their own SMS logs
    - Only authenticated users can access

  3. Indexes
    - Index on user_id for fast lookups
    - Index on status and created_at for SMS logs
*/

-- Create SMS notification preferences table
CREATE TABLE IF NOT EXISTS sms_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phone_number text,
  verified boolean DEFAULT false,
  enabled boolean DEFAULT false,
  notify_on_offer boolean DEFAULT true,
  notify_on_message boolean DEFAULT true,
  notify_on_viewing_scheduled boolean DEFAULT true,
  notify_on_viewing_reminder boolean DEFAULT true,
  notify_on_price_change boolean DEFAULT true,
  notify_on_prospect_reminder boolean DEFAULT true,
  notify_on_lead_received boolean DEFAULT true,
  notify_on_appointment boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create SMS logs table
CREATE TABLE IF NOT EXISTS sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  message_body text NOT NULL,
  notification_type text NOT NULL,
  reference_id uuid,
  reference_type text,
  status text NOT NULL DEFAULT 'pending',
  external_id text,
  error_message text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'undelivered'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sms_preferences_user ON sms_notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_user ON sms_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON sms_logs(status, created_at DESC);

-- Enable RLS
ALTER TABLE sms_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- SMS Preferences policies
CREATE POLICY "Users can view own SMS preferences"
  ON sms_notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own SMS preferences"
  ON sms_notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own SMS preferences"
  ON sms_notification_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- SMS Logs policies
CREATE POLICY "Users can view own SMS logs"
  ON sms_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Function to check if user should receive SMS for a notification type
CREATE OR REPLACE FUNCTION should_send_sms(
  p_user_id uuid,
  p_notification_type text
)
RETURNS boolean AS $$
DECLARE
  v_prefs record;
BEGIN
  SELECT * INTO v_prefs
  FROM sms_notification_preferences
  WHERE user_id = p_user_id;

  -- If no preferences found or SMS not enabled, don't send
  IF v_prefs IS NULL OR NOT v_prefs.enabled OR NOT v_prefs.verified OR v_prefs.phone_number IS NULL THEN
    RETURN false;
  END IF;

  -- Check specific notification type preferences
  RETURN CASE p_notification_type
    WHEN 'offer' THEN v_prefs.notify_on_offer
    WHEN 'message' THEN v_prefs.notify_on_message
    WHEN 'viewing_scheduled' THEN v_prefs.notify_on_viewing_scheduled
    WHEN 'viewing_reminder' THEN v_prefs.notify_on_viewing_reminder
    WHEN 'price_change' THEN v_prefs.notify_on_price_change
    WHEN 'prospect_reminder' THEN v_prefs.notify_on_prospect_reminder
    WHEN 'lead_received' THEN v_prefs.notify_on_lead_received
    WHEN 'appointment' THEN v_prefs.notify_on_appointment
    ELSE false
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's SMS phone number
CREATE OR REPLACE FUNCTION get_user_sms_phone(p_user_id uuid)
RETURNS text AS $$
DECLARE
  v_phone text;
BEGIN
  SELECT phone_number INTO v_phone
  FROM sms_notification_preferences
  WHERE user_id = p_user_id
    AND enabled = true
    AND verified = true;
  
  RETURN v_phone;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sms_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sms_preferences_updated_at
  BEFORE UPDATE ON sms_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_preferences_updated_at();
