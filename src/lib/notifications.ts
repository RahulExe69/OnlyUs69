import { LocalNotifications, ActionPerformed } from '@capacitor/local-notifications';
import { Message } from '../types';

let isChannelCreated = false;
let isListenerRegistered = false;

/**
 * Initializes notification channels and action listeners.
 * Action types support WhatsApp-style inline quick reply and open action.
 */
export async function initLocalNotifications(onReplyReceived?: (text: string) => Promise<void>) {
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
      LocalNotifications.addListener('localNotificationActionPerformed', async (action: ActionPerformed) => {
        if (action.actionId === 'reply' && action.inputValue && onReplyReceived) {
          const replyText = action.inputValue.trim();
          if (replyText) {
            try {
              await onReplyReceived(replyText);
            } catch (err) {
              console.error('Failed to send inline reply:', err);
            }
          }
        }
      });
      isListenerRegistered = true;
    }
  } catch (err) {
    console.warn('LocalNotifications init notice:', err);
  }
}

/**
 * Dispatches a WhatsApp-style notification when Nusrat sends a message.
 */
export async function dispatchMessageNotification(msg: Message, senderName: string = 'Nusrat') {
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

  // 1. Native Capacitor LocalNotification for Android
  try {
    const notifId = Math.floor(Date.now() % 100000);
    await LocalNotifications.schedule({
      notifications: [
        {
          title: senderName,
          body,
          id: notifId,
          channelId: 'onlyus_chat_messages',
          actionTypeId: 'CHAT_MESSAGE_ACTIONS',
          smallIcon: 'ic_launcher',
          sound: 'default',
          extra: {
            messageId: msg.id,
            senderRole: msg.sender_role
          }
        }
      ]
    });
  } catch (err) {
    // 2. Web Notification fallback
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
