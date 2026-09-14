import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';

export default function SongsScreen({ user, isDark = false }) {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add Song Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [key, setKey] = useState('G');
  const [bpm, setBpm] = useState('72');
  const [ccli, setCcli] = useState('');
  const [tags, setTags] = useState('Praise, Upbeat');
  const [saving, setSaving] = useState(false);

  const fetchSongs = async () => {
    try {
      setLoading(true);
      const data = await api.getSongs();
      setSongs(data || []);
    } catch (err) {
      console.error('Fetch songs error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSongs();
  }, []);

  const handleAddSong = async () => {
    if (!title.trim() || !artist.trim()) {
      Alert.alert('Required Fields', 'Please enter Title and Artist.');
      return;
    }

    setSaving(true);
    try {
      await api.createSong({
        title: title.trim(),
        artist: artist.trim(),
        default_key: key.trim() || 'G',
        bpm: parseInt(bpm, 10) || 72,
        ccli_number: ccli.trim() || undefined,
        tags: tags.trim() || undefined,
      });

      setIsModalOpen(false);
      setTitle('');
      setArtist('');
      setCcli('');
      fetchSongs();
      Alert.alert('Song Added', `"${title}" has been added to the library.`);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not add song');
    } finally {
      setSaving(false);
    }
  };

  const colors = {
    bg: isDark ? '#020617' : '#f8fafc',
    card: isDark ? '#0f172a' : '#ffffff',
    border: isDark ? '#1e293b' : '#e2e8f0',
    text: isDark ? '#ffffff' : '#0f172a',
    subText: isDark ? '#94a3b8' : '#64748b',
    primary: '#dc2626',
    primaryLight: isDark ? '#3b0d0c' : '#fee2e2',
    inputBg: isDark ? '#1e293b' : '#f1f5f9',
    badgeBg: isDark ? '#1e293b' : '#f1f5f9',
  };

  const filteredSongs = songs.filter((s) => {
    const q = search.toLowerCase();
    return (
      (s.title || '').toLowerCase().includes(q) ||
      (s.artist || '').toLowerCase().includes(q) ||
      (s.default_key || '').toLowerCase().includes(q) ||
      (s.tags || '').toLowerCase().includes(q)
    );
  });

  const renderSongItem = ({ item }) => {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeaderRow}>
          {/* Key Badge */}
          <View style={[styles.keyBadge, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.keyText, { color: colors.primary }]}>{item.default_key || 'G'}</Text>
            <Text style={[styles.keySubText, { color: colors.primary }]}>KEY</Text>
          </View>

          {/* Song Info */}
          <View style={styles.songDetails}>
            <Text style={[styles.songTitle, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.songArtist, { color: colors.subText }]}>{item.artist}</Text>

            <View style={styles.metaRow}>
              {item.bpm ? (
                <View style={[styles.metaChip, { backgroundColor: colors.badgeBg }]}>
                  <Ionicons name="speedometer-outline" size={12} color={colors.subText} />
                  <Text style={[styles.metaChipText, { color: colors.text }]}>{item.bpm} BPM</Text>
                </View>
              ) : null}

              {item.ccli_number ? (
                <View style={[styles.metaChip, { backgroundColor: colors.badgeBg }]}>
                  <Text style={[styles.metaChipText, { color: colors.subText }]}>
                    CCLI #{item.ccli_number}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Quick Actions Row */}
        <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() =>
              Linking.openURL(
                `https://www.youtube.com/results?search_query=${encodeURIComponent(
                  item.title + ' ' + item.artist + ' worship'
                )}`
              )
            }
          >
            <Ionicons name="play-circle-outline" size={16} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>YouTube Preview</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() =>
              Linking.openURL(
                `https://www.google.com/search?q=${encodeURIComponent(
                  item.title + ' ' + item.artist + ' chord chart pdf'
                )}`
              )
            }
          >
            <Ionicons name="document-text-outline" size={16} color={colors.subText} />
            <Text style={[styles.actionBtnText, { color: colors.subText }]}>Chord Chart</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Search Header */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.subText} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search songs by title, artist, key..."
            placeholderTextColor={colors.subText}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.subText} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Song List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredSongs}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderSongItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="musical-notes-outline" size={48} color={colors.subText} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Songs Found</Text>
              <Text style={[styles.emptySubtitle, { color: colors.subText }]}>
                {search ? 'Try another search keyword.' : 'Add worship songs to your library.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        activeOpacity={0.85}
        onPress={() => setIsModalOpen(true)}
      >
        <Ionicons name="add" size={24} color="#ffffff" />
        <Text style={styles.fabText}>Add Song</Text>
      </TouchableOpacity>

      {/* Add Song Bottom Sheet Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Worship Song</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={22} color={colors.subText} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              <Text style={[styles.inputLabel, { color: colors.subText }]}>Song Title *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Way Maker"
                placeholderTextColor={colors.subText}
              />

              <Text style={[styles.inputLabel, { color: colors.subText }]}>Artist / Composer *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={artist}
                onChangeText={setArtist}
                placeholder="e.g. Sinach / Leeland"
                placeholderTextColor={colors.subText}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.subText }]}>Default Key</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                    value={key}
                    onChangeText={setKey}
                    placeholder="G"
                    placeholderTextColor={colors.subText}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.subText }]}>BPM Tempo</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                    value={bpm}
                    onChangeText={setBpm}
                    keyboardType="numeric"
                    placeholder="72"
                    placeholderTextColor={colors.subText}
                  />
                </View>
              </View>

              <Text style={[styles.inputLabel, { color: colors.subText }]}>CCLI Song Number</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={ccli}
                onChangeText={setCcli}
                placeholder="7115744"
                placeholderTextColor={colors.subText}
              />
            </ScrollView>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setIsModalOpen(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                onPress={handleAddSong}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Save Song</Text>
                )}
              </TouchableOpacity>
            </View>
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
  searchSection: {
    padding: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  keyBadge: {
    width: 48,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 18,
    fontWeight: '900',
  },
  keySubText: {
    fontSize: 9,
    fontWeight: '800',
  },
  songDetails: {
    flex: 1,
    marginLeft: 14,
  },
  songTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  songArtist: {
    fontSize: 13,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metaChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 10,
    gap: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 26,
    ...Platform.select({
      ios: {
        shadowColor: '#dc2626',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  fabText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
