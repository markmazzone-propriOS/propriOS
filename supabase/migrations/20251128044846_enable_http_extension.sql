/*
  # Enable HTTP Extension for Edge Function Calls

  ## Overview
  Enable the `http` extension which is required for making HTTP requests from database triggers
  to edge functions. Without this extension, all `net.http_post()` calls fail silently.

  ## Changes
  - Enable the `http` extension
  - This allows database triggers to call edge functions via HTTP

  ## Impact
  - Agent notification emails will now be sent when properties are created
  - All other email triggers that use net.http_post() will start working
*/

CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;