import { createClient } from 'npm:@supabase/supabase-js@2';
// deployed

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://desponexodriver.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-supabase-auth, x-client-request-id',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
};

async function requireUser(req) {
  try {
    const supabaseToken = req.headers.get('x-supabase-auth');
    const authHeader = req.headers.get('Authorization') || '';
    const token = supabaseToken || (authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : null);
    if (!token) {
      return { valid: false, status: 401, error: 'Missing auth token' };
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
      return { valid: false, status: 500, error: 'Server config missing' };
    }
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.error('❌ AUTH ERROR:', error?.message);
      return { valid: false, status: 401, error: 'Invalid or expired token' };
    }
    const supabaseService = createClient(supabaseUrl, serviceKey);
    const { data: driver, error: driverError } = await supabaseService
      .from('drivers')
      .select('id, email')
      .eq('user_id', user.id)
      .single();
    if (driverError || !driver) {
      console.error('❌ DRIVER ERROR:', driverError?.message);
      return { valid: false, status: 403, error: 'Driver not found' };
    }
    console.log('✅ User authenticated:', { user_id: user.id, driver_id: driver.id });
    return { valid: true, driver_id: driver.id, user_id: user.id, driver_email: driver.email };
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

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase Umgebungsvariablen nicht gesetzt');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    
    const {
      tour_id,
      liters,
      amount,
      payment_method = 'eigenes_geld',
      mileage,
      receipt_photo_url,
      vehicle_confirmed
    } = body;

    const driver_id = auth.driver_id;
    const driver_email = auth.driver_email;
    console.log('🚀 submitFuelReport gestartet:', { tour_id, driver_id, driver_email, liters, amount });

    // VALIDIERUNG
    const errors = [];
    if (!tour_id) errors.push('tour_id fehlt');
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

    // 1. TOUR FINDEN (versuche beide IDs)
    let tourAssignment = null;
    let searchMethod = '';
    
    // Versuche zuerst mit UUID (wenn es wie eine UUID aussieht)
    if (tour_id.includes('-')) {
      const { data, error } = await supabase
        .from('tours')
        .select('id, driver_id, company_id, license_plate, tour_id')
        .eq('id', tour_id)
        .maybeSingle();
      
      if (!error && data) {
        tourAssignment = data;
        searchMethod = 'uuid';
      }
    }
    
    // Wenn nicht gefunden, versuche mit tour_id
    if (!tourAssignment) {
      const { data, error } = await supabase
        .from('tours')
        .select('id, driver_id, company_id, license_plate, tour_id')
        .eq('tour_id', tour_id)
        .maybeSingle();
      
      if (!error && data) {
        tourAssignment = data;
        searchMethod = 'tour_id';
      }
    }

    if (!tourAssignment) {
      console.error('❌ Tour nicht gefunden:', { tour_id, searchMethod });
      return Response.json({
        success: false,
        error: `Tour nicht gefunden (${tour_id})`,
        searched_as: searchMethod
      }, { status: 404, headers: corsHeaders });
    }

    // Verify driver owns this tour
    if (tourAssignment.driver_id !== driver_id) {
      console.error('❌ Authorization failed:', { tour_driver_id: tourAssignment.driver_id, auth_driver_id: driver_id });
      return Response.json({
        success: false,
        error: 'Nicht berechtigt für diese Tour'
      }, { status: 403, headers: corsHeaders });
    }

    console.log('✅ Tour gefunden:', {
      id: tourAssignment.id,
      tour_id: tourAssignment.tour_id,
      gefunden_mit: searchMethod
    });

    // 2. EXISTIERENDEN FUEL_REPORT SUCHEN
    const { data: existingReport } = await supabase
      .from('fuel_reports')
      .select('id')
      .eq('tour_id', tourAssignment.tour_id)
      .eq('driver_id', tourAssignment.driver_id)
      .maybeSingle();

    let fuelReportId;
    let action = '';

    if (existingReport) {
      // UPDATE
      const { data: updatedReport, error: updateError } = await supabase
        .from('fuel_reports')
        .update({
          liters: parseFloat(liters),
          amount: parseFloat(amount),
          payment_method: payment_method,
          mileage: parseInt(mileage),
          receipt_photo_url: receipt_photo_url,
          vehicle_confirmed: Boolean(vehicle_confirmed),
          status: 'eingereicht',
          submitted_at: new Date().toISOString()
        })
        .eq('id', existingReport.id)
        .select()
        .single();

      if (updateError) throw updateError;
      
      fuelReportId = existingReport.id;
      action = 'updated';
      
      // 🔴 WICHTIG: Setze fuel_report_status in tours
      await supabase
        .from('tours')
        .update({ 
          fuel_report_id: fuelReportId,
          fuel_report_status: 'eingereicht'
        })
        .eq('id', tourAssignment.id);
    } else {
      // INSERT
      const { data: newReport, error: insertError } = await supabase
        .from('fuel_reports')
        .insert({
          company_id: tourAssignment.company_id,
          tour_id: tourAssignment.tour_id,
          driver_id: driver_id,
          driver_email: driver_email,
          license_plate: tourAssignment.license_plate || '',
          vehicle_confirmed: Boolean(vehicle_confirmed),
          liters: parseFloat(liters),
          amount: parseFloat(amount),
          payment_method: payment_method,
          mileage: parseInt(mileage),
          receipt_photo_url: receipt_photo_url,
          status: 'eingereicht',
          submitted_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) throw insertError;
      
      fuelReportId = newReport.id;
      action = 'created';
      
      // 🔴 WICHTIG: Setze fuel_report_status in tours
      await supabase
        .from('tours')
        .update({ 
          fuel_report_id: fuelReportId,
          fuel_report_status: 'eingereicht'
        })
        .eq('id', tourAssignment.id);
    }

    console.log('✅ Fuel report gespeichert und Tour aktualisiert:', {
      fuelReportId,
      action,
      tourId: tourAssignment.id
    });

    return Response.json({
      success: true,
      fuel_report_id: fuelReportId,
      action: action,
      message: `Tankbeleg erfolgreich ${action === 'created' ? 'eingereicht' : 'aktualisiert'}`
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('💥 submitFuelReport error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500, headers: corsHeaders });
  }
});