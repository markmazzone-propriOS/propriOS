/*
  # Create Automated Follow-Up System for Agent Leads

  1. New Tables
    - `follow_up_campaigns`
      - `id` (uuid, primary key)
      - `agent_id` (uuid, references profiles) - The agent who owns this campaign
      - `name` (text) - Campaign name (e.g., "New Lead Welcome Series")
      - `description` (text, nullable) - Campaign description
      - `is_active` (boolean) - Whether the campaign is currently active
      - `trigger_status` (text) - Which prospect status triggers this campaign (e.g., 'new', 'contacted')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `follow_up_templates`
      - `id` (uuid, primary key)
      - `campaign_id` (uuid, references follow_up_campaigns) - The campaign this template belongs to
      - `sequence_number` (integer) - Order in the sequence (1, 2, 3...)
      - `delay_days` (integer) - Days to wait before sending (0 = immediate, 1 = 1 day, etc.)
      - `subject` (text) - Email subject line
      - `message` (text) - Email message body
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `scheduled_follow_ups`
      - `id` (uuid, primary key)
      - `prospect_id` (uuid, references prospects) - The prospect to follow up with
      - `template_id` (uuid, references follow_up_templates) - The template to use
      - `scheduled_for` (timestamptz) - When to send this follow-up
      - `sent_at` (timestamptz, nullable) - When it was actually sent
      - `status` (text) - scheduled, sent, cancelled, failed
      - `error_message` (text, nullable) - Error if sending failed
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Agents can only manage their own campaigns and templates
    - Agents can only view scheduled follow-ups for their own prospects

  3. Automation
    - Trigger to automatically create scheduled follow-ups when a prospect matches campaign criteria
    - Function to process and send scheduled follow-ups
*/

-- Create follow_up_campaigns table
CREATE TABLE IF NOT EXISTS follow_up_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  trigger_status text NOT NULL DEFAULT 'new',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_trigger_status CHECK (trigger_status IN ('new', 'contacted', 'qualified', 'converted', 'closed'))
);

-- Create follow_up_templates table
CREATE TABLE IF NOT EXISTS follow_up_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES follow_up_campaigns(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL,
  delay_days integer NOT NULL DEFAULT 0,
  subject text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT positive_delay CHECK (delay_days >= 0),
  CONSTRAINT positive_sequence CHECK (sequence_number > 0)
);

-- Create scheduled_follow_ups table
CREATE TABLE IF NOT EXISTS scheduled_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES follow_up_templates(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  error_message text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_followup_status CHECK (status IN ('scheduled', 'sent', 'cancelled', 'failed'))
);

-- Enable RLS
ALTER TABLE follow_up_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_follow_ups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for follow_up_campaigns
CREATE POLICY "Agents can view own campaigns"
  ON follow_up_campaigns FOR SELECT
  TO authenticated
  USING (auth.uid() = agent_id);

CREATE POLICY "Agents can create own campaigns"
  ON follow_up_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "Agents can update own campaigns"
  ON follow_up_campaigns FOR UPDATE
  TO authenticated
  USING (auth.uid() = agent_id)
  WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "Agents can delete own campaigns"
  ON follow_up_campaigns FOR DELETE
  TO authenticated
  USING (auth.uid() = agent_id);

-- RLS Policies for follow_up_templates
CREATE POLICY "Agents can view own templates"
  ON follow_up_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM follow_up_campaigns
      WHERE follow_up_campaigns.id = follow_up_templates.campaign_id
      AND follow_up_campaigns.agent_id = auth.uid()
    )
  );

CREATE POLICY "Agents can create own templates"
  ON follow_up_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM follow_up_campaigns
      WHERE follow_up_campaigns.id = follow_up_templates.campaign_id
      AND follow_up_campaigns.agent_id = auth.uid()
    )
  );

CREATE POLICY "Agents can update own templates"
  ON follow_up_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM follow_up_campaigns
      WHERE follow_up_campaigns.id = follow_up_templates.campaign_id
      AND follow_up_campaigns.agent_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM follow_up_campaigns
      WHERE follow_up_campaigns.id = follow_up_templates.campaign_id
      AND follow_up_campaigns.agent_id = auth.uid()
    )
  );

CREATE POLICY "Agents can delete own templates"
  ON follow_up_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM follow_up_campaigns
      WHERE follow_up_campaigns.id = follow_up_templates.campaign_id
      AND follow_up_campaigns.agent_id = auth.uid()
    )
  );

-- RLS Policies for scheduled_follow_ups
CREATE POLICY "Agents can view own scheduled follow-ups"
  ON scheduled_follow_ups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM prospects
      WHERE prospects.id = scheduled_follow_ups.prospect_id
      AND prospects.agent_id = auth.uid()
    )
  );

CREATE POLICY "Agents can update own scheduled follow-ups"
  ON scheduled_follow_ups FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM prospects
      WHERE prospects.id = scheduled_follow_ups.prospect_id
      AND prospects.agent_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM prospects
      WHERE prospects.id = scheduled_follow_ups.prospect_id
      AND prospects.agent_id = auth.uid()
    )
  );

CREATE POLICY "Agents can delete own scheduled follow-ups"
  ON scheduled_follow_ups FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM prospects
      WHERE prospects.id = scheduled_follow_ups.prospect_id
      AND prospects.agent_id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_follow_up_campaigns_agent_id ON follow_up_campaigns(agent_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_campaigns_is_active ON follow_up_campaigns(is_active);
CREATE INDEX IF NOT EXISTS idx_follow_up_templates_campaign_id ON follow_up_templates(campaign_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_templates_sequence ON follow_up_templates(campaign_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_scheduled_follow_ups_prospect_id ON scheduled_follow_ups(prospect_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_follow_ups_scheduled_for ON scheduled_follow_ups(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_follow_ups_status ON scheduled_follow_ups(status);

-- Function to automatically schedule follow-ups when a prospect matches campaign criteria
CREATE OR REPLACE FUNCTION schedule_follow_ups_for_prospect()
RETURNS trigger AS $$
DECLARE
  campaign_record RECORD;
  template_record RECORD;
BEGIN
  -- Find active campaigns that match the prospect's status
  FOR campaign_record IN
    SELECT id, agent_id
    FROM follow_up_campaigns
    WHERE agent_id = NEW.agent_id
    AND is_active = true
    AND trigger_status = NEW.status
  LOOP
    -- For each matching campaign, schedule all its templates
    FOR template_record IN
      SELECT id, delay_days
      FROM follow_up_templates
      WHERE campaign_id = campaign_record.id
      ORDER BY sequence_number
    LOOP
      -- Only schedule if not already scheduled for this prospect and template
      IF NOT EXISTS (
        SELECT 1 FROM scheduled_follow_ups
        WHERE prospect_id = NEW.id
        AND template_id = template_record.id
      ) THEN
        INSERT INTO scheduled_follow_ups (
          prospect_id,
          template_id,
          scheduled_for,
          status
        ) VALUES (
          NEW.id,
          template_record.id,
          NEW.created_at + (template_record.delay_days || ' days')::interval,
          'scheduled'
        );
      END IF;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to schedule follow-ups when a prospect is created
DROP TRIGGER IF EXISTS schedule_follow_ups_on_prospect_insert ON prospects;
CREATE TRIGGER schedule_follow_ups_on_prospect_insert
  AFTER INSERT ON prospects
  FOR EACH ROW
  EXECUTE FUNCTION schedule_follow_ups_for_prospect();

-- Trigger to schedule follow-ups when a prospect's status changes
DROP TRIGGER IF EXISTS schedule_follow_ups_on_prospect_update ON prospects;
CREATE TRIGGER schedule_follow_ups_on_prospect_update
  AFTER UPDATE OF status ON prospects
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION schedule_follow_ups_for_prospect();

-- Function to cancel scheduled follow-ups for a prospect (useful when status changes)
CREATE OR REPLACE FUNCTION cancel_pending_follow_ups()
RETURNS trigger AS $$
BEGIN
  -- When a prospect is converted or closed, cancel any pending follow-ups
  IF NEW.status IN ('converted', 'closed') AND OLD.status != NEW.status THEN
    UPDATE scheduled_follow_ups
    SET status = 'cancelled'
    WHERE prospect_id = NEW.id
    AND status = 'scheduled'
    AND sent_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to cancel follow-ups when appropriate
DROP TRIGGER IF EXISTS cancel_follow_ups_on_status_change ON prospects;
CREATE TRIGGER cancel_follow_ups_on_status_change
  AFTER UPDATE OF status ON prospects
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION cancel_pending_follow_ups();
