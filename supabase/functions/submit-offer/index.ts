import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OfferRequest {
  property_id: string;
  offer_amount: number;
  financing_type: string;
  closing_date: string;
  message?: string;
  contingencies?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    console.log('Starting offer submission');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Getting user from token');
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError) {
      console.error('Auth error:', authError);
      throw new Error(`Auth error: ${authError.message}`);
    }

    if (!user) {
      throw new Error('No user found');
    }

    console.log('User authenticated:', user.id);

    const offerData: OfferRequest = await req.json();
    console.log('Offer data:', offerData);

    console.log('Calling RPC function with params:', {
      p_property_id: offerData.property_id,
      p_buyer_id: user.id,
      p_offer_amount: offerData.offer_amount,
      p_financing_type: offerData.financing_type,
      p_closing_date: offerData.closing_date
    });

    const { data: offer, error: offerError } = await supabase.rpc('create_offer_without_trigger', {
      p_property_id: offerData.property_id,
      p_buyer_id: user.id,
      p_offer_amount: offerData.offer_amount,
      p_financing_type: offerData.financing_type,
      p_closing_date: offerData.closing_date,
      p_message: offerData.message?.trim() || null,
      p_contingencies: offerData.contingencies?.trim() || null
    });

    console.log('RPC response:', { data: offer, error: offerError });

    if (offerError) {
      console.error('RPC error details:', JSON.stringify(offerError, null, 2));
      throw new Error(`RPC error: ${offerError.message || JSON.stringify(offerError)}`);
    }

    console.log('Offer created successfully:', offer);

    // Get property and user details for notification
    const { data: property } = await supabase
      .from('properties')
      .select('agent_id, address_line1, city, state, zip_code')
      .eq('id', offerData.property_id)
      .single();

    if (property && property.agent_id) {
      // Get agent details
      const { data: agent } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', property.agent_id)
        .single();

      const { data: agentUser } = await supabase.auth.admin.getUserById(property.agent_id);

      // Get buyer details
      const { data: buyer } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (agentUser && agent && buyer) {
        // Construct full address
        const propertyAddress = `${property.address_line1}, ${property.city}, ${property.state} ${property.zip_code}`;

        // Send notification email
        try {
          const notificationResponse = await fetch(
            `${supabaseUrl}/functions/v1/send-offer-notification`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                agent_email: agentUser.user.email,
                agent_name: agent.full_name,
                buyer_name: buyer.full_name,
                property_address: propertyAddress,
                offer_amount: offerData.offer_amount,
                property_id: offerData.property_id,
              }),
            }
          );

          if (!notificationResponse.ok) {
            console.error('Failed to send notification email:', await notificationResponse.text());
          } else {
            console.log('Notification email sent successfully');
          }
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
          // Don't fail the offer submission if notification fails
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, offer }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error submitting offer:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
