import React, { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Camera, Heart, UserCheck, LayoutGrid, Repeat, Link2, ChevronRight, X, Check, Play, Film, Image as ImageIcon } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { supabase } from '../lib/supabase';
import { UserProfile, Message } from '../types';
import { ThemeName } from '../lib/themes';
import { useOverlayBack } from '../lib/overlayManager';
import { getLocalMedia } from '../lib/mediaStore';
import { hydrateMessageMedia } from '../lib/dateUtils';
import { ImageCropperModal } from './ImageCropperModal';
import { ThemeCustomizeSheet } from './ThemeCustomizePage';

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
      className="aspect-square bg-neutral-100 overflow-hidden cursor-pointer hover:opacity-90 active:scale-95 transition-all relative flex items-center justify-center group"
    >
      {resolvedUrl ? (
        item.type === 'video' ? (
          <div className="w-full h-full relative bg-black flex items-center justify-center">
            <video 
              src={resolvedUrl} 
              className="w-full h-full object-cover" 
              muted 
              playsInline 
              preload="metadata"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center shadow">
                <Play className="w-4 h-4 fill-white ml-0.5" />
              </div>
            </div>
          </div>
        ) : (
          <img 
            src={resolvedUrl} 
            alt="" 
            className="w-full h-full object-cover" 
            referrerPolicy="no-referrer" 
            loading="lazy"
            onError={() => setHasError(true)}
          />
        )
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-300">
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
  isThemeSaving = false
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

  // Photo change logic
  const [showCropper, setShowCropper] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<'partner' | 'me'>('partner');
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Subview & overlay closers for PartnerInfoModal
  useOverlayBack(view === 'nicknames', () => setView('main'), 'partner-nicknames-view');
  useOverlayBack(showCustomiseModal, () => setShowCustomiseModal(false), 'partner-customise-theme');
  useOverlayBack(showWhoCanEditModal, () => setShowWhoCanEditModal(false), 'who-can-edit-modal');
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
        /* ==================== INSTAGRAM PARTNER PROFILE VIEW ==================== */
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Instagram Top Bar */}
          <div className="h-14 flex-shrink-0 flex items-center px-4">
            <button 
              onClick={onClose} 
              className="p-1 -ml-1 text-[#111111] hover:opacity-70 transition-opacity active:scale-95"
            >
              <ArrowLeft className="w-6 h-6 stroke-[2]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Centered Avatar and Name */}
            <div className="flex flex-col items-center pt-2 pb-6 px-4">
              <div className="relative group">
                <div 
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-[var(--theme-accent)]/30 shadow-sm ring-4 ring-[var(--theme-accent)]/15 cursor-pointer active:scale-95 transition-transform bg-[var(--theme-surface)]"
                  onClick={() => partner.photo_url && onViewImage(partner.photo_url)}
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
                  title="Change partner's photo"
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center border-2 border-[var(--theme-surface)] shadow-md hover:scale-105 active:scale-90 transition-transform"
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
              <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mt-3.5 text-center px-4 tracking-tight leading-snug break-words">
                {currentPartnerNickname}
              </h2>
            </div>

            {/* Instagram Options List */}
            <div className="border-t border-b border-neutral-100 py-1">
              <button 
                type="button"
                onClick={() => setShowCustomiseModal(true)}
                className="w-full px-5 py-3.5 flex items-center gap-3.5 hover:bg-neutral-50 active:bg-neutral-100 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-white shadow-sm flex-shrink-0">
                  <Heart className="w-4 h-4 fill-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-[#111111] leading-tight">Customise</p>
                  <p className="text-[12px] text-[#737373] mt-0.5 leading-tight">Theme</p>
                </div>
              </button>

              <button 
                type="button"
                onClick={() => setView('nicknames')}
                className="w-full px-5 py-3.5 flex items-center gap-3.5 hover:bg-neutral-50 active:bg-neutral-100 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center text-[#111111] flex-shrink-0">
                  <UserCheck className="w-4 h-4 stroke-[2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-[#111111] leading-tight">Nicknames</p>
                </div>
              </button>
            </div>

            {/* Media Tabs Section */}
            <div className="mt-2">
              <div className="grid grid-cols-3 border-b border-neutral-200 text-neutral-400">
                <button 
                  onClick={() => setActiveMediaTab('media')}
                  className={`py-3 flex items-center justify-center transition-colors relative ${activeMediaTab === 'media' ? 'text-[#111111]' : 'hover:text-neutral-600'}`}
                >
                  <LayoutGrid className="w-5 h-5 stroke-[1.75]" />
                  {activeMediaTab === 'media' && (
                    <motion.div layoutId="igTabIndicator" className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#111111]" />
                  )}
                </button>
                <button 
                  onClick={() => setActiveMediaTab('reels')}
                  className={`py-3 flex items-center justify-center transition-colors relative ${activeMediaTab === 'reels' ? 'text-[#111111]' : 'hover:text-neutral-600'}`}
                >
                  <Repeat className="w-5 h-5 stroke-[1.75]" />
                  {activeMediaTab === 'reels' && (
                    <motion.div layoutId="igTabIndicator" className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#111111]" />
                  )}
                </button>
                <button 
                  onClick={() => setActiveMediaTab('links')}
                  className={`py-3 flex items-center justify-center transition-colors relative ${activeMediaTab === 'links' ? 'text-[#111111]' : 'hover:text-neutral-600'}`}
                >
                  <Link2 className="w-5 h-5 stroke-[1.75]" />
                  {activeMediaTab === 'links' && (
                    <motion.div layoutId="igTabIndicator" className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#111111]" />
                  )}
                </button>
              </div>

              {/* Media Grid Tab Content */}
              {activeMediaTab === 'media' && (
                <div className="p-1">
                  {sharedPhotos.length > 0 ? (
                    <div className="grid grid-cols-3 gap-1">
                      {sharedPhotos.map((photoItem, idx) => (
                        <ProfileMediaThumbnail 
                          key={photoItem.id || idx}
                          item={photoItem}
                          onClick={() => onViewImage(photoItem.url)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="py-16 text-center text-neutral-400">
                      <div className="w-12 h-12 rounded-full border border-neutral-300 flex items-center justify-center mx-auto mb-3 text-neutral-400">
                        <Camera className="w-5 h-5 stroke-[1.5]" />
                      </div>
                      <p className="text-[14px] font-semibold text-neutral-700">No photos shared yet</p>
                      <p className="text-[12px] text-neutral-400 mt-1">Photos you share in this chat will appear here.</p>
                    </div>
                  )}
                </div>
              )}

              {activeMediaTab === 'reels' && (
                <div className="p-1">
                  {sharedVideos.length > 0 ? (
                    <div className="grid grid-cols-3 gap-1">
                      {sharedVideos.map((videoItem, idx) => (
                        <ProfileMediaThumbnail 
                          key={videoItem.id || idx}
                          item={videoItem}
                          onClick={() => onViewImage(videoItem.url)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="py-16 text-center text-neutral-400">
                      <div className="w-12 h-12 rounded-full border border-neutral-300 flex items-center justify-center mx-auto mb-3 text-neutral-400">
                        <Film className="w-5 h-5 stroke-[1.5]" />
                      </div>
                      <p className="text-[14px] font-semibold text-neutral-700">No videos shared yet</p>
                      <p className="text-[12px] text-neutral-400 mt-1">Videos you share in this chat will appear here.</p>
                    </div>
                  )}
                </div>
              )}

              {activeMediaTab === 'links' && (
                <div className="p-3">
                  {sharedLinks.length > 0 ? (
                    <div className="space-y-2">
                      {sharedLinks.map((linkItem, idx) => (
                        <a 
                          key={idx}
                          href={linkItem.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200/60 transition-colors text-left group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] flex items-center justify-center flex-shrink-0">
                            <Link2 className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-blue-600 truncate group-hover:underline">
                              {linkItem.url}
                            </p>
                            <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                              {linkItem.text}
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="py-16 text-center text-neutral-400">
                      <div className="w-12 h-12 rounded-full border border-neutral-300 flex items-center justify-center mx-auto mb-3 text-neutral-400">
                        <Link2 className="w-5 h-5 stroke-[1.5]" />
                      </div>
                      <p className="text-[14px] font-semibold text-neutral-700">No links shared</p>
                      <p className="text-[12px] text-neutral-400 mt-1">Shared web links in your chat will appear here.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ==================== NICKNAMES SUB-VIEW ==================== */
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
          {/* Top Bar with Title */}
          <div className="h-14 flex-shrink-0 flex items-center px-4 border-b border-neutral-100">
            <button 
              onClick={() => setView('main')} 
              className="p-1 -ml-1 text-[#111111] hover:opacity-70 transition-opacity active:scale-95"
            >
              <ArrowLeft className="w-6 h-6 stroke-[2]" />
            </button>
            <h1 className="text-[18px] font-bold text-[#111111] ml-4">
              Nicknames
            </h1>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3">
            <div className="py-2 text-center">
              <p className="text-[13px] text-[#737373]">
                Nicknames are only displayed in this chat.
              </p>
              <button 
                type="button"
                onClick={() => setShowWhoCanEditModal(true)}
                className="text-[13px] text-[#0095F6] font-semibold mt-1 hover:underline active:opacity-70 transition-opacity"
              >
                Change who can edit your nickname
              </button>
            </div>

            <div className="mt-4 space-y-1">
              {/* Member 1: Rahul / Owner / Me */}
              <button 
                type="button"
                onClick={() => openEditNickname('me')}
                className="w-full py-3.5 flex items-center justify-between hover:bg-neutral-50 active:bg-neutral-100 rounded-xl px-2 transition-colors text-left"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-13 h-13 rounded-full overflow-hidden bg-[var(--theme-accent)]/15 border-2 border-[var(--theme-accent)]/30 ring-2 ring-[var(--theme-accent)]/15 flex-shrink-0">
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
                    <p className="text-[15px] font-semibold text-[#111111] leading-snug truncate">
                      {currentMyNickname || "Rahul"}
                    </p>
                    <p className="text-[13px] text-[#737373] leading-tight truncate">
                      {myHandle}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-neutral-400 flex-shrink-0" />
              </button>

              {/* Member 2: Partner / Nusrat */}
              <button 
                type="button"
                onClick={() => openEditNickname('partner')}
                className="w-full py-3.5 flex items-center justify-between hover:bg-neutral-50 active:bg-neutral-100 rounded-xl px-2 transition-colors text-left"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative w-13 h-13 rounded-full overflow-hidden bg-[var(--theme-accent)]/15 border-2 border-[var(--theme-accent)]/30 ring-2 ring-[var(--theme-accent)]/15 flex-shrink-0">
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
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#4ade80] border-2 border-[var(--theme-surface)] rounded-full" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[#111111] leading-snug truncate">
                      {currentPartnerNickname || "Nusrat"}
                    </p>
                    <p className="text-[13px] text-[#737373] leading-tight truncate">
                      {partnerHandle}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-neutral-400 flex-shrink-0" />
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
              className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[130] bg-white rounded-t-3xl p-5 pb-8 max-w-md mx-auto shadow-2xl"
            >
              <div className="w-10 h-1 bg-neutral-300 rounded-full mx-auto mb-4" />
              
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#111111]">
                  Edit Nickname for {editingTarget === 'partner' ? 'Partner' : 'You'}
                </h3>
                <button 
                  onClick={() => setEditingTarget(null)}
                  className="p-1 text-neutral-400 hover:text-neutral-700"
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
                  className="w-full bg-neutral-100 border border-neutral-200 rounded-xl px-4 py-3 text-[15px] font-medium text-[#111111] focus:outline-none focus:border-[#0095F6] pr-10"
                />
                {nicknameInput && (
                  <button 
                    type="button"
                    onClick={() => setNicknameInput("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-neutral-300 text-white flex items-center justify-center hover:bg-neutral-400"
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
                    className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-lg active:scale-95 transition-transform flex-shrink-0"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <button 
                type="button"
                onClick={saveNickname}
                disabled={isSaving}
                className="w-full h-12 bg-[#0095F6] hover:bg-[#1877F2] text-white font-bold rounded-xl text-[15px] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center shadow-md shadow-[#0095F6]/20"
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
      />

      <AnimatePresence>
        {showWhoCanEditModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWhoCanEditModal(false)}
              className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[130] bg-white rounded-t-3xl p-6 pb-8 max-w-md mx-auto shadow-2xl"
            >
              <div className="w-10 h-1 bg-neutral-300 rounded-full mx-auto mb-4" />
              <h3 className="text-base font-bold text-[#111111] mb-2">
                Who can edit nicknames
              </h3>
              <p className="text-[13px] text-neutral-500 mb-4">
                In OnlyUs, both Rahul and Nusrat have equal permissions to edit nicknames anytime.
              </p>
              <div className="p-4 bg-neutral-50 rounded-2xl flex items-center justify-between border border-neutral-200">
                <span className="text-[14px] font-semibold text-neutral-800">Everyone in this chat</span>
                <Check className="w-5 h-5 text-[#0095F6]" />
              </div>
              <button 
                onClick={() => setShowWhoCanEditModal(false)}
                className="mt-5 w-full h-11 bg-[#0095F6] text-white font-bold rounded-xl text-sm active:scale-95 transition-all"
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
    </div>
  );
};
