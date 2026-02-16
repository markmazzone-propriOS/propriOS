/*
  # Create Buyer Journey Progress Tracker

  1. New Tables
    - `buyer_journey_progress`
      - `id` (uuid, primary key)
      - `buyer_id` (uuid, references auth.users)
      - `property_id` (uuid, references properties, nullable - not set until offer stage)
      - `current_stage` (text, current stage in the buying process)
      - `pre_approval_completed` (boolean, default false)
      - `pre_approval_date` (timestamptz, nullable)
      - `house_hunting_started` (boolean, default false)
      - `house_hunting_date` (timestamptz, nullable)
      - `offer_submitted` (boolean, default false)
      - `offer_submitted_date` (timestamptz, nullable)
      - `offer_accepted` (boolean, default false)
      - `offer_accepted_date` (timestamptz, nullable)
      - `inspection_completed` (boolean, default false)
      - `inspection_date` (timestamptz, nullable)
      - `appraisal_completed` (boolean, default false)
      - `appraisal_date` (timestamptz, nullable)
      - `loan_approved` (boolean, default false)
      - `loan_approved_date` (timestamptz, nullable)
      - `closing_completed` (boolean, default false)
      - `closing_date` (timestamptz, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `buyer_journey_progress` table
    - Add policies for buyers to view and update their own progress
    - Add policies for agents and lenders to update progress for their clients
*/

CREATE TABLE IF NOT EXISTS buyer_journey_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  current_stage text NOT NULL DEFAULT 'pre_approval',
  pre_approval_completed boolean DEFAULT false,
  pre_approval_date timestamptz,
  house_hunting_started boolean DEFAULT false,
  house_hunting_date timestamptz,
  offer_submitted boolean DEFAULT false,
  offer_submitted_date timestamptz,
  offer_accepted boolean DEFAULT false,
  offer_accepted_date timestamptz,
  inspection_completed boolean DEFAULT false,
  inspection_date timestamptz,
  appraisal_completed boolean DEFAULT false,
  appraisal_date timestamptz,
  loan_approved boolean DEFAULT false,
  loan_approved_date timestamptz,
  closing_completed boolean DEFAULT false,
  closing_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_stage CHECK (current_stage IN (
    'pre_approval',
    'house_hunting',
    'offer_submitted',
    'offer_accepted',
    'inspection',
    'appraisal',
    'loan_approval',
    'closing',
    'completed'
  )),
  CONSTRAINT one_progress_per_buyer UNIQUE(buyer_id)
);

ALTER TABLE buyer_journey_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can view own journey progress"
  ON buyer_journey_progress
  FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id);

CREATE POLICY "Buyers can update own journey progress"
  ON buyer_journey_progress
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = buyer_id)
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyers can insert own journey progress"
  ON buyer_journey_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Agents can update their clients journey progress"
  ON buyer_journey_progress
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = buyer_journey_progress.buyer_id
      AND profiles.assigned_agent_id = auth.uid()
    )
  );

CREATE POLICY "Agents can view their clients journey progress"
  ON buyer_journey_progress
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = buyer_journey_progress.buyer_id
      AND profiles.assigned_agent_id = auth.uid()
    )
  );

CREATE INDEX idx_buyer_journey_progress_buyer_id ON buyer_journey_progress(buyer_id);
CREATE INDEX idx_buyer_journey_progress_property_id ON buyer_journey_progress(property_id);

CREATE OR REPLACE FUNCTION update_buyer_journey_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_buyer_journey_progress_updated_at
  BEFORE UPDATE ON buyer_journey_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_buyer_journey_progress_updated_at();

CREATE OR REPLACE FUNCTION auto_update_buyer_journey_stage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.closing_completed AND OLD.closing_completed = false THEN
    NEW.current_stage = 'completed';
  ELSIF NEW.loan_approved AND OLD.loan_approved = false THEN
    NEW.current_stage = 'closing';
  ELSIF NEW.appraisal_completed AND OLD.appraisal_completed = false THEN
    NEW.current_stage = 'loan_approval';
  ELSIF NEW.inspection_completed AND OLD.inspection_completed = false THEN
    NEW.current_stage = 'appraisal';
  ELSIF NEW.offer_accepted AND OLD.offer_accepted = false THEN
    NEW.current_stage = 'inspection';
  ELSIF NEW.offer_submitted AND OLD.offer_submitted = false THEN
    NEW.current_stage = 'offer_submitted';
  ELSIF NEW.house_hunting_started AND OLD.house_hunting_started = false THEN
    NEW.current_stage = 'house_hunting';
  ELSIF NEW.pre_approval_completed AND OLD.pre_approval_completed = false THEN
    NEW.current_stage = 'house_hunting';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_update_buyer_journey_stage_trigger
  BEFORE UPDATE ON buyer_journey_progress
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_buyer_journey_stage();

CREATE OR REPLACE FUNCTION initialize_buyer_journey_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_type = 'buyer' THEN
    INSERT INTO buyer_journey_progress (buyer_id, current_stage)
    VALUES (NEW.id, 'pre_approval')
    ON CONFLICT (buyer_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER initialize_buyer_journey_trigger
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION initialize_buyer_journey_on_signup();
