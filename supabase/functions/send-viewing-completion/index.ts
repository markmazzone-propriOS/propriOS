import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ViewingCompletionRequest {
  visitorEmail: string;
  visitorName: string;
  propertyAddress: string;
  viewingDate: string;
  viewingTime: string;
  agentName: string;
  agentPhone?: string;
  agentEmail?: string;
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
      visitorEmail,
      visitorName,
      propertyAddress,
      viewingDate,
      viewingTime,
      agentName,
      agentPhone,
      agentEmail
    }: ViewingCompletionRequest = await req.json();

    if (!visitorEmail || !visitorName || !propertyAddress || !viewingDate || !viewingTime) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const parseTimeString = (timeStr: string) => {
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!match) return { hours: 0, minutes: 0 };

      let hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const period = match[3].toUpperCase();

      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;

      return { hours, minutes };
    };

    const { hours, minutes } = parseTimeString(viewingTime);
    const startDateTime = new Date(viewingDate);
    startDateTime.setHours(hours, minutes, 0, 0);

    const formattedDate = startDateTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
  <title>Property Viewing Completed</title>
</head>
<body style=\"margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;\">
  <table role=\"presentation\" style=\"width: 100%; border-collapse: collapse;\">
    <tr>
      <td align=\"center\" style=\"padding: 40px 0;\">
        <table role=\"presentation\" style=\"width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);\">
          <tr>
            <td style=\"background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 40px 30px; text-align: center;\">
              <h1 style=\"margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;\">Viewing Completed!</h1>
            </td>
          </tr>
          <tr>
            <td style=\"padding: 40px 30px;\">
              <h2 style=\"color: #1f2937; font-size: 24px; margin: 0 0 20px 0;\">Hello ${visitorName}!</h2>
              <p style=\"color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;\">
                Thank you for viewing the property! We hope you enjoyed seeing it in person. This is to confirm that your property viewing has been marked as completed.
              </p>
              <div style=\"background-color: #eff6ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 25px; margin: 30px 0;\">
                <h3 style=\"color: #1e40af; font-size: 18px; margin: 0 0 15px 0; font-weight: bold;\">Viewing Details</h3>
                <p style=\"color: #1f2937; font-size: 16px; margin: 0 0 10px 0;\">
                  <strong>Property:</strong><br>
                  ${propertyAddress}
                </p>
                <p style=\"color: #1f2937; font-size: 16px; margin: 0;\">
                  <strong>Date & Time:</strong><br>
                  ${formattedDate} at ${viewingTime}
                </p>
              </div>
              ${agentName ? `
              <div style=\"background-color: #f3f4f6; border-left: 4px solid #2563eb; padding: 20px; margin: 30px 0;\">
                <h3 style=\"color: #1f2937; font-size: 18px; margin: 0 0 15px 0;\">Your Agent</h3>
                <p style=\"color: #4b5563; font-size: 16px; margin: 0;\">
                  <strong>${agentName}</strong>
                  ${agentPhone ? `<br><span style=\"color: #6b7280;\">Phone: ${agentPhone}</span>` : ''}
                  ${agentEmail ? `<br><span style=\"color: #6b7280;\">Email: ${agentEmail}</span>` : ''}
                </p>
              </div>
              ` : ''}
              <h3 style=\"color: #1f2937; font-size: 20px; margin: 30px 0 15px 0;\">What's Next?</h3>
              <p style=\"color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;\">
                We'd love to hear your thoughts about the property! If you're interested in moving forward, please reach out to your agent to discuss the next steps.
              </p>
              <ul style=\"color: #4b5563; font-size: 16px; line-height: 1.8; margin: 0 0 20px 0; padding-left: 20px;\">
                <li style=\"margin-bottom: 10px;\">Discuss your impressions with your agent</li>
                <li style=\"margin-bottom: 10px;\">Review comparable properties if needed</li>
                <li style=\"margin-bottom: 10px;\">Make an offer if you're ready to proceed</li>
                <li style=\"margin-bottom: 10px;\">Schedule additional viewings if you'd like to see it again</li>
              </ul>
              <div style=\"background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 30px 0;\">
                <p style=\"color: #1e40af; font-size: 14px; margin: 0; line-height: 1.6;\">
                  <strong>Ready to make an offer?</strong> Contact ${agentName || 'your agent'} to discuss your options and get started with the next steps in your home buying journey.
                </p>
              </div>
              <div style=\"text-align: center; margin: 40px 0 30px 0;\">
                <a href=\"${Deno.env.get('SITE_URL') || 'https://proprieta.com'}\" style=\"background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;\">View More Properties</a>
              </div>
              <h3 style=\"color: #1f2937; font-size: 20px; margin: 30px 0 15px 0;\">Need More Information?</h3>
              <p style=\"color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;\">
                If you have any questions or would like to schedule another viewing, please don't hesitate to contact ${agentName || 'your agent'}.
              </p>
              <p style=\"color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0;\">
                Thank you for choosing Proprieta!<br>
                <strong>The Proprieta Team</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style=\"background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;\">
              <p style=\"color: #6b7280; font-size: 14px; margin: 0 0 10px 0;\">
                This notification was sent to ${visitorEmail}
              </p>
              <p style=\"color: #9ca3af; font-size: 12px; margin: 0;\">
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

    console.log(`Sending viewing completion email to: ${visitorEmail}`);
    console.log(`Property: ${propertyAddress}`);
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
        to: [visitorEmail],
        subject: `Property Viewing Completed - ${propertyAddress}`,
        html: emailContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      throw new Error(data.message || 'Failed to send email via Resend');
    }

    console.log('Viewing completion email sent successfully via Resend:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Viewing completion email sent successfully",
        emailId: data.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending viewing completion email:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send viewing completion email", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
