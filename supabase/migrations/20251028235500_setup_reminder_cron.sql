/*
  # Setup Viewing Reminders Cron Job

  1. Extensions
    - Enable pg_cron extension if not already enabled

  2. Cron Jobs
    - Create cron job to process viewing reminders every hour
    - Calls the process-viewing-reminders edge function

  3. Notes
    - Cron runs every hour to check for due reminders
    - The edge function handles all the processing logic
*/

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Remove existing cron job if it exists
SELECT cron.unschedule('process-viewing-reminders') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-viewing-reminders'
);

-- Create cron job to process viewing reminders every hour
SELECT cron.schedule(
  'process-viewing-reminders',
  '0 * * * *', -- Run every hour at minute 0
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/process-viewing-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
