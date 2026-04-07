import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
// deployed

async function verifyRequest(req) {
  try {
    const supabaseToken = req.headers.get('x-supabase-auth');
    const authHeader = req.headers.get('Authorization') || '';
    const token = supabaseToken || (authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : null);
    if (!token) {
      console.error('❌ NO AUTH TOKEN');
      return { valid: false, status: 401 };
    }
    
    // DEBUG JWT PAYLOAD (ohne Token zu leaken)
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        console.log('JWT PAYLOAD DEBUG:', {
          iss: payload.iss,
          aud: payload.aud,
          exp: payload.exp,
          exp_date: new Date(payload.exp * 1000).toISOString(),
          sub: payload.sub,
          now: Math.floor(Date.now() / 1000),
          is_expired: Math.floor(Date.now() / 1000) > payload.exp
        });
      }
    } catch (decodeError) {
      console.warn('⚠️ Could not decode JWT payload:', decodeError.message);
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    // ENV GUARD + DEBUG KEYS
    console.log('✅ ENV CHECK:', {
      HAS_SUPABASE_URL: !!supabaseUrl,
      HAS_ANON_KEY: !!supabaseAnonKey,
      ANON_KEY_PREFIX: supabaseAnonKey ? supabaseAnonKey.slice(0, 10) : 'MISSING',
      HAS_SERVICE_ROLE_KEY: !!serviceKey,
      SERVICE_ROLE_PREFIX: serviceKey ? serviceKey.slice(0, 10) : 'MISSING'
    });
    
    if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
      console.error('❌ ENV CONFIG MISSING:', {
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_ANON_KEY: !!supabaseAnonKey,
        SUPABASE_SERVICE_ROLE_KEY: !!serviceKey
      });
      return { valid: false, status: 500 };
    }
    
    console.log('✅ SUPABASE CONFIG:', { SUPABASE_URL: supabaseUrl });
    console.log('✅ Creating Supabase client for auth verification...');
    
    // Validiere Token via Supabase Auth mit explizitem Token
    const supabase = createClient(supabaseUrl, serviceKey);
    const tokenOnly = token.trim();
    
    const { data: { user }, error } = await supabase.auth.getUser(tokenOnly);
    
    if (error) {
      console.error('❌ AUTH ERROR:', error.message);
      return { valid: false, status: 401 };
    }
    
    if (!user) {
      console.error('❌ NO USER FOUND');
      return { valid: false, status: 401 };
    }
    
    console.log('✅ USER AUTHENTICATED:', user.id);
    
    // Hole driver_id mit SERVICE KEY (nicht mit Auth Header)
    const supabaseService = createClient(supabaseUrl, serviceKey);
    const { data: driver, error: driverError } = await supabaseService
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    if (driverError) {
      console.error('❌ DRIVER ERROR:', driverError.message);
      return { valid: false, status: 403 };
    }
    
    if (!driver) {
      console.error('❌ NO DRIVER FOUND FOR USER');
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
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://desponexodriver.app',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-supabase-auth, x-client-request-id',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };

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

    // Nutze driver_id AUS TOKEN, nicht aus Body
    const driver_id = auth.driver_id;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      console.error('❌ ENV CONFIG MISSING IN MAIN:', {
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: !!serviceKey
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Server-Konfiguration fehlt' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 1. Prüfen ob Tour diesem Fahrer gehört UND compensation_rate + documentation_requirements + license_plate holen
    console.log('🔍 Checking tour:', { tour_id, driver_id });
    
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: existingTour, error: tourCheckError } = await supabase
      .from('tours')
      .select('id, driver_id, status, compensation_rate, compensation_type, documentation_requirements, documentation_status, license_plate')
      .eq('id', tour_id)
      .eq('driver_id', driver_id)
      .single();

    console.log('📋 Tour check result:', existingTour);
    
    if (tourCheckError || !existingTour) {
      console.error('❌ Tour not found:', { tour_id, driver_id });
      return new Response(
        JSON.stringify({ success: false, error: 'Tour nicht gefunden oder nicht autorisiert' }),
        { status: 403, headers: corsHeaders }
      );
    }
     const currentStatus = existingTour.status;



    // 3. STATUS-STATE-MACHINE: Erlaubte Übergänge definieren
    const ALLOWED_TRANSITIONS = {
      'assigned': ['confirmed', 'problem_reported'],
      'confirmed': ['picked_up', 'problem_reported'],
      'picked_up': ['arrived_at_customer', 'problem_reported'],
      'arrived_at_customer': ['delivered', 'problem_reported'],
      'delivered': ['completed'],
      'completed': [] // Terminal state - keine weiteren Übergänge
    };

    // 4. Validiere Status-Übergang
    const allowedNextStates = ALLOWED_TRANSITIONS[currentStatus] || [];
    
    if (!allowedNextStates.includes(status)) {
      console.error('❌ Invalid status transition:', { 
        current: currentStatus, 
        requested: status,
        allowed: allowedNextStates 
      });
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

    // STATUS-MACHINE: delivered_final wird nur via Admin/Company-Dashboard gesetzt
    // Drivers dürfen max. 'delivered' setzen

    const now = new Date().toISOString();

    // Update-Daten vorbereiten
    const updateData = {
      status: status,
      updated_at: now
    };

    // Zeitstempel je nach Status setzen
    if (status === 'confirmed') updateData.confirmed_at = now;
    if (status === 'in_progress') updateData.started_at = now;
    if (status === 'arrived_at_customer') {
      updateData.arrived_at_customer_at = now;
      updateData.gps_tracking_active = true; // GPS bleibt aktiv
      if (location) updateData.current_location = location;
    }
    if (status === 'picked_up') {
      updateData.picked_up_at = now;
      updateData.started_at = now;
      updateData.gps_tracking_active = true;  // GPS-Tracking aktivieren für Hauptapp
      
      // 🔴 DOKUMENTATIONS-STATUS INITIALISIERUNG
      // Wenn documentation_requirements existiert → setze status auf 'pending'
      if (existingTour.documentation_requirements && 
          (!existingTour.documentation_status || existingTour.documentation_status === 'not_required')) {
        updateData.documentation_status = 'pending';
        console.log('📋 Dokumentation erforderlich - setze status auf pending');
      }
      
      // 🚗 DRIVER STATUS UPDATE: Setze auf 'unterwegs'
      try {
        console.log('🚗 Updating driver status to unterwegs');
        await fetch(
          `${supabaseUrl}/rest/v1/drivers?id=eq.${driver_id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': serviceKey,
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              status: 'unterwegs',
              updated_at: now
            })
          }
        );
        console.log('✅ Driver status updated to unterwegs');
      } catch (driverError) {
        console.warn('⚠️ Failed to update driver status:', driverError);
      }
      
      // 🚚 VEHICLE STATUS UPDATE: Über license_plate
      if (existingTour.license_plate) {
        try {
          console.log('🚚 Updating vehicle status to unterwegs for license plate:', existingTour.license_plate);
          const vehicleUpdateResponse = await fetch(
            `${supabaseUrl}/rest/v1/vehicles?license_plate=eq.${existingTour.license_plate}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': serviceKey,
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                status: 'unterwegs',
                updated_at: now
              })
            }
          );
          
          if (vehicleUpdateResponse.ok) {
            console.log('✅ Vehicle status updated to unterwegs');
          } else {
            const errorText = await vehicleUpdateResponse.text();
            console.error('❌ Failed to update vehicle status:', errorText);
          }
        } catch (vehicleError) {
          console.error('⚠️ Failed to update vehicle status:', vehicleError);
        }
      }
      
      // Bei picked_up: Fuel Report Status von 'gesperrt' zu 'freigegeben' ändern
      try {
        console.log('⛽ Updating fuel report status to freigegeben');
        await fetch(
          `${supabaseUrl}/rest/v1/fuel_reports?tour_id=eq.${tour_id}&driver_id=eq.${driver_id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': serviceKey,
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              status: 'freigegeben',
              updated_at: now
            })
          }
        );
        console.log('✅ Fuel report status updated');
      } catch (fuelError) {
        console.warn('⚠️ Failed to update fuel report:', fuelError);
      }
    }
    if (status === 'delivered') {
      // 🔴 KRITISCHER CHECK: Dokumentation erforderlich?
      const needsDocumentation = existingTour.documentation_requirements && 
                                 Object.keys(existingTour.documentation_requirements).length > 0;
      // Dokumentation kann pending ODER completed sein (wenn bei arrived_at_customer hochgeladen)
      const documentationPending = existingTour.documentation_status === 'pending';
      
      console.log('📋 Dokumentations-Check:', {
        needsDocumentation,
        documentation_status: existingTour.documentation_status,
        has_documentation_completed: !!documentation_completed,
        will_block: needsDocumentation && documentationPending && !documentation_completed
      });
      
      // BLOCKIEREN wenn Doku erforderlich aber nicht hochgeladen
      if (needsDocumentation && documentationPending && !documentation_completed) {
        console.error('❌ BLOCKIERT: Dokumentation muss hochgeladen werden!');
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
      
      // Stückvergütung: pieces_delivered und calculated_compensation
      if (pieces_delivered !== undefined) {
        const pieces = parseInt(pieces_delivered) || 0;
        updateData.pieces_delivered = pieces;
        
        // Berechne Vergütung wenn compensation_rate vorhanden
        if (existingTour.compensation_rate && existingTour.compensation_type === 'stück') {
          updateData.calculated_compensation = pieces * existingTour.compensation_rate;
          console.log('💰 Calculated compensation:', {
            pieces,
            rate: existingTour.compensation_rate,
            total: updateData.calculated_compensation
          });
        }
      }
      
      // Dokumentation
      if (documentation_completed) {
        updateData.documentation_completed = documentation_completed;
        updateData.documentation_status = 'completed'; // Status IMMER auf completed setzen
        console.log('✅ Dokumentation hochgeladen - Status: completed');
      }
      if (documentation_status) {
        updateData.documentation_status = documentation_status;
      }
      
      if (signature_url) updateData.signature_url = signature_url;
      if (photo_url) updateData.photo_url = photo_url;
      if (notes) updateData.notes = notes;

      // 🚗 DRIVER STATUS UPDATE: Prüfe ob noch andere aktive Touren existieren
      try {
        console.log('🔍 Checking for other active tours');
        
        // Zähle andere aktive Touren
        const activeToursResponse = await fetch(
          `${supabaseUrl}/rest/v1/tours?driver_id=eq.${driver_id}&status=in.("assigned","confirmed","picked_up","in_transit")&select=id`,
          {
            headers: {
              'apikey': serviceKey,
              'Authorization': `Bearer ${serviceKey}`
            }
          }
        );

        if (activeToursResponse.ok) {
          const activeTours = await activeToursResponse.json();
          const activeCount = activeTours?.length || 0;
          
          console.log(`📊 Active tours count: ${activeCount}`);
          
          // Nur auf verfügbar setzen wenn keine anderen aktiven Touren
          const newDriverStatus = activeCount === 0 ? 'verfügbar' : 'unterwegs';
          
          console.log(`🚗 Setting driver status to: ${newDriverStatus}`);
          
          await fetch(
            `${supabaseUrl}/rest/v1/drivers?id=eq.${driver_id}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': serviceKey,
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                status: newDriverStatus,
                updated_at: now
              })
            }
          );
          
          console.log(`✅ Driver status updated to ${newDriverStatus}`);
          
          // 🚚 VEHICLE STATUS UPDATE: Über license_plate zurücksetzen
          if (existingTour.license_plate) {
            const newVehicleStatus = activeCount === 0 ? 'verfügbar' : 'unterwegs';
            console.log(`🚚 Setting vehicle status to: ${newVehicleStatus} for license plate:`, existingTour.license_plate);
            
            const vehicleUpdateResponse = await fetch(
              `${supabaseUrl}/rest/v1/vehicles?license_plate=eq.${existingTour.license_plate}`,
              {
                method: 'PATCH',
                headers: {
                  'apikey': serviceKey,
                  'Authorization': `Bearer ${serviceKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  status: newVehicleStatus,
                  updated_at: now
                })
              }
            );
            
            if (vehicleUpdateResponse.ok) {
              console.log(`✅ Vehicle status updated to ${newVehicleStatus}`);
            } else {
              const errorText = await vehicleUpdateResponse.text();
              console.error('❌ Failed to update vehicle status on delivery:', errorText);
            }
          }
        }
      } catch (driverError) {
        console.warn('⚠️ Failed to update driver status:', driverError);
      }
    }
    if (status === 'cancelled') updateData.cancelled_at = now;
    if (status === 'failed') updateData.failed_at = now;

    // GPS-Location speichern wenn vorhanden
    if (location) updateData.current_location = location;

    console.log('🔄 Updating tour:', tour_id, 'Status:', status, 'Data:', updateData);
    console.log('📦 Pieces info:', {
      pieces_delivered,
      compensation_type: existingTour.compensation_type,
      compensation_rate: existingTour.compensation_rate
    });

    // 6. ATOMARES UPDATE: Nur wenn status noch der erwartete ist (Race Condition Protection)
    const { data: updatedTours, error: updateError } = await supabase
      .from('tours')
      .update(updateData)
      .eq('id', tour_id)
      .eq('status', currentStatus)
      .select();

    if (updateError) {
      console.error('Supabase update failed:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Internal server error' }),
        { status: 500, headers: corsHeaders }
      );
    }
    
    // 7. Prüfe ob Update erfolgreich (0 rows = Status hat sich zwischenzeitlich geändert)
    if (!Array.isArray(updatedTours) || updatedTours.length === 0) {
      console.error('❌ Status conflict: Tour status changed during update');
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

    console.log('✅ Tour updated:', updatedTour);

    // Tour-Update in tour_updates Tabelle protokollieren
    try {
      const updateLog = {
        assignment_id: tour_id,
        driver_id: driver_id,
        tour_id: updatedTour.tour_id,
        status: status,
        update_type: 'status_update',
        location: location || null,
        notes: notes || null,
        signature_url: signature_url || null,
        update_data: {
          status,
          location,
          pieces_delivered,
          signature_url,
          photo_url,
          notes,
          timestamp: now
        },
        created_at: now
      };

      console.log('📝 Creating tour update log:', updateLog);

      await fetch(
        `${supabaseUrl}/rest/v1/tour_updates`,
        {
          method: 'POST',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(updateLog)
        }
      );
    } catch (logError) {
      console.warn('⚠️ Failed to log tour update:', logError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Status aktualisiert',
        tour: updatedTour
      }),
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