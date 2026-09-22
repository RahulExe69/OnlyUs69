export type CharacterId = 'rahul' | 'nusrat';

export interface SequenceConfig {
  /** Total number of frames in the horizontal strip */
  frames: number;
  /** Full duration of one cycle in milliseconds */
  durationMs: number;
  /** Whether the sequence loops infinitely */
  loop: boolean;
  /** Path to the horizontal WebP sprite strip asset */
  src: string;
}

export interface CharacterAssetPack {
  id: CharacterId;
  name: string;
  frameWidth: number;
  frameHeight: number;
  baselineY: number;
  sequences: {
    peek_in: SequenceConfig;
    presence_idle: SequenceConfig;
    look_around: SequenceConfig;
    blink: SequenceConfig;
    thinking: SequenceConfig;
    typing: SequenceConfig;
    peek_out: SequenceConfig;
  };
}

/**
 * Production-ready Rahul character sprite pack.
 * Built with consistent 128x128 frame dimensions, exact horizontal centering,
 * bottom-anchored ledge registration, and alpha transparency.
 */
export const RAHUL_CHARACTER: CharacterAssetPack = {
  id: 'rahul',
  name: 'Rahul',
  frameWidth: 128,
  frameHeight: 128,
  baselineY: 124,
  sequences: {
    peek_in: {
      frames: 6,
      durationMs: 480,
      loop: false,
      src: '/typing-peek/rahul/peek_in.webp',
    },
    presence_idle: {
      frames: 4,
      durationMs: 1400,
      loop: true,
      src: '/typing-peek/rahul/presence_idle.webp',
    },
    look_around: {
      frames: 5,
      durationMs: 1200,
      loop: false,
      src: '/typing-peek/rahul/look_around.webp',
    },
    blink: {
      frames: 4,
      durationMs: 380,
      loop: false,
      src: '/typing-peek/rahul/blink.webp',
    },
    thinking: {
      frames: 5,
      durationMs: 1100,
      loop: true,
      src: '/typing-peek/rahul/thinking.webp',
    },
    typing: {
      frames: 6,
      durationMs: 900,
      loop: true,
      src: '/typing-peek/rahul/typing.webp',
    },
    peek_out: {
      frames: 7,
      durationMs: 500,
      loop: false,
      src: '/typing-peek/rahul/peek_out.webp',
    },
  },
};

/**
 * Nusrat character asset pack structure.
 * Reusable architecture: When Nusrat's custom animated assets are supplied,
 * they drop directly into /typing-peek/nusrat/ without modifying component logic.
 */
export const NUSRAT_CHARACTER: CharacterAssetPack = {
  id: 'nusrat',
  name: 'Nusrat',
  frameWidth: 128,
  frameHeight: 128,
  baselineY: 124,
  sequences: {
    // Reusable fallback or dedicated sprite references
    peek_in: { frames: 6, durationMs: 480, loop: false, src: '/typing-peek/rahul/peek_in.webp' },
    presence_idle: { frames: 4, durationMs: 1400, loop: true, src: '/typing-peek/rahul/presence_idle.webp' },
    look_around: { frames: 5, durationMs: 1200, loop: false, src: '/typing-peek/rahul/look_around.webp' },
    blink: { frames: 4, durationMs: 380, loop: false, src: '/typing-peek/rahul/blink.webp' },
    thinking: { frames: 5, durationMs: 1100, loop: true, src: '/typing-peek/rahul/thinking.webp' },
    typing: { frames: 6, durationMs: 900, loop: true, src: '/typing-peek/rahul/typing.webp' },
    peek_out: { frames: 7, durationMs: 500, loop: false, src: '/typing-peek/rahul/peek_out.webp' },
  },
};

export function getCharacterForRole(role: 'owner' | 'partner'): CharacterAssetPack {
  return role === 'owner' ? RAHUL_CHARACTER : NUSRAT_CHARACTER;
}
