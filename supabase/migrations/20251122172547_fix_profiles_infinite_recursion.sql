/*
  # Fix Profiles Table Infinite Recursion

  1. Problem
    - The "Service providers can view agent profiles" policy causes infinite recursion
    - It queries the profiles table from within a profiles table policy
    
  2. Solution
    - Drop the problematic policy
    - Service providers can already view profiles through the existing "Anyone can view profiles" policy
    
  3. Security
    - Maintains appropriate access control
    - Removes circular dependency
*/

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Service providers can view agent profiles" ON profiles;
