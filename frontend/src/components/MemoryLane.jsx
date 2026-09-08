import { Image as ImageIcon, Loader2, X, Maximize2, Sparkles, Download, Calendar, Search, Layers, ArrowLeft, Heart, Film } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { apiGetMessages } from '../services/supabaseService';

export default function MemoryLane({ currentUserId, onBackToChat, onClose }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedImage, setExpandedImage] = useState(null);

  const fetchGallery = useCallback(async () => {
    try {
      const allMsgs = await apiGetMessages();
      const mediaMsgs = allMsgs.filter((m) => Boolean(m.media_url));
      mediaMsgs.reverse(); // Newest first
      setImages(mediaMsgs);
    } catch (err) {
      console.error('Failed to fetch gallery:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  const filteredImages = images.filter((img) => {
    if (!searchQuery) return true;
    const dateStr = new Date(img.timestamp).toLocaleDateString().toLowerCase();
    const textStr = (img.text_content || '').toLowerCase();
    return dateStr.includes(searchQuery.toLowerCase()) || textStr.includes(searchQuery.toLowerCase());
  });

  const formatDate = (iso) => {
    return new Date(iso).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

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
              <p className="text-xs text-slate-400 font-medium">Shared Photos & Media</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-900/40 text-purple-300 border border-purple-700/50 shadow-inner">
              {images.length} {images.length === 1 ? 'item' : 'items'}
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

        {/* Search filter input */}
        <div className="relative mt-3">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by caption or date..."
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
        ) : filteredImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6 text-center animate-fadeIn">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-pink-500/10 to-purple-600/10 border border-purple-500/20 flex items-center justify-center mb-4 shadow-xl">
              <ImageIcon className="w-9 h-9 text-pink-400/80" />
            </div>
            <p className="text-base font-bold text-slate-200 mb-1">No shared memories yet</p>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Send photos, videos, or attachments in your chat to collect shared moments here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredImages.map((img) => (
              <div
                key={img.id}
                onClick={() => setExpandedImage(img)}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-[#27272a] bg-[#18181b] cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-pink-950/40 hover:border-pink-500/50 transition-all duration-300 active:scale-95"
              >
                <img
                  src={img.media_url}
                  alt="Memory media"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />

                {/* Hover overlay card */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-3 flex flex-col justify-between">
                  <div className="self-end">
                    <span className="p-1.5 rounded-xl bg-black/60 backdrop-blur-md text-white block shadow-md">
                      <Maximize2 className="w-3.5 h-3.5 text-pink-300" />
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-200 font-medium truncate flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-pink-400" />
                    <span>{formatDate(img.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Expanded Modal */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-4 md:p-8 animate-fadeIn"
          onClick={() => setExpandedImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-[#121212] border border-[#27272a] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-[#27272a] flex items-center justify-between bg-[#0B0F17]">
              <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                <Calendar className="w-4 h-4 text-pink-400" />
                <span>{new Date(expandedImage.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={expandedImage.media_url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl bg-[#18181b] border border-slate-800 text-slate-200 hover:text-white hover:bg-slate-800 transition-colors text-xs flex items-center gap-1.5 font-medium"
                >
                  <Download className="w-4 h-4 text-pink-400" />
                  Save
                </a>
                <button
                  onClick={() => setExpandedImage(null)}
                  className="p-2 rounded-xl bg-[#18181b] border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Expanded Media Image */}
            <div className="flex-1 overflow-hidden flex items-center justify-center p-4 bg-black/80 min-h-[300px]">
              <img
                src={expandedImage.media_url}
                alt="Expanded memory"
                className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}