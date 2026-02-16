import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SignupNotificationRequest {
  email: string;
  full_name: string;
  user_type: string;
  signup_date: string;
}

function getUserTypeLabel(userType: string): string {
  const labels: Record<string, string> = {
    'agent': 'Real Estate Agent',
    'buyer': 'Home Buyer',
    'seller': 'Home Seller',
    'renter': 'Renter',
    'property_owner': 'Property Owner',
    'service_provider': 'Service Provider',
    'mortgage_lender': 'Mortgage Lender',
    'admin': 'Administrator',
    'managed_user': 'Managed Account'
  };
  return labels[userType] || 'User';
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { email, full_name, user_type, signup_date }: SignupNotificationRequest = await req.json();

    if (!email || !full_name || !user_type || !signup_date) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userTypeLabel = getUserTypeLabel(user_type);
    const formattedDate = new Date(signup_date).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New User Signup - Proprieta</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">🎉 New User Signup</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; font-size: 22px; margin: 0 0 20px 0;">A new user has joined Proprieta!</h2>

              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 30px; margin: 30px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 14px; font-weight: bold; display: block; margin-bottom: 4px;">User Type</span>
                      <span style="color: #1f2937; font-size: 16px; font-weight: bold;">${userTypeLabel}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 14px; font-weight: bold; display: block; margin-bottom: 4px;">Full Name</span>
                      <span style="color: #1f2937; font-size: 16px;">${full_name}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 14px; font-weight: bold; display: block; margin-bottom: 4px;">Email Address</span>
                      <span style="color: #1f2937; font-size: 16px;">${email}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0;">
                      <span style="color: #6b7280; font-size: 14px; font-weight: bold; display: block; margin-bottom: 4px;">Signup Date & Time</span>
                      <span style="color: #1f2937; font-size: 16px;">${formattedDate}</span>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="background-color: #dbeafe; border-left: 4px solid #2563eb; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="color: #1e40af; font-size: 14px; margin: 0; font-weight: bold;">📊 Quick Action</p>
                <p style="color: #1e3a8a; font-size: 14px; margin: 8px 0 0 0;">Log in to your admin dashboard to view more details about this user and monitor their activity.</p>
              </div>

              <div style="text-align: center; margin: 40px 0 30px 0;">
                <a href="${Deno.env.get('SITE_URL') || 'https://proprieta.com'}/admin" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">View Admin Dashboard</a>
              </div>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0; text-align: center;">
                This is an automated notification from the Proprieta platform.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
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

    console.log(`Sending admin signup notification for new ${user_type}: ${full_name} (${email})`);

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    // Admin email - hardcoded but could be pulled from database
    const ADMIN_EMAIL = 'mark.mazzone@proprieta.co';

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Proprieta Notifications <notifications@proprieta.co>',
        to: [ADMIN_EMAIL],
        subject: `New ${userTypeLabel} Signup: ${full_name}`,
        html: emailContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      throw new Error(data.message || 'Failed to send email via Resend');
    }

    console.log('Admin signup notification sent successfully via Resend:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Admin notification sent successfully",
        emailId: data.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending admin signup notification:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send admin notification", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
