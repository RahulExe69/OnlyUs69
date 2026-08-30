/// <reference types="vite/client" />
declare module "*.webp" {
  const src: string;
  export default src;
}

interface Window {
  AndroidBridge?: {
    openTab?: (tabName: string) => void;
    onBackPress?: () => void;
  };
  setHubTab?: (tabName: 'dashboard' | 'chat' | 'instagram' | 'whatsapp') => void;
  getCurrentHubTab?: () => string;
  handleAndroidBack?: () => boolean;
}
