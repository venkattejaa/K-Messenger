import { useState, useRef, useEffect, useCallback } from 'react';

const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useVideoCall(sendSignal, userId) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callState, setCallState] = useState('idle'); // idle, calling, incoming, active
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

  const getUserMedia = useCallback(async (constraints = {}) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 }, 
          facingMode: constraints.facingMode || facingModeRef.current 
        },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('getUserMedia error:', err);
      setError('Camera/microphone access required for video call');
      throw err;
    }
  }, []);

  const endCall = useCallback((notifyRemote = true) => {
    console.log('Ending call');
    
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
    setMuted(false);
    setVideoEnabled(true);
  }, [callState, localStream, sendSignal]);

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
      console.log('Received remote track:', event.streams[0]);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state change:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallState('active');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        endCall(false);
      }
    };

    return pc;
  }, [sendSignal, endCall]);

  const startCall = useCallback(async () => {
    try {
      setError(null);
      isCallerRef.current = true;
      setCallState('calling');

      const stream = await getUserMedia();
      const pc = createPeerConnection();

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal('offer', offer);
    } catch (err) {
      console.error('Start call error:', err);
      setError('Failed to start call');
      endCall(true);
    }
  }, [getUserMedia, createPeerConnection, sendSignal, endCall]);

  const acceptCall = useCallback(async () => {
    if (!incomingOfferRef.current) {
      console.error('No incoming offer to accept');
      return;
    }

    try {
      setError(null);
      isCallerRef.current = false;
      
      const stream = await getUserMedia();
      const pc = createPeerConnection();

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      const offer = incomingOfferRef.current;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Process any pending ICE candidates
      while (pendingCandidatesRef.current.length > 0) {
        const candidate = pendingCandidatesRef.current.shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('Error adding queued ICE candidate:', e);
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal('answer', answer);

      setCallState('active');
    } catch (err) {
      console.error('Accept call error:', err);
      setError('Failed to accept call');
      endCall(true);
    }
  }, [getUserMedia, createPeerConnection, sendSignal, endCall]);

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
          incomingOfferRef.current = data;
          setCallState('incoming');
          break;

        case 'answer':
          if (isCallerRef.current && peerConnectionRef.current) {
            const pc = peerConnectionRef.current;
            await pc.setRemoteDescription(new RTCSessionDescription(data));
            
            // Flush queued candidates
            while (pendingCandidatesRef.current.length > 0) {
              const candidate = pendingCandidatesRef.current.shift();
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (e) {
                console.warn('Error adding queued candidate after answer:', e);
              }
            }
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
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setVideoEnabled(!videoTracks[0]?.enabled);
    }
  }, [localStream]);

  // Flip Camera
  const flipCamera = useCallback(async () => {
    if (!localStream) return;
    try {
      const newFacingMode = facingModeRef.current === 'user' ? 'environment' : 'user';
      facingModeRef.current = newFacingMode;
      
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => track.stop());
      
      const newStream = await getUserMedia({ facingMode: newFacingMode });
      
      if (peerConnectionRef.current) {
        const sender = peerConnectionRef.current.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        if (sender && newStream.getVideoTracks()[0]) {
          await sender.replaceTrack(newStream.getVideoTracks()[0]);
        }
      }
    } catch (err) {
      console.error('Flip camera error:', err);
    }
  }, [localStream, getUserMedia]);

  // Attach local stream to ref
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream to ref
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return {
    localStream,
    remoteStream,
    callState,
    error,
    localVideoRef,
    remoteVideoRef,
    startCall,
    acceptCall,
    endCall,
    handleSignal,
    setError,
    muted,
    videoEnabled,
    toggleMute,
    toggleVideo,
    flipCamera,
  };
}