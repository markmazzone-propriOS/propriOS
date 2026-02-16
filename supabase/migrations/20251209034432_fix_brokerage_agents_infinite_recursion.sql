/*
  # Fix brokerage_agents Infinite Recursion
  
  1. Problem
    - Policy "Agents can view other agents in same brokerage" queries brokerage_agents from within brokerage_agents policy
    - This creates infinite recursion when trying to view brokerage agents
    
  2. Solution
    - Drop the recursive policy "Agents can view other agents in same brokerage"
    - The existing "Anyone can view brokerage agents" policy already covers viewing needs
    - This is sufficient since brokerage agent information is public data
    
  3. Security
    - Maintains public read access to brokerage agents
    - All other operations (insert, update, delete) still require proper authorization
*/

-- Drop the recursive policy
DROP POLICY IF EXISTS "Agents can view other agents in same brokerage" ON brokerage_agents;

-- Also drop the super admin view policy as it may cause issues and is redundant
DROP POLICY IF EXISTS "Super admins can view their brokerage agents" ON brokerage_agents;

-- The remaining policies are:
-- 1. "Anyone can view brokerage agents" (public SELECT with true)
-- 2. "Agents can view own brokerage membership" (authenticated SELECT where agent_id = auth.uid())
-- 3. Insert/Update/Delete policies for super admins (using EXISTS queries on brokerages table)
