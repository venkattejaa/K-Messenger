import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, RotateCcw, ShieldCheck, Maximize2, Minimize2, Sparkles } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function VideoCallOverlay({
  callState,
  localStream,
  remoteStream,
  localVideoRef,
  remoteVideoRef,
  onAccept,
  onEnd,
  onToggleMute,
  onToggleVideo,
  onFlipCamera,
  muted,
  videoEnabled,
}) {
  const [pictureInPicture, setPictureInPicture] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Call duration timer
  useEffect(() => {
    let interval;
    if (callState === 'active') {
      setCallDuration(0);
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [callState]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePip = async () => {
    if (!localVideoRef.current) return;
    try {
      if (!pictureInPicture) {
        await localVideoRef.current.requestPictureInPicture();
        setPictureInPicture(true);
      } else {
        await document.exitPictureInPicture();
        setPictureInPicture(false);
      }
    } catch (err) {
      console.error('PiP error:', err);
    }
  };

  if (callState === 'idle') return null;

  const isIncoming = callState === 'incoming';
  const isActive = callState === 'active';
  const isCalling = callState === 'calling';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden animate-fadeIn">
      {/* Remote Video Container */}
      <div className="flex-1 relative w-full h-full bg-black">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted={false}
          className="w-full h-full object-cover"
        />

        {/* Calling & Incoming Call Screen */}
        {(isCalling || isIncoming) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-2xl z-20">
            {/* Ambient background glow */}
            <div className="absolute w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />
            
            {isCalling && (
              <div className="text-center relative z-10">
                <div className="relative w-28 h-28 mx-auto mb-8 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-500/30 animate-ping" />
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/30 glow-indigo">
                    <Video className="w-10 h-10 text-white animate-pulse" />
                  </div>
                </div>
                <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Calling Partner...</h2>
                <p className="text-slate-400 text-sm font-medium">Establishing STUN Peer-to-Peer Connection</p>
                <div className="mt-8">
                  <button
                    onClick={onEnd}
                    className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 flex items-center justify-center text-white transition-all shadow-lg shadow-rose-600/40 hover:scale-105 active:scale-95 glow-rose"
                    title="Cancel Call"
                  >
                    <PhoneOff className="w-7 h-7" />
                  </button>
                </div>
              </div>
            )}

            {isIncoming && (
              <div className="text-center relative z-10 max-w-sm px-6">
                <div className="relative w-28 h-28 mx-auto mb-8 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ripple" />
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-500/40 glow-emerald">
                    <Video className="w-10 h-10 text-white animate-bounce" />
                  </div>
                </div>
                <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Incoming Call</h2>
                <p className="text-slate-400 text-sm font-medium mb-10">Encrypted WebRTC Video Invitation</p>
                
                <div className="flex items-center justify-center gap-8">
                  <button
                    onClick={onAccept}
                    className="group flex flex-col items-center gap-2"
                  >
                    <div className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white transition-all shadow-lg shadow-emerald-500/40 group-hover:scale-110 active:scale-95 glow-emerald">
                      <Phone className="w-7 h-7" />
                    </div>
                    <span className="text-xs font-semibold text-emerald-400">Accept</span>
                  </button>

                  <button
                    onClick={onEnd}
                    className="group flex flex-col items-center gap-2"
                  >
                    <div className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 flex items-center justify-center text-white transition-all shadow-lg shadow-rose-600/40 group-hover:scale-110 active:scale-95 glow-rose">
                      <PhoneOff className="w-7 h-7" />
                    </div>
                    <span className="text-xs font-semibold text-rose-400">Decline</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active Call - Top Glass Status Bar */}
        {isActive && (
          <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-20 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-2">
              <span className="glass-panel px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-200 border border-slate-700/60 shadow-lg flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>{formatDuration(callDuration)}</span>
              </span>
            </div>

            <div className="pointer-events-auto flex items-center gap-2">
              <span className="glass-panel px-4 py-1.5 rounded-full text-xs font-semibold text-indigo-300 border border-slate-700/60 shadow-lg flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>WebRTC P2P Direct</span>
              </span>
            </div>
          </div>
        )}

        {/* Local Video Picture-in-Picture */}
        {isActive && !pictureInPicture && (
          <div className="absolute top-20 right-6 w-48 sm:w-56 aspect-video rounded-2xl overflow-hidden border-2 border-indigo-500/40 bg-slate-900 shadow-2xl z-20 pointer-events-auto glow-indigo">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md text-[10px] font-bold text-slate-200">
              You
            </div>
          </div>
        )}
      </div>

      {/* Floating Call Controls Bar */}
      {isActive && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
          <div className="glass-panel border border-slate-700/80 rounded-full px-6 py-3.5 flex items-center gap-5 shadow-2xl shadow-slate-950/80 backdrop-blur-2xl">
            {/* Flip Camera */}
            <button
              onClick={onFlipCamera}
              className="p-3 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white transition-all"
              title="Flip Camera"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            {/* Mute Toggle */}
            <button
              onClick={onToggleMute}
              className={`p-3.5 rounded-full transition-all ${
                muted
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white'
              }`}
              title={muted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* End Call Button (Prominent) */}
            <button
              onClick={onEnd}
              className="p-4 rounded-full bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white transition-all shadow-xl shadow-rose-600/50 hover:scale-105 active:scale-95 glow-rose"
              title="End Call"
            >
              <PhoneOff className="w-6 h-6" />
            </button>

            {/* Video Camera Toggle */}
            <button
              onClick={onToggleVideo}
              className={`p-3.5 rounded-full transition-all ${
                !videoEnabled
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white'
              }`}
              title={videoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
            >
              {!videoEnabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>

            {/* Picture-in-Picture */}
            <button
              onClick={togglePip}
              className="p-3 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white transition-all"
              title="Picture in Picture"
            >
              {pictureInPicture ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}