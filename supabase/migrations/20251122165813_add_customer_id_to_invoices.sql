/*
  # Add Customer ID to Invoices for Direct Agent Invoicing

  1. Changes
    - Add `customer_id` (uuid, nullable, references profiles) to invoices table
    - Add index for customer lookups
    - Update RLS policies to allow customers to view their invoices
    - Keep existing fields for backwards compatibility with property owner workflow
  
  2. Security
    - Customers (agents) can view invoices where they are the customer
    - Service providers can still view all their invoices
  
  3. Notes
    - `customer_id` is nullable to support both workflows:
      - New workflow: Service provider creates invoice for agent directly (customer_id set)
      - Old workflow: Invoice linked via job → appointment → lead → property owner (customer_id null)
*/

-- Add customer_id to invoices
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE invoices ADD COLUMN customer_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for customer lookups
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);

-- Add RLS policy for customers to view their invoices
CREATE POLICY "Customers can view their own invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());
