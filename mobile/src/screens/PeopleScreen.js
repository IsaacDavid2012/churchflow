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

const AVAILABLE_ROLES = [
  'Worship Leader',
  'Lead Vocals',
  'Backing Vocals',
  'Acoustic Guitar',
  'Electric Guitar',
  'Bass',
  'Drums',
  'Keys',
  'Synth / Aux Keys',
  'Sound / Audio',
  'Media / Visuals',
];

export default function PeopleScreen({ isDark = false }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roles, setRoles] = useState(['Vocals']);
  const [saving, setSaving] = useState(false);

  const fetchPeople = async () => {
    try {
      const data = await api.getMusicians();
      setPeople(data || []);
    } catch (err) {
      console.error('Fetch people error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPeople();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPeople();
  };

  const toggleRole = (r) => {
    if (roles.includes(r)) {
      setRoles(roles.filter((x) => x !== r));
    } else {
      setRoles([...roles, r]);
    }
  };

  const handleCreateMember = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Volunteer full name is required');
      return;
    }

    setSaving(true);
    try {
      await api.createMusician({
        name,
        email,
        phone,
        roles,
        active: true,
      });
      setIsModalOpen(false);
      setName('');
      setEmail('');
      setPhone('');
      fetchPeople();
      Alert.alert('Member Added', `${name} has been added to the church directory.`);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save member');
    } finally {
      setSaving(false);
    }
  };

  const filteredPeople = people.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      (p.roles && p.roles.some((r) => r.toLowerCase().includes(q)))
    );
  });

  const bg = isDark ? '#020617' : '#f8fafc';
  const cardBg = isDark ? '#0f172a' : '#ffffff';
  const border = isDark ? '#1e293b' : '#e2e8f0';
  const textPrimary = isDark ? '#ffffff' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? '#1e293b' : '#f1f5f9';

  const renderPerson = ({ item }) => (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name ? item.name[0] : 'U'}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.nameRow}>
            <Text style={[styles.nameText, { color: textPrimary }]}>{item.name}</Text>
            <View style={styles.activeTag}>
              <Text style={styles.activeTagText}>{item.active ? 'ACTIVE' : 'INACTIVE'}</Text>
            </View>
          </View>

          {/* Role tags */}
          <View style={styles.roleChipsRow}>
            {(item.roles || []).map((r) => (
              <View
                key={r}
                style={[
                  styles.roleChip,
                  { backgroundColor: isDark ? '#1e293b' : '#fee2e2' },
                ]}
              >
                <Text style={styles.roleChipText}>{r}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Serving stats & actions */}
      <View style={[styles.cardFooter, { borderTopColor: border }]}>
        <View>
          <Text style={[styles.serveHistory, { color: textSecondary }]}>
            Last served: <Text style={{ color: textPrimary, fontWeight: '700' }}>{item.last_served_date || 'Never'}</Text>
          </Text>
          <Text style={[styles.serveCount, { color: textSecondary }]}>
            {item.total_confirmed_serves || 0} total services
          </Text>
        </View>

        <View style={styles.contactActions}>
          {item.phone ? (
            <TouchableOpacity
              style={[styles.contactBtn, styles.callBtn]}
              onPress={() => Linking.openURL(`tel:${item.phone}`)}
            >
              <Text style={styles.contactBtnText}>📞 Call</Text>
            </TouchableOpacity>
          ) : null}
          {item.email ? (
            <TouchableOpacity
              style={[styles.contactBtn, styles.emailBtn]}
              onPress={() => Linking.openURL(`mailto:${item.email}`)}
            >
              <Text style={styles.contactBtnText}>✉️ Email</Text>
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
          <Text style={[styles.headerTitle, { color: textPrimary }]}>People Directory</Text>
          <Text style={[styles.headerSub, { color: textSecondary }]}>
            {people.length} Volunteers & Ministry Team Members
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setIsModalOpen(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>+ Add Member</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={[styles.searchBarContainer, { backgroundColor: cardBg, borderBottomColor: border }]}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
          placeholder="Search members by name, instrument, or email..."
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
          data={filteredPeople}
          keyExtractor={(item) => item.id}
          renderItem={renderPerson}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={[styles.emptyTitle, { color: textPrimary }]}>No members found</Text>
              <Text style={[styles.emptySub, { color: textSecondary }]}>
                Add volunteer musicians, worship leaders, and AV crew above.
              </Text>
            </View>
          }
        />
      )}

      {/* Add Member Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: border }]}>
              <Text style={[styles.modalTitle, { color: textPrimary }]}>Add Ministry Volunteer</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={[styles.formLabel, { color: textPrimary }]}>FULL NAME *</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Caleb Wright"
                placeholderTextColor="#94a3b8"
              />

              <Text style={[styles.formLabel, { color: textPrimary }]}>EMAIL ADDRESS</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                value={email}
                onChangeText={setEmail}
                placeholder="caleb@jesusmyrock.org"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
              />

              <Text style={[styles.formLabel, { color: textPrimary }]}>PHONE NUMBER</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="017-600 1484"
                placeholderTextColor="#94a3b8"
              />

              <Text style={[styles.formLabel, { color: textPrimary }]}>CAPABILITIES & INSTRUMENTS</Text>
              <View style={styles.rolePickerRow}>
                {AVAILABLE_ROLES.map((r) => {
                  const selected = roles.includes(r);
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.roleSelectChip,
                        { borderColor: border, backgroundColor: isDark ? '#1e293b' : '#f1f5f9' },
                        selected && styles.roleSelectChipActive,
                      ]}
                      onPress={() => toggleRole(r)}
                    >
                      <Text
                        style={[
                          styles.roleSelectText,
                          { color: textSecondary },
                          selected && styles.roleSelectTextActive,
                        ]}
                      >
                        {selected ? `✓ ${r}` : `+ ${r}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, saving && styles.buttonDisabled]}
                onPress={handleCreateMember}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Add to Directory</Text>
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#dc2626',
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameText: {
    fontSize: 15,
    fontWeight: '800',
  },
  activeTag: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeTagText: {
    color: '#16a34a',
    fontSize: 9,
    fontWeight: '900',
  },
  roleChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  roleChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleChipText: {
    color: '#dc2626',
    fontSize: 10,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 10,
  },
  serveHistory: {
    fontSize: 11,
  },
  serveCount: {
    fontSize: 10,
    marginTop: 1,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  contactBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  callBtn: {
    backgroundColor: '#eff6ff',
  },
  emailBtn: {
    backgroundColor: '#f1f5f9',
  },
  contactBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
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
    marginTop: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  rolePickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 6,
  },
  roleSelectChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  roleSelectChipActive: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  roleSelectText: {
    fontSize: 11,
    fontWeight: '700',
  },
  roleSelectTextActive: {
    color: '#ffffff',
    fontWeight: '800',
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
