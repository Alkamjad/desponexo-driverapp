import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import { getCorsHeaders } from './_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = getCorsHeaders({ methods: 'POST, OPTIONS' });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'POST only' }, { status: 405, headers: corsHeaders });
  }

  try {
    // No auth required - internal function called by other backend functions
    const { driver_id, driver_email, type, title, message, source_data } = await req.json();

    if (!driver_id || !type || !title) {
      return Response.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // STRENGE DUPLIKAT-PRÜFUNG: Verhindere identische Benachrichtigungen in den letzten 60 Sekunden
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString();
    
    // 1. Prüfe basierend auf TITLE + MESSAGE + TYPE (content-basiert)
    const { data: recentByContent } = await supabase
      .from('driver_notifications')
      .select('id, title, message, type, created_at')
      .eq('driver_id', driver_id)
      .eq('type', type)
      .eq('title', title)
      .eq('message', message)
      .gte('created_at', sixtySecondsAgo);
    
    if (recentByContent && recentByContent.length > 0) {
      console.log(`🔄 DUPLIKAT (Content): ${type} - "${title}" (bereits ${recentByContent.length}x vorhanden)`);
      return Response.json({ 
        success: true,
        notification: null,
        duplicate: true,
        reason: 'content_match'
      }, { status: 200, headers: corsHeaders });
    }

    // 2. Prüfe basierend auf SOURCE_ID (falls vorhanden)
    const sourceId = source_data?.id || source_data?.tour_id || source_data?.payment_id || source_data?.report_id || source_data?.message_id || source_data?.absence_request_id;
    
    if (sourceId) {
      const { data: recentBySource } = await supabase
        .from('driver_notifications')
        .select('id, source_data, type, created_at')
        .eq('driver_id', driver_id)
        .eq('type', type)
        .gte('created_at', sixtySecondsAgo);
      
      const duplicate = recentBySource?.find(n => {
        const nSourceId = n.source_data?.id || n.source_data?.tour_id || n.source_data?.payment_id || n.source_data?.report_id || n.source_data?.message_id || n.source_data?.absence_request_id;
        return nSourceId && nSourceId === sourceId;
      });
      
      if (duplicate) {
        console.log(`🔄 DUPLIKAT (Source): ${type} #${sourceId}`);
        return Response.json({ 
          success: true,
          notification: null,
          duplicate: true,
          reason: 'source_id_match'
        }, { status: 200, headers: corsHeaders });
      }
    }

    // Speichere in Supabase
    const { data, error } = await supabase
      .from('driver_notifications')
      .insert([{
        driver_id,
        driver_email,
        type,
        title,
        message,
        source_data,
        read: false,
        created_at: new Date().toISOString()
      }])
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }

    const newNotification = data?.[0];
    console.log(`✅ Notification gespeichert: ${title}`);

    // 🚀 AUTOMATISCH PUSH NOTIFICATION AN GERÄT SENDEN
    try {
      // Hole FCM Token des Fahrers aus drivers Tabelle
      const { data: driverData } = await supabase
        .from('drivers')
        .select('fcm_token, fcm_platform')
        .eq('id', driver_id)
        .single();

      if (driverData?.fcm_token) {
        // Sende Push via Firebase
        const API_BASE_URL = Deno.env.get('DRIVER_APP_DOMAIN') || 'https://desponexodriver.app';
        await fetch(`${API_BASE_URL}/functions/sendPushNotification`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fcm_token: driverData.fcm_token,
            title,
            body: message,
            data: {
              type,
              notification_id: newNotification.id,
              ...source_data
            }
          })
        });
        console.log('📲 Push Notification gesendet an Gerät');
      }
    } catch (pushError) {
      console.warn('⚠️ Push senden fehlgeschlagen:', pushError.message);
      // Nicht blockieren - Notification wurde trotzdem gespeichert
    }

    return Response.json({ 
      success: true,
      notification: newNotification,
      duplicate: false
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Function error:', error);
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});