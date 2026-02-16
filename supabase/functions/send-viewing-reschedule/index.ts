import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RescheduleEmailRequest {
  visitorEmail: string;
  visitorName: string;
  propertyAddress: string;
  oldViewingDate: string;
  oldViewingTime: string;
  newViewingDate: string;
  newViewingTime: string;
  agentName: string;
  agentEmail?: string;
  agentPhone?: string;
  calendarEventId: string;
  startDateTime: string;
  endDateTime: string;
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
      oldViewingDate,
      oldViewingTime,
      newViewingDate,
      newViewingTime,
      agentName,
      agentEmail,
      agentPhone,
      calendarEventId,
      startDateTime,
      endDateTime,
    }: RescheduleEmailRequest = await req.json();

    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Property Viewing - ' + propertyAddress)}&dates=${startDateTime}/${endDateTime}&details=${encodeURIComponent(`Property viewing with ${agentName}`)}&location=${encodeURIComponent(propertyAddress)}`;

    const outlookCalendarUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent('Property Viewing - ' + propertyAddress)}&startdt=${startDateTime}&enddt=${endDateTime}&body=${encodeURIComponent(`Property viewing with ${agentName}`)}&location=${encodeURIComponent(propertyAddress)}`;

    const appleCalendarData = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:${calendarEventId}
DTSTART:${startDateTime}
DTEND:${endDateTime}
SUMMARY:Property Viewing - ${propertyAddress}
DESCRIPTION:Property viewing with ${agentName}
LOCATION:${propertyAddress}
END:VEVENT
END:VCALENDAR`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Property Viewing Rescheduled</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 8px 8px 0 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Viewing Rescheduled</h1>
                    </td>
                  </tr>
                  
                  <tr>
                    <td style="padding: 30px 40px;">
                      <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                        Dear ${visitorName},
                      </p>
                      
                      <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                        Your property viewing has been rescheduled to a new date and time.
                      </p>

                      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 4px;">
                        <h2 style="margin: 0 0 15px; color: #92400e; font-size: 18px; font-weight: 600;">Previous Viewing Details</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px; font-weight: 600; width: 120px;">Property:</td>
                            <td style="padding: 8px 0; color: #333333; font-size: 14px;">${propertyAddress}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px; font-weight: 600;">Date:</td>
                            <td style="padding: 8px 0; color: #333333; font-size: 14px; text-decoration: line-through;">${oldViewingDate}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px; font-weight: 600;">Time:</td>
                            <td style="padding: 8px 0; color: #333333; font-size: 14px; text-decoration: line-through;">${oldViewingTime}</td>
                          </tr>
                        </table>
                      </div>

                      <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 4px;">
                        <h2 style="margin: 0 0 15px; color: #065f46; font-size: 18px; font-weight: 600;">New Viewing Details</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px; font-weight: 600; width: 120px;">Property:</td>
                            <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: 600;">${propertyAddress}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px; font-weight: 600;">Date:</td>
                            <td style="padding: 8px 0; color: #059669; font-size: 14px; font-weight: 600;">${newViewingDate}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px; font-weight: 600;">Time:</td>
                            <td style="padding: 8px 0; color: #059669; font-size: 14px; font-weight: 600;">${newViewingTime}</td>
                          </tr>
                        </table>
                      </div>

                      <div style="background-color: #fef3c7; border: 2px solid #f59e0b; padding: 25px; margin: 25px 0; border-radius: 8px; text-align: center;">
                        <h3 style="margin: 0 0 15px; color: #92400e; font-size: 18px; font-weight: 700;">⚠️ Action Required</h3>
                        <p style="margin: 0 0 20px; color: #78350f; font-size: 15px; line-height: 1.6;">
                          Please confirm or decline this reschedule request
                        </p>
                        <div style="margin: 20px 0;">
                          <a href="${Deno.env.get('SITE_URL') || 'https://proprieta.com'}/buyer/calendar?action=confirm&eventId=${calendarEventId}" style="display: inline-block; padding: 14px 32px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 15px; margin: 8px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">✓ Confirm New Time</a>
                          <a href="${Deno.env.get('SITE_URL') || 'https://proprieta.com'}/buyer/calendar?action=decline&eventId=${calendarEventId}" style="display: inline-block; padding: 14px 32px; background-color: #ef4444; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 15px; margin: 8px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">✗ Decline Reschedule</a>
                        </div>
                      </div>

                      <div style="background-color: #eff6ff; padding: 20px; margin: 25px 0; border-radius: 4px; text-align: center;">
                        <h3 style="margin: 0 0 15px; color: #1e40af; font-size: 16px; font-weight: 600;">Add to Your Calendar</h3>
                        <div>
                          <a href="${googleCalendarUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; margin: 8px 10px;">Add to Google Calendar</a>
                          <a href="${outlookCalendarUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0078d4; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; margin: 8px 10px;">Add to Outlook Calendar</a>
                        </div>
                      </div>

                      <div style="background-color: #f9fafb; padding: 20px; margin: 25px 0; border-radius: 4px;">
                        <h3 style="margin: 0 0 12px; color: #333333; font-size: 16px; font-weight: 600;">Your Agent</h3>
                        <p style="margin: 0 0 8px; color: #666666; font-size: 14px;">
                          <strong style="color: #333333;">${agentName}</strong>
                        </p>
                        ${agentEmail ? `
                          <p style="margin: 0 0 8px; color: #666666; font-size: 14px;">
                            ✉️ ${agentEmail}
                          </p>
                        ` : ''}
                        ${agentPhone ? `
                          <p style="margin: 0; color: #666666; font-size: 14px;">
                            📞 ${agentPhone}
                          </p>
                        ` : ''}
                      </div>

                      <p style="margin: 20px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                        If you have any questions or need to make changes, please contact ${agentName} directly.
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

Your property viewing has been rescheduled to a new date and time.

Previous Viewing Details:
Property: ${propertyAddress}
Date: ${oldViewingDate} (CANCELLED)
Time: ${oldViewingTime} (CANCELLED)

New Viewing Details:
Property: ${propertyAddress}
Date: ${newViewingDate}
Time: ${newViewingTime}

Add to Your Calendar:
Google Calendar: ${googleCalendarUrl}
Outlook Calendar: ${outlookCalendarUrl}

Your Agent:
${agentName}
${agentEmail ? `Email: ${agentEmail}\n` : ''}${agentPhone ? `Phone: ${agentPhone}` : ''}

If you have any questions or need to make changes, please contact ${agentName} directly.

This is an automated message from your real estate platform.
    `;

    console.log('Sending reschedule email to:', visitorEmail);

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
        subject: `Property Viewing Rescheduled - ${propertyAddress}`,
        html: emailHtml,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      throw new Error(data.message || 'Failed to send email via Resend');
    }

    console.log('Reschedule email sent successfully via Resend:', data);

    const response = {
      success: true,
      message: 'Reschedule email sent successfully',
      recipient: visitorEmail,
      emailId: data.id,
      calendarLinks: {
        google: googleCalendarUrl,
        outlook: outlookCalendarUrl,
      },
    };

    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      status: 200,
    });
  } catch (error) {
    console.error('Error in send-viewing-reschedule function:', error);

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
