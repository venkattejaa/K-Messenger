import {
  MessageSquare, Image, Video, Phone, Send, Loader2, ShieldCheck, User,
  CheckCheck, Paperclip, Settings, Layers, Heart, Smile, Sparkles, Info,
  Edit3, Volume2, VolumeX, Mic, Square, Play, Pause, Trash2, Check, X, MoreVertical, Copy, Reply, Download
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import NicknameModal from './NicknameModal';
import { playNotificationSound } from '../utils/notificationSound';
import { sendBrowserNotification } from '../utils/browserNotifications';
import { apiGetMuteSetting, apiSaveMuteSetting } from '../services/supabaseService';

const QUICK_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

function formatSeenAgo(seenIso) {
  if (!seenIso) return null;
  const seenTime = new Date(seenIso).getTime();
  if (isNaN(seenTime)) return null;
  const now = Date.now();
  const diffSec = Math.floor((now - seenTime) / 1000);
  if (diffSec < 45) return 'Seen just now';
  if (diffSec < 3600) return `Seen ${Math.floor(diffSec / 60)}m ago`;
  const d = new Date(seenIso);
  return `Seen ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function AudioPlayerBubble({ src, isMe }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((e) => console.error('Audio playback error:', e));
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const cur = audioRef.current.currentTime || 0;
    let dur = audioRef.current.duration;
    if (dur && isFinite(dur) && !isNaN(dur) && dur > 0) {
      if (dur !== duration) setDuration(dur);
    } else {
      dur = Math.max(duration, cur || 1);
    }
    setCurrentTime(cur);
    if (cur > duration) {
      setDuration(cur);
    }
    setProgress(dur > 0 ? (cur / dur) * 100 : 0);
  };

  const updateDurationFromAudio = () => {
    if (audioRef.current) {
      let dur = audioRef.current.duration;
      if (dur === Infinity || isNaN(dur) || !isFinite(dur)) {
        // WebM blob duration calculation fix: seek to end to read true duration
        audioRef.current.currentTime = 1e101;
        audioRef.current.ontimeupdate = () => {
          audioRef.current.ontimeupdate = handleTimeUpdate;
          const realDur = audioRef.current.duration;
          if (realDur && isFinite(realDur) && !isNaN(realDur) && realDur > 0) {
            setDuration(realDur);
          } else {
            setDuration(audioRef.current.currentTime || 0);
          }
          audioRef.current.currentTime = 0;
        };
      } else if (dur && dur > 0) {
        setDuration(dur);
      }
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    if (audioRef.current && audioRef.current.currentTime > 0) {
      setDuration((prev) => Math.max(prev, audioRef.current.currentTime));
    }
  };

  const formatSeconds = (sec) => {
    if (isNaN(sec) || !isFinite(sec) || sec <= 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex items-center gap-3 py-1 px-1 min-w-[200px] sm:min-w-[240px]">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={updateDurationFromAudio}
        onDurationChange={updateDurationFromAudio}
        onEnded={handleEnded}
        preload="auto"
      />
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-95 shadow-md ${
          isMe
            ? 'bg-white text-purple-600 hover:bg-slate-100'
            : 'bg-purple-600 text-white hover:bg-purple-500'
        }`}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>

      <div className="flex-1 flex flex-col gap-1">
        {/* Visualizer Waveform Bar */}
        <div className="flex items-center gap-0.5 h-6">
          {[40, 70, 30, 90, 50, 80, 100, 40, 60, 85, 45, 75, 35, 95, 60, 40, 80, 50].map((h, i) => {
            const active = (i / 18) * 100 <= progress;
            return (
              <div
                key={i}
                style={{ height: `${h}%` }}
                className={`w-1 rounded-full transition-colors ${
                  active
                    ? isMe ? 'bg-white' : 'bg-purple-400'
                    : isMe ? 'bg-white/30' : 'bg-slate-700'
                }`}
              />
            );
          })}
        </div>
        <div className={`flex justify-between text-[10px] font-semibold ${isMe ? 'text-pink-100/90' : 'text-slate-400'}`}>
          <span>{formatSeconds(currentTime)}</span>
          <span>{duration > 0 ? formatSeconds(duration) : 'Voice note'}</span>
        </div>
      </div>
    </div>
  );
}

export default function ChatPanel({
  messages,
  onSendMessage,
  onStartCall,
  onUpload,
  uploading,
  currentUserId,
  username,
  connected,
  userProfile,
  partnerUser,
  onlineUserIds = [],
  onOpenProfile,
  mobileActiveTab,
  onSelectMobileTab,
  customNickname,
  onSaveNickname,
  onReactMessage,
  onClearChat,
  onUnsendMessage,
  onEditMessage,
  onMarkAllSeen,
  onToggleMemoryLane,
  showMemoryLane,
  isPartnerTyping,
  onSendTypingStatus,
}) {
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const isInitialLoadRef = useRef(true);
  const [newMessage, setNewMessage] = useState('');
  const [lightboxImage, setLightboxImage] = useState(null);
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);

  // Voice Note Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // Inline Message Editing, Reply & Actions State
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [activeActionMsgId, setActiveActionMsgId] = useState(null);
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [replyingToMsg, setReplyingToMsg] = useState(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState(null);
  const inputRef = useRef(null);

  const defaultPartnerName =
    currentUserId === 1 || username?.toLowerCase() === 'venkattejaa'
      ? 'Srevarsha'
      : currentUserId === 2 || username?.toLowerCase() === 'srevarsha' || username?.toLowerCase() === 'chinni_is_buzy'
      ? 'Venkat Teja'
      : currentUserId === 3 || username?.toLowerCase() === 'tester1'
      ? 'Tester 2'
      : currentUserId === 4 || username?.toLowerCase() === 'tester2'
      ? 'Tester 1'
      : 'Contact';

  const myDisplayName = userProfile?.display_name || username || 'You';
  const partnerOriginalName = partnerUser?.display_name || partnerUser?.username || defaultPartnerName;
  const partnerDisplayName = customNickname || partnerOriginalName;

  const partnerIdNum = partnerUser?.user_id || (currentUserId === 1 ? 2 : currentUserId === 2 ? 1 : currentUserId === 3 ? 4 : currentUserId === 4 ? 3 : null);
  const isPartnerOnline = partnerIdNum && onlineUserIds.includes(String(partnerIdNum));

  const handleStartReply = (msg) => {
    setReplyingToMsg(msg);
    setActiveActionMsgId(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleJumpToMessage = (msgId) => {
    if (!msgId) return;
    const targetStr = String(msgId);
    const el = document.getElementById(`msg-${targetStr}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(targetStr);
      setTimeout(() => setHighlightedMsgId(null), 2500);
    }
  };

  const isAudioMedia = (url) => {
    if (!url) return false;
    const l = url.toLowerCase();
    return (
      l.endsWith('.webm') ||
      l.endsWith('.mp3') ||
      l.endsWith('.wav') ||
      l.endsWith('.m4a') ||
      l.endsWith('.ogg') ||
      l.endsWith('.aac') ||
      l.endsWith('.flac') ||
      l.includes('voicenote') ||
      l.includes('audio_')
    );
  };

  const isVideoMedia = (url) => {
    if (!url) return false;
    const l = url.toLowerCase();
    return (
      l.endsWith('.mp4') ||
      l.endsWith('.mov') ||
      l.endsWith('.mkv') ||
      l.endsWith('.avi') ||
      l.includes('video_')
    );
  };

  const isImageMedia = (url) => {
    if (!url) return false;
    const l = url.toLowerCase().split('?')[0];
    return (
      l.endsWith('.jpg') ||
      l.endsWith('.jpeg') ||
      l.endsWith('.png') ||
      l.endsWith('.gif') ||
      l.endsWith('.webp') ||
      l.endsWith('.heic') ||
      l.endsWith('.heif') ||
      l.endsWith('.bmp') ||
      l.endsWith('.svg') ||
      l.includes('image_') ||
      l.includes('photo_') ||
      l.includes('img_')
    );
  };

  const getAudioUrl = (msg) => {
    if (!msg) return null;
    if (msg.media_url && isAudioMedia(msg.media_url)) return msg.media_url;
    if (msg.text_content && isAudioMedia(msg.text_content)) return msg.text_content;
    return null;
  };

  const getVideoUrl = (msg) => {
    if (!msg) return null;
    if (msg.media_url && isVideoMedia(msg.media_url)) return msg.media_url;
    if (msg.text_content && isVideoMedia(msg.text_content)) return msg.text_content;
    return null;
  };

  const getImageUrl = (msg) => {
    if (!msg) return null;
    if (msg.media_url && !isAudioMedia(msg.media_url) && !isVideoMedia(msg.media_url)) {
      return msg.media_url;
    }
    if (msg.text_content) {
      const trimmed = msg.text_content.trim();
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        if (!isAudioMedia(trimmed) && !isVideoMedia(trimmed)) {
          if (isImageMedia(trimmed) || trimmed.includes('/chat_media/') || trimmed.includes('/chat_uploads/')) {
            return trimmed;
          }
        }
      }
    }
    return null;
  };

  const getMediaUrl = (msg) => {
    return getAudioUrl(msg) || getVideoUrl(msg) || getImageUrl(msg);
  };

  const handleDownloadMedia = async (url) => {
    if (!url) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const ext = url.split('.').pop()?.split('?')[0] || 'file';
      a.download = `KMessenger_${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.warn('Direct fetch download failed, opening in new window:', err);
      window.open(url, '_blank');
    }
  };

  const handleCopyText = (msg) => {
    const text = msg.text_content || msg.media_url || '';
    if (text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch((err) => {
          console.error('Failed to copy text:', err);
        });
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
        } catch (e) {
          console.error('Fallback copy failed:', e);
        }
        document.body.removeChild(textArea);
      }
      setCopiedMsgId(msg.id || msg.temp_id || 'copied');
      setTimeout(() => {
        setCopiedMsgId(null);
      }, 2000);
    }
    setActiveActionMsgId(null);
  };

  // Touch Long-press & Popover Placement
  const [popoverPlacement, setPopoverPlacement] = useState('up'); // 'up' | 'down'
  const touchTimerRef = useRef(null);

  const toggleActionMenu = (msgId, eOrTarget) => {
    if (eOrTarget && eOrTarget.stopPropagation) eOrTarget.stopPropagation();
    if (activeActionMsgId === msgId) {
      setActiveActionMsgId(null);
      return;
    }
    let placement = 'up';
    const target = eOrTarget?.currentTarget || eOrTarget?.target || eOrTarget;
    if (target && target.getBoundingClientRect) {
      const rect = target.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.48) {
        placement = 'down';
      }
    }
    setPopoverPlacement(placement);
    setActiveActionMsgId(msgId);
  };

  const handleTouchStart = (msgId, e) => {
    const target = e?.currentTarget;
    touchTimerRef.current = setTimeout(() => {
      toggleActionMenu(msgId, target);
      if ('vibrate' in navigator) {
        try { navigator.vibrate(40); } catch(err) {}
      }
    }, 380);
  };

  const handleTouchEndOrMove = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  // Mute Notifications State (Synced with Supabase & LocalStorage per User ID)
  const [isMuted, setIsMuted] = useState(() => {
    if (!currentUserId) return localStorage.getItem('kmessenger_muted_notifications') === 'true';
    const stored = localStorage.getItem(`kmessenger_muted_${currentUserId}`);
    return stored !== null ? stored === 'true' : localStorage.getItem('kmessenger_muted_notifications') === 'true';
  });

  // Fetch persistent mute setting from Supabase when logged in
  useEffect(() => {
    if (!currentUserId) return;
    apiGetMuteSetting(currentUserId)
      .then((dbMuted) => {
        if (dbMuted !== null) {
          setIsMuted(dbMuted);
          localStorage.setItem(`kmessenger_muted_${currentUserId}`, String(dbMuted));
          localStorage.setItem('kmessenger_muted_notifications', String(dbMuted));
        }
      })
      .catch((err) => console.error('Failed to sync mute setting:', err));
  }, [currentUserId]);

  const toggleMuteNotifications = () => {
    setIsMuted((prev) => {
      const next = !prev;
      if (currentUserId) {
        localStorage.setItem(`kmessenger_muted_${currentUserId}`, String(next));
        localStorage.setItem('kmessenger_muted_notifications', String(next));
        apiSaveMuteSetting(currentUserId, next).catch((err) => console.error('Failed to save mute setting:', err));
      }
      return next;
    });
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Close active action popup on outside click/tap
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveActionMsgId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Mark unread messages as seen whenever app is active and visible on mobile & desktop
  useEffect(() => {
    const handleCheckVisibilityAndMarkSeen = () => {
      if (document.visibilityState === 'visible' && onMarkAllSeen) {
        onMarkAllSeen();
      }
    };

    handleCheckVisibilityAndMarkSeen();

    window.addEventListener('focus', handleCheckVisibilityAndMarkSeen);
    document.addEventListener('visibilitychange', handleCheckVisibilityAndMarkSeen);
    window.addEventListener('touchstart', handleCheckVisibilityAndMarkSeen, { passive: true });

    return () => {
      window.removeEventListener('focus', handleCheckVisibilityAndMarkSeen);
      document.removeEventListener('visibilitychange', handleCheckVisibilityAndMarkSeen);
      window.removeEventListener('touchstart', handleCheckVisibilityAndMarkSeen);
    };
  }, [onMarkAllSeen, messages]);

  // Sound Chime & Browser Notification on incoming messages (ignores initial page load/refresh)
  useEffect(() => {
    if (isInitialLoadRef.current) {
      if (messages.length > 0) {
        isInitialLoadRef.current = false;
      }
      prevMessagesLengthRef.current = messages.length;
      return;
    }

    if (messages.length > prevMessagesLengthRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && Number(lastMsg.sender_id) === Number(partnerIdNum) && !isMuted) {
        // Skip text notification chime for call signaling/records
        if (lastMsg.text_content && (lastMsg.text_content.startsWith('CALL_SIGNAL:') || lastMsg.text_content.startsWith('CALL_RECORD:'))) {
          prevMessagesLengthRef.current = messages.length;
          return;
        }

        playNotificationSound();
        const senderName = customNickname || partnerUser?.display_name || partnerUser?.username || defaultPartnerName;
        
        let bodyText = lastMsg.text_content || 'Sent an attachment';
        if (lastMsg.media_url && isAudioMedia(lastMsg.media_url)) {
          bodyText = '🎤 Sent a voice note';
        } else if (lastMsg.media_url) {
          bodyText = '📷 Sent a photo';
        }

        const replyMeta = lastMsg.reactions?._reply;
        if (replyMeta) {
          bodyText = `↩️ Replying: ${bodyText}`;
        }

        sendBrowserNotification(senderName, {
          body: bodyText,
          icon: partnerUser?.avatar_url || '/app_icon.png',
          image: lastMsg.media_url && !isAudioMedia(lastMsg.media_url) ? lastMsg.media_url : null,
          tag: `kmessenger_msg_${lastMsg.id || Date.now()}`,
        });
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, currentUserId, isMuted, partnerUser, customNickname, defaultPartnerName]);

  // Voice Recorder Methods
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to access microphone:', err);
      alert('Microphone access is required to record voice notes.');
    }
  };

  const stopAndSendRecording = () => {
    if (!mediaRecorderRef.current) return;
    clearInterval(recordingTimerRef.current);
    const mediaRecorder = mediaRecorderRef.current;

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());

      if (audioBlob.size > 0) {
        const audioFile = new File([audioBlob], `voicenote_${Date.now()}.webm`, { type: 'audio/webm' });
        onUpload(audioFile);
      }
      setIsRecording(false);
      setRecordingTime(0);
    };

    mediaRecorder.stop();
  };

  const cancelRecording = () => {
    if (!mediaRecorderRef.current) return;
    clearInterval(recordingTimerRef.current);
    const mediaRecorder = mediaRecorderRef.current;

    mediaRecorder.onstop = () => {
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      audioChunksRef.current = [];
      setIsRecording(false);
      setRecordingTime(0);
    };

    mediaRecorder.stop();
  };

  const formatRecordingTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Message Editing Handlers
  const handleStartEdit = (msg) => {
    setEditingMsgId(msg.id);
    setEditingText(msg.text_content || '');
  };

  const handleSaveEdit = (msgId) => {
    if (editingText.trim() && onEditMessage) {
      onEditMessage(msgId, editingText.trim());
    }
    setEditingMsgId(null);
    setEditingText('');
  };

  const handleCancelEdit = () => {
    setEditingMsgId(null);
    setEditingText('');
  };

  const handleSend = (e) => {
    if (e) e.preventDefault();
    if ((!newMessage.trim() && !uploading) || isRecording) return;

    let initialReactions = {};
    if (replyingToMsg) {
      const replySenderName =
        replyingToMsg.sender_id === currentUserId
          ? 'You'
          : customNickname || partnerUser?.display_name || partnerUser?.username || defaultPartnerName;

      let previewText = replyingToMsg.text_content || '';
      if (!previewText && replyingToMsg.media_url) {
        previewText = isAudioMedia(replyingToMsg.media_url) ? '🎤 Voice note' : '📷 Photo';
      }

      initialReactions._reply = {
        id: replyingToMsg.id || replyingToMsg.temp_id,
        sender_id: replyingToMsg.sender_id,
        sender_name: replySenderName,
        text: previewText.length > 80 ? previewText.substring(0, 80) + '...' : previewText,
        media_url: replyingToMsg.media_url || null,
      };
    }

    onSendMessage(newMessage.trim(), null, initialReactions);
    setNewMessage('');
    setReplyingToMsg(null);
  };

  const handleSendQuickHeart = () => {
    onSendMessage('❤️');
  };

  const handleFileClick = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) onUpload(file);
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleDoubleTap = (msgId) => {
    if (onReactMessage) {
      onReactMessage(msgId, '❤️');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0B0F17] relative overflow-hidden font-sans">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-pink-900/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-purple-900/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header - Instagram DM Style with Permanent K-Messenger Brand Logo */}
      <div className="flex items-center justify-between p-3 sm:p-3.5 px-3 sm:px-6 border-b border-[#262626] bg-[#121212]/90 backdrop-blur-xl relative z-10">
        
        {/* Left: K-Messenger Brand Logo + Partner Info */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          {/* Permanent K-Messenger Brand Badge */}
          <div className="flex items-center gap-2 pr-2.5 border-r border-slate-800">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 via-purple-600 to-indigo-600 p-[1.5px] flex items-center justify-center shadow-lg shadow-purple-500/20 flex-shrink-0">
              <img src="/app_icon.png" alt="K-Messenger Logo" className="w-full h-full object-cover rounded-[10px]" />
            </div>
            <span className="hidden sm:inline text-xs font-black tracking-wider bg-gradient-to-r from-pink-400 via-purple-300 to-indigo-300 bg-clip-text text-transparent uppercase">
              K-Messenger
            </span>
          </div>

          {/* Partner Avatar with Story Ring */}
          <div className="relative group cursor-pointer" onClick={() => setIsNicknameModalOpen(true)}>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full p-[2px] bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-600 shadow-md">
              <div className="w-full h-full rounded-full bg-slate-900 overflow-hidden flex items-center justify-center border-2 border-[#121212]">
                {partnerUser?.avatar_url ? (
                  <img src={partnerUser.avatar_url} alt="Partner" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <span className="text-xs sm:text-sm font-bold text-white">
                    {partnerDisplayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#121212] transition-colors ${
                isPartnerOnline ? 'bg-emerald-500 glow-emerald' : 'bg-slate-500'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h2
                className="text-slate-100 font-bold text-xs sm:text-sm tracking-tight hover:text-pink-400 cursor-pointer transition-colors truncate max-w-[110px] sm:max-w-[200px]"
                onClick={() => setIsNicknameModalOpen(true)}
              >
                {partnerDisplayName}
              </h2>
              {customNickname && (
                <span className="hidden sm:inline-block text-[9px] sm:text-[10px] bg-purple-900/60 text-purple-300 px-1.5 py-0.5 rounded-full font-medium border border-purple-700/50">
                  Nickname
                </span>
              )}
            </div>
            {isPartnerOnline ? (
              <p className="text-[10px] sm:text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Active now</span>
              </p>
            ) : (
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                <span>Offline</span>
              </p>
            )}
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          {/* Mute / Unmute Notifications */}
          <button
            onClick={toggleMuteNotifications}
            className={`p-2 rounded-full transition-all cursor-pointer ${
              isMuted ? 'text-rose-400 hover:bg-rose-950/30' : 'text-emerald-400 hover:bg-emerald-950/30'
            }`}
            title={isMuted ? 'Notifications Muted' : 'Notifications Active'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />}
          </button>

          {/* Audio Call */}
          <button
            onClick={() => onStartCall('audio')}
            disabled={!connected}
            className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-[#262626] transition-all disabled:opacity-50"
            title="Start Audio Call"
          >
            <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Video Call */}
          <button
            onClick={() => onStartCall('video')}
            disabled={!connected}
            className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-[#262626] transition-all disabled:opacity-50"
            title="Start Video Call"
          >
            <Video className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Memory Lane / Media Vault Button */}
          <button
            onClick={onToggleMemoryLane}
            className={`p-2 rounded-full transition-all cursor-pointer ${
              showMemoryLane
                ? 'text-pink-400 bg-pink-950/40 border border-pink-700/50'
                : 'text-slate-300 hover:text-pink-400 hover:bg-[#262626]'
            }`}
            title="Toggle Memory Lane & Media"
          >
            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Nickname & Chat Info */}
          <button
            onClick={() => setIsNicknameModalOpen(true)}
            className="p-2 rounded-full text-slate-300 hover:text-pink-400 hover:bg-[#262626] transition-all"
            title="Chat Details & Edit Nickname"
          >
            <Info className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* User Profile Trigger */}
          <button
            onClick={onOpenProfile}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden ml-1 hover:border-pink-500 transition-all flex items-center justify-center cursor-pointer"
            title="My Profile"
          >
            {userProfile?.avatar_url ? (
              <img src={userProfile.avatar_url} alt="Me" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] sm:text-xs font-bold text-indigo-300">{myDisplayName.charAt(0).toUpperCase()}</span>
            )}
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3.5 scrollbar-hide relative z-10">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-pink-500 via-purple-600 to-indigo-600 p-0.5 mb-3 shadow-xl">
              <div className="w-full h-full rounded-full bg-[#121212] flex items-center justify-center">
                <Heart className="w-7 h-7 text-pink-500" />
              </div>
            </div>
            <p className="text-slate-200 font-bold text-base mb-1">Your Direct Messages</p>
            <p className="text-slate-400 text-xs max-w-xs text-center">
              Send encrypted Instagram-style messages, voice notes, or start a call with {partnerDisplayName}.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.sender_id === currentUserId;
            const showDateHeader =
              index === 0 ||
              new Date(msg.timestamp).getTime() - new Date(messages[index - 1]?.timestamp || 0) > 10 * 60 * 1000;

            const rawReactions = { ...(msg.reactions || {}) };
            const seenDict = rawReactions._seen || {};
            delete rawReactions._seen;
            const replyData = rawReactions._reply || null;
            delete rawReactions._reply;

            const reactionEntries = Object.entries(rawReactions);
            const isEditing = editingMsgId === msg.id;

            // Find partner seen timestamp if available
            const partnerSeenIso = Object.entries(seenDict).find(([uid]) => uid !== String(currentUserId))?.[1];

            // Filter out transient WebRTC CALL_SIGNAL messages
            if (msg.text_content && msg.text_content.startsWith('CALL_SIGNAL:')) {
              return null;
            }

            // Render Call History System Record
            if (msg.text_content && msg.text_content.startsWith('CALL_RECORD:')) {
              const parts = msg.text_content.split(':');
              const cType = parts[1] || 'video';
              const cDuration = parseInt(parts[2] || '0', 10);
              const cStatus = parts[3] || 'completed';
              const isCaller = msg.sender_id === currentUserId;

              let callTitle = '';
              let callSubtext = '';

              if (isCaller) {
                if (cStatus === 'completed' && cDuration > 0) {
                  callTitle = `Outgoing ${cType === 'video' ? 'Video' : 'Audio'} Call`;
                  callSubtext = `You called ${partnerDisplayName} • ${formatRecordingTime(cDuration)}`;
                } else if (cStatus === 'missed' || cStatus === 'unanswered') {
                  callTitle = `Cancelled ${cType === 'video' ? 'Video' : 'Audio'} Call`;
                  callSubtext = `No answer from ${partnerDisplayName}`;
                } else {
                  callTitle = `Outgoing ${cType === 'video' ? 'Video' : 'Audio'} Call`;
                  callSubtext = `Call declined by ${partnerDisplayName}`;
                }
              } else {
                if (cStatus === 'completed' && cDuration > 0) {
                  callTitle = `Incoming ${cType === 'video' ? 'Video' : 'Audio'} Call`;
                  callSubtext = `${partnerDisplayName} called you • ${formatRecordingTime(cDuration)}`;
                } else if (cStatus === 'missed' || cStatus === 'unanswered') {
                  callTitle = `Missed ${cType === 'video' ? 'Video' : 'Audio'} Call`;
                  callSubtext = `Missed call from ${partnerDisplayName}`;
                } else {
                  callTitle = `Declined ${cType === 'video' ? 'Video' : 'Audio'} Call`;
                  callSubtext = `Declined call from ${partnerDisplayName}`;
                }
              }

              return (
                <div key={msg.id || index} className="space-y-1 my-2">
                  {showDateHeader && (
                    <div className="flex items-center justify-center my-3">
                      <span className="px-3 py-1 rounded-full text-[10px] font-semibold text-slate-400 bg-[#121212] border border-[#262626]">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                        {new Date(msg.timestamp).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-center my-1.5">
                    <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#121824]/90 border border-slate-800/90 shadow-lg text-xs max-w-[90%] sm:max-w-md">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                        cStatus === 'missed' || cStatus === 'declined' ? 'bg-rose-500/20 text-rose-400' : 'bg-indigo-500/20 text-indigo-400'
                      }`}>
                        {cType === 'audio' ? <Phone className="w-4.5 h-4.5" /> : <Video className="w-4.5 h-4.5" />}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-extrabold text-slate-100 truncate">
                          {callTitle}
                        </span>
                        <span className="text-[11px] text-slate-400 font-semibold truncate">
                          {callSubtext} • {formatTime(msg.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            const audioUrl = getAudioUrl(msg);
            const videoUrl = getVideoUrl(msg);
            const imageUrl = getImageUrl(msg);
            const mediaUrlForDownload = getMediaUrl(msg);

            const msgKey = String(msg.id || msg.temp_id || index);
            const isHighlighted = highlightedMsgId && String(highlightedMsgId) === msgKey;

            return (
              <div
                key={msgKey}
                id={`msg-${msgKey}`}
                className={`space-y-1 transition-all duration-300 rounded-3xl p-1 ${
                  isHighlighted ? 'bg-pink-500/30 ring-4 ring-pink-500 scale-[1.02] shadow-2xl z-20' : ''
                }`}
              >
                {showDateHeader && (
                  <div className="flex items-center justify-center my-3">
                    <span className="px-3 py-1 rounded-full text-[10px] font-semibold text-slate-400 bg-[#121212] border border-[#262626]">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                      {new Date(msg.timestamp).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                )}

                <div className={`flex items-end gap-1.5 group relative ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Partner Avatar for incoming messages */}
                  {!isMe && (
                    <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-purple-300 flex-shrink-0 mb-1">
                      {partnerDisplayName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Message Bubble Container */}
                  <div
                    onDoubleClick={() => msg.id && handleDoubleTap(msg.id)}
                    onTouchStart={(e) => msg.id && handleTouchStart(msg.id, e)}
                    onTouchEnd={handleTouchEndOrMove}
                    onTouchMove={handleTouchEndOrMove}
                    className={`relative px-4 py-2.5 max-w-[78%] sm:max-w-[65%] rounded-3xl shadow-md transition-all select-none touch-manipulation overflow-visible ${
                      isMe
                        ? 'bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-white rounded-br-xs shadow-pink-950/20'
                        : 'bg-[#262626] text-slate-100 border border-[#333] rounded-bl-xs shadow-slate-950/30'
                    }`}
                  >
                    {/* Quoted Reply Header */}
                    {replyData && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJumpToMessage(replyData.id);
                        }}
                        className={`mb-2 p-2 rounded-2xl text-xs flex flex-col gap-0.5 cursor-pointer transition-all hover:opacity-90 border-l-4 ${
                          isMe
                            ? 'bg-black/30 text-white/90 border-pink-300'
                            : 'bg-black/40 text-slate-200 border-purple-400'
                        }`}
                      >
                        <div className="flex items-center gap-1 font-bold text-[11px] text-pink-300">
                          <Reply className="w-3 h-3" />
                          <span>{replyData.sender_name}</span>
                        </div>
                        <p className="line-clamp-2 text-[11px] opacity-90 break-words font-normal">
                          {replyData.text || (replyData.media_url ? 'Attachment' : '')}
                        </p>
                      </div>
                    )}

                    {/* Audio Voice Note Bubble */}
                    {audioUrl ? (
                      <AudioPlayerBubble src={audioUrl} isMe={isMe} />
                    ) : videoUrl ? (
                      /* Inline Video Player */
                      <div className="mb-2 overflow-hidden rounded-2xl border border-white/10 relative group/vid">
                        <video
                          src={videoUrl}
                          controls
                          playsInline
                          preload="metadata"
                          className="max-w-full max-h-72 rounded-2xl object-cover"
                        />
                      </div>
                    ) : imageUrl ? (
                      /* Photo Image */
                      <div
                        className="mb-2 overflow-hidden rounded-2xl border border-white/10 group/img cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxImage(imageUrl);
                        }}
                      >
                        <img
                          src={imageUrl}
                          alt="Shared media"
                          className="max-w-full max-h-72 object-cover rounded-2xl transition-transform duration-300 group-hover/img:scale-105"
                        />
                      </div>
                    ) : null}

                    {/* Inline Editing Mode */}
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 py-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="bg-black/40 text-white text-sm px-2.5 py-1 rounded-xl border border-white/30 focus:outline-none w-full"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEdit(msg.id)}
                          className="p-1 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer"
                          title="Save"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      /* Text Content (only if not an audio, video, or image player) */
                      msg.text_content && msg.text_content !== audioUrl && msg.text_content !== videoUrl && msg.text_content !== imageUrl && (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-medium">
                          {msg.text_content}
                        </p>
                      )
                    )}

                    {/* Timestamp & Seen Status */}
                    <div
                      className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] font-medium ${
                        isMe ? 'text-pink-200/80' : 'text-slate-400'
                      }`}
                    >
                      {msg.is_edited && <span className="italic opacity-80">(edited)</span>}
                      <span>{formatTime(msg.timestamp)}</span>
                      {isMe && partnerSeenIso ? (
                        <span className="flex items-center gap-1 font-bold text-cyan-300">
                          <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />
                          <span>{formatSeenAgo(partnerSeenIso)}</span>
                        </span>
                      ) : isMe ? (
                        <Check className="w-3.5 h-3.5 text-pink-200/80" />
                      ) : null}
                    </div>

                    {/* Reaction Badges attached to bottom corner */}
                    {reactionEntries.length > 0 && (
                      <div
                        className={`absolute -bottom-3 z-10 flex items-center bg-[#18181b] border border-slate-700/80 rounded-full px-2 py-0.5 text-xs shadow-xl gap-0.5 ${
                          isMe ? 'left-2' : 'right-2'
                        }`}
                      >
                        {reactionEntries.map(([uid, emoji]) => (
                          <span key={uid} className="leading-none transform hover:scale-125 transition-transform">
                            {emoji}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons & Dropdown Menu */}
                  <div className={`relative flex-shrink-0 self-center flex items-center gap-0.5 z-10 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Quick Reply Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartReply(msg);
                      }}
                      className={`p-1.5 rounded-full text-slate-400 hover:text-pink-400 hover:bg-slate-800/80 transition-all cursor-pointer flex-shrink-0 ${
                        activeActionMsgId === msg.id ? 'opacity-100 bg-slate-800 text-pink-400' : 'opacity-80 md:opacity-0 md:group-hover:opacity-100'
                      }`}
                      title="Reply to message"
                    >
                      <Reply className="w-4 h-4" />
                    </button>

                    {/* Quick Smile Emoji Trigger */}
                    <button
                      type="button"
                      onClick={(e) => toggleActionMenu(msg.id, e)}
                      className={`p-1.5 rounded-full text-slate-400 hover:text-pink-400 hover:bg-slate-800/80 transition-all cursor-pointer flex-shrink-0 ${
                        activeActionMsgId === msg.id ? 'opacity-100 bg-slate-800 text-pink-400' : 'opacity-80 md:opacity-0 md:group-hover:opacity-100'
                      }`}
                      title="React with Emoji"
                    >
                      <Smile className="w-4 h-4" />
                    </button>

                    {/* 3-Dots Menu Trigger */}
                    <button
                      type="button"
                      onClick={(e) => toggleActionMenu(msg.id, e)}
                      className={`p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all cursor-pointer ${
                        activeActionMsgId === msg.id ? 'opacity-100 bg-slate-800 text-white' : 'opacity-80 md:opacity-0 md:group-hover:opacity-100'
                      }`}
                      title="Message options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Dropdown Menu (Reactions, Reply, Download, Copy, Edit, Unsend) */}
                    {activeActionMsgId === msg.id && (
                      <div
                        className={`absolute z-50 w-56 sm:w-64 bg-[#18181b] border border-[#27272a] rounded-2xl shadow-2xl backdrop-blur-2xl p-2.5 space-y-2 animate-fadeIn ${
                          popoverPlacement === 'down' ? 'top-full mt-2' : 'bottom-full mb-2'
                        } ${
                          isMe ? 'left-0' : 'right-0'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Emojis for Reaction */}
                        <div>
                          <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-1.5 px-1">
                            Reactions
                          </p>
                          <div className="flex items-center justify-between bg-[#09090b] border border-[#27272a] rounded-xl p-1.5">
                            {QUICK_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  if (onReactMessage && msg.id) onReactMessage(msg.id, emoji);
                                  setActiveActionMsgId(null);
                                }}
                                className="hover:scale-135 active:scale-125 transition-transform text-base p-1 cursor-pointer"
                                title={`React ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Options: Reply, Download, Copy Text, Edit & Unsend */}
                        <div className="pt-1 border-t border-[#27272a] space-y-1">
                          <button
                            type="button"
                            onClick={() => handleStartReply(msg)}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-pink-400 hover:bg-pink-950/30 transition-all cursor-pointer"
                          >
                            <Reply className="w-4 h-4 text-pink-400" />
                            <span>Reply</span>
                          </button>

                          {/* Download Media (Photos, Videos, Voice Notes) */}
                          {mediaUrlForDownload && (
                            <button
                              type="button"
                              onClick={() => {
                                handleDownloadMedia(mediaUrlForDownload);
                                setActiveActionMsgId(null);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-emerald-400 hover:bg-emerald-950/30 transition-all cursor-pointer"
                            >
                              <Download className="w-4 h-4 text-emerald-400" />
                              <span>Download Media</span>
                            </button>
                          )}

                          {/* Copy Text (Only for actual text messages, NOT voice notes/media) */}
                          {msg.text_content && !audioUrl && !videoUrl && !imageUrl && (
                            <button
                              type="button"
                              onClick={() => handleCopyText(msg)}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-cyan-400 hover:bg-cyan-950/30 transition-all cursor-pointer"
                            >
                              {copiedMsgId === (msg.id || msg.temp_id) ? (
                                <>
                                  <Check className="w-4 h-4 text-emerald-400" />
                                  <span className="text-emerald-400 font-bold">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4 text-cyan-400" />
                                  <span>Copy Text</span>
                                </>
                              )}
                            </button>
                          )}

                          {isMe && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  handleStartEdit(msg);
                                  setActiveActionMsgId(null);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-amber-400 hover:bg-amber-950/30 transition-all cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4 text-amber-400" />
                                <span>Edit Message</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (onUnsendMessage && msg.id) onUnsendMessage(msg.id);
                                  setActiveActionMsgId(null);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-rose-400 hover:bg-rose-950/30 transition-all cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4 text-rose-400" />
                                <span>Delete / Unsend</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Instagram Pill Input Bar with Voice Note Controls */}
      <div className="p-2.5 sm:p-4 px-3 sm:px-6 pb-3 sm:pb-5 relative z-10 sticky bottom-0 bg-[#0B0F17] flex-shrink-0">
        {/* Realtime Partner Typing Indicator */}
        {isPartnerTyping && (
          <div className="mb-2 px-4 py-1.5 rounded-full bg-[#18181b]/95 border border-pink-500/40 w-fit flex items-center gap-2 shadow-lg animate-fadeIn backdrop-blur-md">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
            <span className="text-xs font-semibold text-pink-300">
              {partnerDisplayName} is typing...
            </span>
          </div>
        )}

        {/* Reply Preview Header above input bar */}
        {replyingToMsg && (
          <div className="mb-2 px-4 py-2 rounded-2xl bg-[#18181b]/95 border border-[#27272a] shadow-xl flex items-center justify-between gap-3 animate-fadeIn backdrop-blur-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-1 h-8 rounded-full bg-gradient-to-b from-pink-500 to-purple-600 flex-shrink-0" />
              <div className="flex flex-col text-xs min-w-0">
                <span className="font-bold text-pink-400 flex items-center gap-1">
                  <Reply className="w-3.5 h-3.5" />
                  Replying to {replyingToMsg.sender_id === currentUserId ? 'yourself' : partnerDisplayName}
                </span>
                <span className="text-slate-300 truncate text-[11px]">
                  {replyingToMsg.text_content || (replyingToMsg.media_url ? (isAudioMedia(replyingToMsg.media_url) ? '🎤 Voice note' : '📷 Photo') : 'Message')}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplyingToMsg(null)}
              className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Cancel reply"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form
          onSubmit={handleSend}
          className="bg-[#121212] border border-[#262626] rounded-3xl p-1.5 pl-3 sm:pl-4 shadow-2xl flex items-center gap-1.5 sm:gap-2 min-h-[46px]"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />

          {isRecording ? (
            /* Voice Recording Active UI */
            <div className="flex-1 flex items-center justify-between px-3 py-1 bg-red-950/40 border border-red-800/50 rounded-full animate-pulse">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span className="text-xs font-bold text-red-400">
                  Recording Voice Note... {formatRecordingTime(recordingTime)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Cancel Recording"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                </button>

                <button
                  type="button"
                  onClick={stopAndSendRecording}
                  className="px-3 py-1 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold text-xs shadow-md"
                  title="Send Voice Note"
                >
                  Send
                </button>
              </div>
            </div>
          ) : (
            /* Standard Input Bar UI */
            <>
              {/* Camera / Attachment Icon */}
              <button
                type="button"
                onClick={handleFileClick}
                disabled={uploading}
                className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-[#262626] transition-all flex-shrink-0 disabled:opacity-50 cursor-pointer active:scale-95"
                title="Attach Media"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {/* Auto-expanding Textarea Input like Instagram */}
              <textarea
                ref={inputRef}
                rows={1}
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  if (onSendTypingStatus) onSendTypingStatus(true);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 110)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (newMessage.trim()) handleSend(e);
                  }
                }}
                placeholder={replyingToMsg ? "Type your reply..." : "Message..."}
                className="flex-1 bg-transparent border-none text-slate-100 placeholder-slate-500 text-sm font-medium focus:outline-none focus:ring-0 py-1.5 resize-none max-h-28 overflow-y-auto"
              />

              {/* Mic Voice Note Button when empty */}
              {!newMessage.trim() && (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={!connected || uploading}
                  className="p-2 rounded-full text-slate-400 hover:text-pink-400 hover:bg-[#262626] transition-all flex-shrink-0 cursor-pointer disabled:opacity-50 active:scale-95"
                  title="Record Voice Note"
                >
                  <Mic className="w-5 h-5" />
                </button>
              )}

              {/* Quick Heart Icon when empty */}
              {!newMessage.trim() && (
                <button
                  type="button"
                  onClick={handleSendQuickHeart}
                  disabled={!connected}
                  className="p-2 rounded-full text-pink-500 hover:scale-125 transition-transform flex-shrink-0 cursor-pointer disabled:opacity-50 active:scale-95"
                  title="Send Heart"
                >
                  <Heart className="w-5 h-5 fill-pink-500" />
                </button>
              )}

              {/* Send Button when typing */}
              {newMessage.trim() && (
                <button
                  type="submit"
                  disabled={!connected || uploading}
                  className="px-4 py-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-95 text-white font-bold text-xs shadow-md shadow-pink-600/30 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Send</span>
                      <Send className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </form>
      </div>

      {/* Lightbox Preview Modal */}
      {lightboxImage && createPortal(
        <div
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-4"
          style={{ zIndex: 99999 }}
          onClick={() => setLightboxImage(null)}
          onTouchEnd={(e) => { if (e.target === e.currentTarget) setLightboxImage(null); }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxImage(null); }}
            className="absolute top-4 right-4 p-2 rounded-xl bg-[#18181b] border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            style={{ zIndex: 100000 }}
          >
            <X className="w-5 h-5" />
          </button>
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
            <img src={lightboxImage} alt="Enlarged shared media" className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl" draggable={false} />
          </div>
        </div>,
        document.body
      )}

      {/* Nickname Modal */}
      <NicknameModal
        isOpen={isNicknameModalOpen}
        onClose={() => setIsNicknameModalOpen(false)}
        contactName={partnerOriginalName}
        currentNickname={customNickname}
        onSaveNickname={onSaveNickname}
        onClearChat={onClearChat}
      />
    </div>
  );
}