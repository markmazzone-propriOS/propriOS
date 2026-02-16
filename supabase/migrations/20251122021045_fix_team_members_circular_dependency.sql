/*
  # Fix Team Members Circular RLS Dependency

  1. Changes
    - Replace the circular policy with a simpler one that doesn't cause recursion
    - Allow team members to view all members in teams they belong to

  2. Security
    - Users can only view members of teams they are part of
    - No circular dependency issues
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Team members can view all members in their teams" ON team_members;

-- Create a simpler policy that works with the is_team_member function
CREATE POLICY "Team members can view all members in their teams"
  ON team_members
  FOR SELECT
  TO authenticated
  USING (
    -- Can view members of any team you belong to
    is_team_member(team_id, auth.uid())
  );
