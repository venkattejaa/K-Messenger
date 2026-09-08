import {
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff, RotateCcw, ShieldCheck,
  Maximize2, Minimize2, Sparkles, Volume2, User, Headphones, Crop,
  ChevronDown, MoreVertical, X, Check
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function VideoCallOverlay({
  callState,
  callType,
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
  partnerDisplayName = 'Partner',
}) {
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [pictureInPicture, setPictureInPicture] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [audioRoute, setAudioRoute] = useState('speaker'); // 'speaker' | 'earpiece' | 'bluetooth'
  const [fitMode, setFitMode] = useState('contain'); // 'contain' or 'cover'

  // Draggable & Minimizable Local Video PiP State
  const [position, setPosition] = useState({
    x: typeof window !== 'undefined' ? Math.max(16, window.innerWidth - 210) : 20,
    y: 80,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isLocalMinimized, setIsLocalMinimized] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

  const handlePointerDown = (e) => {
    if (e.target.closest('.no-drag')) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    setIsDragging(true);
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: position.x,
      initialY: position.y,
    };
  };

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!isDragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - dragRef.current.startX;
      const deltaY = clientY - dragRef.current.startY;

      let newX = dragRef.current.initialX + deltaX;
      let newY = dragRef.current.initialY + deltaY;

      const boxWidth = isLocalMinimized ? 56 : 180;
      const boxHeight = isLocalMinimized ? 56 : 220;

      const maxX = Math.max(10, window.innerWidth - boxWidth - 10);
      const maxY = Math.max(10, window.innerHeight - boxHeight - 10);

      newX = Math.max(10, Math.min(newX, maxX));
      newY = Math.max(10, Math.min(newY, maxY));

      setPosition({ x: newX, y: newY });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerUp);
      window.addEventListener('touchmove', handlePointerMove, { passive: false });
      window.addEventListener('touchend', handlePointerUp);
    }

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDragging, isLocalMinimized]);

  // Explicit stream binding on stream or callState change
  useEffect(() => {
    if (localVideoRef?.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch((e) => console.warn('Local video play error:', e));
    }
  }, [localStream, callState, localVideoRef, videoEnabled]);

  useEffect(() => {
    if (remoteVideoRef?.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch((e) => console.warn('Remote video play error:', e));
    }
  }, [remoteStream, callState, remoteVideoRef]);

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
      setIsCallMinimized(false);
      setShowMoreMenu(false);
      // Reset Android audio route when call terminates
      if (window.AndroidNative && typeof window.AndroidNative.setAudioOutputRoute === 'function') {
        try { window.AndroidNative.setAudioOutputRoute('normal'); } catch (e) {}
      }
    }
    return () => clearInterval(interval);
  }, [callState]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const changeAudioRoute = async (route) => {
    setAudioRoute(route);

    // 1. Android Native Audio Manager Bridge
    if (window.AndroidNative && typeof window.AndroidNative.setAudioOutputRoute === 'function') {
      try {
        window.AndroidNative.setAudioOutputRoute(route);
      } catch (e) {
        console.warn('AndroidNative setAudioOutputRoute error:', e);
      }
    }

    // 2. HTML5 MediaElement SinkId for Web Browsers
    const mediaEl = remoteVideoRef?.current || document.querySelector('audio');
    if (mediaEl && typeof mediaEl.setSinkId === 'function') {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');
        if (audioOutputs.length > 0) {
          let targetDevice = null;
          if (route === 'earpiece') {
            targetDevice = audioOutputs.find((d) =>
              d.label.toLowerCase().includes('earpiece') || d.label.toLowerCase().includes('receiver')
            ) || audioOutputs[0];
          } else if (route === 'bluetooth') {
            targetDevice = audioOutputs.find((d) =>
              d.label.toLowerCase().includes('bluetooth') ||
              d.label.toLowerCase().includes('headset') ||
              d.label.toLowerCase().includes('buds') ||
              d.label.toLowerCase().includes('hands-free')
            ) || audioOutputs.find((d) => d.deviceId !== 'default');
          } else {
            targetDevice = audioOutputs.find((d) =>
              d.label.toLowerCase().includes('speaker')
            ) || audioOutputs[0];
          }

          if (targetDevice?.deviceId) {
            await mediaEl.setSinkId(targetDevice.deviceId);
          }
        }
      } catch (err) {
        console.warn('setSinkId error:', err);
      }
    }
  };

  const togglePip = async () => {
    if (!localVideoRef?.current) return;
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
  const isAudioCall = callType === 'audio' || (!videoEnabled && !localStream?.getVideoTracks()?.length);

  // -------------------------------------------------------------
  // MINIMIZED CALL BANNER PILL (Allows user to chat during call)
  // -------------------------------------------------------------
  if (isCallMinimized && isActive) {
    return (
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 animate-fadeIn font-sans">
        <div className="bg-slate-900/95 border border-indigo-500/50 rounded-full px-4 py-2 flex items-center gap-3 shadow-2xl backdrop-blur-xl glow-indigo text-xs text-white">
          <div
            onClick={() => setIsCallMinimized(false)}
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 active:scale-95 transition-transform"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-extrabold text-white">{partnerDisplayName}</span>
            <span className="text-slate-400 font-mono">{formatDuration(callDuration)}</span>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-0.5" />

          {/* Quick Mute */}
          <button
            type="button"
            onClick={onToggleMute}
            className={`p-1.5 rounded-full transition-all ${
              muted ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>

          {/* End Call */}
          <button
            type="button"
            onClick={onEnd}
            className="p-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-all active:scale-95"
            title="End Call"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>

          {/* Expand Fullscreen */}
          <button
            type="button"
            onClick={() => setIsCallMinimized(false)}
            className="p-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all active:scale-95"
            title="Expand Full Screen Call"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // FULL SCREEN CALL OVERLAY
  // -------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden animate-fadeIn font-sans select-none">
      
      {/* Remote Video Container & Audio Element */}
      <div className={`relative w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden ${isAudioCall ? 'hidden' : 'block'}`}>
        {/* Blurred Background video fill */}
        {fitMode === 'contain' && (
          <video
            ref={(el) => {
              if (el && remoteStream) {
                el.srcObject = remoteStream;
                el.play().catch((e) => console.warn('Background blur video error:', e));
              }
            }}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-40 scale-125 pointer-events-none"
          />
        )}

        {/* Main Remote Video element */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`relative z-10 w-full h-full ${
            fitMode === 'contain' ? 'object-contain' : 'object-cover'
          }`}
        />
      </div>

      {/* Dedicated Remote Audio Player for Audio Calls */}
      {isAudioCall && (
        <audio
          ref={(el) => {
            if (el && remoteStream) {
              el.srcObject = remoteStream;
              el.play().catch((e) => console.warn('Remote audio play error:', e));
            }
          }}
          autoPlay
          playsInline
        />
      )}

      {/* Audio Call Interface Background */}
      {isAudioCall && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#0B0F17] via-[#111827] to-[#0B0F17] z-10 px-4">
          {/* 3-Option Audio Output Selector: Ear Speaker (Proximity), Speaker, Bluetooth / Buds */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 p-1.5 rounded-full text-xs font-semibold backdrop-blur-md mb-8 shadow-xl">
            <button
              type="button"
              onClick={() => changeAudioRoute('earpiece')}
              className={`px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all ${
                audioRoute === 'earpiece'
                  ? 'bg-indigo-600 text-white shadow-md glow-indigo font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Ear Speaker near proximity sensor"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Ear Speaker</span>
            </button>

            <button
              type="button"
              onClick={() => changeAudioRoute('speaker')}
              className={`px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all ${
                audioRoute === 'speaker'
                  ? 'bg-emerald-600 text-white shadow-md glow-emerald font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Main Speakerphone"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Speaker</span>
            </button>

            <button
              type="button"
              onClick={() => changeAudioRoute('bluetooth')}
              className={`px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all ${
                audioRoute === 'bluetooth'
                  ? 'bg-purple-600 text-white shadow-md glow-purple font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Bluetooth Headset or Earbuds"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Bluetooth / Buds</span>
            </button>
          </div>

          {/* Animated Avatar Aura */}
          <div className="relative w-44 h-44 sm:w-56 sm:h-56 flex items-center justify-center mb-6">
            {isActive && (
              <>
                <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
                <div className="absolute inset-3 rounded-full bg-purple-500/20 animate-pulse" />
              </>
            )}
            <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 p-1 shadow-2xl shadow-purple-500/30">
              <div className="w-full h-full rounded-full bg-[#0F172A] flex items-center justify-center border-4 border-slate-900 overflow-hidden">
                <User className="w-16 h-16 sm:w-20 sm:h-20 text-purple-300" />
              </div>
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 tracking-tight">
            {partnerDisplayName}
          </h2>

          <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>
              {isCalling ? 'Ringing...' : isIncoming ? 'Incoming Audio Call...' : formatDuration(callDuration)}
            </span>
          </p>
        </div>
      )}

      {/* Calling & Incoming Overlay Screens */}
      {(isCalling || isIncoming) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-2xl z-20">
          <div className="absolute w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />

          {/* Outgoing Calling State */}
          {isCalling && (
            <div className="text-center relative z-10">
              <div className="relative w-28 h-28 mx-auto mb-8 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500/30 animate-ping" />
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/30 glow-indigo">
                  {callType === 'audio' ? (
                    <Phone className="w-10 h-10 text-white animate-pulse" />
                  ) : (
                    <Video className="w-10 h-10 text-white animate-pulse" />
                  )}
                </div>
              </div>
              <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
                {callType === 'audio' ? 'Calling (Audio)...' : 'Calling (Video)...'}
              </h2>
              <p className="text-slate-400 text-sm font-medium">Establishing HD WebRTC Connection</p>
              <div className="mt-8">
                <button
                  type="button"
                  onClick={onEnd}
                  className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 flex items-center justify-center text-white transition-all shadow-lg shadow-rose-600/40 hover:scale-105 active:scale-95 glow-rose"
                  title="Cancel Call"
                >
                  <PhoneOff className="w-7 h-7" />
                </button>
              </div>
            </div>
          )}

          {/* Incoming Call State */}
          {isIncoming && (
            <div className="text-center relative z-10 max-w-sm px-6">
              <div className="relative w-28 h-28 mx-auto mb-8 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ripple" />
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-500/40 glow-emerald">
                  {callType === 'audio' ? (
                    <Phone className="w-10 h-10 text-white animate-bounce" />
                  ) : (
                    <Video className="w-10 h-10 text-white animate-bounce" />
                  )}
                </div>
              </div>
              <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
                {callType === 'audio' ? 'Incoming Audio Call' : 'Incoming Video Call'}
              </h2>
              <p className="text-slate-400 text-sm font-medium mb-10">Encrypted WebRTC P2P Call</p>

              <div className="flex items-center justify-center gap-8">
                <button type="button" onClick={onAccept} className="group flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white transition-all shadow-lg shadow-emerald-500/40 group-hover:scale-110 active:scale-95 glow-emerald">
                    <Phone className="w-7 h-7" />
                  </div>
                  <span className="text-xs font-semibold text-emerald-400">Accept</span>
                </button>

                <button type="button" onClick={onEnd} className="group flex flex-col items-center gap-2">
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

      {/* Active Call - Top Bar with Minimize Button & Status */}
      {isActive && (
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-30">
          {/* Minimize Call Button */}
          <button
            type="button"
            onClick={() => setIsCallMinimized(true)}
            className="px-3.5 py-2 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-white text-xs font-bold transition-all shadow-lg flex items-center gap-1.5 active:scale-95 cursor-pointer backdrop-blur-md"
            title="Minimize Call to Chat"
          >
            <ChevronDown className="w-4 h-4 text-indigo-400" />
            <span>Minimize</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="glass-panel px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-200 border border-slate-700/60 shadow-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>{formatDuration(callDuration)}</span>
            </span>
          </div>
        </div>
      )}

      {/* Draggable Local Video PiP */}
      {isActive && videoEnabled && !isAudioCall && !pictureInPicture && (
        isLocalMinimized ? (
          <div
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
            onMouseDown={handlePointerDown}
            onTouchStart={handlePointerDown}
            className="fixed z-40 cursor-grab active:cursor-grabbing select-none animate-fadeIn"
          >
            <button
              type="button"
              onClick={() => setIsLocalMinimized(false)}
              className="no-drag w-12 h-12 rounded-full bg-slate-900/90 border-2 border-indigo-500 shadow-2xl flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all glow-indigo cursor-pointer"
              title="Expand My Video"
            >
              <Video className="w-5 h-5 text-indigo-400" />
            </button>
          </div>
        ) : (
          <div
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
            onMouseDown={handlePointerDown}
            onTouchStart={handlePointerDown}
            className="fixed z-40 w-36 sm:w-52 aspect-[3/4] sm:aspect-video rounded-2xl overflow-hidden border-2 border-indigo-500/60 bg-slate-950 shadow-2xl cursor-grab active:cursor-grabbing select-none glow-indigo group animate-fadeIn"
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover pointer-events-none"
            />

            <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
              <span className="px-2 py-0.5 rounded-md bg-slate-950/85 backdrop-blur-md text-[10px] font-extrabold text-slate-100 border border-slate-800">
                You
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLocalMinimized(true);
                }}
                className="no-drag pointer-events-auto p-1 rounded-md bg-slate-950/85 hover:bg-rose-600/90 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-800"
                title="Minimize My Video"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )
      )}

      {/* Floating Modern Call Controls Bar */}
      {isActive && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
          {/* Primary Bottom Bar */}
          <div className="glass-panel border border-slate-700/80 rounded-full px-5 sm:px-6 py-3 flex items-center gap-3 sm:gap-4 shadow-2xl shadow-slate-950/80 backdrop-blur-2xl">
            
            {/* 1. Reverse / Flip Camera (Video calls only) */}
            {videoEnabled && !isAudioCall && (
              <button
                type="button"
                onClick={onFlipCamera}
                className="p-3 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white transition-all cursor-pointer active:scale-95"
                title="Flip Camera"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            )}

            {/* 2. Mute Microphone */}
            <button
              type="button"
              onClick={onToggleMute}
              className={`p-3 rounded-full transition-all cursor-pointer active:scale-95 ${
                muted
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200'
              }`}
              title={muted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* 3. Turn On/Off Camera (Video calls only) */}
            {!isAudioCall && (
              <button
                type="button"
                onClick={onToggleVideo}
                className={`p-3 rounded-full transition-all cursor-pointer active:scale-95 ${
                  !videoEnabled
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200'
                }`}
                title={videoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
              >
                {!videoEnabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>
            )}

            {/* 4. End Call Button (Prominent Red) */}
            <button
              type="button"
              onClick={onEnd}
              className="p-3.5 sm:p-4 rounded-full bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white transition-all shadow-xl shadow-rose-600/50 hover:scale-105 active:scale-95 glow-rose cursor-pointer"
              title="End Call"
            >
              <PhoneOff className="w-6 h-6" />
            </button>

          </div>
        </div>
      )}
    </div>
  );
}