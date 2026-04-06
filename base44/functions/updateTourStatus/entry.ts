import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

function createServiceSupabaseClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, serviceRoleKey);
}

function createAnonSupabaseClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  return createClient(url, anonKey);
}

async function verifyRequest(req) {
  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ NO BEARER TOKEN');
      return { valid: false, status: 401 };
    }
    
    const token = authHeader.replace('Bearer ', '').trim();
    
    const supabase = createAnonSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error('❌ AUTH ERROR:', error?.message);
      return { valid: false, status: 401 };
    }
    
    console.log('✅ USER AUTHENTICATED:', user.id);
    
    const supabaseService = createServiceSupabaseClient();
    const { data: driver, error: driverError } = await supabaseService
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    if (driverError || !driver) {
      console.error('❌ DRIVER ERROR:', driverError?.message);
      return { valid: false, status: 403 };
    }
    
    console.log('✅ DRIVER FOUND:', driver.id);
    return { valid: true, driver_id: driver.id, user_id: user.id };
  } catch (error) {
    console.error('❌ VERIFY REQUEST EXCEPTION:', error.message);
    return { valid: false, status: 401 };
  }
}

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

    const body = await req.json();
    const { tour_id, status, location, pieces_delivered, signature_url, photo_url, notes, documentation_completed, documentation_status } = body;

    if (!tour_id || !status) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const driver_id = auth.driver_id;
    const supabase = createServiceSupabaseClient();
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // 1. Tour prüfen - Tabelle heißt "tours"
    console.log('🔍 Checking tour in tours table:', { tour_id, driver_id });
    
    const { data: existingTour, error: tourCheckError } = await supabase
      .from('tours')
      .select('id, driver_id, status, compensation_rate, compensation_type, documentation_requirements, documentation_status, license_plate')
      .eq('id', tour_id)
      .eq('driver_id', driver_id)
      .single();

    console.log('📋 Tour check result:', existingTour, 'Error:', tourCheckError);
    
    if (tourCheckError || !existingTour) {
      console.error('❌ Tour not found:', { tour_id, driver_id, error: tourCheckError });
      return new Response(
        JSON.stringify({ success: false, error: 'Tour nicht gefunden oder nicht autorisiert' }),
        { status: 403, headers: corsHeaders }
      );
    }

    const currentStatus = existingTour.status;

    // 2. STATUS-STATE-MACHINE
    const ALLOWED_TRANSITIONS = {
      'assigned': ['confirmed'],
      'confirmed': ['picked_up'],
      'picked_up': ['delivered'],
      'delivered': ['completed'],
      'completed': []
    };

    const allowedNextStates = ALLOWED_TRANSITIONS[currentStatus] || [];
    
    if (!allowedNextStates.includes(status)) {
      console.error('❌ Invalid status transition:', { current: currentStatus, requested: status });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'INVALID_STATUS_TRANSITION',
          message: `Invalid status transition: ${currentStatus} -> ${status}`,
          current_status: currentStatus,
          requested_status: status,
          allowed_transitions: allowedNextStates
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const now = new Date().toISOString();
    const updateData = { status, updated_at: now };

    if (status === 'confirmed') updateData.confirmed_at = now;
    if (status === 'in_progress') updateData.started_at = now;
    
    if (status === 'picked_up') {
      updateData.picked_up_at = now;
      updateData.started_at = now;
      updateData.gps_tracking_active = true;
      
      if (existingTour.documentation_requirements && 
          (!existingTour.documentation_status || existingTour.documentation_status === 'not_required')) {
        updateData.documentation_status = 'pending';
      }
      
      // Driver Status updaten
      try {
        await fetch(`${supabaseUrl}/rest/v1/drivers?id=eq.${driver_id}`, {
          method: 'PATCH',
          headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'unterwegs', updated_at: now })
        });
      } catch (e) { console.warn('⚠️ Failed to update driver status:', e); }
      
      // Vehicle Status updaten
      if (existingTour.license_plate) {
        try {
          await fetch(`${supabaseUrl}/rest/v1/vehicles?license_plate=eq.${existingTour.license_plate}`, {
            method: 'PATCH',
            headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'unterwegs', updated_at: now })
          });
        } catch (e) { console.warn('⚠️ Failed to update vehicle status:', e); }
      }
      
      // Fuel Report freigeben
      try {
        await fetch(`${supabaseUrl}/rest/v1/fuel_reports?tour_id=eq.${tour_id}&driver_id=eq.${driver_id}`, {
          method: 'PATCH',
          headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'freigegeben', updated_at: now })
        });
      } catch (e) { console.warn('⚠️ Failed to update fuel report:', e); }
    }
    
    if (status === 'delivered') {
      const needsDocumentation = existingTour.documentation_requirements && 
                                 Object.keys(existingTour.documentation_requirements).length > 0;
      const documentationPending = existingTour.documentation_status === 'pending';
      
      if (needsDocumentation && documentationPending && !documentation_completed) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'documentation_required',
            message: 'Dokumentation muss vor Auslieferung hochgeladen werden',
            requirements: existingTour.documentation_requirements
          }),
          { status: 400, headers: corsHeaders }
        );
      }
      
      updateData.delivered_at = now;
      
      if (pieces_delivered !== undefined) {
        const pieces = parseInt(pieces_delivered) || 0;
        updateData.pieces_delivered = pieces;
        if (existingTour.compensation_rate && existingTour.compensation_type === 'stück') {
          updateData.calculated_compensation = pieces * existingTour.compensation_rate;
        }
      }
      
      if (documentation_completed) {
        updateData.documentation_completed = documentation_completed;
        updateData.documentation_status = 'completed';
      }
      if (documentation_status) updateData.documentation_status = documentation_status;
      if (signature_url) updateData.signature_url = signature_url;
      if (photo_url) updateData.photo_url = photo_url;
      if (notes) updateData.notes = notes;

      // Driver/Vehicle Status nach Lieferung
      try {
        const activeToursResponse = await fetch(
          `${supabaseUrl}/rest/v1/tours?driver_id=eq.${driver_id}&status=in.(assigned,confirmed,picked_up,in_progress)&select=id`,
          { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
        );
        if (activeToursResponse.ok) {
          const activeTours = await activeToursResponse.json();
          const newDriverStatus = (activeTours?.length || 0) === 0 ? 'verfügbar' : 'unterwegs';
          
          await fetch(`${supabaseUrl}/rest/v1/drivers?id=eq.${driver_id}`, {
            method: 'PATCH',
            headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newDriverStatus, updated_at: now })
          });
          
          if (existingTour.license_plate) {
            await fetch(`${supabaseUrl}/rest/v1/vehicles?license_plate=eq.${existingTour.license_plate}`, {
              method: 'PATCH',
              headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: newDriverStatus, updated_at: now })
            });
          }
        }
      } catch (e) { console.warn('⚠️ Failed to update driver/vehicle status:', e); }
    }
    
    if (status === 'cancelled') updateData.cancelled_at = now;
    if (location) updateData.current_location = location;

    console.log('🔄 Updating tour:', tour_id, 'Status:', status);

    // Atomares Update auf "tours" Tabelle
    const { data: updatedTours, error: updateError } = await supabase
      .from('tours')
      .update(updateData)
      .eq('id', tour_id)
      .eq('status', currentStatus)
      .select();

    if (updateError) {
      console.error('❌ Supabase update failed:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Internal server error', details: updateError.message }),
        { status: 500, headers: corsHeaders }
      );
    }
    
    if (!Array.isArray(updatedTours) || updatedTours.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'STATUS_CONFLICT',
          message: 'Tour-Status wurde zwischenzeitlich geändert. Bitte neu laden.'
        }),
        { status: 409, headers: corsHeaders }
      );
    }

    const updatedTour = updatedTours[0];
    console.log('✅ Tour updated successfully:', updatedTour.id);

    // Update-Log in tour_updates
    try {
      await fetch(`${supabaseUrl}/rest/v1/tour_updates`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          assignment_id: tour_id,
          driver_id,
          tour_id: updatedTour.tour_id,
          status,
          update_type: 'status_update',
          location: location || null,
          notes: notes || null,
          signature_url: signature_url || null,
          update_data: { status, location, pieces_delivered, signature_url, photo_url, notes, timestamp: now },
          created_at: now
        })
      });
    } catch (e) { console.warn('⚠️ Failed to log tour update:', e); }

    return new Response(
      JSON.stringify({ success: true, message: 'Status aktualisiert', tour: updatedTour }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('updateTourStatus error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});