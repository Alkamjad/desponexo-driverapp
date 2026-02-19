import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import { getCorsHeaders } from './_shared/cors.ts';

async function verifyRequest(req) {
  try {
    const authHeader = req.headers.get('Authorization');
    console.log('🔐 AUTH DEBUG - Header prefix:', authHeader ? authHeader.slice(0, 20) : 'MISSING');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ NO BEARER TOKEN');
      return { valid: false, status: 401 };
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Supabase Client mit ANON KEY
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
      console.error('❌ ENV CONFIG MISSING');
      return { valid: false, status: 500 };
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const tokenOnly = token.trim();
    
    console.log('🔐 AUTH DEBUG - Token length:', tokenOnly.length);
    
    // Validiere Token und hole User - EXPLIZIT mit Token parameter
    const { data: { user }, error } = await supabase.auth.getUser(tokenOnly);
    
    console.log('🔐 AUTH DEBUG - User lookup result:', { 
      hasUser: !!user,
      error: error?.message,
      userId: user?.id 
    });
    
    if (error || !user) {
      console.error('❌ AUTH ERROR:', error?.message);
      return { valid: false, status: 401 };
    }
    
    console.log('🔐 AUTH DEBUG - Looking up driver for user:', user.id);
    
    // Hole driver_id mit SERVICE KEY (nicht mit Auth Client)
    const supabaseService = createClient(supabaseUrl, serviceKey);
    const { data: driver, error: driverError } = await supabaseService
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    console.log('🔐 AUTH DEBUG - Driver lookup result:', {
      hasDriver: !!driver,
      driverId: driver?.id,
      error: driverError?.message
    });
    
    if (driverError || !driver) {
      console.error('❌ DRIVER ERROR:', driverError?.message);
      return { valid: false, status: 403 };
    }
    
    console.log('✅ AUTH SUCCESS - Driver verified:', driver.id);
    return { valid: true, driver_id: driver.id, user_id: user.id };
  } catch (error) {
    console.error('❌ VERIFY REQUEST EXCEPTION:', error.message);
    return { valid: false, status: 401 };
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders({ methods: 'GET, POST, OPTIONS' });

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

    const body = await req.json();
    const { tour_id, documentation_completed } = body;

    if (!tour_id || !documentation_completed) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const driver_id = auth.driver_id;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server-Konfiguration fehlt' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Prüfen ob Tour diesem Fahrer gehört
    console.log('🔍 Checking tour:', { tour_id, driver_id });
    
    const supabaseService = createClient(supabaseUrl, serviceKey);
    const { data: tourCheck, error: tourCheckError } = await supabaseService
      .from('tours')
      .select('id, driver_id, status, documentation_requirements')
      .eq('id', tour_id)
      .eq('driver_id', driver_id)
      .single();

    if (tourCheckError || !tourCheck) {
      console.error('❌ Tour check failed:', { 
        tour_id, 
        driver_id, 
        error: tourCheckError?.message 
      });
      return new Response(
        JSON.stringify({ success: false, error: tourCheckError?.message || 'Tour nicht gefunden oder nicht autorisiert' }),
        { status: tourCheckError?.code === 'PGRST116' ? 403 : 500, headers: corsHeaders }
      );
    }

    const existingTour = tourCheck;
    const now = new Date().toISOString();

    // Update-Daten: Setze documentation_status auf 'completed' und requirements auf null
    const updateData = {
      documentation_completed: documentation_completed,
      documentation_status: 'completed',
      documentation_requirements: null,
      updated_at: now
    };

    console.log('📋 Uploading documentation:', {
      tour_id,
      has_signature: !!documentation_completed.signature,
      photo_count: documentation_completed.photos?.length || 0,
      has_condition_report: !!documentation_completed.condition_report
    });

    const { data: updatedTour, error: updateError } = await supabaseService
      .from('tours')
      .update(updateData)
      .eq('id', tour_id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Documentation upload failed:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Internal server error' }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log('✅ Documentation uploaded:', {
      tour_id,
      documentation_status: updatedTour.documentation_status,
      documentation_requirements_cleared: updatedTour.documentation_requirements === null
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Dokumentation erfolgreich hochgeladen',
        tour: updatedTour
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('uploadTourDocumentation error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});