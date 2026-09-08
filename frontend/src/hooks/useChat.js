import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import {
  apiGetMessages,
  apiSendMessage,
  apiReactMessage,
  apiClearMessages,
  apiUnsendMessage,
  apiEditMessage,
  apiMarkSeen,
  apiMarkAllSeen,
} from '../services/supabaseService';
import { getWsUrl } from '../config';

export function useChat(userId, clientId, onSignal, partnerId = null) {
  const [messages, setMessages] = useState([]);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const realtimeChannelRef = useRef(null);
  const signalChannelRef = useRef(null);
  const presenceChannelRef = useRef(null);
  const onSignalRef = useRef(onSignal);

  useEffect(() => {
    onSignalRef.current = onSignal;
  }, [onSignal]);

  // Fetch initial messages history
  const fetchMessages = useCallback(async () => {
    try {
      const msgs = await apiGetMessages(userId, partnerId);
      setMessages(msgs);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  }, [userId, partnerId]);

  const markAllSeen = useCallback(async (targetPartnerId) => {
    const pId = targetPartnerId || partnerId || (userId === 1 ? 2 : userId === 2 ? 1 : userId === 3 ? 4 : userId === 4 ? 3 : null);
    if (!userId || !pId) return;
    await apiMarkAllSeen(pId, userId);
  }, [userId, partnerId]);

  // --- SUPABASE REALTIME SUBSCRIPTION MODE ---
  const connectSupabaseRealtime = useCallback(() => {
    setConnected(true);
    setError(null);

    // 1. Subscribe to Postgres Changes on 'messages' table
    const msgChannel = supabase
      .channel('messages_realtime_channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newRow = payload.new;
          if (newRow.text_content && newRow.text_content.startsWith('USER_SETTING:')) return;
          if (partnerId && newRow.sender_id !== userId && newRow.sender_id !== partnerId) return;
          const formatted = {
            id: newRow.id,
            sender_id: newRow.sender_id,
            text_content: newRow.text_content,
            media_url: newRow.media_url,
            reactions: typeof newRow.reactions === 'string' ? JSON.parse(newRow.reactions) : newRow.reactions || {},
            timestamp: newRow.timestamp,
          };
          setMessages((prev) => {
            if (prev.some((m) => m.id === formatted.id)) return prev;
            return [...prev, formatted];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const updated = payload.new;
          const rx = typeof updated.reactions === 'string' ? JSON.parse(updated.reactions) : updated.reactions || {};
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, text_content: updated.text_content, reactions: rx } : m))
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.old && payload.old.id) {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
          } else {
            setMessages([]);
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = msgChannel;

    // 2. Broadcast Channel for WebRTC Video & Voice Calling Signals
    const sigChannel = supabase
      .channel('call_room')
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        if (payload && payload.from_client_id !== clientId && onSignalRef.current) {
          onSignalRef.current(payload.signal_type, payload.data, payload.from_client_id);
        }
      })
      .subscribe();

    signalChannelRef.current = sigChannel;

    // 3. Supabase Realtime Presence Channel (Online / Offline status)
    if (userId) {
      const presenceChannel = supabase.channel('online_presence_room', {
        config: { presence: { key: String(userId) } },
      });

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState();
          setOnlineUserIds(Object.keys(state));
        })
        .on('presence', { event: 'join' }, () => {
          const state = presenceChannel.presenceState();
          setOnlineUserIds(Object.keys(state));
        })
        .on('presence', { event: 'leave' }, () => {
          const state = presenceChannel.presenceState();
          setOnlineUserIds(Object.keys(state));
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({
              user_id: String(userId),
              online_at: new Date().toISOString(),
            });
          }
        });

      presenceChannelRef.current = presenceChannel;
    }
  }, [clientId, userId]);

  // --- LOCAL FASTAPI WEBSOCKET MODE ---
  const connectFastAPIWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const wsUrl = getWsUrl(clientId);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'chat') {
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === data.id || (data.temp_id && m.temp_id === data.temp_id));
              if (exists) {
                return prev.map((m) => (m.id === data.id || (data.temp_id && m.temp_id === data.temp_id) ? data : m));
              }
              return [...prev, data];
            });
          } else if (data.type === 'reaction') {
            setMessages((prev) => prev.map((m) => (m.id === data.message_id ? { ...m, reactions: data.reactions } : m)));
          } else if (data.type === 'clear_chat') {
            setMessages([]);
          } else if (data.type === 'signal') {
            if (onSignalRef.current) {
              onSignalRef.current(data.signal_type, data.data, data.from_client_id);
            }
          }
        } catch (e) {
          console.error('[WS] Error parsing message:', e);
        }
      };

      ws.onclose = () => setConnected(false);
      ws.onerror = () => setError('Connection error');
    } catch (e) {
      console.error('[WS] Failed to connect:', e);
    }
  }, [clientId]);

  useEffect(() => {
    if (userId) {
      fetchMessages();
      if (isSupabaseConfigured()) {
        connectSupabaseRealtime();
      } else {
        connectFastAPIWs();
      }
    }
    return () => {
      if (realtimeChannelRef.current) supabase.removeChannel(realtimeChannelRef.current);
      if (signalChannelRef.current) supabase.removeChannel(signalChannelRef.current);
      if (presenceChannelRef.current) {
        presenceChannelRef.current.untrack();
        supabase.removeChannel(presenceChannelRef.current);
      }
      if (wsRef.current) wsRef.current.close();
    };
  }, [userId, fetchMessages, connectSupabaseRealtime, connectFastAPIWs]);

  // Actions
  const sendChatMessage = useCallback(
    async (text, mediaUrl = null, initialReactions = {}) => {
      if (isSupabaseConfigured()) {
        await apiSendMessage(userId, text, mediaUrl, initialReactions);
      } else if (wsRef.current?.readyState === WebSocket.OPEN) {
        const tempId = `temp_${Date.now()}_${Math.random()}`;
        wsRef.current.send(
          JSON.stringify({
            type: 'chat',
            sender_id: userId,
            text_content: text,
            media_url: mediaUrl,
            reactions: initialReactions,
            temp_id: tempId,
          })
        );
      }
    },
    [userId]
  );

  const reactMessage = useCallback(
    async (messageId, emoji) => {
      if (isSupabaseConfigured()) {
        await apiReactMessage(messageId, userId, emoji);
      } else if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'reaction',
            message_id: messageId,
            user_id: userId,
            emoji: emoji,
          })
        );
      }
    },
    [userId]
  );

  const clearMessages = useCallback(async () => {
    if (!userId || !partnerId) return;
    await apiClearMessages(userId, partnerId);
    setMessages([]);
  }, [userId, partnerId]);

  const sendSignal = useCallback(
    (signalType, data) => {
      if (isSupabaseConfigured() && signalChannelRef.current) {
        signalChannelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            signal_type: signalType,
            data,
            from_client_id: clientId,
            sender_id: userId,
          },
        });
      } else if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'signal',
            signal_type: signalType,
            data,
            sender_id: userId,
          })
        );
      }
    },
    [clientId, userId]
  );

  const unsendMessage = useCallback(async (messageId) => {
    if (isSupabaseConfigured()) {
      await apiUnsendMessage(messageId);
    }
  }, []);

  const editMessage = useCallback(async (messageId, newText) => {
    if (isSupabaseConfigured()) {
      await apiEditMessage(messageId, newText);
    }
  }, []);

  return {
    messages,
    onlineUserIds,
    connected,
    error,
    sendChatMessage,
    reactMessage,
    sendSignal,
    clearMessages,
    unsendMessage,
    editMessage,
    markAllSeen,
    refetchMessages: fetchMessages,
  };
}