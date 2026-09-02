import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Play, FileVideo, Image as ImageIcon, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatFileSize } from '../lib/mediaStore';

export interface SelectedMediaFile {
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
}

interface MediaSendPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: SelectedMediaFile[];
  recipientName: string;
  onSend: (caption: string, files: SelectedMediaFile[]) => void;
  onAddMoreFiles?: (newFiles: FileList | null) => void;
  isSending: boolean;
}

export const MediaSendPreviewModal: React.FC<MediaSendPreviewModalProps> = ({
  isOpen,
  onClose,
  files,
  recipientName,
  onSend,
  onAddMoreFiles,
  isSending
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [caption, setCaption] = useState('');

  // Clean up object URLs when modal is closed or unmounted
  useEffect(() => {
    return () => {
      files.forEach((f) => {
        if (f.previewUrl && f.previewUrl.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(f.previewUrl);
          } catch (_) {}
        }
      });
    };
  }, [files]);

  useEffect(() => {
    if (files.length > 0 && selectedIndex >= files.length) {
      setSelectedIndex(0);
    }
  }, [files.length, selectedIndex]);

  if (!isOpen || files.length === 0) return null;

  const currentFile = files[selectedIndex] || files[0];

  const totalSize = files.reduce((acc, f) => acc + (f.file?.size || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending) return;
    onSend(caption.trim(), files);
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
              Send to {recipientName} {files.length > 1 && `(${files.length} items)`}
            </span>
            <span className="text-[10px] text-white/60 font-medium">
              {formatFileSize(totalSize)}
            </span>
          </div>

          <div className="w-10" />
        </div>

        {/* Center Preview */}
        <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
          {/* Previous / Next buttons if multiple files */}
          {files.length > 1 && selectedIndex > 0 && (
            <button
              type="button"
              onClick={() => setSelectedIndex(i => i - 1)}
              className="absolute left-3 z-30 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 active:scale-95 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {files.length > 1 && selectedIndex < files.length - 1 && (
            <button
              type="button"
              onClick={() => setSelectedIndex(i => i + 1)}
              className="absolute right-3 z-30 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 active:scale-95 transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {currentFile.type === 'image' ? (
            <img 
              src={currentFile.previewUrl} 
              alt="Preview" 
              className="max-h-[58vh] max-w-full object-contain rounded-2xl shadow-2xl transition-all"
            />
          ) : (
            <video 
              src={currentFile.previewUrl} 
              controls 
              playsInline 
              className="max-h-[58vh] max-w-full rounded-2xl shadow-2xl"
            />
          )}
        </div>

        {/* Thumbnail Selector Strip for Multiple Photos */}
        {files.length > 1 && (
          <div className="flex items-center justify-center gap-2 px-4 py-2 bg-black/50 overflow-x-auto max-w-full">
            {files.map((item, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedIndex(idx)}
                className={`relative w-12 h-12 rounded-xl overflow-hidden cursor-pointer border-2 transition-all flex-shrink-0 ${
                  idx === selectedIndex ? 'border-[var(--theme-accent)] scale-105 opacity-100 shadow-md' : 'border-transparent opacity-50 hover:opacity-80'
                }`}
              >
                <img src={item.previewUrl} alt="thumb" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* Bottom Caption Input & Send Button */}
        <form onSubmit={handleSubmit} className="p-4 pb-8 max-w-xl w-full mx-auto flex items-center gap-3">
          <input 
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={files.length > 1 ? `Add a caption for ${files.length} items...` : "Add a caption..."}
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
