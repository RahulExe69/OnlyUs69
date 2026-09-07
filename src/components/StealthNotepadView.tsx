import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, Plus, Trash2, CheckSquare, Square, ChevronLeft, X, 
  Menu, LayoutGrid, Rows, Pin, PinOff, Palette, Bell, Archive, 
  Check, ArrowLeft, PenTool, Mic, Image as ImageIcon, Tag, Lightbulb
} from 'lucide-react';
import { App } from '@capacitor/app';

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  category: string;
  color: string; // 'default' | 'coral' | 'peach' | 'sand' | 'mint' | 'teal' | 'blue' | 'lavender' | 'pink'
  pinned: boolean;
  updatedAt: string;
  isChecklist?: boolean;
  checklistItems?: { id: string; text: string; done: boolean }[];
}

interface StealthNotepadViewProps {
  onUnlock: () => void;
}

const KEEP_COLORS: { id: string; name: string; lightBg: string; lightBorder: string; darkBg: string; darkBorder: string }[] = [
  { id: 'default', name: 'Default', lightBg: 'bg-white', lightBorder: 'border-neutral-200/90', darkBg: 'bg-[#202124]', darkBorder: 'border-[#3C4043]' },
  { id: 'coral', name: 'Coral', lightBg: 'bg-[#FCE8E6]', lightBorder: 'border-[#F8B4AF]', darkBg: 'bg-[#5C2B29]', darkBorder: 'border-[#773330]' },
  { id: 'peach', name: 'Peach', lightBg: 'bg-[#FEF7E0]', lightBorder: 'border-[#FEEAA6]', darkBg: 'bg-[#614A19]', darkBorder: 'border-[#7C5E20]' },
  { id: 'sand', name: 'Sand', lightBg: 'bg-[#FFF8E1]', lightBorder: 'border-[#FFE082]', darkBg: 'bg-[#635D19]', darkBorder: 'border-[#7F7720]' },
  { id: 'mint', name: 'Mint', lightBg: 'bg-[#E6F4EA]', lightBorder: 'border-[#A8DAB5]', darkBg: 'bg-[#345920]', darkBorder: 'border-[#437128]' },
  { id: 'teal', name: 'Teal', lightBg: 'bg-[#E0F2F1]', lightBorder: 'border-[#80CBC4]', darkBg: 'bg-[#16504B]', darkBorder: 'border-[#1D6660]' },
  { id: 'blue', name: 'Cerulean', lightBg: 'bg-[#E8F0FE]', lightBorder: 'border-[#AECBFA]', darkBg: 'bg-[#1E3A5F]', darkBorder: 'border-[#274B7A]' },
  { id: 'lavender', name: 'Lavender', lightBg: 'bg-[#F3E8FD]', lightBorder: 'border-[#D7AEFB]', darkBg: 'bg-[#4A2B70]', darkBorder: 'border-[#5F378F]' },
  { id: 'pink', name: 'Blossom', lightBg: 'bg-[#FCE4EC]', lightBorder: 'border-[#F8BBD0]', darkBg: 'bg-[#5B2245]', darkBorder: 'border-[#732B58]' }
];

const DEFAULT_SEED_NOTES: NoteItem[] = [
  {
    id: 'seed-1',
    title: 'Semester Study Schedule & Deadlines',
    content: '',
    category: 'Study',
    color: 'blue',
    pinned: true,
    updatedAt: 'Yesterday',
    isChecklist: true,
    checklistItems: [
      { id: 'c-1', text: 'Chapter 4 & 5 Summary notes', done: true },
      { id: 'c-2', text: 'Assignment 2 submission portal', done: true },
      { id: 'c-3', text: 'Midterm practice exam paper', done: false },
      { id: 'c-4', text: 'Review lecture recordings & slides', done: false }
    ]
  },
  {
    id: 'seed-2',
    title: 'Grocery & Kitchen Essentials',
    content: '',
    category: 'Personal',
    color: 'sand',
    pinned: false,
    updatedAt: 'May 14',
    isChecklist: true,
    checklistItems: [
      { id: 'g-1', text: 'Oat milk & Greek yogurt', done: true },
      { id: 'g-2', text: 'Almonds & Chia seeds', done: false },
      { id: 'g-3', text: 'Green tea & Honey', done: false },
      { id: 'g-4', text: 'Avocados & Sourdough bread', done: false }
    ]
  },
  {
    id: 'seed-3',
    title: 'Book & Podcast Recommendations',
    content: '1. Atomic Habits — James Clear\n2. The Psychology of Money — Morgan Housel\n3. Before the Coffee Gets Cold — Toshikazu Kawaguchi\n\nPodcasts:\n• Huberman Lab (Sleep toolkit)\n• The Daily (NYT)',
    category: 'Reminders',
    color: 'mint',
    pinned: false,
    updatedAt: 'May 10',
    isChecklist: false
  },
  {
    id: 'seed-4',
    title: 'Weekend Project Ideas',
    content: '• Deep clean desk & organize bookshelf\n• Backup photos to cloud drive\n• Prepare presentation wireframes for Monday meeting',
    category: 'Study',
    color: 'lavender',
    pinned: false,
    updatedAt: 'Apr 28',
    isChecklist: false
  }
];

export function StealthNotepadView({ onUnlock }: StealthNotepadViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isGridView, setIsGridView] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Real local storage backed notes with authentic Google Keep default seed
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    try {
      const saved = localStorage.getItem('onlyus_notepad_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return DEFAULT_SEED_NOTES;
    } catch {
      return DEFAULT_SEED_NOTES;
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
      matcher.addListener(onChange);
      return () => matcher.removeListener(onChange);
    }
  }, []);

  // Active Editor State
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [newChecklistText, setNewChecklistText] = useState('');

  // Persist notes changes
  const saveNotes = (updated: NoteItem[]) => {
    setNotes(updated);
    try {
      localStorage.setItem('onlyus_notepad_items', JSON.stringify(updated));
    } catch {}
  };

  // Secret trigger keyword listener: #6969#
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
          // Panic shake detected: terminate immediately
          setEditingNote(null);
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
        n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.checklistItems && n.checklistItems.some(item => item.text.toLowerCase().includes(searchQuery.toLowerCase())));
      return matchesCat && matchesSearch;
    });
  }, [notes, selectedCategory, searchQuery]);

  const pinnedNotes = useMemo(() => filteredNotes.filter(n => n.pinned), [filteredNotes]);
  const otherNotes = useMemo(() => filteredNotes.filter(n => !n.pinned), [filteredNotes]);

  // Start new note
  const startNewNote = (isChecklist: boolean = false) => {
    const newNote: NoteItem = {
      id: 'note-' + Date.now(),
      title: '',
      content: '',
      category: selectedCategory === 'All' ? 'Personal' : selectedCategory,
      color: 'default',
      pinned: false,
      updatedAt: 'Just now',
      isChecklist,
      checklistItems: isChecklist ? [] : undefined
    };
    setEditingNote(newNote);
  };

  // Save current editing note
  const handleSaveAndCloseEditor = () => {
    if (!editingNote) return;
    const hasTitle = editingNote.title.trim().length > 0;
    const hasContent = editingNote.content.trim().length > 0;
    const hasChecklist = editingNote.isChecklist && editingNote.checklistItems && editingNote.checklistItems.length > 0;

    if (!hasTitle && !hasContent && !hasChecklist) {
      // Empty note: remove if it already existed in list
      const updated = notes.filter(n => n.id !== editingNote.id);
      saveNotes(updated);
    } else {
      const noteToSave: NoteItem = {
        ...editingNote,
        title: editingNote.title.trim() || 'Untitled Note',
        updatedAt: 'Just now'
      };
      const existingIdx = notes.findIndex(n => n.id === noteToSave.id);
      if (existingIdx >= 0) {
        const updated = [...notes];
        updated[existingIdx] = noteToSave;
        saveNotes(updated);
      } else {
        saveNotes([noteToSave, ...notes]);
      }
    }
    setEditingNote(null);
    setShowColorPicker(false);
  };

  const handleDeleteCurrentNote = () => {
    if (!editingNote) return;
    const updated = notes.filter(n => n.id !== editingNote.id);
    saveNotes(updated);
    setEditingNote(null);
  };

  const handleTogglePin = (noteId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = notes.map(n => n.id === noteId ? { ...n, pinned: !n.pinned } : n);
    saveNotes(updated);
    if (editingNote && editingNote.id === noteId) {
      setEditingNote({ ...editingNote, pinned: !editingNote.pinned });
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

  // Add checklist item inside editor
  const handleAddChecklistItemInEditor = () => {
    if (!editingNote || !newChecklistText.trim()) return;
    const newItem = {
      id: 'c-' + Date.now(),
      text: newChecklistText.trim(),
      done: false
    };
    setEditingNote({
      ...editingNote,
      isChecklist: true,
      checklistItems: [...(editingNote.checklistItems || []), newItem]
    });
    setNewChecklistText('');
  };

  const getColorClasses = (colorId: string) => {
    const found = KEEP_COLORS.find(c => c.id === colorId) || KEEP_COLORS[0];
    return isSystemDark ? `${found.darkBg} ${found.darkBorder}` : `${found.lightBg} ${found.lightBorder}`;
  };

  return (
    <div className={`min-h-screen font-sans flex flex-col select-none transition-colors duration-200 ${
      isSystemDark 
        ? 'bg-[#202124] text-[#E8EAED]' 
        : 'bg-[#FFFFFF] text-[#202124]'
    }`}>
      {/* 1. Google Keep Floating Pill Search Bar */}
      <div className="pt-8 px-4 pb-2 sticky top-0 z-20 backdrop-blur-md bg-opacity-95">
        <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-full border shadow-sm transition-all ${
          isSystemDark 
            ? 'bg-[#28292A] border-[#3C4043] text-[#E8EAED] shadow-black/20' 
            : 'bg-[#F1F3F4] border-[#E0E0E0] text-[#202124] shadow-neutral-200/50'
        }`}>
          {/* Hamburger Menu Button */}
          <button 
            onClick={() => setShowDrawer(true)}
            className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title="Menu"
          >
            <Menu className="w-5 h-5 text-neutral-600 dark:text-neutral-300" />
          </button>

          {/* Search Bar Input (Secret Trigger #6969#) */}
          <div className="flex-1 flex items-center gap-2">
            <Search className="w-4 h-4 text-neutral-500 dark:text-neutral-400 shrink-0" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your notes"
              className="w-full text-sm bg-transparent border-none focus:outline-none placeholder-neutral-500 dark:placeholder-neutral-400"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-neutral-500 dark:text-neutral-400"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* View Toggle (Grid vs Rows) */}
          <button 
            onClick={() => setIsGridView(!isGridView)}
            className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 transition-colors"
            title={isGridView ? 'List view' : 'Grid view'}
          >
            {isGridView ? <Rows className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
          </button>

          {/* Profile Avatar circle */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-white font-semibold text-sm flex items-center justify-center shadow-xs">
            N
          </div>
        </div>

        {/* Category Pill Filters */}
        <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 scrollbar-none">
          {['All', 'Study', 'Personal', 'Reminders'].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                selectedCategory === cat 
                  ? (isSystemDark 
                      ? 'bg-[#3C4043] text-white border-neutral-500' 
                      : 'bg-[#202124] text-white border-neutral-800')
                  : (isSystemDark 
                      ? 'bg-transparent text-neutral-400 border-[#3C4043] hover:bg-white/5' 
                      : 'bg-transparent text-neutral-600 border-neutral-300 hover:bg-neutral-100')
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Side Navigation Drawer */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div 
            onClick={() => setShowDrawer(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity" 
          />
          <div className={`relative w-72 h-full flex flex-col p-4 shadow-2xl z-10 ${
            isSystemDark ? 'bg-[#202124] text-[#E8EAED]' : 'bg-white text-[#202124]'
          }`}>
            <div className="flex items-center gap-3 px-3 py-4 mb-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-base">
                <Lightbulb className="w-4 h-4 fill-white" />
              </div>
              <h2 className="text-lg font-medium tracking-tight">Notes</h2>
            </div>

            <nav className="flex-1 space-y-1">
              <button 
                onClick={() => setShowDrawer(false)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-r-full text-sm font-medium ${
                  isSystemDark ? 'bg-[#41331C] text-amber-300' : 'bg-[#FEEFC3] text-[#202124]'
                }`}
              >
                <Lightbulb className="w-5 h-5 fill-amber-500 text-amber-500" />
                Notes
              </button>

              <button 
                onClick={() => setShowDrawer(false)}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-r-full text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5"
              >
                <Bell className="w-5 h-5" />
                Reminders
              </button>

              <button 
                onClick={() => setShowDrawer(false)}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-r-full text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5"
              >
                <Archive className="w-5 h-5" />
                Archive
              </button>

              <button 
                onClick={() => setShowDrawer(false)}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-r-full text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5"
              >
                <Trash2 className="w-5 h-5" />
                Trash
              </button>
            </nav>

            <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700/60 px-4 text-[11px] text-neutral-400">
              Google Notes • v12.4.1
            </div>
          </div>
        </div>
      )}

      {/* 3. Note Cards Feed (PINNED & OTHERS) */}
      <main className="flex-1 px-4 py-3 pb-24 overflow-y-auto">
        {filteredNotes.length === 0 ? (
          <div className="text-center py-28 flex flex-col items-center justify-center">
            <Lightbulb className="w-16 h-16 text-neutral-400 dark:text-neutral-600 stroke-[1.2] mb-4" />
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
              {notes.length === 0 ? 'Notes you add appear here' : 'No matching notes found'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pinned Section */}
            {pinnedNotes.length > 0 && (
              <div>
                <div className="text-[11px] font-bold tracking-wider text-neutral-500 dark:text-neutral-400 px-1 mb-2 uppercase">
                  PINNED
                </div>
                <div className={`grid gap-3 ${isGridView ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {pinnedNotes.map(note => renderNoteCard(note))}
                </div>
              </div>
            )}

            {/* Others Section */}
            {otherNotes.length > 0 && (
              <div>
                {pinnedNotes.length > 0 && (
                  <div className="text-[11px] font-bold tracking-wider text-neutral-500 dark:text-neutral-400 px-1 mb-2 uppercase">
                    OTHERS
                  </div>
                )}
                <div className={`grid gap-3 ${isGridView ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {otherNotes.map(note => renderNoteCard(note))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 4. Google Keep Bottom Dock ("Take a note...") */}
      <div className="fixed bottom-0 left-0 right-0 z-20 pb-safe">
        <div className={`mx-4 mb-4 px-4 py-2.5 rounded-full border shadow-lg flex items-center justify-between ${
          isSystemDark 
            ? 'bg-[#28292A] border-[#3C4043] shadow-black/40' 
            : 'bg-white border-neutral-200 shadow-neutral-300/40'
        }`}>
          {/* "Take a note..." text button */}
          <button 
            onClick={() => startNewNote(false)}
            className="flex-1 text-left text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white transition-colors"
          >
            Take a note...
          </button>

          {/* Quick Action Icons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button 
              onClick={() => startNewNote(true)}
              className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 transition-colors"
              title="New list"
            >
              <CheckSquare className="w-5 h-5" />
            </button>
            <button 
              onClick={() => startNewNote(false)}
              className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 transition-colors"
              title="New drawing note"
            >
              <PenTool className="w-5 h-5" />
            </button>
            <button 
              onClick={() => startNewNote(false)}
              className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 transition-colors"
              title="New voice note"
            >
              <Mic className="w-5 h-5" />
            </button>
            <button 
              onClick={() => startNewNote(false)}
              className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 transition-colors"
              title="New photo note"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Google Keep Full Screen Note Editor */}
      {editingNote && (
        <div className={`fixed inset-0 z-50 flex flex-col transition-colors ${
          getColorClasses(editingNote.color)
        }`}>
          {/* Editor Top Bar */}
          <header className="pt-9 pb-2 px-3 flex items-center justify-between border-b border-black/5 dark:border-white/5">
            <button 
              onClick={handleSaveAndCloseEditor}
              className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setEditingNote({ ...editingNote, pinned: !editingNote.pinned })}
                className={`p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
                  editingNote.pinned ? 'text-amber-500 fill-amber-500' : 'text-neutral-700 dark:text-neutral-200'
                }`}
                title={editingNote.pinned ? 'Unpin' : 'Pin'}
              >
                <Pin className={`w-5 h-5 ${editingNote.pinned ? 'fill-current' : ''}`} />
              </button>

              <button 
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 transition-colors"
                title="Color palette"
              >
                <Palette className="w-5 h-5" />
              </button>

              <button 
                onClick={handleDeleteCurrentNote}
                className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-red-500 hover:text-red-600 transition-colors"
                title="Delete note"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Keep Color Picker Swatches Row */}
          {showColorPicker && (
            <div className="px-4 py-2.5 flex items-center gap-2 overflow-x-auto bg-black/5 dark:bg-black/30 scrollbar-none border-b border-black/5 dark:border-white/5">
              {KEEP_COLORS.map(color => (
                <button
                  key={color.id}
                  onClick={() => setEditingNote({ ...editingNote, color: color.id })}
                  className={`w-8 h-8 rounded-full border-2 shrink-0 transition-transform ${
                    isSystemDark ? color.darkBg : color.lightBg
                  } ${
                    editingNote.color === color.id 
                      ? 'border-neutral-900 dark:border-white scale-110 shadow-sm' 
                      : 'border-transparent hover:scale-105'
                  }`}
                  title={color.name}
                >
                  {editingNote.color === color.id && (
                    <Check className="w-4 h-4 mx-auto text-neutral-900 dark:text-white" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Editor Body */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {/* Title */}
            <input 
              type="text"
              value={editingNote.title}
              onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
              placeholder="Title"
              className="w-full text-xl font-medium bg-transparent border-none focus:outline-none placeholder-neutral-500 dark:placeholder-neutral-400"
            />

            {/* Checklist Mode vs Standard Note Text */}
            {editingNote.isChecklist ? (
              <div className="space-y-3">
                {editingNote.checklistItems && editingNote.checklistItems.map(item => (
                  <div key={item.id} className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        const updated = editingNote.checklistItems?.map(i => i.id === item.id ? { ...i, done: !i.done } : i);
                        setEditingNote({ ...editingNote, checklistItems: updated });
                      }}
                      className="p-1 text-neutral-500 dark:text-neutral-400"
                    >
                      {item.done ? <CheckSquare className="w-5 h-5 text-green-500" /> : <Square className="w-5 h-5" />}
                    </button>
                    <input 
                      type="text"
                      value={item.text}
                      onChange={(e) => {
                        const updated = editingNote.checklistItems?.map(i => i.id === item.id ? { ...i, text: e.target.value } : i);
                        setEditingNote({ ...editingNote, checklistItems: updated });
                      }}
                      className={`flex-1 bg-transparent border-none focus:outline-none text-sm ${
                        item.done ? 'line-through text-neutral-400 dark:text-neutral-500' : 'text-inherit'
                      }`}
                    />
                    <button 
                      onClick={() => {
                        const updated = editingNote.checklistItems?.filter(i => i.id !== item.id);
                        setEditingNote({ ...editingNote, checklistItems: updated });
                      }}
                      className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {/* Add new checklist item row */}
                <div className="flex items-center gap-3 pt-2">
                  <Plus className="w-5 h-5 text-neutral-400 shrink-0" />
                  <input 
                    type="text"
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChecklistItemInEditor();
                      }
                    }}
                    placeholder="List item"
                    className="flex-1 bg-transparent border-none focus:outline-none text-sm placeholder-neutral-400"
                  />
                  {newChecklistText && (
                    <button 
                      onClick={handleAddChecklistItemInEditor}
                      className="text-xs font-semibold px-2 py-1 rounded bg-black/10 dark:bg-white/10"
                    >
                      Add
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <textarea 
                value={editingNote.content}
                onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                placeholder="Note"
                rows={12}
                className="w-full text-sm leading-relaxed bg-transparent border-none resize-none focus:outline-none placeholder-neutral-500 dark:placeholder-neutral-400"
              />
            )}
          </div>

          {/* Editor Footer Status */}
          <footer className="py-2.5 px-5 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 border-t border-black/5 dark:border-white/5">
            <button 
              onClick={() => {
                setEditingNote({
                  ...editingNote,
                  isChecklist: !editingNote.isChecklist,
                  checklistItems: !editingNote.isChecklist ? [{ id: 'c-1', text: editingNote.content, done: false }] : undefined,
                  content: editingNote.isChecklist ? (editingNote.checklistItems?.map(i => i.text).join('\n') || '') : ''
                });
              }}
              className="flex items-center gap-1.5 p-1 rounded hover:bg-black/5 dark:hover:bg-white/5"
            >
              <CheckSquare className="w-4 h-4" />
              {editingNote.isChecklist ? 'Hide checkboxes' : 'Show checkboxes'}
            </button>
            <span>Edited {editingNote.updatedAt}</span>
          </footer>
        </div>
      )}
    </div>
  );

  // Sub-renderer for individual Google Keep note card
  function renderNoteCard(note: NoteItem) {
    const cardColor = getColorClasses(note.color);

    return (
      <div
        key={note.id}
        onClick={() => setEditingNote(note)}
        className={`p-3.5 rounded-xl border shadow-xs hover:shadow-md transition-all cursor-pointer relative group flex flex-col justify-between ${cardColor}`}
      >
        <div>
          {/* Card Title & Pin Button */}
          <div className="flex items-start justify-between gap-1.5 mb-1.5">
            {note.title ? (
              <h3 className="text-sm font-semibold tracking-tight leading-snug line-clamp-2">
                {note.title}
              </h3>
            ) : null}
            <button 
              onClick={(e) => handleTogglePin(note.id, e)}
              className={`p-1 rounded-full transition-opacity ${
                note.pinned 
                  ? 'text-amber-500 opacity-100' 
                  : 'text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-neutral-700'
              }`}
            >
              <Pin className={`w-3.5 h-3.5 ${note.pinned ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Checklist Items Preview */}
          {note.isChecklist && note.checklistItems && note.checklistItems.length > 0 ? (
            <div className="space-y-1.5 my-1.5">
              {note.checklistItems.slice(0, 4).map(item => (
                <div 
                  key={item.id}
                  onClick={(e) => toggleChecklistItem(note.id, item.id, e)}
                  className="flex items-center gap-2 text-xs"
                >
                  {item.done ? (
                    <CheckSquare className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  )}
                  <span className={`line-clamp-1 ${item.done ? 'line-through opacity-50' : ''}`}>
                    {item.text}
                  </span>
                </div>
              ))}
              {note.checklistItems.length > 4 && (
                <div className="text-[10px] text-neutral-400 pt-0.5">
                  +{note.checklistItems.length - 4} more items
                </div>
              )}
            </div>
          ) : (
            /* Plain Text Preview */
            note.content ? (
              <p className="text-xs leading-relaxed line-clamp-5 text-neutral-700 dark:text-neutral-300 mb-2 whitespace-pre-line">
                {note.content}
              </p>
            ) : null
          )}
        </div>

        {/* Card Footer: Category label and timestamp */}
        <div className="flex items-center justify-between pt-2 mt-1 text-[10px] text-neutral-400">
          <span className="truncate max-w-[80px]">
            {note.category}
          </span>
          <span>
            {note.updatedAt}
          </span>
        </div>
      </div>
    );
  }
}
