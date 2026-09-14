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

const SERVICE_TYPES = [
  'Sunday Morning Celebration',
  'Sunday Evening Praise & Word',
  'Midweek Encounter & Prayer',
  'Youth Revolution (Friday)',
  'Night of Worship & Prophetic',
  'Special Holiday Gathering',
];

export default function ServicesScreen({ onSelectService, user, isDark = false }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [campuses, setCampuses] = useState([]);

  // Create Service Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serviceDate, setServiceDate] = useState('');
  const [serviceTime, setServiceTime] = useState('10:00 AM');
  const [serviceType, setServiceType] = useState('Sunday Morning Celebration');
  const [theme, setTheme] = useState('');
  const [notes, setNotes] = useState('Sunday Service at Jesus My Rock');
  const [campusId, setCampusId] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchServices = async () => {
    try {
      const [svcData, campusData] = await Promise.all([
        api.getServices(),
        api.getCampuses().catch(() => []),
      ]);
      setServices(svcData || []);
      setCampuses(campusData || []);
      if (campusData && campusData.length > 0 && !campusId) {
        const main = campusData.find((c) => c.is_main) || campusData[0];
        setCampusId(main.id);
      }
    } catch (err) {
      console.error('Fetch services error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchServices();
  };

  const handleOpenCreateModal = () => {
    // Default next Sunday
    const d = new Date();
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setServiceDate(`${yyyy}-${mm}-${dd}`);
    setServiceTime('10:00 AM');
    setServiceType('Sunday Morning Celebration');
    setTheme('');
    setNotes('Sunday Service at Jesus My Rock');
    setIsModalOpen(true);
  };

  const handleCreateService = async () => {
    if (!serviceDate) {
      Alert.alert('Required', 'Please specify a service date');
      return;
    }

    setCreating(true);
    try {
      const newService = await api.createService({
        service_date: serviceDate,
        service_time: serviceTime,
        service_type: serviceType,
        campus_id: campusId || null,
        theme,
        notes,
        deadline_hours_before: 48,
      });
      setIsModalOpen(false);
      await fetchServices();
      if (newService?.id) {
        onSelectService(newService);
      }
    } catch (err) {
      Alert.alert('Create Error', err.message || 'Failed to create service');
    } finally {
      setCreating(false);
    }
  };

  const bg = isDark ? '#020617' : '#f8fafc';
  const cardBg = isDark ? '#0f172a' : '#ffffff';
  const border = isDark ? '#1e293b' : '#e2e8f0';
  const textPrimary = isDark ? '#ffffff' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? '#1e293b' : '#f1f5f9';

  const renderServiceItem = ({ item }) => {
    const isConfirmed = item.status === 'confirmed';
    const isRostered = item.status === 'rostered';

    // Parse date for calendar badge
    const parts = (item.service_date || '').split('-');
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = parts[1] ? monthNames[parseInt(parts[1], 10) - 1] : 'SUN';
    const day = parts[2] || '01';

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}
        onPress={() => onSelectService(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardMainRow}>
          {/* Calendar date badge */}
          <View style={[styles.calendarBadge, { backgroundColor: isDark ? '#1e293b' : '#fef2f2' }]}>
            <Text style={styles.calMonth}>{month}</Text>
            <Text style={[styles.calDay, { color: textPrimary }]}>{day}</Text>
          </View>

          {/* Info */}
          <View style={styles.cardInfo}>
            <View style={styles.topMeta}>
              <Text style={[styles.typeText, { color: textSecondary }]}>
                {item.service_type || 'Sunday Service'}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  isConfirmed
                    ? styles.badgeConfirmed
                    : isRostered
                    ? styles.badgeRostered
                    : styles.badgeDraft,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    isConfirmed
                      ? styles.textConfirmed
                      : isRostered
                      ? styles.textRostered
                      : styles.textDraft,
                  ]}
                >
                  {item.status ? item.status.toUpperCase() : 'DRAFT'}
                </Text>
              </View>
            </View>

            <Text style={[styles.themeText, { color: textPrimary }]} numberOfLines={1}>
              {item.theme || 'Sunday Morning Celebration'}
            </Text>

            <Text style={[styles.metaDetail, { color: textSecondary }]}>
              🕒 {item.service_time} • 📍 {item.campus_name || 'Main Sanctuary'}
            </Text>

            <Text style={[styles.leaderText, { color: textSecondary }]}>
              🎤 Leader: <Text style={{ color: textPrimary, fontWeight: '700' }}>{item.worship_leader_name || 'TBD'}</Text>
            </Text>
          </View>
        </View>

        {/* Stats footer */}
        <View style={[styles.statsRow, { borderTopColor: border }]}>
          <View style={styles.statCol}>
            <Text style={[styles.statVal, { color: textPrimary }]}>{item.total_assignments_count || 0}</Text>
            <Text style={[styles.statLbl, { color: textSecondary }]}>Roster Slots</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={[styles.statVal, { color: '#16a34a' }]}>{item.available_count || 0}</Text>
            <Text style={[styles.statLbl, { color: textSecondary }]}>Available</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={[styles.statVal, { color: '#dc2626' }]}>{item.declined_count || 0}</Text>
            <Text style={[styles.statLbl, { color: textSecondary }]}>Declined</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={[styles.statVal, { color: textPrimary }]}>{item.plan_items_count || 0}</Text>
            <Text style={[styles.statLbl, { color: textSecondary }]}>Run Sheet</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Header bar */}
      <View style={[styles.headerBar, { backgroundColor: cardBg, borderBottomColor: border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>Services & Plans</Text>
          <Text style={[styles.headerSub, { color: textSecondary }]}>
            Sunday Worship Rosters & Run Sheets
          </Text>
        </View>
        <TouchableOpacity style={styles.createBtn} onPress={handleOpenCreateModal} activeOpacity={0.8}>
          <Text style={styles.createBtnText}>+ Plan Service</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#dc2626" />
        </View>
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => item.id}
          renderItem={renderServiceItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyIcon]}>📅</Text>
              <Text style={[styles.emptyTitle, { color: textPrimary }]}>No service plans yet</Text>
              <Text style={[styles.emptySub, { color: textSecondary }]}>
                Tap "+ Plan Service" above to schedule Sunday worship.
              </Text>
            </View>
          }
        />
      )}

      {/* Create Service Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: border }]}>
              <Text style={[styles.modalTitle, { color: textPrimary }]}>Create New Church Service</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={[styles.formLabel, { color: textPrimary }]}>SERVICE DATE (YYYY-MM-DD) *</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                value={serviceDate}
                onChangeText={setServiceDate}
                placeholder="2026-09-20"
                placeholderTextColor="#94a3b8"
              />

              <Text style={[styles.formLabel, { color: textPrimary }]}>SERVICE TIME</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                value={serviceTime}
                onChangeText={setServiceTime}
                placeholder="10:00 AM"
                placeholderTextColor="#94a3b8"
              />

              <Text style={[styles.formLabel, { color: textPrimary }]}>SERVICE TYPE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeSelector}>
                {SERVICE_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.typeChip,
                      { borderColor: border, backgroundColor: isDark ? '#1e293b' : '#f1f5f9' },
                      serviceType === t && styles.typeChipActive,
                    ]}
                    onPress={() => setServiceType(t)}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        { color: textSecondary },
                        serviceType === t && styles.typeChipTextActive,
                      ]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.formLabel, { color: textPrimary }]}>THEME / SERMON TITLE</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                value={theme}
                onChangeText={setTheme}
                placeholder="e.g. Firm Foundation: Standing Unshaken"
                placeholderTextColor="#94a3b8"
              />

              <Text style={[styles.formLabel, { color: textPrimary }]}>NOTES & DETAILS</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. Communion after worship set"
                placeholderTextColor="#94a3b8"
              />

              <TouchableOpacity
                style={[styles.submitBtn, creating && styles.buttonDisabled]}
                onPress={handleCreateService}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Create Service Plan</Text>
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
  createBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  createBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  list: {
    padding: 16,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  cardMainRow: {
    flexDirection: 'row',
    padding: 14,
  },
  calendarBadge: {
    width: 48,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  calMonth: {
    fontSize: 10,
    fontWeight: '900',
    color: '#dc2626',
    textTransform: 'uppercase',
  },
  calDay: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: -2,
  },
  cardInfo: {
    flex: 1,
  },
  topMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeConfirmed: {
    backgroundColor: '#dcfce7',
  },
  badgeRostered: {
    backgroundColor: '#eff6ff',
  },
  badgeDraft: {
    backgroundColor: '#f1f5f9',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  textConfirmed: {
    color: '#16a34a',
  },
  textRostered: {
    color: '#2563eb',
  },
  textDraft: {
    color: '#64748b',
  },
  themeText: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  metaDetail: {
    fontSize: 12,
    marginBottom: 2,
  },
  leaderText: {
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 14,
    fontWeight: '800',
  },
  statLbl: {
    fontSize: 10,
    marginTop: 1,
    fontWeight: '500',
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
    padding: 18,
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
    padding: 18,
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
  },
  typeSelector: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  typeChipActive: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  typeChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  submitBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
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
