/*
  # Add Delete Policy for Rental Applications

  1. Changes
    - Add DELETE policy for rental_applications table
    - Allow property owners to delete applications for their properties
  
  2. Security
    - Property owners can only delete applications they created (property_owner_id matches)
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'rental_applications' 
    AND policyname = 'Property owners can delete their rental applications'
  ) THEN
    CREATE POLICY "Property owners can delete their rental applications"
      ON rental_applications
      FOR DELETE
      TO authenticated
      USING (auth.uid() = property_owner_id);
  END IF;
END $$;