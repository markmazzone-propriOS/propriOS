/*
  # Create Application Settings Table

  1. New Tables
    - `app_settings`
      - `key` (text, primary key) - Setting name
      - `value` (text) - Setting value
      - `description` (text) - Description of what this setting does
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `app_settings` table
    - Allow authenticated users to read settings
    - Only allow service role to update settings (managed through migrations)

  3. Initial Data
    - Insert default SITE_URL setting
*/

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app settings"
  ON app_settings
  FOR SELECT
  USING (true);

-- Insert default site URL (will be used by edge functions for email links)
INSERT INTO app_settings (key, value, description)
VALUES (
  'SITE_URL',
  'http://localhost:5173',
  'Base URL for the application, used in email links and redirects'
)
ON CONFLICT (key) DO NOTHING;
