import { useState, useCallback, useRef } from 'react';
import { useChat } from './hooks/useChat';
import { useVideoCall } from './hooks/useVideoCall';
import ChatPanel from './components/ChatPanel';
import MemoryLane from './components/MemoryLane';
import VideoCallOverlay from './components/VideoCallOverlay';
import LoginPage from './components/LoginPage';
import ProfileModal from './components/ProfileModal';
import { apiGetUsers, apiUploadFile } from './services/supabaseService';

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [username, setUsername] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
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

  const {
    messages,
    connected,
    error: chatError,
    sendChatMessage,
    reactMessage,
    sendSignal,
    clearMessages,
  } = useChat(currentUserId, clientId, handleSignalCallback);

  const {
    localStream,
    remoteStream,
    callState,
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
  } = useVideoCall(sendSignal, currentUserId);

  // Connect handleSignal to ref
  signalHandlerRef.current = handleSignal;

  const handleLogin = (userId, userName, displayName, avatarUrl, bio) => {
    setCurrentUserId(userId);
    setUsername(userName);
    setUserProfile({
      user_id: userId,
      username: userName,
      display_name: displayName || userName,
      avatar_url: avatarUrl,
      bio: bio || 'Available for chat ✨',
    });
    setLoggedIn(true);
    fetchAllUsers();
  };

  const handleUpdateProfile = (updatedProfile) => {
    setUserProfile(updatedProfile);
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

  const handleSendMessage = useCallback((text) => {
    sendChatMessage(text);
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

  const handleStartCall = useCallback(() => {
    if (callState === 'idle') {
      startCall();
    }
  }, [callState, startCall]);

  const partnerUser = allUsers.find(u => u.user_id !== currentUserId);

  return (
    <div className="h-[100dvh] w-screen bg-[#0B0F17] overflow-hidden font-sans text-slate-100">
      {!loggedIn ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <div className="flex h-full w-full overflow-hidden relative">
          {/* Sidebar / Memory Lane */}
          <aside className={`w-full md:w-[30%] border-r border-slate-800/80 flex-shrink-0 h-full ${
            mobileTab === 'gallery' ? 'block' : 'hidden md:block'
          }`}>
            <MemoryLane currentUserId={currentUserId} />
          </aside>

          {/* Chat Panel */}
          <main className={`flex-1 flex flex-col min-w-0 h-full ${
            mobileTab === 'chat' ? 'block' : 'hidden md:block'
          }`}>
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
              onOpenProfile={() => setShowProfileModal(true)}
              mobileActiveTab={mobileTab}
              onSelectMobileTab={setMobileTab}
              customNickname={customNickname}
              onSaveNickname={handleSaveNickname}
              onReactMessage={reactMessage}
              onClearChat={clearMessages}
            />
          </main>

          {/* Profile Edit Modal */}
          {showProfileModal && userProfile && (
            <ProfileModal
              userProfile={userProfile}
              onUpdateProfile={handleUpdateProfile}
              onClose={() => setShowProfileModal(false)}
            />
          )}

          {/* Video Call Overlay */}
          <VideoCallOverlay
            callState={callState}
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
          />
        </div>
      )}
    </div>
  );
}

export default App;