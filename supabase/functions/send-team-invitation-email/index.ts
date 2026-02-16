import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TeamInvitationEmailRequest {
  inviteeEmail: string;
  inviteeName: string;
  inviterName: string;
  teamName: string;
  teamDescription?: string;
  appUrl?: string;
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
      inviteeEmail,
      inviteeName,
      inviterName,
      teamName,
      teamDescription,
      appUrl: clientAppUrl
    }: TeamInvitationEmailRequest = await req.json();

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const appUrl = clientAppUrl || Deno.env.get('APP_URL') || 'https://bolt.new/~/sb1-gmtxjbe6';
    const dashboardUrl = `${appUrl}#/dashboard`;

    console.log('Sending team invitation email to:', inviteeEmail);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
              background-color: #f5f5f5;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
              color: white;
              padding: 40px 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 700;
            }
            .header p {
              margin: 8px 0 0 0;
              font-size: 16px;
              opacity: 0.95;
            }
            .content {
              padding: 40px 30px;
            }
            .content p {
              margin: 0 0 16px 0;
              color: #374151;
              font-size: 16px;
            }
            .greeting {
              font-size: 18px;
              font-weight: 500;
              color: #111827;
            }
            .team-box {
              background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
              border-left: 4px solid #2563eb;
              padding: 20px;
              margin: 24px 0;
              border-radius: 6px;
            }
            .team-name {
              font-size: 24px;
              font-weight: 700;
              color: #1e40af;
              margin: 0 0 8px 0;
            }
            .team-description {
              color: #1e40af;
              margin: 0;
              font-size: 15px;
            }
            .button-container {
              text-align: center;
              margin: 30px 0;
            }
            .button {
              display: inline-block;
              background: #2563eb;
              color: white !important;
              padding: 16px 40px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              font-size: 16px;
              box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);
              transition: all 0.2s;
            }
            .button:hover {
              background: #1e40af;
              box-shadow: 0 6px 8px rgba(37, 99, 235, 0.3);
            }
            .info-section {
              background: #f9fafb;
              padding: 20px;
              border-radius: 6px;
              margin: 24px 0;
            }
            .info-section h3 {
              margin: 0 0 12px 0;
              font-size: 16px;
              font-weight: 600;
              color: #111827;
            }
            .info-section ul {
              margin: 0;
              padding-left: 20px;
              color: #4b5563;
            }
            .info-section li {
              margin-bottom: 8px;
            }
            .url-box {
              background: #f3f4f6;
              padding: 12px;
              border-radius: 4px;
              word-break: break-all;
              font-size: 13px;
              color: #6b7280;
              margin: 16px 0;
              border: 1px solid #e5e7eb;
            }
            .footer {
              text-align: center;
              padding: 24px 30px;
              color: #6b7280;
              font-size: 14px;
              background-color: #f9fafb;
              border-top: 1px solid #e5e7eb;
            }
            .footer p {
              margin: 8px 0;
            }
            .small-text {
              font-size: 13px;
              color: #6b7280;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Team Invitation</h1>
              <p>Join your team on Proprieta</p>
            </div>
            <div class="content">
              <p class="greeting">Hello ${inviteeName},</p>

              <p><strong>${inviterName}</strong> has invited you to join their team on Proprieta.</p>

              <div class="team-box">
                <h2 class="team-name">${teamName}</h2>
                ${teamDescription ? `<p class="team-description">${teamDescription}</p>` : ''}
              </div>

              <div class="info-section">
                <h3>What is a Proprieta Team?</h3>
                <ul>
                  <li>Collaborate with other agents in your brokerage or office</li>
                  <li>Share clients, listings, and resources seamlessly</li>
                  <li>Coordinate showings and manage transactions together</li>
                  <li>Stay organized with shared calendars and documents</li>
                </ul>
              </div>

              <p>Click the button below to accept this invitation and join the team:</p>

              <div class="button-container">
                <a href="${dashboardUrl}" class="button">View Invitation</a>
              </div>

              <p class="small-text">Or copy and paste this link into your browser:</p>
              <div class="url-box">${dashboardUrl}</div>

              <p class="small-text" style="margin-top: 30px;">
                <strong>Note:</strong> You'll need to log in to your Proprieta account to accept this invitation.
                If you don't have an account yet, you'll need to create one using this email address (<strong>${inviteeEmail}</strong>).
              </p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Proprieta. All rights reserved.</p>
              <p style="font-size: 12px;">If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    console.log('Sending team invitation email via Resend');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Proprieta Teams <noreply@proprieta.co>',
        to: [inviteeEmail],
        subject: `${inviterName} invited you to join ${teamName} on Proprieta`,
        html: emailHtml,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      throw new Error(data.message || 'Failed to send email via Resend');
    }

    console.log('Team invitation email sent successfully via Resend:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Team invitation email sent successfully',
        emailId: data.id,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error sending team invitation email:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to send team invitation email',
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