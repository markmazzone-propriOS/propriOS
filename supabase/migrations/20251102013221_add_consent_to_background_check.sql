/*
  # Add Background Check Consent to Rental Applications

  1. Changes
    - Add consent_to_background_check column to rental_applications table
    - Add timestamp for when consent was given
  
  2. Notes
    - This field records when the applicant consented to background and credit checks
    - Required for legal compliance in rental application processing
*/

-- Add consent column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rental_applications' 
    AND column_name = 'consent_to_background_check'
  ) THEN
    ALTER TABLE rental_applications 
    ADD COLUMN consent_to_background_check boolean DEFAULT false;
  END IF;
END $$;

-- Add timestamp for when consent was given
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rental_applications' 
    AND column_name = 'consent_given_at'
  ) THEN
    ALTER TABLE rental_applications 
    ADD COLUMN consent_given_at timestamptz;
  END IF;
END $$;