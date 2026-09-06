import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Message, UserProfile } from '../types';

export interface DeleteChoicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMessages: Message[];
  userProfile: UserProfile | null;
  onDeleteSelected: (forEveryone: boolean) => Promise<void> | void;
}

export const DeleteChoicesModal: React.FC<DeleteChoicesModalProps> = ({
  isOpen,
  onClose,
  selectedMessages,
  userProfile,
  onDeleteSelected,
}) => {
  const canDeleteForEveryone =
    selectedMessages.length > 0 &&
    selectedMessages.every(
      (m) => m.sender_role === userProfile?.role && !m.deleted
    );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="relative w-full max-w-sm bg-white rounded-[2rem] p-6 shadow-2xl space-y-3"
          >
            <h3 className="text-sm font-bold text-center text-[#FF8FA3] uppercase tracking-widest mb-4">
              Delete Message?
            </h3>

            <button
              onClick={() => onDeleteSelected(false)}
              className="w-full py-4 text-sm font-bold text-red-400 hover:bg-red-50 rounded-2xl transition-colors cursor-pointer"
            >
              Delete for me
            </button>

            {canDeleteForEveryone && (
              <button
                onClick={() => onDeleteSelected(true)}
                className="w-full py-4 text-sm font-bold text-red-400 hover:bg-red-50 rounded-2xl transition-colors cursor-pointer"
              >
                Delete for everyone
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full py-4 text-sm font-bold text-[#6E6E6E] border border-[#FF8FA3]/10 rounded-2xl transition-colors active:bg-[#FFD6C9]/10 cursor-pointer"
            >
              Cancel
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
