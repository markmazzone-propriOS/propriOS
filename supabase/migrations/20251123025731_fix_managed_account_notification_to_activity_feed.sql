/*
  # Fix managed account notification to use activity_feed table

  1. Changes
    - Drop previous trigger and function
    - Recreate function to use activity_feed table instead of activities table
    - Add trigger back on agent_managed_accounts
  
  2. Security
    - Function runs with SECURITY DEFINER to access all necessary tables
    - Only creates notifications for the agent who owns the managed account
*/

-- Drop old trigger and function
DROP TRIGGER IF EXISTS on_managed_account_created ON agent_managed_accounts;
DROP FUNCTION IF EXISTS notify_agent_managed_account_created();

-- Function to create activity feed notification when managed account is created
CREATE OR REPLACE FUNCTION notify_agent_managed_account_created()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert activity notification for the agent
  INSERT INTO activity_feed (
    user_id,
    actor_id,
    activity_type,
    title,
    description,
    reference_id,
    reference_type,
    read
  )
  VALUES (
    NEW.agent_id,
    NEW.agent_id,
    'managed_account_created',
    'Managed Account Created',
    'New managed account "' || NEW.account_name || '" has been created',
    NEW.id,
    'managed_account',
    false
  );

  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER on_managed_account_created
  AFTER INSERT ON agent_managed_accounts
  FOR EACH ROW
  EXECUTE FUNCTION notify_agent_managed_account_created();
