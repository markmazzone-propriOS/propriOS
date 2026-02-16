// Public configuration that's safe to commit to version control
// These keys are designed to be exposed in client-side code

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rfdaepolwygosvwunhnk.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZGFlcG9sd3lnb3N2d3VuaG5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMjEwODYsImV4cCI6MjA3NTY5NzA4Nn0.zqEX5HrXyE8uS2ymApqe6MHWIgFsS4rjml_R-U7tFvw';

console.log('[CONFIG] Loaded configuration:', {
  supabaseUrl: supabaseUrl.substring(0, 30) + '...',
  anonKeyLength: supabaseAnonKey.length,
  hasStripeKey: !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
});

export const config = {
  supabase: {
    url: supabaseUrl,
    anonKey: supabaseAnonKey
  },
  stripe: {
    publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_51STYQ3RZodcdIoVzchqP3mCryf4IH6uh7tVnPiz5rKso6mwoqn4RupV69gVGqsw9ACOXerHV5fDlZeNbJJ9hz0bc00X8Z8QG2r'
  },
  siteUrl: import.meta.env.SITE_URL || 'https://proprieta-proprios-4za9.bolt.host'
};

// Helper function to get edge function URL
export const getEdgeFunctionUrl = (functionName: string) => {
  return `${supabaseUrl}/functions/v1/${functionName}`;
};
