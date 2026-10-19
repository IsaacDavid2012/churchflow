import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';

export default function PositionsScreen({ user, isDark = false }) {
  const [positions, setPositions] = useState([]);
  const [ministries, setMinistries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add Position Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [ministry, setMinistry] = useState('Media Team');
  const [saving, setSaving] = useState(false);

  const fetchPositions = async () => {
    try {
      const [posData, minData] = await Promise.all([
        api.getPositions(),
        api.getMinistries().catch(() => []),
      ]);
      setPositions(Array.isArray(posData) ? posData : []);
      const minList = Array.isArray(minData) ? minData : [];
      setMinistries(minList);
      if (minList.length > 0 && !ministry) {
        setMinistry(minList[0].name || 'Media Team');
      }
    } catch (err) {
      console.error('Fetch positions error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPositions();
  };

  const handleCreatePosition = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter a position name (e.g. Live Camera, OBS, PP7).');
      return;
    }

    setSaving(true);
    try {
      await api.createPosition({
        name: name.trim(),
        ministry: ministry || 'Media Team',
      });
      setIsModalOpen(false);
      setName('');
      fetchPositions();
      Alert.alert('Position Added', `"${name.trim()}" has been added.`);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to add position');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePosition = (pos) => {
    Alert.alert(
      'Delete Position',
      `Are you sure you want to delete "${pos.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deletePosition(pos.id);
              fetchPositions();
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete position');
            }
          },
        },
      ]
    );
  };

  const colors = {
    bg: isDark ? '#020617' : '#ffffff',
    card: isDark ? '#0f172a' : '#ffffff',
    border: isDark ? '#1e293b' : '#eadbc4',
    text: isDark ? '#ffffff' : '#0f172a',
    subText: isDark ? '#94a3b8' : '#64748b',
    primary: '#c59c6c',
    primaryLight: isDark ? '#3a2815' : '#f5ede1',
    inputBg: isDark ? '#1e293b' : '#fbf8f3',
  };

  const renderPositionItem = ({ item, index }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardLeft}>
        <View style={[styles.orderBadge, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.orderText, { color: colors.primary }]}>{index + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.posName, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.posMinistry, { color: colors.subText }]}>
            {item.ministry || 'Media Team'}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={() => handleDeletePosition(item)}
        style={styles.deleteBtn}
      >
        <Ionicons name="trash-outline" size={18} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={positions}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPositionItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text }}>
                Media & Ministry Positions ({positions.length})
              </Text>
              <Text style={{ fontSize: 12, color: colors.subText, marginTop: 2 }}>
                Synced with web database — used for service rosters and member role tickboxes.
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="layers-outline" size={48} color={colors.subText} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Positions Configured</Text>
              <Text style={[styles.emptySubtitle, { color: colors.subText }]}>
                Tap + Add Position below to add positions.
              </Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        activeOpacity={0.85}
        onPress={() => setIsModalOpen(true)}
      >
        <Ionicons name="add" size={22} color="#ffffff" />
        <Text style={styles.fabText}>Add Position</Text>
      </TouchableOpacity>

      <Modal visible={isModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add New Position</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={22} color={colors.subText} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.subText }]}>Position Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Live Camera, OBS, PP7, Sound (FOH)"
              placeholderTextColor={colors.subText}
            />

            <Text style={[styles.inputLabel, { color: colors.subText }]}>Team / Ministry</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={ministry}
              onChangeText={setMinistry}
              placeholder="Media Team"
              placeholderTextColor={colors.subText}
            />

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setIsModalOpen(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                onPress={handleCreatePosition}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Add Position</Text>
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
  container: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 90 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  orderBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderText: { fontSize: 13, fontWeight: '900' },
  posName: { fontSize: 15, fontWeight: '800' },
  posMinistry: { fontSize: 12, marginTop: 2 },
  deleteBtn: { padding: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 50 },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginTop: 10 },
  emptySubtitle: { fontSize: 13, textAlign: 'center', marginTop: 4 },
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
      ios: { shadowColor: '#c59c6c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  fabText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 20, paddingBottom: 30 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  inputLabel: { fontSize: 12, fontWeight: '700', marginBottom: 4, marginTop: 8 },
  input: { height: 42, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 14 },
  modalActionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  cancelBtnText: { fontSize: 14, fontWeight: '600' },
  submitBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
