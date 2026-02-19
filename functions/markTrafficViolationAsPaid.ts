import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import { getCorsHeaders } from './_shared/cors.ts';

async function verifyRequest(req) {
  try {
    const authHeader = req.headers.get('Authorization') || '';
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ NO BEARER TOKEN');
      return { valid: false, status: 401 };
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
      console.error('❌ ENV CONFIG MISSING');
      return { valid: false, status: 500 };
    }
    
    // Validiere Token via Supabase Auth
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const tokenOnly = token.trim();
    
    const { data: { user }, error } = await supabase.auth.getUser(tokenOnly);
    
    if (error || !user) {
      console.error('❌ AUTH ERROR');
      return { valid: false, status: 401 };
    }
    
    console.log('✅ USER AUTHENTICATED:', user.id);
    
    // Hole driver_id mit SERVICE KEY
    const supabaseService = createClient(supabaseUrl, serviceKey);
    const { data: driver, error: driverError } = await supabaseService
      .from('drivers')
      .select('id, company_id')
      .eq('user_id', user.id)
      .single();
    
    if (driverError || !driver) {
      console.error('❌ DRIVER NOT FOUND');
      return { valid: false, status: 403 };
    }
    
    console.log('✅ DRIVER FOUND:', driver.id);
    return { valid: true, driver, user_id: user.id };
  } catch (error) {
    console.error('❌ VERIFY REQUEST EXCEPTION:', error.message);
    return { valid: false, status: 401 };
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders({ methods: 'POST, OPTIONS' });
  const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Auth prüfen
    const auth = await verifyRequest(req);
    if (!auth.valid) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: auth.status, headers: corsHeaders }
      );
    }

    const driver = auth.driver;
    const { violation_id } = await req.json();

    if (!violation_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Violation ID erforderlich' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('✅ Marking violation as paid:', violation_id);

    // Update mit Service Key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseService = createClient(supabaseUrl, serviceKey);

    // Prüfe ob Violation zum Fahrer gehört
    const { data: violation, error: fetchError } = await supabaseService
      .from('traffic_violations')
      .select('id, driver_id, status')
      .eq('id', violation_id)
      .eq('driver_id', driver.id)
      .single();

    if (fetchError || !violation) {
      console.error('❌ Violation not found or access denied');
      return new Response(
        JSON.stringify({ success: false, error: 'Strafzettel nicht gefunden oder Zugriff verweigert' }),
        { status: 403, headers: corsHeaders }
      );
    }

    if (violation.status !== 'OPEN') {
      return new Response(
        JSON.stringify({ success: false, error: 'Strafzettel ist bereits bezahlt oder storniert' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Update auf PAID
    const { error: updateError } = await supabaseService
      .from('traffic_violations')
      .update({
        status: 'PAID',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', violation_id);

    if (updateError) {
      console.error('❌ Update error:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: updateError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log('✅ Violation marked as paid');

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('💥 markTrafficViolationAsPaid error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});