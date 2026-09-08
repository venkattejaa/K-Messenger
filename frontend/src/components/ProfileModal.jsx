import { useState, useRef } from 'react';
import { X, Camera, User, Check, Loader2, Sparkles, Lock, Edit3, LogOut, Smartphone, Download } from 'lucide-react';
import { apiUpdateProfile, apiUploadFile } from '../services/supabaseService';

export default function ProfileModal({ userProfile, onUpdateProfile, onLogout, onClose }) {
  const [username, setUsername] = useState(userProfile.username || '');
  const [displayName, setDisplayName] = useState(userProfile.display_name || userProfile.username || '');
  const [bio, setBio] = useState(userProfile.bio || 'Available for chat ✨');
  const [avatarUrl, setAvatarUrl] = useState(userProfile.avatar_url || '');
  const [passcode, setPasscode] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const fileInputRef = useRef(null);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingAvatar(true);
    setErrorMsg('');

    try {
      const data = await apiUploadFile(file);
      if (data.media_url) {
        setAvatarUrl(data.media_url);
      } else {
        throw new Error('Avatar upload failed');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMsg('Username cannot be empty');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const data = await apiUpdateProfile({
        user_id: userProfile.user_id,
        username: username.trim(),
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl,
        passcode: passcode.trim() || undefined,
      });

      setSuccessMsg('Profile updated successfully!');
      onUpdateProfile(data);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="glass-panel border border-slate-700/60 rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-slate-100 font-bold text-lg">My Profile Settings</h2>
              <p className="text-slate-400 text-xs font-medium">Manage username, avatar & security</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl text-rose-300 text-xs font-medium animate-fadeIn">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/50 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs font-medium flex items-center gap-2 animate-fadeIn">
              <Check className="w-4 h-4 text-emerald-400" />
              {successMsg}
            </div>
          )}

          {/* Avatar Upload */}
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full p-[3px] bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-xl">
                <div className="w-full h-full rounded-full bg-slate-900 overflow-hidden flex items-center justify-center relative border-2 border-slate-950">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <User className="w-10 h-10 text-indigo-400" />
                  )}
                  <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploadingAvatar ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <Camera className="w-6 h-6 text-white" />
                    )}
                  </div>
                </div>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <p className="text-[11px] text-slate-400 font-medium">Click avatar to upload photo</p>
          </div>

          {/* Unique Username Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <span>Username</span>
              <span className="text-[10px] bg-indigo-900/60 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-700/50">Unique ID</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-8 pr-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-semibold"
                placeholder="username"
                required
              />
              <Edit3 className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium"
              placeholder="e.g. Venkat Teja"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Status Bio</label>
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium"
              placeholder="e.g. Available for chat ✨"
            />
          </div>

          {/* Change Passcode */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Update Passcode</span>
            </label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium"
              placeholder="Leave blank to keep current passcode"
            />
          </div>

          {/* Android App Download Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-indigo-950/40 border border-emerald-800/40 flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-extrabold text-slate-100">Native Android App (APK)</span>
                <span className="text-[11px] text-slate-400 font-medium">Install K-Messenger on your phone</span>
              </div>
            </div>
            <a
              href="/downloads/K-Messenger.apk"
              download="K-Messenger.apk"
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-900/40 cursor-pointer active:scale-95 flex-shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Get APK</span>
            </a>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-800">
            {onLogout && (
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>Log Out</span>
              </button>
            )}

            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || uploadingAvatar}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-95 text-white text-xs font-semibold transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Profile</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
