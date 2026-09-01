/// <reference types="vite/client" />
declare module "*.webp" {
  const src: string;
  export default src;
}

interface Window {
  AndroidBridge?: {
    openTab?: (tabName: string) => void;
    onBackPress?: () => void;
    onNewMessage?: (messageJson: string) => void;
    onUserLogin?: (userJson: string) => void;
    requestPushToken?: () => void;
  };
  setHubTab?: (tabName: 'dashboard' | 'chat' | 'instagram' | 'whatsapp') => void;
  getCurrentHubTab?: () => string;
  handleAndroidBack?: () => boolean;
  registerPushToken?: (token: string) => Promise<boolean>;
  sendNativeDirectReply?: (text: string) => Promise<boolean>;
}
