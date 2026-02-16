import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};


interface EmailRequest {
  leadId: string;
  leadEmail: string;
  leadName: string;
  subject: string;
  message: string;
  providerName: string;
  providerEmail: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
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
      leadId,
      leadEmail,
      leadName,
      subject,
      message,
      providerName,
      providerEmail,
      attachmentUrl,
      attachmentName,
    }: EmailRequest = await req.json();

    if (!leadEmail || !subject || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #2563eb;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 5px 5px 0 0;
    }
    .content {
      background-color: #f9fafb;
      padding: 30px;
      border: 1px solid #e5e7eb;
    }
    .message {
      background-color: white;
      padding: 20px;
      border-radius: 5px;
      white-space: pre-wrap;
      border-left: 4px solid #2563eb;
    }
    .footer {
      background-color: #f3f4f6;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      border-radius: 0 0 5px 5px;
    }
    .reply-info {
      background-color: #dbeafe;
      border: 1px solid #93c5fd;
      padding: 15px;
      border-radius: 5px;
      margin-top: 20px;
      font-size: 14px;
    }
    .attachment {
      background-color: #f0fdf4;
      border: 1px solid #86efac;
      padding: 15px;
      border-radius: 5px;
      margin-top: 20px;
    }
    .attachment a {
      color: #16a34a;
      text-decoration: none;
      font-weight: bold;
    }
    .attachment a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h2>${providerName}</h2>
    </div>
    <div class="content">
      <div class="message">
        ${message.replace(/\n/g, '<br>')}
      </div>
      ${attachmentUrl && attachmentName ? `
      <div class="attachment">
        <p style="margin: 0 0 10px 0; font-weight: bold;">📎 Attachment:</p>
        <a href="${attachmentUrl}" target="_blank" rel="noopener noreferrer">${attachmentName}</a>
        <p style="margin: 10px 0 0 0; font-size: 12px; color: #6b7280;">Click to download</p>
      </div>
      ` : ''}
      <div class="reply-info">
        <strong>Reply directly to this email</strong> to continue the conversation. Your response will be logged automatically.
      </div>
    </div>
    <div class="footer">
      <p>This email was sent by ${providerName}</p>
      <p>Lead ID: ${leadId}</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    console.log("Sending email to:", leadEmail);
    console.log("Subject:", subject);
    if (attachmentUrl) {
      console.log("Attachment:", attachmentName, attachmentUrl);
    }

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
        from: `${providerName} <noreply@proprieta.co>`,
        to: [leadEmail],
        reply_to: providerEmail,
        subject: subject,
        html: emailBody,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      throw new Error(data.message || 'Failed to send email via Resend');
    }

    console.log('Lead response email sent successfully via Resend:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email sent successfully",
        details: {
          to: leadEmail,
          subject: subject,
          from: providerEmail,
          attachment: attachmentUrl ? { name: attachmentName, url: attachmentUrl } : null,
          messageId: data.id,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in send-lead-response:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
