/*
  # Create Renter Journey Tracker

  1. New Tables
    - `renter_journey_progress`
      - `id` (uuid, primary key)
      - `renter_id` (uuid, references auth.users)
      - `property_id` (uuid, nullable, references properties)
      - `current_stage` (text) - Current stage in the rental process
      - `budget_determined` (boolean) - Has renter determined their budget
      - `budget_determined_date` (timestamptz, nullable)
      - `property_search_started` (boolean) - Started browsing properties
      - `property_search_date` (timestamptz, nullable)
      - `viewing_scheduled` (boolean) - Scheduled property viewing
      - `viewing_scheduled_date` (timestamptz, nullable)
      - `application_submitted` (boolean) - Submitted rental application
      - `application_submitted_date` (timestamptz, nullable)
      - `background_check_completed` (boolean) - Background check completed
      - `background_check_date` (timestamptz, nullable)
      - `lease_signed` (boolean) - Lease agreement signed
      - `lease_signed_date` (timestamptz, nullable)
      - `deposit_paid` (boolean) - Security deposit and first month paid
      - `deposit_paid_date` (timestamptz, nullable)
      - `move_in_inspection` (boolean) - Move-in inspection completed
      - `move_in_inspection_date` (timestamptz, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `renter_journey_progress` table
    - Add policies for renters to view and update their own progress
    - Add policies for agents to view and update their clients' progress
*/

CREATE TABLE IF NOT EXISTS renter_journey_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  renter_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  current_stage text NOT NULL DEFAULT 'budget_determination',
  budget_determined boolean DEFAULT false,
  budget_determined_date timestamptz,
  property_search_started boolean DEFAULT false,
  property_search_date timestamptz,
  viewing_scheduled boolean DEFAULT false,
  viewing_scheduled_date timestamptz,
  application_submitted boolean DEFAULT false,
  application_submitted_date timestamptz,
  background_check_completed boolean DEFAULT false,
  background_check_date timestamptz,
  lease_signed boolean DEFAULT false,
  lease_signed_date timestamptz,
  deposit_paid boolean DEFAULT false,
  deposit_paid_date timestamptz,
  move_in_inspection boolean DEFAULT false,
  move_in_inspection_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_stage CHECK (current_stage IN (
    'budget_determination',
    'property_search',
    'viewing_scheduled',
    'application_submitted',
    'background_check',
    'lease_signing',
    'deposit_payment',
    'move_in_inspection',
    'completed'
  ))
);

ALTER TABLE renter_journey_progress ENABLE ROW LEVEL SECURITY;

-- Renters can view their own progress
CREATE POLICY "Renters can view own journey progress"
  ON renter_journey_progress
  FOR SELECT
  TO authenticated
  USING (auth.uid() = renter_id);

-- Renters can update their own progress
CREATE POLICY "Renters can update own journey progress"
  ON renter_journey_progress
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = renter_id)
  WITH CHECK (auth.uid() = renter_id);

-- Renters can insert their own progress
CREATE POLICY "Renters can insert own journey progress"
  ON renter_journey_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = renter_id);

-- Agents can view their clients' progress
CREATE POLICY "Agents can view client journey progress"
  ON renter_journey_progress
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agent_profiles ap
      WHERE ap.id = auth.uid()
      AND ap.id = (
        SELECT assigned_agent_id FROM profiles
        WHERE id = renter_journey_progress.renter_id
      )
    )
  );

-- Agents can update their clients' progress
CREATE POLICY "Agents can update client journey progress"
  ON renter_journey_progress
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agent_profiles ap
      WHERE ap.id = auth.uid()
      AND ap.id = (
        SELECT assigned_agent_id FROM profiles
        WHERE id = renter_journey_progress.renter_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agent_profiles ap
      WHERE ap.id = auth.uid()
      AND ap.id = (
        SELECT assigned_agent_id FROM profiles
        WHERE id = renter_journey_progress.renter_id
      )
    )
  );

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_renter_journey_progress_renter_id ON renter_journey_progress(renter_id);
CREATE INDEX IF NOT EXISTS idx_renter_journey_progress_property_id ON renter_journey_progress(property_id);
