import { useState, useEffect, useRef, useCallback } from 'react';

export function useChat(userId, clientId, onSignal) {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000;
  const onSignalRef = useRef(onSignal);

  useEffect(() => {
    onSignalRef.current = onSignal;
  }, [onSignal]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/${clientId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        console.log('[WS] Connected successfully');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'chat') {
            setMessages(prev => {
              const exists = prev.some(m => m.id === data.id || (data.temp_id && m.temp_id === data.temp_id));
              if (exists) {
                return prev.map(m => (m.id === data.id || (data.temp_id && m.temp_id === data.temp_id)) ? data : m);
              }
              return [...prev, data];
            });
          } else if (data.type === 'reaction') {
            setMessages(prev => prev.map(m => m.id === data.message_id ? { ...m, reactions: data.reactions } : m));
          } else if (data.type === 'signal') {
            if (onSignalRef.current) {
              onSignalRef.current(data.signal_type, data.data, data.from_client_id);
            }
          }
        } catch (e) {
          console.error('[WS] Error parsing message:', e);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        console.log('[WS] Connection closed');
        
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(
            baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current),
            30000
          );
          reconnectAttemptsRef.current++;
          console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        } else {
          setError('Connection lost. Reconnecting...');
        }
      };

      ws.onerror = (err) => {
        console.error('[WS] Error:', err);
        setError('Connection error');
      };
    } catch (e) {
      console.error('[WS] Failed to instantiate WebSocket:', e);
      setError('Failed to connect');
    }
  }, [clientId]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  const sendMessage = useCallback((payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    } else {
      console.warn('[WS] Cannot send message - socket not open');
    }
  }, []);

  const sendChatMessage = useCallback((text, mediaUrl = null) => {
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const newMsg = {
      type: 'chat',
      sender_id: userId,
      text_content: text,
      media_url: mediaUrl,
      temp_id: tempId,
    };
    sendMessage(newMsg);
  }, [sendMessage, userId]);

  const reactMessage = useCallback((messageId, emoji) => {
    sendMessage({
      type: 'reaction',
      message_id: messageId,
      user_id: userId,
      emoji: emoji,
    });
  }, [sendMessage, userId]);

  const sendSignal = useCallback((signalType, data) => {
    sendMessage({
      type: 'signal',
      signal_type: signalType,
      data,
      sender_id: userId,
    });
  }, [sendMessage, userId]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/messages');
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  }, []);

  useEffect(() => {
    if (userId) {
      fetchMessages();
      connect();
    }
    return () => disconnect();
  }, [userId, connect, disconnect, fetchMessages]);

  return {
    messages,
    connected,
    error,
    sendChatMessage,
    reactMessage,
    sendSignal,
    connect,
    disconnect,
    refetchMessages: fetchMessages,
  };
}