/*
  # Allow Public Viewing of Brokerage Profiles
  
  1. Changes
    - Add SELECT policy for brokerages table to allow public viewing
    - Add SELECT policy for brokerage_agents table to allow public viewing
    - This enables public-facing brokerage profile pages
  
  2. Security
    - Only SELECT access is granted to public
    - Data remains protected from modifications
*/

-- Allow anyone to view brokerage information
CREATE POLICY "Anyone can view brokerages"
  ON brokerages FOR SELECT
  TO public
  USING (true);

-- Allow anyone to view brokerage agents for public profile display
CREATE POLICY "Anyone can view brokerage agents"
  ON brokerage_agents FOR SELECT
  TO public
  USING (true);
