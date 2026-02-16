/*
  # Add Insert Policy for Rental Applications

  1. Changes
    - Add INSERT policy for rental_applications table
    - Allow property owners to create rental applications
  
  2. Security
    - Property owners can only create applications for their own properties
    - Ensures property_owner_id matches authenticated user
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'rental_applications' 
    AND policyname = 'Property owners can create rental applications'
  ) THEN
    CREATE POLICY "Property owners can create rental applications"
      ON rental_applications
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = property_owner_id);
  END IF;
END $$;