import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvitationEmailRequest {
  invitationId: string;
  email: string;
  agentName: string;
  userType: 'buyer' | 'seller';
  token: string;
  message?: string;
  appUrl?: string;
  senderType?: 'agent' | 'lender' | 'property_owner' | 'service_provider';
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { invitationId, email, agentName, userType, token, message, appUrl: clientAppUrl, senderType = 'agent' }: InvitationEmailRequest = await req.json();

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const appUrl = clientAppUrl || Deno.env.get('APP_URL') || 'https://bolt.new/~/sb1-gmtxjbe6';
    const invitationUrl = `${appUrl}?invitation=${token}`;

    console.log('Creating invitation URL:', invitationUrl);
    
    // Determine the sender label based on sender type
    const senderLabel = senderType === 'lender' ? 'mortgage lender' : 
                       senderType === 'property_owner' ? 'property owner' : 
                       senderType === 'service_provider' ? 'service provider' : 
                       'agent';
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
            .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 40px 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 32px; font-weight: 700; }
            .content { padding: 40px 30px; }
            .content p { margin: 0 0 16px 0; color: #374151; }
            .content p:first-of-type { font-size: 18px; font-weight: 500; }
            .button-container { text-align: center; margin: 30px 0; }
            .button { display: inline-block; background: #2563eb; color: white !important; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; }
            .message-box { background: #eff6ff; border-left: 4px solid #2563eb; padding: 16px; margin: 24px 0; border-radius: 4px; }
            .message-box p { margin: 0; }
            .message-box p + p { margin-top: 12px; }
            .url-box { background: #f3f4f6; padding: 12px; border-radius: 4px; word-break: break-all; font-size: 13px; color: #6b7280; margin: 16px 0; }
            .footer { text-align: center; padding: 24px 30px; color: #6b7280; font-size: 14px; background-color: #f9fafb; }
            .footer p { margin: 8px 0; }
            .small-text { font-size: 13px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>You're Invited to Proprieta!</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p><strong>${agentName}</strong> has invited you to join Proprieta as a <strong>${userType}</strong>.</p>
              
              ${message ? `<div class="message-box"><p><strong>Personal message from your ${senderLabel}:</strong></p><p>${message}</p></div>` : ''}
              
              <p>Proprieta is a comprehensive real estate platform that connects you with professional ${senderType === 'lender' ? 'mortgage lenders' : 'agents'} to help you ${userType === 'buyer' ? 'find your perfect home' : 'sell your property'}.</p>
              
              <div class="button-container">
                <a href="${invitationUrl}" class="button">Accept Invitation</a>
              </div>
              
              <p class="small-text">Or copy and paste this link into your browser:</p>
              <div class="url-box">${invitationUrl}</div>
              
              <p class="small-text" style="margin-top: 30px;"><em>This invitation will expire in 7 days.</em></p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Proprieta. All rights reserved.</p>
              <p style="font-size: 12px;">If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    console.log('Sending invitation email to:', email);
    console.log('Invitation URL:', invitationUrl);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Proprieta <noreply@proprieta.co>',
        to: [email],
        subject: `${agentName} invited you to join Proprieta as a ${userType}`,
        html: emailHtml,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      throw new Error(data.message || 'Failed to send email via Resend');
    }

    console.log('Invitation email sent successfully via Resend:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invitation email sent successfully',
        invitationUrl,
        emailId: data.id,
        debug: {
          email,
          agentName,
          userType,
          token: token.substring(0, 10) + '...',
        }
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
    console.error('Error sending invitation email:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to send invitation email',
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
