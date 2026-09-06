import React, { useState, useRef, useEffect, useCallback, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Smile, Heart, Send, X, Mic, Square, Trash2, Play, Pause } from 'lucide-react';
import { Message, UserProfile } from '../types';
import { useOverlayBack } from '../lib/overlayManager';

export interface ChatInputBarHandle {
  focusInput: () => void;
  startVoiceRecording: () => void;
}

interface ChatInputBarProps {
  role: 'owner' | 'partner';
  replyingTo: Message | null;
  onClearReply: () => void;
  editingMessage: Message | null;
  onClearEditing: () => void;
  onSendMessage: (text: string) => Promise<void> | void;
  onSendVoiceNote?: (audioBlob: Blob, durationSeconds: number) => Promise<void> | void;
  onEditMessage: (id: string, text: string) => Promise<void> | void;
  onBroadcastTyping: (isTyping: boolean) => void;
  onOpenAttachmentMenu: () => void;
  onOpenNudgeMenu: () => void;
  userProfile: UserProfile | null;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  externalTriggerVoiceRecord?: boolean;
  onClearExternalVoiceRecordTrigger?: () => void;
}

const POPULAR_EMOJIS = [
  '❤️', '😂', '🥺', '💋', '💖', '🥰', '🍯', '🧸', '👑', '✨',
  '🤍', '😍', '😘', '🫂', '🌹', '🌸', '🤤', '🤭', '🔥', '💯',
  '👍', '💫', '🌙', '💌'
];

export const ChatInputBar = React.forwardRef<ChatInputBarHandle, ChatInputBarProps>(({
  role,
  replyingTo,
  onClearReply,
  editingMessage,
  onClearEditing,
  onSendMessage,
  onSendVoiceNote,
  onEditMessage,
  onBroadcastTyping,
  onOpenAttachmentMenu,
  onOpenNudgeMenu,
  userProfile,
  inputRef,
  externalTriggerVoiceRecord,
  onClearExternalVoiceRecordTrigger,
}, ref) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const localInputRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>([15, 25, 40, 20, 35, 50, 30, 20]);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recordIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const durationRef = useRef<number>(0);

  // Expose focus and record methods
  useImperativeHandle(ref, () => ({
    focusInput: () => {
      const el = inputRef?.current || localInputRef.current;
      el?.focus({ preventScroll: true });
    },
    startVoiceRecording: () => {
      handleStartRecording();
    },
  }));

  useOverlayBack(showEmojiPicker, () => setShowEmojiPicker(false), 'chat-emoji-picker');

  const adjustTextareaHeight = useCallback(() => {
    const el = inputRef?.current || localInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = 144; // ~6-7 rows
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${Math.max(44, newHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [inputRef]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputText, adjustTextareaHeight]);

  useEffect(() => {
    if (replyingTo) {
      const el = inputRef?.current || localInputRef.current || (document.getElementById('chat-message-input') as HTMLTextAreaElement | null);
      el?.focus({ preventScroll: true });
      try {
        (window as any).AndroidBridge?.openKeyboard?.();
        (window as any).Android?.openKeyboard?.();
      } catch (e) {}
    }
  }, [replyingTo, inputRef]);

  useEffect(() => {
    const el = inputRef?.current || localInputRef.current || (document.getElementById('chat-message-input') as HTMLTextAreaElement | null);
    if (editingMessage) {
      setInputText(editingMessage.text);
      requestAnimationFrame(() => {
        adjustTextareaHeight();
        el?.focus({ preventScroll: true });
        try {
          (window as any).AndroidBridge?.openKeyboard?.();
          (window as any).Android?.openKeyboard?.();
        } catch (e) {}
      });
    } else {
      setInputText('');
      requestAnimationFrame(() => {
        adjustTextareaHeight();
      });
    }
  }, [editingMessage, adjustTextareaHeight, inputRef]);

  const handleInsertEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    const el = inputRef?.current || localInputRef.current;
    requestAnimationFrame(() => {
      adjustTextareaHeight();
      el?.focus({ preventScroll: true });
    });
  };

  useEffect(() => {
    if (!userProfile) return;

    if (inputText.length > 0 && !editingMessage) {
      onBroadcastTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onBroadcastTyping(false);
      }, 3000);
    } else {
      onBroadcastTyping(false);
    }

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [inputText, userProfile?.uid, editingMessage, onBroadcastTyping]);

  // Handle external voice recording trigger from attachment menu
  useEffect(() => {
    if (externalTriggerVoiceRecord && !isRecording && !isPreviewing) {
      handleStartRecording();
      onClearExternalVoiceRecordTrigger?.();
    }
  }, [externalTriggerVoiceRecord, isRecording, isPreviewing, onClearExternalVoiceRecordTrigger]);

  // Clean up recording resources on unmount
  useEffect(() => {
    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  // -------------------------------------------------------------
  // Voice Recording Engine
  // -------------------------------------------------------------
  const handleStartRecording = async () => {
    if (isRecording || isPreviewing) return;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Voice recording is not supported in this browser environment.');
        return;
      }

      // Close emoji picker and clear inputs
      setShowEmojiPicker(false);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      // Determine best audio mime type
      let mimeType = 'audio/webm;codecs=opus';
      if (typeof MediaRecorder !== 'undefined') {
        if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : '';
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      durationRef.current = 0;
      setRecordingDuration(0);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      // Set up AudioContext for live waveform visualizer
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateAudioLevels = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            // Sample 8 representative bands
            const sampleCount = 8;
            const step = Math.floor(dataArray.length / sampleCount);
            const levels: number[] = [];
            for (let i = 0; i < sampleCount; i++) {
              const val = dataArray[i * step] || 0;
              // Map 0-255 to percentage 15-100%
              levels.push(Math.max(15, Math.min(100, Math.round((val / 255) * 100))));
            }
            setAudioLevels(levels);
            animFrameRef.current = requestAnimationFrame(updateAudioLevels);
          };
          updateAudioLevels();
        }
      } catch (err) {
        console.warn('Audio analyser setup fallback:', err);
      }

      recorder.start(100);
      setIsRecording(true);
      setIsPreviewing(false);

      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = setInterval(() => {
        durationRef.current += 1;
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      // Light haptic feedback
      if (typeof window !== 'undefined' && window.navigator?.vibrate) {
        try { window.navigator.vibrate(35); } catch (_) {}
      }
    } catch (err: any) {
      console.error('Microphone access error:', err);
      alert('Could not access microphone. Please ensure microphone permissions are allowed.');
    }
  };

  const cleanupAudioStreams = () => {
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    cleanupAudioStreams();
    setIsRecording(false);
    setIsPreviewing(false);
    setRecordedBlob(null);
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }
    setRecordingDuration(0);
    durationRef.current = 0;
  };

  const handleStopAndReview = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    mediaRecorderRef.current.onstop = () => {
      const type = mediaRecorderRef.current?.mimeType || 'audio/webm';
      const blob = new Blob(recordedChunksRef.current, { type });
      const url = URL.createObjectURL(blob);
      setRecordedBlob(blob);
      setRecordedAudioUrl(url);
      setIsPreviewing(true);
      setIsRecording(false);
    };

    mediaRecorderRef.current.stop();
    cleanupAudioStreams();
  };

  const handleDirectSendRecording = () => {
    if (!onSendVoiceNote) return;

    if (isPreviewing && recordedBlob) {
      onSendVoiceNote(recordedBlob, Math.max(1, durationRef.current || recordingDuration));
      handleCancelRecording();
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        const type = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const blob = new Blob(recordedChunksRef.current, { type });
        const finalDuration = Math.max(1, durationRef.current || recordingDuration);
        onSendVoiceNote(blob, finalDuration);
        handleCancelRecording();
      };
      mediaRecorderRef.current.stop();
      cleanupAudioStreams();
    }
  };

  const togglePlayPreview = () => {
    if (!previewAudioRef.current) return;
    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudioRef.current.play().then(() => {
        setIsPlayingPreview(true);
      }).catch(() => {});
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = Math.floor(sec % 60);
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  // -------------------------------------------------------------
  // Text Submit with Persistent Keyboard Behavior
  // -------------------------------------------------------------
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const textToSend = inputText.trim();
    if (!textToSend) return;

    setShowEmojiPicker(false);
    const activeTextarea = inputRef?.current || localInputRef.current;

    if (editingMessage) {
      await onEditMessage(editingMessage.id, textToSend);
      setInputText('');
      onClearEditing();
      activeTextarea?.focus({ preventScroll: true });
      adjustTextareaHeight();
      return;
    }

    setInputText('');
    activeTextarea?.focus({ preventScroll: true });
    adjustTextareaHeight();

    await onSendMessage(textToSend);
  };

  return (
    <div className="mt-4 lg:mt-6 pt-4 lg:pt-6 border-t border-[var(--theme-border)] bg-[var(--theme-bg)]/80 backdrop-blur-md">
      <AnimatePresence>
        {replyingTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 bg-[var(--theme-accent)]/10 rounded-t-2xl border-l-4 border-[var(--theme-accent)] flex items-center justify-between mb-1 mx-2"
          >
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-[10px] font-bold text-[var(--theme-accent)] uppercase tracking-wider mb-0.5">
                Replying to {replyingTo.sender_role === 'owner' ? 'Rahul' : 'Nusrat'}
              </p>
              <p className="text-xs text-[var(--theme-text)] truncate italic opacity-80">
                "{replyingTo.text || (replyingTo.media?.type === 'audio' ? '🎤 Voice Note' : replyingTo.media ? '📷 Photo' : 'Message')}"
              </p>
            </div>
            <button
              onClick={onClearReply}
              onPointerDown={(e) => e.preventDefault()}
              className="p-1 hover:bg-[var(--theme-accent)]/10 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-[var(--theme-text)]/40" />
            </button>
          </motion.div>
        )}
        {editingMessage && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 bg-[var(--theme-accent)]/10 rounded-t-2xl border-l-4 border-[var(--theme-accent)] flex items-center justify-between mb-1 mx-2"
          >
            <div className="flex-1 min-w-0 pr-4 text-[var(--theme-accent)]">
              <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5">Editing Private Message</p>
              <p className="text-xs truncate italic opacity-80 text-[var(--theme-text)]">"{editingMessage.text}"</p>
            </div>
            <button
              onClick={onClearEditing}
              onPointerDown={(e) => e.preventDefault()}
              className="p-1 hover:bg-[var(--theme-accent)]/10 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-[var(--theme-accent)]/40" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WhatsApp-style Quick Emoji Picker Drawer / Shelf */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 10, height: 0 }}
            className="px-4 py-2.5 bg-[var(--theme-surface)]/95 backdrop-blur-md border-t border-[var(--theme-border)] flex items-center gap-2 overflow-x-auto custom-scrollbar select-none"
            onPointerDown={(e) => e.preventDefault()}
          >
            {POPULAR_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => handleInsertEmoji(emoji)}
                className="text-2xl p-1.5 hover:bg-[var(--theme-accent)]/15 rounded-xl hover:scale-125 transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex items-end px-3 lg:px-4 gap-2 pb-[max(0.875rem,env(safe-area-inset-bottom,0px))] pt-1.5">
        {/* Attachment menu button (hidden while actively recording) */}
        {!isRecording && !isPreviewing && (
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={onOpenAttachmentMenu}
            className="flex-shrink-0 w-10 h-10 mb-0.5 flex items-center justify-center bg-[var(--theme-surface)] border border-[var(--theme-border)] text-[var(--theme-accent)] rounded-full hover:bg-[var(--theme-accent)]/10 transition-all active:scale-95 shadow-sm cursor-pointer"
            aria-label="Open attachments menu"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}

        {/* ----------------------------------------------------------- */}
        {/* Active Audio Recording Bar (Expands smoothly)               */}
        {/* ----------------------------------------------------------- */}
        {isRecording ? (
          <div className="flex-1 flex items-center bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-[1.6rem] px-3.5 py-2 shadow-md gap-3 min-h-[44px]">
            {/* Pulsing red recording dot */}
            <div className="relative flex items-center justify-center w-5 h-5">
              <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </div>

            {/* Live timer */}
            <span className="text-xs font-bold text-red-500 tracking-wider min-w-[36px]">
              {formatSeconds(recordingDuration)}
            </span>

            {/* Live dynamic sound wave bars */}
            <div className="flex-1 flex items-center justify-center gap-1 h-5 overflow-hidden px-1">
              {audioLevels.map((lvl, idx) => (
                <div
                  key={idx}
                  className="w-1 bg-[var(--theme-accent)] rounded-full transition-all duration-75"
                  style={{ height: `${lvl}%` }}
                />
              ))}
            </div>

            {/* Cancel/Discard Recording Button */}
            <button
              type="button"
              onClick={handleCancelRecording}
              className="p-1.5 text-[var(--theme-text)]/50 hover:text-red-500 transition-colors cursor-pointer"
              title="Cancel recording"
            >
              <Trash2 className="w-5 h-5" />
            </button>

            {/* Stop and Review Button */}
            <button
              type="button"
              onClick={handleStopAndReview}
              className="p-1.5 text-[var(--theme-accent)] hover:scale-110 transition-transform cursor-pointer"
              title="Pause and review"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          </div>
        ) : isPreviewing ? (
          /* --------------------------------------------------------- */
          /* Review / Preview Recorded Voice Note                     */
          /* --------------------------------------------------------- */
          <div className="flex-1 flex items-center bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-[1.6rem] px-3.5 py-2 shadow-md gap-3 min-h-[44px]">
            {recordedAudioUrl && (
              <audio
                ref={previewAudioRef}
                src={recordedAudioUrl}
                onTimeUpdate={() => {
                  if (previewAudioRef.current && recordingDuration > 0) {
                    setPreviewProgress(previewAudioRef.current.currentTime / recordingDuration);
                  }
                }}
                onEnded={() => {
                  setIsPlayingPreview(false);
                  setPreviewProgress(0);
                }}
              />
            )}

            {/* Play/Pause Preview Button */}
            <button
              type="button"
              onClick={togglePlayPreview}
              className="w-8 h-8 rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center shadow-sm cursor-pointer"
            >
              {isPlayingPreview ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            {/* Waveform preview / scrub indicator */}
            <div className="flex-1 flex flex-col justify-center">
              <div className="h-2 w-full bg-[var(--theme-accent)]/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--theme-accent)] rounded-full transition-all duration-100"
                  style={{ width: `${previewProgress * 100}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-[var(--theme-text)]/70 mt-1 font-medium">
                <span>Preview</span>
                <span>{formatSeconds(recordingDuration)}</span>
              </div>
            </div>

            {/* Discard Preview Button */}
            <button
              type="button"
              onClick={handleCancelRecording}
              className="p-1.5 text-[var(--theme-text)]/50 hover:text-red-500 transition-colors cursor-pointer"
              title="Discard voice note"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ) : (
          /* --------------------------------------------------------- */
          /* Standard WhatsApp-style Input Container                  */
          /* --------------------------------------------------------- */
          <div className="relative flex-1 flex items-end bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-[1.6rem] shadow-sm focus-within:ring-4 focus-within:ring-[var(--theme-accent)]/15 focus-within:border-[var(--theme-accent)]/40 transition-[box-shadow,border-color] duration-150 overflow-hidden">
            {/* WhatsApp emoji toggle button */}
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className={`p-2.5 mb-0.5 shrink-0 transition-colors cursor-pointer ${
                showEmojiPicker ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text)]/50 hover:text-[var(--theme-accent)]'
              }`}
              aria-label="Toggle emoji picker"
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* Auto-expanding textarea */}
            <textarea
              id="chat-message-input"
              ref={(node) => {
                localInputRef.current = node;
                if (inputRef && 'current' in inputRef) {
                  (inputRef as any).current = node;
                }
              }}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onFocus={() => {
                if (typeof window !== 'undefined') {
                  (window as any).__isChatInputFocused = true;
                }
                setShowEmojiPicker(false);
              }}
              onBlur={() => {
                setTimeout(() => {
                  if (typeof document !== 'undefined') {
                    const activeEl = document.activeElement;
                    if (activeEl?.id !== 'chat-message-input') {
                      if (typeof window !== 'undefined' && !(window as any).__keepChatInputActive) {
                        (window as any).__isChatInputFocused = false;
                      }
                    }
                  }
                }, 250);
              }}
              inputMode="text"
              enterKeyHint="send"
              autoCapitalize="sentences"
              autoComplete="on"
              autoCorrect="on"
              spellCheck={true}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={editingMessage ? 'Edit message...' : `Whisper to ${role === 'owner' ? 'Nusrat' : 'Rahul'}...`}
              className="w-full py-2.5 px-1 bg-transparent text-[var(--theme-text)] text-[16px] md:text-sm focus:outline-none placeholder-[var(--theme-text)]/40 resize-none custom-scrollbar leading-relaxed"
              style={{ minHeight: '44px', maxHeight: '144px', boxSizing: 'border-box' }}
            />

            {/* Feelings / Nudge Heart button inside container */}
            <div className="pr-2 mb-1.5 shrink-0">
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={onOpenNudgeMenu}
                className="p-1.5 text-[var(--theme-accent)]/70 hover:text-[var(--theme-accent)] transition-colors active:scale-90 cursor-pointer"
                aria-label="Send a feeling"
              >
                <Heart className="w-5 h-5 fill-current" />
              </button>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* Right Action Button: Dynamic Send OR Record Voice Note      */}
        {/* ----------------------------------------------------------- */}
        {isRecording || isPreviewing ? (
          <button
            type="button"
            onClick={handleDirectSendRecording}
            className="flex-shrink-0 w-10 h-10 lg:w-11 lg:h-11 mb-0.5 flex items-center justify-center text-white rounded-full hover:opacity-90 transition-transform duration-100 active:scale-95 shadow-lg touch-manipulation cursor-pointer"
            style={{
              background: 'var(--theme-accent)',
              boxShadow: '0 8px 20px color-mix(in srgb, var(--theme-accent) 30%, transparent)',
            }}
            aria-label="Send voice note"
          >
            <Send className="w-4 h-4 lg:w-5 lg:h-5 fill-white" />
          </button>
        ) : inputText.trim() ? (
          <button
            type="button"
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => handleSubmit()}
            className="flex-shrink-0 w-10 h-10 lg:w-11 lg:h-11 mb-0.5 flex items-center justify-center text-white rounded-full hover:opacity-90 transition-transform duration-100 active:scale-95 shadow-lg touch-manipulation cursor-pointer"
            style={{
              background: 'var(--theme-accent)',
              boxShadow: '0 8px 20px color-mix(in srgb, var(--theme-accent) 30%, transparent)',
            }}
            aria-label="Send message"
          >
            <Send className="w-4 h-4 lg:w-5 lg:h-5 fill-white" />
          </button>
        ) : (
          <button
            type="button"
            onPointerDown={(event) => event.preventDefault()}
            onClick={handleStartRecording}
            className="flex-shrink-0 w-10 h-10 lg:w-11 lg:h-11 mb-0.5 flex items-center justify-center text-white rounded-full hover:opacity-90 transition-transform duration-100 active:scale-95 shadow-lg touch-manipulation cursor-pointer"
            style={{
              background: 'var(--theme-accent)',
              boxShadow: '0 8px 20px color-mix(in srgb, var(--theme-accent) 30%, transparent)',
            }}
            title="Record Voice Note"
            aria-label="Record voice note"
          >
            <Mic className="w-4 h-4 lg:w-5 lg:h-5" />
          </button>
        )}
      </div>
    </div>
  );
});

ChatInputBar.displayName = 'ChatInputBar';
