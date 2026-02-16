/*
  # Remove Duplicate Welcome Email Triggers
  
  1. Changes
    - Drop the old agent-specific welcome email trigger and function
    - Drop the old service provider-specific welcome email trigger and function
    - Keep only the universal welcome email trigger on profiles table
    
  2. Reason
    - The universal trigger on profiles table handles all user types
    - Old triggers may be conflicting or duplicating emails
    - Simplifies the email sending logic to one trigger point
*/

-- Drop old agent welcome email trigger and function
DROP TRIGGER IF EXISTS trigger_send_agent_welcome_email ON agent_profiles;
DROP FUNCTION IF EXISTS send_agent_welcome_email();

-- Drop old service provider welcome email trigger and function
DROP TRIGGER IF EXISTS trigger_send_service_provider_welcome_email ON service_provider_profiles;
DROP FUNCTION IF EXISTS send_service_provider_welcome_email();
