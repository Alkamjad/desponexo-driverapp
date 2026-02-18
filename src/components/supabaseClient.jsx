// Supabase Client Singleton - KEINE GoTrueClient Warnung
// Wird OHNE Auth-Funktionalität verwendet (nur für Realtime)
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://attlcrcpybgfkygcgwvz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0dGxjcmNweWJnZmt5Z2Nnd3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTA5NTEsImV4cCI6MjA4MDMyNjk1MX0.xFLqApRtZ5rjkCXYzr2NL9AHbBqL7G3HX-lZmof5YVU';

// ✅ SINGLETON: Nur EINE Instanz für die ganze App
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: {
      getItem: (key) => {
        try {
          return localStorage.getItem(key);
        } catch (e) {
          return null;
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(key, value);
        } catch (e) {
          console.warn('Failed to set item in localStorage:', key);
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.warn('Failed to remove item from localStorage:', key);
        }
      }
    }
  }
});

export default supabaseClient;
export { supabaseClient };
export const supabase = supabaseClient;