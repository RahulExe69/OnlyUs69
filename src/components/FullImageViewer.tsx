import React from 'react';
import { motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';

interface FullImageViewerProps {
  url: string;
  onClose: () => void;
}

export const FullImageViewer: React.FC<FullImageViewerProps> = ({ url, onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button className="absolute top-6 left-6 p-3 text-white bg-white/10 rounded-full backdrop-blur-md">
        <ChevronLeft className="w-6 h-6" />
      </button>
      <motion.img
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        src={url}
        alt="Full view"
        className="max-w-full max-h-full object-contain rounded-xl"
        referrerPolicy="no-referrer"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        style={{ WebkitTouchCallout: 'none' }}
      />
    </motion.div>
  );
};
