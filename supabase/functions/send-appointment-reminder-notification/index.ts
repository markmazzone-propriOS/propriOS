import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  reminderId: string;
  propertyOwnerName: string;
  propertyOwnerEmail: string;
  serviceProviderName: string;
  serviceProviderEmail: string;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  customMessage?: string;
  reminderType: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const body: RequestBody = await req.json();
    const {
      propertyOwnerName,
      propertyOwnerEmail,
      serviceProviderName,
      serviceProviderEmail,
      title,
      description,
      location,
      startTime,
      endTime,
      customMessage,
      reminderType,
    } = body;

    const startDate = new Date(startTime);
    const formattedDate = startDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedStartTime = startDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    let reminderTimeText = '';
    switch(reminderType) {
      case '15_minutes':
        reminderTimeText = '15 minutes';
        break;
      case '1_hour':
        reminderTimeText = '1 hour';
        break;
      case '1_day':
        reminderTimeText = '1 day';
        break;
      default:
        reminderTimeText = 'soon';
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
            <h1 style="color: #f59e0b; margin-bottom: 20px;">🔔 Appointment Reminder</h1>

            <p>Hi ${propertyOwnerName},</p>

            <p>This is a reminder that you have an appointment scheduled for ${reminderTimeText} from now.</p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <h2 style="margin-top: 0; color: #d97706;">${title}</h2>

              <p style="margin: 10px 0;">
                <strong>Date:</strong> ${formattedDate}<br>
                <strong>Time:</strong> ${formattedStartTime}
              </p>

              ${location ? `<p style="margin: 10px 0;"><strong>Location:</strong> ${location}</p>` : ''}

              <p style="margin: 10px 0;">
                <strong>Service Provider:</strong> ${serviceProviderName}<br>
                <strong>Email:</strong> ${serviceProviderEmail}
              </p>

              ${description ? `<p style="margin: 10px 0;"><strong>Details:</strong><br>${description.replace(/\n/g, '<br>')}</p>` : ''}
            </div>

            ${customMessage ? `
              <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px;">
                  <strong>📝 Message from ${serviceProviderName}:</strong><br>
                  ${customMessage.replace(/\n/g, '<br>')}
                </p>
              </div>
            ` : ''}

            <p>If you have any questions or need to make changes, please contact the service provider directly.</p>

            <p style="margin-top: 30px;">
              Best regards,<br>
              Your Property Management Platform
            </p>
          </div>

          <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280;">
            <p>This is an automated reminder notification.</p>
          </div>
        </body>
      </html>
    `;

    const emailData = {
      from: 'Proprieta <noreply@proprieta.co>',
      to: [propertyOwnerEmail],
      subject: `Reminder: ${title} - ${reminderTimeText} from now`,
      html: emailHtml,
    };

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
    }

    const result = await resendResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Reminder notification sent successfully',
        emailId: result.id
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error sending reminder notification:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to send reminder notification'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});