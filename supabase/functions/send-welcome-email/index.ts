import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WelcomeEmailRequest {
  email: string;
  full_name: string;
  license_number?: string;
  business_name?: string;
  user_type?: string;
}

function getUserTypeDisplay(userType: string): { roleTitle: string; greeting: string; features: string[] } {
  switch (userType) {
    case 'agent':
      return {
        roleTitle: 'Real Estate Agent',
        greeting: "We're thrilled to have you join Proprieta as a real estate agent! Your account has been successfully created and you're ready to start building your real estate business with us.",
        features: [
          'Complete your agent profile with your specialties and service areas',
          'Create property listings to showcase to potential buyers',
          'Upload important documents like licenses and certifications',
          'Connect with buyers and sellers through our messaging system',
          'Manage your calendar and schedule property viewings',
          'Track prospects and manage your client relationships'
        ]
      };
    case 'service_provider':
      return {
        roleTitle: 'Service Provider',
        greeting: "We're thrilled to have you join Proprieta as a service provider! Your account has been successfully created and you're ready to start growing your business and connecting with clients.",
        features: [
          'Complete your business profile with services offered and service areas',
          'Upload photos of your work to showcase your expertise',
          'Set your availability and manage your calendar',
          'Connect with clients through our messaging system',
          'Track jobs and manage invoices all in one place',
          'Build your reputation through client reviews'
        ]
      };
    case 'buyer':
      return {
        roleTitle: 'Home Buyer',
        greeting: "Welcome to Proprieta! Your account has been successfully created and you're ready to start your home buying journey with us.",
        features: [
          'Search and filter properties based on your preferences',
          'Save your favorite properties and get price change alerts',
          'Schedule property viewings with agents',
          'Submit and track offers on properties',
          'Connect with real estate agents for guidance',
          'Access your journey tracker to monitor your progress'
        ]
      };
    case 'seller':
      return {
        roleTitle: 'Home Seller',
        greeting: "Welcome to Proprieta! Your account has been successfully created and you're ready to start selling your property with us.",
        features: [
          'Create detailed property listings with photos',
          'Track property views, favorites, and interest analytics',
          'Receive and manage offers from potential buyers',
          'Schedule and manage property viewings',
          'Connect with real estate agents for assistance',
          'Monitor your selling journey progress'
        ]
      };
    case 'renter':
      return {
        roleTitle: 'Renter',
        greeting: "Welcome to Proprieta! Your account has been successfully created and you're ready to find your next rental home.",
        features: [
          'Search rental properties in your preferred locations',
          'Save favorite rental listings',
          'Submit rental applications online',
          'Schedule property viewings',
          'Connect with property owners and agents',
          'Track your rental journey progress'
        ]
      };
    case 'property_owner':
      return {
        roleTitle: 'Property Owner',
        greeting: "Welcome to Proprieta! Your account has been successfully created and you're ready to manage your rental properties with us.",
        features: [
          'List your rental properties with detailed information',
          'Review and manage rental applications',
          'Schedule property viewings and manage appointments',
          'Track leads and communicate with prospective tenants',
          'View comprehensive analytics and financial reports',
          'Manage lease agreements and signatures digitally'
        ]
      };
    case 'mortgage_lender':
      return {
        roleTitle: 'Mortgage Lender',
        greeting: "Welcome to Proprieta! Your account has been successfully created and you're ready to connect with borrowers and grow your lending business.",
        features: [
          'Complete your lender profile with loan products offered',
          'Manage mortgage applications and documents',
          'Track leads and schedule consultations',
          'Generate pre-approval letters for clients',
          'Use built-in mortgage calculator tools',
          'Monitor your lending analytics and performance'
        ]
      };
    case 'admin':
      return {
        roleTitle: 'Administrator',
        greeting: "Welcome to Proprieta! Your administrator account has been successfully created.",
        features: [
          'Manage user accounts across all user types',
          'Review and moderate property listings',
          'Handle support tickets and user inquiries',
          'Access system-wide analytics and reports',
          'Configure platform settings and policies',
          'Monitor platform activity and performance'
        ]
      };
    case 'managed_user':
      return {
        roleTitle: 'Managed Account',
        greeting: "Welcome to Proprieta! Your real estate agent has created this account for you. You can now log in to view the property listings your agent is managing on your behalf.",
        features: [
          'View all property listings your agent is managing for you',
          'See detailed information, photos, and pricing for each property',
          'Keep track of properties your agent has assigned to you',
          'Receive updates when your agent adds new properties',
          'Log in anytime to review your property portfolio',
          'Contact your agent directly if you have questions'
        ]
      };
    default:
      return {
        roleTitle: 'User',
        greeting: "Welcome to Proprieta! Your account has been successfully created.",
        features: [
          'Browse property listings',
          'Connect with real estate professionals',
          'Access helpful tools and resources',
          'Manage your profile and preferences',
          'Get support when you need it'
        ]
      };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { email, full_name, license_number, business_name, user_type }: WelcomeEmailRequest = await req.json();

    if (!email || !full_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userTypeDisplay = getUserTypeDisplay(user_type || 'buyer');
    const displayName = business_name || full_name;

    const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Proprieta</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">Welcome to Proprieta</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; font-size: 24px; margin: 0 0 20px 0;">Hello ${displayName}!</h2>

              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                ${userTypeDisplay.greeting}
              </p>

              ${license_number ? `<div style="background-color: #f3f4f6; border-left: 4px solid #2563eb; padding: 20px; margin: 30px 0;">
                <p style="color: #1f2937; font-size: 14px; margin: 0; font-weight: bold;">Your License Number</p>
                <p style="color: #4b5563; font-size: 16px; margin: 8px 0 0 0;">${license_number}</p>
              </div>` : ''}

              <h3 style="color: #1f2937; font-size: 20px; margin: 30px 0 15px 0;">Getting Started</h3>

              <ul style="color: #4b5563; font-size: 16px; line-height: 1.8; margin: 0; padding-left: 20px;">
                ${userTypeDisplay.features.map(feature =>
                  `<li style="margin-bottom: 10px;">${feature}</li>`
                ).join('\n')}
              </ul>

              <div style="text-align: center; margin: 40px 0 30px 0;">
                <a href="${Deno.env.get('SITE_URL') || 'https://proprieta.com'}/dashboard" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">Go to Dashboard</a>
              </div>

              <h3 style="color: #1f2937; font-size: 20px; margin: 30px 0 15px 0;">Need Help?</h3>

              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Our support team is here to help you succeed. If you have any questions or need assistance, don't hesitate to reach out through our support system.
              </p>

              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0;">
                Best regards,<br>
                <strong>The Proprieta Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                This email was sent to ${email}
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Proprieta. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    console.log(`Sending welcome email to: ${email}`);
    console.log(`User name: ${full_name}`);
    console.log(`User type: ${user_type || 'buyer'}`);
    console.log(`Role: ${userTypeDisplay.roleTitle}`);
    if (license_number) console.log(`License: ${license_number}`);
    if (business_name) console.log(`Business: ${business_name}`);

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Proprieta <noreply@proprieta.co>',
        to: [email],
        subject: `Welcome to Proprieta, ${full_name}!`,
        html: emailContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      throw new Error(data.message || 'Failed to send email via Resend');
    }

    console.log('Welcome email sent successfully via Resend:', data);

    // Log to email_notification_logs table
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/email_notification_logs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            function_name: 'send-welcome-email',
            recipient_email: email,
            subject: `Welcome to Proprieta, ${full_name}!`,
            status: 'success',
            resend_response: { id: data.id }
          })
        });
      } catch (logError) {
        console.error('Failed to log email notification:', logError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Welcome email sent successfully",
        emailId: data.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending welcome email:", error);

    // Log error to email_notification_logs table
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { email: errorEmail, full_name: errorName } = await req.json();
        await fetch(`${SUPABASE_URL}/rest/v1/email_notification_logs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            function_name: 'send-welcome-email',
            recipient_email: errorEmail || 'unknown',
            subject: `Welcome to Proprieta, ${errorName || 'User'}!`,
            status: 'error',
            error_message: error.message
          })
        });
      } catch (logError) {
        console.error('Failed to log email error:', logError);
      }
    }

    return new Response(
      JSON.stringify({ error: "Failed to send welcome email", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
