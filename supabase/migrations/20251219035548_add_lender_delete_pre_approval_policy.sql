/*
  # Add Delete Policy for Pre-Approval Requests
  
  1. Security
    - Add DELETE policy for pre_approval_requests table
    - Lenders can delete their own pre-approval requests
    - This allows lenders to remove outdated or incorrect requests
*/

-- Allow lenders to delete their own pre-approval requests
CREATE POLICY "Lenders can delete their own pre-approval requests"
  ON pre_approval_requests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mortgage_lender_profiles mlp
      WHERE mlp.id = auth.uid()
      AND mlp.id = pre_approval_requests.lender_id
    )
  );
