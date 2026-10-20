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
  const [activeTab, setActiveTab] = useState('user'); // 'user' (My Songs) | 'team' (Jesus My Rock) | 'setlists' | 'online'
  const [songs, setSongs] = useState([]);
  const [setlists, setSetlists] = useState([]);
  const [profile, setProfile] = useState(null);
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

  // Online Search State
  const [onlineQuery, setOnlineQuery] = useState('');
  const [onlineSite, setOnlineSite] = useState('all');
  const [onlineResults, setOnlineResults] = useState([]);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [importingOnlineId, setImportingOnlineId] = useState(null);

  // Add / Edit Song Modal State
  const [isAddSongModalOpen, setIsAddSongModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [newKey, setNewKey] = useState('C');
  const [newContent, setNewContent] = useState('');
  const [savingSong, setSavingSong] = useState(false);

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

  const fetchLibrary = async (targetScope = activeTab) => {
    try {
      setLoading(true);
      const scopeParam = targetScope === 'team' ? 'team' : 'user';
      const [songsRes, setlistsRes, meRes] = await Promise.all([
        api.getSongbookSongs({ scope: scopeParam, limit: 1000 }).catch(() => ({ songs: [] })),
        api.getSongbookSetlists({ scope: scopeParam }).catch(() => []),
        api.getSongbookMe().catch(() => null),
      ]);
      setSongs(songsRes.songs || []);
      setSetlists(setlistsRes || []);
      if (meRes) setProfile(meRes);
    } catch (err) {
      console.error('Fetch SongBook library error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'user' || activeTab === 'team' || activeTab === 'setlists') {
      fetchLibrary(activeTab);
    }
  }, [activeTab]);

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

  // Online Search
  const handleSearchOnline = async () => {
    if (!onlineQuery.trim()) return;
    setOnlineLoading(true);
    setOnlineResults([]);
    try {
      const res = await api.searchSongbookOnline({ query: onlineQuery.trim(), site: onlineSite });
      setOnlineResults(res.results || []);
    } catch (err) {
      Alert.alert('Online Search Failed', err.message || 'Could not query online sources');
    } finally {
      setOnlineLoading(false);
    }
  };

  const handleImportOnline = async (item) => {
    setImportingOnlineId(item.id || item.url);
    try {
      const saved = await api.importSongbookOnline({
        url: item.url,
        site: item.site,
        targetOwnerType: activeTab === 'team' ? 'team' : 'user',
      });
      Alert.alert('Imported!', `"${saved.title}" has been added to your songbook library.`);
      fetchLibrary(activeTab);
    } catch (err) {
      Alert.alert('Import Failed', err.message || 'Could not import song');
    } finally {
      setImportingOnlineId(null);
    }
  };

  // Add Song
  const handleSaveNewSong = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Required', 'Please enter a song title');
      return;
    }
    setSavingSong(true);
    try {
      const saved = await api.createSongbookSong({
        title: newTitle.trim(),
        artist: newArtist.trim(),
        key: newKey,
        content: newContent || '{c:Verse 1}\n[C]Enter lyrics here',
        ownerType: activeTab === 'team' ? 'team' : 'user',
      });
      setIsAddSongModalOpen(false);
      setNewTitle('');
      setNewArtist('');
      setNewContent('');
      fetchLibrary(activeTab);
      openSongReader(saved);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save song');
    } finally {
      setSavingSong(false);
    }
  };

  // Delete Song
  const handleDeleteSong = (songId) => {
    Alert.alert('Delete Song', 'Are you sure you want to delete this song from your library?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteSongbookSong(songId);
            setIsReaderOpen(false);
            fetchLibrary(activeTab);
          } catch (err) {
            Alert.alert('Error', err.message || 'Failed to delete song');
          }
        },
      },
    ]);
  };

  // Copy Song Between Scopes
  const handleCopySong = async (songId, targetScope) => {
    try {
      await api.copySongbookSong(songId, { targetScope });
      Alert.alert('Copied!', `Song copied to ${targetScope === 'team' ? 'Team Library' : 'My Songs'}`);
      fetchLibrary(activeTab);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to copy song');
    }
  };

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
          parts.push({ chord: '', text: line.substring(0, firstBracket) });
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
              <View key={pIdx} style={styles.chordPair}>
                <Text style={[styles.chordText, { fontSize: fontSize * 0.9, color: colors.chord }]}>
                  {p.chord || ' '}
                </Text>
                <Text style={[styles.lyricText, { fontSize, color: colors.text }]}>
                  {p.text || ' '}
                </Text>
              </View>
            ))}
          </View>
        );
      }

      // Plain lyric line
      return (
        <Text key={idx} style={[styles.plainLyric, { fontSize, color: colors.text }]}>
          {line}
        </Text>
      );
    });
  };

  const currentKey = getTransposedKey(fullSong?.key || selectedSong?.key || 'C', semitones);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Scope Selector Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>SongBook</Text>
            <Text style={[styles.subTitle, { color: colors.subText }]}>
              {profile?.songbookUsername ? `Signed in as ${profile.songbookUsername}` : 'Worship Songs & Chords'}
            </Text>
          </View>

          {/* Add Song Button */}
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => setIsAddSongModalOpen(true)}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>New Song</Text>
          </TouchableOpacity>
        </View>

        {/* 4-Tab Scope Bar */}
        <View style={[styles.tabBar, { backgroundColor: colors.inputBg }]}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'user' && [styles.tabBtnActive, { backgroundColor: colors.card }]]}
            onPress={() => setActiveTab('user')}
          >
            <Ionicons name="person" size={14} color={activeTab === 'user' ? colors.primary : colors.subText} />
            <Text style={[styles.tabBtnText, { color: activeTab === 'user' ? colors.primary : colors.subText }]}>
              My Songs ({profile?.personalSongCount || songs.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'team' && [styles.tabBtnActive, { backgroundColor: colors.card }]]}
            onPress={() => setActiveTab('team')}
          >
            <Ionicons name="people" size={14} color={activeTab === 'team' ? colors.primary : colors.subText} />
            <Text style={[styles.tabBtnText, { color: activeTab === 'team' ? colors.primary : colors.subText }]}>
              Team
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'setlists' && [styles.tabBtnActive, { backgroundColor: colors.card }]]}
            onPress={() => setActiveTab('setlists')}
          >
            <Ionicons name="list" size={14} color={activeTab === 'setlists' ? colors.primary : colors.subText} />
            <Text style={[styles.tabBtnText, { color: activeTab === 'setlists' ? colors.primary : colors.subText }]}>
              Setlists
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'online' && [styles.tabBtnActive, { backgroundColor: colors.card }]]}
            onPress={() => setActiveTab('online')}
          >
            <Ionicons name="globe" size={14} color={activeTab === 'online' ? colors.primary : colors.subText} />
            <Text style={[styles.tabBtnText, { color: activeTab === 'online' ? colors.primary : colors.subText }]}>
              Online
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search & Key Filters (when on songs tabs) */}
        {(activeTab === 'user' || activeTab === 'team') && (
          <>
            <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Ionicons name="search" size={16} color={colors.subText} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search title, artist..."
                placeholderTextColor={colors.subText}
                value={search}
                onChangeText={setSearch}
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
                  <Text style={[styles.keyPillText, { color: selectedKey === k ? '#ffffff' : colors.text }]}>
                    {k}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}
      </View>

      {/* Main Content Area */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.subText }]}>Loading SongBook...</Text>
        </View>
      ) : activeTab === 'online' ? (
        /* Online Search Tab */
        <View style={{ flex: 1 }}>
          <View style={[styles.onlineSearchRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TextInput
              style={[styles.onlineInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="Search UltimateGuitar & WorshipTogether..."
              placeholderTextColor={colors.subText}
              value={onlineQuery}
              onChangeText={setOnlineQuery}
              onSubmitEditing={handleSearchOnline}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={[styles.onlineSearchBtn, { backgroundColor: colors.primary }]}
              onPress={handleSearchOnline}
            >
              {onlineLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="search" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          <FlatList
            data={onlineResults}
            keyExtractor={(item, idx) => item.id || idx.toString()}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={[styles.onlineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.songTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.songArtist, { color: colors.subText }]} numberOfLines={1}>
                    {item.artist} • {item.site} {item.key ? `• Key: ${item.key}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.importBtn, { backgroundColor: colors.primary }]}
                  onPress={() => handleImportOnline(item)}
                  disabled={importingOnlineId === (item.id || item.url)}
                >
                  {importingOnlineId === (item.id || item.url) ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={14} color="#fff" />
                      <Text style={styles.importBtnText}>Import</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="globe-outline" size={48} color={colors.subText} />
                <Text style={[styles.emptyText, { color: colors.text }]}>
                  {onlineLoading ? 'Searching online chord charts...' : 'Search online for worship songs'}
                </Text>
              </View>
            }
          />
        </View>
      ) : activeTab === 'setlists' ? (
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
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={48} color={colors.subText} />
              <Text style={[styles.emptyText, { color: colors.text }]}>No setlists found</Text>
            </View>
          }
        />
      ) : (
        /* Songs Tab (User / Team) */
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
      )}

      {/* Full-Screen Stage Reader Modal */}
      <Modal visible={isReaderOpen} animationType="slide" onRequestClose={() => setIsReaderOpen(false)}>
        <SafeAreaView style={[styles.readerContainer, { backgroundColor: colors.bg }]}>
          {/* Header */}
          <View style={[styles.readerHeader, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[styles.readerTitle, { color: colors.text }]} numberOfLines={1}>
                {fullSong?.title || selectedSong?.title}
              </Text>
              <Text style={[styles.readerArtist, { color: colors.subText }]} numberOfLines={1}>
                {fullSong?.artist || selectedSong?.artist}
                {selectedSetlist ? ` • Setlist (${selectedSetlist.songs.findIndex((s) => s.id === selectedSong?.id) + 1}/${selectedSetlist.songs.length})` : ''}
              </Text>
            </View>

            {/* Setlist Prev / Next */}
            {selectedSetlist?.songs && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 }}>
                <TouchableOpacity onPress={() => navigateSetlist(-1)} style={styles.navBtn}>
                  <Ionicons name="chevron-back" size={20} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigateSetlist(1)} style={styles.navBtn}>
                  <Ionicons name="chevron-forward" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
            )}

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

          {/* Controls Toolbar */}
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

            {/* Font & Auto-Scroll */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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

              <TouchableOpacity
                onPress={() => setIsAutoScrolling(!isAutoScrolling)}
                style={[styles.autoScrollBtn, { backgroundColor: isAutoScrolling ? '#ef4444' : colors.primary }]}
              >
                <Ionicons name={isAutoScrolling ? 'pause' : 'play'} size={14} color="#fff" />
                <Text style={styles.autoScrollBtnText}>{isAutoScrolling ? 'Stop' : 'Scroll'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Row: Copy & Delete */}
          {selectedSong && (
            <View style={[styles.actionRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              {selectedSong.ownerType === 'team' ? (
                <TouchableOpacity
                  style={styles.actionChip}
                  onPress={() => handleCopySong(selectedSong.id, 'user')}
                >
                  <Ionicons name="copy-outline" size={14} color={colors.primary} />
                  <Text style={[styles.actionChipText, { color: colors.primary }]}>Copy to My Songs</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.actionChip}
                  onPress={() => handleCopySong(selectedSong.id, 'team')}
                >
                  <Ionicons name="share-social-outline" size={14} color={colors.primary} />
                  <Text style={[styles.actionChipText, { color: colors.primary }]}>Copy to Team</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.actionChip}
                onPress={() => handleDeleteSong(selectedSong.id)}
              >
                <Ionicons name="trash-outline" size={14} color="#ef4444" />
                <Text style={[styles.actionChipText, { color: '#ef4444' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Sheet Body */}
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
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ marginTop: 8, fontSize: 12, color: colors.subText }}>Loading chords...</Text>
              </View>
            ) : (
              renderChordProLines(fullSong?.content || selectedSong?.content)
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add New Song Modal */}
      <Modal visible={isAddSongModalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.addSongModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.addModalHeader}>
              <Text style={[styles.addModalTitle, { color: colors.text }]}>Add New Song</Text>
              <TouchableOpacity onPress={() => setIsAddSongModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.subText} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.addInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="Song Title *"
              placeholderTextColor={colors.subText}
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <TextInput
              style={[styles.addInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="Artist / Author"
              placeholderTextColor={colors.subText}
              value={newArtist}
              onChangeText={setNewArtist}
            />

            {/* Key Selector */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.subText, marginRight: 8 }}>
                Key:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {SHARP_KEYS.map((k) => (
                  <TouchableOpacity
                    key={k}
                    style={[
                      styles.keyChoice,
                      {
                        backgroundColor: newKey === k ? colors.primary : colors.inputBg,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => setNewKey(k)}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: newKey === k ? '#fff' : colors.text }}>
                      {k}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* ChordPro Content */}
            <TextInput
              style={[styles.addTextArea, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="[G]Write chords inside brackets..."
              placeholderTextColor={colors.subText}
              value={newContent}
              onChangeText={setNewContent}
              multiline
              numberOfLines={6}
            />

            <TouchableOpacity
              style={[styles.saveSongBtn, { backgroundColor: colors.primary }]}
              onPress={handleSaveNewSong}
              disabled={savingSong}
            >
              {savingSong ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveSongBtnText}>Save Song to {activeTab === 'team' ? 'Team' : 'My Songs'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subTitle: {
    fontSize: 11,
    marginTop: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    marginBottom: 10,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 9,
  },
  tabBtnActive: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    marginLeft: 6,
    padding: 0,
  },
  keyRow: {
    flexDirection: 'row',
    paddingBottom: 2,
  },
  keyPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
  },
  keyPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  listContent: {
    padding: 12,
    paddingBottom: 40,
  },
  songCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  songTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  songArtist: {
    fontSize: 11,
    marginTop: 2,
  },
  keyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  keyBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  setlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  setlistName: {
    fontSize: 14,
    fontWeight: '700',
  },
  setlistSub: {
    fontSize: 11,
    marginTop: 2,
  },
  onlineSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  onlineInput: {
    flex: 1,
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  onlineSearchBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  importBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 12,
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  readerContainer: {
    flex: 1,
  },
  readerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  readerTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  readerArtist: {
    fontSize: 11,
    marginTop: 2,
  },
  navBtn: {
    padding: 4,
  },
  closeBtn: {
    padding: 2,
  },
  readerToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  transposeWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tBtn: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  tBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  tPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  iconBtnSmall: {
    padding: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  autoScrollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  autoScrollBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  actionChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sheetScroll: {
    flex: 1,
  },
  sheetContent: {
    padding: 16,
    paddingBottom: 80,
  },
  sectionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    marginTop: 14,
    marginBottom: 6,
  },
  sectionBadgeText: {
    color: '#d97706',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  chordLineContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 2,
  },
  chordPair: {
    marginRight: 4,
  },
  chordText: {
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: -2,
  },
  lyricText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  plainLyric: {
    marginVertical: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  addSongModal: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  addModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addModalTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  addInput: {
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  keyChoice: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 4,
  },
  addTextArea: {
    fontSize: 11,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginVertical: 8,
    textAlignVertical: 'top',
  },
  saveSongBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  saveSongBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});
