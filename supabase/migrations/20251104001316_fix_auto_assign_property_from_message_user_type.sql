/*
  # Fix auto_assign_property_from_message Function - user_type Column Error

  1. Problem
    - Function tries to SELECT user_type from conversation_participants table
    - conversation_participants doesn't have a user_type column
    - This causes "column user_type does not exist" error when sending messages
  
  2. Solution
    - Join with profiles table to get user_type for each participant
    - Update the function to properly fetch user_type from profiles
  
  3. Security
    - Function remains SECURITY DEFINER to allow system-level operations
    - No changes to access control logic
*/

CREATE OR REPLACE FUNCTION auto_assign_property_from_message() RETURNS TRIGGER AS $$
DECLARE
  v_renter_id uuid;
  v_property_owner_id uuid;
  v_property_id uuid;
  v_renter_type text;
  v_owner_type text;
BEGIN
  -- Get participant types by joining with profiles
  SELECT cp.user_id, p.user_type INTO v_renter_id, v_renter_type
  FROM conversation_participants cp
  JOIN profiles p ON p.id = cp.user_id
  WHERE cp.conversation_id = NEW.conversation_id
  LIMIT 1;

  SELECT cp.user_id, p.user_type INTO v_property_owner_id, v_owner_type
  FROM conversation_participants cp
  JOIN profiles p ON p.id = cp.user_id
  WHERE cp.conversation_id = NEW.conversation_id
    AND cp.user_id != v_renter_id
  LIMIT 1;

  -- Check if one is a renter and one is a property_owner
  IF (v_renter_type = 'renter' AND v_owner_type = 'property_owner') OR
     (v_renter_type = 'property_owner' AND v_owner_type = 'renter') THEN
    
    -- Swap if needed
    IF v_renter_type = 'property_owner' THEN
      DECLARE
        temp_id uuid := v_renter_id;
      BEGIN
        v_renter_id := v_property_owner_id;
        v_property_owner_id := temp_id;
      END;
    END IF;

    -- Get the property_id from conversation property_id field
    SELECT property_id INTO v_property_id
    FROM conversations
    WHERE id = NEW.conversation_id;

    -- If property found, create or update application
    IF v_property_id IS NOT NULL THEN
      INSERT INTO rental_applications (
        renter_id,
        property_id,
        property_owner_id,
        status
      )
      VALUES (
        v_renter_id,
        v_property_id,
        v_property_owner_id,
        'interested'
      )
      ON CONFLICT (renter_id, property_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
