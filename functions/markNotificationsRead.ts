import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import { getCorsHeaders } from './_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = getCorsHeaders({ methods: 'POST, OPTIONS' });

async function verifyRequest(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return { valid: false, status: 401, error: 'Missing or invalid Authorization header' };
    }

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return { valid: false, status: 500, error: 'Server config missing' };
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
    if (error || !user) {
      return { valid: false, status: 401, error: 'Invalid or expired token' };
    }

    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    const { data: driver, error: driverError } = await supabaseService
      .from('drivers')
      .select('id, email')
      .eq('user_id', user.id)
      .single();

    if (driverError || !driver) {
      return { valid: false, status: 403, error: 'Driver not found' };
    }

    return { valid: true, driverId: driver.id, driverEmail: driver.email };
  } catch (error) {
    return { valid: false, status: 401, error: error.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = await verifyRequest(req);
    if (!auth.valid) {
      return Response.json({ error: auth.error }, { status: auth.status, headers: corsHeaders });
    }

    const { driver_id } = await req.json();

    // Optionaler Guard: falls driver_id im Body mitgesendet wird, muss er zum Token passen
    if (driver_id && driver_id !== auth.driverId) {
      return Response.json({ error: 'Forbidden: driver mismatch' }, { status: 403, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from('driver_notifications')
      .update({ read: true, read_at: nowIso })
      .eq('driver_id', auth.driverId)
      .eq('read', false)
      .select('id');

    if (error) {
      console.error('Supabase update error:', JSON.stringify(error));
      return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }

    return Response.json({
      success: true,
      marked_count: data?.length || 0,
      read_at: nowIso,
      driver_id: auth.driverId
    }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Function error:', error.message);
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
