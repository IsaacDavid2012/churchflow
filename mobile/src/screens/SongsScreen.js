import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { api } from '../api/client';

export default function SongsScreen({ isDark = false }) {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Add Song Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [defaultKey, setDefaultKey] = useState('C');
  const [bpm, setBpm] = useState('72');
  const [ccliNumber, setCcliNumber] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [chartUrl, setChartUrl] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchSongs = async () => {
    try {
      const data = await api.getSongs();
      setSongs(data || []);
    } catch (err) {
      console.error('Fetch songs error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSongs();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSongs();
  };

  const handleCreateSong = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Song title is required');
      return;
    }

    setSaving(true);
    try {
      await api.createSong({
        title,
        artist,
        default_key: defaultKey,
        bpm: parseInt(bpm, 10) || 72,
        ccli_number: ccliNumber,
        youtube_url: youtubeUrl,
        chart_url: chartUrl,
        lyrics,
      });
      setIsModalOpen(false);
      setTitle('');
      setArtist('');
      fetchSongs();
      Alert.alert('Song Added', `"${title}" was added to the worship library.`);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save song');
    } finally {
      setSaving(false);
    }
  };

  const filteredSongs = songs.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.title?.toLowerCase().includes(q) ||
      s.artist?.toLowerCase().includes(q) ||
      s.default_key?.toLowerCase().includes(q)
    );
  });

  const bg = isDark ? '#020617' : '#f8fafc';
  const cardBg = isDark ? '#0f172a' : '#ffffff';
  const border = isDark ? '#1e293b' : '#e2e8f0';
  const textPrimary = isDark ? '#ffffff' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? '#1e293b' : '#f1f5f9';

  const renderSong = ({ item }) => (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={styles.cardHeader}>
        <View style={styles.keyBadge}>
          <Text style={styles.keyText}>{item.default_key || 'C'}</Text>
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.songTitle, { color: textPrimary }]}>{item.title}</Text>
          <Text style={[styles.songArtist, { color: textSecondary }]}>
            {item.artist || 'Unknown Artist'}
          </Text>
          <View style={styles.songMetaRow}>
            {item.bpm ? (
              <Text style={[styles.metaBadge, { color: textSecondary }]}>⏱️ {item.bpm} BPM</Text>
            ) : null}
            {item.ccli_number ? (
              <Text style={[styles.metaBadge, { color: textSecondary }]}>CCLI: {item.ccli_number}</Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Links footer */}
      <View style={[styles.cardFooter, { borderTopColor: border }]}>
        <View style={styles.linksRow}>
          {item.youtube_url ? (
            <TouchableOpacity
              style={[styles.linkBtn, styles.ytBtn]}
              onPress={() => Linking.openURL(item.youtube_url)}
            >
              <Text style={styles.ytText}>▶ YouTube</Text>
            </TouchableOpacity>
          ) : null}

          {item.chart_url ? (
            <TouchableOpacity
              style={[styles.linkBtn, styles.chartBtn]}
              onPress={() => Linking.openURL(item.chart_url)}
            >
              <Text style={styles.chartText}>📄 Chord Chart</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Header bar */}
      <View style={[styles.headerBar, { backgroundColor: cardBg, borderBottomColor: border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>Song Library</Text>
          <Text style={[styles.headerSub, { color: textSecondary }]}>
            {songs.length} Worship Arrangements & Chord Charts
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setIsModalOpen(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>+ Add Song</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={[styles.searchBarContainer, { backgroundColor: cardBg, borderBottomColor: border }]}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
          placeholder="Search songs by title, artist, key..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#dc2626" />
        </View>
      ) : (
        <FlatList
          data={filteredSongs}
          keyExtractor={(item) => item.id}
          renderItem={renderSong}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🎵</Text>
              <Text style={[styles.emptyTitle, { color: textPrimary }]}>No songs found</Text>
              <Text style={[styles.emptySub, { color: textSecondary }]}>
                Add worship songs, chord charts, and YouTube URLs above.
              </Text>
            </View>
          }
        />
      )}

      {/* Add Song Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: border }]}>
              <Text style={[styles.modalTitle, { color: textPrimary }]}>Add New Worship Song</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={[styles.formLabel, { color: textPrimary }]}>SONG TITLE *</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Firm Foundation (He Won't)"
                placeholderTextColor="#94a3b8"
              />

              <Text style={[styles.formLabel, { color: textPrimary }]}>ARTIST / BAND</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                value={artist}
                onChangeText={setArtist}
                placeholder="e.g. Cody Carnes & Maverick City"
                placeholderTextColor="#94a3b8"
              />

              <View style={styles.rowTwoCols}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.formLabel, { color: textPrimary }]}>DEFAULT KEY</Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                    value={defaultKey}
                    onChangeText={setDefaultKey}
                    placeholder="e.g. Bb or G"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.formLabel, { color: textPrimary }]}>BPM</Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                    value={bpm}
                    onChangeText={setBpm}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={[styles.formLabel, { color: textPrimary }]}>YOUTUBE VIDEO URL</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                value={youtubeUrl}
                onChangeText={setYoutubeUrl}
                placeholder="https://youtube.com/watch?v=..."
                placeholderTextColor="#94a3b8"
              />

              <Text style={[styles.formLabel, { color: textPrimary }]}>CHORD CHART URL (PDF / WEB)</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                value={chartUrl}
                onChangeText={setChartUrl}
                placeholder="https://tabs.ultimate-guitar.com/..."
                placeholderTextColor="#94a3b8"
              />

              <TouchableOpacity
                style={[styles.submitBtn, saving && styles.buttonDisabled]}
                onPress={handleCreateSong}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Add Song to Library</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
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
  headerBar: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  addBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 13,
  },
  list: {
    padding: 16,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  keyBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#dc2626',
  },
  songTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  songArtist: {
    fontSize: 12,
    marginTop: 2,
  },
  songMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  metaBadge: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardFooter: {
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 8,
  },
  linksRow: {
    flexDirection: 'row',
    gap: 8,
  },
  linkBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  ytBtn: {
    backgroundColor: '#fef2f2',
  },
  chartBtn: {
    backgroundColor: '#eff6ff',
  },
  ytText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '800',
  },
  chartText: {
    color: '#2563eb',
    fontSize: 11,
    fontWeight: '800',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    maxHeight: '85%',
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    fontSize: 18,
    color: '#94a3b8',
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  rowTwoCols: {
    flexDirection: 'row',
  },
  submitBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 10,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
