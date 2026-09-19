export const APP_VERSION = '1.5.0';

export type UserRole = 'owner' | 'partner';

export interface AppConfig {
  owner_email: string;
  partner_allowed_emails: string[];
  partner_id?: string;
  partner_passcode?: string;
  pet_config?: PetSettings;
}

export interface UserProfile {
  uid: string;
  id?: string;
  email: string;
  role: UserRole;
  display_name?: string;
  username?: string; // Visual username / handle (e.g. @bodruddoja4, @rahul)
  photo_url?: string;
  is_typing?: boolean;
  last_seen?: any;
  partnerNicknames?: { [uid: string]: string };
  last_read_at?: any;
  theme?: string;
  public_key?: string;
  encrypted_private_key?: string;
  key_salt?: string;
  key_iv?: string;
}

export interface MediaAttachment {
  id: string;
  type: 'image' | 'video' | 'audio';
  url: string; // Base64 data url or direct media URI stored on device
  thumbnail?: string; // blur placeholder
  thumbnailUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  caption?: string;
  duration?: number; // duration in seconds for video or audio
  width?: number;
  height?: number;
  mediaList?: MediaAttachment[]; // Multiple items support
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
  mediaList?: MediaAttachment[]; // For multi-photo albums / collages
  /** Local-only while an optimistic message is waiting for Supabase. */
  deliveryStatus?: 'sending' | 'sent' | 'failed';
  replyTo?: {
    id: string;
    text: string;
    sender_role: UserRole;
    mediaType?: 'image' | 'video' | 'audio';
  };
  created_at?: string;
  ciphertext?: string;
  iv?: string;
  is_encrypted?: boolean;
  gameInvite?: {
    gameType: 'tictactoe' | 'connecthearts' | 'dotsandboxes';
    sessionId: string;
    status: 'pending' | 'active' | 'finished' | 'closed';
  };
}

export interface InGameChatMessage {
  id: string;
  senderRole: UserRole;
  senderName: string;
  text: string;
  timestamp: number;
  isQuickReaction?: boolean;
}

export interface ActiveGameSession {
  id: string;
  type: 'tictactoe' | 'connecthearts' | 'dotsandboxes';
}

export type CallType = 'voice' | 'video';
export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

export interface CallSession {
  callId: string;
  type: CallType;
  callerRole: UserRole;
  receiverRole: UserRole;
  status: CallStatus;
  startedAt?: number;
  duration?: number;
}

export interface CallSignalPayload {
  callId: string;
  type: CallType;
  senderRole: UserRole;
  targetRole: UserRole;
  action: 'offer' | 'answer' | 'ice-candidate' | 'end' | 'reject' | 'busy';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  timestamp: number;
}

export type PetBreed =
  | 'mochi'
  | 'calico'
  | 'caramel'
  | 'luna'
  | 'siamese'
  | 'tuxedo'
  | 'silver'
  | 'cinnamon'
  | 'berry';

export type PetAccessory =
  | 'none'
  | 'bow'
  | 'bell'
  | 'sakura'
  | 'scarf'
  | 'crown'
  | 'glasses'
  | 'sprout'
  | 'beanie'
  | 'angel_halo'
  | 'heart_clip'
  | 'party_hat';

export interface PetSettings {
  enabled: boolean;
  name: string;
  breed: PetBreed;
  accessory: PetAccessory;
  soundEnabled?: boolean;
}
