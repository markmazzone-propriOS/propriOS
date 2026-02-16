/*
  # Add Property Owner Rental Listings Support

  1. Security Updates
    - Add RLS policy for property owners to view their own rental listings
    - Add RLS policy for property owners to update their own rental listings
    - Add RLS policy for property owners to delete their own rental listings
  
  2. Notes
    - Property owners use the properties table with listing_type = 'rent'
    - The listed_by field identifies the property owner
    - All policies check auth.uid() = listed_by for ownership
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'properties'
    AND policyname = 'Property owners can view own listings'
  ) THEN
    CREATE POLICY "Property owners can view own listings"
      ON properties FOR SELECT
      TO authenticated
      USING (
        auth.uid() = listed_by AND
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.user_type = 'property_owner'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'properties'
    AND policyname = 'Property owners can update own listings'
  ) THEN
    CREATE POLICY "Property owners can update own listings"
      ON properties FOR UPDATE
      TO authenticated
      USING (
        auth.uid() = listed_by AND
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.user_type = 'property_owner'
        )
      )
      WITH CHECK (
        auth.uid() = listed_by AND
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.user_type = 'property_owner'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'properties'
    AND policyname = 'Property owners can delete own listings'
  ) THEN
    CREATE POLICY "Property owners can delete own listings"
      ON properties FOR DELETE
      TO authenticated
      USING (
        auth.uid() = listed_by AND
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.user_type = 'property_owner'
        )
      );
  END IF;
END $$;