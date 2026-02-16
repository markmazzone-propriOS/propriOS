/*
  # Fix Price Change Notification Trigger - HTTP Call

  1. Changes
    - Update trigger to properly call edge function without service role key
    - Match pattern from working welcome email trigger
    - Use proper error handling

  2. Security
    - Maintains same security model
*/

-- Drop and recreate function with corrected HTTP call pattern
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
  request_id bigint;
  edge_function_url text := 'https://rfdaepolwygosvwunhnk.supabase.co/functions/v1/send-price-change-notification';
BEGIN
  -- Only proceed if price has changed and property is still active
  IF OLD.price IS DISTINCT FROM NEW.price AND NEW.status = 'active' THEN

    -- Get property details with correct column names
    SELECT
      address_line1,
      city,
      state
    INTO property_record
    FROM properties
    WHERE id = NEW.id;

    -- Loop through all users who have favorited this property
    FOR favorite_record IN
      SELECT DISTINCT user_id
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
      WHERE u.id = favorite_record.user_id;

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
        favorite_record.user_id,
        OLD.price,
        NEW.price
      );

      -- Call edge function to send email
      BEGIN
        SELECT net.http_post(
          url := edge_function_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json'
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
          ),
          timeout_milliseconds := 5000
        ) INTO request_id;

        -- Log success
        RAISE LOG 'Price change notification sent for property % to buyer % (request_id: %)', 
          NEW.id, buyer_record.email, request_id;

      EXCEPTION
        WHEN OTHERS THEN
          -- Log error but don't fail the transaction
          RAISE WARNING 'Failed to send price change notification to %: %', 
            buyer_record.email, SQLERRM;
      END;

    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the property update
    RAISE WARNING 'Price change notification process failed: %', SQLERRM;
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
