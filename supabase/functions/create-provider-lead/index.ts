import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  providerId: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  contactType?: 'buyer' | 'seller' | 'agent';
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const body: RequestBody = await req.json();
    const { providerId, name, email, phone, message, contactType } = body;

    if (!providerId || !name || !email || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Check if lead already exists for this email and provider
    const { data: existingLead, error: checkError } = await supabase
      .from('service_provider_leads')
      .select('id')
      .eq('service_provider_id', providerId)
      .eq('email', email)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking for existing lead:', checkError);
      console.error('Full error details:', JSON.stringify(checkError));
      console.error('Provider ID:', providerId);
      console.error('Email:', email);
      return new Response(
        JSON.stringify({
          error: 'Failed to check existing lead',
          details: checkError.message,
          code: checkError.code
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

    if (existingLead) {
      // Update existing lead
      const { error: updateError } = await supabase
        .from('service_provider_leads')
        .update({
          project_description: message,
          last_contact_date: new Date().toISOString(),
          phone: phone || null,
          contact_type: contactType || null,
        })
        .eq('id', existingLead.id);

      if (updateError) {
        console.error('Error updating lead:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update lead' }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // Log activity
      await supabase
        .from('lead_activities')
        .insert({
          lead_id: existingLead.id,
          activity_type: 'note',
          description: 'Received new inquiry from website',
          created_by: providerId,
        });

      // Send notification email to service provider
      try {
        const emailResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-lead-notification`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            },
            body: JSON.stringify({
              providerId,
              leadName: name,
              leadEmail: email,
              leadPhone: phone || null,
              message,
              isAuthenticated: false,
            }),
          }
        );

        if (!emailResponse.ok) {
          console.error('Failed to send email notification:', await emailResponse.text());
        }
      } catch (emailError) {
        console.error('Error sending email notification:', emailError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          leadId: existingLead.id,
          message: 'Lead updated successfully'
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } else {
      // Create new lead
      const { data: newLead, error: insertError } = await supabase
        .from('service_provider_leads')
        .insert({
          service_provider_id: providerId,
          name,
          email,
          phone: phone || null,
          source: 'website',
          status: 'new',
          priority: 'medium',
          project_description: message,
          last_contact_date: new Date().toISOString(),
          contact_type: contactType || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating lead:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to create lead' }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // Get provider info for potential notification
      const { data: providerProfile } = await supabase
        .from('service_provider_profiles')
        .select('business_name, business_email')
        .eq('id', providerId)
        .maybeSingle();

      // Log activity
      await supabase
        .from('lead_activities')
        .insert({
          lead_id: newLead.id,
          activity_type: 'note',
          description: 'Lead created from website inquiry',
          created_by: providerId,
        });

      // Send notification email to service provider
      try {
        const emailResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-lead-notification`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            },
            body: JSON.stringify({
              providerId,
              leadName: name,
              leadEmail: email,
              leadPhone: phone || null,
              message,
              isAuthenticated: false,
            }),
          }
        );

        if (!emailResponse.ok) {
          console.error('Failed to send email notification:', await emailResponse.text());
        }
      } catch (emailError) {
        console.error('Error sending email notification:', emailError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          leadId: newLead.id,
          message: 'Lead created successfully',
          providerName: providerProfile?.business_name
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
  } catch (error) {
    console.error('Error in create-provider-lead function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
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