import { useState, useCallback, useRef, useEffect } from 'react';
import { useChat } from './hooks/useChat';
import { useVideoCall } from './hooks/useVideoCall';
import ChatPanel from './components/ChatPanel';
import MemoryLane from './components/MemoryLane';
import VideoCallOverlay from './components/VideoCallOverlay';
import LoginPage from './components/LoginPage';
import ProfileModal from './components/ProfileModal';
import { Bell } from 'lucide-react';
import { requestNotificationPermission, sendBrowserNotification, cancelBrowserNotification } from './utils/browserNotifications';
import { playRingtoneSound, stopRingtoneSound } from './utils/notificationSound';
import { apiGetUsers, apiUploadFile } from './services/supabaseService';

function getSavedUser() {
  try {
    const saved = localStorage.getItem('kmessenger_saved_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.user_id) return parsed;
    }
  } catch (e) {
    console.error('Error reading saved user:', e);
  }
  return null;
}

function App() {
  const initialUser = useRef(getSavedUser()).current;
  const [loggedIn, setLoggedIn] = useState(() => Boolean(initialUser));
  const [currentUserId, setCurrentUserId] = useState(() => initialUser?.user_id || null);
  const [username, setUsername] = useState(() => initialUser?.username || '');
  const [userProfile, setUserProfile] = useState(() => initialUser || null);
  const [allUsers, setAllUsers] = useState([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMemoryLane, setShowMemoryLane] = useState(false);
  const [mobileTab, setMobileTab] = useState('chat'); // 'chat' | 'gallery'
  const [clientId] = useState(() => `client_${Math.random().toString(36).substring(2, 9)}`);
  
  // Custom contact nickname state (stored in localStorage)
  const [customNickname, setCustomNickname] = useState(() => {
    return localStorage.getItem('kmessenger_partner_nickname') || '';
  });

  // Signal handler ref to break cyclic dependency between useChat and useVideoCall
  const signalHandlerRef = useRef(null);

  const fetchAllUsers = useCallback(async () => {
    try {
      const data = await apiGetUsers();
      setAllUsers(data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }, []);

  const handleSignalCallback = useCallback((signalType, data, fromClientId) => {
    if (signalHandlerRef.current) {
      signalHandlerRef.current(signalType, data, fromClientId);
    }
  }, []);

  const partnerUser = (() => {
    if (!currentUserId || !allUsers.length) return null;
    const uLower = (username || '').toLowerCase();
    if (uLower === 'venkattejaa' || currentUserId === 1) {
      return allUsers.find(u => u.user_id === 2 || u.username?.toLowerCase() === 'srevarsha' || u.username?.toLowerCase() === 'chinni_is_buzy');
    }
    if (uLower === 'srevarsha' || uLower === 'chinni_is_buzy' || currentUserId === 2) {
      return allUsers.find(u => u.user_id === 1 || u.username?.toLowerCase() === 'venkattejaa');
    }
    if (uLower === 'tester1' || currentUserId === 3) return allUsers.find(u => u.user_id === 4 || u.username === 'tester2');
    if (uLower === 'tester2' || currentUserId === 4) return allUsers.find(u => u.user_id === 3 || u.username === 'tester1');
    return allUsers.find(u => u.user_id !== currentUserId);
  })();

  const {
    messages,
    onlineUserIds,
    connected,
    error: chatError,
    sendChatMessage,
    reactMessage,
    sendSignal,
    clearMessages,
    unsendMessage,
    editMessage,
    markAllSeen,
  } = useChat(currentUserId, clientId, handleSignalCallback, partnerUser?.user_id);

  const {
    localStream,
    remoteStream,
    callState,
    callType,
    error: callError,
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
  } = useVideoCall(sendSignal, currentUserId, sendChatMessage);

  // Connect handleSignal to ref
  signalHandlerRef.current = handleSignal;

  const [notifPermission, setNotifPermission] = useState(() => {
    return typeof Notification !== 'undefined' ? Notification.permission : 'granted';
  });

  const handleRequestNotifPermission = async () => {
    await requestNotificationPermission();
    if (typeof Notification !== 'undefined') {
      setNotifPermission(Notification.permission);
    }
  };

  // Request browser notification permission when logged in
  useEffect(() => {
    if (loggedIn) {
      requestNotificationPermission();
      fetchAllUsers();
    }
  }, [loggedIn, fetchAllUsers]);

  // Trigger app push notification & ringtone on incoming call
  useEffect(() => {
    if (callState === 'incoming') {
      const isMuted = localStorage.getItem('kmessenger_muted_notifications') === 'true';
      if (!isMuted) {
        playRingtoneSound();
        const pUser = partnerUser || allUsers.find(u => u.user_id !== currentUserId);
        const name = customNickname || pUser?.display_name || pUser?.username || (currentUserId === 1 ? 'Srevarsha' : 'Venkat Teja');
        sendBrowserNotification(`Incoming ${callType === 'audio' ? 'Audio' : 'Video'} Call`, {
          body: `From ${name}. Tap to answer call.`,
          tag: 'kmessenger_incoming_call',
          renotify: true,
          vibrate: [500, 200, 500, 200, 500],
        });
      }
    } else {
      stopRingtoneSound();
      cancelBrowserNotification('kmessenger_incoming_call');
    }
    return () => {
      stopRingtoneSound();
      cancelBrowserNotification('kmessenger_incoming_call');
    };
  }, [callState, callType, allUsers, currentUserId, customNickname, partnerUser]);

  // Sync active CALL_SIGNAL:offer & CALL_RECORD from messages table
  useEffect(() => {
    if (!messages || messages.length === 0 || !currentUserId) return;

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return;

    // 1. If last message is CALL_RECORD (caller cancelled/ended call), end incoming call UI
    if (lastMsg.text_content && lastMsg.text_content.startsWith('CALL_RECORD:')) {
      if (callState === 'incoming') {
        endCall(false);
      }
      return;
    }

    // 2. If last message is CALL_SIGNAL:offer from partner and within last 45 seconds
    if (lastMsg.text_content && lastMsg.text_content.startsWith('CALL_SIGNAL:offer:')) {
      const expectedPartnerId = partnerUser?.user_id || (currentUserId === 1 ? 2 : currentUserId === 2 ? 1 : currentUserId === 3 ? 4 : currentUserId === 4 ? 3 : null);
      if (Number(lastMsg.sender_id) === Number(expectedPartnerId) && callState === 'idle') {
        const msgTime = new Date(lastMsg.timestamp || Date.now()).getTime();
        if (Date.now() - msgTime < 45000) {
          try {
            const parts = lastMsg.text_content.split(':');
            const cType = parts[2] || 'video';
            const offerDataStr = parts.slice(3).join(':');
            const offerObj = JSON.parse(offerDataStr);
            handleSignal('offer', { sdp: offerObj, call_type: cType });
          } catch (e) {
            console.error('Error parsing persistent call offer signal:', e);
          }
        }
      }
    }
  }, [messages, currentUserId, callState, handleSignal, endCall]);

  const handleLogin = (userId, userName, displayName, avatarUrl, bio) => {
    const profile = {
      user_id: userId,
      username: userName,
      display_name: displayName || userName,
      avatar_url: avatarUrl,
      bio: bio || 'Available for chat ✨',
    };
    setCurrentUserId(userId);
    setUsername(userName);
    setUserProfile(profile);
    setLoggedIn(true);
    localStorage.setItem('kmessenger_saved_user', JSON.stringify(profile));
    fetchAllUsers();
  };

  const handleLogout = () => {
    localStorage.removeItem('kmessenger_saved_user');
    setLoggedIn(false);
    setCurrentUserId(null);
    setUsername('');
    setUserProfile(null);
  };

  const handleUpdateProfile = (updatedProfile) => {
    setUserProfile(updatedProfile);
    localStorage.setItem('kmessenger_saved_user', JSON.stringify(updatedProfile));
    fetchAllUsers();
  };

  const handleSaveNickname = (newNickname) => {
    setCustomNickname(newNickname);
    if (newNickname) {
      localStorage.setItem('kmessenger_partner_nickname', newNickname);
    } else {
      localStorage.removeItem('kmessenger_partner_nickname');
    }
  };

  const handleSendMessage = useCallback((text, mediaUrl = null, initialReactions = {}) => {
    sendChatMessage(text, mediaUrl, initialReactions);
  }, [sendChatMessage]);

  const handleUpload = useCallback(async (file) => {
    try {
      const data = await apiUploadFile(file);
      if (data.media_url) {
        sendChatMessage('', data.media_url);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    }
  }, [sendChatMessage]);

  const handleStartCall = useCallback((type = 'video') => {
    if (callState === 'idle') {
      startCall(type);
    }
  }, [callState, startCall]);

  const defaultPartnerName = (() => {
    if (currentUserId === 1 || username?.toLowerCase() === 'venkattejaa') return 'Srevarsha';
    if (currentUserId === 2 || username?.toLowerCase() === 'srevarsha' || username?.toLowerCase() === 'chinni_is_buzy') return 'Venkat Teja';
    if (currentUserId === 3 || username?.toLowerCase() === 'tester1') return 'Tester 2';
    if (currentUserId === 4 || username?.toLowerCase() === 'tester2') return 'Tester 1';
    return 'Contact';
  })();

  const partnerDisplayName = customNickname || partnerUser?.display_name || partnerUser?.username || defaultPartnerName;

  return (
    <div className="h-[100dvh] w-screen bg-[#0B0F17] overflow-hidden font-sans text-slate-100">
      {!loggedIn ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <div className="flex h-full w-full overflow-hidden relative flex-col">
          {loggedIn && notifPermission === 'default' && !window.AndroidNative && (
            <div className="bg-gradient-to-r from-indigo-900/90 via-purple-900/90 to-pink-900/90 text-white px-4 py-2 text-xs flex items-center justify-between border-b border-indigo-700/50 relative z-30 shadow-md">
              <div className="flex items-center gap-2 font-medium">
                <Bell className="w-4 h-4 text-amber-300 animate-bounce flex-shrink-0" />
                <span>Turn on notifications for message alerts & incoming call rings!</span>
              </div>
              <button
                onClick={handleRequestNotifPermission}
                className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1 rounded-full font-bold transition-all shadow-md active:scale-95 text-[11px]"
              >
                Allow Notifications
              </button>
            </div>
          )}

          {/* Main Chat Panel (100% full width by default) */}
          <main className="flex-1 flex flex-col min-w-0 h-full">
            <ChatPanel
              messages={messages}
              onSendMessage={handleSendMessage}
              onStartCall={handleStartCall}
              onUpload={handleUpload}
              uploading={false}
              currentUserId={currentUserId}
              username={username}
              connected={connected}
              userProfile={userProfile}
              partnerUser={partnerUser}
              onlineUserIds={onlineUserIds}
              onOpenProfile={() => setShowProfileModal(true)}
              mobileActiveTab={mobileTab}
              onSelectMobileTab={setMobileTab}
              customNickname={customNickname}
              onSaveNickname={handleSaveNickname}
              onReactMessage={reactMessage}
              onClearChat={clearMessages}
              onUnsendMessage={unsendMessage}
              onEditMessage={editMessage}
              onMarkAllSeen={() => markAllSeen(partnerUser?.user_id)}
              showMemoryLane={showMemoryLane}
              onToggleMemoryLane={() => setShowMemoryLane((prev) => !prev)}
            />
          </main>

          {/* Memory Lane Drawer (Hidden by default, slides in when opened) */}
          {showMemoryLane && (
            <aside className="w-full md:w-[380px] lg:w-[420px] border-l border-[#262626] flex-shrink-0 h-full absolute md:relative right-0 inset-y-0 z-40 bg-[#0B0F17] shadow-2xl animate-fadeIn">
              <MemoryLane
                currentUserId={currentUserId}
                onClose={() => setShowMemoryLane(false)}
                onBackToChat={() => setShowMemoryLane(false)}
              />
            </aside>
          )}

          {/* Profile Edit Modal */}
          {showProfileModal && userProfile && (
            <ProfileModal
              userProfile={userProfile}
              onUpdateProfile={handleUpdateProfile}
              onLogout={handleLogout}
              onClose={() => setShowProfileModal(false)}
            />
          )}

          {/* Video / Audio Call Overlay */}
          <VideoCallOverlay
            callState={callState}
            callType={callType}
            localStream={localStream}
            remoteStream={remoteStream}
            localVideoRef={localVideoRef}
            remoteVideoRef={remoteVideoRef}
            onAccept={acceptCall}
            onEnd={endCall}
            onToggleMute={toggleMute}
            onToggleVideo={toggleVideo}
            onFlipCamera={flipCamera}
            muted={muted}
            videoEnabled={videoEnabled}
            partnerDisplayName={partnerDisplayName}
          />
        </div>
      )}
    </div>
  );
}

export default App;