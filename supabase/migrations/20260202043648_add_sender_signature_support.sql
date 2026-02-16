/*
  # Add Sender Signature Support

  1. Changes
    - Adds fields to track sender (agent/property owner) signatures
    - Allows documents to require signatures from both sender and recipient
    - Updates status logic to track when both parties have signed
    - Adds RLS policy for senders to update their own signatures
  
  2. New Fields
    - `sender_needs_to_sign` - boolean indicating if sender also needs to sign
    - `sender_signature_data` - the sender's signature (base64 or typed)
    - `sender_signature_type` - type: drawn, typed
    - `sender_signed_at` - timestamp when sender signed
    - `signer_signed_at` - rename of signed_at for clarity
  
  3. Status Changes
    - `pending` - neither has signed
    - `partially_signed` - one party has signed, waiting for other
    - `signed` - both parties have signed (or only required party signed)
    - `declined` - one party declined
    - `expired` - signature request expired
*/

-- Add new columns for sender signature
ALTER TABLE document_signatures
ADD COLUMN IF NOT EXISTS sender_needs_to_sign boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sender_signature_data text,
ADD COLUMN IF NOT EXISTS sender_signature_type text CHECK (sender_signature_type IN ('drawn', 'typed')),
ADD COLUMN IF NOT EXISTS sender_signed_at timestamptz,
ADD COLUMN IF NOT EXISTS signer_signed_at timestamptz;

-- Migrate existing signed_at to signer_signed_at
UPDATE document_signatures
SET signer_signed_at = signed_at
WHERE signed_at IS NOT NULL AND signer_signed_at IS NULL;

-- Update status constraint to include partially_signed
ALTER TABLE document_signatures
DROP CONSTRAINT IF EXISTS document_signatures_status_check;

ALTER TABLE document_signatures
ADD CONSTRAINT document_signatures_status_check
CHECK (status IN ('pending', 'partially_signed', 'signed', 'declined', 'expired'));

-- Add RLS policy for senders to update their signature
CREATE POLICY "Senders can update their own signature"
  ON document_signatures FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id AND sender_needs_to_sign = true)
  WITH CHECK (auth.uid() = sender_id);

-- Function to automatically update status when signatures are added
CREATE OR REPLACE FUNCTION update_signature_status()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_status text;
BEGIN
  -- Determine new status based on signatures
  IF NEW.sender_needs_to_sign THEN
    -- Both parties need to sign
    IF NEW.sender_signed_at IS NOT NULL AND NEW.signer_signed_at IS NOT NULL THEN
      v_new_status := 'signed';
    ELSIF NEW.sender_signed_at IS NOT NULL OR NEW.signer_signed_at IS NOT NULL THEN
      v_new_status := 'partially_signed';
    ELSE
      v_new_status := 'pending';
    END IF;
  ELSE
    -- Only signer needs to sign
    IF NEW.signer_signed_at IS NOT NULL THEN
      v_new_status := 'signed';
    ELSE
      v_new_status := 'pending';
    END IF;
  END IF;

  -- Update status if it changed (unless it's declined or expired)
  IF NEW.status NOT IN ('declined', 'expired') THEN
    NEW.status := v_new_status;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to auto-update status
DROP TRIGGER IF EXISTS auto_update_signature_status ON document_signatures;
CREATE TRIGGER auto_update_signature_status
  BEFORE UPDATE ON document_signatures
  FOR EACH ROW
  WHEN (
    NEW.sender_signed_at IS DISTINCT FROM OLD.sender_signed_at OR
    NEW.signer_signed_at IS DISTINCT FROM OLD.signer_signed_at
  )
  EXECUTE FUNCTION update_signature_status();

-- Update existing triggers to use signer_signed_at
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
  -- Only mark as complete when fully signed
  IF NEW.status = 'signed' AND OLD.status != 'signed' THEN
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
      signed_at = GREATEST(COALESCE(NEW.sender_signed_at, NEW.signer_signed_at), COALESCE(NEW.signer_signed_at, NEW.sender_signed_at)),
      updated_at = now()
    WHERE id = NEW.document_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Add activity notification when sender signs
CREATE OR REPLACE FUNCTION notify_sender_signature_completed()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_document_name text;
  v_sender_name text;
BEGIN
  -- Only notify if sender just signed (and didn't before)
  IF NEW.sender_signed_at IS NOT NULL AND OLD.sender_signed_at IS NULL THEN
    -- Get document and user names
    SELECT file_name INTO v_document_name
    FROM documents
    WHERE id = NEW.document_id;

    SELECT full_name INTO v_sender_name
    FROM profiles
    WHERE id = NEW.sender_id;

    -- Create activity for signer (to notify them sender signed)
    PERFORM create_activity(
      NEW.signer_id,
      NEW.sender_id,
      'signature_completed',
      'Document Signed',
      v_sender_name || ' signed "' || v_document_name || '"',
      NEW.id,
      'document_signature',
      jsonb_build_object(
        'document_id', NEW.document_id,
        'document_name', v_document_name,
        'signed_at', NEW.sender_signed_at,
        'signed_by', 'sender'
      )
    );

    -- If both have now signed, notify both parties
    IF NEW.status = 'signed' THEN
      PERFORM create_activity(
        NEW.sender_id,
        NEW.signer_id,
        'document_fully_signed',
        'Document Fully Executed',
        '"' || v_document_name || '" has been signed by all parties',
        NEW.id,
        'document_signature',
        jsonb_build_object(
          'document_id', NEW.document_id,
          'document_name', v_document_name
        )
      );

      PERFORM create_activity(
        NEW.signer_id,
        NEW.sender_id,
        'document_fully_signed',
        'Document Fully Executed',
        '"' || v_document_name || '" has been signed by all parties',
        NEW.id,
        'document_signature',
        jsonb_build_object(
          'document_id', NEW.document_id,
          'document_name', v_document_name
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_sender_signature_completed
  AFTER UPDATE OF sender_signed_at ON document_signatures
  FOR EACH ROW
  WHEN (NEW.sender_signed_at IS NOT NULL AND OLD.sender_signed_at IS NULL)
  EXECUTE FUNCTION notify_sender_signature_completed();

-- Update the existing signer notification to use signer_signed_at
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
  -- Only notify if signer just signed (and didn't before)
  IF NEW.signer_signed_at IS NOT NULL AND OLD.signer_signed_at IS NULL THEN
    -- Get document and user names
    SELECT file_name INTO v_document_name
    FROM documents
    WHERE id = NEW.document_id;

    SELECT full_name INTO v_signer_name
    FROM profiles
    WHERE id = NEW.signer_id;

    -- Create activity for sender (property owner/agent)
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
        'signed_at', NEW.signer_signed_at,
        'signed_by', 'signer'
      )
    );

    -- If both have now signed, notify both parties
    IF NEW.status = 'signed' THEN
      PERFORM create_activity(
        NEW.sender_id,
        NEW.signer_id,
        'document_fully_signed',
        'Document Fully Executed',
        '"' || v_document_name || '" has been signed by all parties',
        NEW.id,
        'document_signature',
        jsonb_build_object(
          'document_id', NEW.document_id,
          'document_name', v_document_name
        )
      );

      PERFORM create_activity(
        NEW.signer_id,
        NEW.sender_id,
        'document_fully_signed',
        'Document Fully Executed',
        '"' || v_document_name || '" has been signed by all parties',
        NEW.id,
        'document_signature',
        jsonb_build_object(
          'document_id', NEW.document_id,
          'document_name', v_document_name
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;