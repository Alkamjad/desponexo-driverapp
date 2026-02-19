import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import { getCorsHeaders } from './_shared/cors.ts';

const corsHeaders = getCorsHeaders({ methods: 'POST, OPTIONS' });
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
};

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
      .select('id, company_id, email')
      .eq('user_id', user.id)
      .single();
    if (driverError || !driver) {
      console.error('❌ DRIVER ERROR:', driverError?.message);
      return { valid: false, status: 403, error: 'Driver not found' };
    }
    console.log('✅ User authenticated:', { user_id: user.id, driver_id: driver.id });
    return { valid: true, driver_id: driver.id, user_id: user.id, company_id: driver.company_id, driver_email: driver.email };
  } catch (error) {
    console.error('❌ VERIFY REQUEST EXCEPTION:', error.message);
    return { valid: false, status: 401, error: error.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'POST only' }, { status: 405, headers: corsHeaders });
  }

  try {
    const auth = await requireUser(req);
    if (!auth.valid) {
      return Response.json({ error: auth.error }, { status: auth.status, headers: corsHeaders });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const { 
      request_type, 
      requested_start_date, 
      requested_end_date, 
      notes 
    } = await req.json();

    // Validierung
    if (!request_type || !requested_start_date || !requested_end_date) {
      return Response.json({ 
        error: 'Fehlende Pflichtfelder' 
      }, { status: 400, headers: corsHeaders });
    }

    if (!['urlaub', 'krank'].includes(request_type)) {
      return Response.json({ 
        error: 'Ungültiger request_type. Nur "urlaub" oder "krank" erlaubt.' 
      }, { status: 400, headers: corsHeaders });
    }

    // Datums-Validierung
    const startDate = new Date(requested_start_date);
    const endDate = new Date(requested_end_date);
    
    if (endDate < startDate) {
      return Response.json({ 
        error: 'Enddatum muss nach Startdatum liegen' 
      }, { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Eintrag in absence_requests erstellen - nutze auth-Daten
    const { data, error } = await supabase
      .from('absence_requests')
      .insert([{
        company_id: auth.company_id,
        driver_id: auth.driver_id,
        driver_email: auth.driver_email,
        request_type,
        requested_start_date,
        requested_end_date,
        notes: notes || null,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return Response.json({ 
        error: 'Fehler beim Speichern der Abwesenheitsmeldung',
        details: error 
      }, { status: 500, headers: corsHeaders });
    }

    console.log(`✅ Abwesenheitsmeldung erstellt: ${request_type} für ${auth.driver_email}`);

    // Benachrichtigung an Fahrer senden
    const notificationTitle = request_type === 'krank' ? '🏥 Krankmeldung eingereicht' : '🏖️ Urlaubsantrag eingereicht';
    const notificationBody = `Ihre ${request_type === 'krank' ? 'Krankmeldung' : 'Urlaubsantrag'} wurde an die Disposition gesendet und wird geprüft.`;

    try {
      await fetch(`${Deno.env.get('DRIVER_APP_DOMAIN')}/functions/saveNotification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: auth.driver_id,
          driver_email: auth.driver_email,
          type: 'absence_request_created',
          title: notificationTitle,
          message: notificationBody,
          source_data: {
            absence_request_id: data.id,
            request_type,
            start_date: requested_start_date,
            end_date: requested_end_date
          }
        })
      });
    } catch (notifError) {
      console.warn('⚠️ Notification failed:', notifError);
    }

    return Response.json({ 
      success: true,
      absence_request: data
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Function error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500, headers: corsHeaders });
  }
});