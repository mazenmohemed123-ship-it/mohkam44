import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';

interface UseChatPresenceParams {
  roomKey?: string | null;
  userId: string;
  userName?: string;
  enabled?: boolean;
}

/**
 * Per-conversation presence built on Supabase Realtime Presence.
 * - Online/offline: every participant who has the conversation open is tracked under
 *   their userId key, so `othersOnline` reflects who is currently in this chat.
 * - Typing: a transient `typing` flag on the presence meta, auto-cleared after 3s.
 */
export function useChatPresence({ roomKey, userId, userName, enabled = true }: UseChatPresenceParams) {
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !roomKey || !userId) {
      setOnlineUserIds([]);
      setTypingUserIds([]);
      return;
    }

    const channel = supabase.channel(`presence:${roomKey}`, {
      config: { presence: { key: userId } },
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState() as Record<string, Array<{ typing?: boolean }>>;
      const ids = Object.keys(state);
      setOnlineUserIds(ids);
      setTypingUserIds(ids.filter((id) => id !== userId && state[id]?.some((m) => m.typing)));
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user_id: userId, user_name: userName || '', typing: false, online_at: new Date().toISOString() });
      }
    });

    channelRef.current = channel;
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [enabled, roomKey, userId, userName]);

  const track = useCallback((typing: boolean) => {
    channelRef.current?.track({ user_id: userId, user_name: userName || '', typing, online_at: new Date().toISOString() });
  }, [userId, userName]);

  const setTyping = useCallback(() => {
    track(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => track(false), 3000);
  }, [track]);

  const othersOnline = onlineUserIds.filter((id) => id !== userId);

  return {
    onlineUserIds,
    othersOnline,
    isAnyoneElseOnline: othersOnline.length > 0,
    typingUserIds,
    isOtherTyping: typingUserIds.length > 0,
    setTyping,
  };
}
