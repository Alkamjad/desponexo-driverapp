import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const { driver_id, driver_email } = await req.json();

    if (!driver_id) {
      return Response.json({ error: 'driver_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const nowIso = new Date().toISOString();

    // Mark all unread notifications as read using service role (bypasses RLS)
    const { data, error, count } = await supabase
      .from('driver_notifications')
      .update({ read: true, read_at: nowIso })
      .eq('driver_id', driver_id)
      .eq('read', false)
      .select('id');

    if (error) {
      console.error('Supabase update error:', JSON.stringify(error));
      return Response.json({ error: error.message, details: error }, { status: 500 });
    }

    console.log(`Marked ${data?.length || 0} notifications as read for driver ${driver_id}`);

    return Response.json({ 
      success: true, 
      marked_count: data?.length || 0,
      read_at: nowIso 
    });
  } catch (error) {
    console.error('Function error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});