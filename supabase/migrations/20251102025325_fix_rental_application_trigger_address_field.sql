/*
  # Fix Rental Application Notification Trigger

  ## Overview
  Fixes the notify_application_status_change trigger to use the correct
  address column names from the properties table.

  ## Changes
  - Update trigger function to use address_line1 and address_line2
  - Concatenate address fields properly for display

  ## Notes
  The properties table uses address_line1 and address_line2, not a single
  address column. This was causing the trigger to fail when updating
  rental applications.
*/

-- Fix the notification trigger to use correct address columns
CREATE OR REPLACE FUNCTION notify_application_status_change() RETURNS TRIGGER AS $$
DECLARE
  v_property_address text;
  v_renter_name text;
  v_action_title text;
  v_action_description text;
BEGIN
  -- Get property address (concatenate address_line1 and address_line2)
  SELECT CONCAT_WS(', ', address_line1, address_line2) INTO v_property_address
  FROM properties
  WHERE id = NEW.property_id;

  -- Get renter name
  SELECT full_name INTO v_renter_name
  FROM profiles
  WHERE id = NEW.renter_id;

  -- Determine action based on status
  CASE NEW.status
    WHEN 'applied' THEN
      v_action_title := 'Application Submitted';
      v_action_description := v_renter_name || ' submitted a rental application for ' || v_property_address;
    WHEN 'background_check' THEN
      v_action_title := 'Background Check';
      v_action_description := 'Background check initiated for ' || v_property_address;
    WHEN 'approved' THEN
      v_action_title := 'Application Approved';
      v_action_description := 'Your application for ' || v_property_address || ' has been approved!';
    WHEN 'rejected' THEN
      v_action_title := 'Application Rejected';
      v_action_description := 'Your application for ' || v_property_address || ' was not approved';
    WHEN 'lease_signed' THEN
      v_action_title := 'Lease Signed';
      v_action_description := 'Lease agreement signed for ' || v_property_address;
    WHEN 'active' THEN
      v_action_title := 'Moved In';
      v_action_description := v_renter_name || ' moved into ' || v_property_address;
    ELSE
      RETURN NEW;
  END CASE;

  -- Create activity for renter
  IF v_action_title IS NOT NULL THEN
    PERFORM create_activity(
      NEW.renter_id,
      NEW.property_owner_id,
      'rental_application_status',
      v_action_title,
      v_action_description,
      NEW.id,
      'rental_application',
      jsonb_build_object(
        'status', NEW.status,
        'property_address', v_property_address
      )
    );

    -- Create activity for property owner too
    PERFORM create_activity(
      NEW.property_owner_id,
      NEW.renter_id,
      'rental_application_status',
      v_action_title,
      v_action_description,
      NEW.id,
      'rental_application',
      jsonb_build_object(
        'status', NEW.status,
        'property_address', v_property_address,
        'renter_name', v_renter_name
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
