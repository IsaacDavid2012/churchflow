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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';

const SERVICE_TYPES = [
  'Sunday Morning Celebration',
  'Sunday Evening Praise & Word',
  'Midweek Encounter & Prayer',
  'Youth Revolution (Friday)',
  'Night of Worship & Prophetic',
  'Special Gathering',
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
      setServices(Array.isArray(svcData) ? svcData : []);
      setCampuses(Array.isArray(campusData) ? campusData : []);
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
    const nextSun = new Date();
    const dayOfWeek = nextSun.getDay();
    const daysUntilNextSunday = (7 - dayOfWeek) % 7 || 7;
    nextSun.setDate(nextSun.getDate() + daysUntilNextSunday);
    const dateStr = nextSun.toISOString().split('T')[0];

    setServiceDate(dateStr);
    setServiceTime('10:00 AM');
    setServiceType('Sunday Morning Celebration');
    setTheme('');
    setNotes('Sunday Service at Jesus My Rock');
    setIsModalOpen(true);
  };

  const handleCreateService = async () => {
    if (!serviceDate.trim()) {
      Alert.alert('Missing Date', 'Please specify a service date (YYYY-MM-DD)');
      return;
    }

    setCreating(true);
    try {
      await api.createService({
        service_date: serviceDate.trim(),
        service_time: serviceTime.trim(),
        service_type: serviceType,
        theme: theme.trim() || undefined,
        notes: notes.trim() || undefined,
        campus_id: campusId || undefined,
      });

      setIsModalOpen(false);
      fetchServices();
      Alert.alert('Service Scheduled', 'New service added to the calendar.');
    } catch (err) {
      console.error('Create service failed:', err);
      Alert.alert('Error', err.message || 'Failed to create service');
    } finally {
      setCreating(false);
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
    cardBorder: isDark ? '#1e293b' : '#e2e8f0',
  };

  const parseDateBox = (dateStr) => {
    try {
      if (!dateStr) return { day: '15', month: 'SEP', weekday: 'SUN' };
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        const day = d.getDate();
        const weekday = d.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();
        return { day, month, weekday };
      }
      return { day: '15', month: 'SEP', weekday: 'SUN' };
    } catch {
      return { day: '15', month: 'SEP', weekday: 'SUN' };
    }
  };

  const renderServiceCard = ({ item }) => {
    const { day, month, weekday } = parseDateBox(item.service_date);
    const confirmedCount = parseInt(item.confirmed_assignments_count, 10) || 0;
    const totalCount = parseInt(item.total_assignments_count, 10) || 9;
    const isFullyFilled = confirmedCount >= totalCount;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
        activeOpacity={0.75}
        onPress={() => onSelectService(item)}
      >
        <View style={styles.cardHeader}>
          {/* Calendar Badge */}
          <View style={[styles.calendarBox, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.calWeekday, { color: colors.primary }]}>{weekday}</Text>
            <Text style={[styles.calDay, { color: colors.primary }]}>{day}</Text>
            <Text style={[styles.calMonth, { color: colors.primary }]}>{month}</Text>
          </View>

          {/* Main Info */}
          <View style={styles.cardMainInfo}>
            <View style={styles.typeBadgeRow}>
              <Text style={[styles.campusBadge, { backgroundColor: colors.badgeBg, color: colors.subText }]}>
                {item.campus_name || 'Main Sanctuary'}
              </Text>
              <Text style={[styles.timeBadge, { color: colors.subText }]}>
                🕒 {item.service_time || '10:00 AM'}
              </Text>
            </View>

            <Text style={[styles.serviceTitle, { color: colors.text }]} numberOfLines={1}>
              {item.service_type || 'Sunday Service'}
            </Text>

            {item.theme ? (
              <Text style={[styles.serviceTheme, { color: colors.primary }]} numberOfLines={1}>
                "{item.theme}"
              </Text>
            ) : null}

            {/* Lineup Capacity Bar */}
            <View style={styles.capacityRow}>
              <View style={[styles.slotPill, isFullyFilled ? styles.slotPillFilled : styles.slotPillPartial]}>
                <Ionicons
                  name={isFullyFilled ? 'checkmark-circle' : 'time'}
                  size={12}
                  color={isFullyFilled ? '#15803d' : '#b45309'}
                />
                <Text
                  style={[
                    styles.slotPillText,
                    { color: isFullyFilled ? '#15803d' : '#b45309' },
                  ]}
                >
                  {confirmedCount}/{totalCount} Roster
                </Text>
              </View>

              <View style={styles.chevronWrap}>
                <Text style={[styles.openDetailText, { color: colors.subText }]}>Manage</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.subText} />
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.subText }]}>Loading services...</Text>
        </View>
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderServiceCard}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={colors.subText} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Services Scheduled</Text>
              <Text style={[styles.emptySubtitle, { color: colors.subText }]}>
                Tap the + button below to plan your next worship service.
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button (FAB) */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        activeOpacity={0.85}
        onPress={handleOpenCreateModal}
      >
        <Ionicons name="add" size={26} color="#ffffff" />
        <Text style={styles.fabText}>Plan Service</Text>
      </TouchableOpacity>

      {/* Plan Service Modal Bottom Sheet */}
      <Modal visible={isModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="calendar" size={20} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.text }]}>Plan New Service</Text>
              </View>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={22} color={colors.subText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={[styles.inputLabel, { color: colors.subText }]}>Service Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={serviceDate}
                onChangeText={setServiceDate}
                placeholder="2026-09-20"
                placeholderTextColor={colors.subText}
              />

              <Text style={[styles.inputLabel, { color: colors.subText }]}>Service Time *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={serviceTime}
                onChangeText={setServiceTime}
                placeholder="10:00 AM"
                placeholderTextColor={colors.subText}
              />

              <Text style={[styles.inputLabel, { color: colors.subText }]}>Service Type *</Text>
              <View style={styles.typesPillsWrap}>
                {SERVICE_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.typeChoice,
                      {
                        borderColor: serviceType === t ? colors.primary : colors.border,
                        backgroundColor: serviceType === t ? colors.primaryLight : colors.inputBg,
                      },
                    ]}
                    onPress={() => setServiceType(t)}
                  >
                    <Text
                      style={[
                        styles.typeChoiceText,
                        { color: serviceType === t ? colors.primary : colors.text },
                      ]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: colors.subText }]}>Sermon / Service Theme</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={theme}
                onChangeText={setTheme}
                placeholder="e.g. Unshakable Faith"
                placeholderTextColor={colors.subText}
              />

              {campuses.length > 0 ? (
                <>
                  <Text style={[styles.inputLabel, { color: colors.subText }]}>Campus</Text>
                  <View style={styles.typesPillsWrap}>
                    {campuses.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.typeChoice,
                          {
                            borderColor: campusId === c.id ? colors.primary : colors.border,
                            backgroundColor: campusId === c.id ? colors.primaryLight : colors.inputBg,
                          },
                        ]}
                        onPress={() => setCampusId(c.id)}
                      >
                        <Text
                          style={[
                            styles.typeChoiceText,
                            { color: campusId === c.id ? colors.primary : colors.text },
                          ]}
                        >
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : null}

              <Text style={[styles.inputLabel, { color: colors.subText }]}>Notes & Instructions</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
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
                onPress={handleCreateService}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Create Service</Text>
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
  listContent: {
    padding: 16,
    paddingBottom: 90,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '500',
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarBox: {
    width: 60,
    height: 66,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  calWeekday: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  calDay: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
  },
  calMonth: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardMainInfo: {
    flex: 1,
    marginLeft: 14,
  },
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  campusBadge: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timeBadge: {
    fontSize: 11,
    fontWeight: '600',
  },
  serviceTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  serviceTheme: {
    fontSize: 12,
    fontWeight: '600',
    fontStyle: 'italic',
    marginTop: 2,
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  slotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  slotPillFilled: {
    backgroundColor: '#dcfce7',
  },
  slotPillPartial: {
    backgroundColor: '#fef3c7',
  },
  slotPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chevronWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  openDetailText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 260,
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
    marginBottom: 16,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textArea: {
    height: 72,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
  typesPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  typeChoice: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeChoiceText: {
    fontSize: 12,
    fontWeight: '600',
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
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
