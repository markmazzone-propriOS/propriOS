/*
  # Create Loan Applications System for Mortgage Lenders

  1. New Tables
    - `loan_applications`
      - `id` (uuid, primary key)
      - `lender_id` (uuid, references auth.users - the mortgage lender)
      - `buyer_id` (uuid, references auth.users - the buyer/applicant)
      - `property_id` (uuid, references properties, nullable)
      - `application_type` (text: 'pre_approval', 'full_application', 'refinance')
      - `status` (text: 'pending_review', 'documents_requested', 'under_review', 'approved', 'denied', 'withdrawn')
      - `loan_amount` (numeric)
      - `loan_type` (text: 'conventional', 'fha', 'va', 'usda', 'jumbo')
      - `interest_rate` (numeric, nullable)
      - `down_payment_amount` (numeric, nullable)
      - `credit_score` (integer, nullable)
      - `annual_income` (numeric, nullable)
      - `employment_status` (text, nullable)
      - `notes` (text, nullable)
      - `estimated_closing_date` (date, nullable)
      - `approval_date` (timestamptz, nullable)
      - `denial_reason` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `loan_documents`
      - `id` (uuid, primary key)
      - `application_id` (uuid, references loan_applications)
      - `document_type` (text: 'income_verification', 'bank_statements', 'tax_returns', 'id_verification', 'credit_report', 'other')
      - `document_name` (text)
      - `document_url` (text)
      - `uploaded_by` (uuid, references auth.users)
      - `status` (text: 'pending', 'approved', 'rejected')
      - `created_at` (timestamptz)

    - `pre_approval_requests`
      - `id` (uuid, primary key)
      - `buyer_id` (uuid, references auth.users)
      - `lender_id` (uuid, references auth.users, nullable - assigned by buyer)
      - `requested_amount` (numeric)
      - `annual_income` (numeric)
      - `credit_score` (integer, nullable)
      - `down_payment_percentage` (integer)
      - `employment_status` (text)
      - `property_type` (text: 'single_family', 'condo', 'townhouse', 'multi_family')
      - `status` (text: 'submitted', 'in_review', 'approved', 'denied')
      - `lender_notes` (text, nullable)
      - `approved_amount` (numeric, nullable)
      - `approval_date` (timestamptz, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Lenders can view/update their own applications
    - Buyers can view their own applications
    - Proper access controls for documents
*/

CREATE TABLE IF NOT EXISTS loan_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  buyer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  application_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending_review',
  loan_amount numeric NOT NULL,
  loan_type text NOT NULL,
  interest_rate numeric,
  down_payment_amount numeric,
  credit_score integer,
  annual_income numeric,
  employment_status text,
  notes text,
  estimated_closing_date date,
  approval_date timestamptz,
  denial_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_application_type CHECK (application_type IN (
    'pre_approval', 'full_application', 'refinance'
  )),
  CONSTRAINT valid_status CHECK (status IN (
    'pending_review', 'documents_requested', 'under_review', 
    'approved', 'denied', 'withdrawn'
  )),
  CONSTRAINT valid_loan_type CHECK (loan_type IN (
    'conventional', 'fha', 'va', 'usda', 'jumbo'
  ))
);

CREATE TABLE IF NOT EXISTS loan_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES loan_applications(id) ON DELETE CASCADE NOT NULL,
  document_type text NOT NULL,
  document_name text NOT NULL,
  document_url text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_document_type CHECK (document_type IN (
    'income_verification', 'bank_statements', 'tax_returns', 
    'id_verification', 'credit_report', 'other'
  )),
  CONSTRAINT valid_document_status CHECK (status IN (
    'pending', 'approved', 'rejected'
  ))
);

CREATE TABLE IF NOT EXISTS pre_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_amount numeric NOT NULL,
  annual_income numeric NOT NULL,
  credit_score integer,
  down_payment_percentage integer NOT NULL,
  employment_status text NOT NULL,
  property_type text NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  lender_notes text,
  approved_amount numeric,
  approval_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_property_type CHECK (property_type IN (
    'single_family', 'condo', 'townhouse', 'multi_family'
  )),
  CONSTRAINT valid_pre_approval_status CHECK (status IN (
    'submitted', 'in_review', 'approved', 'denied'
  ))
);

ALTER TABLE loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE pre_approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lenders can view their loan applications"
  ON loan_applications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = lender_id);

CREATE POLICY "Lenders can update their loan applications"
  ON loan_applications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = lender_id)
  WITH CHECK (auth.uid() = lender_id);

CREATE POLICY "Lenders can insert loan applications"
  ON loan_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = lender_id);

CREATE POLICY "Buyers can view their loan applications"
  ON loan_applications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id);

CREATE POLICY "Buyers can insert loan applications"
  ON loan_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Lenders can view loan documents for their applications"
  ON loan_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM loan_applications
      WHERE loan_applications.id = loan_documents.application_id
      AND loan_applications.lender_id = auth.uid()
    )
  );

CREATE POLICY "Buyers can view their loan documents"
  ON loan_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM loan_applications
      WHERE loan_applications.id = loan_documents.application_id
      AND loan_applications.buyer_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert loan documents for their applications"
  ON loan_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM loan_applications
      WHERE loan_applications.id = loan_documents.application_id
      AND (loan_applications.lender_id = auth.uid() OR loan_applications.buyer_id = auth.uid())
    )
  );

CREATE POLICY "Lenders can update loan documents"
  ON loan_documents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM loan_applications
      WHERE loan_applications.id = loan_documents.application_id
      AND loan_applications.lender_id = auth.uid()
    )
  );

CREATE POLICY "Lenders can view pre-approval requests assigned to them"
  ON pre_approval_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = lender_id);

CREATE POLICY "Lenders can update pre-approval requests assigned to them"
  ON pre_approval_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = lender_id)
  WITH CHECK (auth.uid() = lender_id);

CREATE POLICY "Buyers can view their pre-approval requests"
  ON pre_approval_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id);

CREATE POLICY "Buyers can insert pre-approval requests"
  ON pre_approval_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyers can update their pre-approval requests"
  ON pre_approval_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = buyer_id)
  WITH CHECK (auth.uid() = buyer_id);

CREATE INDEX idx_loan_applications_lender_id ON loan_applications(lender_id);
CREATE INDEX idx_loan_applications_buyer_id ON loan_applications(buyer_id);
CREATE INDEX idx_loan_applications_status ON loan_applications(status);
CREATE INDEX idx_loan_documents_application_id ON loan_documents(application_id);
CREATE INDEX idx_pre_approval_requests_lender_id ON pre_approval_requests(lender_id);
CREATE INDEX idx_pre_approval_requests_buyer_id ON pre_approval_requests(buyer_id);

CREATE OR REPLACE FUNCTION update_loan_application_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_loan_applications_updated_at
  BEFORE UPDATE ON loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_loan_application_updated_at();

CREATE TRIGGER update_pre_approval_requests_updated_at
  BEFORE UPDATE ON pre_approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_loan_application_updated_at();

CREATE OR REPLACE FUNCTION update_journey_on_pre_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    UPDATE buyer_journey_progress
    SET
      pre_approval_completed = true,
      pre_approval_date = COALESCE(pre_approval_date, NEW.approval_date)
    WHERE buyer_id = NEW.buyer_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_journey_on_pre_approval
  AFTER UPDATE ON pre_approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_journey_on_pre_approval();

CREATE TRIGGER trigger_journey_on_loan_approval
  AFTER UPDATE ON loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_journey_on_pre_approval();
