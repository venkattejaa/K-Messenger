import { Image as ImageIcon, Loader2, X, Maximize2, Sparkles, Download, Calendar, Search, Layers } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { getApiBaseUrl } from '../config';

export default function MemoryLane({ currentUserId }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedImage, setExpandedImage] = useState(null);

  const fetchGallery = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/gallery`);
      const data = await res.json();
      setImages(data);
    } catch (err) {
      console.error('Failed to fetch gallery:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  const filteredImages = images.filter(img => {
    if (!searchQuery) return true;
    const dateStr = new Date(img.timestamp).toLocaleDateString().toLowerCase();
    const textStr = (img.text_content || '').toLowerCase();
    return dateStr.includes(searchQuery.toLowerCase()) || textStr.includes(searchQuery.toLowerCase());
  });

  const formatDate = (iso) => {
    return new Date(iso).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#0F172A]/90 border-r border-slate-800/80 backdrop-blur-xl relative">
      {/* Top Header */}
      <div className="p-5 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-slate-100 font-bold text-base tracking-tight flex items-center gap-1.5">
                Memory Lane
              </h3>
              <p className="text-xs text-slate-400 font-medium">Shared Moments & Media</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            {images.length}
          </span>
        </div>

        {/* Search filter */}
        <div className="relative mt-3">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search moments..."
            className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all font-medium"
          />
        </div>
      </div>

      {/* Media Grid */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mb-3" />
            <p className="text-xs font-medium">Loading memories...</p>
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4 border border-slate-700/50">
              <ImageIcon className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-sm font-semibold text-slate-300 mb-1">No shared memories yet</p>
            <p className="text-xs text-slate-500 max-w-xs">
              Upload photos in the chat to fill your shared memory collection.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredImages.map((img) => (
              <div
                key={img.id}
                onClick={() => setExpandedImage(img)}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 cursor-pointer shadow-md hover:shadow-xl hover:shadow-indigo-950/50 hover:border-indigo-500/40 transition-all duration-300"
              >
                <img
                  src={img.media_url}
                  alt="Memory item"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />

                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-3 flex flex-col justify-between">
                  <div className="self-end">
                    <span className="p-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md text-white block">
                      <Maximize2 className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-medium truncate flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-indigo-400" />
                    {formatDate(img.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expanded Lightbox Modal */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-4 md:p-8 animate-fadeIn"
          onClick={() => setExpandedImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-slate-900/90 border border-slate-700/60 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>{new Date(expandedImage.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={expandedImage.media_url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-xs flex items-center gap-1.5 font-medium"
                >
                  <Download className="w-4 h-4" />
                  Save
                </a>
                <button
                  onClick={() => setExpandedImage(null)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Media Image */}
            <div className="flex-1 overflow-hidden flex items-center justify-center p-4 bg-black/60 min-h-[300px]">
              <img
                src={expandedImage.media_url}
                alt="Expanded memory"
                className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}