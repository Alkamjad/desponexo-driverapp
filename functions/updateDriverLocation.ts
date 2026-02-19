import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from './_shared/cors.ts';

const corsHeaders = getCorsHeaders({ methods: 'POST, OPTIONS' });

async function requireUser(req) {
  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { valid: false, status: 401, error: 'Missing or invalid Authorization header' };
    }
    const token = authHeader.replace('Bearer ', '').trim();
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
      return { valid: false, status: 500, error: 'Server config missing' };
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.error('❌ AUTH ERROR:', error?.message);
      return { valid: false, status: 401, error: 'Invalid or expired token' };
    }
    const supabaseService = createClient(supabaseUrl, serviceKey);
    const { data: driver, error: driverError } = await supabaseService
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (driverError || !driver) {
      console.error('❌ DRIVER ERROR:', driverError?.message);
      return { valid: false, status: 403, error: 'Driver not found' };
    }
    console.log('✅ User authenticated:', { user_id: user.id, driver_id: driver.id });
    return { valid: true, driver_id: driver.id, user_id: user.id };
  } catch (error) {
    console.error('❌ VERIFY REQUEST EXCEPTION:', error.message);
    return { valid: false, status: 401, error: error.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const auth = await requireUser(req);
    if (!auth.valid) {
      return Response.json({ success: false, error: auth.error }, { status: auth.status, headers: corsHeaders });
    }

    const body = await req.json();
    const { tour_id, latitude, longitude, accuracy, speed, heading } = body;

    console.log('📍 updateDriverLocation called:', { driver_id: auth.driver_id, tour_id, latitude, longitude, accuracy });

    if (latitude === undefined || longitude === undefined) {
      return Response.json(
        { success: false, error: 'latitude und longitude sind erforderlich' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return Response.json(
        { success: false, error: 'Server-Konfiguration fehlt' },
        { status: 500, headers: corsHeaders }
      );
    }
    
    console.log('📍 Location update - driver_id:', auth.driver_id, 'location:', { latitude, longitude, accuracy });

    const locationData = {
      driver_id: auth.driver_id,
      latitude: latitude,
      longitude: longitude,
      accuracy: accuracy || null,
      speed: speed || null,
      heading: heading || null,
      updated_at: new Date().toISOString()
    };

    // Upsert in driver_locations Tabelle
    const supabaseService = createClient(supabaseUrl, serviceKey);
    const { error: locationError } = await supabaseService
      .from('driver_locations')
      .upsert(locationData, { onConflict: 'driver_id' });

    if (locationError) {
      console.error('Location update failed:', locationError);
    }

    // Wenn eine aktive Tour existiert, auch deren current_location updaten
    if (tour_id) {
      const tourLocationData = {
        current_location: {
          latitude,
          longitude,
          accuracy,
          speed,
          heading,
          timestamp: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      };

      console.log('🚚 Updating tour location:', { tour_id, location: tourLocationData.current_location });

      const { data: updatedTour, error: tourError } = await supabaseService
        .from('tours')
        .update(tourLocationData)
        .eq('id', tour_id)
        .select();

      if (!tourError && updatedTour) {
        console.log('✅ Tour location updated:', updatedTour);
      } else {
        console.error('❌ Tour location update failed:', tourError?.message);
      }
    }

    return Response.json(
      { success: true, message: 'Standort aktualisiert' },
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('updateDriverLocation error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
});