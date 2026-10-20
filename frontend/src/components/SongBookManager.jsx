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
  FolderOpen
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
  const [songs, setSongs] = useState([]);
  const [setlists, setSetlists] = useState([]);
  const [selectedSetlist, setSelectedSetlist] = useState(null);
  const [selectedSong, setSelectedSong] = useState(null);
  const [fullSong, setFullSong] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingSong, setLoadingSong] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState('All');
  const [stats, setStats] = useState(null);

  // Reader Controls
  const [semitones, setSemitones] = useState(0);
  const [fontSize, setFontSize] = useState(15);
  const [columns, setColumns] = useState(1);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(2); // 1 to 5

  const chordSheetRef = useRef(null);
  const scrollIntervalRef = useRef(null);

  // Fetch song catalog & setlists
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoadingList(true);
    try {
      const [songsRes, setlistsRes, statsRes] = await Promise.all([
        api.getSongbookSongs({ limit: 1000 }).catch(() => ({ songs: [] })),
        api.getSongbookSetlists().catch(() => []),
        api.getSongbookStats().catch(() => null),
      ]);

      setSongs(songsRes.songs || []);
      setSetlists(setlistsRes || []);
      setStats(statsRes);

      // Default select the first song if none selected
      if (!selectedSong && songsRes.songs?.length > 0) {
        handleSelectSong(songsRes.songs[0]);
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

  // Parse ChordPro lines for rendering
  function renderChordProContent(content, semitonesShift) {
    if (!content) {
      return (
        <div className="text-slate-400 italic py-12 text-center text-sm">
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

          // Section directives e.g. {c: Verse 1}, {comment: Chorus}, {title: ...}
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
            // Ignore metadata directives in performance view
            if (['title', 'artist', 'key', 'tempo', 't', 'a'].includes(d)) {
              return null;
            }
          }

          // Line containing chords: e.g. "[G]This is the [C]air I breathe"
          if (line.includes('[') && line.includes(']')) {
            const parts = [];
            const regex = /\[([^\]]+)\]([^\[]*)/g;
            let match;
            let lastIndex = 0;

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
              <div key={idx} className="flex flex-wrap items-end my-1 min-h-[2.4em]">
                {parts.map((p, pIdx) => (
                  <div key={pIdx} className="inline-flex flex-col mr-1">
                    <span className="text-amber-600 dark:text-amber-400 font-bold font-mono text-[0.85em] leading-none mb-0.5 select-all">
                      {p.chord || '\u00A0'}
                    </span>
                    <span className="text-slate-800 dark:text-slate-200 whitespace-pre">
                      {p.text || (p.chord ? ' ' : '')}
                    </span>
                  </div>
                ))}
              </div>
            );
          }

          // Plain lyric line
          return (
            <div key={idx} className="text-slate-700 dark:text-slate-300 whitespace-pre py-0.5">
              {line}
            </div>
          );
        })}
      </div>
    );
  }

  const currentKey = getTransposedKey(fullSong?.key || selectedSong?.key, semitones);
  const setlistSongs = selectedSetlist?.songs || [];
  const currentSetlistIndex = setlistSongs.findIndex((s) => s.id === selectedSong?.id);

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)]">
      {/* Top Header & Overview Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Worship SongBook</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  SongBook Pro Live
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Browse church chord charts, transpose keys live, and flip through Sunday setlists
              </p>
            </div>
          </div>
        </div>

        {/* View Toggle: All Songs vs Setlists */}
        <div className="flex items-center gap-2">
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => {
                setActiveView('songs');
                setSelectedSetlist(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeView === 'songs'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>All Songs ({songs.length})</span>
            </button>
            <button
              onClick={() => setActiveView('setlists')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeView === 'setlists'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span>Setlists ({setlists.length})</span>
            </button>
          </div>

          <button
            onClick={loadData}
            title="Refresh library"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Browser / Right Chord Sheet */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 mt-4 min-h-0">
        {/* Left Column: Search & Song/Setlist List */}
        <div className="lg:col-span-4 flex flex-col bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 min-h-0">
          {activeView === 'songs' ? (
            <>
              {/* Search Bar */}
              <div className="relative mb-3">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search 946+ songs by title, artist..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Key Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-2 scrollbar-none">
                {KEY_OPTIONS.map((k) => (
                  <button
                    key={k}
                    onClick={() => setSelectedKey(k)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 transition-all cursor-pointer ${
                      selectedKey === k
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-amber-300'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>

              {/* Song List */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 min-h-0">
                {loadingList ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading Church Library...
                  </div>
                ) : filteredSongs.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No songs matched "{search}"
                  </div>
                ) : (
                  filteredSongs.map((song) => {
                    const isSelected = selectedSong?.id === song.id;
                    return (
                      <div
                        key={song.id}
                        onClick={() => handleSelectSong(song, null)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/40 shadow-sm'
                            : 'bg-white dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <h4
                            className={`text-xs font-bold truncate ${
                              isSelected
                                ? 'text-amber-900 dark:text-amber-300'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {song.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {song.artist || 'Unknown Artist'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
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
            /* Setlists View */
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 pb-1">
                Active Church Setlists ({setlists.length})
              </div>
              {setlists.map((setlist) => {
                const isSelected = selectedSetlist?.id === setlist.id;
                const count = Array.isArray(setlist.songIds)
                  ? setlist.songIds.length
                  : Array.isArray(setlist.songs)
                  ? setlist.songs.length
                  : 0;

                return (
                  <div
                    key={setlist.id}
                    onClick={() => handleSelectSetlist(setlist)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/40 shadow-sm'
                        : 'bg-white dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FolderOpen className={`w-4 h-4 ${isSelected ? 'text-amber-600' : 'text-slate-400'}`} />
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {setlist.name}
                        </h4>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {count} songs
                      </span>
                    </div>

                    {/* If selected setlist, show songs inside */}
                    {isSelected && selectedSetlist.songs && (
                      <div className="mt-2.5 pt-2 border-t border-amber-500/20 space-y-1">
                        {selectedSetlist.songs.map((s, idx) => (
                          <div
                            key={s.id || idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectSong(s, selectedSetlist);
                            }}
                            className={`px-2 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer ${
                              selectedSong?.id === s.id
                                ? 'bg-amber-500 text-white font-bold'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                            }`}
                          >
                            <span className="truncate">
                              {idx + 1}. {s.title}
                            </span>
                            <span className="text-[10px] opacity-80 shrink-0 ml-1">
                              {s.key || 'C'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Performance Chord Sheet Reader */}
        <div className="lg:col-span-8 flex flex-col bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl min-h-0 shadow-sm overflow-hidden">
          {selectedSong ? (
            <>
              {/* Reader Control Header */}
              <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
                {/* Title & Setlist Breadcrumb */}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                      {fullSong?.title || selectedSong?.title}
                    </h2>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                      Key: {currentKey}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {fullSong?.artist || selectedSong?.artist || 'Unknown Artist'}
                    {fullSong?.tempo ? ` • ${fullSong.tempo} BPM` : ''}
                    {selectedSetlist ? ` • In set: "${selectedSetlist.name}"` : ''}
                  </p>
                </div>

                {/* Setlist Step Navigation */}
                {selectedSetlist && setlistSongs.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => handleNavigateSetlist(-1)}
                      disabled={currentSetlistIndex <= 0}
                      className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      title="Previous song in set"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                    </button>
                    <span className="text-[11px] font-bold px-1.5 text-slate-700 dark:text-slate-300">
                      {currentSetlistIndex + 1} / {setlistSongs.length}
                    </span>
                    <button
                      onClick={() => handleNavigateSetlist(1)}
                      disabled={currentSetlistIndex >= setlistSongs.length - 1}
                      className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      title="Next song in set"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                    </button>
                  </div>
                )}

                {/* Action Controls: Transpose, Font, Auto-Scroll, Columns */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Transpose Widget */}
                  <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
                    <button
                      onClick={() => setSemitones((prev) => prev - 1)}
                      className="px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                      title="Transpose down 1 semitone"
                    >
                      ♭ -1
                    </button>
                    <button
                      onClick={() => setSemitones(0)}
                      className="px-2 py-1 text-[11px] font-extrabold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg cursor-pointer"
                      title="Reset to original key"
                    >
                      {semitones === 0
                        ? fullSong?.key || selectedSong?.key || 'C'
                        : `${semitones > 0 ? '+' : ''}${semitones} (${currentKey})`}
                    </button>
                    <button
                      onClick={() => setSemitones((prev) => prev + 1)}
                      className="px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                      title="Transpose up 1 semitone"
                    >
                      ♯ +1
                    </button>
                  </div>

                  {/* Auto-Scroll Toggle */}
                  <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
                    <button
                      onClick={() => setIsAutoScrolling(!isAutoScrolling)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                        isAutoScrolling
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {isAutoScrolling ? (
                        <>
                          <Pause className="w-3 h-3" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 text-emerald-500" />
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
                Choose any song from the left column to view chord sheet with live key transposing and auto-scroll.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
