import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ViewingReminderRequest {
  agentEmail: string;
  agentName: string;
  agentPhone?: string;
  visitorEmail: string;
  visitorName: string;
  propertyAddress: string;
  viewingTime: string;
  reminderDays: number;
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
      agentPhone,
      visitorEmail,
      visitorName,
      propertyAddress,
      viewingTime,
      reminderDays
    }: ViewingReminderRequest = await req.json();

    if (!visitorEmail || !visitorName || !propertyAddress || !viewingTime || !reminderDays) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const reminderText = reminderDays === 1 ? 'tomorrow' :
                        reminderDays === 7 ? 'in 1 week' :
                        reminderDays === 14 ? 'in 2 weeks' :
                        'in 1 month';

    const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
  <title>Property Viewing Reminder</title>
</head>
<body style=\"margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;\">
  <table role=\"presentation\" style=\"width: 100%; border-collapse: collapse;\">
    <tr>
      <td align=\"center\" style=\"padding: 40px 0;\">
        <table role=\"presentation\" style=\"width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);\">
          <tr>
            <td style=\"background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 30px; text-align: center;\">
              <h1 style=\"margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;\">Viewing Reminder</h1>
            </td>
          </tr>
          <tr>
            <td style=\"padding: 40px 30px;\">
              <h2 style=\"color: #1f2937; font-size: 24px; margin: 0 0 20px 0;\">Hello ${visitorName}!</h2>
              <p style=\"color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;\">
                This is a friendly reminder that you have a property viewing scheduled <strong>${reminderText}</strong>.
              </p>
              <div style=\"background-color: #fff7ed; border: 2px solid #f59e0b; border-radius: 8px; padding: 25px; margin: 30px 0;\">
                <h3 style=\"color: #b45309; font-size: 18px; margin: 0 0 15px 0; font-weight: bold;\">Viewing Details</h3>
                <p style=\"color: #1f2937; font-size: 16px; margin: 0 0 10px 0;\">
                  <strong>Property:</strong><br>
                  ${propertyAddress}
                </p>
                <p style=\"color: #1f2937; font-size: 16px; margin: 0;\">
                  <strong>Date & Time:</strong><br>
                  ${viewingTime}
                </p>
              </div>
              ${agentName ? `
              <div style=\"background-color: #f3f4f6; border-left: 4px solid #f59e0b; padding: 20px; margin: 30px 0;\">
                <h3 style=\"color: #1f2937; font-size: 18px; margin: 0 0 15px 0;\">Your Agent</h3>
                <p style=\"color: #4b5563; font-size: 16px; margin: 0;\">
                  <strong>${agentName}</strong>
                  ${agentPhone ? `<br><span style=\"color: #6b7280;\">Phone: ${agentPhone}</span>` : ''}
                  ${agentEmail ? `<br><span style=\"color: #6b7280;\">Email: ${agentEmail}</span>` : ''}
                </p>
              </div>
              ` : ''}
              <h3 style=\"color: #1f2937; font-size: 20px; margin: 30px 0 15px 0;\">Preparing for Your Viewing</h3>
              <ul style=\"color: #4b5563; font-size: 16px; line-height: 1.8; margin: 0 0 20px 0; padding-left: 20px;\">
                <li style=\"margin-bottom: 10px;\">Review the property listing details beforehand</li>
                <li style=\"margin-bottom: 10px;\">Prepare any questions you'd like to ask</li>
                <li style=\"margin-bottom: 10px;\">Plan your route and allow extra time for parking</li>
                <li style=\"margin-bottom: 10px;\">Bring a notepad or use your phone to take notes</li>
                <li style=\"margin-bottom: 10px;\">Consider bringing someone with you for a second opinion</li>
              </ul>
              <div style=\"background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 30px 0;\">
                <p style=\"color: #92400e; font-size: 14px; margin: 0; line-height: 1.6;\">
                  <strong>Need to reschedule?</strong> Please contact ${agentName || 'your agent'} as soon as possible if you need to change your viewing time.
                </p>
              </div>
              <div style=\"background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 30px 0;\">
                <p style=\"color: #1e40af; font-size: 14px; margin: 0; line-height: 1.6;\">
                  <strong>Pro Tip:</strong> Take photos during your viewing (with permission) and note down measurements of rooms you're particularly interested in. This will help you make a more informed decision later.
                </p>
              </div>
              <p style=\"color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;\">
                We look forward to showing you this property! If you have any questions before your viewing, please don't hesitate to reach out to ${agentName || 'your agent'}.
              </p>
              <p style=\"color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0;\">
                Best regards,<br>
                <strong>The Proprieta Team</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style=\"background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;\">
              <p style=\"color: #6b7280; font-size: 14px; margin: 0 0 10px 0;\">
                This reminder was sent to ${visitorEmail}
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

    console.log(`Sending viewing reminder to: ${visitorEmail}`);
    console.log(`Property: ${propertyAddress}`);
    console.log(`Reminder: ${reminderDays} days before`);

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
        subject: `Reminder: Property Viewing ${reminderText.charAt(0).toUpperCase() + reminderText.slice(1)} - ${propertyAddress}`,
        html: emailContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      throw new Error(data.message || 'Failed to send email via Resend');
    }

    console.log('Viewing reminder email sent successfully via Resend:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Viewing reminder email sent successfully",
        emailId: data.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending viewing reminder email:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send viewing reminder email", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
