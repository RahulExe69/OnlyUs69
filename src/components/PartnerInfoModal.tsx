import React, { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Camera, Heart, UserCheck, Link2, ChevronRight, X, Check, Play, Film, Image as ImageIcon, ShieldCheck, Sparkles, ExternalLink, Cat } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { supabase } from '../lib/supabase';
import { UserProfile, Message, APP_VERSION, PetSettings } from '../types';
import { ThemeName, THEMES } from '../lib/themes';
import { useOverlayBack } from '../lib/overlayManager';
import { getLocalMedia } from '../lib/mediaStore';
import { hydrateMessageMedia } from '../lib/dateUtils';
import { ImageCropperModal } from './ImageCropperModal';
import { ThemeCustomizeSheet } from './ThemeCustomizePage';
import { E2EEVerificationModal } from './E2EEVerificationModal';

export const ProfileMediaThumbnail: React.FC<{
  item: { url: string; id?: string; fileName?: string; type: string };
  onClick: () => void;
}> = ({ item, onClick }) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(
    item.url && (item.url.startsWith('blob:') || item.url.startsWith('data:') || item.url.startsWith('http')) ? item.url : null
  );
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function resolve() {
      if (item.url && (item.url.startsWith('blob:') || item.url.startsWith('data:') || item.url.startsWith('http'))) {
        setResolvedUrl(item.url);
        return;
      }
      if (item.id) {
        const cached = await getLocalMedia(item.id);
        if (isMounted && cached) {
          setResolvedUrl(cached);
          return;
        }
      }
      if (item.url) {
        setResolvedUrl(item.url);
      }
    }
    resolve();
    return () => { isMounted = false; };
  }, [item.id, item.url]);

  if (hasError) return null;

  return (
    <div 
      onClick={() => {
        if (resolvedUrl) onClick();
      }}
      className="aspect-square bg-[var(--theme-bg)] rounded-xl overflow-hidden cursor-pointer hover:opacity-95 active:scale-[0.97] transition-all relative flex items-center justify-center border border-[var(--theme-border)]/40 group shadow-2xs"
    >
      {resolvedUrl ? (
        item.type === 'video' ? (
          <div className="w-full h-full relative bg-black/90 flex items-center justify-center">
            <video 
              src={resolvedUrl} 
              className="w-full h-full object-cover" 
              muted 
              playsInline 
              preload="metadata"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/40 transition-colors">
              <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-xs text-white flex items-center justify-center shadow-md">
                <Play className="w-4 h-4 fill-white ml-0.5" />
              </div>
            </div>
          </div>
        ) : (
          <img 
            src={resolvedUrl} 
            alt="" 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
            referrerPolicy="no-referrer" 
            loading="lazy"
            onError={() => setHasError(true)}
          />
        )
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-[var(--theme-bg)] text-[var(--theme-text)]/30">
          <ImageIcon className="w-6 h-6 opacity-40" />
        </div>
      )}
    </div>
  );
};

interface PartnerInfoModalProps {
  partner: UserProfile;
  myProfile: UserProfile | null;
  onClose: () => void;
  onViewImage: (url: string) => void;
  onPartnerUpdated?: (partner: UserProfile) => void;
  onMyProfileUpdated?: (me: UserProfile) => void;
  messages?: Message[];
  isPartnerOnline?: boolean;
  currentTheme?: ThemeName;
  onThemeSelect?: (theme: ThemeName) => Promise<void>;
  isThemeSaving?: boolean;
  petSettings?: PetSettings;
  onOpenPetSettings?: () => void;
}

export const PartnerInfoModal: React.FC<PartnerInfoModalProps> = ({
  partner,
  myProfile,
  onClose,
  onViewImage,
  onPartnerUpdated,
  onMyProfileUpdated,
  messages = [],
  isPartnerOnline = false,
  currentTheme = 'romantic',
  onThemeSelect,
  isThemeSaving = false,
  petSettings,
  onOpenPetSettings
}) => {
  const [view, setView] = useState<'main' | 'nicknames'>('main');
  const [activeMediaTab, setActiveMediaTab] = useState<'media' | 'reels' | 'links'>('media');
  
  // Custom Nicknames state
  const currentPartnerNickname = myProfile?.partnerNicknames?.[partner.uid] || partner.display_name || "";
  const currentMyNickname = myProfile?.display_name || "";
  
  const [editingTarget, setEditingTarget] = useState<'partner' | 'me' | null>(null);
  const [nicknameInput, setNicknameInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  
  // Option modals
  const [showCustomiseModal, setShowCustomiseModal] = useState(false);
  const [showWhoCanEditModal, setShowWhoCanEditModal] = useState(false);
  const [showE2EESheet, setShowE2EESheet] = useState(false);

  // Photo change logic
  const [showCropper, setShowCropper] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<'partner' | 'me'>('partner');
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Subview & overlay closers for PartnerInfoModal
  useOverlayBack(view === 'nicknames', () => setView('main'), 'partner-nicknames-view');
  useOverlayBack(showCustomiseModal, () => setShowCustomiseModal(false), 'partner-customise-theme');
  useOverlayBack(showWhoCanEditModal, () => setShowWhoCanEditModal(false), 'who-can-edit-modal');
  useOverlayBack(showE2EESheet, () => setShowE2EESheet(false), 'partner-e2ee-modal');
  useOverlayBack(!!editingTarget, () => setEditingTarget(null), 'edit-nickname-sheet');
  useOverlayBack(showCropper, () => setShowCropper(false), 'partner-photo-cropper');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handlePhotoSelect = (target: 'partner' | 'me') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCropTarget(target);
      const reader = new FileReader();
      reader.onload = () => {
        setTempImage(reader.result as string);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
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
      reader.onloadend = async () => {
        const compressedBase64 = reader.result as string;
        setShowCropper(false);
        setIsSaving(true);
        try {
          if (cropTarget === 'partner') {
            await supabase.from('users').update({
              photo_url: compressedBase64
            }).eq('role', partner.role);

            if (onPartnerUpdated) {
              onPartnerUpdated({ ...partner, photo_url: compressedBase64 });
            }
            showToast("Partner photo updated!");
          } else if (myProfile) {
            await supabase.from('users').update({
              photo_url: compressedBase64
            }).eq('id', myProfile.uid);

            if (onMyProfileUpdated) {
              onMyProfileUpdated({ ...myProfile, photo_url: compressedBase64 });
            }
            showToast("Profile photo updated!");
          }
        } catch (err) {
          console.error("Error updating photo:", err);
          showToast("Failed to save photo.");
        } finally {
          setIsSaving(false);
        }
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error(error);
      showToast("Failed to crop image.");
    }
  };

  const openEditNickname = (target: 'partner' | 'me') => {
    setEditingTarget(target);
    if (target === 'partner') {
      setNicknameInput(currentPartnerNickname);
    } else {
      setNicknameInput(currentMyNickname);
    }
  };

  const saveNickname = async () => {
    if (!editingTarget || !myProfile) return;
    setIsSaving(true);
    const newName = nicknameInput.trim();
    try {
      if (editingTarget === 'partner') {
        const updatedNicknames = { ...(myProfile.partnerNicknames || {}), [partner.uid]: newName };
        await supabase.from('users').update({
          partnerNicknames: updatedNicknames
        }).eq('id', myProfile.uid);

        await supabase.from('users').update({
          display_name: newName
        }).eq('role', partner.role);

        if (onPartnerUpdated) {
          onPartnerUpdated({ ...partner, display_name: newName });
        }
        showToast("Partner's nickname saved!");
      } else {
        await supabase.from('users').update({
          display_name: newName
        }).eq('id', myProfile.uid);

        if (onMyProfileUpdated) {
          onMyProfileUpdated({ ...myProfile, display_name: newName });
        }
        showToast("Your name updated!");
      }
      setEditingTarget(null);
    } catch (err) {
      console.error("Error saving nickname:", err);
      showToast("Failed to save nickname.");
    } finally {
      setIsSaving(false);
    }
  };

  const sharedPhotos = useMemo(() => {
    const photos: { url: string; id?: string; fileName?: string; type: string }[] = [];
    const role = myProfile?.role;
    
    messages.forEach((m: any) => {
      if (m.deleted) return;
      if (role === 'owner' && m.hidden_for_owner) return;
      if (role === 'partner' && m.hidden_for_partner) return;
      
      const media = m.media || hydrateMessageMedia(m);
      if (media?.mediaList && media.mediaList.length > 0) {
        media.mediaList.forEach((item: any) => {
          if (item.type === 'image') {
            const u = item.url || item.thumbnailUrl;
            if (u || item.id) {
              photos.push({ url: u || '', id: item.id, fileName: item.fileName, type: 'image' });
            }
          }
        });
      } else if (media?.type === 'image') {
        const u = media.url || media.thumbnailUrl;
        if (u || media.id) {
          photos.push({ url: u || '', id: media.id, fileName: media.fileName, type: 'image' });
        }
      } else if (m.attachment_url && typeof m.attachment_url === 'string') {
        if (m.attachment_url.startsWith('data:image') || m.attachment_url.startsWith('http') || m.attachment_url.startsWith('blob:')) {
          photos.push({ url: m.attachment_url, id: m.id, type: 'image' });
        }
      }
    });
    return photos;
  }, [messages, myProfile?.role]);

  const sharedVideos = useMemo(() => {
    const videos: { url: string; id?: string; fileName?: string; type: string }[] = [];
    const role = myProfile?.role;
    
    messages.forEach((m: any) => {
      if (m.deleted) return;
      if (role === 'owner' && m.hidden_for_owner) return;
      if (role === 'partner' && m.hidden_for_partner) return;
      
      const media = m.media || hydrateMessageMedia(m);
      if (media?.mediaList && media.mediaList.length > 0) {
        media.mediaList.forEach((item: any) => {
          if (item.type === 'video') {
            videos.push({ url: item.url || '', id: item.id, fileName: item.fileName, type: 'video' });
          }
        });
      } else if (media?.type === 'video') {
        videos.push({ url: media.url || '', id: media.id, fileName: media.fileName, type: 'video' });
      }
    });
    return videos;
  }, [messages, myProfile?.role]);

  const sharedLinks = useMemo(() => {
    const links: { url: string; text: string; date: string }[] = [];
    const role = myProfile?.role;
    const urlRegex = /(https?:\/\/[^\s]+)/gi;

    messages.forEach((m: any) => {
      if (m.deleted || !m.text) return;
      if (role === 'owner' && m.hidden_for_owner) return;
      if (role === 'partner' && m.hidden_for_partner) return;

      const matches = m.text.match(urlRegex);
      if (matches) {
        matches.forEach((url: string) => {
          links.push({ url, text: m.text, date: m.created_at });
        });
      }
    });
    return links;
  }, [messages, myProfile?.role]);

  const partnerHandle = partner.username || (partner.email ? partner.email.split('@')[0] : (partner.role === 'owner' ? 'rahul' : 'nusrat'));
  const myHandle = myProfile?.username || (myProfile?.email ? myProfile.email.split('@')[0] : (myProfile?.role === 'owner' ? 'rahul' : 'nusrat'));

  return (
    <div 
      className="theme-settings fixed inset-0 z-[110] flex flex-col bg-[var(--theme-surface)] text-[var(--theme-text)] overflow-hidden animate-in fade-in duration-100"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a1a]/90 backdrop-blur-md text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg pointer-events-none"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {view === 'main' ? (
        /* ==================== CLEAN PARTNER PROFILE VIEW ==================== */
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Top Bar */}
          <div className="h-14 flex-shrink-0 flex items-center justify-between px-4 border-b border-[var(--theme-border)]/40 bg-[var(--theme-surface)]">
            <button 
              onClick={onClose} 
              className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--theme-text)] hover:bg-[var(--theme-accent)]/10 active:scale-95 transition-all -ml-1 cursor-pointer"
              title="Back to chat"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
            </button>

            <h1 className="text-[16px] font-bold text-[var(--theme-text)] tracking-tight">
              Partner Profile
            </h1>

            <button
              type="button"
              onClick={() => setShowE2EESheet(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-emerald-600 hover:bg-emerald-500/10 active:scale-95 transition-all -mr-1 cursor-pointer"
              title="End-to-End Encrypted (Tap to verify)"
            >
              <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Centered Avatar and Name */}
            <div className="flex flex-col items-center pt-5 pb-5 px-4">
              <div className="relative group">
                <div 
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-[var(--theme-accent)]/30 shadow-md ring-4 ring-[var(--theme-accent)]/15 cursor-pointer active:scale-95 transition-transform bg-[var(--theme-surface)]"
                  onClick={() => partner.photo_url && onViewImage(partner.photo_url)}
                  title="View full photo"
                >
                  {partner.photo_url ? (
                    <img 
                      src={partner.photo_url} 
                      alt={currentPartnerNickname} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl sm:text-4xl font-bold text-[var(--theme-accent)] bg-[var(--theme-accent)]/10">
                      {currentPartnerNickname?.[0] || 'P'}
                    </div>
                  )}
                </div>

                {/* Direct Camera Button to update photo */}
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    photoInputRef.current?.click();
                  }}
                  title="Change photo"
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center border-2 border-[var(--theme-surface)] shadow-md hover:scale-105 active:scale-90 transition-transform cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input 
                  type="file" 
                  ref={photoInputRef} 
                  onChange={handlePhotoSelect('partner')} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>

              {/* Display Name directly below avatar */}
              <h2 className="text-[20px] sm:text-[22px] font-bold text-[var(--theme-text)] mt-3 text-center px-4 tracking-tight leading-snug break-words">
                {currentPartnerNickname}
              </h2>

              {/* Status / Role Row */}
              <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]">
                  Partner
                </span>
                {isPartnerOnline ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </span>
                ) : (
                  <span className="text-[11px] text-[var(--theme-text)]/50">
                    @{partnerHandle}
                  </span>
                )}
              </div>
            </div>

            {/* Settings Group */}
            <div className="px-4 mb-5">
              <div className="rounded-2xl bg-[var(--theme-bg)]/60 border border-[var(--theme-border)] overflow-hidden divide-y divide-[var(--theme-border)]/50 shadow-xs">
                {/* Theme Customization */}
                <button 
                  type="button"
                  onClick={() => setShowCustomiseModal(true)}
                  className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[var(--theme-accent)]/5 active:bg-[var(--theme-accent)]/10 transition-colors text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[var(--theme-accent)]/15 text-[var(--theme-accent)] flex items-center justify-center flex-shrink-0">
                      <Heart className="w-5 h-5 fill-[var(--theme-accent)]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-[var(--theme-text)] leading-tight">Chat Theme</p>
                      <p className="text-[12px] text-[var(--theme-text)]/60 mt-0.5 leading-tight truncate">
                        {THEMES[currentTheme || 'romantic']?.name || 'Theme'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--theme-text)]/40 group-hover:text-[var(--theme-text)]/70 transition-colors flex-shrink-0" />
                </button>

                {/* Nicknames */}
                <button 
                  type="button"
                  onClick={() => setView('nicknames')}
                  className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[var(--theme-accent)]/5 active:bg-[var(--theme-accent)]/10 transition-colors text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[var(--theme-text)]/10 text-[var(--theme-text)] flex items-center justify-center flex-shrink-0">
                      <UserCheck className="w-5 h-5 stroke-[2]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-[var(--theme-text)] leading-tight">Nicknames</p>
                      <p className="text-[12px] text-[var(--theme-text)]/60 mt-0.5 leading-tight">
                        Custom name for this chat
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--theme-text)]/40 group-hover:text-[var(--theme-text)]/70 transition-colors flex-shrink-0" />
                </button>

                {/* Chat Pet Companion */}
                {onOpenPetSettings && (
                  <button 
                    type="button"
                    onClick={onOpenPetSettings}
                    className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[var(--theme-accent)]/5 active:bg-[var(--theme-accent)]/10 transition-colors text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[var(--theme-accent)]/15 text-[var(--theme-accent)] flex items-center justify-center flex-shrink-0 shadow-xs">
                        <Cat className="w-5 h-5 text-[var(--theme-accent)]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-[var(--theme-text)] leading-tight">Pet</p>
                        <p className="text-[12px] text-[var(--theme-text)]/60 mt-0.5 leading-tight">
                          {petSettings?.name || 'Mochi'} • {petSettings?.enabled ? 'Active in chat' : 'Resting'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--theme-text)]/40 group-hover:text-[var(--theme-text)]/70 transition-colors flex-shrink-0" />
                  </button>
                )}
              </div>
            </div>

            {/* Shared Media Section */}
            <div className="px-4 pb-8">
              {/* Section Header */}
              <div className="flex items-center justify-between mb-2.5 px-1">
                <h3 className="text-[14px] font-bold tracking-tight text-[var(--theme-text)]">
                  Shared Content
                </h3>
                <span className="text-[11px] font-medium text-[var(--theme-text)]/50">
                  {sharedPhotos.length + sharedVideos.length + sharedLinks.length} items
                </span>
              </div>

              {/* Segmented Tab Bar */}
              <div className="p-1 rounded-xl bg-[var(--theme-bg)]/80 border border-[var(--theme-border)] flex gap-1 mb-3">
                <button 
                  onClick={() => setActiveMediaTab('media')}
                  className={`flex-1 py-2 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeMediaTab === 'media'
                      ? 'bg-[var(--theme-surface)] text-[var(--theme-text)] shadow-xs'
                      : 'text-[var(--theme-text)]/60 hover:text-[var(--theme-text)]'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Photos</span>
                  <span className="text-[10px] opacity-60">({sharedPhotos.length})</span>
                </button>
                <button 
                  onClick={() => setActiveMediaTab('reels')}
                  className={`flex-1 py-2 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeMediaTab === 'reels'
                      ? 'bg-[var(--theme-surface)] text-[var(--theme-text)] shadow-xs'
                      : 'text-[var(--theme-text)]/60 hover:text-[var(--theme-text)]'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Videos</span>
                  <span className="text-[10px] opacity-60">({sharedVideos.length})</span>
                </button>
                <button 
                  onClick={() => setActiveMediaTab('links')}
                  className={`flex-1 py-2 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeMediaTab === 'links'
                      ? 'bg-[var(--theme-surface)] text-[var(--theme-text)] shadow-xs'
                      : 'text-[var(--theme-text)]/60 hover:text-[var(--theme-text)]'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Links</span>
                  <span className="text-[10px] opacity-60">({sharedLinks.length})</span>
                </button>
              </div>

              {/* Photos Tab Content */}
              {activeMediaTab === 'media' && (
                <div>
                  {sharedPhotos.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {sharedPhotos.map((photoItem, idx) => (
                        <ProfileMediaThumbnail 
                          key={photoItem.id || idx}
                          item={photoItem}
                          onClick={() => onViewImage(photoItem.url)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 px-4 text-center rounded-2xl bg-[var(--theme-bg)]/40 border border-dashed border-[var(--theme-border)]/60">
                      <div className="w-10 h-10 rounded-full bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] flex items-center justify-center mx-auto mb-2.5">
                        <ImageIcon className="w-5 h-5 stroke-[1.8]" />
                      </div>
                      <p className="text-[13px] font-semibold text-[var(--theme-text)]">No shared photos</p>
                      <p className="text-[11px] text-[var(--theme-text)]/50 mt-0.5">Photos sent in this chat will appear here.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Videos Tab Content */}
              {activeMediaTab === 'reels' && (
                <div>
                  {sharedVideos.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {sharedVideos.map((videoItem, idx) => (
                        <ProfileMediaThumbnail 
                          key={videoItem.id || idx}
                          item={videoItem}
                          onClick={() => onViewImage(videoItem.url)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 px-4 text-center rounded-2xl bg-[var(--theme-bg)]/40 border border-dashed border-[var(--theme-border)]/60">
                      <div className="w-10 h-10 rounded-full bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] flex items-center justify-center mx-auto mb-2.5">
                        <Film className="w-5 h-5 stroke-[1.8]" />
                      </div>
                      <p className="text-[13px] font-semibold text-[var(--theme-text)]">No shared videos</p>
                      <p className="text-[11px] text-[var(--theme-text)]/50 mt-0.5">Videos sent in this chat will appear here.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Links Tab Content */}
              {activeMediaTab === 'links' && (
                <div>
                  {sharedLinks.length > 0 ? (
                    <div className="space-y-2">
                      {sharedLinks.map((linkItem, idx) => (
                        <a 
                          key={idx}
                          href={linkItem.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-xl bg-[var(--theme-bg)]/60 hover:bg-[var(--theme-accent)]/5 border border-[var(--theme-border)]/60 transition-colors text-left group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] flex items-center justify-center flex-shrink-0">
                            <Link2 className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-[var(--theme-accent)] truncate group-hover:underline">
                              {linkItem.url}
                            </p>
                            <p className="text-[11px] text-[var(--theme-text)]/60 truncate mt-0.5">
                              {linkItem.text}
                            </p>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-[var(--theme-text)]/30 group-hover:text-[var(--theme-text)]/70 flex-shrink-0" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 px-4 text-center rounded-2xl bg-[var(--theme-bg)]/40 border border-dashed border-[var(--theme-border)]/60">
                      <div className="w-10 h-10 rounded-full bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] flex items-center justify-center mx-auto mb-2.5">
                        <Link2 className="w-5 h-5 stroke-[1.8]" />
                      </div>
                      <p className="text-[13px] font-semibold text-[var(--theme-text)]">No links shared</p>
                      <p className="text-[11px] text-[var(--theme-text)]/50 mt-0.5">Shared web links in your chat will appear here.</p>
                    </div>
                  )}
                </div>
              )}

              {/* App Version Info */}
              <div className="pt-6 pb-2 text-center select-none">
                <p className="text-[11px] font-mono text-[var(--theme-text)]/40 tracking-wider">
                  OnlyUs v{APP_VERSION} • Private 1-to-1
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ==================== NICKNAMES SUB-VIEW ==================== */
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--theme-surface)] text-[var(--theme-text)]">
          {/* Top Bar with Title */}
          <div className="h-14 flex-shrink-0 flex items-center px-4 border-b border-[var(--theme-border)]/40 bg-[var(--theme-surface)]">
            <button 
              onClick={() => setView('main')} 
              className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--theme-text)] hover:bg-[var(--theme-accent)]/10 active:scale-95 transition-all -ml-1 cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
            </button>
            <h1 className="text-[16px] font-bold text-[var(--theme-text)] ml-3 tracking-tight">
              Nicknames
            </h1>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4">
            <div className="py-2 text-center">
              <p className="text-[12px] text-[var(--theme-text)]/60">
                Nicknames are displayed only in your private chat.
              </p>
              <button 
                type="button"
                onClick={() => setShowWhoCanEditModal(true)}
                className="text-[12px] text-[var(--theme-accent)] font-semibold mt-1 hover:underline active:opacity-70 transition-opacity cursor-pointer"
              >
                Change who can edit nicknames
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-[var(--theme-bg)]/60 border border-[var(--theme-border)] overflow-hidden divide-y divide-[var(--theme-border)]/50 shadow-xs">
              {/* Member 1: Rahul / Owner / Me */}
              <button 
                type="button"
                onClick={() => openEditNickname('me')}
                className="w-full p-4 flex items-center justify-between hover:bg-[var(--theme-accent)]/5 active:bg-[var(--theme-accent)]/10 transition-colors text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-[var(--theme-accent)]/15 border-2 border-[var(--theme-accent)]/30 ring-2 ring-[var(--theme-accent)]/15 flex-shrink-0">
                    {myProfile?.photo_url ? (
                      <img 
                        src={myProfile.photo_url} 
                        alt={currentMyNickname} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-[var(--theme-accent)] text-lg">
                        {currentMyNickname?.[0] || 'R'}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[var(--theme-text)] leading-snug truncate">
                      {currentMyNickname || "Rahul"}
                    </p>
                    <p className="text-[12px] text-[var(--theme-text)]/60 leading-tight truncate mt-0.5">
                      @{myHandle}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--theme-text)]/40 group-hover:text-[var(--theme-text)]/70 transition-colors flex-shrink-0" />
              </button>

              {/* Member 2: Partner / Nusrat */}
              <button 
                type="button"
                onClick={() => openEditNickname('partner')}
                className="w-full p-4 flex items-center justify-between hover:bg-[var(--theme-accent)]/5 active:bg-[var(--theme-accent)]/10 transition-colors text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden bg-[var(--theme-accent)]/15 border-2 border-[var(--theme-accent)]/30 ring-2 ring-[var(--theme-accent)]/15 flex-shrink-0">
                    {partner.photo_url ? (
                      <img 
                        src={partner.photo_url} 
                        alt={currentPartnerNickname} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-[var(--theme-accent)] text-lg">
                        {currentPartnerNickname?.[0] || 'N'}
                      </div>
                    )}
                    {isPartnerOnline && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[var(--theme-surface)] rounded-full" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[var(--theme-text)] leading-snug truncate">
                      {currentPartnerNickname || "Nusrat"}
                    </p>
                    <p className="text-[12px] text-[var(--theme-text)]/60 leading-tight truncate mt-0.5">
                      @{partnerHandle}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--theme-text)]/40 group-hover:text-[var(--theme-text)]/70 transition-colors flex-shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Nickname Bottom Sheet */}
      <AnimatePresence>
        {editingTarget && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingTarget(null)}
              className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[130] bg-[var(--theme-surface)] text-[var(--theme-text)] rounded-t-3xl p-5 pb-8 max-w-md mx-auto shadow-2xl border-t border-[var(--theme-border)]"
            >
              <div className="w-10 h-1 bg-[var(--theme-text)]/20 rounded-full mx-auto mb-4" />
              
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[var(--theme-text)]">
                  Edit Nickname for {editingTarget === 'partner' ? 'Partner' : 'You'}
                </h3>
                <button 
                  onClick={() => setEditingTarget(null)}
                  className="p-1 text-[var(--theme-text)]/40 hover:text-[var(--theme-text)] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative mb-3">
                <input 
                  type="text"
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  placeholder="Enter nickname..."
                  autoFocus
                  className="w-full bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-xl px-4 py-3 text-[15px] font-medium text-[var(--theme-text)] focus:outline-none focus:border-[var(--theme-accent)] pr-10"
                />
                {nicknameInput && (
                  <button 
                    type="button"
                    onClick={() => setNicknameInput("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[var(--theme-text)]/20 text-[var(--theme-text)] flex items-center justify-center hover:bg-[var(--theme-text)]/30 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto py-1 mb-4 no-scrollbar">
                {['🥺', '🫶🏻', '💋', '💖', '🥰', '🍯', '🧸', '👑', '✨', '🤍'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNicknameInput(prev => prev + emoji)}
                    className="w-9 h-9 rounded-full bg-[var(--theme-bg)] hover:bg-[var(--theme-accent)]/15 border border-[var(--theme-border)]/50 flex items-center justify-center text-lg active:scale-95 transition-transform flex-shrink-0 cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <button 
                type="button"
                onClick={saveNickname}
                disabled={isSaving}
                className="w-full h-12 bg-[var(--theme-accent)] hover:opacity-90 text-white font-bold rounded-xl text-[15px] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center shadow-md cursor-pointer"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ThemeCustomizeSheet
        isOpen={showCustomiseModal}
        onClose={() => setShowCustomiseModal(false)}
        currentTheme={currentTheme}
        onThemeSelect={async (theme) => {
          if (!onThemeSelect) return;
          await onThemeSelect(theme);
        }}
        isThemeSaving={isThemeSaving}
        partnerProfile={partner}
        userProfile={myProfile}
      />

      <AnimatePresence>
        {showWhoCanEditModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWhoCanEditModal(false)}
              className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[130] bg-[var(--theme-surface)] text-[var(--theme-text)] rounded-t-3xl p-6 pb-8 max-w-md mx-auto shadow-2xl border-t border-[var(--theme-border)]"
            >
              <div className="w-10 h-1 bg-[var(--theme-text)]/20 rounded-full mx-auto mb-4" />
              <h3 className="text-base font-bold text-[var(--theme-text)] mb-2">
                Who can edit nicknames
              </h3>
              <p className="text-[13px] text-[var(--theme-text)]/60 mb-4">
                In OnlyUs, both Rahul and Nusrat have equal permissions to edit nicknames anytime.
              </p>
              <div className="p-4 bg-[var(--theme-bg)]/80 rounded-2xl flex items-center justify-between border border-[var(--theme-border)]">
                <span className="text-[14px] font-semibold text-[var(--theme-text)]">Everyone in this chat</span>
                <Check className="w-5 h-5 text-[var(--theme-accent)]" />
              </div>
              <button 
                onClick={() => setShowWhoCanEditModal(false)}
                className="mt-5 w-full h-11 bg-[var(--theme-accent)] hover:opacity-90 text-white font-bold rounded-xl text-sm active:scale-95 transition-all cursor-pointer"
              >
                Done
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCropper && tempImage && (
          <ImageCropperModal 
            image={tempImage} 
            onCancel={() => setShowCropper(false)} 
            onDone={onCropComplete} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showE2EESheet && (
          <E2EEVerificationModal 
            myProfile={myProfile} 
            partnerProfile={partner} 
            onClose={() => setShowE2EESheet(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};
