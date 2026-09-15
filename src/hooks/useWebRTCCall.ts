import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { UserRole, CallType, CallStatus, CallSession, CallSignalPayload } from '../types';
import { callAudio } from '../lib/callAudio';

// Free high-availability public STUN servers provided by Google
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

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

  // References
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);
  const callTimerRef = useRef<any>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);

  // Cleanup helper
  const cleanUpCall = useCallback(() => {
    callAudio.stopRingtone();
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
    setActiveCall(null);
    setCallDuration(0);
    setIsMicMuted(false);
    setIsCameraOff(false);
  }, []);

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
        if (event.streams && event.streams[0]) {
          remoteStreamRef.current = event.streams[0];
          setRemoteStream(event.streams[0]);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          callAudio.playConnectedTone();
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
          if (activeCall?.status === 'connected') {
            callAudio.playEndTone();
            cleanUpCall();
          }
        }
      };

      peerConnectionRef.current = pc;
      return pc;
    },
    [activeCall?.status, cleanUpCall, sendSignal]
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
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
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
      setActiveCall({
        callId,
        type,
        callerRole: currentRole,
        receiverRole: partnerRole,
        status: 'calling',
        startedAt: Date.now(),
      });

      callAudio.startOutgoingRingtone();

      const stream = await acquireMedia(type);
      if (!stream) {
        callAudio.stopRingtone();
        setActiveCall(null);
        return;
      }

      const pc = createPeerConnection(callId, type);
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
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
    if (!activeCall || activeCall.status !== 'ringing') return;
    callAudio.stopRingtone();

    const stream = await acquireMedia(activeCall.type);
    if (!stream) {
      cleanUpCall();
      return;
    }

    const pc = createPeerConnection(activeCall.callId, activeCall.type);
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
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
        callId: activeCall.callId,
        type: activeCall.type,
        action: 'answer',
        sdp: answer,
      });

      setActiveCall((prev) => (prev ? { ...prev, status: 'connected' } : null));
    } catch (err) {
      console.error('[WebRTC] Error answering call:', err);
      cleanUpCall();
    }
  }, [acquireMedia, activeCall, cleanUpCall, createPeerConnection, sendSignal]);

  // Reject an Incoming Call
  const rejectCall = useCallback(async () => {
    if (activeCall) {
      callAudio.stopRingtone();
      await sendSignal({
        callId: activeCall.callId,
        type: activeCall.type,
        action: 'reject',
      });
    }
    cleanUpCall();
  }, [activeCall, cleanUpCall, sendSignal]);

  // End an Active or Outgoing Call
  const endCall = useCallback(async () => {
    if (activeCall) {
      callAudio.playEndTone();
      await sendSignal({
        callId: activeCall.callId,
        type: activeCall.type,
        action: 'end',
      });
    }
    cleanUpCall();
  }, [activeCall, cleanUpCall, sendSignal]);

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
      // Find current facing mode
      const settings = currentVideoTrack.getSettings();
      const nextFacing = settings.facingMode === 'environment' ? 'user' : 'environment';

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

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
    } catch (err) {
      console.warn('[WebRTC] Camera flip not supported or failed:', err);
    }
  }, []);

  // Listen for Supabase Realtime Call Broadcasts
  useEffect(() => {
    if (!currentRole) return;

    const channel = supabase.channel('onlyus-calling', {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'call_signal' }, async ({ payload }: { payload: CallSignalPayload }) => {
        if (!payload || payload.targetRole !== currentRole) return;

        // In Nusrat's stealth mode: If the vault is locked (#6969# not entered), do not show OnlyUs call UI
        if (!isStealthUnlocked) {
          // Can auto-reject or ignore to preserve stealth cover
          return;
        }

        switch (payload.action) {
          case 'offer': {
            if (activeCall && activeCall.status !== 'idle' && activeCall.status !== 'ended') {
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
            setActiveCall({
              callId: payload.callId,
              type: payload.type,
              callerRole: payload.senderRole,
              receiverRole: currentRole,
              status: 'ringing',
              startedAt: Date.now(),
            });

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
            setCallErrorMessage('Call declined');
            setTimeout(() => cleanUpCall(), 1500);
            break;
          }

          case 'busy': {
            callAudio.stopRingtone();
            setCallErrorMessage('User is currently in another call');
            setTimeout(() => cleanUpCall(), 1800);
            break;
          }

          case 'end': {
            callAudio.playEndTone();
            cleanUpCall();
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
  }, [activeCall, cleanUpCall, currentRole, isStealthUnlocked]);

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
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    flipCamera,
  };
}
