/*
  # Create Advanced Analytics Tables for Property Owners

  1. New Tables
    - `maintenance_requests`
      - Tracks all maintenance and repair requests for properties
      - Links to properties and rental agreements
      - Tracks cost, status, priority, and resolution time
    
    - `property_expenses`
      - Tracks operating expenses for properties
      - Categories: maintenance, utilities, insurance, taxes, etc.
      - Links to properties and optionally rental agreements

  2. New Fields
    - Add `rental_agreement_id` to `rental_applications` for tracking conversion
    - Add `move_out_date` and `move_out_reason` to `rental_agreements` for tracking turnover

  3. Security
    - Enable RLS on all tables
    - Property owners can manage data for their properties
    - Renters can view their own maintenance requests
*/

-- Create maintenance_requests table
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  rental_agreement_id uuid REFERENCES rental_agreements(id) ON DELETE SET NULL,
  requester_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  category text CHECK (category IN ('plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'pest_control', 'landscaping', 'other')),
  estimated_cost numeric DEFAULT 0,
  actual_cost numeric DEFAULT 0,
  requested_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create property_expenses table
CREATE TABLE IF NOT EXISTS property_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  rental_agreement_id uuid REFERENCES rental_agreements(id) ON DELETE SET NULL,
  property_owner_id uuid REFERENCES property_owner_profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  category text NOT NULL CHECK (category IN ('maintenance', 'repair', 'utilities', 'insurance', 'property_tax', 'hoa_fees', 'management_fees', 'advertising', 'legal', 'other')),
  description text,
  expense_date date NOT NULL,
  paid_date date,
  payment_method text,
  vendor text,
  is_recurring boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add move_out tracking to rental_agreements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rental_agreements' AND column_name = 'move_out_date'
  ) THEN
    ALTER TABLE rental_agreements ADD COLUMN move_out_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rental_agreements' AND column_name = 'move_out_reason'
  ) THEN
    ALTER TABLE rental_agreements ADD COLUMN move_out_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rental_agreements' AND column_name = 'renewed_from_agreement_id'
  ) THEN
    ALTER TABLE rental_agreements ADD COLUMN renewed_from_agreement_id uuid REFERENCES rental_agreements(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add rental_agreement_id to rental_applications for conversion tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rental_applications' AND column_name = 'converted_to_agreement_id'
  ) THEN
    ALTER TABLE rental_applications ADD COLUMN converted_to_agreement_id uuid REFERENCES rental_agreements(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_expenses ENABLE ROW LEVEL SECURITY;

-- Maintenance Requests Policies
CREATE POLICY "Property owners can view maintenance requests for their properties"
  ON maintenance_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = maintenance_requests.property_id
      AND properties.listed_by = auth.uid()
    )
  );

CREATE POLICY "Renters can view their own maintenance requests"
  ON maintenance_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id);

CREATE POLICY "Property owners can manage maintenance requests for their properties"
  ON maintenance_requests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = maintenance_requests.property_id
      AND properties.listed_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = maintenance_requests.property_id
      AND properties.listed_by = auth.uid()
    )
  );

CREATE POLICY "Renters can create maintenance requests"
  ON maintenance_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

-- Property Expenses Policies
CREATE POLICY "Property owners can manage their property expenses"
  ON property_expenses FOR ALL
  TO authenticated
  USING (auth.uid() = property_owner_id)
  WITH CHECK (auth.uid() = property_owner_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_property ON maintenance_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_agreement ON maintenance_requests(rental_agreement_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_status ON maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_property_expenses_property ON property_expenses(property_id);
CREATE INDEX IF NOT EXISTS idx_property_expenses_owner ON property_expenses(property_owner_id);
CREATE INDEX IF NOT EXISTS idx_property_expenses_date ON property_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_rental_agreements_move_out ON rental_agreements(move_out_date) WHERE move_out_date IS NOT NULL;
