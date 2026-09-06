import { MessageSquare, Image, Video, Phone, Send, Loader2, ShieldCheck, User, CheckCheck, Paperclip, Settings, Layers, Heart, Smile, Sparkles, Info, Edit3, Volume2, VolumeX } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import NicknameModal from './NicknameModal';
import { playNotificationSound } from '../utils/notificationSound';

const QUICK_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

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
  onOpenProfile,
  mobileActiveTab,
  onSelectMobileTab,
  customNickname,
  onSaveNickname,
  onReactMessage,
}) {
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const [newMessage, setNewMessage] = useState('');
  const [lightboxImage, setLightboxImage] = useState(null);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState(null);
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);

  // Mute Notifications State (persisted in localStorage)
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('kmessenger_muted_notifications') === 'true';
  });

  const toggleMuteNotifications = () => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem('kmessenger_muted_notifications', String(next));
      return next;
    });
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Trigger sound chime when partner sends a new message (if not muted)
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.sender_id !== currentUserId && !isMuted) {
        playNotificationSound();
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, currentUserId, isMuted]);

  const handleSend = (e) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() && !uploading) return;
    onSendMessage(newMessage.trim());
    setNewMessage('');
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

  const myDisplayName = userProfile?.display_name || username || 'You';
  const partnerOriginalName = partnerUser?.display_name || partnerUser?.username || 'Partner';
  const partnerDisplayName = customNickname || partnerOriginalName;

  return (
    <div className="flex flex-col h-full bg-[#0B0F17] relative overflow-hidden font-sans">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-pink-900/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-purple-900/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header - Instagram DM Style */}
      <div className="flex items-center justify-between p-3.5 px-4 sm:px-6 border-b border-[#262626] bg-[#121212]/90 backdrop-blur-xl relative z-10">
        {/* Left: Partner Profile Info */}
        <div className="flex items-center gap-3">
          {/* Partner Avatar with Instagram Story Ring */}
          <div className="relative group cursor-pointer" onClick={() => setIsNicknameModalOpen(true)}>
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full p-[2px] bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-600 shadow-md">
              <div className="w-full h-full rounded-full bg-slate-900 overflow-hidden flex items-center justify-center border-2 border-[#121212]">
                {partnerUser?.avatar_url ? (
                  <img src={partnerUser.avatar_url} alt="Partner" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <span className="text-sm font-bold text-white">
                    {partnerDisplayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#121212] rounded-full glow-emerald" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-slate-100 font-bold text-sm sm:text-base tracking-tight hover:text-pink-400 cursor-pointer transition-colors" onClick={() => setIsNicknameModalOpen(true)}>
                {partnerDisplayName}
              </h2>
              {customNickname && (
                <span className="text-[10px] bg-purple-900/60 text-purple-300 px-1.5 py-0.5 rounded-full font-medium border border-purple-700/50">
                  Nickname
                </span>
              )}
            </div>
            <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Active now</span>
            </p>
          </div>
        </div>

        {/* Mobile Tab Switcher Toggle (md:hidden) */}
        <div className="flex md:hidden items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => onSelectMobileTab('chat')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              mobileActiveTab === 'chat' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat
          </button>
          <button
            onClick={() => onSelectMobileTab('gallery')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              mobileActiveTab === 'gallery' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Media
          </button>
        </div>

        {/* Header Right Actions: Mute Notifications, Audio Call, Video Call, Nickname Settings */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Mute / Unmute Notifications Toggle */}
          <button
            onClick={toggleMuteNotifications}
            className={`p-2 sm:p-2.5 rounded-full transition-all cursor-pointer ${
              isMuted ? 'text-rose-400 hover:bg-rose-950/30' : 'text-emerald-400 hover:bg-emerald-950/30'
            }`}
            title={isMuted ? 'Notifications Muted (Click to Unmute Sound)' : 'Notifications Active (Click to Mute Sound)'}
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
          </button>

          {/* Audio Call */}
          <button
            onClick={onStartCall}
            disabled={!connected}
            className="p-2 sm:p-2.5 rounded-full text-slate-300 hover:text-white hover:bg-[#262626] transition-all disabled:opacity-50"
            title="Start Audio Call"
          >
            <Phone className="w-5 h-5" />
          </button>

          {/* Video Call */}
          <button
            onClick={onStartCall}
            disabled={!connected}
            className="p-2 sm:p-2.5 rounded-full text-slate-300 hover:text-white hover:bg-[#262626] transition-all disabled:opacity-50"
            title="Start Video Call"
          >
            <Video className="w-5 h-5" />
          </button>

          {/* Nickname & Chat Info */}
          <button
            onClick={() => setIsNicknameModalOpen(true)}
            className="p-2 sm:p-2.5 rounded-full text-slate-300 hover:text-pink-400 hover:bg-[#262626] transition-all"
            title="Chat Details & Edit Nickname"
          >
            <Info className="w-5 h-5" />
          </button>

          {/* User Profile Trigger */}
          <button
            onClick={onOpenProfile}
            className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden ml-1 hover:border-pink-500 transition-all flex items-center justify-center cursor-pointer"
            title="My Profile"
          >
            {userProfile?.avatar_url ? (
              <img src={userProfile.avatar_url} alt="Me" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-indigo-300">{myDisplayName.charAt(0).toUpperCase()}</span>
            )}
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 scrollbar-hide relative z-10">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-pink-500 via-purple-600 to-indigo-600 p-0.5 mb-3 shadow-xl">
              <div className="w-full h-full rounded-full bg-[#121212] flex items-center justify-center">
                <Heart className="w-7 h-7 text-pink-500" />
              </div>
            </div>
            <p className="text-slate-200 font-bold text-base mb-1">Your Direct Messages</p>
            <p className="text-slate-400 text-xs max-w-xs text-center">
              Send encrypted Instagram-style messages or start a call with {partnerDisplayName}.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.sender_id === currentUserId;
            const showDateHeader = index === 0 || 
              new Date(msg.timestamp).getTime() - new Date(messages[index - 1]?.timestamp || 0) > 10 * 60 * 1000;
            const msgReactions = msg.reactions || {};
            const reactionEntries = Object.entries(msgReactions);

            return (
              <div key={msg.id || msg.temp_id || index} className="space-y-1">
                {showDateHeader && (
                  <div className="flex items-center justify-center my-3">
                    <span className="px-3 py-1 rounded-full text-[10px] font-semibold text-slate-400 bg-[#121212] border border-[#262626]">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(msg.timestamp).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                )}

                <div className={`flex items-end gap-2 group ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Partner Avatar for incoming messages */}
                  {!isMe && (
                    <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-purple-300 flex-shrink-0 mb-1">
                      {partnerDisplayName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Message Bubble Container */}
                  <div className={`max-w-[78%] sm:max-w-[60%] flex flex-col relative ${isMe ? 'items-end' : 'items-start'}`}>
                    {/* Hover Reaction Toolbar */}
                    <div className={`absolute -top-9 z-20 hidden group-hover:flex items-center bg-[#1e1e1e] border border-[#333] rounded-full px-2 py-1 shadow-xl gap-1 animate-fadeIn ${
                      isMe ? 'right-0' : 'left-0'
                    }`}>
                      {QUICK_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => onReactMessage && msg.id && onReactMessage(msg.id, emoji)}
                          className="hover:scale-125 transition-transform text-xs p-1 cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    {/* Bubble */}
                    <div
                      onDoubleClick={() => msg.id && handleDoubleTap(msg.id)}
                      className={`relative px-4 py-2.5 rounded-3xl shadow-md transition-all select-none cursor-pointer ${
                        isMe
                          ? 'bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-white rounded-br-xs shadow-pink-950/20'
                          : 'bg-[#262626] text-slate-100 border border-[#333] rounded-bl-xs shadow-slate-950/30'
                      }`}
                    >
                      {/* Media Image */}
                      {msg.media_url && (
                        <div className="mb-2 overflow-hidden rounded-2xl border border-white/10 group/img" onClick={() => setLightboxImage(msg.media_url)}>
                          <img
                            src={msg.media_url}
                            alt="Shared media"
                            className="max-w-full max-h-72 object-cover rounded-2xl transition-transform duration-300 group-hover/img:scale-105"
                          />
                        </div>
                      )}

                      {/* Text Content */}
                      {msg.text_content && (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words font-medium">
                          {msg.text_content}
                        </p>
                      )}

                      {/* Timestamp & Status */}
                      <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] font-medium ${
                        isMe ? 'text-pink-200/80' : 'text-slate-400'
                      }`}>
                        <span>{formatTime(msg.timestamp)}</span>
                        {isMe && <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />}
                      </div>

                      {/* Reaction Badges attached to bottom corner */}
                      {reactionEntries.length > 0 && (
                        <div className={`absolute -bottom-2.5 flex items-center bg-[#1e1e1e] border border-[#3a3a3a] rounded-full px-1.5 py-0.5 text-xs shadow-lg ${
                          isMe ? 'left-2' : 'right-2'
                        }`}>
                          {reactionEntries.map(([uid, emoji]) => (
                            <span key={uid} className="leading-none">{emoji}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Instagram Pill Input Bar */}
      <div className="p-3 sm:p-4 px-4 sm:px-6 pb-4 sm:pb-6 relative z-10">
        <form onSubmit={handleSend} className="bg-[#121212] border border-[#262626] rounded-full p-1.5 pl-4 shadow-2xl flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />

          {/* Camera / Attachment Icon */}
          <button
            type="button"
            onClick={handleFileClick}
            disabled={uploading}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-[#262626] transition-all flex-shrink-0 disabled:opacity-50 cursor-pointer"
            title="Attach Media"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Input text */}
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Message..."
            className="flex-1 bg-transparent border-none text-slate-100 placeholder-slate-500 text-sm font-medium focus:outline-none focus:ring-0 py-1.5"
          />

          {/* Quick Heart Icon when empty */}
          {!newMessage.trim() && (
            <button
              type="button"
              onClick={handleSendQuickHeart}
              disabled={!connected}
              className="p-2 rounded-full text-pink-500 hover:scale-125 transition-transform flex-shrink-0 cursor-pointer disabled:opacity-50"
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
              className="px-4 py-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-95 text-white font-bold text-xs shadow-md shadow-pink-600/30 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
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
        </form>
      </div>

      {/* Lightbox Preview Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={lightboxImage} alt="Enlarged shared media" className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl" />
          </div>
        </div>
      )}

      {/* Nickname Modal */}
      <NicknameModal
        isOpen={isNicknameModalOpen}
        onClose={() => setIsNicknameModalOpen(false)}
        contactName={partnerOriginalName}
        currentNickname={customNickname}
        onSaveNickname={onSaveNickname}
      />
    </div>
  );
}