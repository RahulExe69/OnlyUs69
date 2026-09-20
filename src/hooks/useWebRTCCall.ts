import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { UserRole, CallType, CallStatus, CallSession, CallSignalPayload } from '../types';
import { callAudio } from '../lib/callAudio';

// Free high-availability public STUN and TURN relay servers
const ICE_SERVERS: RTCIceServer[] = [
  // Google Global STUN
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  // OpenRelay Public TURN & STUN (Enables NAT traversal across 4G/5G mobile cellular CGNAT)
  { urls: 'stun:openrelay.metered.ca:80' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

const OUTGOING_CALL_TIMEOUT_MS = 38000; // 38 seconds timeout for unanswered outgoing calls

interface UseWebRTCCallProps {
  currentRole: UserRole | null;
  partnerRole: UserRole | null;
  partnerName?: string;
  partnerPhoto?: string;
  isStealthUnlocked?: boolean; // For Nusrat stealth protection
}

export function useWebRTCCall({
  currentRole,
  partnerRole,
  partnerName,
  partnerPhoto,
  isStealthUnlocked = true,
}: UseWebRTCCallProps) {
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [callErrorMessage, setCallErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // References
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);
  const callTimerRef = useRef<any>(null);
  const outgoingTimeoutRef = useRef<any>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const wakeLockSentinelRef = useRef<any>(null);
  const facingModeRef = useRef<'user' | 'environment'>('user');

  // Synchronized state refs to avoid effect re-subscriptions and stale closures
  const activeCallRef = useRef<CallSession | null>(null);
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  const isStealthUnlockedRef = useRef(isStealthUnlocked);
  useEffect(() => {
    isStealthUnlockedRef.current = isStealthUnlocked;
  }, [isStealthUnlocked]);

  // Screen Wake Lock Management (keeps mobile display and WebRTC thread alive)
  const acquireWakeLock = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && !wakeLockSentinelRef.current) {
        wakeLockSentinelRef.current = await (navigator as any).wakeLock.request('screen');
        wakeLockSentinelRef.current.addEventListener('release', () => {
          wakeLockSentinelRef.current = null;
        });
      }
    } catch (err) {
      console.warn('[WebRTC] Screen Wake Lock not available or rejected:', err);
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockSentinelRef.current) {
      try {
        await wakeLockSentinelRef.current.release();
      } catch {}
      wakeLockSentinelRef.current = null;
    }
  }, []);

  // Cleanup helper
  const cleanUpCall = useCallback(() => {
    callAudio.stopRingtone();
    releaseWakeLock();

    if (outgoingTimeoutRef.current) {
      clearTimeout(outgoingTimeoutRef.current);
      outgoingTimeoutRef.current = null;
    }

    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch {}
      peerConnectionRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    remoteStreamRef.current = null;
    iceCandidatesQueue.current = [];
    pendingOfferRef.current = null;
    activeCallRef.current = null;
    setActiveCall(null);
    setCallDuration(0);
    setIsMicMuted(false);
    setIsCameraOff(false);
    setFacingMode('user');
    facingModeRef.current = 'user';
  }, [releaseWakeLock]);

  const cleanUpCallRef = useRef(cleanUpCall);
  useEffect(() => {
    cleanUpCallRef.current = cleanUpCall;
  }, [cleanUpCall]);

  // Send a signaling message over Supabase Realtime broadcast
  const sendSignal = useCallback(
    async (payload: Omit<CallSignalPayload, 'senderRole' | 'targetRole' | 'timestamp'>) => {
      if (!currentRole || !partnerRole || !channelRef.current) return;
      const fullPayload: CallSignalPayload = {
        ...payload,
        senderRole: currentRole,
        targetRole: partnerRole,
        timestamp: Date.now(),
      };
      try {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'call_signal',
          payload: fullPayload,
        });
      } catch (err) {
        console.error('[WebRTC] Failed to send call signal:', err);
      }
    },
    [currentRole, partnerRole]
  );

  // Create PeerConnection instance
  const createPeerConnection = useCallback(
    (callId: string, type: CallType): RTCPeerConnection => {
      if (peerConnectionRef.current) {
        try {
          peerConnectionRef.current.close();
        } catch {}
      }

      const pc = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 2,
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal({
            callId,
            type,
            action: 'ice-candidate',
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        let stream = event.streams && event.streams[0];
        if (!stream) {
          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream();
          }
          remoteStreamRef.current.addTrack(event.track);
          stream = remoteStreamRef.current;
        } else {
          remoteStreamRef.current = stream;
        }
        setRemoteStream(new MediaStream(stream.getTracks()));
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          callAudio.playConnectedTone();
          if (outgoingTimeoutRef.current) {
            clearTimeout(outgoingTimeoutRef.current);
            outgoingTimeoutRef.current = null;
          }
          acquireWakeLock();
          setActiveCall((prev) => (prev ? { ...prev, status: 'connected' } : null));

          // Start duration timer
          if (!callTimerRef.current) {
            const start = Date.now();
            callTimerRef.current = setInterval(() => {
              setCallDuration(Math.floor((Date.now() - start) / 1000));
            }, 1000);
          }
        } else if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          if (activeCallRef.current?.status === 'connected') {
            callAudio.playEndTone();
            cleanUpCallRef.current();
          }
        }
      };

      peerConnectionRef.current = pc;
      return pc;
    },
    [acquireWakeLock, sendSignal]
  );

  // Initialize Media Stream (Camera / Mic)
  const acquireMedia = useCallback(async (type: CallType): Promise<MediaStream | null> => {
    try {
      setCallErrorMessage(null);
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video:
          type === 'video'
            ? {
                facingMode: 'user',
                width: { ideal: 640, max: 1280 },
                height: { ideal: 480, max: 720 },
                frameRate: { ideal: 24, max: 30 },
              }
            : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setFacingMode('user');
      facingModeRef.current = 'user';
      return stream;
    } catch (err: any) {
      console.error('[WebRTC] Media access error:', err);
      let friendlyError = 'Could not access microphone or camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        friendlyError = 'Camera/Microphone permission denied. Please allow permission in browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        friendlyError = 'No camera or microphone device found on this system.';
      }
      setCallErrorMessage(friendlyError);
      return null;
    }
  }, []);

  // Initiate an Outgoing Call
  const startCall = useCallback(
    async (type: CallType) => {
      if (!currentRole || !partnerRole) return;
      cleanUpCall();

      const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newSession: CallSession = {
        callId,
        type,
        callerRole: currentRole,
        receiverRole: partnerRole,
        status: 'calling',
        startedAt: Date.now(),
      };
      activeCallRef.current = newSession;
      setActiveCall(newSession);

      callAudio.startOutgoingRingtone();

      // Point 5: 38-second outgoing ring timeout to avoid infinite battery drain
      if (outgoingTimeoutRef.current) {
        clearTimeout(outgoingTimeoutRef.current);
      }
      outgoingTimeoutRef.current = setTimeout(async () => {
        if (activeCallRef.current?.status === 'calling') {
          callAudio.stopRingtone();
          callAudio.playEndTone();
          setCallErrorMessage('No answer');
          await sendSignal({
            callId,
            type,
            action: 'end',
          });
          setTimeout(() => {
            cleanUpCallRef.current();
          }, 2000);
        }
      }, OUTGOING_CALL_TIMEOUT_MS);

      const stream = await acquireMedia(type);
      if (!stream) {
        callAudio.stopRingtone();
        if (outgoingTimeoutRef.current) {
          clearTimeout(outgoingTimeoutRef.current);
          outgoingTimeoutRef.current = null;
        }
        activeCallRef.current = null;
        setActiveCall(null);
        return;
      }

      const pc = createPeerConnection(callId, type);
      stream.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, stream);
        if (track.kind === 'video' && sender.getParameters) {
          try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = 750000;
            sender.setParameters(params).catch(() => {});
          } catch {}
        }
      });

      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: type === 'video',
        });
        await pc.setLocalDescription(offer);

        await sendSignal({
          callId,
          type,
          action: 'offer',
          sdp: offer,
        });
      } catch (err) {
        console.error('[WebRTC] Error creating offer:', err);
        cleanUpCall();
      }
    },
    [acquireMedia, cleanUpCall, createPeerConnection, currentRole, partnerRole, sendSignal]
  );

  // Accept an Incoming Call
  const acceptCall = useCallback(async () => {
    const curCall = activeCallRef.current;
    if (!curCall || curCall.status !== 'ringing') return;
    callAudio.stopRingtone();

    const stream = await acquireMedia(curCall.type);
    if (!stream) {
      cleanUpCall();
      return;
    }

    const pc = createPeerConnection(curCall.callId, curCall.type);
    stream.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, stream);
      if (track.kind === 'video' && sender.getParameters) {
        try {
          const params = sender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          params.encodings[0].maxBitrate = 750000;
          sender.setParameters(params).catch(() => {});
        } catch {}
      }
    });

    try {
      if (pendingOfferRef.current) {
        await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
        pendingOfferRef.current = null;
      }

      // Flush queued candidates
      while (iceCandidatesQueue.current.length > 0) {
        const candidate = iceCandidatesQueue.current.shift();
        if (candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await sendSignal({
        callId: curCall.callId,
        type: curCall.type,
        action: 'answer',
        sdp: answer,
      });

      activeCallRef.current = { ...curCall, status: 'connected' };
      setActiveCall((prev) => (prev ? { ...prev, status: 'connected' } : null));
    } catch (err) {
      console.error('[WebRTC] Error answering call:', err);
      cleanUpCall();
    }
  }, [acquireMedia, cleanUpCall, createPeerConnection, sendSignal]);

  // Reject an Incoming Call
  const rejectCall = useCallback(async () => {
    const curCall = activeCallRef.current;
    if (curCall) {
      callAudio.stopRingtone();
      if (outgoingTimeoutRef.current) {
        clearTimeout(outgoingTimeoutRef.current);
        outgoingTimeoutRef.current = null;
      }
      await sendSignal({
        callId: curCall.callId,
        type: curCall.type,
        action: 'reject',
      });
    }
    cleanUpCall();
  }, [cleanUpCall, sendSignal]);

  // End an Active or Outgoing Call
  const endCall = useCallback(async () => {
    const curCall = activeCallRef.current;
    if (curCall) {
      callAudio.playEndTone();
      if (outgoingTimeoutRef.current) {
        clearTimeout(outgoingTimeoutRef.current);
        outgoingTimeoutRef.current = null;
      }
      await sendSignal({
        callId: curCall.callId,
        type: curCall.type,
        action: 'end',
      });
    }
    cleanUpCall();
  }, [cleanUpCall, sendSignal]);

  // Toggle Mute Audio
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextEnabled = !audioTracks[0].enabled;
        audioTracks.forEach((t) => (t.enabled = nextEnabled));
        setIsMicMuted(!nextEnabled);
      }
    }
  }, []);

  // Toggle Camera On/Off
  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const nextEnabled = !videoTracks[0].enabled;
        videoTracks.forEach((t) => (t.enabled = nextEnabled));
        setIsCameraOff(!nextEnabled);
      }
    }
  }, []);

  // Flip Camera (User <-> Environment)
  // Maintains explicit deterministic state without relying on Android WebView's undefined facingMode setting
  const flipCamera = useCallback(async () => {
    if (!localStreamRef.current || !peerConnectionRef.current) return;
    const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
    if (!currentVideoTrack) return;

    try {
      const nextFacing: 'user' | 'environment' = facingModeRef.current === 'user' ? 'environment' : 'user';

      let newStream: MediaStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: nextFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch {
        // Fallback without exact constraint if device driver doesn't support 'exact'
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      }

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      // Replace track on RTCPeerConnection
      const sender = peerConnectionRef.current
        .getSenders()
        .find((s) => s.track && s.track.kind === 'video');

      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }

      // Stop old track
      currentVideoTrack.stop();
      localStreamRef.current.removeTrack(currentVideoTrack);
      localStreamRef.current.addTrack(newVideoTrack);

      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      setFacingMode(nextFacing);
      facingModeRef.current = nextFacing;
    } catch (err) {
      console.warn('[WebRTC] Camera flip not supported or failed:', err);
    }
  }, []);

  // Point 8: Nusrat Stealth Lock Cleanup Guard
  // If Nusrat triggers panic lock or the stealth vault closes while in an active call, terminate call immediately
  useEffect(() => {
    if (!isStealthUnlocked && activeCallRef.current) {
      const curCall = activeCallRef.current;
      sendSignal({
        callId: curCall.callId,
        type: curCall.type,
        action: 'end',
      });
      cleanUpCall();
    }
  }, [isStealthUnlocked, cleanUpCall, sendSignal]);

  // Point 7: Visibility change wake lock re-acquisition
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && activeCallRef.current?.status === 'connected') {
        acquireWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [acquireWakeLock]);

  // Point 1: Persistent Supabase Realtime Signaling Channel
  // Removed activeCall, cleanUpCall, and isStealthUnlocked from dependency array so the WebSocket channel
  // is NEVER torn down and rebuilt across call state transitions.
  useEffect(() => {
    if (!currentRole) return;

    const channel = supabase.channel('onlyus-calling', {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'call_signal' }, async ({ payload }: { payload: CallSignalPayload }) => {
        if (!payload || payload.targetRole !== currentRole) return;

        // In Nusrat's stealth mode: If the vault is locked (#6969# not entered), do not show OnlyUs call UI
        if (!isStealthUnlockedRef.current) {
          return;
        }

        switch (payload.action) {
          case 'offer': {
            const curCall = activeCallRef.current;
            if (curCall && curCall.status !== 'idle' && curCall.status !== 'ended') {
              // We are busy
              await channel.send({
                type: 'broadcast',
                event: 'call_signal',
                payload: {
                  callId: payload.callId,
                  type: payload.type,
                  senderRole: currentRole,
                  targetRole: payload.senderRole,
                  action: 'busy',
                  timestamp: Date.now(),
                },
              });
              return;
            }

            pendingOfferRef.current = payload.sdp || null;
            const newSession: CallSession = {
              callId: payload.callId,
              type: payload.type,
              callerRole: payload.senderRole,
              receiverRole: currentRole,
              status: 'ringing',
              startedAt: Date.now(),
            };
            activeCallRef.current = newSession;
            setActiveCall(newSession);

            callAudio.startIncomingRingtone();
            break;
          }

          case 'answer': {
            if (peerConnectionRef.current && payload.sdp) {
              try {
                await peerConnectionRef.current.setRemoteDescription(
                  new RTCSessionDescription(payload.sdp)
                );
                callAudio.stopRingtone();
                if (outgoingTimeoutRef.current) {
                  clearTimeout(outgoingTimeoutRef.current);
                  outgoingTimeoutRef.current = null;
                }

                // Point 2: Drain queued candidates on caller side once remote description is ready
                while (iceCandidatesQueue.current.length > 0) {
                  const candidate = iceCandidatesQueue.current.shift();
                  if (candidate) {
                    await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                  }
                }
              } catch (err) {
                console.error('[WebRTC] Error setting remote description from answer:', err);
              }
            }
            break;
          }

          case 'ice-candidate': {
            if (payload.candidate) {
              const cand = payload.candidate;
              if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
                try {
                  await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(cand));
                } catch (err) {
                  console.warn('[WebRTC] Error adding ICE candidate:', err);
                }
              } else {
                iceCandidatesQueue.current.push(cand);
              }
            }
            break;
          }

          case 'reject': {
            callAudio.stopRingtone();
            if (outgoingTimeoutRef.current) {
              clearTimeout(outgoingTimeoutRef.current);
              outgoingTimeoutRef.current = null;
            }
            setCallErrorMessage('Call declined');
            setTimeout(() => cleanUpCallRef.current(), 1500);
            break;
          }

          case 'busy': {
            callAudio.stopRingtone();
            if (outgoingTimeoutRef.current) {
              clearTimeout(outgoingTimeoutRef.current);
              outgoingTimeoutRef.current = null;
            }
            setCallErrorMessage('User is currently in another call');
            setTimeout(() => cleanUpCallRef.current(), 1800);
            break;
          }

          case 'end': {
            callAudio.playEndTone();
            if (outgoingTimeoutRef.current) {
              clearTimeout(outgoingTimeoutRef.current);
              outgoingTimeoutRef.current = null;
            }
            cleanUpCallRef.current();
            break;
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channelRef.current = channel;
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [currentRole]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      cleanUpCall();
    };
  }, [cleanUpCall]);

  return {
    activeCall,
    localStream,
    remoteStream,
    isMicMuted,
    isCameraOff,
    isSpeakerOn,
    callDuration,
    callErrorMessage,
    facingMode,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    flipCamera,
  };
}
