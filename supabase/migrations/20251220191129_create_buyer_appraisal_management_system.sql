/*
  # Create Buyer Appraisal Management System

  1. New Tables
    - `buyer_appraisal_requests`
      - `id` (uuid, primary key)
      - `buyer_id` (uuid, references profiles) - The buyer requesting appraisal
      - `property_id` (uuid, references properties) - Property to be appraised
      - `offer_id` (uuid, references property_offers) - Related offer
      - `service_provider_id` (uuid, references profiles) - Assigned appraiser
      - `job_id` (uuid, references service_provider_jobs) - Created job
      - `appraisal_type` (text) - Type: 'full', 'drive_by', 'desktop', 'fha', 'va'
      - `requested_date` (date) - Preferred appraisal date
      - `status` (text) - Status: 'pending', 'scheduled', 'in_progress', 'completed', 'cancelled'
      - `special_instructions` (text, nullable) - Special instructions for appraiser
      - `appraisal_report_url` (text, nullable) - Link to appraisal report
      - `appraised_value` (decimal, nullable) - Final appraised value
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `buyer_appraisal_requests` table
    - Buyers can create and view their own appraisal requests
    - Service providers can view appraisal requests assigned to them
    - Agents can view appraisal requests for properties they manage

  3. Automation
    - When appraisal request is created, create a service provider job
    - When job status changes to 'completed', update buyer journey tracker
    - Send notifications to relevant parties
*/

-- Create buyer_appraisal_requests table
CREATE TABLE IF NOT EXISTS buyer_appraisal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  offer_id uuid REFERENCES property_offers(id) ON DELETE SET NULL,
  service_provider_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  job_id uuid REFERENCES service_provider_jobs(id) ON DELETE SET NULL,
  appraisal_type text NOT NULL DEFAULT 'full',
  requested_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  special_instructions text,
  appraisal_report_url text,
  appraised_value decimal(12,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_appraisal_type CHECK (appraisal_type IN ('full', 'drive_by', 'desktop', 'fha', 'va')),
  CONSTRAINT valid_appraisal_status CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_appraisal_requests_buyer_id ON buyer_appraisal_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_appraisal_requests_property_id ON buyer_appraisal_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_appraisal_requests_service_provider_id ON buyer_appraisal_requests(service_provider_id);
CREATE INDEX IF NOT EXISTS idx_appraisal_requests_status ON buyer_appraisal_requests(status);
CREATE INDEX IF NOT EXISTS idx_appraisal_requests_requested_date ON buyer_appraisal_requests(requested_date);

-- Enable RLS
ALTER TABLE buyer_appraisal_requests ENABLE ROW LEVEL SECURITY;

-- Buyers can view their own appraisal requests
CREATE POLICY "Buyers can view own appraisal requests"
  ON buyer_appraisal_requests FOR SELECT
  TO authenticated
  USING (
    buyer_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'buyer'
    )
  );

-- Buyers can create their own appraisal requests
CREATE POLICY "Buyers can create appraisal requests"
  ON buyer_appraisal_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    buyer_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'buyer'
    )
  );

-- Buyers can update their own appraisal requests
CREATE POLICY "Buyers can update own appraisal requests"
  ON buyer_appraisal_requests FOR UPDATE
  TO authenticated
  USING (buyer_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid());

-- Service providers can view appraisal requests assigned to them
CREATE POLICY "Service providers can view assigned appraisals"
  ON buyer_appraisal_requests FOR SELECT
  TO authenticated
  USING (
    service_provider_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'service_provider'
    )
  );

-- Service providers can update appraisal requests assigned to them
CREATE POLICY "Service providers can update assigned appraisals"
  ON buyer_appraisal_requests FOR UPDATE
  TO authenticated
  USING (service_provider_id = auth.uid())
  WITH CHECK (service_provider_id = auth.uid());

-- Agents can view appraisal requests for properties they manage
CREATE POLICY "Agents can view property appraisal requests"
  ON buyer_appraisal_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = buyer_appraisal_requests.property_id
      AND properties.agent_id = auth.uid()
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_appraisal_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER appraisal_requests_updated_at
  BEFORE UPDATE ON buyer_appraisal_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_appraisal_request_updated_at();

-- Create trigger to auto-create service provider job when appraisal is requested
CREATE OR REPLACE FUNCTION create_appraisal_job()
RETURNS TRIGGER AS $$
DECLARE
  property_address text;
  buyer_name text;
  job_category_id uuid;
BEGIN
  -- Only create job if service provider is assigned and job doesn't exist yet
  IF NEW.service_provider_id IS NOT NULL AND NEW.job_id IS NULL THEN

    -- Get property address
    SELECT address_line1 || ', ' || city || ', ' || state
    INTO property_address
    FROM properties
    WHERE id = NEW.property_id;

    -- Get buyer name
    SELECT full_name INTO buyer_name
    FROM profiles
    WHERE id = NEW.buyer_id;

    -- Get appraisals category
    SELECT id INTO job_category_id
    FROM service_categories
    WHERE name ILIKE '%appraisal%'
    LIMIT 1;

    -- Create the job
    INSERT INTO service_provider_jobs (
      service_provider_id,
      buyer_id,
      title,
      description,
      location,
      status,
      priority,
      start_date,
      service_category_id
    ) VALUES (
      NEW.service_provider_id,
      NEW.buyer_id,
      NEW.appraisal_type || ' Appraisal - ' || property_address,
      'Appraisal requested by ' || COALESCE(buyer_name, 'buyer') ||
      CASE WHEN NEW.special_instructions IS NOT NULL
        THEN E'\n\nSpecial Instructions: ' || NEW.special_instructions
        ELSE ''
      END,
      property_address,
      'scheduled',
      'high',
      NEW.requested_date::timestamptz,
      job_category_id
    )
    RETURNING id INTO NEW.job_id;

    -- Update appraisal request status
    NEW.status = 'scheduled';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_appraisal_job_trigger
  BEFORE INSERT OR UPDATE ON buyer_appraisal_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_appraisal_job();

-- Create trigger to update buyer journey when appraisal is completed
CREATE OR REPLACE FUNCTION update_buyer_journey_on_appraisal_complete()
RETURNS TRIGGER AS $$
BEGIN
  -- When appraisal status changes to completed, update buyer journey
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE buyer_journey_progress
    SET
      appraisal_completed = true,
      appraisal_date = now(),
      current_stage = 'appraisal'
    WHERE buyer_id = NEW.buyer_id
    AND (property_id = NEW.property_id OR property_id IS NULL);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_buyer_journey_on_appraisal_complete_trigger
  AFTER UPDATE ON buyer_appraisal_requests
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION update_buyer_journey_on_appraisal_complete();

-- Create trigger to sync appraisal status with job status
CREATE OR REPLACE FUNCTION sync_appraisal_status_with_job()
RETURNS TRIGGER AS $$
BEGIN
  -- When the job status changes, update the appraisal request
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE buyer_appraisal_requests
    SET status = 'completed'
    WHERE job_id = NEW.id
    AND status != 'completed';
  ELSIF NEW.status = 'in_progress' AND OLD.status != 'in_progress' THEN
    UPDATE buyer_appraisal_requests
    SET status = 'in_progress'
    WHERE job_id = NEW.id
    AND status NOT IN ('completed', 'in_progress');
  ELSIF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE buyer_appraisal_requests
    SET status = 'cancelled'
    WHERE job_id = NEW.id
    AND status != 'cancelled';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if trigger exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'sync_appraisal_status_with_job_trigger'
  ) THEN
    CREATE TRIGGER sync_appraisal_status_with_job_trigger
      AFTER UPDATE ON service_provider_jobs
      FOR EACH ROW
      EXECUTE FUNCTION sync_appraisal_status_with_job();
  END IF;
END $$;
