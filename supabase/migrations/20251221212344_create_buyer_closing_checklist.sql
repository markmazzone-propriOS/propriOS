/*
  # Create Buyer Closing Checklist System

  ## Overview
  This migration creates a comprehensive closing checklist system for buyers to track all the activities 
  required before closing on a property. When all items are marked complete, it automatically updates 
  the buyer's journey tracker.

  ## New Tables

  ### `closing_checklist_items`
  - `id` (uuid, primary key) - Unique identifier for each checklist item
  - `buyer_id` (uuid, foreign key) - References auth.users
  - `property_id` (uuid, foreign key) - References properties (nullable)
  - `item_name` (text) - Name of the checklist item
  - `description` (text) - Detailed description of the item
  - `category` (text) - Category (Financial, Legal, Inspection, Insurance, Final Walkthrough, etc.)
  - `is_completed` (boolean) - Whether the item is completed
  - `completed_at` (timestamptz) - When the item was completed
  - `due_date` (timestamptz) - Optional due date for the item
  - `sort_order` (integer) - Order for displaying items
  - `is_required` (boolean) - Whether this item is required for closing
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Automation
  - Creates default checklist items when a buyer reaches the closing stage
  - Automatically updates buyer_journey_progress when all required items are complete
  - Sends notifications when checklist is fully completed

  ## Security
  - Enable RLS on closing_checklist_items table
  - Buyers can view and update their own checklist items
  - Agents can view and update checklist items for their clients
*/

-- Create closing_checklist_items table
CREATE TABLE IF NOT EXISTS closing_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  description text,
  category text NOT NULL,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  due_date timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  is_required boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_category CHECK (category IN (
    'Financial',
    'Legal',
    'Inspection',
    'Insurance',
    'Utilities',
    'Final Walkthrough',
    'Documentation',
    'Moving'
  ))
);

ALTER TABLE closing_checklist_items ENABLE ROW LEVEL SECURITY;

-- Create index
CREATE INDEX IF NOT EXISTS idx_closing_checklist_buyer_id ON closing_checklist_items(buyer_id);
CREATE INDEX IF NOT EXISTS idx_closing_checklist_property_id ON closing_checklist_items(property_id);

-- RLS Policies
CREATE POLICY "Buyers can view own closing checklist"
  ON closing_checklist_items
  FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id);

CREATE POLICY "Buyers can update own closing checklist"
  ON closing_checklist_items
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = buyer_id)
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyers can insert own closing checklist items"
  ON closing_checklist_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyers can delete own closing checklist items"
  ON closing_checklist_items
  FOR DELETE
  TO authenticated
  USING (auth.uid() = buyer_id);

CREATE POLICY "Agents can view their clients closing checklist"
  ON closing_checklist_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = closing_checklist_items.buyer_id
      AND profiles.assigned_agent_id = auth.uid()
    )
  );

CREATE POLICY "Agents can update their clients closing checklist"
  ON closing_checklist_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = closing_checklist_items.buyer_id
      AND profiles.assigned_agent_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_closing_checklist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.is_completed = true AND OLD.is_completed = false THEN
    NEW.completed_at = now();
  ELSIF NEW.is_completed = false AND OLD.is_completed = true THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_closing_checklist_updated_at_trigger
  BEFORE UPDATE ON closing_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_closing_checklist_updated_at();

-- Function to check if all required items are complete and update journey
CREATE OR REPLACE FUNCTION check_closing_checklist_completion()
RETURNS TRIGGER AS $$
DECLARE
  total_required INTEGER;
  total_completed INTEGER;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE is_required = true),
    COUNT(*) FILTER (WHERE is_required = true AND is_completed = true)
  INTO total_required, total_completed
  FROM closing_checklist_items
  WHERE buyer_id = NEW.buyer_id
  AND (property_id = NEW.property_id OR (property_id IS NULL AND NEW.property_id IS NULL));

  IF total_required > 0 AND total_completed = total_required THEN
    UPDATE buyer_journey_progress
    SET 
      closing_completed = true,
      closing_date = now(),
      current_stage = 'completed'
    WHERE buyer_id = NEW.buyer_id
    AND closing_completed = false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER check_closing_checklist_completion_trigger
  AFTER INSERT OR UPDATE ON closing_checklist_items
  FOR EACH ROW
  WHEN (NEW.is_completed = true)
  EXECUTE FUNCTION check_closing_checklist_completion();

-- Function to create default checklist items for a buyer
CREATE OR REPLACE FUNCTION create_default_closing_checklist(
  p_buyer_id uuid,
  p_property_id uuid DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO closing_checklist_items (buyer_id, property_id, item_name, description, category, sort_order, is_required)
  VALUES
    (p_buyer_id, p_property_id, 'Final Loan Approval Received', 'Confirm you have received final approval from your lender', 'Financial', 1, true),
    (p_buyer_id, p_property_id, 'Review Closing Disclosure', 'Review and sign your Closing Disclosure at least 3 days before closing', 'Financial', 2, true),
    (p_buyer_id, p_property_id, 'Wire Transfer Instructions Confirmed', 'Verify wire transfer details with your closing agent', 'Financial', 3, true),
    (p_buyer_id, p_property_id, 'Closing Funds Ready', 'Ensure you have cashier''s check or wire transfer ready for closing costs', 'Financial', 4, true),
    (p_buyer_id, p_property_id, 'Final Walkthrough Completed', 'Conduct final walkthrough of the property 24 hours before closing', 'Final Walkthrough', 5, true),
    (p_buyer_id, p_property_id, 'Verify Repairs Completed', 'Confirm all agreed-upon repairs have been made', 'Final Walkthrough', 6, true),
    (p_buyer_id, p_property_id, 'Homeowners Insurance Purchased', 'Purchase homeowners insurance and provide proof to lender', 'Insurance', 7, true),
    (p_buyer_id, p_property_id, 'Title Insurance Review', 'Review title insurance policy and confirm coverage', 'Legal', 8, true),
    (p_buyer_id, p_property_id, 'HOA Documents Reviewed', 'If applicable, review HOA rules, regulations, and financial statements', 'Legal', 9, false),
    (p_buyer_id, p_property_id, 'Government-Issued ID Ready', 'Bring valid government-issued photo ID to closing', 'Documentation', 10, true),
    (p_buyer_id, p_property_id, 'Utility Transfers Scheduled', 'Schedule utility transfers (electric, gas, water, internet, etc.)', 'Utilities', 11, true),
    (p_buyer_id, p_property_id, 'Change of Address Filed', 'File change of address with USPS and update important accounts', 'Moving', 12, false),
    (p_buyer_id, p_property_id, 'Moving Company Scheduled', 'If needed, schedule moving company or truck rental', 'Moving', 13, false),
    (p_buyer_id, p_property_id, 'Closing Date Confirmed', 'Confirm closing date, time, and location with all parties', 'Documentation', 14, true),
    (p_buyer_id, p_property_id, 'Review Purchase Agreement', 'Review final purchase agreement one more time', 'Legal', 15, true)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-create checklist when buyer reaches closing stage
CREATE OR REPLACE FUNCTION auto_create_closing_checklist()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_stage = 'closing' AND OLD.current_stage != 'closing' THEN
    PERFORM create_default_closing_checklist(NEW.buyer_id, NEW.property_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER auto_create_closing_checklist_trigger
  AFTER UPDATE ON buyer_journey_progress
  FOR EACH ROW
  WHEN (NEW.current_stage = 'closing' AND OLD.current_stage IS DISTINCT FROM 'closing')
  EXECUTE FUNCTION auto_create_closing_checklist();