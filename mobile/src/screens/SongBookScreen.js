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
  Share,
  Linking,
  BackHandler,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
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

const formatSetlistText = (setlist) => {
  if (!setlist) return '';
  const songs = Array.isArray(setlist.songs) ? setlist.songs : [];
  const lines = [
    `🎵 *Worship Setlist: ${setlist.name || 'Worship Set'}*`,
    `⛪ *Jesus My Rock Worship*`,
    setlist.description ? `📝 ${setlist.description}` : '',
    '',
    `*Songs (${songs.length}):*`,
  ];
  if (songs.length === 0) {
    lines.push('• No songs in this setlist yet');
  } else {
    songs.forEach((s, idx) => {
      const keyStr = s.key ? ` [Key ${s.key}]` : '';
      const tempoStr = s.tempo ? ` (${s.tempo} BPM)` : '';
      const artistStr = s.artist ? ` - ${s.artist}` : '';
      lines.push(`${idx + 1}. *${s.title}*${artistStr}${keyStr}${tempoStr}`);
    });
  }
  lines.push('');
  lines.push('🔗 https://serve.creativeclicks.art/songbook');
  return lines.filter(Boolean).join('\n');
};

export default function SongBookScreen({
  user,
  isDark = false,
  pendingSbpUri = null,
  onClearPendingSbp = null,
}) {
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

  // WhatsApp / SBP File Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importingFile, setImportingFile] = useState(false);
  const [parsedImportData, setParsedImportData] = useState(null);
  const [importScope, setImportScope] = useState('user'); // 'user' | 'team'
  const [importAsSetlist, setImportAsSetlist] = useState(true);
  const [importSetlistName, setImportSetlistName] = useState('');
  const [importStrategy, setImportStrategy] = useState('skip'); // 'skip' | 'overwrite'
  const [committingImport, setCommittingImport] = useState(false);

  // Setlist Builder Modal State (Create & Edit)
  const [isSetlistBuilderOpen, setIsSetlistBuilderOpen] = useState(false);
  const [editingSetlistId, setEditingSetlistId] = useState(null);
  const [setlistBuilderName, setSetlistBuilderName] = useState('');
  const [setlistBuilderScope, setSetlistBuilderScope] = useState('user');
  const [setlistBuilderSongs, setSetlistBuilderSongs] = useState([]);
  const [setlistBuilderKeyOverrides, setSetlistBuilderKeyOverrides] = useState({});
  const [savingSetlist, setSavingSetlist] = useState(false);
  const [isSongPickerOpen, setIsSongPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

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

  const handleShareSetlist = async (setlist) => {
    if (!setlist) return;
    try {
      let fullSet = setlist;
      if (!Array.isArray(setlist.songs) || setlist.songs.length === 0) {
        fullSet = await api.getSongbookSetlist(setlist.id);
      }
      const text = formatSetlistText(fullSet);
      await Share.share({
        title: `Worship Setlist: ${fullSet.name || 'Setlist'}`,
        message: text,
      });
    } catch (err) {
      if (err.message && !err.message.includes('dismissed')) {
        Alert.alert('Share Error', err.message || 'Could not share setlist');
      }
    }
  };

  // --- SBP WhatsApp & System File Auto-Import ---
  useEffect(() => {
    if (pendingSbpUri) {
      processIncomingSbp(pendingSbpUri);
    }
  }, [pendingSbpUri]);

  const processIncomingSbp = async (uri) => {
    try {
      setImportingFile(true);
      let fileBase64 = null;
      let fileName = 'WhatsApp_Import.sbp';

      if (uri.startsWith('content://') || uri.startsWith('file://')) {
        fileBase64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const segments = uri.split('/');
        fileName = decodeURIComponent(segments[segments.length - 1] || 'Imported.sbp');
      }

      if (!fileBase64) {
        throw new Error('Could not read file data');
      }

      const parsed = await api.parseSongbookBackup({
        fileBase64,
        fileName,
      });

      if (parsed && ((parsed.songs && parsed.songs.length > 0) || (parsed.setlists && parsed.setlists.length > 0))) {
        setParsedImportData(parsed);
        const suggestedName = parsed.name || (parsed.setlists?.[0]?.name) || fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        setImportSetlistName(suggestedName);
        setImportAsSetlist(Boolean(parsed.setlists?.length > 0 || parsed.songs?.length > 1));
        setIsImportModalOpen(true);
      } else {
        Alert.alert('Import Failed', 'No valid songs or setlists were found in this file.');
      }
    } catch (err) {
      console.error('Failed to process SBP file:', err);
      Alert.alert('File Import Error', err.message || 'Could not parse the incoming file.');
    } finally {
      setImportingFile(false);
      if (onClearPendingSbp) onClearPendingSbp();
    }
  };

  const commitImport = async () => {
    if (!parsedImportData) return;
    setCommittingImport(true);
    try {
      const result = await api.importSongbookBackup({
        backupData: parsedImportData,
        targetOwnerType: importScope,
        strategy: importStrategy,
        createSetlist: importAsSetlist,
        setlistName: importSetlistName.trim(),
      });

      setIsImportModalOpen(false);
      setParsedImportData(null);
      await fetchLibrary(importScope);

      const count = result.addedCount || parsedImportData.songs?.length || 0;
      const setName = result.createdSetlistName || (importAsSetlist ? importSetlistName : null);
      Alert.alert(
        'Import Completed 🎉',
        `Successfully imported ${count} song(s)${setName ? ` and created setlist "${setName}"` : ''} into your ${importScope === 'team' ? 'Team Library' : 'Personal Library'}!`,
        [
          {
            text: 'View Setlists',
            onPress: () => setActiveTab('setlists'),
          },
          {
            text: 'OK',
          },
        ]
      );
    } catch (err) {
      Alert.alert('Import Error', err.message || 'Failed to complete import');
    } finally {
      setCommittingImport(false);
    }
  };

  // --- Share SBP or PDF directly to Ministry Hub / Chat ---
  const [isShareToMinistryOpen, setIsShareToMinistryOpen] = useState(false);
  const [shareItem, setShareItem] = useState(null);
  const [shareItemType, setShareItemType] = useState('setlist');
  const [shareFormat, setShareFormat] = useState('sbp'); // 'sbp' | 'pdf'
  const [shareTargetType, setShareTargetType] = useState('ministry_chat');
  const [shareMinistries, setShareMinistries] = useState([]);
  const [shareSelectedMinistryId, setShareSelectedMinistryId] = useState(null);
  const [shareMessage, setShareMessage] = useState('');
  const [sharingToMinistry, setSharingToMinistry] = useState(false);

  const openShareToMinistryModal = async (item, type = 'setlist', defaultFormat = 'sbp') => {
    setShareItem(item);
    setShareItemType(type);
    setShareFormat(defaultFormat);
    setShareMessage('');
    setIsShareToMinistryOpen(true);

    try {
      const data = await api.getMinistries();
      const list = Array.isArray(data) ? data : [];
      setShareMinistries(list);
      if (list.length > 0 && !shareSelectedMinistryId) {
        setShareSelectedMinistryId(list[0].id);
      }
    } catch (e) {
      console.warn('Could not load ministries for sharing:', e);
    }
  };

  const handleConfirmShareToMinistry = async () => {
    if (!shareItem) return;
    if (['ministry_chat', 'ministry_announcement'].includes(shareTargetType) && !shareSelectedMinistryId) {
      Alert.alert('Selection Required', 'Please select a ministry target.');
      return;
    }

    setSharingToMinistry(true);
    try {
      const isSetlist = shareItemType === 'setlist';
      await api.shareSongbookToMinistry({
        targetType: shareTargetType,
        ministryId: shareSelectedMinistryId,
        format: shareFormat,
        setlistId: isSetlist ? shareItem.id : undefined,
        songId: !isSetlist ? shareItem.id : undefined,
        message: shareMessage.trim(),
      });

      setIsShareToMinistryOpen(false);
      Alert.alert(
        'Shared Successfully! 🎉',
        `The ${shareFormat.toUpperCase()} has been sent into ${
          shareTargetType.includes('general') ? 'General Church' : 'Ministry Hub'
        }. Members can tap directly to view or import into their personal library.`
      );
    } catch (err) {
      Alert.alert('Share Failed', err.response?.data?.error || err.message || 'Could not share to ministry');
    } finally {
      setSharingToMinistry(false);
    }
  };

  // --- Export Setlist / Song as genuine .sbp ZIP Archive ---
  const handleExportSbp = (item, type = 'setlist') => {
    const isSetlist = type === 'setlist';
    const name = (isSetlist ? item.name : item.title) || 'Worship_Set';

    Alert.alert(
      `Export ${name} (.sbp)`,
      'How would you like to export this SongBook backup?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send to Ministry Hub / Chat',
          onPress: () => openShareToMinistryModal(item, type, 'sbp'),
        },
        {
          text: 'Share via WhatsApp / Files',
          onPress: () => performDirectExportSbp(item, type),
        },
      ]
    );
  };

  const performDirectExportSbp = async (item, type = 'setlist') => {
    try {
      const isSetlist = type === 'setlist';
      const name = (isSetlist ? item.name : item.title) || 'Worship_Set';
      const cleanName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const downloadUrl = isSetlist ? api.getSongbookSetlistSbpUrl(item.id) : api.getSongbookSongSbpUrl(item.id);
      const token = api.accessToken;

      const fileUri = `${FileSystem.cacheDirectory}${cleanName}.sbp`;
      const downloadRes = await FileSystem.downloadAsync(downloadUrl, fileUri, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadRes.uri, {
          mimeType: 'application/octet-stream',
          dialogTitle: `Share ${cleanName}.sbp via WhatsApp`,
          UTI: 'com.pkware.zip-archive',
        });
      } else {
        Alert.alert('Export Ready', `File saved to ${downloadRes.uri}`);
      }
    } catch (err) {
      Alert.alert('Export Error', err.message || 'Failed to export .sbp file');
    }
  };

  // --- Export Setlist / Song as Printable PDF ---
  const handleExportPdf = (item, type = 'setlist') => {
    const isSetlist = type === 'setlist';
    const name = (isSetlist ? item.name : item.title) || 'Worship_Set';

    Alert.alert(
      `Export ${name} (PDF Lead Sheet)`,
      'How would you like to export this printable lead sheet?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send to Ministry Hub / Chat',
          onPress: () => openShareToMinistryModal(item, type, 'pdf'),
        },
        {
          text: 'Share via WhatsApp / Print',
          onPress: () => performDirectExportPdf(item, type),
        },
      ]
    );
  };

  const performDirectExportPdf = async (item, type = 'setlist') => {
    try {
      const isSetlist = type === 'setlist';
      const res = isSetlist ? await api.getSongbookSetlistPdf(item.id) : await api.getSongbookSongPdf(item.id);
      if (!res || !res.html) {
        throw new Error('Could not generate PDF document');
      }

      const { uri } = await Print.printToFileAsync({ html: res.html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share ${res.title || 'Chord_Chart'}.pdf`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF Ready', `PDF saved to ${uri}`);
      }
    } catch (err) {
      Alert.alert('PDF Export Error', err.message || 'Failed to generate PDF');
    }
  };

  // --- Setlist Builder & CRUD ---
  const openNewSetlistModal = () => {
    setEditingSetlistId(null);
    setSetlistBuilderName('');
    setSetlistBuilderScope(activeTab === 'team' ? 'team' : 'user');
    setSetlistBuilderSongs([]);
    setSetlistBuilderKeyOverrides({});
    setIsSetlistBuilderOpen(true);
  };

  const openEditSetlistModal = async (setlist) => {
    try {
      setLoading(true);
      const fullSet = await api.getSongbookSetlist(setlist.id);
      setEditingSetlistId(setlist.id);
      setSetlistBuilderName(fullSet.name || setlist.name || '');
      setSetlistBuilderScope(fullSet.ownerType || 'user');
      setSetlistBuilderSongs(Array.isArray(fullSet.songs) ? fullSet.songs : []);
      setSetlistBuilderKeyOverrides(fullSet.songKeyOverrides || {});
      setIsSetlistBuilderOpen(true);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to load setlist for editing');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSetlist = async () => {
    if (!setlistBuilderName.trim()) {
      Alert.alert('Missing Name', 'Please enter a name for the setlist.');
      return;
    }

    setSavingSetlist(true);
    try {
      const songIds = setlistBuilderSongs.map((s) => s.id);
      await api.createSongbookSetlist({
        id: editingSetlistId || undefined,
        name: setlistBuilderName.trim(),
        ownerType: setlistBuilderScope,
        songIds,
        songKeyOverrides: setlistBuilderKeyOverrides,
      });

      setIsSetlistBuilderOpen(false);
      await fetchLibrary('setlists');
      setActiveTab('setlists');
      Alert.alert(
        editingSetlistId ? 'Setlist Updated' : 'Setlist Created',
        `"${setlistBuilderName.trim()}" with ${songIds.length} song(s) is saved!`
      );
    } catch (err) {
      Alert.alert('Save Failed', err.message || 'Could not save setlist');
    } finally {
      setSavingSetlist(false);
    }
  };

  const handleDeleteSetlist = (setlistId, setlistName) => {
    Alert.alert(
      'Delete Setlist',
      `Are you sure you want to delete setlist "${setlistName}"? The songs will remain in your library.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteSongbookSetlist(setlistId);
              if (selectedSetlist?.id === setlistId) {
                setIsReaderOpen(false);
              }
              await fetchLibrary('setlists');
              Alert.alert('Setlist Deleted', `Setlist "${setlistName}" was deleted.`);
            } catch (err) {
              Alert.alert('Delete Failed', err.message || 'Could not delete setlist');
            }
          },
        },
      ]
    );
  };

  const handleAddSongToBuilder = (song) => {
    if (setlistBuilderSongs.some((s) => s.id === song.id)) {
      Alert.alert('Already Added', `"${song.title}" is already in this setlist.`);
      return;
    }
    setSetlistBuilderSongs((prev) => [...prev, song]);
    setIsSongPickerOpen(false);
  };

  const handleRemoveSongFromBuilder = (songId) => {
    setSetlistBuilderSongs((prev) => prev.filter((s) => s.id !== songId));
    setSetlistBuilderKeyOverrides((prev) => {
      const next = { ...prev };
      delete next[songId];
      return next;
    });
  };

  const handleMoveSong = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= setlistBuilderSongs.length) return;
    setSetlistBuilderSongs((prev) => {
      const list = [...prev];
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;
      return list;
    });
  };

  const handleSetKeyOverride = (songId, newKey) => {
    setSetlistBuilderKeyOverrides((prev) => ({
      ...prev,
      [songId]: newKey,
    }));
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

  // Handle Android Hardware / Swipe Back Button
  useEffect(() => {
    const handleBack = () => {
      if (isSongPickerOpen) {
        setIsSongPickerOpen(false);
        return true;
      }
      if (isSetlistBuilderOpen) {
        setIsSetlistBuilderOpen(false);
        return true;
      }
      if (isImportModalOpen) {
        setIsImportModalOpen(false);
        if (onClearPendingSbp) onClearPendingSbp();
        return true;
      }
      if (isAddSongModalOpen) {
        setIsAddSongModalOpen(false);
        return true;
      }
      if (isReaderOpen) {
        setIsAutoScrolling(false);
        setIsReaderOpen(false);
        return true;
      }
      if (activeTab === 'online' || activeTab === 'setlists' || activeTab === 'team') {
        setActiveTab('user');
        return true;
      }
      return false; // Propagate to App.js tab navigation
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => backSub.remove();
  }, [
    isSongPickerOpen,
    isSetlistBuilderOpen,
    isImportModalOpen,
    isAddSongModalOpen,
    isReaderOpen,
    activeTab,
  ]);

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

          {/* Add Song / New Setlist Button */}
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              if (activeTab === 'setlists') {
                openNewSetlistModal();
              } else {
                setIsAddSongModalOpen(true);
              }
            }}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>{activeTab === 'setlists' ? 'New Setlist' : 'New Song'}</Text>
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
          ListHeaderComponent={
            <TouchableOpacity
              style={[styles.createSetlistBanner, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
              onPress={openNewSetlistModal}
            >
              <Ionicons name="add-circle" size={20} color={colors.primary} />
              <Text style={[styles.createSetlistBannerText, { color: colors.primary }]}>
                Create New Worship Setlist
              </Text>
            </TouchableOpacity>
          }
          renderItem={({ item }) => {
            const count = Array.isArray(item.songIds)
              ? item.songIds.length
              : Array.isArray(item.songs)
              ? item.songs.length
              : 0;

            return (
              <View style={[styles.setlistCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.setlistCardHeader}
                  onPress={() => openSetlist(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="folder-open" size={24} color={colors.primary} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.setlistName, { color: colors.text }]}>{item.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <Text style={[styles.setlistSub, { color: colors.subText }]}>{count} songs</Text>
                      <View
                        style={[
                          styles.scopeBadge,
                          {
                            backgroundColor:
                              item.ownerType === 'team'
                                ? 'rgba(59, 130, 246, 0.15)'
                                : 'rgba(168, 85, 247, 0.15)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.scopeBadgeText,
                            {
                              color: item.ownerType === 'team' ? '#3b82f6' : '#a855f7',
                            },
                          ]}
                        >
                          {item.ownerType === 'team' ? 'Team' : 'Personal'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons name="play-circle-outline" size={22} color={colors.primary} />
                </TouchableOpacity>

                {/* Setlist Actions Row */}
                <View style={[styles.setlistActionsRow, { borderTopColor: colors.border }]}>
                  <TouchableOpacity
                    style={styles.setlistActionBtn}
                    onPress={() => handleExportSbp(item, 'setlist')}
                  >
                    <Ionicons name="share-outline" size={13} color={colors.primary} />
                    <Text style={[styles.setlistActionText, { color: colors.primary }]}>.sbp</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.setlistActionBtn}
                    onPress={() => handleExportPdf(item, 'setlist')}
                  >
                    <Ionicons name="document-text-outline" size={13} color="#0284c7" />
                    <Text style={[styles.setlistActionText, { color: '#0284c7' }]}>PDF</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.setlistActionBtn}
                    onPress={() => openShareToMinistryModal(item, 'setlist', 'sbp')}
                  >
                    <Ionicons name="chatbubbles-outline" size={13} color="#9333ea" />
                    <Text style={[styles.setlistActionText, { color: '#9333ea' }]}>Hub / Chat</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.setlistActionBtn}
                    onPress={() => handleShareSetlist(item)}
                  >
                    <Ionicons name="logo-whatsapp" size={13} color="#16a34a" />
                    <Text style={[styles.setlistActionText, { color: '#16a34a' }]}>Text</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.setlistActionBtn}
                    onPress={() => openEditSetlistModal(item)}
                  >
                    <Ionicons name="create-outline" size={13} color={colors.subText} />
                    <Text style={[styles.setlistActionText, { color: colors.subText }]}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.setlistActionBtn}
                    onPress={() => handleDeleteSetlist(item.id, item.name)}
                  >
                    <Ionicons name="trash-outline" size={13} color="#ef4444" />
                    <Text style={[styles.setlistActionText, { color: '#ef4444' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
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

            {selectedSetlist && (
              <TouchableOpacity
                onPress={() => handleShareSetlist(selectedSetlist)}
                style={{ padding: 6, marginRight: 6 }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="share-social-outline" size={22} color="#16a34a" />
              </TouchableOpacity>
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

          {/* Action Row: Export SBP, Export PDF, Copy & Delete */}
          {selectedSong && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.actionRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
            >
              {/* Export SBP */}
              <TouchableOpacity
                style={[styles.actionChip, { backgroundColor: colors.inputBg }]}
                onPress={() => handleExportSbp(selectedSetlist || selectedSong, selectedSetlist ? 'setlist' : 'song')}
              >
                <Ionicons name="share-outline" size={14} color={colors.primary} />
                <Text style={[styles.actionChipText, { color: colors.primary }]}>
                  {selectedSetlist ? 'Export Set .sbp' : 'Export .sbp'}
                </Text>
              </TouchableOpacity>

              {/* Export PDF */}
              <TouchableOpacity
                style={[styles.actionChip, { backgroundColor: colors.inputBg }]}
                onPress={() => handleExportPdf(selectedSetlist || selectedSong, selectedSetlist ? 'setlist' : 'song')}
              >
                <Ionicons name="document-text-outline" size={14} color="#0284c7" />
                <Text style={[styles.actionChipText, { color: '#0284c7' }]}>
                  {selectedSetlist ? 'Export Set PDF' : 'Export PDF'}
                </Text>
              </TouchableOpacity>

              {/* Send to Hub / Chat */}
              <TouchableOpacity
                style={[styles.actionChip, { backgroundColor: colors.inputBg }]}
                onPress={() => openShareToMinistryModal(selectedSetlist || selectedSong, selectedSetlist ? 'setlist' : 'song')}
              >
                <Ionicons name="chatbubbles-outline" size={14} color="#9333ea" />
                <Text style={[styles.actionChipText, { color: '#9333ea' }]}>
                  Send to Hub / Chat
                </Text>
              </TouchableOpacity>

              {/* Copy between scopes */}
              {selectedSong.ownerType === 'team' ? (
                <TouchableOpacity
                  style={[styles.actionChip, { backgroundColor: colors.inputBg }]}
                  onPress={() => handleCopySong(selectedSong.id, 'user')}
                >
                  <Ionicons name="copy-outline" size={14} color={colors.subText} />
                  <Text style={[styles.actionChipText, { color: colors.subText }]}>Copy to My Songs</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.actionChip, { backgroundColor: colors.inputBg }]}
                  onPress={() => handleCopySong(selectedSong.id, 'team')}
                >
                  <Ionicons name="share-social-outline" size={14} color={colors.subText} />
                  <Text style={[styles.actionChipText, { color: colors.subText }]}>Copy to Team</Text>
                </TouchableOpacity>
              )}

              {/* Delete Song */}
              <TouchableOpacity
                style={[styles.actionChip, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
                onPress={() => handleDeleteSong(selectedSong.id)}
              >
                <Ionicons name="trash-outline" size={14} color="#ef4444" />
                <Text style={[styles.actionChipText, { color: '#ef4444' }]}>Delete</Text>
              </TouchableOpacity>
            </ScrollView>
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
      <Modal visible={isAddSongModalOpen} animationType="slide" transparent onRequestClose={() => setIsAddSongModalOpen(false)}>
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

      {/* WhatsApp / System .sbp Import Confirmation Modal */}
      <Modal
        visible={isImportModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setIsImportModalOpen(false);
          if (onClearPendingSbp) onClearPendingSbp();
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="download" size={20} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.text }]}>Import SongBook File (.sbp)</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setIsImportModalOpen(false);
                  if (onClearPendingSbp) onClearPendingSbp();
                }}
              >
                <Ionicons name="close" size={24} color={colors.subText} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360 }}>
              {/* File details info box */}
              <View style={[styles.infoBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Text style={[styles.infoTitle, { color: colors.text }]}>
                  {parsedImportData?.name || 'SongBook Backup'}
                </Text>
                <Text style={[styles.infoSubtitle, { color: colors.subText }]}>
                  Found: {parsedImportData?.songs?.length || 0} song(s)
                  {parsedImportData?.setlists?.length ? ` • ${parsedImportData.setlists.length} setlist(s)` : ''}
                </Text>
              </View>

              {/* Destination Scope */}
              <Text style={[styles.inputLabel, { color: colors.subText, marginTop: 12 }]}>IMPORT DESTINATION</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <TouchableOpacity
                  style={[
                    styles.choicePill,
                    {
                      backgroundColor: importScope === 'user' ? colors.primary : colors.inputBg,
                      borderColor: colors.border,
                      flex: 1,
                    },
                  ]}
                  onPress={() => setImportScope('user')}
                >
                  <Text style={[styles.choicePillText, { color: importScope === 'user' ? '#fff' : colors.text }]}>
                    My Personal Songs
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.choicePill,
                    {
                      backgroundColor: importScope === 'team' ? colors.primary : colors.inputBg,
                      borderColor: colors.border,
                      flex: 1,
                    },
                  ]}
                  onPress={() => setImportScope('team')}
                >
                  <Text style={[styles.choicePillText, { color: importScope === 'team' ? '#fff' : colors.text }]}>
                    Team Library
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Duplicate Strategy */}
              <Text style={[styles.inputLabel, { color: colors.subText, marginTop: 12 }]}>IF SONG ALREADY EXISTS</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <TouchableOpacity
                  style={[
                    styles.choicePill,
                    {
                      backgroundColor: importStrategy === 'skip' ? colors.primary : colors.inputBg,
                      borderColor: colors.border,
                      flex: 1,
                    },
                  ]}
                  onPress={() => setImportStrategy('skip')}
                >
                  <Text style={[styles.choicePillText, { color: importStrategy === 'skip' ? '#fff' : colors.text }]}>
                    Skip Duplicates
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.choicePill,
                    {
                      backgroundColor: importStrategy === 'overwrite' ? colors.primary : colors.inputBg,
                      borderColor: colors.border,
                      flex: 1,
                    },
                  ]}
                  onPress={() => setImportStrategy('overwrite')}
                >
                  <Text style={[styles.choicePillText, { color: importStrategy === 'overwrite' ? '#fff' : colors.text }]}>
                    Overwrite
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Create Setlist Toggle */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}
                onPress={() => setImportAsSetlist(!importAsSetlist)}
              >
                <Ionicons
                  name={importAsSetlist ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={colors.primary}
                />
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                  Create a Setlist from these songs
                </Text>
              </TouchableOpacity>

              {importAsSetlist && (
                <View style={{ marginTop: 8 }}>
                  <Text style={[styles.inputLabel, { color: colors.subText }]}>SETLIST NAME</Text>
                  <TextInput
                    style={[styles.modalTextInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                    value={importSetlistName}
                    onChangeText={setImportSetlistName}
                    placeholder="e.g. Sunday Morning Worship"
                    placeholderTextColor={colors.subText}
                  />
                </View>
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => {
                  setIsImportModalOpen(false);
                  if (onClearPendingSbp) onClearPendingSbp();
                }}
              >
                <Text style={[styles.modalCancelText, { color: colors.subText }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: colors.primary, flex: 2 }]}
                onPress={commitImport}
                disabled={committingImport}
              >
                {committingImport ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Import Now</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Setlist Builder Modal (Create & Edit) */}
      <Modal visible={isSetlistBuilderOpen} animationType="slide" onRequestClose={() => setIsSetlistBuilderOpen(false)}>
        <SafeAreaView style={[styles.readerContainer, { backgroundColor: colors.bg }]}>
          {/* Header */}
          <View style={[styles.readerHeader, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.readerTitle, { color: colors.text }]}>
                {editingSetlistId ? 'Edit Setlist' : 'Create New Setlist'}
              </Text>
              <Text style={[styles.readerArtist, { color: colors.subText }]}>
                Arrange worship songs, set per-song keys
              </Text>
            </View>

            <TouchableOpacity onPress={() => setIsSetlistBuilderOpen(false)} style={styles.closeBtn}>
              <Ionicons name="close-circle" size={28} color={colors.subText} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1, padding: 14 }}>
            {/* Setlist Name */}
            <Text style={[styles.inputLabel, { color: colors.subText }]}>SETLIST NAME *</Text>
            <TextInput
              style={[styles.modalTextInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={setlistBuilderName}
              onChangeText={setSetlistBuilderName}
              placeholder="e.g. Sunday Worship - Oct 25"
              placeholderTextColor={colors.subText}
            />

            {/* Scope Selection */}
            <Text style={[styles.inputLabel, { color: colors.subText, marginTop: 12 }]}>SCOPE</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <TouchableOpacity
                style={[
                  styles.choicePill,
                  {
                    backgroundColor: setlistBuilderScope === 'user' ? colors.primary : colors.inputBg,
                    borderColor: colors.border,
                    flex: 1,
                  },
                ]}
                onPress={() => setSetlistBuilderScope('user')}
              >
                <Text style={[styles.choicePillText, { color: setlistBuilderScope === 'user' ? '#fff' : colors.text }]}>
                  My Personal Setlist
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.choicePill,
                  {
                    backgroundColor: setlistBuilderScope === 'team' ? colors.primary : colors.inputBg,
                    borderColor: colors.border,
                    flex: 1,
                  },
                ]}
                onPress={() => setSetlistBuilderScope('team')}
              >
                <Text style={[styles.choicePillText, { color: setlistBuilderScope === 'team' ? '#fff' : colors.text }]}>
                  Team Setlist
                </Text>
              </TouchableOpacity>
            </View>

            {/* Songs in Setlist header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 8 }}>
              <Text style={[styles.inputLabel, { color: colors.subText }]}>
                SONGS IN SETLIST ({setlistBuilderSongs.length})
              </Text>

              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setPickerSearch('');
                  setIsSongPickerOpen(true);
                }}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.addBtnText}>Add Songs</Text>
              </TouchableOpacity>
            </View>

            {/* List of songs */}
            {setlistBuilderSongs.length === 0 ? (
              <View style={[styles.emptyBuilderBox, { borderColor: colors.border }]}>
                <Ionicons name="musical-notes-outline" size={32} color={colors.subText} />
                <Text style={[styles.emptyBuilderText, { color: colors.subText }]}>
                  No songs in this setlist yet. Tap "+ Add Songs" to select songs from your library.
                </Text>
              </View>
            ) : (
              setlistBuilderSongs.map((song, idx) => {
                const effectiveKey = setlistBuilderKeyOverrides[song.id] || song.key || 'C';
                return (
                  <View
                    key={`${song.id}-${idx}`}
                    style={[styles.builderSongCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={styles.builderIndexCircle}>
                      <Text style={styles.builderIndexText}>{idx + 1}</Text>
                    </View>

                    <View style={{ flex: 1, paddingHorizontal: 8 }}>
                      <Text style={[styles.builderSongTitle, { color: colors.text }]} numberOfLines={1}>
                        {song.title}
                      </Text>
                      <Text style={[styles.builderSongArtist, { color: colors.subText }]} numberOfLines={1}>
                        {song.artist || 'Unknown'} • Key: {effectiveKey}
                      </Text>
                    </View>

                    {/* Key override picker */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxWidth: 110 }}>
                      <View style={{ flexDirection: 'row', gap: 2 }}>
                        {SHARP_KEYS.slice(0, 7).map((k) => (
                          <TouchableOpacity
                            key={k}
                            style={[
                              styles.miniKeyPill,
                              {
                                backgroundColor: effectiveKey === k ? colors.primary : colors.inputBg,
                                borderColor: colors.border,
                              },
                            ]}
                            onPress={() => handleSetKeyOverride(song.id, k)}
                          >
                            <Text style={{ fontSize: 9, fontWeight: '800', color: effectiveKey === k ? '#fff' : colors.text }}>
                              {k}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    {/* Reorder Buttons */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 4 }}>
                      <TouchableOpacity
                        disabled={idx === 0}
                        onPress={() => handleMoveSong(idx, -1)}
                        style={[styles.reorderBtn, { opacity: idx === 0 ? 0.3 : 1 }]}
                      >
                        <Ionicons name="arrow-up" size={16} color={colors.text} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        disabled={idx === setlistBuilderSongs.length - 1}
                        onPress={() => handleMoveSong(idx, 1)}
                        style={[styles.reorderBtn, { opacity: idx === setlistBuilderSongs.length - 1 ? 0.3 : 1 }]}
                      >
                        <Ionicons name="arrow-down" size={16} color={colors.text} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleRemoveSongFromBuilder(song.id)}
                        style={styles.reorderBtn}
                      >
                        <Ionicons name="trash-outline" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}

            <View style={{ height: 30 }} />
          </ScrollView>

          {/* Footer Save Button */}
          <View style={[styles.builderFooter, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.builderSaveBtn, { backgroundColor: colors.primary }]}
              onPress={handleSaveSetlist}
              disabled={savingSetlist}
            >
              {savingSetlist ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.builderSaveBtnText}>
                  {editingSetlistId ? 'Update Setlist' : 'Save Setlist'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Song Picker Modal */}
      <Modal visible={isSongPickerOpen} animationType="slide" transparent onRequestClose={() => setIsSongPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border, height: '80%' }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Song to Setlist</Text>
              <TouchableOpacity onPress={() => setIsSongPickerOpen(false)}>
                <Ionicons name="close" size={24} color={colors.subText} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border, marginVertical: 8 }]}>
              <Ionicons name="search" size={16} color={colors.subText} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search songs..."
                placeholderTextColor={colors.subText}
                value={pickerSearch}
                onChangeText={setPickerSearch}
              />
            </View>

            <FlatList
              data={songs.filter((s) => {
                const q = pickerSearch.trim().toLowerCase();
                return !q || (s.title || '').toLowerCase().includes(q) || (s.artist || '').toLowerCase().includes(q);
              })}
              keyExtractor={(s) => s.id.toString()}
              renderItem={({ item }) => {
                const alreadyAdded = setlistBuilderSongs.some((s) => s.id === item.id);
                return (
                  <TouchableOpacity
                    style={[
                      styles.pickerSongItem,
                      {
                        backgroundColor: alreadyAdded ? colors.inputBg : colors.card,
                        borderColor: colors.border,
                        opacity: alreadyAdded ? 0.6 : 1,
                      },
                    ]}
                    onPress={() => handleAddSongToBuilder(item)}
                    disabled={alreadyAdded}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.songTitle, { color: colors.text }]}>{item.title}</Text>
                      <Text style={[styles.songArtist, { color: colors.subText }]}>
                        {item.artist || 'Unknown'} • Key: {item.key || 'C'}
                      </Text>
                    </View>
                    {alreadyAdded ? (
                      <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                    ) : (
                      <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: colors.subText, fontSize: 12 }}>No matching songs found</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Send to Ministry Hub / Chat Modal */}
      <Modal
        visible={isShareToMinistryOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsShareToMinistryOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="paper-plane" size={18} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.text }]}>Send to Ministry Hub / Chat</Text>
              </View>
              <TouchableOpacity onPress={() => setIsShareToMinistryOpen(false)}>
                <Ionicons name="close" size={22} color={colors.subText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Item Info */}
              <View style={{ padding: 10, borderRadius: 10, backgroundColor: colors.inputBg, marginBottom: 12 }}>
                <Text style={{ fontSize: 11, color: colors.subText, textTransform: 'uppercase', fontWeight: '800' }}>
                  {shareItemType === 'setlist' ? 'Worship Setlist' : 'Song Chord Chart'}
                </Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 2 }}>
                  {shareItem ? (shareItemType === 'setlist' ? shareItem.name : shareItem.title) : ''}
                </Text>
              </View>

              {/* Format Selection */}
              <Text style={[styles.inputLabel, { color: colors.subText }]}>Export Format</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <TouchableOpacity
                  style={[
                    styles.shareOptionCard,
                    shareFormat === 'sbp' && { borderColor: colors.primary, backgroundColor: colors.primaryLight },
                    { borderColor: colors.border },
                  ]}
                  onPress={() => setShareFormat('sbp')}
                >
                  <Ionicons name="musical-notes" size={18} color={shareFormat === 'sbp' ? colors.primary : colors.subText} />
                  <Text style={[styles.shareOptionTitle, { color: shareFormat === 'sbp' ? colors.primary : colors.text }]}>
                    .sbp Archive
                  </Text>
                  <Text style={[styles.shareOptionSub, { color: colors.subText }]}>
                    SongBook Pro format with 1-tap import for musicians
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.shareOptionCard,
                    shareFormat === 'pdf' && { borderColor: '#0284c7', backgroundColor: isDark ? '#082f49' : '#e0f2fe' },
                    { borderColor: colors.border },
                  ]}
                  onPress={() => setShareFormat('pdf')}
                >
                  <Ionicons name="document-text" size={18} color={shareFormat === 'pdf' ? '#0284c7' : colors.subText} />
                  <Text style={[styles.shareOptionTitle, { color: shareFormat === 'pdf' ? '#0284c7' : colors.text }]}>
                    Lead Sheet PDF
                  </Text>
                  <Text style={[styles.shareOptionSub, { color: colors.subText }]}>
                    Printable high-contrast chord charts & lyrics booklet
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Target Type */}
              <Text style={[styles.inputLabel, { color: colors.subText }]}>Destination Channel</Text>
              <View style={{ gap: 6, marginBottom: 12 }}>
                {[
                  { key: 'ministry_chat', label: 'Ministry Team Chat', icon: 'chatbubbles', desc: 'Post to ministry volunteers chat space' },
                  { key: 'ministry_announcement', label: 'Ministry Hub Announcement', icon: 'megaphone', desc: 'Post to ministry classroom stream' },
                  { key: 'general_chat', label: 'General Church Chat', icon: 'people', desc: 'Post to whole-church general chat' },
                  { key: 'general_announcement', label: 'General Church Announcement', icon: 'radio', desc: 'Official announcement (pastors/admins)' },
                ].map((target) => (
                  <TouchableOpacity
                    key={target.key}
                    style={[
                      styles.targetRadioItem,
                      shareTargetType === target.key && { borderColor: colors.primary, backgroundColor: colors.inputBg },
                      { borderColor: colors.border },
                    ]}
                    onPress={() => setShareTargetType(target.key)}
                  >
                    <Ionicons
                      name={shareTargetType === target.key ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={shareTargetType === target.key ? colors.primary : colors.subText}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.targetRadioTitle, { color: colors.text }]}>{target.label}</Text>
                      <Text style={[styles.targetRadioDesc, { color: colors.subText }]}>{target.desc}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Ministry Selector (if ministry target selected) */}
              {['ministry_chat', 'ministry_announcement'].includes(shareTargetType) && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.inputLabel, { color: colors.subText }]}>Select Ministry</Text>
                  {shareMinistries.length === 0 ? (
                    <Text style={{ fontSize: 12, color: colors.subText, fontStyle: 'italic' }}>
                      Loading ministries...
                    </Text>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 6 }}>
                      {shareMinistries.map((m) => {
                        const isSelected = shareSelectedMinistryId === m.id;
                        return (
                          <TouchableOpacity
                            key={m.id}
                            style={[
                              styles.ministryPill,
                              isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                              { borderColor: colors.border, backgroundColor: colors.inputBg },
                            ]}
                            onPress={() => setShareSelectedMinistryId(m.id)}
                          >
                            <Text style={[styles.ministryPillText, { color: isSelected ? '#ffffff' : colors.text }]}>
                              {m.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              )}

              {/* Optional Message */}
              <Text style={[styles.inputLabel, { color: colors.subText }]}>Caption / Note (Optional)</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, minHeight: 60, textAlignVertical: 'top' },
                ]}
                value={shareMessage}
                onChangeText={setShareMessage}
                placeholder="e.g. Here is this Sunday's worship setlist for rehearsal!"
                placeholderTextColor={colors.subText}
                multiline
              />
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setIsShareToMinistryOpen(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.subText }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }, sharingToMinistry && { opacity: 0.5 }]}
                disabled={sharingToMinistry}
                onPress={handleConfirmShareToMinistry}
              >
                {sharingToMinistry ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveBtnText}>Send to Hub / Chat</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  createSetlistBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 12,
  },
  createSetlistBannerText: {
    fontSize: 13,
    fontWeight: '800',
  },
  setlistCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
    overflow: 'hidden',
  },
  setlistCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  setlistName: {
    fontSize: 14,
    fontWeight: '700',
  },
  setlistSub: {
    fontSize: 11,
  },
  scopeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  scopeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  setlistActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  setlistActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  setlistActionText: {
    fontSize: 11,
    fontWeight: '700',
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
  modalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    width: '100%',
    maxWidth: 480,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  infoBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  infoSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  choicePill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choicePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalTextInput: {
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalSubmitBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyBuilderBox: {
    padding: 30,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  emptyBuilderText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  builderSongCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  builderIndexCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(197, 156, 108, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  builderIndexText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#c59c6c',
  },
  builderSongTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  builderSongArtist: {
    fontSize: 10,
    marginTop: 1,
  },
  miniKeyPill: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
  },
  reorderBtn: {
    padding: 5,
  },
  builderFooter: {
    padding: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  builderSaveBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  builderSaveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  pickerSongItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 6,
  },
  shareOptionCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  shareOptionTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 2,
  },
  shareOptionSub: {
    fontSize: 10,
    lineHeight: 13,
  },
  targetRadioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  targetRadioTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  targetRadioDesc: {
    fontSize: 10,
    marginTop: 1,
  },
  ministryPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 6,
  },
  ministryPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
