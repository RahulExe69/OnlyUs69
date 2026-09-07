import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Trash2, CheckSquare, Square, ChevronLeft, BookOpen, Clock, X } from 'lucide-react';
import { App } from '@capacitor/app';

interface NoteItem {
  id: string;
  title: string;
  content: string;
  category: string;
  updatedAt: string;
  isChecklist?: boolean;
  checklistItems?: { id: string; text: string; done: boolean }[];
}

interface StealthNotepadViewProps {
  onUnlock: () => void;
}

export function StealthNotepadView({ onUnlock }: StealthNotepadViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Real storage only - zero fake/mock notes
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    try {
      const saved = localStorage.getItem('onlyus_notepad_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Mobile System Theme listener (Dark vs Light)
  const [isSystemDark, setIsSystemDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const matcher = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setIsSystemDark(e.matches);
    try {
      matcher.addEventListener('change', onChange);
      return () => matcher.removeEventListener('change', onChange);
    } catch {
      // Fallback for older browsers
      matcher.addListener(onChange);
      return () => matcher.removeListener(onChange);
    }
  }, []);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeNote, setActiveNote] = useState<NoteItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  // Persist notes changes
  const saveNotes = (updated: NoteItem[]) => {
    setNotes(updated);
    try {
      localStorage.setItem('onlyus_notepad_items', JSON.stringify(updated));
    } catch {}
  };

  // Secret keyword listener: #6969#
  useEffect(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (trimmed === '#6969#' || trimmed.includes('#6969#')) {
      // Secret unlocked!
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
          // Panic shake detected: exit immediately
          setActiveNote(null);
          setIsCreating(false);
          setSearchQuery('');
          try {
            App.exitApp();
          } catch {}
        }

        lastX = x;
        lastY = y;
        lastZ = z;
      }
    };

    window.addEventListener('devicemotion', handleMotion, { passive: true });
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, []);

  // Filter notes by search and category
  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      const matchesCat = selectedCategory === 'All' || n.category === selectedCategory;
      const matchesSearch = !searchQuery || 
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        n.content.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [notes, selectedCategory, searchQuery]);

  const handleCreateNote = () => {
    if (!newTitle.trim() && !newContent.trim()) {
      setIsCreating(false);
      return;
    }
    const newNote: NoteItem = {
      id: 'note-' + Date.now(),
      title: newTitle.trim() || 'Untitled Note',
      content: newContent.trim(),
      category: selectedCategory === 'All' ? 'Personal' : selectedCategory,
      updatedAt: 'Just now'
    };
    saveNotes([newNote, ...notes]);
    setNewTitle('');
    setNewContent('');
    setIsCreating(false);
  };

  const handleDeleteNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = notes.filter(n => n.id !== id);
    saveNotes(updated);
    if (activeNote?.id === id) {
      setActiveNote(null);
    }
  };

  const toggleChecklistItem = (noteId: string, itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = notes.map(n => {
      if (n.id !== noteId || !n.checklistItems) return n;
      return {
        ...n,
        checklistItems: n.checklistItems.map(item => 
          item.id === itemId ? { ...item, done: !item.done } : item
        )
      };
    });
    saveNotes(updated);
  };

  return (
    <div className={`min-h-screen font-sans flex flex-col select-none transition-colors duration-200 ${
      isSystemDark 
        ? 'bg-[#121212] text-[#E5E5E5]' 
        : 'bg-[#FDFBF7] text-[#2C2A29]'
    }`}>
      {/* Top Header */}
      <header className={`pt-10 pb-3 px-5 border-b sticky top-0 z-20 transition-colors ${
        isSystemDark 
          ? 'bg-[#121212] border-[#262626]' 
          : 'bg-[#FDFBF7] border-[#EAE5DF]'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isSystemDark 
                ? 'bg-amber-500/20 text-amber-400' 
                : 'bg-[#EAB308]/20 text-[#B45309]'
            }`}>
              <BookOpen className="w-5 h-5" />
            </div>
            <h1 className={`text-2xl font-bold tracking-tight ${
              isSystemDark ? 'text-white' : 'text-[#1F1E1D]'
            }`}>
              Notes
            </h1>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
            isSystemDark 
              ? 'bg-[#1E1E1E] text-[#A3A3A3] border-[#333333]' 
              : 'bg-[#F5F1EB] text-[#78716C] border-[#E7E2DB]'
          }`}>
            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
          </span>
        </div>

        {/* Realistic Search Bar */}
        <div className="relative">
          <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
            isSystemDark ? 'text-[#737373]' : 'text-[#A8A29E]'
          }`} />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes..."
            className={`w-full text-sm pl-10 pr-10 py-2.5 rounded-xl border focus:outline-none transition-all ${
              isSystemDark 
                ? 'bg-[#1E1E1E] text-white placeholder-[#737373] border-transparent focus:border-[#404040] focus:bg-[#262626]' 
                : 'bg-[#F3EFEA] text-[#1F1E1D] placeholder-[#A8A29E] border-transparent focus:border-[#D6D0C7] focus:bg-white'
            }`}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 ${
                isSystemDark ? 'text-[#737373] hover:text-[#A3A3A3]' : 'text-[#A8A29E] hover:text-[#57534E]'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 scrollbar-none">
          {['All', 'Reminders', 'Personal', 'Study'].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat 
                  ? (isSystemDark ? 'bg-white text-black shadow-sm' : 'bg-[#2C2A29] text-white shadow-sm')
                  : (isSystemDark ? 'bg-[#262626] text-[#A3A3A3] hover:bg-[#333333]' : 'bg-[#EDE7E0] text-[#78716C] hover:bg-[#E5DFD7]')
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {/* Notes List View */}
      <main className="flex-1 p-4 overflow-y-auto">
        {filteredNotes.length === 0 ? (
          <div className="text-center py-24">
            <BookOpen className={`w-12 h-12 mx-auto mb-3 opacity-25 ${
              isSystemDark ? 'text-[#737373]' : 'text-[#A8A29E]'
            }`} />
            <p className={`text-sm font-medium ${
              isSystemDark ? 'text-[#737373]' : 'text-[#A8A29E]'
            }`}>
              {notes.length === 0 ? 'No notes yet. Tap + to write a note.' : 'No notes found'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredNotes.map(note => (
              <div
                key={note.id}
                onClick={() => setActiveNote(note)}
                className={`p-4 rounded-2xl border shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] active:scale-[0.99] transition-all cursor-pointer relative group flex flex-col justify-between ${
                  isSystemDark 
                    ? 'bg-[#1C1C1C] border-[#2A2A2A] hover:border-[#383838]' 
                    : 'bg-white border-[#EAE5DF] hover:border-[#D6D0C7]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className={`text-base font-semibold leading-snug line-clamp-1 ${
                      isSystemDark ? 'text-white' : 'text-[#1F1E1D]'
                    }`}>
                      {note.title}
                    </h3>
                    <button
                      onClick={(e) => handleDeleteNote(note.id, e)}
                      className={`p-1 opacity-60 hover:opacity-100 hover:text-red-500 transition-opacity ${
                        isSystemDark ? 'text-[#737373]' : 'text-[#D6D0C7]'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {note.isChecklist && note.checklistItems ? (
                    <div className="space-y-1.5 my-2">
                      {note.checklistItems.slice(0, 3).map(item => (
                        <div 
                          key={item.id} 
                          onClick={(e) => toggleChecklistItem(note.id, item.id, e)}
                          className={`flex items-center gap-2 text-xs ${
                            isSystemDark ? 'text-[#A3A3A3]' : 'text-[#57534E]'
                          }`}
                        >
                          {item.done ? (
                            <CheckSquare className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          ) : (
                            <Square className={`w-3.5 h-3.5 shrink-0 ${
                              isSystemDark ? 'text-[#737373]' : 'text-[#A8A29E]'
                            }`} />
                          )}
                          <span className={`line-clamp-1 ${
                            item.done ? 'line-through opacity-50' : ''
                          }`}>
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-xs leading-relaxed line-clamp-3 mb-3 ${
                      isSystemDark ? 'text-[#A3A3A3]' : 'text-[#78716C]'
                    }`}>
                      {note.content}
                    </p>
                  )}
                </div>

                <div className={`flex items-center justify-between text-[10px] pt-2 border-t mt-2 ${
                  isSystemDark ? 'border-[#262626] text-[#737373]' : 'border-[#F5F2ED] text-[#A8A29E]'
                }`}>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {note.updatedAt}
                  </span>
                  <span className={`px-2 py-0.5 rounded ${
                    isSystemDark ? 'bg-[#262626] text-[#A3A3A3]' : 'bg-[#F5F1EB] text-[#78716C]'
                  }`}>
                    {note.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Add Note Button */}
      <div className="fixed bottom-6 right-6 z-10">
        <button
          onClick={() => setIsCreating(true)}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-all ${
            isSystemDark 
              ? 'bg-white text-black hover:bg-neutral-200' 
              : 'bg-[#2C2A29] text-white hover:bg-black'
          }`}
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Create Note Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end sm:justify-center sm:p-4">
          <div className={`rounded-t-3xl sm:rounded-2xl p-5 max-h-[85vh] flex flex-col shadow-2xl border transition-colors ${
            isSystemDark 
              ? 'bg-[#1C1C1C] border-[#2E2E2E]' 
              : 'bg-white border-[#EAE5DF]'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${
              isSystemDark ? 'border-[#2E2E2E]' : 'border-[#EAE5DF]'
            }`}>
              <h2 className={`text-base font-bold ${
                isSystemDark ? 'text-white' : 'text-[#1F1E1D]'
              }`}>
                New Note
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCreating(false)}
                  className={`px-3 py-1.5 text-xs ${
                    isSystemDark ? 'text-[#A3A3A3] hover:text-white' : 'text-[#78716C] hover:text-[#1F1E1D]'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateNote}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${
                    isSystemDark 
                      ? 'bg-white text-black hover:bg-neutral-200' 
                      : 'bg-[#2C2A29] text-white hover:bg-black'
                  }`}
                >
                  Save
                </button>
              </div>
            </div>

            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title"
              className={`text-lg font-bold pt-4 pb-2 focus:outline-none ${
                isSystemDark 
                  ? 'bg-transparent text-white placeholder-[#737373]' 
                  : 'bg-transparent text-[#1F1E1D] placeholder-[#A8A29E]'
              }`}
            />

            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Write your note here..."
              rows={8}
              className={`text-sm leading-relaxed resize-none focus:outline-none ${
                isSystemDark 
                  ? 'bg-transparent text-[#D4D4D4] placeholder-[#737373]' 
                  : 'bg-transparent text-[#44403C] placeholder-[#A8A29E]'
              }`}
            />
          </div>
        </div>
      )}

      {/* Read / Edit Note Modal */}
      {activeNote && (
        <div className={`fixed inset-0 z-50 flex flex-col transition-colors ${
          isSystemDark ? 'bg-[#121212] text-white' : 'bg-[#FDFBF7] text-[#2C2A29]'
        }`}>
          <header className={`pt-10 pb-3 px-4 border-b flex items-center justify-between ${
            isSystemDark ? 'border-[#262626]' : 'border-[#EAE5DF]'
          }`}>
            <button
              onClick={() => setActiveNote(null)}
              className={`flex items-center gap-1 text-sm font-semibold ${
                isSystemDark ? 'text-[#A3A3A3] hover:text-white' : 'text-[#78716C] hover:text-[#1F1E1D]'
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
              Notes
            </button>
            <span className={`text-xs ${
              isSystemDark ? 'text-[#737373]' : 'text-[#A8A29E]'
            }`}>
              {activeNote.updatedAt}
            </span>
          </header>
          <div className="flex-1 p-5 overflow-y-auto">
            <h1 className={`text-2xl font-bold mb-4 ${
              isSystemDark ? 'text-white' : 'text-[#1F1E1D]'
            }`}>
              {activeNote.title}
            </h1>
            <p className={`text-sm leading-relaxed whitespace-pre-line ${
              isSystemDark ? 'text-[#D4D4D4]' : 'text-[#44403C]'
            }`}>
              {activeNote.content}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
