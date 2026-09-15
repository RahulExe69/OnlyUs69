import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  SwitchCamera,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Volume2,
  Sparkles,
} from 'lucide-react';
import { CallSession, UserProfile } from '../types';

interface CallModalProps {
  activeCall: CallSession | null;
  partnerProfile: UserProfile | null;
  partnerNickname?: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMicMuted: boolean;
  isCameraOff: boolean;
  callDuration: number;
  callErrorMessage: string | null;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onFlipCamera: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  activeCall,
  partnerProfile,
  partnerNickname,
  localStream,
  remoteStream,
  isMicMuted,
  isCameraOff,
  callDuration,
  callErrorMessage,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleCamera,
  onFlipCamera,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isPipMinimized, setIsPipMinimized] = useState(false);

  // Bind local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Bind remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Hidden audio fallback to ensure sound is always played even in voice-only calls
  useEffect(() => {
    if (remoteStream) {
      const audioEl = new Audio();
      audioEl.srcObject = remoteStream;
      audioEl.play().catch(() => {});
      return () => {
        audioEl.srcObject = null;
      };
    }
  }, [remoteStream]);

  if (!activeCall) return null;

  const isVideo = activeCall.type === 'video';
  const isIncoming = activeCall.status === 'ringing';
  const isCalling = activeCall.status === 'calling';
  const isConnected = activeCall.status === 'connected';

  const displayName =
    partnerNickname || partnerProfile?.display_name || (activeCall.callerRole === 'owner' ? 'Rahul' : 'Nusrat');
  const avatarUrl = partnerProfile?.photo_url;

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // If minimized to PiP floating widget during active call
  if (isPipMinimized && isConnected) {
    return (
      <motion.div
        drag
        dragConstraints={{ left: 10, right: 300, top: 10, bottom: 600 }}
        className="fixed bottom-24 right-4 z-[999] w-40 h-56 rounded-2xl overflow-hidden shadow-2xl bg-neutral-900 border-2 border-[var(--theme-accent)] flex flex-col cursor-grab active:cursor-grabbing"
      >
        {isVideo && remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-neutral-950 text-white">
            <div className="w-12 h-12 rounded-full overflow-hidden mb-2 ring-2 ring-[var(--theme-accent)]">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-neutral-800 flex items-center justify-center font-bold">
                  {displayName[0]}
                </div>
              )}
            </div>
            <span className="text-xs font-semibold truncate w-full">{displayName}</span>
            <span className="text-[10px] text-neutral-400 mt-0.5">{formatTime(callDuration)}</span>
          </div>
        )}

        <div className="absolute top-2 right-2 flex gap-1">
          <button
            onClick={() => setIsPipMinimized(false)}
            className="p-1 rounded-full bg-black/60 text-white hover:bg-black/90 backdrop-blur-xs"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
          <button
            onClick={onEnd}
            className="p-2 rounded-full bg-rose-600 text-white shadow-lg active:scale-95"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-lg overflow-hidden select-none"
      >
        {/* Remote Video Background (if connected in video mode) */}
        {isVideo && isConnected && remoteStream ? (
          <div className="absolute inset-0 w-full h-full overflow-hidden">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />
          </div>
        ) : null}

        {/* Top Header Bar */}
        <div className="absolute top-0 left-0 right-0 p-6 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] flex items-center justify-between z-20">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>P2P WebRTC Direct Encrypted</span>
          </div>

          {isConnected && (
            <button
              onClick={() => setIsPipMinimized(true)}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-all active:scale-95"
              title="Minimize to Picture-in-Picture"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Central Identity Area (Shown when ringing, calling, or in voice mode) */}
        {(!isVideo || !isConnected || !remoteStream) && (
          <div className="flex flex-col items-center justify-center text-center z-10 px-6 max-w-sm">
            {/* Animated Ring Ripple Avatar */}
            <div className="relative mb-6">
              {(isCalling || isIncoming) && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.4, 1.6], opacity: [0.6, 0.2, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                    className="absolute inset-0 rounded-full bg-[var(--theme-accent)]/30 -z-10"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1.3], opacity: [0.8, 0.4, 0] }}
                    transition={{ repeat: Infinity, duration: 2, delay: 0.4, ease: 'easeInOut' }}
                    className="absolute inset-0 rounded-full bg-[var(--theme-accent)]/40 -z-10"
                  />
                </>
              )}

              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl bg-neutral-800 flex items-center justify-center">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl font-bold text-white/80">{displayName[0]}</span>
                )}
              </div>

              <div className="absolute bottom-1 right-1 p-2 rounded-full bg-[var(--theme-accent)] text-white shadow-md">
                {isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
              </div>
            </div>

            {/* Caller Name */}
            <h2 className="text-2xl font-bold text-white tracking-tight drop-shadow-sm mb-1">
              {displayName}
            </h2>

            {/* Status Text */}
            <p className="text-sm font-medium text-white/70 flex items-center gap-1.5">
              {isCalling && (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>Calling OnlyUs partner...</span>
                </>
              )}
              {isIncoming && (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Incoming {isVideo ? 'Video' : 'Voice'} Call</span>
                </>
              )}
              {isConnected && (
                <span className="text-emerald-400 font-semibold tracking-wider">
                  {formatTime(callDuration)}
                </span>
              )}
            </p>

            {/* Error Message Notice */}
            {callErrorMessage && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 px-4 py-2 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs font-medium"
              >
                {callErrorMessage}
              </motion.div>
            )}
          </div>
        )}

        {/* Small Floating Local Video Preview (when connected in Video mode) */}
        {isVideo && localStream && (
          <motion.div
            drag
            dragConstraints={{ left: 10, right: 280, top: 60, bottom: 500 }}
            className={`absolute top-20 right-4 z-30 w-28 h-40 md:w-36 md:h-52 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-neutral-900 ${
              isCameraOff ? 'flex items-center justify-center' : ''
            }`}
          >
            {isCameraOff ? (
              <VideoOff className="w-8 h-8 text-neutral-500" />
            ) : (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            )}
            <span className="absolute bottom-1.5 left-2 text-[10px] text-white/80 font-medium bg-black/50 px-1.5 py-0.5 rounded-md backdrop-blur-xs">
              You
            </span>
          </motion.div>
        )}

        {/* Bottom Call Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-8 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] flex flex-col items-center z-20">
          {/* Status duration badge when remote video is full screen */}
          {isVideo && isConnected && remoteStream && (
            <div className="mb-6 px-4 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white font-mono text-sm shadow-md">
              {formatTime(callDuration)}
            </div>
          )}

          {isIncoming ? (
            /* Incoming Call Actions: Accept vs Reject */
            <div className="flex items-center gap-16">
              {/* Decline Button */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={onReject}
                  className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-xl shadow-rose-600/30 transition-transform active:scale-90"
                >
                  <PhoneOff className="w-7 h-7" />
                </button>
                <span className="text-xs text-white/80 font-medium">Decline</span>
              </div>

              {/* Accept Button */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={onAccept}
                  className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30 transition-transform active:scale-90 animate-bounce"
                >
                  <Phone className="w-7 h-7" />
                </button>
                <span className="text-xs text-white/80 font-medium">Accept</span>
              </div>
            </div>
          ) : (
            /* Outgoing / Active Connected Controls */
            <div className="flex items-center gap-4 bg-white/10 backdrop-blur-xl px-6 py-3.5 rounded-full border border-white/15 shadow-2xl">
              {/* Mute Mic */}
              <button
                onClick={onToggleMute}
                className={`p-3.5 rounded-full transition-all active:scale-95 ${
                  isMicMuted
                    ? 'bg-rose-500 text-white'
                    : 'bg-white/15 hover:bg-white/25 text-white'
                }`}
                title={isMicMuted ? 'Unmute' : 'Mute'}
              >
                {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Toggle Camera (in video mode) */}
              {isVideo && (
                <>
                  <button
                    onClick={onToggleCamera}
                    className={`p-3.5 rounded-full transition-all active:scale-95 ${
                      isCameraOff
                        ? 'bg-rose-500 text-white'
                        : 'bg-white/15 hover:bg-white/25 text-white'
                    }`}
                    title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
                  >
                    {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                  </button>

                  {/* Flip Camera */}
                  <button
                    onClick={onFlipCamera}
                    className="p-3.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition-all active:scale-95"
                    title="Flip Camera"
                  >
                    <SwitchCamera className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* End Call Button */}
              <button
                onClick={onEnd}
                className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 transition-transform active:scale-90 ml-2"
                title="End Call"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
