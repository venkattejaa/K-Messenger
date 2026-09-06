import { useState, useRef } from 'react';
import { LogIn, Loader2, ShieldCheck, Lock, Eye, EyeOff, Sparkles, MessageCircleCode, UserPlus, Camera, Mail, KeyRound, ArrowLeft, RefreshCw } from 'lucide-react';
import { getApiBaseUrl } from '../config';

export default function LoginPage({ onLogin }) {
  const [activeTab, setActiveTab] = useState('register'); // 'register' or 'login'
  
  // Login fields
  const [username, setUsername] = useState('');
  const [passcode, setPasscode] = useState('');
  
  // Register fields
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regOtp, setRegOtp] = useState('');
  const [regPasscode, setRegPasscode] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regBio, setRegBio] = useState('');
  const [regAvatarUrl, setRegAvatarUrl] = useState('');
  
  // OTP flow step: 'details' (enter info & email) vs 'verify' (enter OTP code)
  const [otpStep, setOtpStep] = useState('details');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSentMsg, setOtpSentMsg] = useState('');
  
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const avatarInputRef = useRef(null);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingAvatar(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${getApiBaseUrl()}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.media_url) {
        setRegAvatarUrl(data.media_url);
      } else {
        throw new Error('Avatar upload failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${getApiBaseUrl()}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, passcode }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Invalid username or passcode');
      }

      onLogin(data.user_id, data.username, data.display_name, data.avatar_url, data.bio);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');

    if (!regUsername.trim()) {
      setError('Please choose a unique username');
      return;
    }

    if (!regEmail.trim() || !regEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setSendingOtp(true);

    try {
      const res = await fetch(`${getApiBaseUrl()}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to send verification email');
      }

      setOtpSentMsg(data.message || `Verification code sent to ${regEmail}`);
      setOtpStep('verify');
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');

    if (!regOtp.trim()) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);

    try {
      const finalPasscode = regPasscode.trim() || '1234';
      const res = await fetch(`${getApiBaseUrl()}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername.trim(),
          email: regEmail.trim(),
          otp: regOtp.trim(),
          passcode: finalPasscode,
          display_name: regDisplayName.trim() || regUsername.trim(),
          bio: regBio.trim() || 'Available for chat ✨',
          avatar_url: regAvatarUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Registration failed');
      }

      // Auto-login upon registration
      onLogin(data.user_id, data.username, data.display_name, data.avatar_url, data.bio);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] w-full bg-[#0B0F17] flex flex-col items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Ambient background glowing orbs */}
      <div className="absolute top-1/4 left-1/3 w-80 h-80 sm:w-96 sm:h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 sm:w-96 sm:h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" style={{ animationDelay: '3s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Grid line background overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md my-auto py-2">
        {/* Header */}
        <div className="text-center mb-4 sm:mb-5">
          <div className="inline-flex items-center justify-center p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 shadow-xl shadow-indigo-500/20 mb-2 animate-float">
            <MessageCircleCode className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            K<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">-Messenger</span>
          </h1>
          <p className="text-slate-400 text-[11px] sm:text-xs mt-0.5 flex items-center justify-center gap-1.5 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Private Encrypted Messenger & Video Calls
          </p>
        </div>

        {/* Glassmorphic Card */}
        <div className="glass-panel border border-slate-700/50 rounded-3xl p-4 sm:p-6 shadow-2xl shadow-indigo-950/40 relative overflow-hidden backdrop-blur-2xl max-h-[78vh] overflow-y-auto">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

          {/* Mode Switcher Tabs */}
          <div className="flex bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 mb-4">
            <button
              type="button"
              onClick={() => { setActiveTab('register'); setError(''); setOtpStep('details'); }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'register'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Create Profile
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('login'); setError(''); }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'login'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </button>
          </div>

          {error && (
            <div className="mb-3.5 p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'register' ? (
            otpStep === 'details' ? (
              /* Step 1: Profile Details & Email */
              <form onSubmit={handleSendOtp} className="space-y-3">
                {/* Avatar Upload */}
                <div className="flex flex-col items-center justify-center mb-0.5">
                  <div className="relative group">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-indigo-500/50 bg-slate-900 flex items-center justify-center shadow-lg">
                      {regAvatarUrl ? (
                        <img src={regAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg font-bold text-indigo-300">
                          {(regDisplayName || regUsername || 'P').charAt(0).toUpperCase()}
                        </span>
                      )}
                      {uploadingAvatar && (
                        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center">
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 p-1 rounded-xl bg-indigo-600 text-white shadow-md hover:scale-105"
                      title="Upload Avatar Picture"
                    >
                      <Camera className="w-3 h-3" />
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5">Optional profile picture</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">
                    Username *
                  </label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    required
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 text-xs sm:text-sm focus:outline-none focus:border-indigo-500 font-medium"
                    placeholder="Choose unique username (e.g. venkattejaa)"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">
                    Email Address * (Zoho Mail OTP)
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2 text-slate-100 text-xs sm:text-sm focus:outline-none focus:border-indigo-500 font-medium"
                      placeholder="your.name@zoho.com or gmail.com"
                    />
                    <Mail className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={regDisplayName}
                    onChange={(e) => setRegDisplayName(e.target.value)}
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 text-xs sm:text-sm focus:outline-none focus:border-indigo-500 font-medium"
                    placeholder="Full Name (e.g. Venkat Teja)"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">
                    Status / Bio
                  </label>
                  <input
                    type="text"
                    value={regBio}
                    onChange={(e) => setRegBio(e.target.value)}
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 text-xs sm:text-sm focus:outline-none focus:border-indigo-500 font-medium"
                    placeholder="e.g. Jack of all trades ✨"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">
                    Passcode (Optional - defaults to 1234)
                  </label>
                  <input
                    type="password"
                    value={regPasscode}
                    onChange={(e) => setRegPasscode(e.target.value)}
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 text-xs sm:text-sm focus:outline-none focus:border-indigo-500 font-medium"
                    placeholder="Optional passcode (default: 1234)"
                  />
                </div>

                <button
                  type="submit"
                  disabled={sendingOtp || uploadingAvatar || !regUsername.trim() || !regEmail.trim()}
                  className="w-full bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 hover:opacity-95 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 text-xs sm:text-sm mt-2 disabled:opacity-50 cursor-pointer"
                >
                  {sendingOtp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending Verification Code...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>Send Verification Code</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Step 2: Enter 6-Digit OTP Code */
              <form onSubmit={handleRegisterSubmit} className="space-y-4 py-2">
                <div className="p-3 bg-purple-950/40 border border-purple-800/50 rounded-2xl text-center">
                  <div className="inline-flex p-2 rounded-xl bg-purple-600/30 text-purple-300 mb-1">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <p className="text-xs text-slate-200 font-bold">Verification Code Sent</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Enter 6-digit code sent to <span className="font-semibold text-purple-300">{regEmail}</span>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-center">
                    6-Digit Verification Code *
                  </label>
                  <input
                    type="text"
                    value={regOtp}
                    onChange={(e) => setRegOtp(e.target.value)}
                    required
                    maxLength={6}
                    className="w-full bg-slate-950/80 border border-purple-500/60 rounded-xl px-4 py-3 text-center text-slate-100 text-lg font-mono font-bold letter-spacing-4 tracking-widest focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20"
                    placeholder="123456"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !regOtp.trim()}
                  className="w-full bg-gradient-to-r from-purple-500 via-indigo-600 to-pink-500 hover:opacity-95 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying & Creating...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Verify & Create Profile</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <button
                    type="button"
                    onClick={() => setOtpStep('details')}
                    className="text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Edit Email / Info
                  </button>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={sendingOtp}
                    className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${sendingOtp ? 'animate-spin' : ''}`} />
                    Resend Code
                  </button>
                </div>
              </form>
            )
          ) : (
            /* Sign In Tab */
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div>
                <label htmlFor="username" className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 text-xs sm:text-sm focus:outline-none focus:border-indigo-500 font-medium"
                  placeholder="Enter your username"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="passcode" className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Passcode
                </label>
                <div className="relative">
                  <input
                    id="passcode"
                    type={showPassword ? 'text' : 'password'}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    required
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-slate-100 text-xs sm:text-sm focus:outline-none focus:border-indigo-500 font-medium"
                    placeholder="••••"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !username || !passcode}
                className="w-full bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 hover:opacity-95 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 text-xs sm:text-sm mt-3 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Enter Messenger</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Encryption Footer Info */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-indigo-400" /> WebRTC P2P Direct
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-purple-400" /> Fast Signal WS
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}