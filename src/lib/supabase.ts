import { createClient } from '@supabase/supabase-js';

/**
 * Note: These credentials are being stored directly in the code as requested 
 * because environment variable sync was failing. 
 * 
 * SECURITY NOTE: In a public production app, these should stay in environment 
 * variables. However, since we have Row Level Security (RLS) enabled on your 
 * Supabase tables, it is safe to use the "anon" key here as it only allows 
 * restricted access as defined in your SQL policies.
 */

const SUPABASE_URL = 'https://vrstmtjfqlbfyxtsothf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyc3RtdGpmcWxiZnl4dHNvdGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODc2MTIsImV4cCI6MjA5MjM2MzYxMn0.hThpbqIhYdxyR7Ze9UcBW5gHkX5WnTeTJM7cMfvM6wc';

// Use environment variables if present, otherwise fall back to the hardcoded keys
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
