/*
  # Create Document Signature System

  ## Overview
  Implements a complete document signing workflow for rental agreements.
  Property owners can send documents for signature, renters can sign them,
  and the system tracks the entire process with automatic status updates.

  ## New Tables
  1. `document_signatures`
     - `id` (uuid, primary key)
     - `document_id` (uuid, references documents) - The document to be signed
     - `rental_application_id` (uuid, references rental_applications) - Related application
     - `sender_id` (uuid, references profiles) - Property owner sending for signature
     - `signer_id` (uuid, references profiles) - Renter who needs to sign
     - `status` (text) - Status: pending, signed, declined, expired
     - `signature_data` (text) - The actual signature (base64 image or typed name)
     - `signature_type` (text) - Type: drawn, typed
     - `sent_at` (timestamptz) - When signature request was sent
     - `signed_at` (timestamptz) - When document was signed
     - `declined_at` (timestamptz) - When signature was declined
     - `decline_reason` (text) - Why signature was declined
     - `signed_document_url` (text) - URL to signed document copy
     - `ip_address` (text) - IP address of signer for audit trail
     - `expires_at` (timestamptz) - When signature request expires
     - `reminder_sent_at` (timestamptz) - Last reminder sent
     - `notes` (text) - Additional notes
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

  ## Updates to Existing Tables
  - Add signature-related fields to documents table

  ## Triggers
  1. Automatically update rental_application status to 'lease_signed' when document is signed
  2. Create activity feed entries for signature requests and completions
  3. Send email notifications

  ## Security
  - RLS enabled on document_signatures
  - Senders can view their sent signature requests
  - Signers can view and update their pending signatures
  - Both parties can view completed signatures
*/

-- Create document_signatures table
CREATE TABLE IF NOT EXISTS document_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  rental_application_id uuid REFERENCES rental_applications(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  signer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'declined', 'expired')),
  signature_data text,
  signature_type text CHECK (signature_type IN ('drawn', 'typed')),
  sent_at timestamptz DEFAULT now(),
  signed_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  signed_document_url text,
  ip_address text,
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  reminder_sent_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add signature-related fields to documents table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'requires_signature'
  ) THEN
    ALTER TABLE documents ADD COLUMN requires_signature boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'signature_status'
  ) THEN
    ALTER TABLE documents ADD COLUMN signature_status text CHECK (signature_status IN ('not_required', 'pending', 'signed', 'declined'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'signed_by'
  ) THEN
    ALTER TABLE documents ADD COLUMN signed_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'signed_at'
  ) THEN
    ALTER TABLE documents ADD COLUMN signed_at timestamptz;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE document_signatures ENABLE ROW LEVEL SECURITY;

-- Senders (property owners) can view their sent signature requests
CREATE POLICY "Senders can view their signature requests"
  ON document_signatures FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id);

-- Signers (renters) can view their pending signatures
CREATE POLICY "Signers can view their signature requests"
  ON document_signatures FOR SELECT
  TO authenticated
  USING (auth.uid() = signer_id);

-- Signers can update their own signature requests (to sign or decline)
CREATE POLICY "Signers can update their signature requests"
  ON document_signatures FOR UPDATE
  TO authenticated
  USING (auth.uid() = signer_id AND status = 'pending')
  WITH CHECK (auth.uid() = signer_id);

-- Senders can insert new signature requests
CREATE POLICY "Senders can create signature requests"
  ON document_signatures FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_document_signatures_document_id ON document_signatures(document_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_sender_id ON document_signatures(sender_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_signer_id ON document_signatures(signer_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_status ON document_signatures(status);
CREATE INDEX IF NOT EXISTS idx_document_signatures_rental_app ON document_signatures(rental_application_id);

-- Trigger: Update rental application status when lease is signed
CREATE OR REPLACE FUNCTION update_rental_status_on_signature()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_document_type text;
  v_rental_app_id uuid;
BEGIN
  IF NEW.status = 'signed' AND OLD.status = 'pending' THEN
    -- Get document type
    SELECT document_type, rental_agreement_id INTO v_document_type, v_rental_app_id
    FROM documents
    WHERE id = NEW.document_id;

    -- If it's a rental agreement, update application status
    IF v_document_type = 'rental_agreement' OR v_rental_app_id IS NOT NULL THEN
      -- Use the rental_application_id from signature request or document
      v_rental_app_id := COALESCE(NEW.rental_application_id, v_rental_app_id);
      
      IF v_rental_app_id IS NOT NULL THEN
        UPDATE rental_applications
        SET 
          status = 'lease_signed',
          updated_at = now()
        WHERE id = v_rental_app_id;
      END IF;
    END IF;

    -- Update document status
    UPDATE documents
    SET 
      signature_status = 'signed',
      signed_by = NEW.signer_id,
      signed_at = NEW.signed_at,
      updated_at = now()
    WHERE id = NEW.document_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_signature_completed
  AFTER UPDATE OF status ON document_signatures
  FOR EACH ROW
  WHEN (NEW.status = 'signed')
  EXECUTE FUNCTION update_rental_status_on_signature();

-- Trigger: Create activity when signature request is sent
CREATE OR REPLACE FUNCTION notify_signature_request_sent()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_document_name text;
  v_signer_name text;
  v_sender_name text;
BEGIN
  -- Get document and user names
  SELECT title INTO v_document_name
  FROM documents
  WHERE id = NEW.document_id;

  SELECT full_name INTO v_signer_name
  FROM profiles
  WHERE id = NEW.signer_id;

  SELECT full_name INTO v_sender_name
  FROM profiles
  WHERE id = NEW.sender_id;

  -- Create activity for signer
  PERFORM create_activity(
    NEW.signer_id,
    NEW.sender_id,
    'signature_request',
    'Signature Required',
    v_sender_name || ' sent "' || v_document_name || '" for your signature',
    NEW.id,
    'document_signature',
    jsonb_build_object(
      'document_id', NEW.document_id,
      'document_name', v_document_name,
      'expires_at', NEW.expires_at
    )
  );

  -- Create activity for sender
  PERFORM create_activity(
    NEW.sender_id,
    NEW.signer_id,
    'signature_request_sent',
    'Signature Request Sent',
    'Sent "' || v_document_name || '" to ' || v_signer_name || ' for signature',
    NEW.id,
    'document_signature',
    jsonb_build_object(
      'document_id', NEW.document_id,
      'document_name', v_document_name,
      'signer_name', v_signer_name
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_signature_request_created
  AFTER INSERT ON document_signatures
  FOR EACH ROW
  EXECUTE FUNCTION notify_signature_request_sent();

-- Trigger: Create activity when document is signed
CREATE OR REPLACE FUNCTION notify_signature_completed()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_document_name text;
  v_signer_name text;
BEGIN
  IF NEW.status = 'signed' AND OLD.status = 'pending' THEN
    -- Get document and user names
    SELECT title INTO v_document_name
    FROM documents
    WHERE id = NEW.document_id;

    SELECT full_name INTO v_signer_name
    FROM profiles
    WHERE id = NEW.signer_id;

    -- Create activity for sender (property owner)
    PERFORM create_activity(
      NEW.sender_id,
      NEW.signer_id,
      'signature_completed',
      'Document Signed',
      v_signer_name || ' signed "' || v_document_name || '"',
      NEW.id,
      'document_signature',
      jsonb_build_object(
        'document_id', NEW.document_id,
        'document_name', v_document_name,
        'signed_at', NEW.signed_at
      )
    );

    -- Create activity for signer
    PERFORM create_activity(
      NEW.signer_id,
      NEW.sender_id,
      'signature_completed',
      'Document Signed',
      'You signed "' || v_document_name || '"',
      NEW.id,
      'document_signature',
      jsonb_build_object(
        'document_id', NEW.document_id,
        'document_name', v_document_name,
        'signed_at', NEW.signed_at
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_signature_completed_notify
  AFTER UPDATE OF status ON document_signatures
  FOR EACH ROW
  WHEN (NEW.status = 'signed')
  EXECUTE FUNCTION notify_signature_completed();