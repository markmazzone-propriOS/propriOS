/*
  # Add notification for managed account creation

  1. Changes
    - Create trigger function to notify agent when a managed account is created
    - Add trigger on agent_managed_accounts table for INSERT
  
  2. Security
    - Function runs with SECURITY DEFINER to access all necessary tables
    - Only creates notifications for the agent who owns the managed account
*/

-- Function to create activity notification when managed account is created
CREATE OR REPLACE FUNCTION notify_agent_managed_account_created()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert activity notification for the agent
  INSERT INTO activities (
    user_id,
    activity_type,
    description,
    related_user_id
  )
  VALUES (
    NEW.agent_id,
    'managed_account_created',
    'New managed account "' || NEW.account_name || '" has been created',
    NEW.managed_user_id
  );

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS on_managed_account_created ON agent_managed_accounts;
CREATE TRIGGER on_managed_account_created
  AFTER INSERT ON agent_managed_accounts
  FOR EACH ROW
  EXECUTE FUNCTION notify_agent_managed_account_created();
