/*
  # Fix Team Members Recursion with Helper Function

  1. Changes
    - Create a helper function that queries team_members without triggering RLS
    - Use this function in the policy to avoid circular dependency

  2. Security
    - Users can only view members of teams they belong to
    - Helper function uses SECURITY DEFINER to bypass RLS
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Team members can view all members in their teams" ON team_members;

-- Create helper function that checks membership without triggering RLS
CREATE OR REPLACE FUNCTION user_is_in_same_team(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM team_members
    WHERE team_id = p_team_id
    AND agent_id = auth.uid()
  );
$$;

-- Create policy using the helper function
CREATE POLICY "Team members can view all members in their teams"
  ON team_members
  FOR SELECT
  TO authenticated
  USING (user_is_in_same_team(team_id));
