import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface BrokerageInvitationEmailRequest {
  invitation_id: string;
  invitee_email: string;
  invitee_name?: string;
  inviter_name: string;
  company_name: string;
  site_url?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { invitation_id, invitee_email, invitee_name, inviter_name, company_name, site_url }: BrokerageInvitationEmailRequest = await req.json();

    if (!invitation_id || !invitee_email || !inviter_name || !company_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const recipientName = invitee_name || invitee_email.split('@')[0];

    const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Join ${company_name} on Proprieta</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">You're Invited!</h1>
              <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 18px;">Join ${company_name} on Proprieta</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; font-size: 24px; margin: 0 0 20px 0;">Hello ${recipientName}!</h2>

              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                <strong>${inviter_name}</strong> from <strong>${company_name}</strong> has invited you to join their brokerage on Proprieta, the comprehensive real estate management platform.
              </p>

              <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; margin: 30px 0;">
                <p style="color: #1e40af; font-size: 16px; margin: 0; font-weight: bold;">Brokerage</p>
                <p style="color: #1e40af; font-size: 18px; margin: 8px 0 0 0;">${company_name}</p>
              </div>

              <h3 style="color: #1f2937; font-size: 20px; margin: 30px 0 15px 0;">What You'll Get</h3>

              <ul style="color: #4b5563; font-size: 16px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 10px;">Access to Proprieta's full suite of agent tools and features</li>
                <li style="margin-bottom: 10px;">Collaboration with other agents in your brokerage</li>
                <li style="margin-bottom: 10px;">Shared calendar and team visibility for better coordination</li>
                <li style="margin-bottom: 10px;">Streamlined client management and transaction tracking</li>
                <li style="margin-bottom: 10px;">Professional association with ${company_name}</li>
                <li style="margin-bottom: 10px;">Support from both your brokerage and the Proprieta team</li>
              </ul>

              <div style="background-color: #eff6ff; border: 2px solid #2563eb; border-radius: 8px; padding: 25px; margin: 30px 0;">
                <h3 style="color: #1e40af; font-size: 18px; margin: 0 0 15px 0; text-align: center;">Getting Started</h3>
                <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; text-align: center;">
                  To accept this invitation and join ${company_name}:
                </p>

                <div style="background-color: #ffffff; border-radius: 6px; padding: 20px; margin-bottom: 15px;">
                  <p style="color: #1f2937; font-size: 16px; margin: 0 0 15px 0; font-weight: bold;">
                    If you don't have a Proprieta account:
                  </p>
                  <p style="color: #4b5563; font-size: 15px; margin: 0 0 15px 0; line-height: 1.6;">
                    1. Go to proprieta.co and sign up using this email address (${invitee_email})<br>
                    2. Once registered, go to your dashboard to view and accept the invitation
                  </p>
                </div>

                <div style="background-color: #ffffff; border-radius: 6px; padding: 20px;">
                  <p style="color: #1f2937; font-size: 16px; margin: 0 0 15px 0; font-weight: bold;">
                    If you already have a Proprieta account:
                  </p>
                  <p style="color: #4b5563; font-size: 15px; margin: 0; line-height: 1.6;">
                    1. Go to proprieta.co and sign in<br>
                    2. Go to your dashboard to view and accept the invitation
                  </p>
                </div>
              </div>

              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 30px 0 0 0;">
                We're excited to have you join the Proprieta platform!<br><br>
                Best regards,<br>
                <strong>The Proprieta Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                This invitation was sent to ${invitee_email}
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

    console.log(`Sending brokerage invitation email to: ${invitee_email}`);
    console.log(`Company: ${company_name}`);
    console.log(`Inviter: ${inviter_name}`);

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
        to: [invitee_email],
        subject: `You're invited to join ${company_name} on Proprieta`,
        html: emailContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      throw new Error(data.message || 'Failed to send email via Resend');
    }

    console.log('Brokerage invitation email sent successfully via Resend:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Brokerage invitation email sent successfully",
        emailId: data.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending brokerage invitation email:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send brokerage invitation email", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});