/*
  # Fix Inspection Job Creation to Include Buyer ID

  1. Changes
    - Update the create_inspection_job() function to include buyer_id when creating jobs
    - This ensures inspection jobs are properly linked to buyers
    - Buyers will now be able to see their completed inspection reports

  2. Behavior
    - When an inspection request creates a job, the buyer_id is now set
    - Buyers can view completed inspection jobs in their Completed Service Reports section
*/

-- Update the function to include buyer_id
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
    
    -- Create the job with buyer_id
    INSERT INTO service_provider_jobs (
      service_provider_id,
      buyer_id,
      title,
      description,
      location,
      status,
      priority,
      start_date,
      service_category
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
      NEW.inspection_type
    )
    RETURNING id INTO NEW.job_id;
    
    -- Update inspection request status
    NEW.status = 'scheduled';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
