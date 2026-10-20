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
  ScrollView,
  Modal,
  Alert,
  Linking,
  Platform,
  Share,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';

const MINISTRIES = ['All', 'Media Team', 'Production', 'Worship'];

export default function PeopleScreen({ user, isDark = false }) {
  const userRole = (user?.role || '').toLowerCase();
  const isAdmin = userRole === 'admin';
  const isMember = userRole === 'member';
  const [people, setPeople] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedMinistry, setSelectedMinistry] = useState('All');

  // Add / Edit Member Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('member');
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [ministry, setMinistry] = useState('Media Team');
  const [customPosition, setCustomPosition] = useState('');
  const [addingCustomPosition, setAddingCustomPosition] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPeople = async () => {
    try {
      const [data, posData] = await Promise.all([
        api.getMusicians({ active: 'true' }),
        api.getPositions().catch(() => []),
      ]);
      setPeople(Array.isArray(data) ? data : []);
      setPositions(Array.isArray(posData) ? posData : []);
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

  // Handle Android Hardware / Swipe Back Button
  useEffect(() => {
    const handleBack = () => {
      if (isModalOpen) {
        setIsModalOpen(false);
        return true;
      }
      if (selectedMinistry !== 'All') {
        setSelectedMinistry('All');
        return true;
      }
      return false; // Propagate to App.js tab navigation
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => backSub.remove();
  }, [isModalOpen, selectedMinistry]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPeople();
  };

  const handleOpenAddModal = async () => {
    setEditingPerson(null);
    setName('');
    setEmail('');
    setPhone('');
    setRole('member');
    setSelectedRoles([]);
    setMinistry('Media Team');
    setCustomPosition('');
    try {
      const posList = await api.getPositions();
      if (Array.isArray(posList)) setPositions(posList);
    } catch (e) {}
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (person) => {
    setEditingPerson(person);
    setName(person.name || '');
    setEmail(person.email || '');
    setPhone(person.phone || '');
    setRole(person.role || 'member');
    setSelectedRoles(Array.isArray(person.roles) ? [...person.roles] : (person.primary_instrument ? [person.primary_instrument] : []));
    setMinistry(person.ministry || 'Media Team');
    setCustomPosition('');
    try {
      const posList = await api.getPositions();
      if (Array.isArray(posList)) setPositions(posList);
    } catch (e) {}
    setIsModalOpen(true);
  };

  const toggleRole = (roleName) => {
    setSelectedRoles((prev) => {
      const exists = prev.some((r) => r.toLowerCase() === roleName.toLowerCase());
      return exists
        ? prev.filter((r) => r.toLowerCase() !== roleName.toLowerCase())
        : [...prev, roleName];
    });
  };

  const handleAddNewPosition = async () => {
    const trimmed = customPosition.trim();
    if (!trimmed) return;

    setAddingCustomPosition(true);
    try {
      const created = await api.createPosition({
        name: trimmed,
        ministry: ministry || 'Media Team',
        color: '#c59c6c',
      });
      const newPos = created || { name: trimmed, ministry: ministry || 'Media Team' };
      setPositions((prev) => {
        if (prev.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) return prev;
        return [...prev, newPos];
      });
      setSelectedRoles((prev) => {
        if (!prev.some((r) => r.toLowerCase() === trimmed.toLowerCase())) {
          return [...prev, trimmed];
        }
        return prev;
      });
      setCustomPosition('');
    } catch (err) {
      console.error('Failed to create position:', err);
      setPositions((prev) => {
        if (prev.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) return prev;
        return [...prev, { name: trimmed, ministry: ministry || 'Media Team' }];
      });
      setSelectedRoles((prev) => {
        if (!prev.some((r) => r.toLowerCase() === trimmed.toLowerCase())) {
          return [...prev, trimmed];
        }
        return prev;
      });
      setCustomPosition('');
    } finally {
      setAddingCustomPosition(false);
    }
  };

  const handleSavePerson = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter the member full name.');
      return;
    }

    setSaving(true);
    try {
      // Derive ministry from selected positions
      const selPositions = positions.filter((p) =>
        selectedRoles.some((r) => r.toLowerCase() === p.name.toLowerCase())
      );
      const minNames = Array.from(new Set(selPositions.map((p) => p.ministry).filter(Boolean)));
      const derivedMinistry = minNames.length > 0 ? minNames.join(', ') : 'None';

      const payload = {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        role: role || 'member',
        roles: selectedRoles,
        ministry: derivedMinistry,
      };

      if (editingPerson) {
        await api.updateMusician(editingPerson.id, payload);
        Alert.alert('Member Updated', `${name}'s positions and auto-enrolled ministries have been updated.`);
      } else {
        await api.createMusician(payload);
        Alert.alert('Member Added', `${name} has been added and enrolled into their ministries.`);
      }

      setIsModalOpen(false);
      fetchPeople();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message || 'Could not save member');
    } finally {
      setSaving(false);
    }
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
    badgeBg: isDark ? '#1e293b' : '#fbf8f3',
  };

  const filteredPeople = people.filter((p) => {
    const rolesStr = Array.isArray(p.roles) ? p.roles.join(' ') : (p.primary_instrument || '');
    const matchesSearch =
      (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.email || '').toLowerCase().includes(search.toLowerCase()) ||
      rolesStr.toLowerCase().includes(search.toLowerCase());

    const matchesMin =
      selectedMinistry === 'All' ||
      (p.ministry || 'Media Team').toLowerCase().includes(selectedMinistry.toLowerCase());

    return matchesSearch && matchesMin;
  });

  const handleShareInviteLink = async () => {
    const inviteUrl = 'https://serve.creativeclicks.art/join';
    const message = `👋 Welcome to Jesus My Rock Volunteer Team!\nPlease tap this link to enter your details and choose the positions you'd like to serve in:\n${inviteUrl}`;
    try {
      await Share.share({
        title: 'Jesus My Rock Volunteer Onboarding',
        message: Platform.OS === 'android' ? message : inviteUrl,
        url: inviteUrl,
      });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const handleWhatsAppInvite = async () => {
    const inviteUrl = 'https://serve.creativeclicks.art/join';
    const text = `👋 Hi! Welcome to Jesus My Rock / ChurchFlow.\nPlease tap the link to fill in your name, contact, and choose what positions you'd like to serve in:\n${inviteUrl}`;
    const waUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;
    const waWebUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    try {
      const canOpen = await Linking.canOpenURL(waUrl);
      if (canOpen) {
        await Linking.openURL(waUrl);
      } else {
        await Linking.openURL(waWebUrl);
      }
    } catch (err) {
      await Linking.openURL(waWebUrl);
    }
  };

  const renderPersonCard = ({ item }) => {
    const memberRoles = Array.isArray(item.roles) && item.roles.length > 0
      ? item.roles
      : (item.primary_instrument ? [item.primary_instrument] : []);

    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>
              {(item.name || 'U').slice(0, 2).toUpperCase()}
            </Text>
          </View>

          <View style={styles.personDetails}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                <Text style={[styles.personName, { color: colors.text }]}>{item.name}</Text>
                {(() => {
                  const r = (item.role || 'member').toLowerCase();
                  const rBg = r === 'admin' ? '#ffe4e6' : r === 'pastor' ? '#f3e8ff' : r === 'manager' ? '#fef3c7' : colors.badgeBg;
                  const rText = r === 'admin' ? '#e11d48' : r === 'pastor' ? '#7e22ce' : r === 'manager' ? '#b45309' : colors.subText;
                  return (
                    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: rBg, borderWidth: 1, borderColor: rText + '40' }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: rText }}>{r.toUpperCase()}</Text>
                    </View>
                  );
                })()}
              </View>
              {!isMember && (
                <TouchableOpacity
                  onPress={() => handleOpenEditModal(item)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.badgeBg }}
                >
                  <Ionicons name="create-outline" size={14} color={colors.primary} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>Edit Roles</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={[styles.roleTagsRow, { flexWrap: 'wrap' }]}>
              {memberRoles.length > 0 ? (
                memberRoles.map((r, idx) => (
                  <View key={idx} style={[styles.roleChip, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.roleChipText, { color: colors.primary }]}>{r}</Text>
                  </View>
                ))
              ) : (
                <View style={[styles.roleChip, { backgroundColor: colors.badgeBg }]}>
                  <Text style={[styles.roleChipText, { color: colors.subText }]}>No roles ticked</Text>
                </View>
              )}
            </View>
            <Text style={[styles.lastServedText, { color: colors.subText }]}>
              Last served: {item.last_served_date ? String(item.last_served_date).split('T')[0] : 'Never'}
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

  const allRoleOptions = (() => {
    const posNames = positions.map((p) => p.name);
    const extras = selectedRoles.filter(
      (r) => !posNames.some((n) => n.toLowerCase() === r.toLowerCase())
    );
    return [...posNames, ...extras];
  })();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Admin Only: Volunteer Self-Onboarding Link Banner */}
      {isAdmin && (
        <View style={[styles.inviteCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
          <View style={styles.inviteHeaderRow}>
            <View style={[styles.inviteIconCircle, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="link" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.inviteTitle, { color: colors.text }]}>Volunteer Invite Link</Text>
                <View style={[styles.adminPill, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.adminPillText, { color: colors.primary }]}>ADMIN ONLY</Text>
                </View>
              </View>
              <Text style={[styles.inviteSubtitle, { color: colors.subText }]}>
                Prospective members can submit name, contact & toggle their serving positions.
              </Text>
            </View>
          </View>

          <View style={[styles.inviteUrlBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Text style={[styles.inviteUrlText, { color: colors.primary }]} numberOfLines={1}>
              https://serve.creativeclicks.art/join
            </Text>
          </View>

          <View style={styles.inviteActionRow}>
            <TouchableOpacity
              style={[styles.inviteBtn, { backgroundColor: colors.primary }]}
              onPress={handleShareInviteLink}
            >
              <Ionicons name="share-social-outline" size={15} color="#ffffff" />
              <Text style={styles.inviteBtnText}>Share / Copy Link</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.inviteBtn, { backgroundColor: '#16a34a' }]}
              onPress={handleWhatsAppInvite}
            >
              <Ionicons name="logo-whatsapp" size={15} color="#ffffff" />
              <Text style={styles.inviteBtnText}>WhatsApp Invite</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.subText} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search members by name, role..."
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={colors.subText} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Members Found</Text>
              <Text style={[styles.emptySubtitle, { color: colors.subText }]}>
                {search ? 'Try a different search term.' : 'Add members to your directory.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button - Hidden for Member role */}
      {!isMember && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
          onPress={handleOpenAddModal}
        >
          <Ionicons name="person-add" size={20} color="#ffffff" />
          <Text style={styles.fabText}>Add Member</Text>
        </TouchableOpacity>
      )}

      {/* Add / Edit Member Bottom Sheet Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingPerson ? 'Edit Member & Roles' : 'Add Team Member'}
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={22} color={colors.subText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={[styles.inputLabel, { color: colors.subText }]}>Full Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Isaac"
                placeholderTextColor={colors.subText}
              />

              <Text style={[styles.inputLabel, { color: colors.subText }]}>Email Address</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="isaac@jesusmyrock.org"
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

              {/* System Access Role (Admin Editable, Read-only for Others) */}
              <Text style={[styles.inputLabel, { color: colors.subText }]}>
                System Access Role {isAdmin ? '(Admin Editable)' : '(View Only)'}
              </Text>
              {isAdmin ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {['member', 'manager', 'pastor', 'admin'].map((roleOption) => {
                    const isSelected = (role || 'member').toLowerCase() === roleOption;
                    return (
                      <TouchableOpacity
                        key={roleOption}
                        onPress={() => setRole(roleOption)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.primary : colors.border,
                          backgroundColor: isSelected ? colors.primaryLight : colors.inputBg,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            color: isSelected ? colors.primary : colors.text,
                          }}
                        >
                          {roleOption}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={{ padding: 10, borderRadius: 10, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', textTransform: 'uppercase', color: colors.primary }}>
                    {(role || 'member').toUpperCase()}
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.subText }}>Only Admins can change user roles</Text>
                </View>
              )}

              <View style={{ marginTop: 14, padding: 10, borderRadius: 12, backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  ⚡ Auto-Enrolled Ministries
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text, marginTop: 2 }}>
                  {(() => {
                    const selPositions = positions.filter((p) =>
                      selectedRoles.some((r) => r.toLowerCase() === p.name.toLowerCase())
                    );
                    const minNames = Array.from(new Set(selPositions.map((p) => p.ministry).filter(Boolean)));
                    return minNames.length > 0 ? minNames.join(', ') : 'None (Select positions below to auto-enroll)';
                  })()}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 }}>
                <Text style={[styles.inputLabel, { color: colors.subText, marginTop: 0, marginBottom: 0 }]}>
                  Positions & Roles ({selectedRoles.length} selected)
                </Text>
                {allRoleOptions.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      const allTicked = allRoleOptions.every((opt) =>
                        selectedRoles.some((r) => r.toLowerCase() === opt.toLowerCase())
                      );
                      setSelectedRoles(allTicked ? [] : [...allRoleOptions]);
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                      {allRoleOptions.every((opt) =>
                        selectedRoles.some((r) => r.toLowerCase() === opt.toLowerCase())
                      )
                        ? 'Clear All'
                        : 'Select All'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Inline Custom Position Adder */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <TextInput
                  style={[
                    styles.input,
                    {
                      flex: 1,
                      marginBottom: 0,
                      backgroundColor: colors.inputBg,
                      color: colors.text,
                      borderColor: colors.border,
                      height: 38,
                      paddingVertical: 4,
                      fontSize: 12,
                    },
                  ]}
                  value={customPosition}
                  onChangeText={setCustomPosition}
                  placeholder="Add custom position (e.g. Lead Guitar)..."
                  placeholderTextColor={colors.subText}
                  onSubmitEditing={handleAddNewPosition}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  onPress={handleAddNewPosition}
                  disabled={!customPosition.trim() || addingCustomPosition}
                  style={{
                    backgroundColor: colors.primary,
                    paddingHorizontal: 12,
                    height: 38,
                    borderRadius: 10,
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexDirection: 'row',
                    gap: 4,
                    opacity: !customPosition.trim() || addingCustomPosition ? 0.6 : 1,
                  }}
                >
                  <Ionicons name="add" size={16} color="#ffffff" />
                  <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700' }}>
                    {addingCustomPosition ? 'Adding...' : 'Add'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {allRoleOptions.map((roleName) => {
                  const isTicked = selectedRoles.some(
                    (r) => r.toLowerCase() === roleName.toLowerCase()
                  );
                  return (
                    <TouchableOpacity
                      key={roleName}
                      onPress={() => toggleRole(roleName)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: isTicked ? colors.primary : colors.border,
                        backgroundColor: isTicked ? colors.primaryLight : colors.inputBg,
                      }}
                    >
                      <Ionicons
                        name={isTicked ? 'checkbox' : 'square-outline'}
                        size={16}
                        color={isTicked ? colors.primary : colors.subText}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: isTicked ? colors.primary : colors.text,
                        }}
                      >
                        {roleName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
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
                onPress={handleSavePerson}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {editingPerson ? 'Update Member' : 'Save Member'}
                  </Text>
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
    backgroundColor: '#f5ede1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: '900',
    color: '#9e7343',
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
        shadowColor: '#c59c6c',
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
  inviteCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#c59c6c',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  inviteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  inviteIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  inviteTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  adminPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  inviteSubtitle: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  inviteUrlBox: {
    marginVertical: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  inviteUrlText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inviteActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inviteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  inviteBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
