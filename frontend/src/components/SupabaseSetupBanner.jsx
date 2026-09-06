import { isSupabaseConfigured } from '../supabaseClient';
import { Database, AlertTriangle, ExternalLink, Sparkles } from 'lucide-react';

export default function SupabaseSetupBanner() {
  if (isSupabaseConfigured()) return null;

  return (
    <div className="bg-gradient-to-r from-amber-950/90 via-purple-950/90 to-slate-950/90 border-b border-amber-500/40 p-3 px-4 text-xs text-amber-200 backdrop-blur-xl relative z-50">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-amber-100 flex items-center gap-1.5 inline-flex">
              <Database className="w-3.5 h-3.5 text-purple-400" />
              Cloud Mode Setup: Add Supabase Credentials
            </span>
            <span className="text-slate-300 ml-1 block sm:inline">
              To log in on mobile/other devices without running a local server, add your Supabase keys to <code className="bg-slate-900 border border-slate-700 px-1 py-0.5 rounded text-amber-300 text-[10px]">.env.local</code> or Vercel.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-semibold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            Supabase Dashboard
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
