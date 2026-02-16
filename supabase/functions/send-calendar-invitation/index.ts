import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  appointmentId: string;
  clientName: string;
  clientEmail: string;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
}

function formatDateForICS(dateString: string): string {
  const date = new Date(dateString);
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function generateICS(data: RequestBody): string {
  const {
    appointmentId,
    title,
    description,
    location,
    startTime,
    endTime,
  } = data;

  const icsStart = formatDateForICS(startTime);
  const icsEnd = formatDateForICS(endTime);
  const now = formatDateForICS(new Date().toISOString());

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Service Provider//Appointment//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${appointmentId}@serviceprovider.app`,
    `DTSTAMP:${now}`,
    `DTSTART:${icsStart}`,
    `DTEND:${icsEnd}`,
    `SUMMARY:${title}`,
    description ? `DESCRIPTION:${description.replace(/\n/g, '\\n')}` : '',
    location ? `LOCATION:${location}` : '',
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: 30 minutes before appointment',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(line => line !== '').join('\r\n');

  return icsContent;
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
      clientName,
      clientEmail,
      title,
      description,
      location,
      startTime,
      endTime,
    } = body;

    const icsContent = generateICS(body);
    const icsBase64 = btoa(icsContent);

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
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
    const formattedEndTime = endDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
            <h1 style="color: #2563eb; margin-bottom: 20px;">Appointment Scheduled</h1>

            <p>Hi ${clientName},</p>

            <p>Your appointment has been scheduled. Please find the details below:</p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
              <h2 style="margin-top: 0; color: #1e40af;">${title}</h2>

              <p style="margin: 10px 0;">
                <strong>Date:</strong> ${formattedDate}<br>
                <strong>Time:</strong> ${formattedStartTime} - ${formattedEndTime}
              </p>

              ${location ? `<p style="margin: 10px 0;"><strong>Location:</strong> ${location}</p>` : ''}

              ${description ? `<p style="margin: 10px 0;"><strong>Details:</strong><br>${description.replace(/\n/g, '<br>')}</p>` : ''}
            </div>

            <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px;">
                <strong>📅 Add to Your Calendar</strong><br>
                A calendar invitation (.ics file) is attached to this email. Simply open the attachment to add this appointment to your calendar (works with Google Calendar, Apple Calendar, Outlook, and more).
              </p>
            </div>

            <p>If you need to reschedule or have any questions, please reply to this email.</p>

            <p style="margin-top: 30px;">
              Best regards,<br>
              Your Service Provider
            </p>
          </div>

          <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280;">
            <p>This is an automated appointment confirmation.</p>
          </div>
        </body>
      </html>
    `;

    const emailData = {
      from: 'onboarding@resend.dev',
      to: [clientEmail],
      subject: `Appointment Scheduled: ${title}`,
      html: emailHtml,
      attachments: [
        {
          filename: 'appointment.ics',
          content: icsBase64,
          content_type: 'text/calendar; charset=utf-8; method=REQUEST'
        }
      ]
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
        message: 'Calendar invitation sent successfully',
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
    console.error('Error sending calendar invitation:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to send calendar invitation'
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