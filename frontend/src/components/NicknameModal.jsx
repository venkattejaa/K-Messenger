import { useState } from 'react';
import { X, Edit3, UserCheck, RotateCcw, Sparkles } from 'lucide-react';

export default function NicknameModal({ isOpen, onClose, contactName, currentNickname, onSaveNickname }) {
  const [nickname, setNickname] = useState(currentNickname || '');

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    onSaveNickname(nickname.trim());
    onClose();
  };

  const handleReset = () => {
    setNickname('');
    onSaveNickname('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="glass-panel border border-slate-700/60 rounded-3xl p-6 w-full max-w-sm shadow-2xl shadow-purple-950/40 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-pink-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-pink-500 to-purple-600 text-white shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-slate-100 font-bold text-base">Edit Nickname</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Set a custom nickname for <span className="font-semibold text-indigo-300">{contactName}</span> like in Instagram DMs. Only you will see this nickname.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Custom Nickname
            </label>
            <div className="relative">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={`e.g. Bobby ⚡ (Default: ${contactName})`}
                maxLength={30}
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500/30 font-medium"
                autoFocus
              />
              <Edit3 className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            {currentNickname && (
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 font-semibold text-xs transition-all flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:opacity-95 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-pink-600/25 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              Save Nickname
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
