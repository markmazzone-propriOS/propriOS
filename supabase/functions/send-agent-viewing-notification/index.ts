import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AgentViewingNotificationRequest {
  agentEmail: string;
  agentName: string;
  buyerName: string;
  buyerEmail: string;
  propertyAddress: string;
  viewingDate: string;
  viewingTime: string;
  eventId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const {
      agentEmail,
      agentName,
      buyerName,
      buyerEmail,
      propertyAddress,
      viewingDate,
      viewingTime,
      eventId
    }: AgentViewingNotificationRequest = await req.json();

    if (!agentEmail || !propertyAddress || !viewingDate || !viewingTime) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const viewingDateTime = new Date(viewingDate + ' ' + viewingTime);
    const formattedDate = viewingDateTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const siteUrl = Deno.env.get('SITE_URL') || 'https://proprieta.com';
    const calendarLink = `${siteUrl}/agent/calendar`;

    const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Viewing Scheduled</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">New Viewing Scheduled</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; font-size: 24px; margin: 0 0 20px 0;">Hello ${agentName}!</h2>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                A prospective buyer has scheduled a property viewing for one of your listings. Here are the details:
              </p>
              <div style="background-color: #eff6ff; border: 2px solid #2563eb; border-radius: 8px; padding: 25px; margin: 30px 0;">
                <h3 style="color: #1e40af; font-size: 18px; margin: 0 0 15px 0; font-weight: bold;">Property Address</h3>
                <p style="color: #1f2937; font-size: 16px; margin: 0 0 20px 0; font-weight: 600;">
                  ${propertyAddress}
                </p>
                <h3 style="color: #1e40af; font-size: 18px; margin: 0 0 15px 0; font-weight: bold;">Date & Time</h3>
                <p style="color: #1f2937; font-size: 16px; margin: 0 0 20px 0;">
                  <strong>${formattedDate}</strong><br>
                  <strong>${viewingTime}</strong>
                </p>
                <h3 style="color: #1e40af; font-size: 18px; margin: 0 0 15px 0; font-weight: bold;">Buyer Information</h3>
                <p style="color: #1f2937; font-size: 16px; margin: 0;">
                  <strong>Name:</strong> ${buyerName}<br>
                  <strong>Email:</strong> ${buyerEmail}
                </p>
              </div>
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 30px 0;">
                <h3 style="color: #92400e; font-size: 16px; margin: 0 0 10px 0; font-weight: bold;">⚠️ Action Required</h3>
                <p style="color: #78350f; font-size: 14px; margin: 0; line-height: 1.6;">
                  Please review this viewing request and confirm or adjust the time if needed. The buyer is expecting your confirmation.
                </p>
              </div>
              <div style="text-align: center; margin: 40px 0 30px 0;">
                <a href="${calendarLink}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">View Calendar</a>
              </div>
              <h3 style="color: #1f2937; font-size: 20px; margin: 30px 0 15px 0;">Next Steps</h3>
              <ul style="color: #4b5563; font-size: 16px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 10px;">Review the viewing details in your calendar</li>
                <li style="margin-bottom: 10px;">Confirm or suggest alternative times if needed</li>
                <li style="margin-bottom: 10px;">Prepare property information and documentation</li>
                <li style="margin-bottom: 10px;">Contact the buyer if you have any questions</li>
                <li style="margin-bottom: 10px;">Ensure the property is ready for viewing</li>
              </ul>
              <div style="background-color: #f3f4f6; border-left: 4px solid #10b981; padding: 20px; margin: 30px 0;">
                <p style="color: #065f46; font-size: 14px; margin: 0; line-height: 1.6;">
                  <strong>Tip:</strong> Respond quickly to viewing requests to maintain buyer interest and demonstrate professionalism. Consider following up with the buyer before the viewing to answer any preliminary questions.
                </p>
              </div>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 30px 0 0 0;">
                Best regards,<br>
                <strong>The Proprieta Team</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                This notification was sent to ${agentEmail}
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

    console.log(`Sending viewing notification email to agent: ${agentEmail}`);
    console.log(`Property: ${propertyAddress}`);
    console.log(`Buyer: ${buyerName} (${buyerEmail})`);
    console.log(`Date: ${formattedDate} at ${viewingTime}`);

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
        to: [agentEmail],
        subject: `New Viewing Scheduled - ${propertyAddress}`,
        html: emailContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      throw new Error(data.message || 'Failed to send email via Resend');
    }

    console.log('Agent viewing notification email sent successfully via Resend:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Agent viewing notification email sent successfully",
        emailId: data.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending agent viewing notification email:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send agent viewing notification email", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
