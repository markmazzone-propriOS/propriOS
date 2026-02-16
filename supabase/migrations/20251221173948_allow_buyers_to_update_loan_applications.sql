/*
  # Allow Buyers to Update Their Loan Applications

  1. Changes
    - Add policy to allow buyers to update their loan applications
    - This enables buyers to upload required documents and update application fields

  2. Security
    - Buyers can only update their own loan applications (buyer_id = auth.uid())
    - Maintains security by ensuring buyers cannot modify other users' applications
*/

CREATE POLICY "Buyers can update their loan applications"
  ON loan_applications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = buyer_id)
  WITH CHECK (auth.uid() = buyer_id);
