import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, Plus, Trash2, CheckSquare, Square, X, 
  Archive, ArrowLeft, Pin, Check, MoreVertical
} from 'lucide-react';
import { App } from '@capacitor/app';

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  category?: string;
  color?: string;
  pinned?: boolean;
  updatedAt: string;
  isChecklist?: boolean;
  checklistItems?: { id: string; text: string; done: boolean }[];
}

interface StealthNotepadViewProps {
  onUnlock: () => void;
}

export function StealthNotepadView({ onUnlock }: StealthNotepadViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [showArchive, setShowArchive] = useState(false);

  // Real local storage backed notes - ZERO mock entries!
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    try {
      const stored = localStorage.getItem('onlyus_notepad_items');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Purge any legacy mock seed notes from prior versions
          return parsed.filter(n => !n.id.startsWith('seed-'));
        }
      }
    } catch {}
    return [];
  });

  // Save notes to localStorage whenever updated
  const saveNotes = (updated: NoteItem[]) => {
    setNotes(updated);
    try {
      localStorage.setItem('onlyus_notepad_items', JSON.stringify(updated));
    } catch {}
  };

  // Secret unlock trigger listener: #6969#
  useEffect(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (trimmed === '#6969#' || trimmed.includes('#6969#')) {
      setSearchQuery('');
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([40, 60, 40]); } catch {}
      }
      onUnlock();
    }
  }, [searchQuery, onUnlock]);

  // Accelerometer Panic Shake detector (fallback in webview layer)
  useEffect(() => {
    let lastX = 0;
    let lastY = 0;
    let lastZ = 0;
    let lastTime = 0;

    const handleMotion = (event: DeviceMotionEvent) => {
      const current = event.accelerationIncludingGravity;
      if (!current) return;

      const currentTime = Date.now();
      if ((currentTime - lastTime) > 100) {
        const diffTime = currentTime - lastTime;
        lastTime = currentTime;

        const x = current.x || 0;
        const y = current.y || 0;
        const z = current.z || 0;

        const speed = Math.abs(x + y + z - lastX - lastY - lastZ) / diffTime * 10000;

        if (speed > 2200) {
          // Trigger instant panic hardware kill
          try {
            App.exitApp();
          } catch {
            window.location.replace('about:blank');
          }
        }

        lastX = x;
        lastY = y;
        lastZ = z;
      }
    };

    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      window.addEventListener('devicemotion', handleMotion);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('devicemotion', handleMotion);
      }
    };
  }, []);

  // Filter notes by search query
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(n => 
      n.title.toLowerCase().includes(q) || 
      n.content.toLowerCase().includes(q)
    );
  }, [notes, searchQuery]);

  // Create new note handler
  const handleCreateNote = () => {
    const newNote: NoteItem = {
      id: 'note-' + Date.now(),
      title: '',
      content: '',
      pinned: false,
      updatedAt: 'Just now'
    };
    setEditingNote(newNote);
  };

  // Close editor and persist note if non-empty
  const handleCloseEditor = () => {
    if (!editingNote) return;
    const titleTrimmed = editingNote.title.trim();
    const contentTrimmed = editingNote.content.trim();

    if (titleTrimmed || contentTrimmed) {
      const existingIndex = notes.findIndex(n => n.id === editingNote.id);
      const nowFormatted = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date());
      const updatedNote: NoteItem = {
        ...editingNote,
        updatedAt: nowFormatted
      };

      if (existingIndex >= 0) {
        const updatedList = [...notes];
        updatedList[existingIndex] = updatedNote;
        saveNotes(updatedList);
      } else {
        saveNotes([updatedNote, ...notes]);
      }
    } else {
      // If blank, remove it
      saveNotes(notes.filter(n => n.id !== editingNote.id));
    }

    setEditingNote(null);
  };

  // Delete active note
  const handleDeleteActiveNote = () => {
    if (editingNote) {
      saveNotes(notes.filter(n => n.id !== editingNote.id));
      setEditingNote(null);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#121417] text-[#1E2022] dark:text-neutral-100 flex flex-col font-sans transition-colors select-none">
      {/* 1. Header (Matching Screenshot 4) */}
      <header className="flex items-center justify-between px-6 pt-10 pb-4">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#18181B] dark:text-neutral-100">
          Notes
        </h1>
        <button 
          onClick={() => setShowArchive(prev => !prev)}
          className="p-2 text-[#4B5563] dark:text-neutral-400 hover:text-[#18181B] dark:hover:text-white rounded-full transition-colors active:bg-neutral-100 dark:active:bg-neutral-800"
          title="Archive"
        >
          <Archive className="w-6 h-6 stroke-[1.8]" />
        </button>
      </header>

      {/* 2. Search Notes Input (Matching Screenshot 4 with #6969# trigger) */}
      <div className="px-5 mb-4">
        <div className="relative flex items-center w-full bg-[#F0F3F6] dark:bg-[#202328] rounded-2xl px-4 py-3.5 transition-all focus-within:ring-2 focus-within:ring-[#225072]/30">
          <Search className="w-5 h-5 text-[#8A94A6] mr-3 shrink-0" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-[#18181B] dark:text-white placeholder-[#8A94A6] text-base font-normal"
            autoComplete="off"
            spellCheck="false"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-1 text-[#8A94A6] hover:text-[#4B5563]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Main Content Area */}
      <main className="flex-1 flex flex-col px-5 pb-24 overflow-y-auto">
        {filteredNotes.length === 0 ? (
          /* Empty State (Pixel-matched with Screenshot 4) */
          <div className="flex-1 flex flex-col items-center justify-center -mt-10 px-6 text-center select-none">
            {/* Notepad with lines and pencil icon matching Screenshot 4 */}
            <div className="w-20 h-20 mb-3 flex items-center justify-center text-[#B0B8C4] dark:text-[#4B5563]">
              <svg className="w-16 h-16" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Note outline and ruled lines */}
                <rect x="6" y="6" width="30" height="36" rx="4" stroke="currentColor" strokeWidth="2.5" />
                <line x1="12" y1="14" x2="26" y2="14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="12" y1="22" x2="30" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="12" y1="30" x2="22" y2="30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                {/* Stylized pencil in bottom right corner */}
                <g transform="translate(24, 24)">
                  <path d="M4 16 L16 4 L20 8 L8 20 L2 21 Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <line x1="13" y1="7" x2="17" y2="11" stroke="currentColor" strokeWidth="2" />
                </g>
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#18181B] dark:text-neutral-100">
              {searchQuery ? 'No matching notes' : 'No notes yet'}
            </h2>
            <p className="text-sm text-[#8A94A6] dark:text-[#718096] mt-1 font-normal">
              {searchQuery ? 'Try another search term' : 'Tap + to write a note'}
            </p>
          </div>
        ) : (
          /* List / Grid of Notes */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {filteredNotes.map(note => (
              <div
                key={note.id}
                onClick={() => setEditingNote(note)}
                className="bg-[#F8FAFC] dark:bg-[#1E2228] border border-[#E2E8F0] dark:border-[#2D333B] p-4 rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-[0.99] flex flex-col justify-between"
              >
                <div>
                  {note.title && (
                    <h3 className="font-semibold text-base text-[#18181B] dark:text-white line-clamp-2 mb-1.5">
                      {note.title}
                    </h3>
                  )}
                  {note.content && (
                    <p className="text-sm text-[#64748B] dark:text-[#94A3B8] line-clamp-4 whitespace-pre-line leading-relaxed">
                      {note.content}
                    </p>
                  )}
                </div>
                <div className="mt-3 pt-2 flex items-center justify-between text-xs text-[#94A3B8] dark:text-[#64748B]">
                  <span>{note.updatedAt}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 4. Floating Action Button (Pixel-matched with Screenshot 4) */}
      <button
        onClick={handleCreateNote}
        aria-label="Add note"
        className="fixed bottom-8 right-6 w-14 h-14 rounded-full bg-[#204B6E] active:bg-[#183B57] text-white flex items-center justify-center shadow-xl shadow-[#204B6E]/30 transition-transform active:scale-90 z-20"
      >
        <Plus className="w-7 h-7 stroke-[2.4]" />
      </button>

      {/* 5. Clean Note Editor (Full screen) */}
      {editingNote && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-[#121417] flex flex-col animate-in fade-in duration-150">
          {/* Top Bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
            <button
              onClick={handleCloseEditor}
              className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white rounded-full transition-colors"
              title="Save & back"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={handleDeleteActiveNote}
                className="p-2 text-neutral-400 hover:text-rose-500 rounded-full transition-colors"
                title="Delete note"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button
                onClick={handleCloseEditor}
                className="px-3 py-1.5 text-sm font-semibold text-[#204B6E] dark:text-sky-400 hover:bg-[#204B6E]/10 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>

          {/* Editor Body */}
          <div className="flex-1 flex flex-col p-6 overflow-y-auto">
            <input
              type="text"
              placeholder="Title"
              value={editingNote.title}
              onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
              className="w-full bg-transparent border-none outline-none font-bold text-2xl text-[#18181B] dark:text-white placeholder-neutral-400 mb-4"
              autoFocus
            />
            <textarea
              placeholder="Note"
              value={editingNote.content}
              onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
              className="w-full flex-1 bg-transparent border-none outline-none resize-none text-base leading-relaxed text-[#334155] dark:text-neutral-200 placeholder-neutral-400"
            />
          </div>
        </div>
      )}
    </div>
  );
}
