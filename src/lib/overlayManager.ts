import { useEffect, useRef } from 'react';

interface OverlayItem {
  id: string;
  close: () => void;
  closedViaHistory?: boolean;
}

const overlayStack: OverlayItem[] = [];
let isInitialized = false;
let pendingPopstateIgnoreId: string | null = null;

function initGlobalPopStateListener() {
  if (typeof window === 'undefined' || isInitialized) return;
  isInitialized = true;

  window.addEventListener('popstate', () => {
    // If this popstate was triggered by our own in-app history.back() call, ignore it
    if (pendingPopstateIgnoreId) {
      pendingPopstateIgnoreId = null;
      return;
    }

    // Hardware or browser back button was pressed
    if (overlayStack.length > 0) {
      const topOverlay = overlayStack.pop();
      if (topOverlay) {
        topOverlay.closedViaHistory = true;
        topOverlay.close();
      }
    }
  });
}

/**
 * Checks if any overlay is currently registered in the back-stack
 */
export function hasOpenOverlays(): boolean {
  return overlayStack.length > 0;
}

/**
 * Pops and executes the topmost overlay closer manually (e.g. from Android bridge)
 */
export function popOverlay(): boolean {
  if (overlayStack.length > 0) {
    const topOverlay = overlayStack.pop();
    if (topOverlay) {
      topOverlay.closedViaHistory = true;
      try {
        if (window.history.state && window.history.state.onlyus_overlay === topOverlay.id) {
          pendingPopstateIgnoreId = topOverlay.id;
          window.history.back();
        }
      } catch (e) {
        console.warn('Unable to step history back', e);
      }
      topOverlay.close();
      return true;
    }
  }
  return false;
}

export function useOverlayBack(isOpen: boolean, onClose: () => void, id: string) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    initGlobalPopStateListener();

    if (!isOpen) return;

    const overlayId = id || Math.random().toString(36).slice(2);

    const closeItem = () => {
      onCloseRef.current();
    };

    const item: OverlayItem = { id: overlayId, close: closeItem, closedViaHistory: false };
    overlayStack.push(item);

    try {
      window.history.pushState({ onlyus_overlay: overlayId }, '');
    } catch (e) {
      console.warn('Unable to push history state for overlay', e);
    }

    return () => {
      const index = overlayStack.findIndex((o) => o.id === overlayId);
      let wasClosedViaHistory = false;
      if (index !== -1) {
        wasClosedViaHistory = !!overlayStack[index].closedViaHistory;
        overlayStack.splice(index, 1);
      }

      // If already closed via hardware/browser back, the browser history has already stepped back!
      if (wasClosedViaHistory) {
        return;
      }

      // If closed in-app (e.g. clicking close icon / back button in modal):
      // Only step history back IF the current browser state belongs to THIS overlay!
      // This mathematically guarantees that in-app back will NEVER step past the app's root entry.
      try {
        if (window.history.state && window.history.state.onlyus_overlay === overlayId) {
          pendingPopstateIgnoreId = overlayId;
          window.history.back();
        }
      } catch (e) {
        console.warn('Unable to pop history state for overlay', e);
      }
    };
  }, [isOpen, id]);
}
