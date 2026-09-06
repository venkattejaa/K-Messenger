import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://YOUR_SUPABASE_PROJECT_URL.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const isSupabaseConfigured = () => {
  return (
    Boolean(import.meta.env.VITE_SUPABASE_URL) &&
    Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY) &&
    import.meta.env.VITE_SUPABASE_URL !== 'https://YOUR_SUPABASE_PROJECT_URL.supabase.co' &&
    import.meta.env.VITE_SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY'
  );
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
