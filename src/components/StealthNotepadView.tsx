import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Plus, Trash2, CheckSquare, Square, ChevronLeft, BookOpen, Clock, X, Lock, Check } from 'lucide-react';
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

const DEFAULT_NOTES: NoteItem[] = [
  {
    id: 'note-1',
    title: 'Grocery & Essentials',
    content: '1. Oat milk & almond butter\n2. Fresh strawberries & blueberries\n3. Honey & Greek yogurt\n4. Olive oil & whole wheat bread',
    category: 'Reminders',
    updatedAt: 'Today, 11:20 AM',
    isChecklist: true,
    checklistItems: [
      { id: 'c1', text: 'Oat milk & almond butter', done: true },
      { id: 'c2', text: 'Fresh strawberries & blueberries', done: false },
      { id: 'c3', text: 'Honey & Greek yogurt', done: false },
      { id: 'c4', text: 'Olive oil & whole wheat bread', done: false }
    ]
  },
  {
    id: 'note-2',
    title: 'Weekend To-Do List',
    content: 'Finish pending assignments, organize wardrobe for the week, and catch up on reading.',
    category: 'Personal',
    updatedAt: 'Yesterday',
    isChecklist: false
  },
  {
    id: 'note-3',
    title: 'Book Recommendations',
    content: '1. Atomic Habits - James Clear\n2. The Psychology of Money - Morgan Housel\n3. Before the Coffee Gets Cold',
    category: 'Personal',
    updatedAt: 'Sep 2',
    isChecklist: false
  },
  {
    id: 'note-4',
    title: 'Study Schedule',
    content: 'Morning: Revision & formulas.\nEvening: Practice questions and summary notes.',
    category: 'Study',
    updatedAt: 'Aug 29',
    isChecklist: false
  }
];

interface StealthNotepadViewProps {
  onUnlock: () => void;
}

export function StealthNotepadView({ onUnlock }: StealthNotepadViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    try {
      const saved = localStorage.getItem('onlyus_notepad_items');
      return saved ? JSON.parse(saved) : DEFAULT_NOTES;
    } catch {
      return DEFAULT_NOTES;
    }
  });

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

  // Accelerometer Panic Shake detector
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
          // Panic shake detected: exit and lock immediately
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
    <div className="min-h-screen bg-[#FDFBF7] text-[#2C2A29] font-sans flex flex-col select-none">
      {/* Top Header */}
      <header className="pt-10 pb-3 px-5 bg-[#FDFBF7] border-b border-[#EAE5DF] sticky top-0 z-20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#EAB308]/20 flex items-center justify-center text-[#B45309]">
              <BookOpen className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1F1E1D]">Notes</h1>
          </div>
          <span className="text-xs text-[#78716C] font-medium bg-[#F5F1EB] px-2.5 py-1 rounded-full border border-[#E7E2DB]">
            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
          </span>
        </div>

        {/* Realistic Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#A8A29E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes..."
            className="w-full bg-[#F3EFEA] text-[#1F1E1D] placeholder-[#A8A29E] text-sm pl-10 pr-10 py-2.5 rounded-xl border border-transparent focus:border-[#D6D0C7] focus:bg-white focus:outline-none transition-all"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#A8A29E] hover:text-[#57534E]"
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
                  ? 'bg-[#2C2A29] text-white shadow-sm' 
                  : 'bg-[#EDE7E0] text-[#78716C] hover:bg-[#E5DFD7]'
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
          <div className="text-center py-20 text-[#A8A29E]">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No notes found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredNotes.map(note => (
              <div
                key={note.id}
                onClick={() => setActiveNote(note)}
                className="bg-white p-4 rounded-2xl border border-[#EAE5DF] shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] active:scale-[0.99] transition-all cursor-pointer relative group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="text-base font-semibold text-[#1F1E1D] leading-snug line-clamp-1">
                      {note.title}
                    </h3>
                    <button
                      onClick={(e) => handleDeleteNote(note.id, e)}
                      className="text-[#D6D0C7] hover:text-red-500 p-1 opacity-60 hover:opacity-100 transition-opacity"
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
                          className="flex items-center gap-2 text-xs text-[#57534E]"
                        >
                          {item.done ? (
                            <CheckSquare className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-[#A8A29E] shrink-0" />
                          )}
                          <span className={`line-clamp-1 ${item.done ? 'line-through text-[#A8A29E]' : ''}`}>
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#78716C] leading-relaxed line-clamp-3 mb-3">
                      {note.content}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#A8A29E] pt-2 border-t border-[#F5F2ED] mt-2">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {note.updatedAt}
                  </span>
                  <span className="bg-[#F5F1EB] px-2 py-0.5 rounded text-[#78716C]">
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
          className="w-14 h-14 bg-[#2C2A29] text-white rounded-full shadow-lg flex items-center justify-center hover:bg-black active:scale-95 transition-all"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Create Note Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex flex-col justify-end sm:justify-center sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-h-[85vh] flex flex-col shadow-2xl border border-[#EAE5DF]">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE5DF]">
              <h2 className="text-base font-bold text-[#1F1E1D]">New Note</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 text-xs text-[#78716C] hover:text-[#1F1E1D]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateNote}
                  className="px-4 py-1.5 bg-[#2C2A29] text-white text-xs font-semibold rounded-lg hover:bg-black"
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
              className="text-lg font-bold text-[#1F1E1D] pt-4 pb-2 focus:outline-none placeholder-[#A8A29E]"
            />

            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Write your note here..."
              rows={8}
              className="text-sm text-[#44403C] leading-relaxed resize-none focus:outline-none placeholder-[#A8A29E]"
            />
          </div>
        </div>
      )}

      {/* Read / Edit Note Modal */}
      {activeNote && (
        <div className="fixed inset-0 z-50 bg-[#FDFBF7] flex flex-col">
          <header className="pt-10 pb-3 px-4 border-b border-[#EAE5DF] flex items-center justify-between">
            <button
              onClick={() => setActiveNote(null)}
              className="flex items-center gap-1 text-sm font-semibold text-[#78716C] hover:text-[#1F1E1D]"
            >
              <ChevronLeft className="w-5 h-5" />
              Notes
            </button>
            <span className="text-xs text-[#A8A29E]">{activeNote.updatedAt}</span>
          </header>
          <div className="flex-1 p-5 overflow-y-auto">
            <h1 className="text-2xl font-bold text-[#1F1E1D] mb-4">{activeNote.title}</h1>
            <p className="text-sm text-[#44403C] leading-relaxed whitespace-pre-line">
              {activeNote.content}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
