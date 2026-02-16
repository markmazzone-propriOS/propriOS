/*
  # Create Transaction Pipeline System for Agents

  1. New Tables
    - `transactions`
      - `id` (uuid, primary key)
      - `agent_id` (uuid, references profiles) - The agent managing this transaction
      - `client_id` (uuid, references profiles) - The buyer or seller client
      - `property_id` (uuid, references properties, nullable) - Associated property if applicable
      - `transaction_type` (text) - 'buyer_side' or 'seller_side'
      - `stage` (text) - Current pipeline stage
      - `status` (text) - 'active', 'won', 'lost'
      - `deal_value` (numeric) - Transaction value/price
      - `commission_percentage` (numeric) - Commission percentage
      - `commission_amount` (numeric) - Calculated commission
      - `expected_close_date` (date) - Expected closing date
      - `actual_close_date` (date, nullable) - Actual closing date
      - `notes` (text) - Internal notes about the transaction
      - `lead_source` (text) - Where the lead came from
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `stage_updated_at` (timestamptz) - When stage last changed

  2. Transaction Stages
    - lead: Initial prospect
    - contact_made: First contact established
    - showing_scheduled: Property showing scheduled
    - showing_completed: Showing completed
    - offer_preparation: Preparing offer
    - offer_submitted: Offer submitted
    - under_contract: Offer accepted, under contract
    - inspection: Inspection period
    - appraisal: Appraisal ordered/pending
    - financing: Loan processing
    - final_walkthrough: Final walkthrough scheduled
    - closing: Closing scheduled
    - closed: Deal closed successfully
    - lost: Deal lost/fell through

  3. Security
    - Enable RLS on `transactions` table
    - Agents can view/manage their own transactions
    - Clients can view transactions where they are the client

  4. Indexes
    - Index on agent_id for fast agent queries
    - Index on client_id for client lookups
    - Index on stage for pipeline filtering
    - Index on status for active/won/lost filtering
*/

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('buyer_side', 'seller_side')),
  stage text NOT NULL DEFAULT 'lead' CHECK (stage IN (
    'lead',
    'contact_made',
    'showing_scheduled',
    'showing_completed',
    'offer_preparation',
    'offer_submitted',
    'under_contract',
    'inspection',
    'appraisal',
    'financing',
    'final_walkthrough',
    'closing',
    'closed',
    'lost'
  )),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost')),
  deal_value numeric DEFAULT 0,
  commission_percentage numeric DEFAULT 0,
  commission_amount numeric DEFAULT 0,
  expected_close_date date,
  actual_close_date date,
  notes text DEFAULT '',
  lead_source text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  stage_updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_agent_id ON transactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_property_id ON transactions(property_id);
CREATE INDEX IF NOT EXISTS idx_transactions_stage ON transactions(stage);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Agents can view their own transactions
CREATE POLICY "Agents can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    agent_id = auth.uid()
  );

-- Agents can insert their own transactions
CREATE POLICY "Agents can create own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    agent_id = auth.uid()
  );

-- Agents can update their own transactions
CREATE POLICY "Agents can update own transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- Agents can delete their own transactions
CREATE POLICY "Agents can delete own transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (agent_id = auth.uid());

-- Clients can view transactions where they are involved
CREATE POLICY "Clients can view their transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid()
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_transaction_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at on transaction changes
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_updated_at();

-- Function to automatically update stage_updated_at when stage changes
CREATE OR REPLACE FUNCTION update_transaction_stage_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.stage_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update stage_updated_at when stage changes
DROP TRIGGER IF EXISTS update_transactions_stage_timestamp ON transactions;
CREATE TRIGGER update_transactions_stage_timestamp
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_stage_timestamp();

-- Function to automatically calculate commission amount
CREATE OR REPLACE FUNCTION calculate_transaction_commission()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deal_value IS NOT NULL AND NEW.commission_percentage IS NOT NULL THEN
    NEW.commission_amount = (NEW.deal_value * NEW.commission_percentage / 100);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to calculate commission automatically
DROP TRIGGER IF EXISTS calculate_transactions_commission ON transactions;
CREATE TRIGGER calculate_transactions_commission
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_transaction_commission();

-- Function to automatically update status when stage changes to closed or lost
CREATE OR REPLACE FUNCTION update_transaction_status_from_stage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stage = 'closed' THEN
    NEW.status = 'won';
    IF NEW.actual_close_date IS NULL THEN
      NEW.actual_close_date = CURRENT_DATE;
    END IF;
  ELSIF NEW.stage = 'lost' THEN
    NEW.status = 'lost';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update status from stage
DROP TRIGGER IF EXISTS update_transactions_status_from_stage ON transactions;
CREATE TRIGGER update_transactions_status_from_stage
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_status_from_stage();