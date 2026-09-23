import React, { useState, useRef } from 'react';
import { AnimatePresence } from 'motion/react';
import { ChevronLeft, Camera, LogOut, KeyRound, RefreshCw, Check, Copy, UserPlus, X, EyeOff, BookOpen, Smartphone, Cloud, ShieldCheck } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { supabase } from '../lib/supabase';
import { UserProfile, AppConfig, APP_VERSION } from '../types';
import { useOverlayBack } from '../lib/overlayManager';
import { ImageCropperModal } from './ImageCropperModal';
import { CloudinarySettingsSection } from './CloudinarySettingsModal';

interface ProfileModalProps {
  profile: UserProfile;
  onClose: () => void;
  config: AppConfig | null;
  isOwner: boolean;
  onLogout: () => void;
  onProfileUpdated?: (profile: UserProfile) => void;
  onConfigUpdated?: (config: AppConfig) => void;
  onLockVault?: () => void;
  isNotesFlavor?: boolean;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  profile,
  onClose,
  config,
  isOwner,
  onLogout,
  onProfileUpdated,
  onConfigUpdated,
  onLockVault,
  isNotesFlavor = false,
}) => {
  const [activeTab, setActiveTab] = useState<'me' | 'access' | 'cloud'>('me');
  const [stealthEnabled, setStealthEnabled] = useState<boolean>(() => {
    return localStorage.getItem('onlyus_stealth_mode') === 'true';
  });

  const toggleStealthMode = () => {
    const next = !stealthEnabled;
    setStealthEnabled(next);
    localStorage.setItem('onlyus_stealth_mode', next ? 'true' : 'false');
  };

  // My profile state
  const [name, setName] = useState(profile.display_name || (profile.role === 'owner' ? 'Rahul' : 'Nusrat'));
  const [username, setUsername] = useState(
    profile.username || (profile.email ? profile.email.split('@')[0] : (profile.role === 'owner' ? 'rahul' : 'nusrat'))
  );
  const [photo, setPhoto] = useState(profile.photo_url || '');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);

  useOverlayBack(showCropper, () => setShowCropper(false), 'profile-modal-cropper');

  const myFileInputRef = useRef<HTMLInputElement>(null);

  // Partner Management Logic (6-Digit Code + Email backup)
  const [partnerPasscode, setPartnerPasscode] = useState(config?.partner_passcode || '123456');
  const [copiedCode, setCopiedCode] = useState(false);
  const [emails, setEmails] = useState<string[]>(config?.partner_allowed_emails || []);
  const [newEmail, setNewEmail] = useState('');

  // Owner Management Logic (Primary + Backup Owner Google Accounts)
  const [ownerEmails, setOwnerEmails] = useState<string[]>(() => {
    const raw = config?.owner_email || 'bodruddoja4@gmail.com';
    return raw.split(/[,;\s]+/).map(e => e.trim()).filter(Boolean);
  });
  const [newOwnerEmail, setNewOwnerEmail] = useState('');

  const generateRandomPin = () => {
    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
    setPartnerPasscode(randomPin);
  };

  const copyPasscodeToClipboard = () => {
    navigator.clipboard.writeText(partnerPasscode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const addEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEmail && !emails.includes(newEmail)) {
      setEmails([...emails, newEmail]);
      setNewEmail('');
    }
  };

  const removeEmail = (email: string) => {
    setEmails(emails.filter((e) => e !== email));
  };

  const addOwnerEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newOwnerEmail.trim().toLowerCase();
    if (trimmed && !ownerEmails.map(e => e.toLowerCase()).includes(trimmed)) {
      setOwnerEmails([...ownerEmails, trimmed]);
      setNewOwnerEmail('');
    }
  };

  const removeOwnerEmail = (emailToRemove: string) => {
    // Keep master bodruddoja4@gmail.com safe
    if (emailToRemove.toLowerCase() === 'bodruddoja4@gmail.com') return;
    setOwnerEmails(ownerEmails.filter(e => e.toLowerCase() !== emailToRemove.toLowerCase()));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setTempImage(reader.result as string);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
    // Reset file input value so re-selecting same file triggers onChange
    e.target.value = '';
  };

  const onCropComplete = async (croppedImage: string) => {
    try {
      const response = await fetch(croppedImage);
      const blob = await response.blob();
      const compressedFile = await imageCompression(blob as File, {
        maxSizeMB: 0.1,
        maxWidthOrHeight: 400,
        useWebWorker: true,
      });
      const reader = new FileReader();
      reader.onloadend = () => {
        const compressedBase64 = reader.result as string;
        setPhoto(compressedBase64);
        setShowCropper(false);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error(error);
      alert('Failed to process image.');
    }
  };

  const saveMyProfile = async () => {
    setIsSaving(true);
    try {
      const cleanName = name.trim();
      const cleanUsername = username.trim().toLowerCase().replace(/^@+/, '').replace(/\s+/g, '');

      await supabase.from('users').update({
        display_name: cleanName,
        username: cleanUsername,
        photo_url: photo,
      }).eq('id', profile.uid);

      const updated: UserProfile = {
        ...profile,
        display_name: cleanName,
        username: cleanUsername,
        photo_url: photo,
      };

      if (onProfileUpdated) {
        onProfileUpdated(updated);
      }

      setSaveSuccessMsg('Profile updated!');
      setTimeout(() => {
        setSaveSuccessMsg(null);
        onClose();
      }, 800);
    } catch (err) {
      console.error(err);
      alert('Failed to save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const savePasscodeAndAccess = async () => {
    const trimmedPasscode = partnerPasscode.trim();
    if (trimmedPasscode.length !== 6) {
      alert('Passcode must be exactly 6 digits.');
      return;
    }
    setIsSaving(true);
    try {
      const updatedConfigData: Partial<AppConfig> = {
        owner_email: ownerEmails.join(', '),
        partner_allowed_emails: emails,
        partner_passcode: trimmedPasscode,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem('onlyus_cached_server_passcode', trimmedPasscode);
      }

      if (isOwner) {
        const updatePromise = supabase
          .from('app_config')
          .update(updatedConfigData)
          .eq('id', 'main');

        const timeoutPromise = new Promise<{ error: any }>((_, reject) =>
          setTimeout(() => reject(new Error('Update timeout')), 4000)
        );

        const { error } = (await Promise.race([updatePromise, timeoutPromise])) as any;
        if (error) {
          console.warn('[ProfileModal] Notice updating app_config:', error);
        }
      }

      if (onConfigUpdated && config) {
        onConfigUpdated({
          ...config,
          ...updatedConfigData,
        } as AppConfig);
      }

      setSaveSuccessMsg(`Passcode updated to ${trimmedPasscode}!`);
      setTimeout(() => {
        setSaveSuccessMsg(null);
        onClose();
      }, 900);
    } catch (err) {
      console.error('[ProfileModal] Save passcode warning:', err);
      // Fallback: settings cached locally even on network timeout
      if (onConfigUpdated && config) {
        onConfigUpdated({
          ...config,
          partner_passcode: trimmedPasscode,
        } as AppConfig);
      }
      setSaveSuccessMsg('Passcode saved locally!');
      setTimeout(() => {
        setSaveSuccessMsg(null);
        onClose();
      }, 900);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="theme-settings fixed inset-0 z-[100] flex flex-col bg-[var(--theme-surface)] text-[var(--theme-text)] animate-in fade-in duration-100">
      <div className="h-20 flex-shrink-0 border-b border-[var(--theme-border)] flex items-center justify-between px-6 bg-[var(--theme-bg)]/50">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 -ml-2 text-[#6E6E6E]">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold text-[#1a1a1a]">Personal Profile</h2>
        </div>
        {saveSuccessMsg && (
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 animate-pulse">
            {saveSuccessMsg}
          </span>
        )}
      </div>

      {isOwner && (
        <div className="flex border-b border-[var(--theme-border)] px-4 pt-2 bg-[var(--theme-surface)] flex-shrink-0 gap-2">
          <button
            onClick={() => setActiveTab('me')}
            className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
              activeTab === 'me'
                ? 'border-[var(--theme-accent)] text-[var(--theme-accent)]'
                : 'border-transparent text-[var(--theme-text)]/50'
            }`}
          >
            My Profile
          </button>
          <button
            onClick={() => setActiveTab('access')}
            className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
              activeTab === 'access'
                ? 'border-[var(--theme-accent)] text-[var(--theme-accent)]'
                : 'border-transparent text-[var(--theme-text)]/50'
            }`}
          >
            PIN Access
          </button>
          <button
            onClick={() => setActiveTab('cloud')}
            className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5 ${
              activeTab === 'cloud'
                ? 'border-[var(--theme-accent)] text-[var(--theme-accent)]'
                : 'border-transparent text-[var(--theme-text)]/50'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Cloud</span>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[var(--theme-bg)] text-[var(--theme-text)]">
        {activeTab === 'me' && (
          <div className="max-w-md mx-auto space-y-7">
            {/* Avatar Section */}
            <div className="flex flex-col items-center">
              <div className="relative group">
                <div className="w-32 h-32 rounded-full bg-[var(--theme-accent)]/15 overflow-hidden border-4 border-[var(--theme-accent)]/30 shadow-md relative ring-4 ring-[var(--theme-accent)]/15">
                  {photo ? (
                    <img src={photo} alt="Me" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-[var(--theme-accent)]">
                      {name?.[0] || '?'}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => myFileInputRef.current?.click()}
                  className="absolute bottom-1 right-1 bg-[var(--theme-accent)] p-2.5 rounded-full text-white shadow-lg border-2 border-[var(--theme-surface)] hover:scale-110 active:scale-95 transition-transform"
                  title="Change photo"
                >
                  <Camera className="w-5 h-5" />
                </button>
                <input
                  type="file"
                  ref={myFileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>
              <p className="mt-3 text-[11px] font-bold text-[var(--theme-text)]/60 uppercase tracking-widest">
                Tap camera to change photo
              </p>
            </div>

            {/* Form Fields */}
            <div className="space-y-5">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-[var(--theme-text)]/60 mb-2 block ml-1">
                  Display Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="How you appear in chat..."
                  className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-2xl px-5 py-4 text-[15px] shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]/20 font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-[var(--theme-text)]/60 mb-2 block ml-1">
                  Visual Username / Handle
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-4 text-[var(--theme-accent)] font-bold text-[15px] select-none">@</span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, '').replace(/^@+/, ''))}
                    placeholder="username"
                    className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-2xl pl-9 pr-5 py-4 text-[15px] shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]/20 font-medium font-mono"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--theme-text)]/60 ml-1">
                  Displayed underneath your name in Nicknames & chat profile
                </p>
              </div>

              {/* Stealth Disguise Vault Card (Only shown in Nusrat's stealth Notes flavor) */}
              {isNotesFlavor && (
                <div className="bg-[var(--theme-surface)] p-5 rounded-3xl border border-[var(--theme-border)] shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-600">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[var(--theme-text)]">Stealth Disguise (Notepad)</h4>
                        <p className="text-[11px] text-[var(--theme-text)]/60">Disguises OnlyUs as a functional Notes app</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={toggleStealthMode}
                      className={`w-12 h-7 rounded-full transition-colors relative p-0.5 ${
                        stealthEnabled ? 'bg-amber-500' : 'bg-[var(--theme-border)]'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform transform ${
                          stealthEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="text-[11px] text-[var(--theme-text)]/75 space-y-1.5 bg-[var(--theme-bg)]/50 p-3 rounded-2xl border border-[var(--theme-border)]/50">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-amber-600 font-mono bg-amber-100/80 px-1.5 py-0.5 rounded">#6969#</span>
                      <span>Type in search bar to unlock OnlyUs</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--theme-accent)]">⚡ Shake Phone:</span>
                      <span>Instantly exits and locks back to Notes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--theme-accent)]">🔒 Auto Lock:</span>
                      <span>Locks when screen turns off or app minimizes</span>
                    </div>
                  </div>

                  {onLockVault && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onLockVault();
                      }}
                      className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs rounded-xl border border-amber-300/40 transition-colors flex items-center justify-center gap-2"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      Lock to Notepad Now
                    </button>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-[var(--theme-border)] flex flex-col gap-3.5">
                <button
                  type="button"
                  onClick={saveMyProfile}
                  disabled={isSaving}
                  className="w-full h-14 bg-[var(--theme-accent)] text-white rounded-2xl text-[13px] font-bold uppercase tracking-widest shadow-xl shadow-[var(--theme-accent)]/15 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full h-14 bg-[var(--theme-surface)] text-red-400 border border-red-200/50 rounded-2xl text-[13px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-500/10 active:scale-95 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Logout Session
                </button>

                <div className="pt-2 pb-1 text-center select-none">
                  <p className="text-[11px] font-mono text-[var(--theme-text)]/40 tracking-wider">
                    OnlyUs v{APP_VERSION} • {isNotesFlavor ? 'Notes Stealth Edition' : 'Direct Edition'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'access' && isOwner && (
          <div className="max-w-md mx-auto space-y-8">
            {/* 6-Digit Passcode Section */}
            <section className="bg-[var(--theme-surface)] p-6 rounded-3xl border border-[var(--theme-border)] shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[var(--theme-accent)]/15 flex items-center justify-center text-[var(--theme-accent)]">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[var(--theme-text)]">Nusrat's 6-Digit Passcode</h3>
                    <p className="text-[10px] text-[var(--theme-text)]/60">Used for instant passcode login</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={generateRandomPin}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-xl text-[10px] font-bold text-[var(--theme-accent)] hover:bg-[var(--theme-accent)]/10 active:scale-95 transition-all"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Random PIN</span>
                </button>
              </div>

              {/* PIN Display & Input */}
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={partnerPasscode}
                    onChange={(e) => setPartnerPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="w-full h-14 bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-2xl px-5 text-center font-mono text-2xl font-bold tracking-[0.5em] text-[var(--theme-text)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]/30"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={copyPasscodeToClipboard}
                    className="flex-1 h-11 bg-[var(--theme-surface)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-[var(--theme-accent)]/10 active:scale-95 transition-all"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-600">Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
                        <span>Copy 6-Digit Code</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-[var(--theme-text)]/70 leading-relaxed">
                Nusrat can enter this 6-digit code on the login screen to enter OnlyUs immediately without any Google account.
              </p>
            </section>

            {/* Owner Google Accounts Section (Rahul) */}
            {isOwner && (
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--theme-text)]/60">
                    Owner Google Accounts (Rahul)
                  </h3>
                </div>
                <div className="space-y-2">
                  {ownerEmails.map((email) => {
                    const isMaster = email.toLowerCase() === 'bodruddoja4@gmail.com';
                    return (
                      <div
                        key={email}
                        className="flex items-center justify-between p-3.5 bg-[var(--theme-surface)] rounded-2xl border border-[var(--theme-border)]"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-mono text-[var(--theme-text)] truncate">{email}</span>
                          {isMaster && (
                            <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 rounded-md">
                              Primary Master
                            </span>
                          )}
                        </div>
                        {!isMaster && (
                          <button
                            onClick={() => removeOwnerEmail(email)}
                            className="p-1.5 text-red-400 hover:text-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <form onSubmit={addOwnerEmail} className="flex gap-2">
                  <input
                    type="email"
                    value={newOwnerEmail}
                    onChange={(e) => setNewOwnerEmail(e.target.value)}
                    placeholder="Add secondary Owner Gmail (e.g. Rahul)..."
                    className="flex-1 bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-4 bg-emerald-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all"
                  >
                    Add
                  </button>
                </form>
              </section>
            )}

            {/* Email Authorizations (Optional backup) */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <UserPlus className="w-4 h-4 text-[var(--theme-accent)]" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--theme-text)]/60">
                  Backup Partner Email Access (Nusrat)
                </h3>
              </div>
              <div className="space-y-2">
                {emails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between p-3.5 bg-[var(--theme-surface)] rounded-2xl border border-[var(--theme-border)]"
                  >
                    <span className="text-xs font-mono text-[var(--theme-text)] truncate">{email}</span>
                    <button
                      onClick={() => removeEmail(email)}
                      className="p-1.5 text-red-400 hover:text-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={addEmail} className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Optional Partner Google Email..."
                  className="flex-1 bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 bg-[var(--theme-accent)] text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all"
                >
                  Add
                </button>
              </form>
            </section>

            <button
              type="button"
              onClick={savePasscodeAndAccess}
              disabled={isSaving || partnerPasscode.length !== 6}
              className="w-full h-14 bg-[var(--theme-accent)] text-white rounded-2xl text-[13px] font-bold uppercase tracking-widest shadow-xl shadow-[var(--theme-accent)]/15 active:scale-95 transition-all disabled:opacity-50 mt-6 flex items-center justify-center gap-2.5"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Saving Settings...</span>
                </>
              ) : (
                'Save Passcode & Settings'
              )}
            </button>
          </div>
        )}

        {activeTab === 'cloud' && (
          <div className="max-w-md mx-auto py-2">
            <CloudinarySettingsSection />
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCropper && tempImage && (
          <ImageCropperModal
            image={tempImage}
            onCancel={() => setShowCropper(false)}
            onDone={onCropComplete}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
