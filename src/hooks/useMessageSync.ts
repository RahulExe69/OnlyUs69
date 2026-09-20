import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Message, UserProfile, UserRole } from '../types';
import { hydrateMessageMedia } from '../lib/dateUtils';
import { cacheMessages, loadCachedMessages } from '../lib/safeStorage';
import { initMediaSyncListener, flushPendingMediaRestores } from '../lib/mediaStore';
import { dispatchMessageNotification } from '../lib/notifications';
import { decryptRawMessage, decryptRawMessagesBatch, onE2EEStatusChange } from '../lib/e2ee';

export interface UseMessageSyncOptions {
  user: any;
  userProfile: UserProfile | null;
  partnerProfile?: UserProfile | null;
  isOwner: boolean;
  onScrollToBottom?: (smooth?: boolean) => void;
}

const formatReplyText = (orig: any, isDeletedByMe: boolean) => {
  if (orig.deleted) {
    const isOrigMedia = Boolean(
      orig.deleted_from_media ||
      orig.media_deleted_by ||
      orig.attachment_url ||
      orig.media ||
      (orig.mediaList && orig.mediaList.length > 0)
    );
    const origDeleterName =
      (orig.deletedBy || orig.media_deleted_by || orig.deleted_from_media_by || orig.sender_role) === 'owner'
        ? 'Rahul'
        : 'Nusrat';
    return isOrigMedia
      ? `${origDeleterName} Deleted`
      : isDeletedByMe
      ? 'You deleted this message'
      : 'This message was deleted';
  }
  if (orig.deleted_from_media) {
    const origArchiverName =
      (orig.deleted_from_media_by || orig.sender_role) === 'owner' ? 'Rahul' : 'Nusrat';
    return `${origArchiverName} Archived`;
  }
  return orig.text;
};

export function useMessageSync({
  user,
  userProfile,
  partnerProfile,
  isOwner,
  onScrollToBottom,
}: UseMessageSyncOptions) {
  const currentRole: UserRole = isOwner ? 'owner' : 'partner';
  const [messages, setMessages] = useState<Message[]>(() => {
    const cached = loadCachedMessages();
    return Array.isArray(cached) ? cached : [];
  });
  const [messagesLoading, setMessagesLoading] = useState<boolean>(() => {
    const cached = loadCachedMessages();
    return !Array.isArray(cached) || cached.length === 0;
  });
  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;

  const channelRef = useRef<any>(null);
  const isFetchingRef = useRef(false);
  const initialFetchDoneRef = useRef(false);

  // Sync cache whenever messages state changes (debounced to avoid blocking main thread on reload)
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        cacheMessages(messages);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  // Helper to process raw database messages into UI Message objects
  const processRawMessages = useCallback((rawData: any[], existingList: Message[]): Message[] => {
    const chronologicalData = [...rawData].reverse();

    const msgMap = new Map<string, any>();
    // Pre-populate with existing messages
    existingList.forEach((m) => {
      if (m && m.id) msgMap.set(m.id, m);
    });
    // Overlay newly fetched messages
    chronologicalData.forEach((m: any) => {
      if (m && m.id) msgMap.set(m.id, m);
    });

    const mappedData = chronologicalData.map((m: any) => {
      let replyToObj = null;
      if (m.reply_to) {
        const orig = msgMap.get(m.reply_to);
        if (orig) {
          const isOrigDeletedByMe = orig.deletedBy
            ? orig.deletedBy === userProfile?.role
            : orig.sender_role === userProfile?.role;
          replyToObj = {
            id: orig.id,
            text: formatReplyText(orig, isOrigDeletedByMe),
            sender_role: orig.sender_role,
          };
        } else {
          replyToObj = {
            id: m.reply_to,
            text: m.reply_text || 'Original message',
            sender_role:
              m.reply_sender_role ||
              (m.sender_role === 'owner' ? 'partner' : 'owner'),
          };
        }
      }
      const hydrated = m.deleted ? undefined : hydrateMessageMedia(m);
      return {
        ...m,
        media: hydrated,
        mediaList: hydrated?.mediaList,
        timestamp: m.created_at || m.timestamp || new Date().toISOString(),
        replyTo: replyToObj,
      };
    });

    return mappedData;
  }, [userProfile?.role]);

  // Catch-up synchronization (e.g. after phone wakes from sleep or network reconnects)
  const refetchCatchUp = useCallback(async () => {
    if (!user || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      // Find timestamp of the newest non-temp message
      const currentList = messagesRef.current;
      const nonTemp = currentList.filter(
        (m) => !m.id.startsWith('temp_') && !m.id.startsWith('optimistic_')
      );
      const latestMsg = nonTemp[nonTemp.length - 1];
      const latestCreatedAt = latestMsg?.created_at || latestMsg?.timestamp;

      let query = supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (latestCreatedAt) {
        // Fetch any messages created at or after our latest known message (with small safety margin)
        query = query.gte('created_at', latestCreatedAt).limit(100);
      } else {
        query = query.limit(50);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const decryptedData = await decryptRawMessagesBatch(data);
        const processed = processRawMessages(decryptedData, currentList);
        setMessages((prev) => {
          const prevMap = new Map<string, Message>();
          prev.forEach((m) => prevMap.set(m.id, m));

          // Merge or update
          processed.forEach((m) => {
            prevMap.set(m.id, m as Message);
          });

          // Sort chronologically ascending
          const merged = Array.from(prevMap.values()).sort((a, b) => {
            const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
            const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
            return timeA - timeB;
          });

          return merged;
        });
      }

      // Also flush any pending media restores when reconnecting
      flushPendingMediaRestores(supabase, currentRole).catch(() => {});
    } catch (err) {
      console.warn('[useMessageSync] Catch-up sync warning:', err);
    } finally {
      isFetchingRef.current = false;
    }
  }, [user, currentRole, processRawMessages]);

  // Main lifecycle: fetch initial history and attach realtime listener
  useEffect(() => {
    if (!user) return;

    initMediaSyncListener(supabase, currentRole);
    if (messagesRef.current.length === 0) {
      setMessagesLoading(true);
    }
    let isCancelled = false;
    let retryTimer: any = null;

    // Re-decrypt messages whenever E2EE shared key becomes active
    const unsubE2EE = onE2EEStatusChange((status) => {
      if (status.isReady && messagesRef.current.length > 0) {
        // Only decrypt messages that actually have encrypted ciphertext and have not yet been decrypted
        const needsDecryption = messagesRef.current.filter(
          (m) => (m.is_encrypted || (m as any).ciphertext) && (!m.text || m.text.startsWith('🔒'))
        );
        if (needsDecryption.length === 0) return;

        decryptRawMessagesBatch(needsDecryption).then((decryptedList) => {
          setMessages((prev) => {
            let hasChanges = false;
            const map = new Map(decryptedList.map((m) => [m.id, m]));
            const updated = prev.map((m) => {
              const dec = map.get(m.id);
              if (dec && dec.is_encrypted && dec.text !== m.text) {
                hasChanges = true;
                return { ...m, ...dec };
              }
              return m;
            });
            return hasChanges ? updated : prev;
          });
        });
      }
    });

    const fetchInitialMessages = async (retryAttempt = 0) => {
      try {
        const { data, error: msgErr } = await supabase
          .from('messages')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (isCancelled) return;

        if (msgErr) {
          console.warn(
            '[useMessageSync] Message sync notice (retrying):',
            msgErr.message || msgErr
          );
          if (retryAttempt < 8) {
            const delay = Math.min(1500 * Math.pow(1.4, retryAttempt), 8000);
            retryTimer = setTimeout(() => {
              if (!isCancelled && user) fetchInitialMessages(retryAttempt + 1);
            }, delay);
          }
        } else if (data) {
          const decryptedData = await decryptRawMessagesBatch(data);
          const processed = processRawMessages(decryptedData, []);

          // Deduplicate by ID
          const uniqueMapped: Message[] = [];
          const seenIds = new Set<string>();
          for (const item of processed) {
            if (item && item.id && !seenIds.has(item.id)) {
              seenIds.add(item.id);
              uniqueMapped.push(item as Message);
            }
          }

          setMessages(uniqueMapped);
          cacheMessages(uniqueMapped);
          initialFetchDoneRef.current = true;
        }
      } catch (err: any) {
        console.warn(
          '[useMessageSync] Network fetch exception (retrying):',
          err?.message || err
        );
        if (retryAttempt < 8) {
          const delay = Math.min(1500 * Math.pow(1.4, retryAttempt), 8000);
          retryTimer = setTimeout(() => {
            if (!isCancelled && user) fetchInitialMessages(retryAttempt + 1);
          }, delay);
        }
      } finally {
        if (!isCancelled) {
          setMessagesLoading(false);
        }
      }
    };

    fetchInitialMessages();

    // Set up Realtime listener
    const unsubMsg = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const rawIncoming = payload.new;
            if (!rawIncoming || !rawIncoming.id) return;

            decryptRawMessage(rawIncoming).then((raw) => {
              if (isCancelled) return;
              setMessages((prev) => {
                let replyToObj = null;
                if (raw.reply_to) {
                  const orig = prev.find((m) => m.id === raw.reply_to);
                  if (orig) {
                    const isOrigDeletedByMe = orig.deletedBy
                      ? orig.deletedBy === userProfile?.role
                      : orig.sender_role === userProfile?.role;
                    replyToObj = {
                      id: orig.id,
                      text: formatReplyText(orig, isOrigDeletedByMe),
                      sender_role: orig.sender_role,
                    };
                  } else {
                    replyToObj = {
                      id: raw.reply_to,
                      text: raw.reply_text || 'Original message',
                      sender_role:
                        raw.reply_sender_role ||
                        (raw.sender_role === 'owner' ? 'partner' : 'owner'),
                    };
                  }
                }

                const hydrated = raw.deleted
                  ? undefined
                  : hydrateMessageMedia(raw);
                const msg: Message = {
                  ...raw,
                  media: hydrated,
                  mediaList: hydrated?.mediaList,
                  timestamp:
                    raw.created_at || raw.timestamp || new Date().toISOString(),
                  replyTo: replyToObj,
                };

                // Remove any optimistic temp message that matches
                const filtered = prev.filter(
                  (m) =>
                    m.id !== msg.id &&
                    !(
                      m.id.startsWith('temp') &&
                      (m.text === msg.text || (m.media && msg.media)) &&
                      m.sender_role === msg.sender_role
                    )
                );

                if (
                  typeof window !== 'undefined' &&
                  typeof (window as any).AndroidBridge?.onNewMessage ===
                    'function'
                ) {
                  try {
                    (window as any).AndroidBridge.onNewMessage(
                      JSON.stringify(msg)
                    );
                  } catch (e) {
                    console.warn('AndroidBridge.onNewMessage error:', e);
                  }
                }

                // WhatsApp-style notification when partner sends message and window is backgrounded or tab inactive
                const myRole = userProfile?.role || (isOwner ? 'owner' : 'partner');
                if (msg.sender_role !== myRole) {
                  const partnerName = myRole === 'owner' ? (partnerProfile?.display_name || 'Nusrat') : (partnerProfile?.display_name || 'Rahul');
                  const partnerPhoto = partnerProfile?.photo_url;
                  dispatchMessageNotification(msg, partnerName, partnerPhoto);
                }

                return [...filtered, msg];
              });

              if (onScrollToBottom) {
                requestAnimationFrame(() => onScrollToBottom(false));
              }
            });
          } else if (payload.eventType === 'UPDATE') {
            const rawIncoming = payload.new;
            if (!rawIncoming || !rawIncoming.id) return;

            decryptRawMessage(rawIncoming).then((raw) => {
              if (isCancelled) return;
              setMessages((prev) => {
                let replyToObj = null;
                if (raw.reply_to) {
                  const orig = prev.find((m) => m.id === raw.reply_to);
                  if (orig) {
                    const isOrigDeletedByMe = orig.deletedBy
                      ? orig.deletedBy === userProfile?.role
                      : orig.sender_role === userProfile?.role;
                    replyToObj = {
                      id: orig.id,
                      text: formatReplyText(orig, isOrigDeletedByMe),
                      sender_role: orig.sender_role,
                    };
                  } else {
                    replyToObj = {
                      id: raw.reply_to,
                      text: raw.reply_text || 'Original message',
                      sender_role:
                        raw.reply_sender_role ||
                        (raw.sender_role === 'owner' ? 'partner' : 'owner'),
                    };
                  }
                }

                const hydrated = raw.deleted
                  ? undefined
                  : hydrateMessageMedia(raw);
                const msg: Message = {
                  ...raw,
                  media: hydrated,
                  mediaList: hydrated?.mediaList,
                  timestamp:
                    raw.created_at || raw.timestamp || new Date().toISOString(),
                  replyTo: replyToObj,
                };

                return prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m));
              });
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            if (deletedId) {
              setMessages((prev) => prev.filter((m) => m.id !== deletedId));
            }
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          // Channel connected successfully, catch up only if initial fetch has already completed
          if (initialFetchDoneRef.current) {
            refetchCatchUp();
          }
        }
      });

    channelRef.current = unsubMsg;

    // Visibility and Online reconnection listeners for Android WebView resilience
    const handleWakeUp = () => {
      if (document.visibilityState === 'visible') {
        refetchCatchUp();
      }
    };

    const handleWindowFocus = () => {
      refetchCatchUp();
    };

    const handleNetworkOnline = () => {
      refetchCatchUp();
    };

    window.addEventListener('visibilitychange', handleWakeUp);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleNetworkOnline);

    return () => {
      isCancelled = true;
      unsubE2EE();
      if (retryTimer) clearTimeout(retryTimer);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      window.removeEventListener('visibilitychange', handleWakeUp);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleNetworkOnline);
    };
  }, [user?.id, currentRole, processRawMessages, refetchCatchUp, userProfile?.role, onScrollToBottom]);

  return {
    messages,
    setMessages,
    messagesLoading,
    refetchCatchUp,
  };
}
