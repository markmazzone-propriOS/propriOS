/*
  # Fix Inspection Job Creation Service Category Column

  1. Changes
    - Fix the create_inspection_job() function to use correct column name
    - Change `service_category` to `service_category_id` (correct column name)
    - Change `NEW.inspection_type` to `job_category_id` (use the fetched category ID)

  2. Issue Fixed
    - The function was trying to insert into a column `service_category` that doesn't exist
    - This was causing inspection requests to fail when submitted
    - The correct column name is `service_category_id`
*/

-- Update the function with correct column names
CREATE OR REPLACE FUNCTION create_inspection_job()
RETURNS TRIGGER AS $$
DECLARE
  property_address text;
  buyer_name text;
  job_category_id uuid;
BEGIN
  -- Only create job if service provider is assigned and job doesn't exist yet
  IF NEW.service_provider_id IS NOT NULL AND NEW.job_id IS NULL THEN
    
    -- Get property address
    SELECT address_line1 || ', ' || city || ', ' || state
    INTO property_address
    FROM properties
    WHERE id = NEW.property_id;
    
    -- Get buyer name
    SELECT full_name INTO buyer_name
    FROM profiles
    WHERE id = NEW.buyer_id;
    
    -- Get home inspection category (or general inspection)
    SELECT id INTO job_category_id
    FROM service_categories
    WHERE name ILIKE '%inspection%'
    LIMIT 1;
    
    -- Create the job with buyer_id and correct column names
    INSERT INTO service_provider_jobs (
      service_provider_id,
      buyer_id,
      title,
      description,
      location,
      status,
      priority,
      start_date,
      service_category_id
    ) VALUES (
      NEW.service_provider_id,
      NEW.buyer_id,
      NEW.inspection_type || ' Inspection - ' || property_address,
      'Inspection requested by ' || COALESCE(buyer_name, 'buyer') || 
      CASE WHEN NEW.special_instructions IS NOT NULL 
        THEN E'\n\nSpecial Instructions: ' || NEW.special_instructions 
        ELSE '' 
      END,
      property_address,
      'scheduled',
      'high',
      NEW.requested_date::timestamptz,
      job_category_id
    )
    RETURNING id INTO NEW.job_id;
    
    -- Update inspection request status
    NEW.status = 'scheduled';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
