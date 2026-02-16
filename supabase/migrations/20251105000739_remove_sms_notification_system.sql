/*
  # Remove SMS Notification System

  1. Changes
    - Drop sms_notification_preferences table
    - Drop sms_logs table
    - Drop phone_verification_codes table
    - Remove SMS-related functions

  2. Security
    - Clean up all SMS-related database objects
*/

-- Drop trigger
DROP TRIGGER IF EXISTS sms_preferences_updated_at ON sms_notification_preferences;

-- Drop functions
DROP FUNCTION IF EXISTS get_user_sms_phone CASCADE;
DROP FUNCTION IF EXISTS should_send_sms CASCADE;
DROP FUNCTION IF EXISTS trigger_sms_notification CASCADE;
DROP FUNCTION IF EXISTS update_sms_preferences_updated_at CASCADE;

-- Drop tables
DROP TABLE IF EXISTS sms_logs CASCADE;
DROP TABLE IF EXISTS phone_verification_codes CASCADE;
DROP TABLE IF EXISTS sms_notification_preferences CASCADE;