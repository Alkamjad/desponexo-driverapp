import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-supabase-auth, x-client-request-id, apikey',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Auth
    const supabaseToken = req.headers.get('x-supabase-auth');
    const authHeader = req.headers.get('Authorization') || '';
    const token = supabaseToken || (authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : null);
    
    if (!token) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    // Parse body early (needed for fallback driver_id)
    const body = await req.json();
    const { tour_id, problem_type, beschreibung, foto_url, driver_id: bodyDriverId } = body;

    if (!problem_type || !beschreibung) {
      return Response.json({ success: false, error: 'Missing required fields: problem_type, beschreibung' }, { status: 400, headers: corsHeaders });
    }

    // Get driver - try user_id first, fallback to email
    let driver = null;
    
    const { data: driverByUserId } = await supabase
      .from('drivers')
      .select('id, email, full_name, company_id')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (driverByUserId) {
      driver = driverByUserId;
    } else if (user.email) {
      const { data: driverByEmail } = await supabase
        .from('drivers')
        .select('id, email, full_name, company_id')
        .eq('email', user.email)
        .maybeSingle();
      driver = driverByEmail;
    }

    // Fallback: look up by driver_id from payload (user already authenticated above)
    if (!driver && bodyDriverId) {
      const { data: driverById } = await supabase
        .from('drivers')
        .select('id, email, full_name, company_id')
        .eq('id', bodyDriverId)
        .maybeSingle();
      driver = driverById;
    }

    if (!driver) {
      console.error('Driver not found - user_id:', user.id, 'email:', user.email, 'bodyDriverId:', bodyDriverId);
      return Response.json({ success: false, error: 'Driver not found - contact support' }, { status: 403, headers: corsHeaders });
    }

    // Validate problem_type against DB constraint
    const validTypes = [
      'fahrzeug_panne', 'unfall', 'stau_verspaetung', 'kunde_nicht_erreichbar',
      'falsche_adresse', 'ladungsschaden', 'kunde_verweigert', 'sonstiges'
    ];
    
    const mappedType = validTypes.includes(problem_type) ? problem_type : 'sonstiges';

    const now = new Date().toISOString();

    // Insert into problem_reports
    const { data: report, error: insertError } = await supabase
      .from('problem_reports')
      .insert({
        company_id: driver.company_id,
        tour_id: tour_id || null,
        driver_id: driver.id,
        driver_email: driver.email,
        driver_name: driver.full_name,
        problem_type: mappedType,
        beschreibung: beschreibung,
        foto_url: foto_url || null,
        status: 'offen',
        reported_at: now,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Insert error:', insertError);
      return Response.json({ success: false, error: insertError.message }, { status: 500, headers: corsHeaders });
    }

    console.log('✅ Problem report created:', report.id);

    return Response.json({ success: true, report }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('submitProblemReport error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
});