import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OfferNotificationRequest {
  agent_email: string;
  agent_name: string;
  buyer_name: string;
  property_address: string;
  offer_amount: number;
  property_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { agent_email, agent_name, buyer_name, property_address, offer_amount, property_id }: OfferNotificationRequest = await req.json();

    if (!agent_email || !agent_name || !buyer_name || !property_address || !offer_amount) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(offer_amount);

    const siteUrl = Deno.env.get('SITE_URL') || 'https://proprieta.com';
    const offerUrl = `${siteUrl}/#/agent/offers`;

    const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Offer Submitted</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">New Offer Received!</h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; font-size: 24px; margin: 0 0 20px 0;">Hello ${agent_name},</h2>

              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Great news! A buyer has submitted an offer on one of your properties.
              </p>

              <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 30px 0;">
                <h3 style="color: #1f2937; font-size: 18px; margin: 0 0 15px 0;">Offer Details</h3>
                
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="color: #6b7280; font-size: 14px; padding: 8px 0; font-weight: bold;">Buyer:</td>
                    <td style="color: #1f2937; font-size: 16px; padding: 8px 0;">${buyer_name}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; font-size: 14px; padding: 8px 0; font-weight: bold;">Property:</td>
                    <td style="color: #1f2937; font-size: 16px; padding: 8px 0;">${property_address}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; font-size: 14px; padding: 8px 0; font-weight: bold;">Offer Amount:</td>
                    <td style="color: #10b981; font-size: 20px; padding: 8px 0; font-weight: bold;">${formattedAmount}</td>
                  </tr>
                </table>
              </div>

              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Log in to your dashboard to review the full offer details and take action.
              </p>
              
              <div style="text-align: center; margin: 40px 0 30px 0;">
                <a href="${offerUrl}" style="background-color: #10b981; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">View Offer</a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                <strong>Important:</strong> Please respond to this offer promptly. Buyers appreciate timely communication and it helps build trust in the transaction process.
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                This email was sent to ${agent_email}
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

    console.log(`Sending offer notification to agent: ${agent_email}`);
    console.log(`Buyer: ${buyer_name}, Property: ${property_address}, Amount: ${formattedAmount}`);

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
        to: [agent_email],
        subject: `New Offer: ${formattedAmount} for ${property_address}`,
        html: emailContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      throw new Error(data.message || 'Failed to send email via Resend');
    }

    console.log('Offer notification email sent successfully via Resend:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Offer notification sent successfully",
        emailId: data.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending offer notification:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send offer notification", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
