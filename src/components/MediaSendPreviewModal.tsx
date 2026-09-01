import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, FileAudio, FileText } from 'lucide-react';
import { formatFileSize } from '../lib/mediaStore';

interface MediaSendPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  previewUrl: string | null;
  mediaType: 'image' | 'video' | 'audio' | 'file';
  recipientName: string;
  onSend: (caption: string) => void;
  isSending: boolean;
  uploadProgress: number;
  uploadError?: string | null;
}

export const MediaSendPreviewModal: React.FC<MediaSendPreviewModalProps> = ({
  isOpen,
  onClose,
  file,
  previewUrl,
  mediaType,
  recipientName,
  onSend,
  isSending,
  uploadProgress,
  uploadError
}) => {
  const [caption, setCaption] = useState('');

  if (!isOpen || !previewUrl) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending) return;
    onSend(caption.trim());
    setCaption('');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[160] flex flex-col bg-black/95 text-white backdrop-blur-xl">
        {/* Top bar */}
        <div className="h-16 px-4 flex items-center justify-between z-20">
          <button 
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white/80"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Send to {recipientName}
            </span>
            {file && (
              <span className="text-[10px] text-white/60 font-medium">
                {formatFileSize(file.size)}
              </span>
            )}
          </div>

          <div className="w-10" />
        </div>

        {/* Center Preview */}
        <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
          {mediaType === 'image' ? (
            <img 
              src={previewUrl} 
              alt="Preview" 
              className="max-h-[65vh] max-w-full object-contain rounded-2xl shadow-2xl"
            />
          ) : mediaType === 'video' ? (
            <video 
              src={previewUrl} 
              controls 
              playsInline 
              className="max-h-[65vh] max-w-full rounded-2xl shadow-2xl"
            />
          ) : mediaType === 'audio' ? (
            <div className="w-full max-w-md rounded-2xl bg-white/10 p-8 text-center"><FileAudio className="w-14 h-14 mx-auto mb-4 text-[var(--theme-accent)]" /><p className="mb-5 font-semibold break-all">{file?.name}</p><audio src={previewUrl} controls className="w-full" /></div>
          ) : (
            <div className="w-full max-w-md rounded-2xl bg-white/10 p-8 text-center"><FileText className="w-14 h-14 mx-auto mb-4 text-[var(--theme-accent)]" /><p className="font-semibold break-all">{file?.name}</p><p className="mt-2 text-sm text-white/60">This file will be sent as an attachment.</p></div>
          )}
        </div>

        {/* Bottom Caption Input & Send Button */}
        <form onSubmit={handleSubmit} className="p-4 pb-8 max-w-xl w-full mx-auto flex items-center gap-3">
          {isSending && <div className="absolute bottom-24 left-6 right-6 mx-auto max-w-xl"><div className="mb-1 flex justify-between text-xs font-bold text-white"><span>Sending media</span><span>{uploadProgress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full bg-[var(--theme-accent)] transition-all" style={{ width: `${uploadProgress}%` }} /></div></div>}
          {uploadError && <p role="alert" className="absolute bottom-24 left-6 right-6 mx-auto max-w-xl rounded-xl bg-red-500/90 px-3 py-2 text-xs font-semibold text-white">{uploadError}</p>}
          <input 
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption..."
            disabled={isSending}
            autoFocus
            className="flex-1 px-5 py-3.5 bg-white/10 text-white placeholder-white/40 border border-white/20 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)] transition-all"
          />
          <button 
            type="submit"
            disabled={isSending}
            className="w-12 h-12 flex-shrink-0 rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isSending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5 fill-white ml-0.5" />
            )}
          </button>
        </form>
      </div>
    </AnimatePresence>
  );
};
