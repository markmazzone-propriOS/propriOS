import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing viewing reminders...');

    const { data: reminders, error: fetchError } = await supabase
      .from('viewing_reminders')
      .select(`
        *,
        calendar_events!inner(
          start_time,
          property_id,
          requestor_name,
          requestor_email,
          requestor_phone,
          status
        )
      `)
      .eq('sent', false)
      .lte('reminder_date', new Date().toISOString())
      .eq('calendar_events.status', 'confirmed')
      .gt('calendar_events.start_time', new Date().toISOString())
      .limit(100);

    if (fetchError) {
      console.error('Error fetching reminders:', fetchError);
      throw fetchError;
    }

    if (!reminders || reminders.length === 0) {
      console.log('No reminders to process');
      return new Response(
        JSON.stringify({ message: "No reminders to process", processed: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Found ${reminders.length} reminders to process`);

    let processed = 0;
    let errors = 0;

    for (const reminder of reminders) {
      try {
        const event = reminder.calendar_events;

        const { data: property } = await supabase
          .from('properties')
          .select('address_line1, city, state')
          .eq('id', event.property_id)
          .single();

        const { data: agent } = await supabase
          .from('profiles')
          .select('full_name, phone_number, email')
          .eq('id', reminder.agent_id)
          .single();

        const propertyAddress = property
          ? `${property.address_line1}, ${property.city}, ${property.state}`
          : 'Property Address';

        const startDate = new Date(event.start_time);
        const viewingTime = startDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        await supabase
          .from('activity_feed')
          .insert({
            user_id: reminder.agent_id,
            activity_type: 'viewing_reminder',
            title: 'Upcoming Viewing Reminder',
            description: `You have a property viewing with ${event.requestor_name || 'a client'} in ${reminder.reminder_days} day${reminder.reminder_days > 1 ? 's' : ''} at ${propertyAddress}`,
            related_id: reminder.event_id,
            metadata: {
              property_address: propertyAddress,
              viewing_time: viewingTime,
              reminder_days: reminder.reminder_days,
              visitor_name: event.requestor_name,
              visitor_email: event.requestor_email
            }
          });

        if (event.requestor_email) {
          const emailResponse = await fetch(
            `${supabaseUrl}/functions/v1/send-viewing-reminder`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                agentEmail: agent?.email,
                agentName: agent?.full_name || 'Your Agent',
                agentPhone: agent?.phone_number,
                visitorEmail: event.requestor_email,
                visitorName: event.requestor_name || 'Valued Client',
                propertyAddress: propertyAddress,
                viewingTime: viewingTime,
                reminderDays: reminder.reminder_days
              }),
            }
          );

          if (!emailResponse.ok) {
            console.error(`Failed to send email for reminder ${reminder.id}`);
          }
        }

        await supabase
          .from('viewing_reminders')
          .update({ sent: true, sent_at: new Date().toISOString() })
          .eq('id', reminder.id);

        processed++;
        console.log(`Processed reminder ${reminder.id}`);

      } catch (error) {
        console.error(`Error processing reminder ${reminder.id}:`, error);
        errors++;
      }
    }

    console.log(`Processed ${processed} reminders with ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processed} reminders`,
        processed,
        errors
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing reminders:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process reminders", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
