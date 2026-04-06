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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase Umgebungsvariablen nicht gesetzt');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    
    const {
      liters,
      amount,
      payment_method = 'eigenes_geld',
      mileage,
      receipt_photo_url,
      vehicle_confirmed,
      fuel_report_id
    } = body;

    console.log('🚀 updateFuelReport gestartet:', { fuel_report_id, liters, amount });

    // VALIDIERUNG
    const errors = [];
    if (!fuel_report_id) errors.push('fuel_report_id fehlt');
    if (!liters || liters <= 0) errors.push('Liter ungültig');
    if (!amount || amount <= 0) errors.push('Betrag ungültig');
    if (!mileage || mileage <= 0) errors.push('KM-Stand ungültig');
    if (!vehicle_confirmed) errors.push('Fahrzeug nicht bestätigt');

    if (errors.length > 0) {
      return Response.json({ 
        success: false, 
        error: errors.join(', ') 
      }, { status: 400, headers: corsHeaders });
    }

    // 🔴 SECURITY: Verify driver owns this fuel report
    const { data: fuelReport, error: fetchError } = await supabase
      .from('fuel_reports')
      .select('id, driver_id')
      .eq('id', fuel_report_id)
      .single();

    if (fetchError || !fuelReport) {
      console.error('❌ Fuel report not found:', fuel_report_id);
      return Response.json({ 
        success: false, 
        error: 'Tankbeleg nicht gefunden' 
      }, { status: 404, headers: corsHeaders });
    }

    if (fuelReport.driver_id !== auth.driver_id) {
      console.error('❌ Authorization failed: driver mismatch', { 
        fuel_report_driver: fuelReport.driver_id, 
        auth_driver: auth.driver_id 
      });
      return Response.json({ 
        success: false, 
        error: 'Zugriff verweigert' 
      }, { status: 403, headers: corsHeaders });
    }

    // UPDATE FUEL REPORT
    const { data: updatedReport, error: updateError } = await supabase
      .from('fuel_reports')
      .update({
        liters: parseFloat(liters),
        amount: parseFloat(amount),
        payment_method: payment_method,
        mileage: parseInt(mileage),
        receipt_photo_url: receipt_photo_url || null,
        vehicle_confirmed: Boolean(vehicle_confirmed),
        status: 'eingereicht',
        submitted_at: new Date().toISOString()
      })
      .eq('id', fuel_report_id)
      .select()
      .single();

    if (updateError) throw updateError;

    console.log('✅ Fuel report aktualisiert:', {
      fuelReportId: fuel_report_id,
      liters,
      amount,
      driver_id: auth.driver_id
    });

    return Response.json({
      success: true,
      fuel_report_id: fuel_report_id,
      message: 'Tankbeleg erfolgreich aktualisiert'
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('💥 updateFuelReport error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500, headers: corsHeaders });
  }
});