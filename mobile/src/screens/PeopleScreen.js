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

const MINISTRIES = ['All', 'Worship', 'Production', 'Ushers', 'Kids Church', 'Hospitality'];

export default function PeopleScreen({ user, isDark = false }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMinistry, setSelectedMinistry] = useState('All');

  // Add Member Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [instrument, setInstrument] = useState('Vocals');
  const [ministry, setMinistry] = useState('Worship');
  const [saving, setSaving] = useState(false);

  const fetchPeople = async () => {
    try {
      setLoading(true);
      const data = await api.getMusicians();
      setPeople(data || []);
    } catch (err) {
      console.error('Fetch people error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeople();
  }, []);

  const handleAddPerson = async () => {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Required Fields', 'Please enter at least a Name and Email address.');
      return;
    }

    setSaving(true);
    try {
      await api.createMusician({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        primary_instrument: instrument,
        ministry: ministry,
      });

      setIsModalOpen(false);
      setName('');
      setEmail('');
      setPhone('');
      fetchPeople();
      Alert.alert('Volunteer Added', `${name} has been added to ChurchFlow.`);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not add volunteer');
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

  const filteredPeople = people.filter((p) => {
    const matchesSearch =
      (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.primary_instrument || '').toLowerCase().includes(search.toLowerCase());

    const matchesMin =
      selectedMinistry === 'All' ||
      (p.ministry || 'Worship').toLowerCase() === selectedMinistry.toLowerCase();

    return matchesSearch && matchesMin;
  });

  const renderPersonCard = ({ item }) => {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>
              {(item.name || 'U').slice(0, 2).toUpperCase()}
            </Text>
          </View>

          <View style={styles.personDetails}>
            <Text style={[styles.personName, { color: colors.text }]}>{item.name}</Text>
            <View style={styles.roleTagsRow}>
              <View style={[styles.roleChip, { backgroundColor: colors.badgeBg }]}>
                <Text style={[styles.roleChipText, { color: colors.text }]}>
                  {item.primary_instrument || 'Volunteer'}
                </Text>
              </View>
              {item.can_lead_worship ? (
                <View style={styles.worshipLeaderBadge}>
                  <Text style={styles.worshipLeaderBadgeText}>👑 Leader</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.lastServedText, { color: colors.subText }]}>
              Last served: {item.last_served_date || 'Never'}
            </Text>
          </View>
        </View>

        {/* Action Buttons Row: Call, WhatsApp, Email */}
        <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
          {item.phone ? (
            <>
              <TouchableOpacity
                style={styles.contactBtn}
                onPress={() => Linking.openURL(`tel:${item.phone}`)}
              >
                <Ionicons name="call-outline" size={16} color={colors.primary} />
                <Text style={[styles.contactBtnText, { color: colors.primary }]}>Call</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.contactBtn}
                onPress={() => Linking.openURL(`https://wa.me/${item.phone.replace(/[^0-9]/g, '')}`)}
              >
                <Ionicons name="logo-whatsapp" size={16} color="#16a34a" />
                <Text style={[styles.contactBtnText, { color: '#16a34a' }]}>WhatsApp</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {item.email ? (
            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() => Linking.openURL(`mailto:${item.email}`)}
            >
              <Ionicons name="mail-outline" size={16} color={colors.subText} />
              <Text style={[styles.contactBtnText, { color: colors.subText }]}>Email</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.subText} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search volunteers by name, skill..."
            placeholderTextColor={colors.subText}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.subText} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Ministry Filter Pills */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={MINISTRIES}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.ministryPillsList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.ministryPill,
                {
                  backgroundColor: selectedMinistry === item ? colors.primary : colors.card,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setSelectedMinistry(item)}
            >
              <Text
                style={[
                  styles.ministryPillText,
                  { color: selectedMinistry === item ? '#ffffff' : colors.text },
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Directory List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredPeople}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPersonCard}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={colors.subText} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Volunteers Found</Text>
              <Text style={[styles.emptySubtitle, { color: colors.subText }]}>
                {search ? 'Try a different search term.' : 'Add volunteers to your directory.'}
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
        <Ionicons name="person-add" size={20} color="#ffffff" />
        <Text style={styles.fabText}>Add Member</Text>
      </TouchableOpacity>

      {/* Add Member Bottom Sheet Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Church Volunteer</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={22} color={colors.subText} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.subText }]}>Full Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Marcus Reed"
              placeholderTextColor={colors.subText}
            />

            <Text style={[styles.inputLabel, { color: colors.subText }]}>Email Address *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="marcus@churchflow.art"
              placeholderTextColor={colors.subText}
            />

            <Text style={[styles.inputLabel, { color: colors.subText }]}>Phone / WhatsApp Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+60176001484"
              placeholderTextColor={colors.subText}
            />

            <Text style={[styles.inputLabel, { color: colors.subText }]}>Primary Role / Skill</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={instrument}
              onChangeText={setInstrument}
              placeholder="e.g. Lead Guitar, Audio Engineer, Vocalist"
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
                onPress={handleAddPerson}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Save Volunteer</Text>
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
    paddingBottom: 4,
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
  ministryPillsList: {
    paddingVertical: 12,
    gap: 8,
  },
  ministryPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  ministryPillText: {
    fontSize: 12,
    fontWeight: '700',
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
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: '900',
    color: '#dc2626',
  },
  personDetails: {
    flex: 1,
    marginLeft: 12,
  },
  personName: {
    fontSize: 15,
    fontWeight: '800',
  },
  roleTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  roleChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  worshipLeaderBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  worshipLeaderBadgeText: {
    color: '#b45309',
    fontSize: 10,
    fontWeight: '800',
  },
  lastServedText: {
    fontSize: 11,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 10,
    gap: 16,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contactBtnText: {
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
