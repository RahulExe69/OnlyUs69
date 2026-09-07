import { registerPlugin, Capacitor } from '@capacitor/core';
import { LocalNotifications, ActionPerformed } from '@capacitor/local-notifications';
import { Message } from '../types';

export interface OnlyUsNotificationPlugin {
  showChatNotification(options: {
    title: string;
    body: string;
    messageId?: string | number;
    senderRole?: string;
    replyRole?: string;
    notificationId?: number;
    avatarUrl?: string;
  }): Promise<void>;
  cachePartnerAvatar(options: { avatarUrl: string }): Promise<void>;
  cancelChatNotification(options?: { notificationId?: number }): Promise<void>;
}

export const OnlyUsNativeNotification = registerPlugin<OnlyUsNotificationPlugin>('OnlyUsNotification');

let isChannelCreated = false;
let isListenerRegistered = false;
let currentReplyCallback: ((text: string) => Promise<void>) | null = null;

// Attach global listener for direct replies sent from Android DirectReplyReceiver
if (typeof window !== 'undefined') {
  (window as any).onNativeDirectReplyReceived = async (text: string) => {
    if (text && currentReplyCallback) {
      try {
        await currentReplyCallback(text);
      } catch (e) {
        console.warn('Error handling in-app reply sync:', e);
      }
    }
  };
}

/**
 * Initializes notification channels and action listeners.
 * Action types support WhatsApp-style inline quick reply and open action.
 */
export async function initLocalNotifications(onReplyReceived?: (text: string) => Promise<void>) {
  if (onReplyReceived) {
    currentReplyCallback = onReplyReceived;
  }

  const isNotes = typeof navigator !== 'undefined' && navigator.userAgent.includes('OnlyUsFlavor/Notes');
  if (isNotes) return; // Stealth edition has zero notifications

  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }

    // Register WhatsApp-style quick-reply action type
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: 'CHAT_MESSAGE_ACTIONS',
          actions: [
            {
              id: 'reply',
              title: 'Reply',
              input: true,
              inputButtonTitle: 'Send',
              inputPlaceholder: 'Type a reply...'
            },
            {
              id: 'open',
              title: 'Open',
              foreground: true
            }
          ]
        }
      ]
    });

    // Create high-importance notification channel with vibration & sound
    if (!isChannelCreated) {
      await LocalNotifications.createChannel({
        id: 'onlyus_chat_messages',
        name: 'Chat Messages',
        description: 'New incoming messages from Nusrat',
        importance: 5, // High importance (heads-up banner)
        visibility: 1,
        vibration: true,
        sound: 'default'
      });
      isChannelCreated = true;
    }

    // Listen to notification actions (such as inline reply)
    if (!isListenerRegistered) {
      isListenerRegistered = true;
      try {
        await LocalNotifications.addListener('localNotificationActionPerformed', async (action: ActionPerformed) => {
          if (action.actionId === 'reply' && action.inputValue) {
            const replyText = action.inputValue.trim();
            if (replyText && currentReplyCallback) {
              try {
                await currentReplyCallback(replyText);
              } catch (err) {
                console.error('Failed to send inline reply:', err);
              }
            }
          }
        });
      } catch (listenerErr) {
        console.warn('LocalNotifications action listener notice:', listenerErr);
      }
    }
  } catch (err) {
    console.warn('LocalNotifications init notice:', err);
  }
}

/**
 * Dispatches a WhatsApp-style notification when Nusrat sends a message.
 */
export async function dispatchMessageNotification(
  msg: Message,
  senderName: string = 'Nusrat',
  partnerPhotoUrl?: string
) {
  const isNotes = typeof navigator !== 'undefined' && navigator.userAgent.includes('OnlyUsFlavor/Notes');
  if (isNotes) return; // Zero notifications in stealth edition

  let body = msg.text || '';
  if (!body && msg.media) {
    if (msg.media.type === 'audio') body = '🎤 Voice note';
    else if (msg.media.type === 'image') body = '📷 Photo';
    else if (msg.media.type === 'video') body = '🎥 Video';
    else body = '📎 Media attachment';
  } else if (!body) {
    body = 'Sent you a message';
  }

  const notifId = Math.floor(Date.now() % 100000);

  // 1. First priority on native Android: Custom Direct Reply Plugin
  // Ensures inline replies are handled by BroadcastReceiver (never opens app in background)
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    try {
      await OnlyUsNativeNotification.showChatNotification({
        title: senderName,
        body,
        messageId: msg.id,
        senderRole: msg.sender_role,
        replyRole: 'owner',
        notificationId: notifId,
        avatarUrl: partnerPhotoUrl
      });
      return;
    } catch (pluginErr) {
      console.warn('OnlyUsNativeNotification fallback to LocalNotifications:', pluginErr);
    }
  }

  // 2. Native Capacitor LocalNotification fallback
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          title: senderName,
          body,
          id: notifId,
          channelId: 'onlyus_chat_messages',
          actionTypeId: 'CHAT_MESSAGE_ACTIONS',
          smallIcon: 'ic_stat_onlyus',
          largeIcon: 'ic_nusrat_avatar',
          iconColor: '#E11D48',
          sound: 'default',
          extra: {
            messageId: msg.id,
            senderRole: msg.sender_role
          }
        }
      ]
    });
  } catch (err) {
    // 3. Web Notification fallback
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(senderName, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico'
        });
      } catch (e) {
        console.warn('Web notification notice:', e);
      }
    }
  }
}

