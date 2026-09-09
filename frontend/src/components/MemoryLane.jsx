import { Image as ImageIcon, Loader2, X, Maximize2, Download, Calendar, Search, Layers, ArrowLeft, Film, Mic, Play, Pause } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { apiGetMessages } from '../services/supabaseService';

function isAudioMedia(url) {
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
    l.startsWith('data:audio') ||
    l.includes('voicenote') ||
    l.includes('audio_')
  );
}

function isVideoMedia(url) {
  if (!url) return false;
  const l = url.toLowerCase();
  return (
    l.endsWith('.mp4') ||
    l.endsWith('.mov') ||
    l.endsWith('.mkv') ||
    l.endsWith('.avi') ||
    l.includes('video_')
  );
}

export default function MemoryLane({ currentUserId, partnerId, onBackToChat, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('visual'); // 'visual' (photos & videos) or 'audio' (voice notes)
  const [expandedItem, setExpandedItem] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Download handler that works inside Android WebView & Web Browsers
  const handleDownload = useCallback(async (url) => {
    if (!url || isDownloading) return;
    setIsDownloading(true);
    try {
      // Determine file extension and MIME type
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

      // 1. Android Native Bridge
      if (window.AndroidNative && window.AndroidNative.downloadFile) {
        window.AndroidNative.downloadFile(url, fileName);
        setIsDownloading(false);
        return;
      }

      // 2. Data URL (Base64) Download
      if (url.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setIsDownloading(false);
        return;
      }

      // 3. Web Fetch & Blob Download Fallback
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
    } catch (err) {
      console.warn('Direct blob fetch failed, triggering fallback download:', err);
      const a = document.createElement('a');
      a.href = url;
      a.download = `K_memory_${Date.now()}`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading]);

  const fetchGallery = useCallback(async () => {
    try {
      const allMsgs = await apiGetMessages(currentUserId, partnerId);
      const mediaMsgs = allMsgs.filter((m) => {
        if (!m.media_url) return false;
        if (m.text_content && (m.text_content.startsWith('USER_SETTING:') || m.text_content.startsWith('CALL_SIGNAL:') || m.text_content.startsWith('CALL_RECORD:'))) {
          return false;
        }
        return true;
      });
      mediaMsgs.reverse(); // Newest first
      setItems(mediaMsgs);
    } catch (err) {
      console.error('Failed to fetch gallery:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, partnerId]);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  const filteredItems = items.filter((item) => {
    const isAudio = isAudioMedia(item.media_url);
    if (activeTab === 'visual' && isAudio) return false;
    if (activeTab === 'audio' && !isAudio) return false;

    if (!searchQuery) return true;
    const dateStr = new Date(item.timestamp).toLocaleDateString().toLowerCase();
    const textStr = (item.text_content || '').toLowerCase();
    return dateStr.includes(searchQuery.toLowerCase()) || textStr.includes(searchQuery.toLowerCase());
  });

  const formatDate = (iso) => {
    return new Date(iso).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const visualCount = items.filter((i) => !isAudioMedia(i.media_url)).length;
  const audioCount = items.filter((i) => isAudioMedia(i.media_url)).length;

  return (
    <div className="flex flex-col h-full bg-[#0B0F17] border-r border-[#262626] backdrop-blur-2xl relative font-sans">
      {/* Ambient background glow */}
      <div className="absolute top-10 left-5 w-72 h-72 bg-purple-900/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Top Header */}
      <div className="p-4 sm:p-5 border-b border-[#262626] bg-[#121212]/90 backdrop-blur-xl relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Mobile Back to Chat Button */}
            {onBackToChat && (
              <button
                onClick={onBackToChat}
                className="md:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all active:scale-95"
                title="Back to Chat"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 via-purple-600 to-indigo-600 p-[1.5px] shadow-lg shadow-purple-500/20 flex-shrink-0">
              <div className="w-full h-full rounded-[14px] bg-[#0B0F17] flex items-center justify-center">
                <Layers className="w-5 h-5 text-pink-400" />
              </div>
            </div>
            <div>
              <h3 className="text-slate-100 font-bold text-base tracking-tight flex items-center gap-1.5">
                Memory Lane
              </h3>
              <p className="text-xs text-slate-400 font-medium">Shared Media & Memories</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-900/40 text-purple-300 border border-purple-700/50 shadow-inner">
              {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
            </span>
            {(onClose || onBackToChat) && (
              <button
                onClick={onClose || onBackToChat}
                className="p-1.5 rounded-xl bg-[#18181b] border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer active:scale-95"
                title="Close Memory Lane"
              >
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 mt-3 bg-[#18181b] p-1 rounded-xl border border-[#27272a]">
          <button
            onClick={() => setActiveTab('visual')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'visual'
                ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Photos & Videos ({visualCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'audio'
                ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voice Notes ({audioCount})</span>
          </button>
        </div>

        {/* Search filter input */}
        <div className="relative mt-3">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search caption or date..."
            className="w-full bg-[#18181b] border border-[#27272a] rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-pink-500/60 transition-all font-medium"
          />
        </div>
      </div>

      {/* Media Content Area */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-pink-500 mb-3" />
            <p className="text-xs font-semibold text-slate-400">Loading memories...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6 text-center animate-fadeIn">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-pink-500/10 to-purple-600/10 border border-purple-500/20 flex items-center justify-center mb-4 shadow-xl">
              {activeTab === 'visual' ? (
                <ImageIcon className="w-9 h-9 text-pink-400/80" />
              ) : (
                <Mic className="w-9 h-9 text-pink-400/80" />
              )}
            </div>
            <p className="text-base font-bold text-slate-200 mb-1">
              No shared {activeTab === 'visual' ? 'photos or videos' : 'voice notes'}
            </p>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Shared {activeTab === 'visual' ? 'photos and videos' : 'voice notes'} in your conversation will appear here.
            </p>
          </div>
        ) : activeTab === 'visual' ? (
          <div className="grid grid-cols-2 gap-3">
            {filteredItems.map((item) => {
              const isVideo = isVideoMedia(item.media_url);
              return (
                <div
                  key={item.id}
                  onClick={() => setExpandedItem(item)}
                  className="group relative aspect-square overflow-hidden rounded-2xl border border-[#27272a] bg-[#18181b] cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-pink-950/40 hover:border-pink-500/50 transition-all duration-300 active:scale-95"
                >
                  {isVideo ? (
                    <video
                      src={item.media_url}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={item.media_url}
                      alt="Memory media"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                  )}

                  {isVideo && (
                    <div className="absolute top-2 left-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white">
                      <Film className="w-3.5 h-3.5 text-pink-400" />
                    </div>
                  )}

                  {/* Hover overlay card with direct Save button */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(item.media_url);
                        }}
                        className="p-1.5 rounded-xl bg-pink-600/80 hover:bg-pink-500 backdrop-blur-md text-white shadow-md transition-transform active:scale-90"
                        title="Save item"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <span className="p-1.5 rounded-xl bg-black/60 backdrop-blur-md text-white block shadow-md">
                        <Maximize2 className="w-3.5 h-3.5 text-pink-300" />
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-200 font-medium truncate flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-pink-400" />
                      <span>{formatDate(item.timestamp)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-[#18181b] border border-[#27272a] flex flex-col gap-2 shadow-md"
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-pink-400" />
                    <span className="font-semibold text-slate-300">Voice Note</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{formatDate(item.timestamp)}</span>
                    <button
                      onClick={() => handleDownload(item.media_url)}
                      className="p-1 rounded-lg bg-[#27272a] hover:bg-pink-600 text-slate-300 hover:text-white transition-colors"
                      title="Save voice note"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <audio controls src={item.media_url} className="w-full h-8 mt-1 rounded-lg" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Expanded Modal - rendered via portal at document root */}
      {expandedItem && createPortal(
        <div
          className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-4 md:p-8 animate-fadeIn"
          style={{ zIndex: 99999 }}
          onClick={() => setExpandedItem(null)}
          onTouchEnd={(e) => { if (e.target === e.currentTarget) setExpandedItem(null); }}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full bg-[#121212] border border-[#27272a] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-[#27272a] flex items-center justify-between bg-[#0B0F17]">
              <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                <Calendar className="w-4 h-4 text-pink-400" />
                <span>{new Date(expandedItem.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
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
                  onClick={(e) => { e.stopPropagation(); setExpandedItem(null); }}
                  className="p-2 rounded-xl bg-[#18181b] border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Expanded Media Content */}
            <div className="flex-1 overflow-hidden flex items-center justify-center p-4 bg-black/80 min-h-[300px]">
              {isVideoMedia(expandedItem.media_url) ? (
                <video
                  src={expandedItem.media_url}
                  controls
                  autoPlay
                  playsInline
                  className="max-w-full max-h-[75vh] rounded-2xl shadow-2xl"
                />
              ) : (
                <img
                  src={expandedItem.media_url}
                  alt="Expanded memory"
                  className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl"
                  draggable={false}
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