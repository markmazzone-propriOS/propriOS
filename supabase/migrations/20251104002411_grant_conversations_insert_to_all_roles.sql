/*
  # Grant Conversations Insert to All Roles

  1. Problem
    - Policies are being created but not assigned to roles
    - Need to explicitly grant permissions

  2. Solution
    - Drop existing policies
    - Grant table permissions to authenticated and anon roles
    - Create policies for both authenticated and anon roles explicitly

  3. Security
    - Allow inserts from any authenticated or anonymous user
    - Keep other operations restricted to participants
*/

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "allow_all_insert" ON conversations;

-- Grant INSERT permission to authenticated role
GRANT INSERT ON conversations TO authenticated;

-- Grant INSERT permission to anon role
GRANT INSERT ON conversations TO anon;

-- Create INSERT policy for authenticated users
CREATE POLICY "authenticated_can_insert"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create INSERT policy for anonymous users
CREATE POLICY "anon_can_insert"
  ON conversations FOR INSERT
  TO anon
  WITH CHECK (true);
