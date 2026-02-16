/*
  # Create Seller Closing Checklist System

  ## Overview
  This migration creates a comprehensive closing checklist system for sellers to track all the activities 
  required before closing on a property. When all items are marked complete, it automatically updates 
  the seller's journey tracker.

  ## New Tables

  ### `seller_closing_checklist_items`
  - `id` (uuid, primary key) - Unique identifier for each checklist item
  - `seller_id` (uuid, foreign key) - References auth.users
  - `property_id` (uuid, foreign key) - References properties (nullable)
  - `item_name` (text) - Name of the checklist item
  - `description` (text) - Detailed description of the item
  - `category` (text) - Category (Financial, Legal, Documentation, Preparation, etc.)
  - `is_completed` (boolean) - Whether the item is completed
  - `completed_at` (timestamptz) - When the item was completed
  - `due_date` (timestamptz) - Optional due date for the item
  - `sort_order` (integer) - Order for displaying items
  - `is_required` (boolean) - Whether this item is required for closing
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Automation
  - Creates default checklist items when a seller reaches the closing stage
  - Automatically updates seller_journey_progress when all required items are complete
  - Marks journey as completed when checklist is done

  ## Security
  - Enable RLS on seller_closing_checklist_items table
  - Sellers can view and update their own checklist items
  - Agents can view and update checklist items for their clients
*/

-- Create seller_closing_checklist_items table
CREATE TABLE IF NOT EXISTS seller_closing_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
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
  CONSTRAINT valid_seller_checklist_category CHECK (category IN (
    'Financial',
    'Legal',
    'Documentation',
    'Property Preparation',
    'Utilities',
    'Final Walkthrough',
    'Moving',
    'Post-Closing'
  ))
);

ALTER TABLE seller_closing_checklist_items ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_seller_closing_checklist_seller_id ON seller_closing_checklist_items(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_closing_checklist_property_id ON seller_closing_checklist_items(property_id);

-- RLS Policies
CREATE POLICY "Sellers can view own closing checklist"
  ON seller_closing_checklist_items
  FOR SELECT
  TO authenticated
  USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can update own closing checklist"
  ON seller_closing_checklist_items
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can insert own closing checklist items"
  ON seller_closing_checklist_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete own closing checklist items"
  ON seller_closing_checklist_items
  FOR DELETE
  TO authenticated
  USING (auth.uid() = seller_id);

CREATE POLICY "Agents can view their clients closing checklist"
  ON seller_closing_checklist_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = seller_closing_checklist_items.seller_id
      AND profiles.assigned_agent_id = auth.uid()
    )
  );

CREATE POLICY "Agents can update their clients closing checklist"
  ON seller_closing_checklist_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = seller_closing_checklist_items.seller_id
      AND profiles.assigned_agent_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_seller_closing_checklist_updated_at()
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

CREATE TRIGGER update_seller_closing_checklist_updated_at_trigger
  BEFORE UPDATE ON seller_closing_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_closing_checklist_updated_at();

-- Function to check if all required items are complete and update journey
CREATE OR REPLACE FUNCTION check_seller_closing_checklist_completion()
RETURNS TRIGGER AS $$
DECLARE
  total_required INTEGER;
  total_completed INTEGER;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE is_required = true),
    COUNT(*) FILTER (WHERE is_required = true AND is_completed = true)
  INTO total_required, total_completed
  FROM seller_closing_checklist_items
  WHERE seller_id = NEW.seller_id
  AND (property_id = NEW.property_id OR (property_id IS NULL AND NEW.property_id IS NULL));

  IF total_required > 0 AND total_completed = total_required THEN
    UPDATE seller_journey_progress
    SET 
      closing_completed = true,
      closing_date = now(),
      current_stage = 'completed'
    WHERE seller_id = NEW.seller_id
    AND (property_id = NEW.property_id OR (property_id IS NULL AND NEW.property_id IS NULL))
    AND closing_completed = false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER check_seller_closing_checklist_completion_trigger
  AFTER INSERT OR UPDATE ON seller_closing_checklist_items
  FOR EACH ROW
  WHEN (NEW.is_completed = true)
  EXECUTE FUNCTION check_seller_closing_checklist_completion();

-- Function to create default checklist items for a seller
CREATE OR REPLACE FUNCTION create_default_seller_closing_checklist(
  p_seller_id uuid,
  p_property_id uuid DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO seller_closing_checklist_items (seller_id, property_id, item_name, description, category, sort_order, is_required)
  VALUES
    (p_seller_id, p_property_id, 'Review Purchase Agreement', 'Review and understand all terms of the purchase agreement', 'Legal', 1, true),
    (p_seller_id, p_property_id, 'Complete Seller Disclosures', 'Fill out and submit all required property disclosure forms', 'Legal', 2, true),
    (p_seller_id, p_property_id, 'Review Title Report', 'Review title report and address any title issues', 'Legal', 3, true),
    (p_seller_id, p_property_id, 'Schedule Final Walkthrough', 'Coordinate with buyer and agent for final walkthrough', 'Final Walkthrough', 4, true),
    (p_seller_id, p_property_id, 'Complete Agreed Repairs', 'Finish all repairs agreed upon in the purchase contract', 'Property Preparation', 5, true),
    (p_seller_id, p_property_id, 'Property Cleaned', 'Ensure property is cleaned and broom-swept', 'Property Preparation', 6, true),
    (p_seller_id, p_property_id, 'Remove Personal Belongings', 'Remove all personal items from the property', 'Moving', 7, true),
    (p_seller_id, p_property_id, 'Cancel Utilities', 'Schedule utility cancellation or transfer for closing day', 'Utilities', 8, true),
    (p_seller_id, p_property_id, 'Forward Mail', 'File change of address with USPS', 'Moving', 9, false),
    (p_seller_id, p_property_id, 'Gather Property Documents', 'Collect warranties, manuals, and garage door openers to leave for buyer', 'Documentation', 10, true),
    (p_seller_id, p_property_id, 'Provide Keys and Access Codes', 'Prepare all keys, remotes, and access codes for buyer', 'Documentation', 11, true),
    (p_seller_id, p_property_id, 'Review Closing Statement', 'Review HUD-1 or closing statement for accuracy', 'Financial', 12, true),
    (p_seller_id, p_property_id, 'Verify Payoff Amounts', 'Confirm mortgage payoff amount with lender', 'Financial', 13, true),
    (p_seller_id, p_property_id, 'Government-Issued ID Ready', 'Bring valid government-issued photo ID to closing', 'Documentation', 14, true),
    (p_seller_id, p_property_id, 'Closing Date Confirmed', 'Confirm closing date, time, and location with all parties', 'Documentation', 15, true),
    (p_seller_id, p_property_id, 'HOA Documents Provided', 'If applicable, provide HOA contact info and documents to buyer', 'Post-Closing', 16, false),
    (p_seller_id, p_property_id, 'Final Utility Readings', 'Schedule final meter readings with utility companies', 'Utilities', 17, true)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-create checklist when seller reaches closing stage
CREATE OR REPLACE FUNCTION auto_create_seller_closing_checklist()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_stage = 'closing' AND (OLD.current_stage IS NULL OR OLD.current_stage != 'closing') THEN
    PERFORM create_default_seller_closing_checklist(NEW.seller_id, NEW.property_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER auto_create_seller_closing_checklist_trigger
  AFTER INSERT OR UPDATE ON seller_journey_progress
  FOR EACH ROW
  WHEN (NEW.current_stage = 'closing')
  EXECUTE FUNCTION auto_create_seller_closing_checklist();
