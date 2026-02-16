import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ViewingConfirmationRequest {
  visitorEmail: string;
  visitorName: string;
  propertyAddress: string;
  viewingDate: string;
  viewingTime: string;
  agentName: string;
  agentPhone?: string;
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
      agentPhone
    }: ViewingConfirmationRequest = await req.json();

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
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

    const formattedDate = startDateTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const formatDateForCalendar = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const eventTitle = encodeURIComponent(`Property Viewing: ${propertyAddress}`);
    const eventDescription = encodeURIComponent(`Property viewing appointment at ${propertyAddress}${agentName ? ` with ${agentName}` : ''}${agentPhone ? `. Contact: ${agentPhone}` : ''}`);
    const eventLocation = encodeURIComponent(propertyAddress);

    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${formatDateForCalendar(startDateTime)}/${formatDateForCalendar(endDateTime)}&details=${eventDescription}&location=${eventLocation}`;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Proprieta//Property Viewing//EN',
      'BEGIN:VEVENT',
      `DTSTART:${formatDateForCalendar(startDateTime)}`,
      `DTEND:${formatDateForCalendar(endDateTime)}`,
      `SUMMARY:${decodeURIComponent(eventTitle)}`,
      `DESCRIPTION:${decodeURIComponent(eventDescription)}`,
      `LOCATION:${propertyAddress}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const icsDataUri = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;

    const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Property Viewing Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">Viewing Confirmed!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; font-size: 24px; margin: 0 0 20px 0;">Hello ${visitorName}!</h2>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Great news! Your property viewing request has been officially confirmed by your agent. We're excited to show you this property at the scheduled time:
              </p>
              <div style="background-color: #f0fdf4; border: 2px solid #10b981; border-radius: 8px; padding: 25px; margin: 30px 0;">
                <h3 style="color: #059669; font-size: 18px; margin: 0 0 15px 0; font-weight: bold;">Property Address</h3>
                <p style="color: #1f2937; font-size: 16px; margin: 0 0 20px 0; font-weight: 600;">
                  ${propertyAddress}
                </p>
                <h3 style="color: #059669; font-size: 18px; margin: 0 0 15px 0; font-weight: bold;">Date & Time</h3>
                <p style="color: #1f2937; font-size: 16px; margin: 0;">
                  <strong>${formattedDate}</strong><br>
                  <strong>${viewingTime}</strong>
                </p>
              </div>
              <div style="background-color: #eff6ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 25px; margin: 30px 0; text-align: center;">
                <h3 style="color: #1e40af; font-size: 18px; margin: 0 0 20px 0; font-weight: bold;">Add to Your Calendar</h3>
                <p style="color: #1f2937; font-size: 14px; margin: 0 0 20px 0;">
                  Don't forget your viewing appointment! Add it to your calendar with one click:
                </p>
                <div style="display: inline-block;">
                  <a href="${googleCalendarUrl}" target="_blank" style="display: inline-block; background-color: #4285f4; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 15px; font-weight: bold; margin: 8px;">
                    <span style="display: inline-block; vertical-align: middle;">📅</span> Add to Google Calendar
                  </a>
                  <a href="${icsDataUri}" download="property-viewing.ics" style="display: inline-block; background-color: #6b7280; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 15px; font-weight: bold; margin: 8px;">
                    <span style="display: inline-block; vertical-align: middle;">📱</span> Add to Apple Calendar
                  </a>
                </div>
                <p style="color: #6b7280; font-size: 12px; margin: 15px 0 0 0;">
                  Apple Calendar link will download an .ics file that works with Apple Calendar, Outlook, and other calendar apps
                </p>
              </div>
              ${agentName ? `
              <div style="background-color: #f3f4f6; border-left: 4px solid #2563eb; padding: 20px; margin: 30px 0;">
                <h3 style="color: #1f2937; font-size: 18px; margin: 0 0 15px 0;">Your Agent</h3>
                <p style="color: #4b5563; font-size: 16px; margin: 0;">
                  <strong>${agentName}</strong>
                  ${agentPhone ? `<br><span style="color: #6b7280;">Phone: ${agentPhone}</span>` : ''}
                </p>
              </div>
              ` : ''}
              <h3 style="color: #1f2937; font-size: 20px; margin: 30px 0 15px 0;">What to Expect</h3>
              <ul style="color: #4b5563; font-size: 16px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 10px;">Please arrive on time for your scheduled viewing</li>
                <li style="margin-bottom: 10px;">Bring a valid form of identification</li>
                <li style="margin-bottom: 10px;">Feel free to take photos and ask questions</li>
                <li style="margin-bottom: 10px;">The viewing typically takes 30-45 minutes</li>
                <li style="margin-bottom: 10px;">If you need to reschedule, please contact us as soon as possible</li>
              </ul>
              <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin: 30px 0;">
                <p style="color: #065f46; font-size: 14px; margin: 0; line-height: 1.6;">
                  <strong>Confirmed!</strong> Your viewing appointment has been officially confirmed by your agent. The property will be ready for you at the scheduled date and time. We look forward to seeing you!
                </p>
              </div>
              <div style="text-align: center; margin: 40px 0 30px 0;">
                <a href="${Deno.env.get('SITE_URL') || 'https://proprieta.com'}" style="background-color: #10b981; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">View More Properties</a>
              </div>
              <h3 style="color: #1f2937; font-size: 20px; margin: 30px 0 15px 0;">Questions?</h3>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                If you have any questions about this viewing or need to make changes, please don't hesitate to contact ${agentName || 'us'}.
              </p>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0;">
                We look forward to seeing you!<br>
                <strong>The Proprieta Team</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                This confirmation was sent to ${visitorEmail}
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

    console.log(`Sending viewing confirmation email to: ${visitorEmail}`);
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
        subject: `Property Viewing Confirmed - ${propertyAddress}`,
        html: emailContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      throw new Error(data.message || 'Failed to send email via Resend');
    }

    console.log('Viewing confirmation email sent successfully via Resend:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Viewing confirmation email sent successfully",
        emailId: data.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending viewing confirmation email:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send viewing confirmation email", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
