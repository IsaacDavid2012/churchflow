import React, { useState, useEffect, useRef } from 'react';
import {
  Music,
  Search,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  ListMusic,
  Columns,
  Layers,
  Sparkles,
  BookOpen,
  ArrowUpDown,
  Hash,
  ExternalLink,
  RefreshCw,
  FolderOpen,
  Upload,
  Download,
  Plus,
  Globe,
  Share2,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  User,
  Users
} from 'lucide-react';
import { api } from '../api';

const SHARP_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const FLAT_TO_SHARP = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
const KEY_OPTIONS = ['All', 'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

function transposeChord(chordStr, semitones) {
  if (semitones === 0 || !chordStr) return chordStr;
  const match = chordStr.match(/^([A-G][b#]?)(.*)$/);
  if (!match) return chordStr;
  const root = match[1];
  const modifier = match[2] || '';

  if (modifier.includes('/')) {
    const parts = modifier.split('/');
    return (
      transposeChord(root + parts[0], semitones) +
      '/' +
      transposeChord(parts[1], semitones)
    );
  }

  const normalized = FLAT_TO_SHARP[root] || root;
  const idx = SHARP_KEYS.indexOf(normalized);
  if (idx === -1) return chordStr;

  let newIdx = (idx + semitones) % 12;
  if (newIdx < 0) newIdx += 12;
  return SHARP_KEYS[newIdx] + modifier;
}

function getTransposedKey(originalKey, semitones) {
  if (semitones === 0 || !originalKey) return originalKey || 'C';
  return transposeChord(originalKey, semitones);
}

export default function SongBookManager({ currentUser }) {
  const [activeView, setActiveView] = useState('songs'); // 'songs' | 'setlists'
  const [scope, setScope] = useState('user'); // 'user' (personal) | 'team' (Jesus My Rock) | 'all'
  const [songs, setSongs] = useState([]);
  const [setlists, setSetlists] = useState([]);
  const [selectedSetlist, setSelectedSetlist] = useState(null);
  const [selectedSong, setSelectedSong] = useState(null);
  const [fullSong, setFullSong] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingSong, setLoadingSong] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState('All');
  const [userProfile, setUserProfile] = useState(null);
  const [toast, setToast] = useState(null);

  // Modals state
  const [isOnlineModalOpen, setIsOnlineModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSongModalOpen, setIsSongModalOpen] = useState(false);
  const [isSetlistModalOpen, setIsSetlistModalOpen] = useState(false);
  const [editingSong, setEditingSong] = useState(null);

  // Reader Controls
  const [semitones, setSemitones] = useState(0);
  const [fontSize, setFontSize] = useState(15);
  const [columns, setColumns] = useState(1);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(2); // 1 to 4

  const chordSheetRef = useRef(null);
  const scrollIntervalRef = useRef(null);

  // Online Search State
  const [onlineQuery, setOnlineQuery] = useState('');
  const [onlineSite, setOnlineSite] = useState('all');
  const [onlineResults, setOnlineResults] = useState([]);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlinePreviewSong, setOnlinePreviewSong] = useState(null);
  const [onlineImportingId, setOnlineImportingId] = useState(null);

  // File Import State
  const [importFile, setImportFile] = useState(null);
  const [importParsed, setImportParsed] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importStrategy, setImportStrategy] = useState('skip'); // 'skip' | 'overwrite' | 'duplicate'
  const [importTargetScope, setImportTargetScope] = useState('user');
  const [importing, setImporting] = useState(false);

  // Song Editor State
  const [songForm, setSongForm] = useState({
    title: '',
    artist: '',
    key: 'C',
    tempo: 100,
    tags: '',
    content: '',
    ownerType: 'user',
  });

  // Setlist Editor State
  const [setlistForm, setSetlistForm] = useState({
    name: '',
    ownerType: 'user',
    songIds: [],
  });

  // Show Toast Helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load Data whenever scope changes
  useEffect(() => {
    loadData();
  }, [scope]);

  async function loadData() {
    setLoadingList(true);
    try {
      const [songsRes, setlistsRes, profileRes] = await Promise.all([
        api.getSongbookSongs({ scope, limit: 1000 }).catch(() => ({ songs: [] })),
        api.getSongbookSetlists({ scope }).catch(() => []),
        api.getSongbookMe().catch(() => null),
      ]);

      const loadedSongs = songsRes.songs || [];
      setSongs(loadedSongs);
      setSetlists(setlistsRes || []);
      if (profileRes) setUserProfile(profileRes);

      // Default select the first song if none selected or not in current list
      if (!selectedSong && loadedSongs.length > 0) {
        handleSelectSong(loadedSongs[0]);
      } else if (selectedSong && !loadedSongs.some((s) => s.id === selectedSong.id)) {
        if (loadedSongs.length > 0) {
          handleSelectSong(loadedSongs[0]);
        } else {
          setSelectedSong(null);
          setFullSong(null);
        }
      }
    } catch (err) {
      console.error('Failed to load SongBook catalog:', err);
    } finally {
      setLoadingList(false);
    }
  }

  async function handleSelectSong(song, setlist = null) {
    if (!song?.id) return;
    setSelectedSong(song);
    setSelectedSetlist(setlist);
    setSemitones(0);
    setIsAutoScrolling(false);
    setLoadingSong(true);

    try {
      const data = await api.getSongbookSong(song.id);
      setFullSong(data);
    } catch (err) {
      console.error('Failed to fetch song details:', err);
      setFullSong(song);
    } finally {
      setLoadingSong(false);
    }
  }

  async function handleSelectSetlist(setlist) {
    try {
      setLoadingList(true);
      const fullSet = await api.getSongbookSetlist(setlist.id);
      setSelectedSetlist(fullSet);
      if (fullSet.songs && fullSet.songs.length > 0) {
        handleSelectSong(fullSet.songs[0], fullSet);
      }
    } catch (err) {
      console.error('Failed to fetch setlist:', err);
    } finally {
      setLoadingList(false);
    }
  }

  // Setlist Next / Prev Navigation
  function handleNavigateSetlist(direction) {
    if (!selectedSetlist?.songs || selectedSetlist.songs.length === 0) return;
    const currentIndex = selectedSetlist.songs.findIndex((s) => s.id === selectedSong?.id);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < selectedSetlist.songs.length) {
      handleSelectSong(selectedSetlist.songs[nextIndex], selectedSetlist);
    }
  }

  // Auto-scroll handler
  useEffect(() => {
    if (isAutoScrolling) {
      scrollIntervalRef.current = setInterval(() => {
        if (chordSheetRef.current) {
          chordSheetRef.current.scrollTop += scrollSpeed;
        }
      }, 50);
    } else {
      clearInterval(scrollIntervalRef.current);
    }
    return () => clearInterval(scrollIntervalRef.current);
  }, [isAutoScrolling, scrollSpeed]);

  // Filter songs
  const filteredSongs = songs.filter((s) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      (s.title || '').toLowerCase().includes(q) ||
      (s.artist || '').toLowerCase().includes(q);
    const matchKey = selectedKey === 'All' || (s.key || '').toUpperCase() === selectedKey.toUpperCase();
    return matchSearch && matchKey;
  });

  // --- Online Search Handler ---
  async function handleSearchOnline(e) {
    if (e) e.preventDefault();
    if (!onlineQuery.trim()) return;
    setOnlineLoading(true);
    setOnlineResults([]);
    setOnlinePreviewSong(null);
    try {
      const res = await api.searchSongbookOnline({ query: onlineQuery.trim(), site: onlineSite });
      setOnlineResults(res.results || []);
    } catch (err) {
      showToast(err.message || 'Online search failed', 'error');
    } finally {
      setOnlineLoading(false);
    }
  }

  async function handlePreviewOnline(item) {
    setOnlineLoading(true);
    try {
      const res = await api.fetchSongbookOnline({ url: item.url, site: item.site });
      setOnlinePreviewSong({ ...res, originalUrl: item.url, originalSite: item.site });
    } catch (err) {
      showToast(err.message || 'Failed to fetch online chords', 'error');
    } finally {
      setOnlineLoading(false);
    }
  }

  async function handleImportOnlineSong(itemOrPreview, targetOwnerType = 'user') {
    const url = itemOrPreview.url || itemOrPreview.originalUrl;
    const site = itemOrPreview.site || itemOrPreview.originalSite;
    if (!url) return;

    setOnlineImportingId(itemOrPreview.id || url);
    try {
      const saved = await api.importSongbookOnline({
        url,
        site,
        targetOwnerType,
      });
      showToast(`Imported "${saved.title}" into ${targetOwnerType === 'team' ? 'Team Library' : 'My Songs'}!`);
      loadData();
      setIsOnlineModalOpen(false);
    } catch (err) {
      showToast(err.message || 'Failed to import online song', 'error');
    } finally {
      setOnlineImportingId(null);
    }
  }

  // --- Backup & File Import Handler ---
  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImporting(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const content = reader.result;
          let parsePayload = { fileName: file.name };
          if (file.name.endsWith('.sbp') || file.name.endsWith('.sbpbackup') || file.name.endsWith('.zip')) {
            const base64 = content.split(',')[1] || content;
            parsePayload.fileBase64 = base64;
          } else {
            parsePayload.fileText = content;
          }

          const parsed = await api.parseSongbookBackup(parsePayload);
          setImportParsed(parsed);

          const preview = await api.previewSongbookBackup({
            backupData: parsed,
            targetOwnerType: importTargetScope,
            fileName: file.name,
          });
          setImportPreview(preview);
        } catch (err) {
          showToast(err.message || 'Failed to parse file', 'error');
        } finally {
          setImporting(false);
        }
      };

      if (file.name.endsWith('.sbp') || file.name.endsWith('.sbpbackup') || file.name.endsWith('.zip')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    } catch (err) {
      showToast(err.message || 'Error reading file', 'error');
      setImporting(false);
    }
  }

  async function handleCommitImport() {
    if (!importParsed) return;
    setImporting(true);
    try {
      const res = await api.importSongbookBackup({
        backupData: importParsed,
        targetOwnerType: importTargetScope,
        strategy: importStrategy,
      });
      showToast(`Import complete: ${res.songsImported || 0} songs added/updated!`);
      setIsImportModalOpen(false);
      setImportFile(null);
      setImportParsed(null);
      setImportPreview(null);
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to commit import', 'error');
    } finally {
      setImporting(false);
    }
  }

  // --- Song Create / Edit Handlers ---
  function openAddSongModal() {
    setEditingSong(null);
    setSongForm({
      title: '',
      artist: '',
      key: 'C',
      tempo: 100,
      tags: '',
      content: '{c:Verse 1}\n[C]Write chords inside [G]brackets\n[Am]Followed by the [F]lyrics',
      ownerType: scope === 'team' ? 'team' : 'user',
    });
    setIsSongModalOpen(true);
  }

  function openEditSongModal(song) {
    if (!song) return;
    setEditingSong(song);
    setSongForm({
      title: song.title || '',
      artist: song.artist || '',
      key: song.key || 'C',
      tempo: song.tempo || 100,
      tags: Array.isArray(song.tags) ? song.tags.join(', ') : '',
      content: fullSong?.content || song.content || '',
      ownerType: song.ownerType || 'user',
    });
    setIsSongModalOpen(true);
  }

  async function handleSaveSong(e) {
    if (e) e.preventDefault();
    if (!songForm.title.trim()) {
      showToast('Song title is required', 'error');
      return;
    }

    try {
      const payload = {
        title: songForm.title.trim(),
        artist: songForm.artist.trim(),
        key: songForm.key,
        tempo: parseInt(songForm.tempo, 10) || 100,
        tags: songForm.tags ? songForm.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        content: songForm.content,
        ownerType: songForm.ownerType,
      };

      if (editingSong?.id) {
        await api.updateSongbookSong(editingSong.id, payload);
        showToast('Song updated successfully!');
      } else {
        const created = await api.createSongbookSong(payload);
        showToast('Song created successfully!');
        if (created?.id) handleSelectSong(created);
      }

      setIsSongModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to save song', 'error');
    }
  }

  async function handleDeleteSong(songId) {
    if (!window.confirm('Are you sure you want to delete this song from your library?')) return;
    try {
      await api.deleteSongbookSong(songId);
      showToast('Song deleted');
      setSelectedSong(null);
      setFullSong(null);
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to delete song', 'error');
    }
  }

  async function handleCopySongToScope(songId, targetScope) {
    try {
      await api.copySongbookSong(songId, { targetScope });
      showToast(`Song copied to ${targetScope === 'team' ? 'Team Library' : 'My Songs'}!`);
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to copy song', 'error');
    }
  }

  // --- Setlist Create Handlers ---
  function openAddSetlistModal() {
    setSetlistForm({
      name: '',
      ownerType: scope === 'team' ? 'team' : 'user',
      songIds: selectedSong ? [selectedSong.id] : [],
    });
    setIsSetlistModalOpen(true);
  }

  async function handleSaveSetlist(e) {
    if (e) e.preventDefault();
    if (!setlistForm.name.trim()) {
      showToast('Setlist name is required', 'error');
      return;
    }

    try {
      await api.createSongbookSetlist({
        name: setlistForm.name.trim(),
        ownerType: setlistForm.ownerType,
        songIds: setlistForm.songIds,
      });
      showToast('Setlist created!');
      setIsSetlistModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to save setlist', 'error');
    }
  }

  async function handleDeleteSetlist(setlistId) {
    if (!window.confirm('Delete this setlist?')) return;
    try {
      await api.deleteSongbookSetlist(setlistId);
      showToast('Setlist deleted');
      setSelectedSetlist(null);
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to delete setlist', 'error');
    }
  }

  // Parse ChordPro lines for stage reader
  function renderChordProContent(content, semitonesShift) {
    if (!content) {
      return (
        <div className="text-slate-400 italic py-16 text-center text-sm">
          No chord content available for this song.
        </div>
      );
    }

    const lines = content.split('\n');

    return (
      <div
        className={`font-mono leading-relaxed transition-all ${
          columns === 2 ? 'sm:columns-2 gap-8' : ''
        }`}
        style={{ fontSize: `${fontSize}px` }}
      >
        {lines.map((rawLine, idx) => {
          const line = rawLine.trimEnd();

          // Empty line
          if (!line.trim()) {
            return <div key={idx} className="h-4" />;
          }

          // Section directives e.g. {c: Verse 1}, {comment: Chorus}
          if (line.startsWith('{') && line.endsWith('}')) {
            const inner = line.slice(1, -1).trim();
            const [directive, ...valParts] = inner.split(':');
            const d = directive.trim().toLowerCase();
            const val = valParts.join(':').trim();

            if (['c', 'comment', 'section'].includes(d)) {
              return (
                <div
                  key={idx}
                  className="mt-5 mb-2 inline-block px-2.5 py-1 rounded-md text-[11px] font-sans font-extrabold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                >
                  {val || inner}
                </div>
              );
            }
            if (['title', 'artist', 'key', 'tempo', 't', 'a'].includes(d)) {
              return null;
            }
          }

          // Line containing chords: e.g. "[G]This is the [C]air I breathe"
          if (line.includes('[') && line.includes(']')) {
            const parts = [];
            const regex = /\[([^\]]+)\]([^\[]*)/g;
            let match;
            const firstBracket = line.indexOf('[');
            if (firstBracket > 0) {
              parts.push({
                chord: '',
                text: line.substring(0, firstBracket),
              });
            }

            while ((match = regex.exec(line)) !== null) {
              parts.push({
                chord: transposeChord(match[1], semitonesShift),
                text: match[2] || '',
              });
            }

            return (
              <div key={idx} className="flex flex-wrap items-end my-1 break-inside-avoid">
                {parts.map((p, pIdx) => (
                  <div key={pIdx} className="inline-flex flex-col mr-1">
                    <span className="text-amber-600 dark:text-amber-400 font-bold text-[0.88em] leading-none mb-0.5 select-none">
                      {p.chord || '\u00A0'}
                    </span>
                    <span className="text-slate-800 dark:text-slate-200 whitespace-pre">
                      {p.text || '\u00A0'}
                    </span>
                  </div>
                ))}
              </div>
            );
          }

          // Plain lyric line
          return (
            <div key={idx} className="text-slate-700 dark:text-slate-300 my-0.5 break-inside-avoid">
              {line}
            </div>
          );
        })}
      </div>
    );
  }

  const currentDisplayKey = getTransposedKey(
    selectedSong?.key || fullSong?.key || 'C',
    semitones
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] bg-slate-50 dark:bg-slate-900 overflow-hidden relative">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`absolute top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold transition-all ${
            toast.type === 'error'
              ? 'bg-red-500 text-white'
              : 'bg-emerald-600 text-white'
          }`}
        >
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header & Scope Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                SongBook
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                Connected
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {userProfile?.songbookUsername ? `Library for ${userProfile.songbookUsername}` : 'Worship Team Song Engine'}
            </p>
          </div>
        </div>

        {/* Scope Pill Selector */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
          <button
            onClick={() => setScope('user')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              scope === 'user'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>My Songs</span>
            {userProfile?.personalSongCount !== undefined && scope === 'user' && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-600">
                {userProfile.personalSongCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setScope('team')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              scope === 'team'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Jesus My Rock Team</span>
          </button>
          <button
            onClick={() => setScope('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              scope === 'all'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>All</span>
          </button>
        </div>

        {/* Action Buttons: Online Search, Import, Export, Add */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsOnlineModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 transition-all cursor-pointer"
            title="Search chords online from UltimateGuitar & WorshipTogether"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Search Online</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
            title="Import .sbp or ChordPro files"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import .sbp</span>
          </button>

          <button
            onClick={() => api.exportSongbookBackup({ ownerType: scope === 'team' ? 'team' : 'user' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
            title="Download library backup as .sbp"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            onClick={openAddSongModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Song</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Songs / Setlists Navigation */}
        <div className="w-80 md:w-96 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0">
          {/* View Switcher: Songs vs Setlists */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex gap-2">
            <button
              onClick={() => setActiveView('songs')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeView === 'songs'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Songs ({filteredSongs.length})</span>
            </button>
            <button
              onClick={() => setActiveView('setlists')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeView === 'setlists'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span>Setlists ({setlists.length})</span>
            </button>
          </div>

          {activeView === 'songs' ? (
            <>
              {/* Search & Key Filter Bar */}
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search title, artist, lyric..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Key Chips */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] scrollbar-none">
                  <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0 mr-1">
                    Key:
                  </span>
                  {KEY_OPTIONS.map((k) => (
                    <button
                      key={k}
                      onClick={() => setSelectedKey(k)}
                      className={`px-2 py-0.5 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                        selectedKey === k
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>

              {/* Songs List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {loadingList ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading catalog...
                  </div>
                ) : filteredSongs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No songs found matching query.
                  </div>
                ) : (
                  filteredSongs.map((song) => {
                    const isSelected = selectedSong?.id === song.id;
                    return (
                      <div
                        key={song.id}
                        onClick={() => handleSelectSong(song)}
                        className={`p-3 text-left transition-all cursor-pointer flex items-center justify-between group ${
                          isSelected
                            ? 'bg-amber-50 dark:bg-amber-500/10 border-l-4 border-amber-500'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {song.title}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-2">
                            <span>{song.artist || 'Unknown Artist'}</span>
                            {song.ownerType === 'team' && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/10 text-blue-600">
                                Team
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-[10px] flex items-center justify-center border border-slate-200 dark:border-slate-700">
                            {song.key || 'C'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <>
              {/* Setlists View */}
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Worship Setlists</span>
                <button
                  onClick={openAddSetlistModal}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Setlist</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {setlists.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No setlists found. Click "New Setlist" to build a worship order.
                  </div>
                ) : (
                  setlists.map((sl) => {
                    const isSelected = selectedSetlist?.id === sl.id;
                    const count = sl.songs?.length || (sl.songIds || []).length || 0;
                    return (
                      <div
                        key={sl.id}
                        onClick={() => handleSelectSetlist(sl)}
                        className={`p-3.5 text-left transition-all cursor-pointer flex items-center justify-between group ${
                          isSelected
                            ? 'bg-amber-50 dark:bg-amber-500/10 border-l-4 border-amber-500'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-xs text-slate-900 dark:text-white">
                            {sl.name}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {count} song{count !== 1 ? 's' : ''} • {sl.ownerType === 'team' ? 'Jesus My Rock Team' : 'Personal'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSetlist(sl.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-opacity"
                            title="Delete Setlist"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Right Stage Reader: Live Transpose, Performance Auto-Scroll, Chords */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 overflow-hidden">
          {selectedSong ? (
            <>
              {/* Reader Control Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/50">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-slate-900 dark:text-white truncate">
                      {selectedSong.title}
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                      Key: {currentDisplayKey}
                    </span>
                    {selectedSong.ownerType === 'team' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                        Team Song
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20">
                        Personal
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {selectedSong.artist || 'Unknown Artist'} {selectedSong.tempo ? `• ${selectedSong.tempo} BPM` : ''}
                  </p>
                </div>

                {/* Reader Controls Toolbar */}
                <div className="flex items-center flex-wrap gap-2 text-xs">
                  {/* Setlist Next/Prev Navigation */}
                  {selectedSetlist?.songs && (
                    <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 mr-2">
                      <button
                        onClick={() => handleNavigateSetlist(-1)}
                        className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title="Previous song in setlist"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-[11px] font-bold px-2 text-slate-600 dark:text-slate-400">
                        Setlist ({selectedSetlist.songs.findIndex((s) => s.id === selectedSong.id) + 1}/{selectedSetlist.songs.length})
                      </span>
                      <button
                        onClick={() => handleNavigateSetlist(1)}
                        className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title="Next song in setlist"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Transpose Key Controls */}
                  <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
                    <button
                      onClick={() => setSemitones((s) => s - 1)}
                      className="px-2 py-1 rounded-lg font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Transpose -1 semitone (b)"
                    >
                      ♭ -1
                    </button>
                    <span className="px-2 text-xs font-black text-amber-600 dark:text-amber-400 min-w-[32px] text-center">
                      {currentDisplayKey}
                    </span>
                    <button
                      onClick={() => setSemitones((s) => s + 1)}
                      className="px-2 py-1 rounded-lg font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Transpose +1 semitone (#)"
                    >
                      ♯ +1
                    </button>
                    {semitones !== 0 && (
                      <button
                        onClick={() => setSemitones(0)}
                        className="p-1 text-slate-400 hover:text-slate-600"
                        title="Reset to original key"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Auto-scroll Controller */}
                  <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
                    <button
                      onClick={() => setIsAutoScrolling(!isAutoScrolling)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        isAutoScrolling
                          ? 'bg-amber-500 text-white'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {isAutoScrolling ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>Scroll</span>
                        </>
                      )}
                    </button>
                    {isAutoScrolling && (
                      <select
                        value={scrollSpeed}
                        onChange={(e) => setScrollSpeed(Number(e.target.value))}
                        className="text-[10px] font-bold bg-transparent text-slate-700 dark:text-slate-300 px-1 focus:outline-none"
                      >
                        <option value={1}>1x</option>
                        <option value={2}>2x</option>
                        <option value={3}>3x</option>
                        <option value={4}>4x</option>
                      </select>
                    )}
                  </div>

                  {/* Font Size Adjuster */}
                  <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
                    <button
                      onClick={() => setFontSize((s) => Math.max(11, s - 1))}
                      className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Smaller font"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 px-1">
                      {fontSize}
                    </span>
                    <button
                      onClick={() => setFontSize((s) => Math.min(26, s + 1))}
                      className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Larger font"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Multi-column toggle */}
                  <button
                    onClick={() => setColumns((c) => (c === 1 ? 2 : 1))}
                    className={`p-2 rounded-xl border transition-all cursor-pointer ${
                      columns === 2
                        ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title={columns === 1 ? 'Switch to 2 columns' : 'Switch to 1 column'}
                  >
                    <Columns className="w-3.5 h-3.5" />
                  </button>

                  {/* Edit Song Button */}
                  <button
                    onClick={() => openEditSongModal(selectedSong)}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    title="Edit Song"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  {/* Copy to Scope Button */}
                  {selectedSong.ownerType === 'user' ? (
                    <button
                      onClick={() => handleCopySongToScope(selectedSong.id, 'team')}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Copy to Jesus My Rock Team Library"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCopySongToScope(selectedSong.id, 'user')}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Copy to My Personal Library"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Delete Song Button */}
                  <button
                    onClick={() => handleDeleteSong(selectedSong.id)}
                    className="p-2 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                    title="Delete Song"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Chord Sheet Viewer Area */}
              <div
                ref={chordSheetRef}
                className="flex-1 overflow-y-auto p-6 md:p-8 select-text bg-white dark:bg-slate-950"
              >
                {loadingSong ? (
                  <div className="py-24 text-center text-xs text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading Chord Sheet...
                  </div>
                ) : (
                  renderChordProContent(fullSong?.content || selectedSong?.content, semitones)
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <BookOpen className="w-12 h-12 stroke-[1.2] mb-3 text-slate-300 dark:text-slate-700" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Select a song to open chord chart
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Choose any song from the left column or search online to view live chords with transposition and auto-scrolling.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL 1: Online Search & 1-Click Import --- */}
      {isOnlineModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Search & Import Songs Online
                </h3>
              </div>
              <button
                onClick={() => setIsOnlineModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input Bar */}
            <form onSubmit={handleSearchOnline} className="p-4 border-b border-slate-200 dark:border-slate-800 flex gap-2">
              <input
                type="text"
                value={onlineQuery}
                onChange={(e) => setOnlineQuery(e.target.value)}
                placeholder="Search song title or artist (e.g. Goodness Of God, Way Maker)..."
                className="flex-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs border border-transparent focus:border-amber-500 focus:outline-none dark:text-white"
              />
              <select
                value={onlineSite}
                onChange={(e) => setOnlineSite(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold border border-transparent focus:border-amber-500 focus:outline-none dark:text-white"
              >
                <option value="all">All Sources</option>
                <option value="ug">UltimateGuitar</option>
                <option value="wt">WorshipTogether</option>
              </select>
              <button
                type="submit"
                disabled={onlineLoading}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {onlineLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>Search</span>
              </button>
            </form>

            {/* Search Results / Preview Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {onlinePreviewSong ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20">
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">
                        {onlinePreviewSong.title}
                      </div>
                      <div className="text-xs text-slate-500">
                        {onlinePreviewSong.artist} • Key: {onlinePreviewSong.key || 'C'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setOnlinePreviewSong(null)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      >
                        Back to Results
                      </button>
                      <button
                        onClick={() => handleImportOnlineSong(onlinePreviewSong, 'user')}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Import to My Songs</span>
                      </button>
                    </div>
                  </div>
                  <pre className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 font-mono text-xs overflow-x-auto text-slate-800 dark:text-slate-200 max-h-80">
                    {onlinePreviewSong.content}
                  </pre>
                </div>
              ) : onlineLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                  Searching online chord catalogs...
                </div>
              ) : onlineResults.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Type a song title above and press Search to find chords from UltimateGuitar and WorshipTogether.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {onlineResults.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-xl"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>{item.artist}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600">
                            {item.site}
                          </span>
                          {item.key && <span>Key: {item.key}</span>}
                          {item.rating && <span>★ {item.rating}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handlePreviewOnline(item)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => handleImportOnlineSong(item, 'user')}
                          disabled={onlineImportingId === (item.id || item.url)}
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          {onlineImportingId === (item.id || item.url) ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span>Import</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Universal File Upload / Import (.sbp, ChordPro) --- */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Import .sbp or ChordPro File
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportFile(null);
                  setImportPreview(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dropzone */}
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center hover:border-amber-500 transition-all cursor-pointer relative">
              <input
                type="file"
                accept=".sbp,.sbpbackup,.pro,.cho,.chopro,.txt,.zip"
                onChange={handleFileSelected}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <FileText className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {importFile ? importFile.name : 'Choose or drop .sbp / ChordPro file'}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Supports SongBook Pro (.sbp, .sbpbackup), ChordPro (.cho, .pro), and text (.txt)
              </div>
            </div>

            {/* Dry-Run Preview Summary */}
            {importPreview && (
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl space-y-3 text-xs">
                <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>Found in File:</span>
                  <span className="text-amber-600">{importPreview.totalIncomingSongs} Songs, {importPreview.totalIncomingSetlists || 0} Setlists</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold">
                    + {importPreview.toAddCount} New Songs
                  </div>
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-semibold">
                    ⚠ {importPreview.conflictCount} Existing Matches
                  </div>
                </div>

                {/* Target Scope */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Import Destination
                  </label>
                  <select
                    value={importTargetScope}
                    onChange={(e) => setImportTargetScope(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs dark:text-white"
                  >
                    <option value="user">My Personal Songs</option>
                    <option value="team">Jesus My Rock Team Library</option>
                  </select>
                </div>

                {/* Conflict Strategy */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Conflict Strategy (For Existing Songs)
                  </label>
                  <select
                    value={importStrategy}
                    onChange={(e) => setImportStrategy(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs dark:text-white"
                  >
                    <option value="skip">Skip duplicates (Keep existing)</option>
                    <option value="overwrite">Overwrite existing songs</option>
                    <option value="duplicate">Duplicate (Keep both)</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCommitImport}
                disabled={!importParsed || importing}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {importing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Import Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: Add / Edit Song Modal --- */}
      {isSongModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {editingSong ? 'Edit Song' : 'Add New Song'}
              </h3>
              <button
                onClick={() => setIsSongModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSong} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={songForm.title}
                    onChange={(e) => setSongForm({ ...songForm, title: e.target.value })}
                    placeholder="e.g. 10,000 Reasons"
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs dark:text-white border-none focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Artist / Author
                  </label>
                  <input
                    type="text"
                    value={songForm.artist}
                    onChange={(e) => setSongForm({ ...songForm, artist: e.target.value })}
                    placeholder="e.g. Matt Redman"
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs dark:text-white border-none focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Key
                  </label>
                  <select
                    value={songForm.key}
                    onChange={(e) => setSongForm({ ...songForm, key: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold dark:text-white border-none focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    {SHARP_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Tempo (BPM)
                  </label>
                  <input
                    type="number"
                    value={songForm.tempo}
                    onChange={(e) => setSongForm({ ...songForm, tempo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs dark:text-white border-none focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Save To Library
                  </label>
                  <select
                    value={songForm.ownerType}
                    onChange={(e) => setSongForm({ ...songForm, ownerType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold dark:text-white border-none focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="user">My Songs</option>
                    <option value="team">Jesus My Rock Team</option>
                  </select>
                </div>
              </div>

              {/* ChordPro Lyric Content with Quick Helpers */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-500">
                    ChordPro Lyrics & Chords
                  </label>
                  {/* Quick Insert Buttons */}
                  <div className="flex items-center gap-1">
                    {['[C]', '[G]', '[Am]', '[F]', '[D]', '{c:Chorus}'].map((helper) => (
                      <button
                        key={helper}
                        type="button"
                        onClick={() => {
                          setSongForm({ ...songForm, content: songForm.content + ' ' + helper });
                        }}
                        className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-amber-500/10 hover:text-amber-600 text-[10px] font-mono font-bold"
                      >
                        {helper}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={10}
                  value={songForm.content}
                  onChange={(e) => setSongForm({ ...songForm, content: e.target.value })}
                  placeholder="[G]Bless the Lord, O my [C]soul"
                  className="w-full p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 font-mono text-xs dark:text-white border-none focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSongModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white cursor-pointer"
                >
                  Save Song
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 4: New Setlist Modal --- */}
      {isSetlistModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Create New Setlist
              </h3>
              <button
                onClick={() => setIsSetlistModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSetlist} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Setlist Name *
                </label>
                <input
                  type="text"
                  required
                  value={setlistForm.name}
                  onChange={(e) => setSetlistForm({ ...setlistForm, name: e.target.value })}
                  placeholder="e.g. Sunday Celebration 25 Oct"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs dark:text-white border-none focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Scope
                </label>
                <select
                  value={setlistForm.ownerType}
                  onChange={(e) => setSetlistForm({ ...setlistForm, ownerType: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold dark:text-white border-none focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="user">Personal Setlist</option>
                  <option value="team">Jesus My Rock Team Setlist</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSetlistModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white cursor-pointer"
                >
                  Create Setlist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
