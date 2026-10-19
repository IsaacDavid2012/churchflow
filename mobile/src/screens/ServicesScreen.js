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
  const [positions, setPositions] = useState([]);
  const [selectedPositionIds, setSelectedPositionIds] = useState([]);

  // Create & Edit Service Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [serviceDate, setServiceDate] = useState('');
  const [serviceTime, setServiceTime] = useState('10:00 AM');
  const [serviceType, setServiceType] = useState('Sunday Morning Celebration');
  const [theme, setTheme] = useState('');
  const [notes, setNotes] = useState('Sunday Service at Jesus My Rock');
  const [campusId, setCampusId] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchServices = async () => {
    try {
      const [svcData, campusData, posData] = await Promise.all([
        api.getServices(),
        api.getCampuses().catch(() => []),
        api.getPositions().catch(() => []),
      ]);
      setServices(Array.isArray(svcData) ? svcData : []);
      setCampuses(Array.isArray(campusData) ? campusData : []);
      const posList = Array.isArray(posData) ? posData : [];
      setPositions(posList);
      if (selectedPositionIds.length === 0 && posList.length > 0) {
        setSelectedPositionIds(posList.map((p) => p.id));
      }
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

  const togglePositionId = (posId) => {
    setSelectedPositionIds((prev) =>
      prev.includes(posId) ? prev.filter((id) => id !== posId) : [...prev, posId]
    );
  };

  const handleToggleAllPositions = () => {
    if (selectedPositionIds.length === positions.length) {
      setSelectedPositionIds([]);
    } else {
      setSelectedPositionIds(positions.map((p) => p.id));
    }
  };

  const handleOpenCreateModal = async () => {
    setEditingService(null);
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
    try {
      const posList = await api.getPositions();
      if (Array.isArray(posList) && posList.length > 0) {
        setPositions(posList);
        setSelectedPositionIds(posList.map((p) => p.id));
      }
    } catch (e) {
      if (positions.length > 0) {
        setSelectedPositionIds(positions.map((p) => p.id));
      }
    }
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (service) => {
    setEditingService(service);
    setServiceDate(service.service_date ? service.service_date.split('T')[0] : '');
    setServiceTime(service.service_time || '10:00 AM');
    setServiceType(service.service_type || 'Sunday Morning Celebration');
    setTheme(service.theme || '');
    setNotes(service.notes || '');
    setCampusId(service.campus_id || (campuses[0]?.id || ''));
    if (Array.isArray(service.position_ids) && service.position_ids.length > 0) {
      setSelectedPositionIds(service.position_ids);
    } else if (positions.length > 0) {
      setSelectedPositionIds(positions.map((p) => p.id));
    }
    setIsModalOpen(true);
  };

  const handleDeleteService = (service) => {
    Alert.alert(
      'Delete Service',
      `Are you sure you want to permanently delete the "${service.service_type || 'Sunday Service'}" on ${service.service_date}? This will delete all roster assignments and plan items for this service.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await api.deleteService(service.id);
              await fetchServices();
              Alert.alert('Service Deleted', 'The service has been permanently deleted.');
            } catch (err) {
              console.error('Delete service error:', err);
              Alert.alert('Delete Failed', err.message || 'Failed to delete service');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSaveService = async () => {
    if (!serviceDate.trim()) {
      Alert.alert('Missing Date', 'Please specify a service date (YYYY-MM-DD)');
      return;
    }
    if (positions.length > 0 && selectedPositionIds.length === 0) {
      Alert.alert('No Positions Selected', 'Please toggle ON at least one position for this service.');
      return;
    }

    setSaving(true);
    try {
      if (editingService) {
        await api.updateService(editingService.id, {
          service_date: serviceDate.trim(),
          service_time: serviceTime.trim(),
          service_type: serviceType,
          theme: theme.trim() || undefined,
          notes: notes.trim() || undefined,
          campus_id: campusId || undefined,
          position_ids: selectedPositionIds,
        });
        setIsModalOpen(false);
        setEditingService(null);
        await fetchServices();
        Alert.alert('Service Updated', 'Service details have been saved successfully.');
      } else {
        await api.createService({
          service_date: serviceDate.trim(),
          service_time: serviceTime.trim(),
          service_type: serviceType,
          theme: theme.trim() || undefined,
          notes: notes.trim() || undefined,
          campus_id: campusId || undefined,
          position_ids: selectedPositionIds,
        });
        setIsModalOpen(false);
        await fetchServices();
        Alert.alert('Service Scheduled', `New service created with ${selectedPositionIds.length} position(s).`);
      }
    } catch (err) {
      console.error('Save service failed:', err);
      Alert.alert('Error', err.message || 'Failed to save service');
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
    cardBorder: isDark ? '#1e293b' : '#eadbc4',
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
    const totalCount =
      parseInt(item.required_positions_count, 10) ||
      (Array.isArray(item.position_ids) && item.position_ids.length > 0
        ? item.position_ids.length
        : parseInt(item.total_assignments_count, 10) || 9);
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

              <View style={styles.cardActionsGroup}>
                <TouchableOpacity
                  style={[styles.quickActionBtn, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
                  onPress={() => handleOpenEditModal(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="create-outline" size={15} color={colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickActionBtn, styles.deleteActionBtn]}
                  onPress={() => handleDeleteService(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={15} color="#ef4444" />
                </TouchableOpacity>

                <View style={styles.chevronWrap}>
                  <Text style={[styles.openDetailText, { color: colors.subText }]}>Manage</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.subText} />
                </View>
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

      {/* Plan / Edit Service Modal Bottom Sheet */}
      <Modal visible={isModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name={editingService ? 'create' : 'calendar'} size={20} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editingService ? 'Edit Service Details' : 'Plan New Service'}
                </Text>
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

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 6 }}>
                <Text style={[styles.inputLabel, { color: colors.subText, marginTop: 0, marginBottom: 0 }]}>
                  Positions to Set ({selectedPositionIds.length}/{positions.length}) *
                </Text>
                {positions.length > 0 && (
                  <TouchableOpacity onPress={handleToggleAllPositions}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                      {selectedPositionIds.length === positions.length ? 'Deselect All' : 'Select All'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.typesPillsWrap}>
                {positions.map((pos) => {
                  const isChecked = selectedPositionIds.includes(pos.id);
                  return (
                    <TouchableOpacity
                      key={pos.id}
                      style={[
                        styles.typeChoice,
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          borderColor: isChecked ? colors.primary : colors.border,
                          backgroundColor: isChecked ? colors.primaryLight : colors.inputBg,
                        },
                      ]}
                      onPress={() => togglePositionId(pos.id)}
                    >
                      <Ionicons
                        name={isChecked ? 'checkbox' : 'square-outline'}
                        size={15}
                        color={isChecked ? colors.primary : colors.subText}
                      />
                      <Text
                        style={[
                          styles.typeChoiceText,
                          {
                            color: isChecked ? colors.primary : colors.subText,
                            textDecorationLine: isChecked ? 'none' : 'line-through',
                          },
                        ]}
                      >
                        {pos.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.inputLabel, { color: colors.subText }]}>Sermon / Service Theme</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={theme}
                onChangeText={setTheme}
                placeholder="e.g. Unshakable Faith"
                placeholderTextColor={colors.subText}
              />

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
              {editingService && (
                <TouchableOpacity
                  style={[styles.deleteModalBtn, { borderColor: '#fca5a5', backgroundColor: '#fff1f2' }]}
                  onPress={() => {
                    const toDelete = editingService;
                    setIsModalOpen(false);
                    setTimeout(() => handleDeleteService(toDelete), 200);
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  <Text style={[styles.deleteModalBtnText, { color: '#ef4444' }]}>Delete</Text>
                </TouchableOpacity>
              )}
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setIsModalOpen(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveService}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {editingService ? 'Save Changes' : `Create Service (${selectedPositionIds.length})`}
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
  cardActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionBtn: {
    borderColor: '#fca5a5',
    backgroundColor: '#fff1f2',
  },
  deleteModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  deleteModalBtnText: {
    fontSize: 14,
    fontWeight: '700',
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
