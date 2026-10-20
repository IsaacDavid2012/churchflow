import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';

const SHARP_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
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

export default function SongBookScreen({ user, isDark = false }) {
  const [activeTab, setActiveTab] = useState('songs'); // 'songs' | 'setlists'
  const [songs, setSongs] = useState([]);
  const [setlists, setSetlists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState('All');

  // Reader Modal State
  const [selectedSong, setSelectedSong] = useState(null);
  const [fullSong, setFullSong] = useState(null);
  const [loadingSong, setLoadingSong] = useState(false);
  const [isReaderOpen, setIsReaderOpen] = useState(false);
  const [selectedSetlist, setSelectedSetlist] = useState(null);

  // Reader Controls
  const [semitones, setSemitones] = useState(0);
  const [fontSize, setFontSize] = useState(15);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(2);

  const scrollRef = useRef(null);
  const scrollOffsetRef = useRef(0);
  const scrollIntervalRef = useRef(null);

  const colors = {
    bg: isDark ? '#020617' : '#ffffff',
    card: isDark ? '#0f172a' : '#ffffff',
    border: isDark ? '#1e293b' : '#eadbc4',
    text: isDark ? '#ffffff' : '#0f172a',
    subText: isDark ? '#94a3b8' : '#64748b',
    primary: '#c59c6c',
    primaryLight: isDark ? '#3a2815' : '#f5ede1',
    inputBg: isDark ? '#1e293b' : '#fbf8f3',
    chord: isDark ? '#fbbf24' : '#b45309',
  };

  const fetchLibrary = async () => {
    try {
      setLoading(true);
      const [songsRes, setlistsRes] = await Promise.all([
        api.getSongbookSongs({ limit: 1000 }).catch(() => ({ songs: [] })),
        api.getSongbookSetlists().catch(() => []),
      ]);
      setSongs(songsRes.songs || []);
      setSetlists(setlistsRes || []);
    } catch (err) {
      console.error('Fetch SongBook library error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLibrary();
  }, []);

  const openSongReader = async (song, setlist = null) => {
    setSelectedSong(song);
    setSelectedSetlist(setlist);
    setSemitones(0);
    setIsAutoScrolling(false);
    setIsReaderOpen(true);
    setLoadingSong(true);

    try {
      const data = await api.getSongbookSong(song.id);
      setFullSong(data);
    } catch (err) {
      console.error('Failed to load song content:', err);
      setFullSong(song);
    } finally {
      setLoadingSong(false);
    }
  };

  const openSetlist = async (setlist) => {
    try {
      setLoading(true);
      const fullSet = await api.getSongbookSetlist(setlist.id);
      if (fullSet.songs && fullSet.songs.length > 0) {
        openSongReader(fullSet.songs[0], fullSet);
      } else {
        Alert.alert('Empty Setlist', 'This setlist does not contain any songs yet.');
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to open setlist');
    } finally {
      setLoading(false);
    }
  };

  // Next / Previous song in setlist
  const navigateSetlist = (direction) => {
    if (!selectedSetlist?.songs || selectedSetlist.songs.length === 0) return;
    const currentIndex = selectedSetlist.songs.findIndex((s) => s.id === selectedSong?.id);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < selectedSetlist.songs.length) {
      openSongReader(selectedSetlist.songs[nextIndex], selectedSetlist);
    }
  };

  // Auto-scroll effect
  useEffect(() => {
    if (isAutoScrolling) {
      scrollIntervalRef.current = setInterval(() => {
        if (scrollRef.current) {
          scrollOffsetRef.current += scrollSpeed * 2;
          scrollRef.current.scrollTo({ y: scrollOffsetRef.current, animated: true });
        }
      }, 100);
    } else {
      clearInterval(scrollIntervalRef.current);
    }
    return () => clearInterval(scrollIntervalRef.current);
  }, [isAutoScrolling, scrollSpeed]);

  const filteredSongs = songs.filter((s) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      (s.title || '').toLowerCase().includes(q) ||
      (s.artist || '').toLowerCase().includes(q);
    const matchKey = selectedKey === 'All' || (s.key || '').toUpperCase() === selectedKey.toUpperCase();
    return matchSearch && matchKey;
  });

  // Render ChordPro content
  const renderChordProLines = (content) => {
    if (!content) {
      return (
        <Text style={{ color: colors.subText, fontStyle: 'italic', marginVertical: 20 }}>
          No chord content available.
        </Text>
      );
    }

    const lines = content.split('\n');

    return lines.map((rawLine, idx) => {
      const line = rawLine.trimEnd();

      if (!line.trim()) {
        return <View key={idx} style={{ height: 14 }} />;
      }

      // Section tag e.g. {c: Verse 1}
      if (line.startsWith('{') && line.endsWith('}')) {
        const inner = line.slice(1, -1).trim();
        const [directive, ...valParts] = inner.split(':');
        const d = directive.trim().toLowerCase();
        const val = valParts.join(':').trim();

        if (['c', 'comment', 'section'].includes(d)) {
          return (
            <View key={idx} style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{val.toUpperCase()}</Text>
            </View>
          );
        }
        if (['title', 'artist', 'key', 'tempo', 't', 'a'].includes(d)) {
          return null;
        }
      }

      // ChordPro bracket line
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
            chord: transposeChord(match[1], semitones),
            text: match[2] || '',
          });
        }

        return (
          <View key={idx} style={styles.chordLineContainer}>
            {parts.map((p, pIdx) => (
              <View key={pIdx} style={styles.chordWordBox}>
                <Text
                  style={[
                    styles.chordText,
                    { color: colors.chord, fontSize: fontSize - 2 },
                  ]}
                >
                  {p.chord || ' '}
                </Text>
                <Text
                  style={[
                    styles.lyricText,
                    { color: colors.text, fontSize },
                  ]}
                >
                  {p.text || (p.chord ? ' ' : '')}
                </Text>
              </View>
            ))}
          </View>
        );
      }

      // Normal lyric line
      return (
        <Text key={idx} style={[styles.plainLyric, { color: colors.text, fontSize }]}>
          {line}
        </Text>
      );
    });
  };

  const currentKey = getTransposedKey(fullSong?.key || selectedSong?.key, semitones);
  const setlistSongs = selectedSetlist?.songs || [];
  const currentSetlistIndex = setlistSongs.findIndex((s) => s.id === selectedSong?.id);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Top Header & Switcher */}
      <View style={[styles.header, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.iconBadge, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="musical-notes" size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Worship SongBook</Text>
              <Text style={[styles.subText, { color: colors.subText }]}>
                {songs.length} Church Songs • SongBook Pro
              </Text>
            </View>
          </View>

          <TouchableOpacity onPress={fetchLibrary} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={18} color={colors.subText} />
          </TouchableOpacity>
        </View>

        {/* View Segmented Switch */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === 'songs' && { backgroundColor: colors.primary },
            ]}
            onPress={() => setActiveTab('songs')}
          >
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'songs' ? '#ffffff' : colors.subText },
              ]}
            >
              All Songs ({songs.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === 'setlists' && { backgroundColor: colors.primary },
            ]}
            onPress={() => setActiveTab('setlists')}
          >
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'setlists' ? '#ffffff' : colors.subText },
              ]}
            >
              Setlists ({setlists.length})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'songs' && (
          <>
            {/* Search Input */}
            <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Ionicons name="search" size={16} color={colors.subText} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                value={search}
                onChangeText={setSearch}
                placeholder="Search songs or artists..."
                placeholderTextColor={colors.subText}
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={16} color={colors.subText} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Key Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.keyRow}>
              {KEY_OPTIONS.map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[
                    styles.keyPill,
                    {
                      backgroundColor: selectedKey === k ? colors.primary : colors.inputBg,
                      borderColor: selectedKey === k ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedKey(k)}
                >
                  <Text
                    style={[
                      styles.keyPillText,
                      { color: selectedKey === k ? '#ffffff' : colors.text },
                    ]}
                  >
                    {k}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.subText }]}>Loading SongBook...</Text>
        </View>
      ) : activeTab === 'songs' ? (
        <FlatList
          data={filteredSongs}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.songCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => openSongReader(item, null)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.songTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.songArtist, { color: colors.subText }]} numberOfLines={1}>
                  {item.artist || 'Unknown Artist'}
                </Text>
              </View>
              <View style={[styles.keyBadge, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.keyBadgeText, { color: colors.primary }]}>{item.key || 'C'}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="musical-notes-outline" size={48} color={colors.subText} />
              <Text style={[styles.emptyText, { color: colors.text }]}>No songs found</Text>
            </View>
          }
        />
      ) : (
        /* Setlists Tab */
        <FlatList
          data={setlists}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const count = Array.isArray(item.songIds)
              ? item.songIds.length
              : Array.isArray(item.songs)
              ? item.songs.length
              : 0;

            return (
              <TouchableOpacity
                style={[styles.setlistCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => openSetlist(item)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="folder-open" size={24} color={colors.primary} />
                  <View>
                    <Text style={[styles.setlistName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.setlistSub, { color: colors.subText }]}>{count} songs in set</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.subText} />
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Full-Screen Stage Chord Sheet Modal */}
      <Modal visible={isReaderOpen} animationType="slide" onRequestClose={() => setIsReaderOpen(false)}>
        <SafeAreaView style={[styles.readerContainer, { backgroundColor: colors.bg }]}>
          {/* Reader Top Header */}
          <View style={[styles.readerHeader, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[styles.readerTitle, { color: colors.text }]} numberOfLines={1}>
                {fullSong?.title || selectedSong?.title}
              </Text>
              <Text style={[styles.readerArtist, { color: colors.subText }]} numberOfLines={1}>
                {fullSong?.artist || selectedSong?.artist}
                {selectedSetlist ? ` • Set: ${selectedSetlist.name}` : ''}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                setIsAutoScrolling(false);
                setIsReaderOpen(false);
              }}
              style={styles.closeBtn}
            >
              <Ionicons name="close-circle" size={28} color={colors.subText} />
            </TouchableOpacity>
          </View>

          {/* Reader Controls Toolbar */}
          <View style={[styles.readerToolbar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            {/* Transpose Widget */}
            <View style={styles.transposeWidget}>
              <TouchableOpacity
                onPress={() => setSemitones((prev) => prev - 1)}
                style={[styles.tBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.tBtnText, { color: colors.text }]}>♭ -1</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSemitones(0)}
                style={[styles.tPill, { backgroundColor: colors.primaryLight }]}
              >
                <Text style={[styles.tPillText, { color: colors.primary }]}>
                  {semitones === 0 ? `Key: ${currentKey}` : `${semitones > 0 ? '+' : ''}${semitones} (${currentKey})`}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSemitones((prev) => prev + 1)}
                style={[styles.tBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.tBtnText, { color: colors.text }]}>♯ +1</Text>
              </TouchableOpacity>
            </View>

            {/* Font & Auto-Scroll Controls */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {/* Font Size */}
              <TouchableOpacity
                onPress={() => setFontSize((s) => Math.max(12, s - 1))}
                style={[styles.iconBtnSmall, { borderColor: colors.border }]}
              >
                <Ionicons name="remove" size={14} color={colors.text} />
              </TouchableOpacity>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>{fontSize}</Text>
              <TouchableOpacity
                onPress={() => setFontSize((s) => Math.min(24, s + 1))}
                style={[styles.iconBtnSmall, { borderColor: colors.border }]}
              >
                <Ionicons name="add" size={14} color={colors.text} />
              </TouchableOpacity>

              {/* Auto Scroll */}
              <TouchableOpacity
                onPress={() => setIsAutoScrolling(!isAutoScrolling)}
                style={[
                  styles.autoScrollBtn,
                  { backgroundColor: isAutoScrolling ? '#ef4444' : colors.primary },
                ]}
              >
                <Ionicons name={isAutoScrolling ? 'pause' : 'play'} size={14} color="#fff" />
                <Text style={styles.autoScrollBtnText}>
                  {isAutoScrolling ? 'Stop' : 'Scroll'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Chord Sheet Body */}
          <ScrollView
            ref={scrollRef}
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetContent}
            onScroll={(e) => {
              scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
            {loadingSong ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.subText }]}>Loading chords...</Text>
              </View>
            ) : (
              renderChordProLines(fullSong?.content || selectedSong?.content)
            )}
          </ScrollView>

          {/* Setlist Next/Prev Bottom Bar */}
          {selectedSetlist && setlistSongs.length > 0 && (
            <View style={[styles.setlistBottomBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => navigateSetlist(-1)}
                disabled={currentSetlistIndex <= 0}
                style={[styles.setlistNavBtn, { opacity: currentSetlistIndex <= 0 ? 0.4 : 1 }]}
              >
                <Ionicons name="chevron-back" size={18} color={colors.primary} />
                <Text style={[styles.setlistNavText, { color: colors.primary }]}>Previous</Text>
              </TouchableOpacity>

              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.subText }}>
                Song {currentSetlistIndex + 1} of {setlistSongs.length}
              </Text>

              <TouchableOpacity
                onPress={() => navigateSetlist(1)}
                disabled={currentSetlistIndex >= setlistSongs.length - 1}
                style={[styles.setlistNavBtn, { opacity: currentSetlistIndex >= setlistSongs.length - 1 ? 0.4 : 1 }]}
              >
                <Text style={[styles.setlistNavText, { color: colors.primary }]}>Next</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: { padding: 14, borderBottomWidth: 1 },
  iconBadge: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '800' },
  subText: { fontSize: 11, fontWeight: '500' },
  refreshBtn: { padding: 8 },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 3,
    marginTop: 10,
    marginBottom: 8,
  },
  segmentBtn: { flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: 'center' },
  segmentText: { fontSize: 11, fontWeight: '700' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 12, paddingVertical: 0 },
  keyRow: { flexDirection: 'row', marginBottom: 2 },
  keyPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
  },
  keyPillText: { fontSize: 10, fontWeight: '700' },
  listContent: { padding: 12, gap: 8 },
  songCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  songTitle: { fontSize: 13, fontWeight: '700' },
  songArtist: { fontSize: 11, marginTop: 2 },
  keyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  keyBadgeText: { fontSize: 11, fontWeight: '800' },
  setlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  setlistName: { fontSize: 13, fontWeight: '700' },
  setlistSub: { fontSize: 11, marginTop: 2 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  loadingText: { fontSize: 12, marginTop: 8 },

  // Reader Modal Styles
  readerContainer: { flex: 1 },
  readerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  readerTitle: { fontSize: 16, fontWeight: '800' },
  readerArtist: { fontSize: 11, marginTop: 1 },
  closeBtn: { padding: 2 },
  readerToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  transposeWidget: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tBtn: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  tBtnText: { fontSize: 10, fontWeight: '700' },
  tPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tPillText: { fontSize: 10, fontWeight: '800' },
  iconBtnSmall: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  autoScrollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  autoScrollBtnText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  sheetScroll: { flex: 1 },
  sheetContent: { padding: 16, paddingBottom: 60 },
  sectionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(197, 156, 108, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 14,
    marginBottom: 6,
  },
  sectionBadgeText: { fontSize: 10, fontWeight: '800', color: '#b45309', letterSpacing: 0.5 },
  chordLineContainer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', marginVertical: 2 },
  chordWordBox: { marginRight: 4 },
  chordText: { fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', lineHeight: 14 },
  lyricText: { fontWeight: '500', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  plainLyric: { marginVertical: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  setlistBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  setlistNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  setlistNavText: { fontSize: 12, fontWeight: '700' },
});
