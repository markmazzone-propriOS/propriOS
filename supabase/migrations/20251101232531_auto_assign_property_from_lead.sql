/*
  # Auto-Assign Property from Lead Submission

  ## Overview
  When a renter (authenticated user) submits a lead through the ContactOwnerModal,
  automatically create a rental application to track the renter-property relationship.

  ## Changes
  1. Add trigger on property_owner_leads to auto-create rental_applications
  2. Only trigger for authenticated renters (not anonymous leads)

  ## Notes
  - This complements the message-based trigger
  - Handles case where renter contacts owner through property detail page
*/

-- Trigger to auto-assign property when authenticated renter submits a lead
CREATE OR REPLACE FUNCTION auto_assign_property_from_lead() RETURNS TRIGGER AS $$
DECLARE
  v_renter_profile profiles%ROWTYPE;
BEGIN
  -- Check if the lead has a lead_email that matches an authenticated renter
  SELECT * INTO v_renter_profile
  FROM profiles
  WHERE id IN (
    SELECT id FROM auth.users WHERE email = NEW.lead_email
  )
  AND user_type = 'renter'
  LIMIT 1;

  -- If we found a renter profile, create or update rental application
  IF v_renter_profile.id IS NOT NULL THEN
    INSERT INTO rental_applications (
      renter_id,
      property_id,
      property_owner_id,
      status
    )
    VALUES (
      v_renter_profile.id,
      NEW.property_id,
      NEW.property_owner_id,
      'interested'
    )
    ON CONFLICT (renter_id, property_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_lead_submitted_auto_assign_property
  AFTER INSERT ON property_owner_leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_property_from_lead();
