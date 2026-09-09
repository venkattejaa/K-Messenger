import { Image as ImageIcon, Loader2, X, Maximize2, Download, Calendar, Search, Layers, ArrowLeft, Film, Mic, Play, Pause } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { apiGetMessages } from '../services/supabaseService';

function isVideoMedia(url) {
  if (!url) return false;
  const l = url.toLowerCase().split('?')[0];
  if (l.includes('voicenote') || l.includes('voice_') || l.includes('audio_') || l.includes('data:audio')) return false;
  return (
    l.endsWith('.mp4') ||
    l.endsWith('.mov') ||
    l.endsWith('.webm') ||
    l.endsWith('.mkv') ||
    l.endsWith('.avi') ||
    l.endsWith('.ogv') ||
    l.endsWith('.3gp') ||
    l.includes('video_') ||
    l.includes('video/') ||
    l.includes('video')
  );
}

function isAudioMedia(url) {
  if (!url) return false;
  const l = url.toLowerCase().split('?')[0];
  if (isVideoMedia(url)) return false;
  return (
    l.endsWith('.mp3') ||
    l.endsWith('.wav') ||
    l.endsWith('.m4a') ||
    l.endsWith('.ogg') ||
    l.endsWith('.aac') ||
    l.endsWith('.flac') ||
    l.endsWith('.opus') ||
    l.includes('voicenote') ||
    l.includes('voice_') ||
    l.includes('audio_') ||
    l.includes('audio/') ||
    l.includes('data:audio')
  );
}

function LightboxVideoPlayer({ src }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch((err) => console.log('Autoplay handled:', err));
    }
  }, [src]);

  const handleNativeFullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.requestFullscreen) {
      v.requestFullscreen();
    } else if (v.webkitRequestFullscreen) {
      v.webkitRequestFullscreen();
    } else if (v.webkitEnterFullscreen) {
      v.webkitEnterFullscreen();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3 max-w-full max-h-[85vh]">
      <video
        ref={videoRef}
        src={src}
        controls
        playsInline
        autoPlay
        preload="auto"
        className="max-w-full max-h-[75vh] rounded-2xl shadow-2xl"
      />
      <button
        type="button"
        onClick={handleNativeFullscreen}
        className="px-4 py-2 rounded-full bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xl transition-all active:scale-95 cursor-pointer border border-white/20"
      >
        <Maximize2 className="w-4 h-4" />
        <span>Full Screen View</span>
      </button>
    </div>
  );
}

export default function MemoryLane({ currentUserId, partnerId, onBackToChat, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('visual');
  const [expandedItem, setExpandedItem] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadToast, setDownloadToast] = useState('');

  const showToast = (msg) => {
    setDownloadToast(msg);
    setTimeout(() => setDownloadToast(''), 3500);
  };

  const closeExpandedItem = useCallback(() => {
    setExpandedItem(null);
  }, []);

  useEffect(() => {
    if (!expandedItem) return;

    window.history.pushState({ modal: 'memory_lightbox' }, '');

    const handlePopState = () => {
      setExpandedItem(null);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setExpandedItem(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [expandedItem]);

  const handleDownload = useCallback(async (url) => {
    if (!url || isDownloading) return;
    setIsDownloading(true);
    showToast('Starting download...');
    try {
      let ext = 'jpg';
      let mimeType = 'image/jpeg';
      const lowerUrl = url.toLowerCase();

      if (lowerUrl.endsWith('.png') || lowerUrl.includes('image/png')) {
        ext = 'png';
        mimeType = 'image/png';
      } else if (lowerUrl.endsWith('.gif') || lowerUrl.includes('image/gif')) {
        ext = 'gif';
        mimeType = 'image/gif';
      } else if (lowerUrl.endsWith('.webp') || lowerUrl.includes('image/webp')) {
        ext = 'webp';
        mimeType = 'image/webp';
      } else if (isVideoMedia(url)) {
        ext = 'mp4';
        mimeType = 'video/mp4';
      } else if (isAudioMedia(url)) {
        ext = lowerUrl.endsWith('.mp3') ? 'mp3' : 'webm';
        mimeType = lowerUrl.endsWith('.mp3') ? 'audio/mpeg' : 'audio/webm';
      }

      const fileName = `K_memory_${Date.now()}.${ext}`;

      if (window.AndroidNative && window.AndroidNative.downloadFile) {
        window.AndroidNative.downloadFile(url, fileName);
        showToast('Saved to Downloads folder!');
        setIsDownloading(false);
        return;
      }

      if (url.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('Saved to Downloads!');
        setIsDownloading(false);
        return;
      }

      const response = await fetch(url, { mode: 'cors' });
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      showToast('Saved to Downloads!');
    } catch (err) {
      console.warn('Direct blob fetch failed, triggering fallback download:', err);
      const a = document.createElement('a');
      a.href = url;
      a.download = `K_memory_${Date.now()}`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Downloading file...');
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading]);

  const loadMediaHistory = useCallback(async () => {
    setLoading(true);
    try {
      const msgs = await apiGetMessages(currentUserId, partnerId);
      const mediaList = msgs.filter((m) => {
        if (!m.media_url && !m.text_content) return false;
        const targetUrl = m.media_url || m.text_content;
        return isImageMedia(targetUrl) || isVideoMedia(targetUrl) || isAudioMedia(targetUrl);
      }).map((m) => ({
        id: m.id,
        media_url: m.media_url || m.text_content,
        timestamp: m.timestamp,
        sender_id: m.sender_id,
        reactions: m.reactions || {},
        type: isAudioMedia(m.media_url || m.text_content)
          ? 'audio'
          : isVideoMedia(m.media_url || m.text_content)
          ? 'video'
          : 'image',
      }));

      mediaList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setItems(mediaList);
    } catch (err) {
      console.error('Failed to load memory lane history:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, partnerId]);

  useEffect(() => {
    if (currentUserId) {
      loadMediaHistory();
    }
  }, [currentUserId, loadMediaHistory]);

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
      l.endsWith('.svg') ||
      l.includes('image_') ||
      l.includes('photo_') ||
      l.includes('img_')
    );
  };

  const filteredItems = items.filter((item) => {
    if (activeTab === 'visual') {
      return item.type === 'image' || item.type === 'video';
    }
    return item.type === 'audio';
  });

  const handleCloseModal = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setExpandedItem(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#0B0F17] relative overflow-hidden font-sans z-20 animate-fadeIn">
      {/* Toast Notification */}
      {downloadToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100005] bg-pink-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-2xl animate-bounce border border-pink-400">
          {downloadToast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-3.5 px-4 sm:px-6 border-b border-[#262626] bg-[#121212]/90 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToChat || onClose}
            className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-[#262626] transition-all cursor-pointer"
            title="Back to Chat"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-pink-400" />
            <h2 className="text-slate-100 font-extrabold text-sm sm:text-base tracking-tight">
              Memory Lane & Vault
            </h2>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-[#262626] transition-all cursor-pointer"
          title="Close Memory Vault"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-center p-3 bg-[#121212]/50 border-b border-[#262626] gap-3">
        <button
          onClick={() => setActiveTab('visual')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'visual'
              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-950/40 scale-105'
              : 'text-slate-400 hover:text-white bg-[#18181b] border border-slate-800'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>Photos & Videos ({items.filter((i) => i.type !== 'audio').length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audio')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'audio'
              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-950/40 scale-105'
              : 'text-slate-400 hover:text-white bg-[#18181b] border border-slate-800'
          }`}
        >
          <Mic className="w-4 h-4" />
          <span>Voice Notes ({items.filter((i) => i.type === 'audio').length})</span>
        </button>
      </div>

      {/* Grid Gallery Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-hide">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-pink-400" />
            <span className="text-xs font-semibold">Loading shared media memories...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-2">
            <ImageIcon className="w-12 h-12 text-slate-700 stroke-[1.5]" />
            <p className="text-slate-300 font-bold text-sm">No {activeTab === 'visual' ? 'photos or videos' : 'voice notes'} shared yet</p>
            <p className="text-xs text-slate-500">Shared media from your chat history will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => setExpandedItem(item)}
                className="group relative aspect-square rounded-2xl overflow-hidden bg-[#18181b] border border-[#27272a] cursor-pointer hover:border-pink-500/50 transition-all shadow-md hover:shadow-xl hover:scale-[1.02]"
              >
                {item.type === 'video' ? (
                  <div className="w-full h-full relative bg-slate-900 flex items-center justify-center">
                    <video src={item.media_url} className="w-full h-full object-cover" preload="metadata" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/10 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-pink-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>
                ) : item.type === 'image' ? (
                  <img src={item.media_url} alt="Memory" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full p-4 bg-gradient-to-br from-purple-950/40 to-slate-900 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-pink-400">
                      <Mic className="w-5 h-5" />
                      <span className="text-[10px] text-slate-400 font-mono">{new Date(item.timestamp).toLocaleDateString()}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-200 truncate">Voice Note</span>
                  </div>
                )}

                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownload(item.media_url); }}
                    className="p-1.5 rounded-xl bg-black/70 backdrop-blur-md text-white hover:bg-pink-600 transition-colors"
                    title="Download file"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Expanded Modal */}
      {expandedItem && createPortal(
        <div
          className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-4 md:p-8 animate-fadeIn"
          style={{ zIndex: 99999 }}
          onClick={handleCloseModal}
          onTouchStart={(e) => { if (e.target === e.currentTarget) handleCloseModal(e); }}
        >
          <button
            onClick={handleCloseModal}
            onTouchStart={handleCloseModal}
            className="fixed top-4 right-4 z-[100001] p-3 rounded-full bg-red-600/90 hover:bg-red-500 text-white shadow-2xl transition-all active:scale-90 cursor-pointer flex items-center justify-center border border-white/20"
            title="Close Preview"
          >
            <X className="w-6 h-6 stroke-[3]" />
          </button>

          <div
            className="relative max-w-4xl max-h-[90vh] w-full bg-[#121212] border border-[#27272a] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[#27272a] flex items-center justify-between bg-[#0B0F17]">
              <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                <Calendar className="w-4 h-4 text-pink-400" />
                <span>{new Date(expandedItem.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 pr-12 sm:pr-0">
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownload(expandedItem.media_url); }}
                  disabled={isDownloading}
                  className="p-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white hover:from-pink-500 hover:to-purple-500 shadow-md transition-all text-xs flex items-center gap-1.5 font-bold cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Download className="w-4 h-4 text-white" />
                  )}
                  {isDownloading ? 'Saving...' : 'Save File'}
                </button>
                <button
                  onClick={handleCloseModal}
                  onTouchStart={handleCloseModal}
                  className="p-2 rounded-xl bg-[#18181b] border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex items-center justify-center p-4 bg-black/80 min-h-[300px]">
              {isVideoMedia(expandedItem.media_url) ? (
                <LightboxVideoPlayer src={expandedItem.media_url} />
              ) : (
                <img
                  src={expandedItem.media_url}
                  alt="Expanded memory"
                  className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl"
                />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}