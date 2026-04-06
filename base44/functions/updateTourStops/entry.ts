import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
// deploy v2

async function verifyRequest(req) {
  try {
    const supabaseToken = req.headers.get('x-supabase-auth');
    const authHeader = req.headers.get('Authorization') || '';
    const token = supabaseToken || (authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : null);
    if (!token) {
      console.error('❌ NO AUTH TOKEN');
      return { valid: false, status: 401 };
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
      console.error('❌ ENV CONFIG MISSING');
      return { valid: false, status: 500 };
    }
    
    // Validiere Token
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const tokenOnly = token.trim();
    const { data: { user }, error } = await supabase.auth.getUser(tokenOnly);
    
    if (error || !user) {
      console.error('❌ AUTH ERROR:', error?.message);
      return { valid: false, status: 401 };
    }
    
    // Hole driver_id
    const supabaseService = createClient(supabaseUrl, serviceKey);
    const { data: driver, error: driverError } = await supabaseService
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    if (driverError || !driver) {
      console.error('❌ DRIVER ERROR:', driverError?.message);
      return { valid: false, status: 403 };
    }
    
    return { valid: true, driver_id: driver.id, user_id: user.id };
  } catch (error) {
    console.error('❌ VERIFY REQUEST EXCEPTION:', error.message);
    return { valid: false, status: 401 };
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://desponexodriver.app',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-supabase-auth, x-client-request-id',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const auth = await verifyRequest(req);
    if (!auth.valid) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: auth.status, headers: corsHeaders }
      );
    }

    const { tour_id, stops } = await req.json();

    if (!tour_id || !stops) {
      return new Response(
        JSON.stringify({ success: false, error: 'tour_id und stops erforderlich' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Supabase Config fehlt' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Hole Tour um Status zu prüfen
    const { data: tour, error: tourError } = await supabase
      .from('tours')
      .select('*')
      .eq('id', tour_id)
      .single();

    if (tourError || !tour) {
      return Response.json(
        { success: false, error: 'Tour nicht gefunden' },
        { status: 404, headers: corsHeaders }
      );
    }

    // WICHTIG: Prüfe ob ALLE Stops abgeschlossen UND dokumentiert sind
    const allStopsCompleted = stops.every(stop => {
      const statusOk = stop.status === 'zugestellt' || stop.status === 'problem';
      
      // Wenn Stop Dokumentation braucht, muss diese vorhanden sein
      // ABER: Bei "problem"-Stops gilt KEINE Doku-Pflicht
      const hasRequirements = stop.documentation_requirements && 
                             Object.keys(stop.documentation_requirements).length > 0;
      const isDocumented = hasRequirements 
        ? (stop.status === 'problem' ? true : !!stop.documentation_completed)
        : true;
      
      return statusOk && isDocumented;
    });

    // Update-Daten vorbereiten
    const updateData = { 
      stops: stops,
      updated_at: new Date().toISOString()
    };

    // Dokumentation speichern wenn alle Stops fertig
    if (allStopsCompleted) {
      updateData.documentation_completed = {
        all_stops_documented: true,
        completed_at: new Date().toISOString()
      };
    }

    // Update mit Service Role (bypassed RLS)
    const { data, error } = await supabase
      .from('tours')
      .update(updateData)
      .eq('id', tour_id)
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ success: true, tour: data }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('💥 Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});