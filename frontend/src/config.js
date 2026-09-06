// API and WebSocket configuration helper
export const getApiBaseUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '');
  }
  // If hosted on vercel.app or any external domain, point to local FastAPI backend on port 8000
  if (typeof window !== 'undefined' && (window.location.hostname.includes('vercel.app') || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'))) {
    return 'http://localhost:8000';
  }
  return '';
};

export const getWsUrl = (clientId) => {
  const apiBase = getApiBaseUrl();
  if (apiBase.startsWith('http')) {
    const wsProtocol = apiBase.startsWith('https') ? 'wss:' : 'ws:';
    const host = apiBase.replace(/^https?:\/\//, '');
    return `${wsProtocol}//${host}/ws/${clientId}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/${clientId}`;
};
