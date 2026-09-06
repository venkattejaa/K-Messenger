import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://eccrzzfjljzqmwjcizwj.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjY3J6emZqbGp6cW13amNpendqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MTYxNjUsImV4cCI6MjEwNDI5MjE2NX0.goZ1-JPcAUkO9JXVCDjTFPkcxBJMOz2utUr0f44JBXI';

export const isSupabaseConfigured = () => {
  return true;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
