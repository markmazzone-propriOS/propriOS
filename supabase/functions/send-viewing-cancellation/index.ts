import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CancellationEmailRequest {
  visitorEmail: string;
  visitorName: string;
  propertyAddress: string;
  viewingDate: string;
  viewingTime: string;
  agentName: string;
  agentPhone?: string;
  cancellationReason?: string;
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
      cancellationReason,
    }: CancellationEmailRequest = await req.json();

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Property Viewing Cancelled</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); border-radius: 8px 8px 0 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Viewing Cancelled</h1>
                    </td>
                  </tr>
                  
                  <tr>
                    <td style="padding: 30px 40px;">
                      <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                        Dear ${visitorName},
                      </p>
                      
                      <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                        We regret to inform you that your scheduled property viewing has been cancelled.
                      </p>

                      <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 25px 0; border-radius: 4px;">
                        <h2 style="margin: 0 0 15px; color: #991b1b; font-size: 18px; font-weight: 600;">Cancelled Viewing Details</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px; font-weight: 600; width: 120px;">Property:</td>
                            <td style="padding: 8px 0; color: #333333; font-size: 14px;">${propertyAddress}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px; font-weight: 600;">Date:</td>
                            <td style="padding: 8px 0; color: #333333; font-size: 14px;">${viewingDate}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px; font-weight: 600;">Time:</td>
                            <td style="padding: 8px 0; color: #333333; font-size: 14px;">${viewingTime}</td>
                          </tr>
                        </table>
                      </div>

                      ${cancellationReason ? `
                        <div style="background-color: #f9fafb; padding: 15px; margin: 20px 0; border-radius: 4px;">
                          <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">
                            <strong>Reason:</strong> ${cancellationReason}
                          </p>
                        </div>
                      ` : ''}

                      <p style="margin: 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                        If you would like to reschedule or view other properties, please don't hesitate to contact us.
                      </p>

                      <div style="background-color: #f9fafb; padding: 20px; margin: 25px 0; border-radius: 4px;">
                        <h3 style="margin: 0 0 12px; color: #333333; font-size: 16px; font-weight: 600;">Your Agent</h3>
                        <p style="margin: 0 0 8px; color: #666666; font-size: 14px;">
                          <strong style="color: #333333;">${agentName}</strong>
                        </p>
                        ${agentPhone ? `
                          <p style="margin: 0; color: #666666; font-size: 14px;">
                            📞 ${agentPhone}
                          </p>
                        ` : ''}
                      </div>

                      <p style="margin: 20px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                        We apologize for any inconvenience this may cause and look forward to assisting you with your property search.
                      </p>
                    </td>
                  </tr>
                  
                  <tr>
                    <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
                      <p style="margin: 0; color: #666666; font-size: 12px; line-height: 1.5;">
                        This is an automated message from your real estate platform.
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

    const emailText = `
Dear ${visitorName},

We regret to inform you that your scheduled property viewing has been cancelled.

Cancelled Viewing Details:
Property: ${propertyAddress}
Date: ${viewingDate}
Time: ${viewingTime}

${cancellationReason ? `Reason: ${cancellationReason}\n\n` : ''}
If you would like to reschedule or view other properties, please don't hesitate to contact us.

Your Agent:
${agentName}
${agentPhone ? `Phone: ${agentPhone}` : ''}

We apologize for any inconvenience this may cause and look forward to assisting you with your property search.

This is an automated message from your real estate platform.
    `;

    console.log('Sending cancellation email to:', visitorEmail);

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
        subject: `Property Viewing Cancelled - ${propertyAddress}`,
        html: emailHtml,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      throw new Error(data.message || 'Failed to send email via Resend');
    }

    console.log('Cancellation email sent successfully via Resend:', data);

    const response = {
      success: true,
      message: 'Cancellation email sent successfully',
      recipient: visitorEmail,
      emailId: data.id,
    };

    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      status: 200,
    });
  } catch (error) {
    console.error('Error in send-viewing-cancellation function:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 500,
      }
    );
  }
});
