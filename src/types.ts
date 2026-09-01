export type UserRole = 'owner' | 'partner';

export interface AppConfig {
  owner_email: string;
  partner_allowed_emails: string[];
  partner_id?: string;
  partner_passcode?: string;
}

export interface UserProfile {
  uid: string;
  id?: string;
  email: string;
  role: UserRole;
  display_name?: string;
  photo_url?: string;
  is_typing?: boolean;
  last_seen?: any;
  partnerNicknames?: { [uid: string]: string };
  last_read_at?: any;
  theme?: 'light' | 'dark' | 'romantic' | 'lavender' | 'ocean' | 'sunset' | 'doodle' | 'noir' | 'forest' | 'cyber' | 'aurora';
}

export interface MediaAttachment {
  id: string;
  type: 'image' | 'video';
  url: string; // Base64 data url or direct media URI stored on device
  thumbnail?: string; // blur placeholder
  thumbnailUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  caption?: string;
  duration?: number; // duration in seconds for video
  width?: number;
  height?: number;
}

export interface Message {
  id: string;
  sender_role: UserRole;
  text: string;
  timestamp: any; // Firestore Timestamp
  reactions?: { [role: string]: string }; // role -> emoji
  deleted?: boolean;
  deletedBy?: UserRole;
  hidden_for_owner?: boolean;
  hidden_for_partner?: boolean;
  isEdited?: boolean;
  media?: MediaAttachment;
  /** Local-only while an optimistic message is waiting for Supabase. */
  deliveryStatus?: 'sending' | 'sent' | 'failed';
  replyTo?: {
    id: string;
    text: string;
    sender_role: UserRole;
    mediaType?: 'image' | 'video';
  };
  gameInvite?: {
    gameType: 'tictactoe';
    sessionId: string;
    status: 'pending' | 'active' | 'finished';
  };
}
