/*
  # Fix Price Change Notification Trigger - Address Column

  1. Changes
    - Update trigger to use correct column name: address_line1 instead of address
    - Properties table uses address_line1, not address

  2. Security
    - Maintains same security model
*/

-- Drop and recreate function with correct column name
DROP FUNCTION IF EXISTS notify_price_change() CASCADE;

CREATE OR REPLACE FUNCTION notify_price_change()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  favorite_record RECORD;
  buyer_record RECORD;
  property_record RECORD;
  supabase_url text := 'https://rfdaepolwygosvwunhnk.supabase.co';
  service_role_key text;
BEGIN
  -- Only proceed if price has changed and property is still active
  IF OLD.price IS DISTINCT FROM NEW.price AND NEW.status = 'active' THEN

    -- Get the service role key from vault
    SELECT decrypted_secret INTO service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;

    -- If no service role key in vault, skip notification
    IF service_role_key IS NULL THEN
      RAISE WARNING 'Service role key not found in vault, skipping price change notifications';
      RETURN NEW;
    END IF;

    -- Get property details with correct column names
    SELECT
      address_line1,
      city,
      state
    INTO property_record
    FROM properties
    WHERE id = NEW.id;

    -- Loop through all buyers who have favorited this property
    FOR favorite_record IN
      SELECT DISTINCT buyer_id
      FROM favorites
      WHERE property_id = NEW.id
    LOOP
      -- Get buyer details
      SELECT
        u.email,
        p.full_name
      INTO buyer_record
      FROM auth.users u
      LEFT JOIN profiles p ON p.id = u.id
      WHERE u.id = favorite_record.buyer_id;

      -- Skip if buyer email not found
      IF buyer_record.email IS NULL THEN
        CONTINUE;
      END IF;

      -- Insert notification record
      INSERT INTO price_change_notifications (
        property_id,
        buyer_id,
        old_price,
        new_price
      ) VALUES (
        NEW.id,
        favorite_record.buyer_id,
        OLD.price,
        NEW.price
      );

      -- Call edge function to send email
      PERFORM net.http_post(
        url := supabase_url || '/functions/v1/send-price-change-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body := jsonb_build_object(
          'buyer_email', buyer_record.email,
          'buyer_name', COALESCE(buyer_record.full_name, 'Valued Buyer'),
          'property_address', property_record.address_line1,
          'property_city', property_record.city,
          'property_state', property_record.state,
          'old_price', OLD.price,
          'new_price', NEW.price,
          'property_id', NEW.id::text
        )
      );

    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_notify_price_change ON properties;

CREATE TRIGGER trigger_notify_price_change
  AFTER UPDATE OF price ON properties
  FOR EACH ROW
  WHEN (OLD.price IS DISTINCT FROM NEW.price)
  EXECUTE FUNCTION notify_price_change();
