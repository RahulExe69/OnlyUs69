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
  theme?: 'light' | 'dark' | 'romantic';
  wallpaper?: string;
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
  replyTo?: {
    id: string;
    text: string;
    sender_role: UserRole;
  };
  gameInvite?: {
    gameType: 'tictactoe' | 'ludo';
    sessionId: string;
    status: 'pending' | 'active' | 'finished';
  };
}
