/**
 * SEND PUSH NOTIFICATION
 * Sendet Push Notifications an Fahrer-Geräte via Firebase Cloud Messaging
 * deploy v2
 */

import { initializeApp, cert } from 'npm:firebase-admin@13.0.2/app';
import { getMessaging } from 'npm:firebase-admin@13.0.2/messaging';

let firebaseApp = null;

// Firebase Admin SDK initialisieren
function getFirebaseApp() {
  if (firebaseApp) return firebaseApp;

  const credentials = Deno.env.get('FIREBASE_ADMIN_CREDENTIALS');
  if (!credentials) {
    throw new Error('FIREBASE_ADMIN_CREDENTIALS nicht gesetzt');
  }

  const serviceAccount = JSON.parse(credentials);
  
  firebaseApp = initializeApp({
    credential: cert(serviceAccount)
  });

  return firebaseApp;
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // No auth required - internal function called by saveNotification
  try {
    const { fcm_token, title, body, data = {} } = await req.json();

    if (!fcm_token || !title) {
      return Response.json({ 
        error: 'fcm_token und title erforderlich' 
      }, { status: 400, headers: corsHeaders });
    }

    const app = getFirebaseApp();
    const messaging = getMessaging(app);

    // Push Notification senden
    const message = {
      token: fcm_token,
      notification: {
        title,
        body: body || '',
        imageUrl: 'https://attlcrcpybgfkygcgwvz.supabase.co/storage/v1/object/public/driver-assets/logo-alt.png'
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'driver_notifications',
          priority: 'high'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await messaging.send(message);
    
    console.log('✅ Push Notification gesendet:', response);

    return Response.json({ 
      success: true,
      message_id: response 
    });

  } catch (error) {
    console.error('❌ Push Notification Fehler:', error);
    return Response.json({ 
      error: error.message,
      code: error.code 
    }, { status: 500, headers: corsHeaders });
    }
    });