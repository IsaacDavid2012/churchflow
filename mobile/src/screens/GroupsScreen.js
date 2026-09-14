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
} from 'react-native';
import { api } from '../api/client';

const CATEGORIES = [
  'Bible Study',
  'Youth & Young Adults',
  'Men of Valor',
  'Women of Grace',
  'Couples & Family',
  'Prayer & Intercession',
  'Worship & Creative',
];

export default function GroupsScreen({ isDark = false }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Add Group Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Bible Study');
  const [leaderName, setLeaderName] = useState('');
  const [meetingDay, setMeetingDay] = useState('Wednesday');
  const [meetingTime, setMeetingTime] = useState('7:30 PM');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchGroups = async () => {
    try {
      const data = await api.getGroups();
      setGroups(data || []);
    } catch (err) {
      console.error('Fetch groups error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchGroups();
  };

  const handleCreateGroup = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Group name is required');
      return;
    }

    setSaving(true);
    try {
      await api.createGroup({
        name,
        category,
        leader_name: leaderName,
        meeting_day: meetingDay,
        meeting_time: meetingTime,
        location,
      });
      setIsModalOpen(false);
      setName('');
      setLeaderName('');
      setLocation('');
      fetchGroups();
      Alert.alert('Group Created', `"${name}" life group has been registered.`);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to create group');
    } finally {
      setSaving(false);
    }
  };

  const filteredGroups = groups.filter((g) => {
    const q = search.toLowerCase();
    return (
      g.name?.toLowerCase().includes(q) ||
      g.category?.toLowerCase().includes(q) ||
      g.leader_name?.toLowerCase().includes(q)
    );
  });

  const bg = isDark ? '#020617' : '#f8fafc';
  const cardBg = isDark ? '#0f172a' : '#ffffff';
  const border = isDark ? '#1e293b' : '#e2e8f0';
  const textPrimary = isDark ? '#ffffff' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? '#1e293b' : '#f1f5f9';

  const renderGroup = ({ item }) => (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.badgeRow}>
            <View style={[styles.categoryBadge, { backgroundColor: isDark ? '#1e293b' : '#fee2e2' }]}>
              <Text style={styles.categoryText}>{item.category || 'Life Group'}</Text>
            </View>
            <Text style={[styles.memberCountText, { color: textSecondary }]}>
              👥 {item.member_count || 0} members
            </Text>
          </View>
          <Text style={[styles.groupName, { color: textPrimary }]}>{item.name}</Text>
          <Text style={[styles.groupMeta, { color: textSecondary }]}>
            🕒 {item.meeting_day}s at {item.meeting_time}
          </Text>
          {item.location ? (
            <Text style={[styles.locationText, { color: textSecondary }]}>📍 {item.location}</Text>
          ) : null}
        </View>
      </View>

      <View style={[styles.cardFooter, { borderTopColor: border }]}>
        <Text style={[styles.leaderText, { color: textSecondary }]}>
          Leader: <Text style={{ color: textPrimary, fontWeight: '700' }}>{item.leader_name || 'Ministry Team'}</Text>
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Header bar */}
      <View style={[styles.headerBar, { backgroundColor: cardBg, borderBottomColor: border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>Small Groups</Text>
          <Text style={[styles.headerSub, { color: textSecondary }]}>
            {groups.length} Discipleship & Life Groups
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setIsModalOpen(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>+ New Group</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={[styles.searchBarContainer, { backgroundColor: cardBg, borderBottomColor: border }]}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
          placeholder="Search groups by name, category, or leader..."
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
          data={filteredGroups}
          keyExtractor={(item) => item.id}
          renderItem={renderGroup}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🤝</Text>
              <Text style={[styles.emptyTitle, { color: textPrimary }]}>No groups created yet</Text>
              <Text style={[styles.emptySub, { color: textSecondary }]}>
                Register small groups, Bible studies, and fellowships above.
              </Text>
            </View>
          }
        />
      )}

      {/* Add Group Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: border }]}>
              <Text style={[styles.modalTitle, { color: textPrimary }]}>Create Small Group</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={[styles.formLabel, { color: textPrimary }]}>GROUP NAME *</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Young Adults Fellowship"
                placeholderTextColor="#94a3b8"
              />

              <Text style={[styles.formLabel, { color: textPrimary }]}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.catChip,
                      { borderColor: border, backgroundColor: isDark ? '#1e293b' : '#f1f5f9' },
                      category === c && styles.catChipActive,
                    ]}
                    onPress={() => setCategory(c)}
                  >
                    <Text
                      style={[
                        styles.catChipText,
                        { color: textSecondary },
                        category === c && styles.catChipTextActive,
                      ]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.formLabel, { color: textPrimary }]}>GROUP LEADER</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                value={leaderName}
                onChangeText={setLeaderName}
                placeholder="e.g. Marcus & Chloe"
                placeholderTextColor="#94a3b8"
              />

              <View style={styles.rowTwoCols}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.formLabel, { color: textPrimary }]}>MEETING DAY</Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                    value={meetingDay}
                    onChangeText={setMeetingDay}
                    placeholder="Wednesday"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.formLabel, { color: textPrimary }]}>TIME</Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                    value={meetingTime}
                    onChangeText={setMeetingTime}
                    placeholder="7:30 PM"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              <Text style={[styles.formLabel, { color: textPrimary }]}>LOCATION / HOST ADDRESS</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                value={location}
                onChangeText={setLocation}
                placeholder="Sanctuary Room 204 or North Campus"
                placeholderTextColor="#94a3b8"
              />

              <TouchableOpacity
                style={[styles.submitBtn, saving && styles.buttonDisabled]}
                onPress={handleCreateGroup}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Create Life Group</Text>
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
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryText: {
    color: '#dc2626',
    fontSize: 10,
    fontWeight: '800',
  },
  memberCountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  groupName: {
    fontSize: 15,
    fontWeight: '800',
  },
  groupMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  locationText: {
    fontSize: 12,
    marginTop: 2,
  },
  cardFooter: {
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 8,
  },
  leaderText: {
    fontSize: 11,
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
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 6,
  },
  catChipActive: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  catChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
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
