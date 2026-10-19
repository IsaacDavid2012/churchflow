import React, { useState, useEffect } from 'react';
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
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { ROLES, normalizeRole, hasRole } from '../utils/roles';
import MinistryHubScreen from './MinistryHubScreen';

const CATEGORIES = [
  'All',
  'Worship & Music',
  'Production & Tech',
  'Media & Tech',
  'Hospitality & Welcome',
  'Prayer & Pastoral Care',
  'NextGen & Children',
  'Youth & Young Adults',
];

export default function MinistriesScreen({ user, isDark = false }) {
  const [ministries, setMinistries] = useState([]);
  const [selectedMinistry, setSelectedMinistry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');

  // Role permissions
  const userRole = normalizeRole(user?.role);
  const isMember = userRole === ROLES.MEMBER;
  const canManage = !isMember; // Admin, Pastor, Manager
  const canDelete = hasRole(userRole, [ROLES.ADMIN, ROLES.PASTOR]); // Admin, Pastor only

  // Add / Edit Ministry Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMinistry, setEditingMinistry] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Worship & Music');
  const [leader, setLeader] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [meetingDay, setMeetingDay] = useState('Sunday');
  const [meetingTime, setMeetingTime] = useState('10:00 AM');
  const [description, setDescription] = useState('');
  const [memberCount, setMemberCount] = useState('8');
  const [saving, setSaving] = useState(false);

  const fetchMinistries = async () => {
    try {
      setLoading(true);
      const data = await api.getMinistries();
      setMinistries(data || []);
    } catch (err) {
      console.error('Fetch ministries error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMinistries();
  }, []);

  const handleOpenCreate = () => {
    if (isMember) return;
    setEditingMinistry(null);
    setName('');
    setCategory('Worship & Music');
    setLeader('');
    setPhone('');
    setLocation('Main Sanctuary');
    setMeetingDay('Thursday');
    setMeetingTime('8:00 PM');
    setDescription('');
    setMemberCount('8');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (m) => {
    if (!canManage) return;
    setEditingMinistry(m);
    setName(m.name || '');
    setCategory(m.category || 'Worship & Music');
    setLeader(m.leader_name || '');
    setPhone(m.leader_phone || '');
    setLocation(m.location || 'Main Sanctuary');
    setMeetingDay(m.meeting_day || 'Sunday');
    setMeetingTime(m.meeting_time || '10:00 AM');
    setDescription(m.description || '');
    setMemberCount(m.member_count ? m.member_count.toString() : '0');
    setIsModalOpen(true);
  };

  const handleSaveMinistry = async () => {
    if (isMember) {
      Alert.alert('Read-Only', 'Members have read-only access. You cannot create or modify ministries.');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter a Ministry Name.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        leader_name: leader.trim(),
        leader_phone: phone.trim() || undefined,
        location: location.trim() || undefined,
        meeting_day: meetingDay,
        meeting_time: meetingTime,
        description: description.trim() || undefined,
        member_count: parseInt(memberCount, 10) || 0,
      };

      if (editingMinistry) {
        await api.updateMinistry(editingMinistry.id, payload);
        Alert.alert('Ministry Updated', `"${name}" has been updated.`);
      } else {
        await api.createMinistry(payload);
        Alert.alert('Ministry Created', `"${name}" has been registered.`);
      }

      setIsModalOpen(false);
      fetchMinistries();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message || 'Could not save ministry');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMinistry = (m) => {
    if (!canDelete) {
      Alert.alert('Permission Denied', 'Only Admins and Pastors can delete ministries.');
      return;
    }

    Alert.alert(
      'Delete Ministry',
      `Are you sure you want to delete "${m.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteMinistry(m.id);
              fetchMinistries();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || err.message || 'Failed to delete ministry');
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
    primaryDark: '#8c6738',
    inputBg: isDark ? '#1e293b' : '#fbf8f3',
    badgeBg: isDark ? '#1e293b' : '#f5ede1',
  };

  const filteredMinistries = ministries.filter((m) => {
    const matchesCategory = selectedCategory === 'All' || (m.category || '').toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch = !search || 
      (m.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.leader_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.location || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.category || '').toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const renderMinistryCard = ({ item }) => {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeaderRow}>
          <View style={[styles.ministryIconBox, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="people" size={22} color={colors.primary} />
          </View>
          <View style={styles.ministryInfo}>
            <View style={styles.catBadgeRow}>
              <View style={[styles.catBadge, { backgroundColor: colors.badgeBg, borderColor: colors.border }]}>
                <Text style={[styles.catBadgeText, { color: colors.primaryDark }]}>
                  {item.category || 'Church Ministry'}
                </Text>
              </View>
            </View>
            <Text style={[styles.ministryTitle, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.ministryLeader, { color: colors.subText }]}>
              Leader: {item.leader_name || 'TBD'}
            </Text>
          </View>

          {/* Edit / Delete Buttons - STRICTLY HIDDEN FOR MEMBERS */}
          {canManage && (
            <View style={styles.headerActionBtns}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => handleOpenEdit(item)}
              >
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
              {canDelete && (
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => handleDeleteMinistry(item)}
                >
                  <Ionicons name="trash-outline" size={18} color="#e11d48" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {item.description ? (
          <Text style={[styles.descText, { color: colors.subText, backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            {item.description}
          </Text>
        ) : null}

        <View style={styles.metaSection}>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.primary} />
            <Text style={[styles.metaText, { color: colors.text }]}>
              {item.meeting_day || 'Sunday'} • {item.meeting_time || '10:00 AM'}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={colors.primary} />
            <Text style={[styles.metaText, { color: colors.text }]}>
              {item.location || 'Main Sanctuary'}
            </Text>
          </View>
        </View>

        {/* Contact Leader Actions */}
        {item.leader_phone ? (
          <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() => Linking.openURL(`tel:${item.leader_phone}`)}
            >
              <Ionicons name="call-outline" size={15} color={colors.primary} />
              <Text style={[styles.contactBtnText, { color: colors.primary }]}>Call Leader</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() =>
                Linking.openURL(`https://wa.me/${item.leader_phone.replace(/[^0-9]/g, '')}`)
              }
            >
              <Ionicons name="logo-whatsapp" size={15} color="#16a34a" />
              <Text style={[styles.contactBtnText, { color: '#16a34a' }]}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={[styles.footerRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerLabel, { color: colors.subText }]}>Active Volunteers</Text>
          <View style={[styles.memberCountBadge, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}>
            <Text style={[styles.memberCountText, { color: colors.primaryDark }]}>
              {item.member_count || 0} serving
            </Text>
          </View>
        </View>

        {/* Open Ministry Hub Button */}
        <TouchableOpacity
          style={[styles.openHubBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
          onPress={() => setSelectedMinistry(item)}
        >
          <Ionicons name="sparkles" size={14} color="#ffffff" />
          <Text style={styles.openHubBtnText}>Open {item.name} Hub</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (selectedMinistry) {
    return (
      <MinistryHubScreen
        ministry={selectedMinistry}
        user={user}
        isDark={isDark}
        onBack={() => {
          setSelectedMinistry(null);
          fetchMinistries();
        }}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Member Read-Only Notice Banner */}
      {isMember && (
        <View style={[styles.memberNotice, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}>
          <Ionicons name="eye-outline" size={16} color={colors.primaryDark} />
          <Text style={[styles.memberNoticeText, { color: colors.primaryDark }]}>
            Viewing as Member • Read-Only
          </Text>
        </View>
      )}

      {/* Search Input */}
      <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={16} color={colors.subText} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search ministries by name, department, leader..."
          placeholderTextColor={colors.subText}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={colors.subText} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Pills */}
      <View style={styles.categorySection}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.categoryList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.categoryPill,
                {
                  backgroundColor: selectedCategory === item ? colors.primary : colors.card,
                  borderColor: selectedCategory === item ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSelectedCategory(item)}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  { color: selectedCategory === item ? '#ffffff' : colors.text },
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Ministries List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredMinistries}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMinistryCard}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="business-outline" size={48} color={colors.subText} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Ministries Found</Text>
              <Text style={[styles.emptySubtitle, { color: colors.subText }]}>
                {canManage ? 'Tap + New Ministry below to register a church team.' : 'Active church ministries will appear here.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button - STRICTLY HIDDEN FOR MEMBERS */}
      {canManage && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
          onPress={handleOpenCreate}
        >
          <Ionicons name="add" size={24} color="#ffffff" />
          <Text style={styles.fabText}>New Ministry</Text>
        </TouchableOpacity>
      )}

      {/* Add / Edit Ministry Modal - Only for Admin, Pastor, Manager */}
      {canManage && (
        <Modal visible={isModalOpen} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editingMinistry ? 'Edit Church Ministry' : 'Add New Church Ministry'}
                </Text>
                <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                  <Ionicons name="close" size={22} color={colors.subText} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 420 }}>
                <Text style={[styles.inputLabel, { color: colors.subText }]}>Ministry Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Worship Ministry or Media & Production"
                  placeholderTextColor={colors.subText}
                />

                <Text style={[styles.inputLabel, { color: colors.subText }]}>Department Category</Text>
                <View style={styles.categoryPillWrap}>
                  {[
                    'Worship & Music',
                    'Production & Tech',
                    'Media & Tech',
                    'Hospitality & Welcome',
                    'Prayer & Pastoral Care',
                    'NextGen & Children',
                    'Youth & Young Adults'
                  ].map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.choicePill,
                        {
                          backgroundColor: category === c ? colors.primaryLight : colors.inputBg,
                          borderColor: category === c ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setCategory(c)}
                    >
                      <Text style={[styles.choicePillText, { color: category === c ? colors.primaryDark : colors.text }]}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.inputLabel, { color: colors.subText }]}>Ministry Leader</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={leader}
                  onChangeText={setLeader}
                  placeholder="e.g. Isaac David"
                  placeholderTextColor={colors.subText}
                />

                <Text style={[styles.inputLabel, { color: colors.subText }]}>Leader Phone / WhatsApp</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="+60176001484"
                  placeholderTextColor={colors.subText}
                />

                <Text style={[styles.inputLabel, { color: colors.subText }]}>Rehearsal / Meeting Day & Time</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                    value={meetingDay}
                    onChangeText={setMeetingDay}
                    placeholder="Thursday"
                    placeholderTextColor={colors.subText}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                    value={meetingTime}
                    onChangeText={setMeetingTime}
                    placeholder="8:00 PM"
                    placeholderTextColor={colors.subText}
                  />
                </View>

                <Text style={[styles.inputLabel, { color: colors.subText }]}>Location / Room</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="e.g. Main Sanctuary / Sound Booth"
                  placeholderTextColor={colors.subText}
                />

                <Text style={[styles.inputLabel, { color: colors.subText }]}>Serving Volunteers Count</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={memberCount}
                  onChangeText={setMemberCount}
                  keyboardType="numeric"
                  placeholder="8"
                  placeholderTextColor={colors.subText}
                />

                <Text style={[styles.inputLabel, { color: colors.subText }]}>Ministry Description</Text>
                <TextInput
                  style={[styles.input, { minHeight: 60, textAlignVertical: 'top', backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  placeholder="Describe ministry mission, volunteer duties, and equipment..."
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
                  onPress={handleSaveMinistry}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>{editingMinistry ? 'Save Changes' : 'Create Ministry'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  memberNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  memberNoticeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  categorySection: {
    paddingVertical: 8,
  },
  categoryList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 90,
    gap: 12,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  ministryIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  ministryInfo: {
    flex: 1,
  },
  catBadgeRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  ministryTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  ministryLeader: {
    fontSize: 12,
    marginTop: 2,
  },
  headerActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 8,
  },
  descText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  metaSection: {
    marginTop: 12,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  contactBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  footerLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  memberCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  memberCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 28,
    shadowColor: '#c59c6c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    gap: 6,
  },
  fabText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  categoryPillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  choicePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  choicePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  submitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  openHubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 12,
  },
  openHubBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});
