/*
  # Create Seller Journey Progress Tracker

  1. New Tables
    - `seller_journey_progress`
      - `id` (uuid, primary key)
      - `seller_id` (uuid, references auth.users)
      - `property_id` (uuid, references properties) - tracks which property this journey is for
      - `current_stage` (text) - current stage in the selling process
      - `preparation_completed` (boolean) - property prep complete
      - `preparation_date` (timestamptz)
      - `listed` (boolean) - property is listed
      - `listed_date` (timestamptz)
      - `showings_started` (boolean) - showings have begun
      - `showings_date` (timestamptz)
      - `offer_received` (boolean) - at least one offer received
      - `offer_received_date` (timestamptz)
      - `under_contract` (boolean) - offer accepted and under contract
      - `under_contract_date` (timestamptz)
      - `inspection_appraisal_completed` (boolean) - inspection and appraisal done
      - `inspection_appraisal_date` (timestamptz)
      - `final_steps_completed` (boolean) - all contingencies cleared
      - `final_steps_date` (timestamptz)
      - `closing_completed` (boolean) - sale closed
      - `closing_date` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `seller_journey_progress` table
    - Add policies for sellers to view their own progress
    - Add policies for agents to view and update their clients' progress
*/

CREATE TABLE IF NOT EXISTS seller_journey_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  current_stage text NOT NULL DEFAULT 'preparation',
  preparation_completed boolean DEFAULT false,
  preparation_date timestamptz,
  listed boolean DEFAULT false,
  listed_date timestamptz,
  showings_started boolean DEFAULT false,
  showings_date timestamptz,
  offer_received boolean DEFAULT false,
  offer_received_date timestamptz,
  under_contract boolean DEFAULT false,
  under_contract_date timestamptz,
  inspection_appraisal_completed boolean DEFAULT false,
  inspection_appraisal_date timestamptz,
  final_steps_completed boolean DEFAULT false,
  final_steps_date timestamptz,
  closing_completed boolean DEFAULT false,
  closing_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_stage CHECK (current_stage IN (
    'preparation',
    'listed',
    'showings',
    'offer_received',
    'under_contract',
    'inspection_appraisal',
    'final_steps',
    'closing',
    'completed'
  ))
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_seller_journey_seller_id ON seller_journey_progress(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_journey_property_id ON seller_journey_progress(property_id);

-- Enable RLS
ALTER TABLE seller_journey_progress ENABLE ROW LEVEL SECURITY;

-- Sellers can view their own journey progress
CREATE POLICY "Sellers can view own journey progress"
  ON seller_journey_progress
  FOR SELECT
  TO authenticated
  USING (auth.uid() = seller_id);

-- Sellers can insert their own journey progress
CREATE POLICY "Sellers can insert own journey progress"
  ON seller_journey_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seller_id);

-- Sellers can update their own journey progress
CREATE POLICY "Sellers can update own journey progress"
  ON seller_journey_progress
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- Agents can view their clients' journey progress
CREATE POLICY "Agents can view clients journey progress"
  ON seller_journey_progress
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'agent'
      AND profiles.id = (
        SELECT assigned_agent_id FROM profiles WHERE id = seller_id
      )
    )
  );

-- Agents can update their clients' journey progress
CREATE POLICY "Agents can update clients journey progress"
  ON seller_journey_progress
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'agent'
      AND profiles.id = (
        SELECT assigned_agent_id FROM profiles WHERE id = seller_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'agent'
      AND profiles.id = (
        SELECT assigned_agent_id FROM profiles WHERE id = seller_id
      )
    )
  );

-- Create trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_seller_journey_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER seller_journey_updated_at
  BEFORE UPDATE ON seller_journey_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_journey_updated_at();

-- Create trigger to automatically update journey progress when property is listed
CREATE OR REPLACE FUNCTION auto_update_seller_journey_on_property_list()
RETURNS TRIGGER AS $$
BEGIN
  -- When a property status changes to 'active', mark listed stage as complete
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    INSERT INTO seller_journey_progress (seller_id, property_id, current_stage, listed, listed_date)
    VALUES (NEW.seller_id, NEW.id, 'listed', true, now())
    ON CONFLICT (seller_id, property_id)
    DO UPDATE SET
      listed = true,
      listed_date = COALESCE(seller_journey_progress.listed_date, now()),
      current_stage = CASE
        WHEN seller_journey_progress.current_stage = 'preparation' THEN 'listed'
        ELSE seller_journey_progress.current_stage
      END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add unique constraint to prevent duplicate entries per seller-property pair
ALTER TABLE seller_journey_progress
ADD CONSTRAINT unique_seller_property UNIQUE (seller_id, property_id);

CREATE TRIGGER property_listed_journey_update
  AFTER INSERT OR UPDATE ON properties
  FOR EACH ROW
  WHEN (NEW.seller_id IS NOT NULL)
  EXECUTE FUNCTION auto_update_seller_journey_on_property_list();