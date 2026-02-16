/*
  # Fix Teams Infinite Recursion with Security Definer Function
  
  1. Problem
    - Circular dependency between teams and team_members RLS policies
    - teams SELECT policy checks team_members
    - team_members SELECT policy checks teams
    - This causes infinite recursion
    
  2. Solution
    - Create a SECURITY DEFINER function to check team membership
    - This bypasses RLS and breaks the circular dependency
    - Update teams SELECT policy to use the function
    
  3. Changes
    - Create helper function to check if user is team member
    - Update teams SELECT policies to use the function
*/

-- Create a security definer function to check team membership without triggering RLS
CREATE OR REPLACE FUNCTION is_team_member(p_team_id uuid, p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
    AND agent_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view teams they own" ON teams;
DROP POLICY IF EXISTS "Users can view teams they are members of" ON teams;

-- Recreate the SELECT policy using the security definer function
CREATE POLICY "Agents can view their teams"
  ON teams
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id
    OR is_team_member(id, auth.uid())
  );
