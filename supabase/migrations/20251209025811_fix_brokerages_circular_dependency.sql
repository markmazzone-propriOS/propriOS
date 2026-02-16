/*
  # Fix Brokerages Circular Dependency

  1. Changes
    - Create helper functions with SECURITY DEFINER to break circular dependencies
    - Update RLS policies on brokerages and brokerage_agents to use these functions
  
  2. Security
    - Functions run with elevated privileges but only return boolean results
    - Maintains same security guarantees without causing recursion
*/

-- Create helper function to check if user is a brokerage agent
CREATE OR REPLACE FUNCTION is_brokerage_agent(user_id uuid, brokerage_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM brokerage_agents
    WHERE brokerage_agents.brokerage_id = $2
    AND brokerage_agents.agent_id = $1
    AND brokerage_agents.status = 'active'
  );
END;
$$;

-- Create helper function to check if user is brokerage super admin
CREATE OR REPLACE FUNCTION is_brokerage_super_admin(user_id uuid, brokerage_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM brokerages
    WHERE brokerages.id = $2
    AND brokerages.super_admin_id = $1
  );
END;
$$;

-- Drop existing policies that cause circular dependency
DROP POLICY IF EXISTS "Agents can view their brokerage" ON brokerages;
DROP POLICY IF EXISTS "Super admins can view their brokerage agents" ON brokerage_agents;

-- Recreate brokerages SELECT policy using security definer function
CREATE POLICY "Agents can view their brokerage"
  ON brokerages FOR SELECT
  TO authenticated
  USING (is_brokerage_agent(auth.uid(), id));

-- Recreate brokerage_agents SELECT policy using security definer function
CREATE POLICY "Super admins can view their brokerage agents"
  ON brokerage_agents FOR SELECT
  TO authenticated
  USING (is_brokerage_super_admin(auth.uid(), brokerage_id));
