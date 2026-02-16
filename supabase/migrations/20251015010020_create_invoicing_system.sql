/*
  # Create Invoicing System for Service Providers

  1. New Tables
    - `invoices`
      - `id` (uuid, primary key)
      - `invoice_number` (text, unique) - Auto-generated invoice number
      - `provider_id` (uuid, foreign key) - Service provider who created the invoice
      - `customer_name` (text) - Customer name
      - `customer_email` (text) - Customer email
      - `customer_phone` (text) - Customer phone (optional)
      - `customer_address` (text) - Customer address (optional)
      - `issue_date` (date) - Date invoice was issued
      - `due_date` (date) - Payment due date
      - `status` (text) - Invoice status: draft, sent, paid, overdue, cancelled
      - `subtotal` (numeric) - Subtotal before tax
      - `tax_rate` (numeric) - Tax rate percentage
      - `tax_amount` (numeric) - Calculated tax amount
      - `total` (numeric) - Total amount due
      - `notes` (text) - Additional notes (optional)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `invoice_items`
      - `id` (uuid, primary key)
      - `invoice_id` (uuid, foreign key) - Reference to invoice
      - `description` (text) - Item/service description
      - `quantity` (numeric) - Quantity
      - `unit_price` (numeric) - Price per unit
      - `amount` (numeric) - Total amount (quantity * unit_price)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Service providers can only manage their own invoices
    - Customers can view invoices shared with them (future enhancement)
*/

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  provider_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  customer_address text,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  subtotal numeric(10, 2) NOT NULL DEFAULT 0,
  tax_rate numeric(5, 2) NOT NULL DEFAULT 0,
  tax_amount numeric(10, 2) NOT NULL DEFAULT 0,
  total numeric(10, 2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create invoice_items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  quantity numeric(10, 2) NOT NULL DEFAULT 1,
  unit_price numeric(10, 2) NOT NULL,
  amount numeric(10, 2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoices
CREATE POLICY "Service providers can view own invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (auth.uid() = provider_id);

CREATE POLICY "Service providers can create own invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = provider_id);

CREATE POLICY "Service providers can update own invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (auth.uid() = provider_id)
  WITH CHECK (auth.uid() = provider_id);

CREATE POLICY "Service providers can delete own invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (auth.uid() = provider_id);

-- RLS Policies for invoice_items
CREATE POLICY "Service providers can view own invoice items"
  ON invoice_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.provider_id = auth.uid()
    )
  );

CREATE POLICY "Service providers can create own invoice items"
  ON invoice_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.provider_id = auth.uid()
    )
  );

CREATE POLICY "Service providers can update own invoice items"
  ON invoice_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.provider_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.provider_id = auth.uid()
    )
  );

CREATE POLICY "Service providers can delete own invoice items"
  ON invoice_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.provider_id = auth.uid()
    )
  );

-- Create function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text AS $$
DECLARE
  new_number text;
  year_part text;
  seq_part int;
BEGIN
  year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 6) AS INTEGER)), 0) + 1
  INTO seq_part
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || year_part || '%';
  
  new_number := 'INV-' || year_part || LPAD(seq_part::text, 4, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Create function to update invoice totals
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS trigger AS $$
DECLARE
  invoice_subtotal numeric(10, 2);
  invoice_tax numeric(10, 2);
  invoice_total numeric(10, 2);
  invoice_tax_rate numeric(5, 2);
BEGIN
  -- Get the tax rate for the invoice
  SELECT tax_rate INTO invoice_tax_rate
  FROM invoices
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  -- Calculate subtotal from all items
  SELECT COALESCE(SUM(amount), 0) INTO invoice_subtotal
  FROM invoice_items
  WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  -- Calculate tax and total
  invoice_tax := ROUND(invoice_subtotal * invoice_tax_rate / 100, 2);
  invoice_total := invoice_subtotal + invoice_tax;
  
  -- Update the invoice
  UPDATE invoices
  SET 
    subtotal = invoice_subtotal,
    tax_amount = invoice_tax,
    total = invoice_total,
    updated_at = now()
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update invoice totals when items change
DROP TRIGGER IF EXISTS update_invoice_totals_trigger ON invoice_items;
CREATE TRIGGER update_invoice_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_totals();

-- Create function to update invoice updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at on invoices
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_invoices_provider_id ON invoices(provider_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
