export type MessageState = 'sent' | 'delivered' | 'read';

export interface ChatAttachment {
  id: string;
  message_id: string;
  file_url: string;
  file_type: string | null; // 'image' | 'video' | 'pdf' | 'file'
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
}

export type ChatRoomType = 'client_chat' | 'internal_team_chat' | 'peer_chat';

export interface ChatMessage {
  id: string;
  case_id: string | null;
  sender_id: string;
  sender_role: string | null;
  message_text: string;
  room_type: ChatRoomType | null;
  team_id: string | null;
  peer_target_id: string | null;
  has_attachments: boolean;
  attachments?: ChatAttachment[];
  delivered_at: string | null;
  read_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  client_msg_key?: string | null;
  _optimistic?: boolean;
}

export function messageState(m: ChatMessage): MessageState {
  if (m.read_at) return 'read';
  if (m.delivered_at) return 'delivered';
  return 'sent';
}

export function detectFileType(mime: string): string {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  return 'file';
}
