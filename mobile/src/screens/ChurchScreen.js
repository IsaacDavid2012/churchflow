import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
  Switch,
} from 'react-native';
import { api } from '../api/client';

export default function ChurchScreen({ user, onLogout, isDark = false, onToggleTheme }) {
  const [loading, setLoading] = useState(true);
  const [church, setChurch] = useState(null);
  const [campuses, setCampuses] = useState([]);
  const [ministries, setMinistries] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ people: 0, songs: 0, groups: 0, services: 0 });

  // Add User Modal
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState('worship_leader');
  const [savingUser, setSavingUser] = useState(false);

  // Edit Church Modal
  const [isEditChurchModalOpen, setIsEditChurchModalOpen] = useState(false);
  const [churchName, setChurchName] = useState('');
  const [churchPhone, setChurchPhone] = useState('');
  const [churchEmail, setChurchEmail] = useState('');
  const [churchWebsite, setChurchWebsite] = useState('');
  const [churchAddress, setChurchAddress] = useState('');
  const [savingChurch, setSavingChurch] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [churchData, campusData, minData, userData, peopleData, songData, groupData, svcData] =
        await Promise.all([
          api.getChurch().catch(() => ({})),
          api.getCampuses().catch(() => []),
          api.getMinistries().catch(() => []),
          api.getUsers().catch(() => []),
          api.getMusicians().catch(() => []),
          api.getSongs().catch(() => []),
          api.getGroups().catch(() => []),
          api.getServices().catch(() => []),
        ]);

      setChurch(churchData || {});
      setChurchName(churchData?.name || 'Jesus My Rock Church');
      setChurchPhone(churchData?.phone || '+60 17-600 1484');
      setChurchEmail(churchData?.email || 'studioscreativeclicks@gmail.com');
      setChurchWebsite(churchData?.website || 'https://creativeclicks.art');
      setChurchAddress(churchData?.address || '123 Grace Avenue, Sanctuary Hall');

      setCampuses(campusData || []);
      setMinistries(minData || []);
      setUsers(userData || []);
      setStats({
        people: (peopleData || []).length,
        songs: (songData || []).length,
        groups: (groupData || []).length,
        services: (svcData || []).length,
      });
    } catch (err) {
      console.error('ChurchScreen fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateUser = async () => {
    if (!userName.trim() || !userEmail.trim() || !userPassword.trim()) {
      Alert.alert('Missing Fields', 'Please enter Name, Email, and Password.');
      return;
    }
    setSavingUser(true);
    try {
      await api.createUser({
        name: userName.trim(),
        email: userEmail.trim(),
        password: userPassword.trim(),
        role: userRole,
      });
      setIsUserModalOpen(false);
      setUserName('');
      setUserEmail('');
      setUserPassword('');
      Alert.alert('User Created', `Added ${userName} with role ${userRole}`);
      fetchData();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message || 'Could not create user');
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = (u) => {
    if (u.id === user?.id) {
      Alert.alert('Forbidden', 'You cannot delete your own logged-in account.');
      return;
    }
    Alert.alert('Delete User', `Are you sure you want to remove ${u.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteUser(u.id);
            fetchData();
          } catch (err) {
            Alert.alert('Error', err.response?.data?.error || err.message || 'Could not delete user');
          }
        },
      },
    ]);
  };

  const handleSaveChurch = async () => {
    setSavingChurch(true);
    try {
      await api.updateChurch({
        name: churchName.trim(),
        phone: churchPhone.trim(),
        email: churchEmail.trim(),
        website: churchWebsite.trim(),
        address: churchAddress.trim(),
      });
      setIsEditChurchModalOpen(false);
      Alert.alert('Profile Saved', 'Church information updated successfully.');
      fetchData();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message || 'Could not update church');
    } finally {
      setSavingChurch(false);
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

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Church Banner / Header */}
      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.profileHeader}>
          <View style={styles.churchAvatar}>
            <Text style={styles.churchAvatarText}>⛪</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[styles.churchName, { color: colors.text }]}>
              {church?.name || 'Jesus My Rock Church'}
            </Text>
            <Text style={[styles.churchTagline, { color: colors.subText }]}>
              Senior Pastors • Marcus & Sarah Reed
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.editBtn, { borderColor: colors.border }]}
            onPress={() => setIsEditChurchModalOpen(true)}
          >
            <Text style={[styles.editBtnText, { color: colors.text }]}>✎ Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.subText }]}>📍 Address:</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>
            {church?.address || '123 Grace Avenue, Sanctuary Hall'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.subText }]}>📞 Contact:</Text>
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${church?.phone || '+60176001484'}`)}>
            <Text style={[styles.infoValue, { color: colors.primary }]}>
              {church?.phone || '+60 17-600 1484'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.subText }]}>🌐 Website:</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL(church?.website || 'https://creativeclicks.art')}
          >
            <Text style={[styles.infoValue, { color: '#2563eb' }]}>
              {church?.website || 'https://creativeclicks.art'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={[styles.statTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statNum, { color: colors.primary }]}>{stats.services}</Text>
          <Text style={[styles.statLabel, { color: colors.subText }]}>Services</Text>
        </View>
        <View style={[styles.statTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statNum, { color: '#0284c7' }]}>{stats.people}</Text>
          <Text style={[styles.statLabel, { color: colors.subText }]}>Volunteers</Text>
        </View>
        <View style={[styles.statTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statNum, { color: '#16a34a' }]}>{stats.songs}</Text>
          <Text style={[styles.statLabel, { color: colors.subText }]}>Songs</Text>
        </View>
        <View style={[styles.statTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statNum, { color: '#9333ea' }]}>{stats.groups}</Text>
          <Text style={[styles.statLabel, { color: colors.subText }]}>Life Groups</Text>
        </View>
      </View>

      {/* Settings / Theme & Preferences */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>⚙️ App Preferences</Text>

        <View style={styles.prefRow}>
          <View>
            <Text style={[styles.prefLabel, { color: colors.text }]}>Dark Mode</Text>
            <Text style={[styles.prefSub, { color: colors.subText }]}>
              {isDark ? 'Dark theme active' : 'Crisp light mode active'}
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={onToggleTheme}
            trackColor={{ false: '#cbd5e1', true: '#dc2626' }}
            thumbColor={isDark ? '#ffffff' : '#ffffff'}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.prefRow}>
          <View>
            <Text style={[styles.prefLabel, { color: colors.text }]}>Logged in as</Text>
            <Text style={[styles.prefSub, { color: colors.primary, fontWeight: '700' }]}>
              {user?.name} ({user?.role || 'Admin'})
            </Text>
            <Text style={[styles.prefSub, { color: colors.subText }]}>{user?.email}</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Campuses & Ministry Teams */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>📍 Campuses ({campuses.length})</Text>
        {campuses.map((c) => (
          <View key={c.id} style={[styles.itemRow, { borderColor: colors.border }]}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.itemName, { color: colors.text }]}>{c.name}</Text>
                {c.is_main ? <Text style={styles.mainBadge}>Main Campus</Text> : null}
              </View>
              <Text style={[styles.itemSub, { color: colors.subText }]}>
                {c.address || 'Sanctuary Campus'} • Cap: {c.capacity || 500}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>👥 Ministry Teams ({ministries.length})</Text>
        <View style={styles.chipsWrap}>
          {ministries.map((m) => (
            <View key={m.id} style={[styles.ministryChip, { backgroundColor: colors.badgeBg, borderColor: colors.border }]}>
              <Text style={[styles.ministryChipText, { color: colors.text }]}>
                {m.icon || '✨'} {m.name}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* User Management Section */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            🛡️ Staff & Admin Accounts ({users.length})
          </Text>
          <TouchableOpacity
            style={styles.addMiniBtn}
            onPress={() => setIsUserModalOpen(true)}
          >
            <Text style={styles.addMiniBtnText}>+ Add Staff</Text>
          </TouchableOpacity>
        </View>

        {users.map((u) => (
          <View key={u.id} style={[styles.userRow, { borderColor: colors.border }]}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {(u.name || 'U').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.userNameText, { color: colors.text }]}>{u.name}</Text>
                <Text style={[styles.roleBadge, { backgroundColor: colors.primaryLight, color: colors.primary }]}>
                  {u.role}
                </Text>
              </View>
              <Text style={[styles.userEmailText, { color: colors.subText }]}>{u.email}</Text>
            </View>
            {u.id !== user?.id && (
              <TouchableOpacity
                style={styles.deleteUserBtn}
                onPress={() => handleDeleteUser(u)}
              >
                <Text style={styles.deleteUserText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {/* Brand Footer */}
      <View style={styles.footerWrap}>
        <Text style={[styles.footerBrand, { color: colors.text }]}>ChurchFlow</Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://creativeclicks.art')}>
          <Text style={styles.footerCredit}>
            Built by <Text style={{ textDecorationLine: 'underline', color: colors.primary }}>Creative Clicks Studios</Text>
          </Text>
        </TouchableOpacity>
        <Text style={[styles.footerVersion, { color: colors.subText }]}>Version 1.0.0 (Android Native)</Text>
      </View>

      {/* Add User Modal */}
      <Modal visible={isUserModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Church Staff / Admin</Text>

            <Text style={[styles.label, { color: colors.subText }]}>Full Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={userName}
              onChangeText={setUserName}
              placeholder="e.g. Pastor Marcus"
              placeholderTextColor={colors.subText}
            />

            <Text style={[styles.label, { color: colors.subText }]}>Email Address *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={userEmail}
              onChangeText={setUserEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="pastor@church.org"
              placeholderTextColor={colors.subText}
            />

            <Text style={[styles.label, { color: colors.subText }]}>Temporary Password *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={userPassword}
              onChangeText={setUserPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.subText}
            />

            <Text style={[styles.label, { color: colors.subText }]}>Role</Text>
            <View style={styles.rolePickerWrap}>
              {['admin', 'worship_leader', 'scheduler', 'viewer'].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.roleChoice,
                    { borderColor: colors.border, backgroundColor: userRole === r ? colors.primary : colors.inputBg },
                  ]}
                  onPress={() => setUserRole(r)}
                >
                  <Text style={[styles.roleChoiceText, { color: userRole === r ? '#ffffff' : colors.text }]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setIsUserModalOpen(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                onPress={handleCreateUser}
                disabled={savingUser}
              >
                {savingUser ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Create Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Church Profile Modal */}
      <Modal visible={isEditChurchModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Church Profile</Text>

            <Text style={[styles.label, { color: colors.subText }]}>Church Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={churchName}
              onChangeText={setChurchName}
            />

            <Text style={[styles.label, { color: colors.subText }]}>Phone Contact</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={churchPhone}
              onChangeText={setChurchPhone}
            />

            <Text style={[styles.label, { color: colors.subText }]}>Email Contact</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={churchEmail}
              onChangeText={setChurchEmail}
            />

            <Text style={[styles.label, { color: colors.subText }]}>Website URL</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={churchWebsite}
              onChangeText={setChurchWebsite}
            />

            <Text style={[styles.label, { color: colors.subText }]}>Address / Location</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={churchAddress}
              onChangeText={setChurchAddress}
            />

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setIsEditChurchModalOpen(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveChurch}
                disabled={savingChurch}
              >
                {savingChurch ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  churchAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  churchAvatarText: {
    fontSize: 26,
  },
  churchName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  churchTagline: {
    fontSize: 13,
    marginTop: 2,
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 13,
    width: 84,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  statTile: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNum: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addMiniBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addMiniBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  prefLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  prefSub: {
    fontSize: 12,
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutBtnText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '700',
  },
  itemRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
  },
  mainBadge: {
    marginLeft: 8,
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemSub: {
    fontSize: 12,
    marginTop: 2,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ministryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  ministryChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  userNameText: {
    fontSize: 14,
    fontWeight: '700',
  },
  roleBadge: {
    marginLeft: 8,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  userEmailText: {
    fontSize: 12,
    marginTop: 1,
  },
  deleteUserBtn: {
    padding: 6,
  },
  deleteUserText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerWrap: {
    alignItems: 'center',
    marginVertical: 24,
  },
  footerBrand: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  footerCredit: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  footerVersion: {
    fontSize: 11,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  rolePickerWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  roleChoice: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleChoiceText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
