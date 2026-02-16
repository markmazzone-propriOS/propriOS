/*
  # Fix notify_agent_assigned trigger function

  1. Changes
    - Fix the trigger function to use `assigned_agent_id` instead of `agent_id`
    - The profiles table has `assigned_agent_id`, not `agent_id`
    - This was causing errors when buyers updated their profile: "record 'old' has no field 'agent_id'"

  2. Security
    - Function remains SECURITY DEFINER to allow activity creation
*/

-- Drop and recreate the trigger function with correct field name
CREATE OR REPLACE FUNCTION notify_agent_assigned() RETURNS TRIGGER AS $$
DECLARE
  v_agent_name text;
BEGIN
  IF OLD.assigned_agent_id IS NULL AND NEW.assigned_agent_id IS NOT NULL THEN
    SELECT full_name INTO v_agent_name FROM agent_profiles WHERE id = NEW.assigned_agent_id;

    PERFORM create_activity(
      NEW.id,
      NEW.assigned_agent_id,
      'agent_assigned',
      'Agent Assigned',
      v_agent_name || ' is now your real estate agent',
      NEW.assigned_agent_id,
      'agent',
      jsonb_build_object('agent_name', v_agent_name)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
