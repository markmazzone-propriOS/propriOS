/*
  # Allow Team Members to View All Team Members

  1. Changes
    - Drop the restrictive policy that only allows viewing own record or if you're owner
    - Create new policy that allows all team members to view other members in their teams

  2. Security
    - Users can only view members of teams they belong to
    - Must be an active member of the team to see other members
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Team members can view team members" ON team_members;

-- Create new policy allowing all team members to view each other
CREATE POLICY "Team members can view all members in their teams"
  ON team_members
  FOR SELECT
  TO authenticated
  USING (
    -- Can view if you're a member of the same team
    EXISTS (
      SELECT 1
      FROM team_members my_membership
      WHERE my_membership.team_id = team_members.team_id
      AND my_membership.agent_id = auth.uid()
    )
  );
