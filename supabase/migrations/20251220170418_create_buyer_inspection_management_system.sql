/*
  # Create Buyer Inspection Management System

  1. New Tables
    - `buyer_inspection_requests`
      - `id` (uuid, primary key)
      - `buyer_id` (uuid, references profiles) - The buyer requesting inspection
      - `property_id` (uuid, references properties) - Property to be inspected
      - `offer_id` (uuid, references property_offers) - Related offer
      - `service_provider_id` (uuid, references profiles) - Assigned inspector
      - `job_id` (uuid, references service_provider_jobs) - Created job
      - `inspection_type` (text) - Type: 'general', 'pest', 'roof', 'foundation', 'electrical', 'plumbing', 'hvac', 'environmental'
      - `requested_date` (date) - Preferred inspection date
      - `status` (text) - Status: 'pending', 'scheduled', 'in_progress', 'completed', 'cancelled'
      - `special_instructions` (text, nullable) - Special instructions for inspector
      - `inspection_report_url` (text, nullable) - Link to inspection report
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `buyer_inspection_requests` table
    - Buyers can create and view their own inspection requests
    - Service providers can view inspection requests assigned to them
    - Agents can view inspection requests for properties they manage

  3. Automation
    - When inspection request is created, create a service provider job
    - When job status changes to 'completed', update buyer journey tracker
    - Send notifications to relevant parties
*/

-- Create buyer_inspection_requests table
CREATE TABLE IF NOT EXISTS buyer_inspection_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  offer_id uuid REFERENCES property_offers(id) ON DELETE SET NULL,
  service_provider_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  job_id uuid REFERENCES service_provider_jobs(id) ON DELETE SET NULL,
  inspection_type text NOT NULL DEFAULT 'general',
  requested_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  special_instructions text,
  inspection_report_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_inspection_type CHECK (inspection_type IN ('general', 'pest', 'roof', 'foundation', 'electrical', 'plumbing', 'hvac', 'environmental')),
  CONSTRAINT valid_inspection_status CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_inspection_requests_buyer_id ON buyer_inspection_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_inspection_requests_property_id ON buyer_inspection_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_inspection_requests_service_provider_id ON buyer_inspection_requests(service_provider_id);
CREATE INDEX IF NOT EXISTS idx_inspection_requests_status ON buyer_inspection_requests(status);
CREATE INDEX IF NOT EXISTS idx_inspection_requests_requested_date ON buyer_inspection_requests(requested_date);

-- Enable RLS
ALTER TABLE buyer_inspection_requests ENABLE ROW LEVEL SECURITY;

-- Buyers can view their own inspection requests
CREATE POLICY "Buyers can view own inspection requests"
  ON buyer_inspection_requests FOR SELECT
  TO authenticated
  USING (
    buyer_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'buyer'
    )
  );

-- Buyers can create their own inspection requests
CREATE POLICY "Buyers can create inspection requests"
  ON buyer_inspection_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    buyer_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'buyer'
    )
  );

-- Buyers can update their own inspection requests
CREATE POLICY "Buyers can update own inspection requests"
  ON buyer_inspection_requests FOR UPDATE
  TO authenticated
  USING (buyer_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid());

-- Service providers can view inspection requests assigned to them
CREATE POLICY "Service providers can view assigned inspections"
  ON buyer_inspection_requests FOR SELECT
  TO authenticated
  USING (
    service_provider_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'service_provider'
    )
  );

-- Service providers can update inspection requests assigned to them
CREATE POLICY "Service providers can update assigned inspections"
  ON buyer_inspection_requests FOR UPDATE
  TO authenticated
  USING (service_provider_id = auth.uid())
  WITH CHECK (service_provider_id = auth.uid());

-- Agents can view inspection requests for properties they manage
CREATE POLICY "Agents can view property inspection requests"
  ON buyer_inspection_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = buyer_inspection_requests.property_id
      AND properties.agent_id = auth.uid()
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_inspection_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inspection_requests_updated_at
  BEFORE UPDATE ON buyer_inspection_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_inspection_request_updated_at();

-- Create trigger to auto-create service provider job when inspection is requested
CREATE OR REPLACE FUNCTION create_inspection_job()
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
    
    -- Get home inspection category (or general inspection)
    SELECT id INTO job_category_id
    FROM service_categories
    WHERE name ILIKE '%inspection%'
    LIMIT 1;
    
    -- Create the job
    INSERT INTO service_provider_jobs (
      service_provider_id,
      title,
      description,
      location,
      status,
      priority,
      start_date,
      service_category_id
    ) VALUES (
      NEW.service_provider_id,
      NEW.inspection_type || ' Inspection - ' || property_address,
      'Inspection requested by ' || COALESCE(buyer_name, 'buyer') || 
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
    
    -- Update inspection request status
    NEW.status = 'scheduled';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_inspection_job_trigger
  BEFORE INSERT OR UPDATE ON buyer_inspection_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_inspection_job();

-- Create trigger to update buyer journey when inspection is completed
CREATE OR REPLACE FUNCTION update_buyer_journey_on_inspection_complete()
RETURNS TRIGGER AS $$
BEGIN
  -- When inspection status changes to completed, update buyer journey
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE buyer_journey_progress
    SET 
      inspection_completed = true,
      inspection_date = now(),
      current_stage = 'inspection'
    WHERE buyer_id = NEW.buyer_id
    AND (property_id = NEW.property_id OR property_id IS NULL);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_buyer_journey_on_inspection_complete_trigger
  AFTER UPDATE ON buyer_inspection_requests
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION update_buyer_journey_on_inspection_complete();

-- Create trigger to sync inspection status with job status
CREATE OR REPLACE FUNCTION sync_inspection_status_with_job()
RETURNS TRIGGER AS $$
BEGIN
  -- When the job status changes, update the inspection request
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE buyer_inspection_requests
    SET status = 'completed'
    WHERE job_id = NEW.id
    AND status != 'completed';
  ELSIF NEW.status = 'in_progress' AND OLD.status != 'in_progress' THEN
    UPDATE buyer_inspection_requests
    SET status = 'in_progress'
    WHERE job_id = NEW.id
    AND status NOT IN ('completed', 'in_progress');
  ELSIF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE buyer_inspection_requests
    SET status = 'cancelled'
    WHERE job_id = NEW.id
    AND status != 'cancelled';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'sync_inspection_status_with_job_trigger'
  ) THEN
    CREATE TRIGGER sync_inspection_status_with_job_trigger
      AFTER UPDATE ON service_provider_jobs
      FOR EACH ROW
      EXECUTE FUNCTION sync_inspection_status_with_job();
  END IF;
END $$;
