/*
  # Fix Lease Signing Journey Update Trigger

  ## Overview
  Updates the document signature trigger to properly recognize "Contract" type documents
  as lease agreements, so that when a Contract document is signed, it updates the 
  rental application status to 'lease_signed' and triggers the renter journey tracker.

  ## Changes
  1. Update `update_rental_status_on_signature` function to recognize both:
     - document_type = 'rental_agreement' (legacy)
     - document_type = 'Contract' (current standard)
     - Any document with a rental_agreement_id set
  
  ## Important Notes
  - This ensures that lease signing properly updates the renter journey tracker
  - The function now uses case-insensitive matching for document types
*/

-- Update the trigger function to handle Contract type documents
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
    -- Get document type and rental_agreement_id
    SELECT document_type, rental_agreement_id INTO v_document_type, v_rental_app_id
    FROM documents
    WHERE id = NEW.document_id;

    -- If it's a contract/rental agreement, update application status
    -- Check for 'Contract' or 'rental_agreement' (case insensitive) or has rental_agreement_id
    IF LOWER(v_document_type) IN ('contract', 'rental_agreement') OR v_rental_app_id IS NOT NULL THEN
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