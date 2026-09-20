import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  Trash2,
  Calendar,
  Sparkles,
  PhoneCall,
  VideoOff,
  CheckCircle2,
} from 'lucide-react';
import { CallLogRecord, CallType, UserRole, UserProfile } from '../types';
import { fetchCallLogs, deleteCallLog, clearAllCallLogs, formatCallDuration } from '../lib/callLogService';
import { useOverlayBack } from '../lib/overlayManager';
import { supabase } from '../lib/supabase';

interface CallHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
  partnerProfile: UserProfile | null;
  partnerNickname?: string;
  onStartCall: (type: CallType) => void;
}

export const CallHistoryModal: React.FC<CallHistoryModalProps> = ({
  isOpen,
  onClose,
  currentRole,
  partnerProfile,
  partnerNickname,
  onStartCall,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'voice' | 'video'>('all');
  const [logs, setLogs] = useState<CallLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  useOverlayBack(isOpen, onClose, 'call-history-modal');

  const partnerName =
    partnerNickname ||
    partnerProfile?.display_name ||
    (currentRole === 'owner' ? 'Nusrat' : 'Rahul');

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    const data = await fetchCallLogs(activeTab === 'all' ? undefined : activeTab);
    setLogs(data);
    setIsLoading(false);
  }, [activeTab]);

  useEffect(() => {
    if (!isOpen) return;
    loadLogs();

    // Subscribe to realtime updates on call_logs table
    const channel = supabase
      .channel('call_logs_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'call_logs' },
        () => {
          loadLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, loadLogs]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await deleteCallLog(id);
    if (success) {
      setLogs((prev) => prev.filter((l) => l.id !== id));
    }
  };

  const handleClearAll = async () => {
    const success = await clearAllCallLogs();
    if (success) {
      setLogs([]);
      setShowClearConfirm(false);
    }
  };

  if (!isOpen) return null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Today, ${timeStr}`;
    if (isYesterday) return `Yesterday, ${timeStr}`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-sm overflow-hidden select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-[var(--theme-surface)] text-[var(--theme-text)] border border-[var(--theme-border)] rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[var(--theme-border)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[var(--theme-accent)]/15 flex items-center justify-center text-[var(--theme-accent)] border border-[var(--theme-accent)]/30">
                <PhoneCall className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-[var(--theme-text)]">
                  Call Logs
                </h2>
                <p className="text-xs text-[var(--theme-text)]/60 font-medium">
                  History with {partnerName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {logs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="p-2 rounded-xl text-[var(--theme-text)]/50 hover:text-rose-500 hover:bg-rose-500/10 active:scale-95 transition-all"
                  title="Clear call history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-[var(--theme-text)]/70 hover:text-[var(--theme-text)] hover:bg-[var(--theme-accent)]/10 active:scale-95 transition-all"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filter Tab Selector */}
          <div className="px-5 pt-3 pb-2 flex gap-2">
            {[
              { id: 'all', label: 'All', icon: null },
              { id: 'voice', label: 'Voice Calls', icon: Phone },
              { id: 'video', label: 'Video Calls', icon: Video },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[var(--theme-accent)] text-white shadow-sm'
                      : 'bg-[var(--theme-bg)] text-[var(--theme-text)]/70 hover:bg-[var(--theme-accent)]/10 border border-[var(--theme-border)]'
                  }`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Clear Confirmation Banner */}
          <AnimatePresence>
            {showClearConfirm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mx-5 my-2 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs flex items-center justify-between"
              >
                <span className="font-medium text-rose-500">
                  Clear all call history logs?
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2.5 py-1 rounded-lg bg-neutral-800 text-neutral-300 font-medium hover:bg-neutral-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700"
                  >
                    Clear All
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2.5 min-h-[220px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-[var(--theme-text)]/50">
                <div className="w-6 h-6 border-2 border-[var(--theme-accent)] border-t-transparent rounded-full animate-spin mb-3" />
                <span className="text-xs font-medium">Loading call records...</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-[var(--theme-text)]/60">
                <div className="w-14 h-14 rounded-full bg-[var(--theme-accent)]/10 flex items-center justify-center text-[var(--theme-accent)] mb-3">
                  <Phone className="w-6 h-6 opacity-60" />
                </div>
                <p className="text-sm font-semibold text-[var(--theme-text)]">
                  No call logs yet
                </p>
                <p className="text-xs text-[var(--theme-text)]/50 max-w-xs mt-1">
                  When you or {partnerName} make a voice or video call, your history and talk times will appear here.
                </p>
              </div>
            ) : (
              logs.map((log) => {
                const isOutgoing = log.caller_role === currentRole;
                const isCompleted = log.status === 'completed';
                const isMissed = log.status === 'missed';
                const isRejected = log.status === 'rejected' || log.status === 'declined' || log.status === 'busy';

                const isVideo = log.call_type === 'video';

                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-[var(--theme-bg)] border border-[var(--theme-border)] hover:border-[var(--theme-accent)]/40 transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Icon Avatar */}
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                          isMissed
                            ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                            : isRejected
                            ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                        }`}
                      >
                        {isMissed ? (
                          <PhoneMissed className="w-5 h-5" />
                        ) : isOutgoing ? (
                          <PhoneOutgoing className="w-5 h-5" />
                        ) : (
                          <PhoneIncoming className="w-5 h-5" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-[var(--theme-text)] truncate">
                            {isOutgoing ? partnerName : partnerName}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold uppercase tracking-wider ${
                              isVideo
                                ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                                : 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                            }`}
                          >
                            {isVideo ? 'Video' : 'Voice'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-xs">
                          <span
                            className={`font-medium ${
                              isMissed
                                ? 'text-rose-500'
                                : isRejected
                                ? 'text-amber-500'
                                : 'text-[var(--theme-text)]/70'
                            }`}
                          >
                            {isCompleted
                              ? `${isOutgoing ? 'Outgoing' : 'Incoming'} • ${formatCallDuration(log.duration)}`
                              : isMissed
                              ? isOutgoing
                                ? 'No answer'
                                : 'Missed call'
                              : isOutgoing
                              ? 'Call declined'
                              : 'Declined'}
                          </span>
                          <span className="text-[10px] text-[var(--theme-text)]/40">
                            • {formatDate(log.created_at || log.started_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Action Button (Call Back) */}
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onStartCall(log.call_type);
                        }}
                        className="p-2.5 rounded-xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] hover:bg-[var(--theme-accent)] hover:text-white active:scale-95 transition-all"
                        title={`Call back with ${isVideo ? 'video' : 'voice'}`}
                      >
                        {isVideo ? (
                          <Video className="w-4 h-4" />
                        ) : (
                          <Phone className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDelete(log.id, e)}
                        className="p-2 rounded-xl text-[var(--theme-text)]/30 hover:text-rose-500 hover:bg-rose-500/10 active:scale-95 transition-all opacity-0 group-hover:opacity-100"
                        title="Delete log"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Quick Action Bar */}
          <div className="p-4 border-t border-[var(--theme-border)] bg-[var(--theme-bg)]/60 flex items-center justify-between gap-3">
            <span className="text-xs text-[var(--theme-text)]/60 font-medium truncate">
              Direct P2P Encrypted Calling
            </span>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStartCall('voice');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--theme-surface)] border border-[var(--theme-border)] text-xs font-semibold text-[var(--theme-text)] hover:border-[var(--theme-accent)]/50 active:scale-95 transition-all"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Voice</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStartCall('video');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--theme-accent)] text-white text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Video</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
