import { Capacitor, SystemBars, SystemBarsStyle, registerPlugin } from '@capacitor/core';

interface OnlyUsThemePlugin {
  setSystemBarColors(options: {
    backgroundColor: string;
    darkIcons: boolean;
  }): Promise<void>;
}

const OnlyUsTheme = registerPlugin<OnlyUsThemePlugin>('OnlyUsTheme');

function isLightColor(hex: string): boolean {
  const normalized = hex.trim().replace(/^#/, '');
  if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(normalized)) return false;
  const full = normalized.length === 3
    ? normalized.split('').map((part) => part + part).join('')
    : normalized;
  const red = parseInt(full.slice(0, 2), 16);
  const green = parseInt(full.slice(2, 4), 16);
  const blue = parseInt(full.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 >= 150;
}

/**
 * Update the native window surface and system-bar icon contrast alongside the
 * active chat theme. Android 15+ draws system bars edge-to-edge, so the window
 * background must match the page rather than relying only on bar-color setters.
 */
export async function syncNativeSystemBars(backgroundColor: string) {
  if (!Capacitor.isNativePlatform()) return;

  const darkIcons = isLightColor(backgroundColor);
  const style = darkIcons ? SystemBarsStyle.Light : SystemBarsStyle.Dark;

  try {
    await Promise.all([
      SystemBars.setStyle({ style }),
      OnlyUsTheme.setSystemBarColors({ backgroundColor, darkIcons }),
    ]);
  } catch (error) {
    console.debug('Could not synchronise OnlyUs system bars:', error);
  }
}
