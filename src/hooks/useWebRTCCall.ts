import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { UserRole, CallType, CallStatus, CallSession, CallSignalPayload } from '../types';
import { callAudio } from '../lib/callAudio';
import { recordCallCompletion } from '../lib/callLogService';

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
  const callDurationRef = useRef<number>(0);
  const outgoingTimeoutRef = useRef<any>(null);
  const disconnectTimerRef = useRef<any>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const wakeLockSentinelRef = useRef<any>(null);
  const facingModeRef = useRef<'user' | 'environment'>('user');
  const hasLoggedCallRef = useRef<boolean>(false);

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

  /**
   * Authoritative Call Logger
   * Only the caller logs the call to prevent duplicate records in Supabase and chat feed
   */
  const finalizeCallAndLog = useCallback(
    (status: 'completed' | 'missed' | 'rejected' | 'busy') => {
      if (hasLoggedCallRef.current) return;
      const curCall = activeCallRef.current;
      if (!curCall) return;

      if (curCall.callerRole === currentRole) {
        hasLoggedCallRef.current = true;
        const finalDuration = status === 'completed' ? callDurationRef.current || 0 : 0;
        recordCallCompletion({
          callId: curCall.callId,
          caller_role: curCall.callerRole,
          receiver_role: curCall.receiverRole,
          call_type: curCall.type,
          status,
          duration: finalDuration,
          started_at: curCall.startedAt,
        }).catch((err) => console.warn('[WebRTC] Error writing call log:', err));
      }
    },
    [currentRole]
  );

  // Cleanup helper
  const cleanUpCall = useCallback(() => {
    callAudio.stopRingtone();
    releaseWakeLock();

    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }

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
    callDurationRef.current = 0;
    hasLoggedCallRef.current = false;
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

  // Create PeerConnection instance with cellular 4G/5G handoff resilience
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
          // Clear any disconnect grace timer if connection restored after 5G/4G switch
          if (disconnectTimerRef.current) {
            clearTimeout(disconnectTimerRef.current);
            disconnectTimerRef.current = null;
          }
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
              const secs = Math.floor((Date.now() - start) / 1000);
              callDurationRef.current = secs;
              setCallDuration(secs);
            }, 1000);
          }
        } else if (pc.connectionState === 'disconnected') {
          // Cellular network drop (e.g. 5G to 4G handover or momentary packet loss)
          // Attempt ICE restart
          if ('restartIce' in pc && typeof (pc as any).restartIce === 'function') {
            try {
              (pc as any).restartIce();
            } catch (_) {}
          }

          // Do NOT terminate immediately! Provide a 12-second grace period for cell handover
          if (!disconnectTimerRef.current && activeCallRef.current?.status === 'connected') {
            disconnectTimerRef.current = setTimeout(() => {
              if (
                peerConnectionRef.current?.connectionState === 'disconnected' ||
                peerConnectionRef.current?.connectionState === 'failed'
              ) {
                callAudio.playEndTone();
                finalizeCallAndLog('completed');
                cleanUpCallRef.current();
              }
            }, 12000);
          }
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          if (disconnectTimerRef.current) {
            clearTimeout(disconnectTimerRef.current);
            disconnectTimerRef.current = null;
          }
          if (activeCallRef.current?.status === 'connected') {
            callAudio.playEndTone();
            finalizeCallAndLog('completed');
            cleanUpCallRef.current();
          }
        }
      };

      peerConnectionRef.current = pc;
      return pc;
    },
    [acquireWakeLock, finalizeCallAndLog, sendSignal]
  );

  // Initialize Media Stream (Camera / Mic) with mobile-optimized constraints
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

      // 38-second outgoing ring timeout to avoid infinite battery drain
      if (outgoingTimeoutRef.current) {
        clearTimeout(outgoingTimeoutRef.current);
      }
      outgoingTimeoutRef.current = setTimeout(async () => {
        if (activeCallRef.current?.status === 'calling') {
          callAudio.stopRingtone();
          callAudio.playEndTone();
          setCallErrorMessage('No answer');
          finalizeCallAndLog('missed');
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
            // Maintain smooth framerate over lower resolution when bandwidth drops
            params.degradationPreference = 'maintain-framerate';
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
    [acquireMedia, cleanUpCall, createPeerConnection, currentRole, finalizeCallAndLog, partnerRole, sendSignal]
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
          params.degradationPreference = 'maintain-framerate';
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
      if (curCall.status === 'connected') {
        finalizeCallAndLog('completed');
      } else if (curCall.status === 'calling') {
        finalizeCallAndLog('missed');
      }
      await sendSignal({
        callId: curCall.callId,
        type: curCall.type,
        action: 'end',
      });
    }
    cleanUpCall();
  }, [cleanUpCall, finalizeCallAndLog, sendSignal]);

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

  // Nusrat Stealth Lock Cleanup Guard
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

  // Visibility change wake lock re-acquisition
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

  // Persistent Supabase Realtime Signaling Channel with Glare Collision Resolution
  useEffect(() => {
    if (!currentRole) return;

    const channel = supabase.channel('onlyus-calling', {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'call_signal' }, async ({ payload }: { payload: CallSignalPayload }) => {
        if (!payload || payload.targetRole !== currentRole) return;

        // In Nusrat's stealth mode: If vault is locked (#6969# not entered), do not show OnlyUs call UI
        if (!isStealthUnlockedRef.current) {
          return;
        }

        switch (payload.action) {
          case 'offer': {
            const curCall = activeCallRef.current;

            // SIMULTANEOUS CALL COLLISION RESOLUTION ("GLARE")
            // When both Rahul and Nusrat tap call at the exact same moment
            if (curCall && curCall.status === 'calling') {
              console.log('[WebRTC] Simultaneous call collision detected!');
              const myStart = curCall.startedAt || 0;
              const theirStart = payload.timestamp || 0;
              // Deterministic tie-breaker: Rahul (owner) wins, or whoever called >2s earlier
              const isMyOfferWinning =
                Math.abs(myStart - theirStart) < 4000
                  ? currentRole === 'owner'
                  : myStart < theirStart;

              if (isMyOfferWinning) {
                // My offer wins tie-break: I remain caller, awaiting their answer
                console.log('[WebRTC] Collision: My offer wins tie-break.');
                return;
              }

              // Partner won tie-break: Concede gracefully and answer partner's call immediately
              console.log('[WebRTC] Collision: Partner offer wins. Conceding and connecting.');
              callAudio.stopRingtone();
              if (outgoingTimeoutRef.current) {
                clearTimeout(outgoingTimeoutRef.current);
                outgoingTimeoutRef.current = null;
              }

              const stream = localStreamRef.current || (await acquireMedia(payload.type));
              const pc = createPeerConnection(payload.callId, payload.type);

              if (stream) {
                stream.getTracks().forEach((track) => {
                  const sender = pc.addTrack(track, stream!);
                  if (track.kind === 'video' && sender.getParameters) {
                    try {
                      const params = sender.getParameters();
                      if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
                      params.encodings[0].maxBitrate = 750000;
                      params.degradationPreference = 'maintain-framerate';
                      sender.setParameters(params).catch(() => {});
                    } catch {}
                  }
                });
              }

              try {
                if (payload.sdp) {
                  await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                }
                while (iceCandidatesQueue.current.length > 0) {
                  const candidate = iceCandidatesQueue.current.shift();
                  if (candidate) {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                  }
                }
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                await sendSignal({
                  callId: payload.callId,
                  type: payload.type,
                  action: 'answer',
                  sdp: answer,
                });

                const connectedSession: CallSession = {
                  callId: payload.callId,
                  type: payload.type,
                  callerRole: payload.senderRole,
                  receiverRole: currentRole,
                  status: 'connected',
                  startedAt: Date.now(),
                };
                activeCallRef.current = connectedSession;
                setActiveCall(connectedSession);
              } catch (err) {
                console.error('[WebRTC] Error handling simultaneous call answer:', err);
                cleanUpCallRef.current();
              }
              return;
            }

            // Normal busy condition if in another active call
            if (curCall && curCall.status !== 'idle' && curCall.status !== 'ended') {
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

                // Drain queued ICE candidates on caller side once remote description is set
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
            finalizeCallAndLog('rejected');
            setTimeout(() => cleanUpCallRef.current(), 1500);
            break;
          }

          case 'busy': {
            callAudio.stopRingtone();
            if (outgoingTimeoutRef.current) {
              clearTimeout(outgoingTimeoutRef.current);
              outgoingTimeoutRef.current = null;
            }
            setCallErrorMessage('User is currently on another call');
            finalizeCallAndLog('busy');
            setTimeout(() => cleanUpCallRef.current(), 1800);
            break;
          }

          case 'end': {
            callAudio.playEndTone();
            if (outgoingTimeoutRef.current) {
              clearTimeout(outgoingTimeoutRef.current);
              outgoingTimeoutRef.current = null;
            }
            finalizeCallAndLog('completed');
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
  }, [acquireMedia, createPeerConnection, currentRole, finalizeCallAndLog, sendSignal]);

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
