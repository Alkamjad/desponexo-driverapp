// Aktualisiert den Status einer Abwesenheitsanfrage (Admin-Only)
import { getCorsHeaders } from './_shared/cors.ts';
import { createAnonSupabaseClient, createServiceSupabaseClient, hasRequiredSupabaseEnv } from './_shared/supabaseAdmin.ts';

async function verifyAdminRequest(req) {
  try {
    const authHeader = req.headers.get('Authorization') || '';
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ NO BEARER TOKEN');
      return { valid: false, status: 401 };
    }
    
    const token = authHeader.replace('Bearer ', '');
    if (!hasRequiredSupabaseEnv()) {
      console.error('❌ ENV CONFIG MISSING');
      return { valid: false, status: 500 };
    }
    
    // Validiere Token via Supabase Auth
    const supabase = createAnonSupabaseClient();
    const tokenOnly = token.trim();
    
    const { data: { user }, error } = await supabase.auth.getUser(tokenOnly);
    
    if (error || !user) {
      console.error('❌ AUTH ERROR:', error?.message);
      return { valid: false, status: 401 };
    }
    
    console.log('✅ USER AUTHENTICATED:', user.id);
    
    // Hole driver_id mit SERVICE KEY
    const supabaseService = createServiceSupabaseClient();
    const { data: driver, error: driverError } = await supabaseService
      .from('drivers')
      .select('id, role')
      .eq('user_id', user.id)
      .single();
    
    if (driverError || !driver) {
      console.error('❌ DRIVER ERROR:', driverError?.message);
      return { valid: false, status: 403 };
    }
    
    // Prüfe ob User Admin-Rechte hat
    if (driver.role !== 'admin' && driver.role !== 'dispatcher') {
      console.error('❌ FORBIDDEN: User is not admin/dispatcher');
      return { valid: false, status: 403 };
    }
    
    console.log('✅ ADMIN VERIFIED:', driver.id);
    return { valid: true, driver_id: driver.id, user_id: user.id };
  } catch (error) {
    console.error('❌ VERIFY ADMIN REQUEST EXCEPTION:', error.message);
    return { valid: false, status: 401 };
  }
}

const corsHeaders = getCorsHeaders({ methods: 'POST, OPTIONS' });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'POST only' }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.valid) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - Admin access required' }),
        { status: auth.status, headers: corsHeaders }
      );
    }

    const { absence_request_id, status, admin_notes } = await req.json();

    if (!absence_request_id || !status) {
      return Response.json({ error: 'Fehlende Pflichtfelder' }, { status: 400 });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return Response.json({ error: 'Status muss approved oder rejected sein' }, { status: 400 });
    }

    const supabase = createServiceSupabaseClient();
    
    console.log('✅ Updating absence request:', absence_request_id);

    // Status aktualisieren
    const { data, error } = await supabase
      .from('absence_requests')
      .update({
        status,
        admin_notes: admin_notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', absence_request_id)
      .select()
      .single();

    if (error) {
      console.error('Supabase update error:', error);
      return Response.json({ error: 'Fehler beim Aktualisieren', details: error }, { status: 500 });
    }

    console.log(`✅ Abwesenheitsmeldung ${status}: ${absence_request_id}`);

    // Benachrichtigung an Fahrer
    const notificationTitle = status === 'approved' 
      ? '✅ Abwesenheit genehmigt' 
      : '❌ Abwesenheit abgelehnt';
    
    const notificationBody = status === 'approved'
      ? `Ihre ${data.request_type === 'krank' ? 'Krankmeldung' : 'Urlaubsantrag'} wurde genehmigt.`
      : `Ihre ${data.request_type === 'krank' ? 'Krankmeldung' : 'Urlaubsantrag'} wurde abgelehnt.`;

    try {
      await fetch(`${Deno.env.get('DRIVER_APP_DOMAIN')}/functions/saveNotification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': Deno.env.get('INTERNAL_FUNCTION_SECRET') || ''
        },
        body: JSON.stringify({
          driver_id: data.driver_id,
          driver_email: data.driver_email,
          type: `absence_request_${status}`,
          title: notificationTitle,
          message: notificationBody,
          source_data: {
            absence_request_id: data.id,
            request_type: data.request_type,
            start_date: data.requested_start_date,
            end_date: data.requested_end_date,
            status
          }
        })
      });
    } catch (notifError) {
      console.warn('⚠️ Notification failed:', notifError);
    }

    return new Response(
      JSON.stringify({ success: true, absence_request: data }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});