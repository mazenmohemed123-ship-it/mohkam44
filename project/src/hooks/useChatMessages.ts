import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { sanitize } from '../services/sanitize';
import { detectFileType, type ChatAttachment, type ChatMessage, type ChatRoomType } from '../services/chat/types';

const byTime = (a: ChatMessage, b: ChatMessage) =>
  new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

interface UseChatMessagesParams {
  userId: string;
  userRole?: string;
  roomType: ChatRoomType;
  caseId?: string | null;
  teamId?: string | null;
  peerTargetId?: string | null;
  enabled?: boolean;
}

/**
 * Single source of truth for a chat room's messages.
 * - Realtime INSERT/UPDATE over a single Supabase channel (one global singleton client).
 * - Optimistic send reconciled by `client_msg_key` so the realtime echo never duplicates.
 * - Soft-deleted messages (`deleted_at`) are filtered out everywhere.
 * - Read/delivered receipts are driven via SECURITY DEFINER RPCs when the room is open.
 */
export function useChatMessages({
  userId,
  userRole,
  roomType,
  caseId,
  teamId,
  peerTargetId,
  enabled = true,
}: UseChatMessagesParams) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isGroup = roomType === 'internal_team_chat';
  const scopeKey = isGroup ? teamId : caseId;

  const upsert = useCallback((incoming: ChatMessage) => {
    setMessages((prev) => {
      // Drop ANY prior copy of this message — same id, or same client_msg_key (covers the
      // optimistic bubble and any realtime echo). Guarantees a single copy per message.
      let next = prev.filter((m) =>
        m.id !== incoming.id &&
        !(incoming.client_msg_key && m.client_msg_key && m.client_msg_key === incoming.client_msg_key),
      );
      // Preserve attachments already resolved for this id if the incoming one lacks them.
      const prevSame = prev.find((m) => m.id === incoming.id || (incoming.client_msg_key && m.client_msg_key === incoming.client_msg_key));
      const merged = { ...incoming, attachments: incoming.attachments ?? prevSame?.attachments ?? [] };
      if (merged.deleted_at) return next.sort(byTime);
      next = [...next, merged].sort(byTime);
      return next;
    });
  }, []);

  const fetchAttachments = useCallback(async (ids: string[]) => {
    const map: Record<string, ChatAttachment[]> = {};
    if (!ids.length) return map;
    const { data } = await supabase.from('message_attachments').select('*').in('message_id', ids);
    (data || []).forEach((a: any) => {
      (map[a.message_id] ||= []).push(a as ChatAttachment);
    });
    return map;
  }, []);

  const markRead = useCallback(() => {
    if (caseId && !isGroup) supabase.rpc('mark_conversation_read', { p_case_id: caseId }).then(undefined, () => {});
  }, [caseId, isGroup]);

  useEffect(() => {
    if (!enabled || !scopeKey) {
      setMessages([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);

    (async () => {
      let q = supabase
        .from('messages')
        .select('*')
        .eq('room_type', roomType)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      q = isGroup ? q.eq('team_id', teamId as string) : q.eq('case_id', caseId as string);

      const { data } = await q;
      if (!active) return;

      const msgs = (data || []) as ChatMessage[];
      const attMap = await fetchAttachments(msgs.filter((m) => m.has_attachments).map((m) => m.id));
      msgs.forEach((m) => { m.attachments = attMap[m.id] || []; });
      setMessages(msgs);
      setLoading(false);
      markRead();
    })();

    const filter = isGroup ? `team_id=eq.${teamId}` : `case_id=eq.${caseId}`;
    chRef.current?.unsubscribe();
    const channel = supabase
      .channel(`chat:${roomType}:${scopeKey}:${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter }, async (payload) => {
        const msg = payload.new as ChatMessage;
        if (msg.room_type !== roomType || msg.deleted_at) return;
        if (msg.has_attachments) {
          const map = await fetchAttachments([msg.id]);
          msg.attachments = map[msg.id] || [];
        } else {
          msg.attachments = [];
        }
        upsert(msg);
        if (msg.sender_id !== userId) markRead();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter }, (payload) => {
        const msg = payload.new as ChatMessage;
        if (msg.room_type !== roomType) return;
        upsert(msg);
      })
      // Attachments arrive on their own (RLS-filtered) stream; attach them to their message
      // as soon as they land, regardless of insert ordering.
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_attachments' }, (payload) => {
        const att = payload.new as ChatAttachment;
        setMessages((prev) => prev.map((m) => {
          if (m.id !== att.message_id) return m;
          if ((m.attachments || []).some((a) => a.id === att.id)) return m;
          return { ...m, has_attachments: true, attachments: [...(m.attachments || []), att] };
        }));
      })
      .subscribe();
    chRef.current = channel;

    return () => {
      active = false;
      channel.unsubscribe();
    };
  }, [enabled, scopeKey, roomType, isGroup, caseId, teamId, userId, upsert, fetchAttachments, markRead]);

  const send = useCallback(
    async (text: string, files?: File[]): Promise<void> => {
      const clean = sanitize(text || '').trim();
      const hasFiles = !!(files && files.length);
      if (!clean && !hasFiles) return;

      const client_msg_key = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const nowIso = new Date().toISOString();
      const baseText = clean || (hasFiles ? 'مرفق' : '');

      // Optimistic bubble (reconciled by client_msg_key when the row echoes back).
      upsert({
        id: 'temp-' + client_msg_key,
        case_id: caseId ?? null,
        sender_id: userId,
        sender_role: userRole || null,
        message_text: baseText,
        room_type: roomType,
        team_id: isGroup ? (teamId ?? null) : null,
        peer_target_id: roomType === 'peer_chat' ? (peerTargetId ?? null) : null,
        has_attachments: hasFiles,
        attachments: [],
        delivered_at: null,
        read_at: null,
        deleted_at: null,
        created_at: nowIso,
        updated_at: nowIso,
        client_msg_key,
        _optimistic: true,
      });

      const { data: inserted, error } = await supabase
        .from('messages')
        .insert([{
          case_id: caseId ?? null,
          sender_id: userId,
          sender_role: userRole || null,
          message_text: baseText,
          room_type: roomType,
          team_id: isGroup ? (teamId ?? null) : null,
          peer_target_id: roomType === 'peer_chat' ? (peerTargetId ?? null) : null,
          has_attachments: hasFiles,
          client_msg_key,
        }])
        .select('*')
        .single();

      if (error || !inserted) {
        // A duplicate (23505) means the row is already saved — keep the optimistic bubble;
        // otherwise roll it back.
        if ((error as any)?.code !== '23505') {
          setMessages((prev) => prev.filter((m) => m.client_msg_key !== client_msg_key));
          throw error || new Error('send failed');
        }
        return;
      }

      const attachments: ChatAttachment[] = [];
      if (hasFiles) {
        for (const file of files as File[]) {
          const path = `chat/${caseId || teamId}/${inserted.id}/${Date.now()}_${file.name}`;
          const { error: upErr } = await supabase.storage.from('chat-attachments').upload(path, file);
          if (upErr) continue;
          const { data: pub } = supabase.storage.from('chat-attachments').getPublicUrl(path);
          const { data: att } = await supabase
            .from('message_attachments')
            .insert([{
              message_id: inserted.id,
              file_url: pub.publicUrl,
              file_type: detectFileType(file.type),
              mime_type: file.type,
              file_size: file.size,
            }])
            .select('*')
            .single();
          if (att) attachments.push(att as ChatAttachment);
        }
      }

      upsert({ ...(inserted as ChatMessage), attachments, client_msg_key });
    },
    [userId, userRole, caseId, roomType, teamId, peerTargetId, isGroup, upsert],
  );

  const editMessage = useCallback(async (id: string, text: string) => {
    const clean = sanitize(text).trim();
    if (!clean) return;
    await supabase.from('messages').update({ message_text: clean, updated_at: new Date().toISOString() }).eq('id', id);
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, message_text: clean } : m)));
  }, []);

  const deleteMessage = useCallback(async (id: string) => {
    await supabase.from('messages').update({ deleted_at: new Date().toISOString(), is_deleted: true }).eq('id', id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return { messages, loading, send, editMessage, deleteMessage, markRead };
}
