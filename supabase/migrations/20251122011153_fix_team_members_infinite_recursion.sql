/*
  # Fix Team Members Infinite Recursion

  1. Problem
    - The RLS policy "Team members can view team members" has infinite recursion
    - It queries team_members table within the policy, causing a circular reference
    
  2. Solution
    - Simplify the SELECT policy to avoid self-referencing
    - Use a more direct approach that checks team ownership or direct membership
    
  3. Changes
    - Drop and recreate the problematic SELECT policy for team_members
    - Ensure agents can view team members without infinite recursion
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Team members can view team members" ON team_members;

-- Create a simplified policy that avoids recursion
-- Users can see team members if they own the team OR if they are querying their own membership
CREATE POLICY "Team members can view team members"
  ON team_members
  FOR SELECT
  TO authenticated
  USING (
    -- User can see their own team membership
    agent_id = auth.uid()
    OR
    -- User owns the team
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_members.team_id
      AND teams.owner_id = auth.uid()
    )
  );
