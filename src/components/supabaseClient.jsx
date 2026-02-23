// Supabase Client Singleton - KEINE GoTrueClient Warnung
import { createClient } from '@supabase/supabase-js';

const LEGACY_SUPABASE_URL = 'https://attlcrcpybgfkygcgwvz.supabase.co';
const LEGACY_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0dGxjcmNweWJnZmt5Z2Nnd3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTA5NTEsImV4cCI6MjA4MDMyNjk1MX0.xFLqApRtZ5rjkCXYzr2NL9AHbBqL7G3HX-lZmof5YVU';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || LEGACY_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || LEGACY_SUPABASE_ANON_KEY;

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in env. Falling back to legacy project config. ' +
      'Set both variables in Vercel Project Settings → Environment Variables.'
  );
}

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
