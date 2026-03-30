import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

export function getSupabaseEnv() {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  return { url, anonKey, serviceRoleKey };
}

export function hasRequiredSupabaseEnv() {
  const { url, anonKey, serviceRoleKey } = getSupabaseEnv();
  return Boolean(url && anonKey && serviceRoleKey);
}

export function createAnonSupabaseClient() {
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }

  return createClient(url, anonKey);
}

export function createServiceSupabaseClient() {
  const { url, serviceRoleKey } = getSupabaseEnv();
  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, serviceRoleKey);
}
