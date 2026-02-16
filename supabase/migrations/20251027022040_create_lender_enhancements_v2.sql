/*
  # Mortgage Lender Enhanced Features

  1. New Tables
    - `application_documents`: Track documents for each loan application
    - `application_notes`: Internal notes on applications
    - `pre_approval_letters`: Generated pre-approval letters
    - `lender_team_members`: Team members for lender companies
    - `application_assignments`: Assign applications to team members
    - `lender_consultations`: Schedule consultations with buyers
    - `lender_leads`: Marketing leads captured
    - `referral_tracking`: Track referrals from agents
    - `compliance_checklists`: Track compliance requirements

  2. Security
    - Enable RLS on all new tables
    - Add policies for lenders to manage their data
*/

-- Application Documents
CREATE TABLE IF NOT EXISTS application_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES loan_applications(id) ON DELETE CASCADE NOT NULL,
  document_name text NOT NULL,
  document_type text NOT NULL,
  file_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'approved', 'rejected')),
  required boolean DEFAULT false,
  uploaded_at timestamptz,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE application_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lenders can manage documents for their applications"
  ON application_documents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM loan_applications
      WHERE loan_applications.id = application_documents.application_id
      AND loan_applications.lender_id = auth.uid()
    )
  );

CREATE POLICY "Buyers can view their application documents"
  ON application_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM loan_applications
      WHERE loan_applications.id = application_documents.application_id
      AND loan_applications.buyer_id = auth.uid()
    )
  );

-- Lender Team Members (create first, no dependencies)
CREATE TABLE IF NOT EXISTS lender_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id uuid REFERENCES mortgage_lender_profiles(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) NOT NULL,
  role text NOT NULL CHECK (role IN ('loan_officer', 'processor', 'underwriter', 'admin')),
  permissions jsonb DEFAULT '{}',
  added_at timestamptz DEFAULT now(),
  UNIQUE(lender_id, user_id)
);

ALTER TABLE lender_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lenders can manage their team"
  ON lender_team_members
  FOR ALL
  TO authenticated
  USING (lender_id = auth.uid());

CREATE POLICY "Team members can view their membership"
  ON lender_team_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Application Notes (references lender_team_members)
CREATE TABLE IF NOT EXISTS application_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES loan_applications(id) ON DELETE CASCADE NOT NULL,
  lender_user_id uuid REFERENCES profiles(id) NOT NULL,
  note text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE application_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lenders and team can manage notes"
  ON application_notes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM loan_applications
      WHERE loan_applications.id = application_notes.application_id
      AND loan_applications.lender_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM loan_applications la
      JOIN lender_team_members ltm ON ltm.lender_id = la.lender_id
      WHERE la.id = application_notes.application_id
      AND ltm.user_id = auth.uid()
    )
  );

-- Pre-Approval Letters
CREATE TABLE IF NOT EXISTS pre_approval_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pre_approval_request_id uuid REFERENCES pre_approval_requests(id) ON DELETE SET NULL,
  lender_id uuid REFERENCES mortgage_lender_profiles(id) NOT NULL,
  buyer_id uuid REFERENCES profiles(id) NOT NULL,
  approved_amount decimal NOT NULL,
  expiration_date date NOT NULL,
  conditions text,
  letter_content text NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'expired', 'revoked')),
  issued_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pre_approval_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lenders can manage their pre-approval letters"
  ON pre_approval_letters
  FOR ALL
  TO authenticated
  USING (lender_id = auth.uid());

CREATE POLICY "Buyers can view their pre-approval letters"
  ON pre_approval_letters
  FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid());

-- Application Assignments
CREATE TABLE IF NOT EXISTS application_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES loan_applications(id) ON DELETE CASCADE NOT NULL,
  assigned_to uuid REFERENCES profiles(id) NOT NULL,
  assigned_by uuid REFERENCES profiles(id) NOT NULL,
  assigned_at timestamptz DEFAULT now()
);

ALTER TABLE application_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lenders and team can manage assignments"
  ON application_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM loan_applications
      WHERE loan_applications.id = application_assignments.application_id
      AND loan_applications.lender_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM loan_applications la
      JOIN lender_team_members ltm ON ltm.lender_id = la.lender_id
      WHERE la.id = application_assignments.application_id
      AND ltm.user_id = auth.uid()
    )
  );

-- Lender Consultations
CREATE TABLE IF NOT EXISTS lender_consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id uuid REFERENCES mortgage_lender_profiles(id) NOT NULL,
  buyer_id uuid REFERENCES profiles(id) NOT NULL,
  consultation_date timestamptz NOT NULL,
  duration_minutes integer DEFAULT 30,
  consultation_type text DEFAULT 'phone' CHECK (consultation_type IN ('phone', 'video', 'in_person')),
  notes text,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lender_consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lenders can manage their consultations"
  ON lender_consultations
  FOR ALL
  TO authenticated
  USING (lender_id = auth.uid());

CREATE POLICY "Buyers can view their consultations"
  ON lender_consultations
  FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid());

-- Lender Leads
CREATE TABLE IF NOT EXISTS lender_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id uuid REFERENCES mortgage_lender_profiles(id) NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  lead_source text,
  status text DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  notes text,
  created_at timestamptz DEFAULT now(),
  contacted_at timestamptz
);

ALTER TABLE lender_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lenders can manage their leads"
  ON lender_leads
  FOR ALL
  TO authenticated
  USING (lender_id = auth.uid());

-- Referral Tracking
CREATE TABLE IF NOT EXISTS referral_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id uuid REFERENCES mortgage_lender_profiles(id) NOT NULL,
  agent_id uuid REFERENCES agent_profiles(id) NOT NULL,
  buyer_id uuid REFERENCES profiles(id) NOT NULL,
  application_id uuid REFERENCES loan_applications(id),
  referral_date timestamptz DEFAULT now(),
  commission_paid boolean DEFAULT false,
  commission_amount decimal
);

ALTER TABLE referral_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lenders can manage their referrals"
  ON referral_tracking
  FOR ALL
  TO authenticated
  USING (lender_id = auth.uid());

CREATE POLICY "Agents can view their referrals"
  ON referral_tracking
  FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid());

-- Compliance Checklists
CREATE TABLE IF NOT EXISTS compliance_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES loan_applications(id) ON DELETE CASCADE NOT NULL,
  checklist_name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  completed boolean DEFAULT false,
  completed_by uuid REFERENCES profiles(id),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE compliance_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lenders and team can manage compliance checklists"
  ON compliance_checklists
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM loan_applications
      WHERE loan_applications.id = compliance_checklists.application_id
      AND loan_applications.lender_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM loan_applications la
      JOIN lender_team_members ltm ON ltm.lender_id = la.lender_id
      WHERE la.id = compliance_checklists.application_id
      AND ltm.user_id = auth.uid()
    )
  );

-- Create storage bucket for application documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('application-documents', 'application-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for application documents
CREATE POLICY "Lenders can upload application documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'application-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT la.id::text
      FROM loan_applications la
      WHERE la.lender_id = auth.uid()
    )
  );

CREATE POLICY "Lenders can view application documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'application-documents'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT la.id::text
        FROM loan_applications la
        WHERE la.lender_id = auth.uid()
      )
      OR
      (storage.foldername(name))[1] IN (
        SELECT la.id::text
        FROM loan_applications la
        WHERE la.buyer_id = auth.uid()
      )
    )
  );

CREATE POLICY "Lenders can delete application documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'application-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT la.id::text
      FROM loan_applications la
      WHERE la.lender_id = auth.uid()
    )
  );