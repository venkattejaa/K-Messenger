import { useState, useRef, useEffect, useCallback } from 'react';

const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

function setHighQualityAudioSDP(sdp) {
  if (!sdp) return sdp;
  try {
    const match = sdp.match(/a=rtpmap:(\d+) opus\/48000/i);
    if (match && match[1]) {
      const pt = match[1];
      const fmtpRegex = new RegExp(`a=fmtp:${pt} (.*)`, 'g');
      if (sdp.match(fmtpRegex)) {
        return sdp.replace(fmtpRegex, `a=fmtp:${pt} $1;maxaveragebitrate=128000;useinbandfec=1`);
      }
    }
  } catch (e) {
    console.warn('SDP formatting warning:', e);
  }
  return sdp;
}

export function useVideoCall(sendSignal, userId, onSendChatMessage) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callState, setCallState] = useState('idle'); // idle, calling, incoming, active
  const [callType, setCallType] = useState('video'); // 'video' | 'audio'
  const [error, setError] = useState(null);
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);

  const peerConnectionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const isCallerRef = useRef(false);
  const pendingCandidatesRef = useRef([]);
  const incomingOfferRef = useRef(null);
  const facingModeRef = useRef('user');
  const callStartTimeRef = useRef(null);

  // Flexible mobile & desktop camera acquisition
  const getUserMedia = useCallback(async (isAudioOnly = false, constraints = {}) => {
    try {
      const targetFacingMode = constraints.facingMode || facingModeRef.current || 'user';
      const videoConstraint = isAudioOnly
        ? false
        : {
            facingMode: targetFacingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          };

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 2 },
        },
      });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('getUserMedia error:', err);
      setError('Microphone/Camera access required for call');
      throw err;
    }
  }, []);

  const endCall = useCallback((notifyRemote = true) => {
    console.log('Ending WebRTC call');
    
    // Log call record in chat if call was active/calling
    if (onSendChatMessage && callState !== 'idle' && isCallerRef.current) {
      let dur = 0;
      let status = 'completed';
      if (callState === 'active' && callStartTimeRef.current) {
        dur = Math.max(1, Math.floor((Date.now() - callStartTimeRef.current) / 1000));
        status = 'completed';
      } else if (callState === 'calling') {
        status = 'unanswered';
      } else if (callState === 'incoming') {
        status = 'missed';
      }
      onSendChatMessage(`CALL_RECORD:${callType}:${dur}:${status}`);
    }

    if (notifyRemote && callState !== 'idle') {
      try {
        sendSignal('hangup', {});
      } catch (e) {
        console.error('Failed to send hangup signal:', e);
      }
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    setRemoteStream(null);
    setCallState('idle');
    isCallerRef.current = false;
    pendingCandidatesRef.current = [];
    incomingOfferRef.current = null;
    callStartTimeRef.current = null;
    setMuted(false);
    setVideoEnabled(true);
  }, [callState, localStream, sendSignal, onSendChatMessage, callType]);

  const flushCandidates = async (pc) => {
    while (pendingCandidatesRef.current.length > 0) {
      const candidate = pendingCandidatesRef.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('ICE candidate addition warning:', e);
      }
    }
  };

  const createPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection(STUN_SERVERS);
    peerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal('ice-candidate', event.candidate.toJSON());
      }
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.streams[0]);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.play().catch(e => console.warn('Remote video play error:', e));
        }
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('WebRTC Connection state change:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        callStartTimeRef.current = Date.now();
        setCallState('active');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        endCall(false);
      }
    };

    return pc;
  }, [sendSignal, endCall]);

  const startCall = useCallback(async (requestedCallType = 'video') => {
    try {
      setError(null);
      isCallerRef.current = true;
      setCallState('calling');
      setCallType(requestedCallType);

      const isAudioOnly = requestedCallType === 'audio';
      setVideoEnabled(!isAudioOnly);

      const stream = await getUserMedia(isAudioOnly);
      const pc = createPeerConnection();

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      offer.sdp = setHighQualityAudioSDP(offer.sdp);
      await pc.setLocalDescription(offer);

      sendSignal('offer', {
        sdp: offer,
        call_type: requestedCallType,
      });

      if (onSendChatMessage) {
        onSendChatMessage(`CALL_SIGNAL:offer:${requestedCallType}:${JSON.stringify(offer)}`);
      }
    } catch (err) {
      console.error('Start call error:', err);
      setError('Failed to start call');
      endCall(true);
    }
  }, [getUserMedia, createPeerConnection, sendSignal, endCall, onSendChatMessage]);

  const acceptCall = useCallback(async () => {
    if (!incomingOfferRef.current) {
      console.error('No incoming offer to accept');
      return;
    }

    try {
      setError(null);
      isCallerRef.current = false;
      const isAudioOnly = callType === 'audio';

      const stream = await getUserMedia(isAudioOnly);
      const pc = createPeerConnection();

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      const offer = incomingOfferRef.current;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Flush queued candidates after setRemoteDescription
      await flushCandidates(pc);

      const answer = await pc.createAnswer();
      answer.sdp = setHighQualityAudioSDP(answer.sdp);
      await pc.setLocalDescription(answer);
      sendSignal('answer', answer);

      setCallState('active');
    } catch (err) {
      console.error('Accept call error:', err);
      setError('Failed to accept call');
      endCall(true);
    }
  }, [callType, getUserMedia, createPeerConnection, sendSignal, endCall]);

  // Handle incoming WebSocket signals
  const handleSignal = useCallback(async (signalType, data, fromClientId) => {
    console.log(`[WebRTC] Received signal: ${signalType}`, data);

    try {
      switch (signalType) {
        case 'offer':
          if (callState !== 'idle') {
            sendSignal('hangup', { reason: 'busy' });
            return;
          }

          const offerSdp = data.sdp || data;
          const incomingCallType = data.call_type || 'video';

          incomingOfferRef.current = offerSdp;
          setCallType(incomingCallType);
          setVideoEnabled(incomingCallType !== 'audio');
          setCallState('incoming');
          break;

        case 'answer':
          if (isCallerRef.current && peerConnectionRef.current) {
            const pc = peerConnectionRef.current;
            await pc.setRemoteDescription(new RTCSessionDescription(data));
            await flushCandidates(pc);
            setCallState('active');
          }
          break;

        case 'ice-candidate':
          if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
            try {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data));
            } catch (e) {
              console.warn('Error adding ICE candidate directly, queuing:', e);
              pendingCandidatesRef.current.push(data);
            }
          } else {
            pendingCandidatesRef.current.push(data);
          }
          break;

        case 'hangup':
          endCall(false);
          break;

        default:
          break;
      }
    } catch (err) {
      console.error(`Handle ${signalType} error:`, err);
      setError('Signaling error during call');
      endCall(false);
    }
  }, [callState, sendSignal, endCall]);

  // Toggle Mute
  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setMuted(!audioTracks[0]?.enabled);
    }
  }, [localStream]);

  // Toggle Video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        const nextState = !videoTracks[0].enabled;
        videoTracks.forEach(track => {
          track.enabled = nextState;
        });
        setVideoEnabled(nextState);

        if (nextState && localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
          localVideoRef.current.play().catch(e => console.warn('Local video play error:', e));
        }
      } else if (!videoEnabled) {
        // Upgrade audio call to video call dynamically
        navigator.mediaDevices.getUserMedia({ video: { facingMode: facingModeRef.current || 'user' } }).then(vStream => {
          const newTrack = vStream.getVideoTracks()[0];
          if (newTrack) {
            localStream.addTrack(newTrack);
            if (peerConnectionRef.current) {
              peerConnectionRef.current.addTrack(newTrack, localStream);
            }
            setVideoEnabled(true);
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = localStream;
              localVideoRef.current.play().catch(e => console.warn(e));
            }
          }
        }).catch(e => console.error("Failed to enable video:", e));
      }
    }
  }, [localStream, videoEnabled]);

  // Flip Camera for Mobile Phones (Front / Back camera switch)
  const flipCamera = useCallback(async () => {
    if (!localStream) return;
    const newFacingMode = facingModeRef.current === 'user' ? 'environment' : 'user';
    facingModeRef.current = newFacingMode;

    try {
      const oldVideoTrack = localStream.getVideoTracks()[0];
      if (oldVideoTrack) oldVideoTrack.stop();

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (newVideoTrack) {
        if (oldVideoTrack) localStream.removeTrack(oldVideoTrack);
        localStream.addTrack(newVideoTrack);

        if (peerConnectionRef.current) {
          const sender = peerConnectionRef.current.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(newVideoTrack);
          } else {
            peerConnectionRef.current.addTrack(newVideoTrack, localStream);
          }
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
          localVideoRef.current.play().catch(e => console.warn(e));
        }
      }
    } catch (err) {
      console.error('Flip camera error:', err);
    }
  }, [localStream]);

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.warn('Local video play error:', e));
    }
  }, [localStream]);

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(e => console.warn('Remote video play error:', e));
    }
  }, [remoteStream]);

  return {
    localStream,
    remoteStream,
    callState,
    callType,
    error,
    localVideoRef,
    remoteVideoRef,
    startCall,
    acceptCall,
    endCall,
    handleSignal,
    muted,
    videoEnabled,
    toggleMute,
    toggleVideo,
    flipCamera,
  };
}