import { useEffect, useRef } from 'react';

interface OverlayItem {
  id: string;
  close: () => void;
}

const overlayStack: OverlayItem[] = [];
let ignorePopCount = 0;
let isInitialized = false;

function initGlobalPopStateListener() {
  if (typeof window === 'undefined' || isInitialized) return;
  isInitialized = true;

  window.addEventListener('popstate', () => {
    if (ignorePopCount > 0) {
      ignorePopCount--;
      return;
    }

    if (overlayStack.length > 0) {
      const topOverlay = overlayStack.pop();
      if (topOverlay) {
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
      ignorePopCount++;
      try {
        window.history.back();
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

    const item: OverlayItem = { id: overlayId, close: closeItem };
    overlayStack.push(item);

    try {
      window.history.pushState({ onlyus_overlay: overlayId }, '');
    } catch (e) {
      console.warn('Unable to push history state for overlay', e);
    }

    return () => {
      const index = overlayStack.findIndex((o) => o.id === overlayId);
      if (index !== -1) {
        overlayStack.splice(index, 1);
        ignorePopCount++;
        try {
          window.history.back();
        } catch (e) {
          console.warn('Unable to pop history state for overlay', e);
        }
      }
    };
  }, [isOpen, id]);
}
