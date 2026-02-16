import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  lenderId: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  contactType?: 'buyer' | 'seller' | 'refinancing';
  loanAmount?: string;
  propertyType?: string;
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
    const { lenderId, name, email, phone, message, contactType, loanAmount, propertyType } = body;

    if (!lenderId || !name || !email || !message) {
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

    const leadNotes = `Contact Type: ${contactType || 'unspecified'}\n${message}${loanAmount ? `\nLoan Amount: $${loanAmount}` : ''}${propertyType ? `\nProperty Type: ${propertyType}` : ''}`;

    const { data: existingLead, error: checkError } = await supabase
      .from('lender_leads')
      .select('id')
      .eq('lender_id', lenderId)
      .eq('email', email)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking for existing lead:', checkError);
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
      const { error: updateError } = await supabase
        .from('lender_leads')
        .update({
          notes: leadNotes,
          contacted_at: new Date().toISOString(),
          phone: phone || null,
          contact_type: contactType || null,
          property_type: propertyType || null,
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
              lenderId,
              leadName: name,
              leadEmail: email,
              leadPhone: phone || null,
              message: leadNotes,
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
      const { data: newLead, error: insertError } = await supabase
        .from('lender_leads')
        .insert({
          lender_id: lenderId,
          name,
          email,
          phone: phone || null,
          lead_source: 'website',
          status: 'new',
          notes: leadNotes,
          contact_type: contactType || null,
          property_type: propertyType || null,
          priority: 'medium',
          contacted_at: new Date().toISOString(),
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

      const { data: lenderProfile } = await supabase
        .from('mortgage_lender_profiles')
        .select('company_name, email')
        .eq('id', lenderId)
        .maybeSingle();

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
              lenderId,
              leadName: name,
              leadEmail: email,
              leadPhone: phone || null,
              message: leadNotes,
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
          lenderName: lenderProfile?.company_name
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
    console.error('Error in create-lender-lead function:', error);
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