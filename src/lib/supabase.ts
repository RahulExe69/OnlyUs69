import { createClient } from '@supabase/supabase-js';

/**
 * OnlyUs Supabase Client
 * Exclusively uses verified, hardcoded project credentials (vrstmtjfqlbfyxtsothf)
 * to prevent any environment variable drift, truncation, or stale overrides.
 */
export const SUPABASE_URL = 'https://vrstmtjfqlbfyxtsothf.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyc3RtdGpmcWxiZnl4dHNvdGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODc2MTIsImV4cCI6MjA5MjM2MzYxMn0.hThpbqIhYdxyR7Ze9UcBW5gHkX5WnTeTJM7cMfvM6wc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: { 'x-application-name': 'onlyus-chat' }
  }
});
