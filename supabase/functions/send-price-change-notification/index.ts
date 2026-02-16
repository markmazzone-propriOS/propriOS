import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PriceChangeRequest {
  buyer_email: string;
  buyer_name: string;
  property_address: string;
  property_city: string;
  property_state: string;
  old_price: number;
  new_price: number;
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
      buyer_email,
      buyer_name,
      property_address,
      property_city,
      property_state,
      old_price,
      new_price,
      property_id
    }: PriceChangeRequest = await req.json();

    if (!buyer_email || !buyer_name || !property_address || !old_price || !new_price) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const priceDifference = new_price - old_price;
    const percentageChange = ((priceDifference / old_price) * 100).toFixed(1);
    const priceIncreased = priceDifference > 0;
    const changeText = priceIncreased ? 'increased' : 'decreased';
    const changeColor = priceIncreased ? '#dc2626' : '#16a34a';

    const formatPrice = (price: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(price);
    };

    const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Price Change Alert - Proprieta</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Price Change Alert</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; font-size: 22px; margin: 0 0 20px 0;">Hello ${buyer_name}!</h2>

              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Good news! The price of a property you've favorited has changed.
              </p>

              <!-- Property Info -->
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin: 30px 0;">
                <h3 style="color: #1f2937; font-size: 18px; margin: 0 0 12px 0;">Property Address</h3>
                <p style="color: #4b5563; font-size: 16px; margin: 0 0 20px 0;">
                  <strong>${property_address}</strong><br>
                  ${property_city}, ${property_state}
                </p>

                <!-- Price Change -->
                <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px;">
                  <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="width: 50%; vertical-align: top;">
                        <p style="color: #6b7280; font-size: 14px; margin: 0 0 5px 0;">Previous Price</p>
                        <p style="color: #1f2937; font-size: 22px; font-weight: bold; margin: 0; text-decoration: line-through; opacity: 0.6;">${formatPrice(old_price)}</p>
                      </td>
                      <td style="width: 50%; vertical-align: top; text-align: right;">
                        <p style="color: #6b7280; font-size: 14px; margin: 0 0 5px 0;">New Price</p>
                        <p style="color: ${changeColor}; font-size: 24px; font-weight: bold; margin: 0;">${formatPrice(new_price)}</p>
                      </td>
                    </tr>
                  </table>
                </div>

                <!-- Price Change Indicator -->
                <div style="background-color: ${priceIncreased ? '#fee2e2' : '#dcfce7'}; border-left: 4px solid ${changeColor}; padding: 16px; margin: 20px 0 0 0; border-radius: 4px;">
                  <p style="color: ${changeColor}; font-size: 16px; margin: 0; font-weight: bold;">
                    ${priceIncreased ? '↑' : '↓'} Price ${changeText} by ${formatPrice(Math.abs(priceDifference))} (${Math.abs(parseFloat(percentageChange))}%)
                  </p>
                </div>
              </div>

              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                ${priceIncreased
                  ? "While the price has increased, this property might still be a great opportunity. Review the details to see if it aligns with your budget."
                  : "This is a great opportunity! The reduced price might make this property an even better fit for your budget."}
              </p>

              <div style="text-align: center; margin: 40px 0 30px 0;">
                <a href="${Deno.env.get('SITE_URL') || 'https://proprieta.com'}/properties/${property_id}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">View Property Details</a>
              </div>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <strong>Tip:</strong> Properties with price changes can attract more interest. If you're considering this property, you might want to schedule a viewing or make an offer soon.
              </p>

              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 30px 0 0 0;">
                Best regards,<br>
                <strong>The Proprieta Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                This email was sent to ${buyer_email}
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                You received this email because you favorited this property on Proprieta.
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 10px 0 0 0;">
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

    console.log(`Sending price change notification to: ${buyer_email}`);
    console.log(`Property: ${property_address}, ${property_city}, ${property_state}`);
    console.log(`Old price: ${formatPrice(old_price)}, New price: ${formatPrice(new_price)}`);

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
        to: [buyer_email],
        subject: `Price ${priceIncreased ? 'Increase' : 'Drop'} Alert: ${property_address}`,
        html: emailContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      throw new Error(data.message || 'Failed to send email via Resend');
    }

    console.log('Price change notification sent successfully via Resend:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Price change notification sent successfully",
        emailId: data.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending price change notification:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send price change notification", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});