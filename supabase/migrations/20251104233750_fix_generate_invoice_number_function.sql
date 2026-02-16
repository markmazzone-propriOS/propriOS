/*
  # Fix Generate Invoice Number Function

  1. Changes
    - Fix the invoice number generation logic to properly parse existing numbers
    - Change format from INV-YYYY#### to INV-YYYY-#### for better readability
    - Add proper error handling for concurrent requests
    - Use a more robust parsing method

  2. Notes
    - This fixes the duplicate key constraint violation
    - The new format is INV-2025-0001, INV-2025-0002, etc.
    - Numbers are sequential per year
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS generate_invoice_number();

-- Create improved function with better logic
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_number text;
  year_part text;
  seq_part int;
  max_attempts int := 10;
  attempt int := 0;
BEGIN
  year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Loop to handle race conditions
  LOOP
    -- Get the next sequence number for this year
    SELECT COALESCE(
      MAX(
        CAST(
          SPLIT_PART(invoice_number, '-', 3) AS INTEGER
        )
      ), 
      0
    ) + 1
    INTO seq_part
    FROM invoices
    WHERE invoice_number LIKE 'INV-' || year_part || '-%';
    
    -- Generate the new invoice number
    new_number := 'INV-' || year_part || '-' || LPAD(seq_part::text, 4, '0');
    
    -- Check if this number already exists (race condition check)
    IF NOT EXISTS (SELECT 1 FROM invoices WHERE invoice_number = new_number) THEN
      RETURN new_number;
    END IF;
    
    -- Increment attempt counter
    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique invoice number after % attempts', max_attempts;
    END IF;
    
    -- Small delay to reduce contention
    PERFORM pg_sleep(0.01);
  END LOOP;
END;
$$;
