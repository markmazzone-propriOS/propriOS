import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface BrokerageWelcomeEmailRequest {
  email: string;
  company_name: string;
  super_admin_name: string;
  license_number?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { email, company_name, super_admin_name, license_number }: BrokerageWelcomeEmailRequest = await req.json();

    if (!email || !company_name || !super_admin_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Proprieta - Brokerage</title>
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
              <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 18px;">Brokerage Management Platform</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; font-size: 24px; margin: 0 0 20px 0;">Hello ${super_admin_name}!</h2>

              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                We're thrilled to welcome <strong>${company_name}</strong> to Proprieta! Your brokerage account has been successfully created, and you're ready to start managing your real estate brokerage with our comprehensive platform.
              </p>

              ${license_number ? `<div style="background-color: #f3f4f6; border-left: 4px solid #2563eb; padding: 20px; margin: 30px 0;">
                <p style="color: #1f2937; font-size: 14px; margin: 0; font-weight: bold;">Brokerage License Number</p>
                <p style="color: #4b5563; font-size: 16px; margin: 8px 0 0 0;">${license_number}</p>
              </div>` : ''}

              <h3 style="color: #1f2937; font-size: 20px; margin: 30px 0 15px 0;">What You Can Do</h3>

              <ul style="color: #4b5563; font-size: 16px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 10px;">Invite agents to join your brokerage and manage their memberships</li>
                <li style="margin-bottom: 10px;">View and manage all agents affiliated with your brokerage</li>
                <li style="margin-bottom: 10px;">Access a shared calendar to see all agent activities and appointments</li>
                <li style="margin-bottom: 10px;">Monitor agent performance and track brokerage-wide metrics</li>
                <li style="margin-bottom: 10px;">Customize your brokerage profile with logo and business information</li>
                <li style="margin-bottom: 10px;">Oversee property listings and transactions across your brokerage</li>
              </ul>

              <div style="text-align: center; margin: 40px 0 30px 0;">
                <a href="${Deno.env.get('SITE_URL') || 'https://proprieta.com'}/brokerage/dashboard" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">Go to Brokerage Dashboard</a>
              </div>

              <h3 style="color: #1f2937; font-size: 20px; margin: 30px 0 15px 0;">Getting Started</h3>

              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                To get the most out of Proprieta, we recommend:
              </p>

              <ol style="color: #4b5563; font-size: 16px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 10px;">Complete your brokerage profile with all business details</li>
                <li style="margin-bottom: 10px;">Upload your brokerage logo to personalize your presence</li>
                <li style="margin-bottom: 10px;">Start inviting your agents to join the platform</li>
                <li style="margin-bottom: 10px;">Explore the shared calendar and agent management features</li>
              </ol>

              <h3 style="color: #1f2937; font-size: 20px; margin: 30px 0 15px 0;">Need Help?</h3>

              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Our dedicated support team is here to help your brokerage succeed. If you have any questions or need assistance setting up your account, don't hesitate to reach out through our support system.
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

    console.log(`Sending brokerage welcome email to: ${email}`);
    console.log(`Company name: ${company_name}`);
    console.log(`Super admin name: ${super_admin_name}`);
    if (license_number) console.log(`License: ${license_number}`);

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
        subject: `Welcome to Proprieta, ${company_name}!`,
        html: emailContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      throw new Error(data.message || 'Failed to send email via Resend');
    }

    console.log('Brokerage welcome email sent successfully via Resend:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Brokerage welcome email sent successfully",
        emailId: data.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending brokerage welcome email:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send brokerage welcome email", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});