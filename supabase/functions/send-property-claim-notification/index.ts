import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PropertyClaimNotificationRequest {
  agent_email: string;
  agent_name: string;
  property_address: string;
  property_price: number;
  property_city: string;
  property_state: string;
  buyer_name?: string;
  seller_name?: string;
  notification_type: 'new_listing' | 'buyer_viewed';
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
    const {
      agent_email,
      agent_name,
      property_address,
      property_price,
      property_city,
      property_state,
      buyer_name,
      seller_name,
      notification_type,
      property_id,
    }: PropertyClaimNotificationRequest = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const formattedPrice = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(property_price);

    const propertyUrl = `https://proprieta.co/property/${property_id}`;

    const isNewListing = notification_type === 'new_listing';
    const title = isNewListing
      ? 'New Property Available to Claim! 🏡'
      : 'Buyer Interest Alert! 🏡';

    const introText = isNewListing
      ? `Great news! A new unassigned property has been listed in your area${seller_name ? ` by ${seller_name}` : ''}. This is your chance to claim this listing and expand your portfolio!`
      : `Great news! A buyer named <strong>${buyer_name}</strong> has viewed an unassigned property in your area. This is your chance to claim this listing and connect with a potential client!`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Property Claim Opportunity</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">${title}</h1>
          </div>

          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hi ${agent_name},</p>

            <p style="font-size: 16px; margin-bottom: 20px;">
              ${introText}
            </p>

            <div style="background: #f3f4f6; border-left: 4px solid #3b82f6; padding: 20px; margin: 25px 0; border-radius: 5px;">
              <h2 style="margin: 0 0 15px 0; color: #1f2937; font-size: 20px;">Property Details</h2>
              <p style="margin: 8px 0; font-size: 16px;"><strong>Address:</strong> ${property_address}</p>
              <p style="margin: 8px 0; font-size: 16px;"><strong>Location:</strong> ${property_city}, ${property_state}</p>
              <p style="margin: 8px 0; font-size: 16px;"><strong>Price:</strong> ${formattedPrice}</p>
              ${!isNewListing && buyer_name ? `<p style="margin: 8px 0; font-size: 16px;"><strong>Interested Buyer:</strong> ${buyer_name}</p>` : ''}
              ${isNewListing && seller_name ? `<p style="margin: 8px 0; font-size: 16px;"><strong>Listed By:</strong> ${seller_name}</p>` : ''}
            </div>

            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0; border-radius: 5px;">
              <p style="margin: 0; font-size: 14px; color: #78350f;">
                <strong>⚡ Act Fast!</strong> The first agent to claim this property will be automatically assigned as the listing agent.
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${propertyUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View & Claim Property</a>
            </div>

            <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin-top: 25px;">
              <h3 style="margin: 0 0 10px 0; color: #1e40af; font-size: 16px;">Why Claim This Property?</h3>
              <ul style="margin: 10px 0; padding-left: 20px; color: #1e3a8a;">
                <li style="margin: 8px 0;">Connect with an active, interested buyer</li>
                <li style="margin: 8px 0;">Add a new listing to your portfolio</li>
                <li style="margin: 8px 0;">Build relationships in your market area</li>
                <li style="margin: 8px 0;">First-come, first-served opportunity</li>
              </ul>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280;">
              <p style="margin: 5px 0;">Best regards,</p>
              <p style="margin: 5px 0; font-weight: 600;">The Proprieta Team</p>
            </div>

            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center;">
              <p style="margin: 5px 0;">This is an automated notification from Proprieta.</p>
              <p style="margin: 5px 0;">Property claim opportunities are sent to agents in the same geographical area as the property.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const subject = isNewListing
      ? `New Listing to Claim in ${property_city}, ${property_state} - ${formattedPrice}`
      : `Buyer Interest: ${property_city}, ${property_state} - ${formattedPrice}`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Proprieta <noreply@proprieta.co>",
        to: [agent_email],
        subject: subject,
        html: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend API error:", errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const result = await emailResponse.json();

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending property claim notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});