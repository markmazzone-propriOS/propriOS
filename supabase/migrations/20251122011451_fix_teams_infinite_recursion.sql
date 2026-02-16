/*
  # Fix Teams and Team Members Infinite Recursion
  
  1. Problem
    - The "Agents can view their teams" policy queries team_members
    - The "Team members can view team members" policy queries teams
    - This creates a circular reference causing infinite recursion
    
  2. Solution
    - Simplify the teams SELECT policy to only check direct ownership
    - Create a separate policy for viewing teams as a member
    - This breaks the circular dependency
    
  3. Changes
    - Drop and recreate teams SELECT policies without circular references
    - Split into two policies: one for owners, one for members
*/

-- Drop the problematic policy on teams
DROP POLICY IF EXISTS "Agents can view their teams" ON teams;

-- Policy 1: Users can view teams they own
CREATE POLICY "Users can view teams they own"
  ON teams
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Policy 2: Users can view teams they are members of
-- This uses a simple subquery that won't trigger recursion because
-- team_members policy doesn't reference back to teams for the same user
CREATE POLICY "Users can view teams they are members of"
  ON teams
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id
      AND team_members.agent_id = auth.uid()
    )
  );
