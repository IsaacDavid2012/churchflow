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
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';

const DEFAULT_SERVICE_TYPES = [
  'Sunday Morning Celebration',
  'Sunday Evening Praise & Word',
  'Midweek Encounter & Prayer',
  'Youth Revolution (Friday)',
  'Night of Worship & Prophetic',
  'Special Gathering',
];

export default function ServicesScreen({ onSelectService, user, isDark = false }) {
  const userRole = (user?.role || '').toLowerCase();
  const isAdmin = userRole === 'admin';
  const isPastor = userRole === 'pastor';
  const canDeleteServices = isAdmin || isPastor;
  const canManage = ['admin', 'pastor', 'manager', 'leader'].includes(userRole);
  const isMember = !canManage;

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [campuses, setCampuses] = useState([]);
  const [positions, setPositions] = useState([]);
  const [selectedPositionIds, setSelectedPositionIds] = useState([]);

  // Dynamic Service Types
  const [serviceTypes, setServiceTypes] = useState(
    DEFAULT_SERVICE_TYPES.map((name, i) => ({ id: `default-${i}`, name, default_time: '10:00 AM' }))
  );
  const [isTypesModalOpen, setIsTypesModalOpen] = useState(false);
  const [showInlineAddType, setShowInlineAddType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeTime, setNewTypeTime] = useState('10:00 AM');
  const [creatingType, setCreatingType] = useState(false);

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
      const [svcData, campusData, posData, typesData] = await Promise.all([
        api.getServices(),
        api.getCampuses().catch(() => []),
        api.getPositions().catch(() => []),
        api.getServiceTypes().catch(() => []),
      ]);
      setServices(Array.isArray(svcData) ? svcData : []);
      setCampuses(Array.isArray(campusData) ? campusData : []);
      const posList = Array.isArray(posData) ? posData : [];
      setPositions(posList);
      if (Array.isArray(typesData) && typesData.length > 0) {
        setServiceTypes(typesData);
      }
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

  // Handle Android Hardware / Swipe Back Button
  useEffect(() => {
    const handleBack = () => {
      if (isTypesModalOpen) {
        setIsTypesModalOpen(false);
        return true;
      }
      if (isModalOpen) {
        setIsModalOpen(false);
        return true;
      }
      return false; // Propagate to App.js tab navigation
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => backSub.remove();
  }, [isTypesModalOpen, isModalOpen]);

  const handleAddServiceType = async () => {
    if (!newTypeName.trim()) {
      Alert.alert('Name Required', 'Please enter a name for the new service type.');
      return;
    }
    setCreatingType(true);
    try {
      const created = await api.createServiceType({
        name: newTypeName.trim(),
        default_time: newTypeTime.trim() || '10:00 AM',
      });
      const updatedTypes = [...serviceTypes.filter((t) => t.id !== created.id), created];
      setServiceTypes(updatedTypes);
      setServiceType(created.name);
      if (created.default_time && !editingService) {
        setServiceTime(created.default_time);
      }
      setNewTypeName('');
      setShowInlineAddType(false);
      Alert.alert('Service Type Added', `"${created.name}" is now ready for service scheduling.`);
    } catch (err) {
      console.error('Add service type error:', err);
      Alert.alert('Error', err.message || 'Failed to add service type');
    } finally {
      setCreatingType(false);
    }
  };

  const handleDeleteServiceType = (typeItem) => {
    if (!canDeleteServices) {
      Alert.alert('Permission Denied', 'Only Admins and Pastors can delete service types.');
      return;
    }
    if (serviceTypes.length <= 1) {
      Alert.alert('Cannot Delete', 'You must have at least one service type.');
      return;
    }

    Alert.alert(
      'Delete Service Type',
      `Are you sure you want to delete "${typeItem.name}"? Past services will keep their records intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (typeItem.id && !typeItem.id.toString().startsWith('default-')) {
                await api.deleteServiceType(typeItem.id);
              }
              const remaining = serviceTypes.filter((t) => t.id !== typeItem.id && t.name !== typeItem.name);
              setServiceTypes(remaining);
              if (serviceType === typeItem.name && remaining.length > 0) {
                setServiceType(remaining[0].name);
              }
              Alert.alert('Deleted', `"${typeItem.name}" service type was deleted.`);
            } catch (err) {
              console.error('Delete service type error:', err);
              Alert.alert('Delete Failed', err.message || 'Could not delete service type');
            }
          },
        },
      ]
    );
  };

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
    if (!canDeleteServices) {
      Alert.alert('Permission Denied', 'Only Admins and Pastors can delete services.');
      return;
    }
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
              <View style={[styles.serviceTypeBadge, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}>
                <Ionicons name="sparkles" size={11} color={colors.primary} />
                <Text style={[styles.serviceTypeBadgeText, { color: colors.primary }]} numberOfLines={1}>
                  {item.service_type || 'Sunday Service'}
                </Text>
              </View>
              <Text style={[styles.timeBadge, { color: colors.subText }]}>
                🕒 {item.service_time || '10:00 AM'}
              </Text>
            </View>

            <Text style={[styles.serviceTitle, { color: colors.text }]} numberOfLines={1}>
              {item.theme ? `"${item.theme}"` : (item.service_type || 'Sunday Service')}
            </Text>

            <Text style={[styles.campusBadge, { backgroundColor: colors.badgeBg, color: colors.subText, alignSelf: 'flex-start', marginTop: 4 }]}>
              📍 {item.campus_name || 'Main Sanctuary'}
            </Text>

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
                {canManage && (
                  <TouchableOpacity
                    style={[styles.quickActionBtn, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
                    onPress={() => handleOpenEditModal(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="create-outline" size={15} color={colors.primary} />
                  </TouchableOpacity>
                )}

                {canDeleteServices && (
                  <TouchableOpacity
                    style={[styles.quickActionBtn, styles.deleteActionBtn]}
                    onPress={() => handleDeleteService(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={15} color="#ef4444" />
                  </TouchableOpacity>
                )}

                <View style={styles.chevronWrap}>
                  <Text style={[styles.openDetailText, { color: colors.subText }]}>{canManage ? 'Manage' : 'View'}</Text>
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
          keyExtractor={(item, index) => (item?.id != null ? item.id.toString() : String(index))}
          renderItem={renderServiceCard}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <View style={[styles.topSummaryBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.topSummaryLeft}>
                <Text style={[styles.topServicesCount, { color: colors.text }]}>
                  {services.length} {services.length === 1 ? 'Service' : 'Services'} Scheduled
                </Text>
                <Text style={[styles.topServicesSub, { color: colors.subText }]}>
                  {serviceTypes.length} dynamic service types available
                </Text>
              </View>
              {canDeleteServices && (
                <TouchableOpacity
                  style={[styles.manageTypesTopBtn, { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
                  onPress={() => setIsTypesModalOpen(true)}
                >
                  <Ionicons name="layers-outline" size={15} color={colors.primary} />
                  <Text style={[styles.manageTypesTopBtnText, { color: colors.primary }]}>Manage Types</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={colors.subText} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Services Scheduled</Text>
              <Text style={[styles.emptySubtitle, { color: colors.subText }]}>
                {canManage ? 'Tap the + button below to plan your next worship service.' : 'No upcoming services scheduled.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button (FAB) - For Admin, Pastor, Manager */}
      {canManage && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
          onPress={handleOpenCreateModal}
        >
          <Ionicons name="add" size={26} color="#ffffff" />
          <Text style={styles.fabText}>Plan Service</Text>
        </TouchableOpacity>
      )}

      {/* Plan / Edit Service Modal Bottom Sheet */}
      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
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

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 6 }}>
                <Text style={[styles.inputLabel, { color: colors.subText, marginTop: 0, marginBottom: 0 }]}>
                  Service Type *
                </Text>
                <TouchableOpacity
                  onPress={() => setShowInlineAddType(!showInlineAddType)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Ionicons name={showInlineAddType ? 'close-circle' : 'add-circle'} size={15} color={colors.primary} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                    {showInlineAddType ? 'Cancel' : '+ Add Type'}
                  </Text>
                </TouchableOpacity>
              </View>

              {showInlineAddType && (
                <View style={[styles.inlineAddTypeBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Text style={[styles.inlineAddTitle, { color: colors.text }]}>New Service Type</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border, marginBottom: 8 }]}
                    value={newTypeName}
                    onChangeText={setNewTypeName}
                    placeholder="e.g. Special Revival Service"
                    placeholderTextColor={colors.subText}
                  />
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TextInput
                      style={[styles.input, { flex: 1, backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                      value={newTypeTime}
                      onChangeText={setNewTypeTime}
                      placeholder="Default Time (e.g. 10:00 AM)"
                      placeholderTextColor={colors.subText}
                    />
                    <TouchableOpacity
                      style={[styles.submitInlineBtn, { backgroundColor: colors.primary }]}
                      onPress={handleAddServiceType}
                      disabled={creatingType}
                    >
                      {creatingType ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.submitInlineBtnText}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.typesPillsWrap}>
                {serviceTypes.map((t) => {
                  const typeName = typeof t === 'string' ? t : t.name;
                  const isSelected = serviceType === typeName;
                  return (
                    <View
                      key={t.id || typeName}
                      style={[
                        styles.typeChoice,
                        {
                          borderColor: isSelected ? colors.primary : colors.border,
                          backgroundColor: isSelected ? colors.primaryLight : colors.inputBg,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        },
                      ]}
                    >
                      <TouchableOpacity
                        onPress={() => {
                          setServiceType(typeName);
                          if (t.default_time && !editingService) {
                            setServiceTime(t.default_time);
                          }
                        }}
                        style={{ flexShrink: 1 }}
                      >
                        <Text
                          style={[
                            styles.typeChoiceText,
                            { color: isSelected ? colors.primary : colors.text },
                          ]}
                        >
                          {typeName}
                        </Text>
                      </TouchableOpacity>

                      {serviceTypes.length > 1 && (
                        <TouchableOpacity
                          onPress={() => handleDeleteServiceType(t)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons
                            name="close-circle"
                            size={14}
                            color={isSelected ? colors.primary : colors.subText}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
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

      {/* Dedicated Manage Service Types Modal */}
      <Modal visible={isTypesModalOpen} animationType="slide" transparent onRequestClose={() => setIsTypesModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border, maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="layers" size={20} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Manage Service Types
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsTypesModalOpen(false)}>
                <Ionicons name="close" size={22} color={colors.subText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.typesIntroText, { color: colors.subText }]}>
                Add or remove dynamic service types for Jesus My Rock Church. Changes sync across mobile and web instantly.
              </Text>

              {/* Add New Type Box */}
              <View style={[styles.inlineAddTypeBox, { backgroundColor: colors.inputBg, borderColor: colors.border, marginTop: 12 }]}>
                <Text style={[styles.inlineAddTitle, { color: colors.text }]}>Add New Service Type</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border, marginBottom: 8 }]}
                  value={newTypeName}
                  onChangeText={setNewTypeName}
                  placeholder="e.g. Easter Celebration Night"
                  placeholderTextColor={colors.subText}
                />
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                    value={newTypeTime}
                    onChangeText={setNewTypeTime}
                    placeholder="Default Time (e.g. 7:30 PM)"
                    placeholderTextColor={colors.subText}
                  />
                  <TouchableOpacity
                    style={[styles.submitInlineBtn, { backgroundColor: colors.primary }]}
                    onPress={handleAddServiceType}
                    disabled={creatingType}
                  >
                    {creatingType ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.submitInlineBtnText}>Add Type</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Current List of Types */}
              <Text style={[styles.inputLabel, { color: colors.subText, marginTop: 18, marginBottom: 8 }]}>
                Configured Service Types ({serviceTypes.length})
              </Text>
              <View style={styles.typesListContainer}>
                {serviceTypes.map((t, idx) => {
                  const typeName = typeof t === 'string' ? t : t.name;
                  const typeTime = t.default_time || '10:00 AM';
                  return (
                    <View
                      key={t.id || idx}
                      style={[styles.typeRowItem, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.typeNameLabel, { color: colors.text }]}>{typeName}</Text>
                        <Text style={[styles.typeTimeLabel, { color: colors.subText }]}>🕒 Default: {typeTime}</Text>
                      </View>
                      {serviceTypes.length > 1 && (
                        <TouchableOpacity
                          style={[styles.typeDeleteBtn, { borderColor: '#fca5a5', backgroundColor: '#fff1f2' }]}
                          onPress={() => handleDeleteServiceType(t)}
                        >
                          <Ionicons name="trash-outline" size={15} color="#ef4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            <View style={{ marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary, alignItems: 'center' }]}
                onPress={() => setIsTypesModalOpen(false)}
              >
                <Text style={styles.submitBtnText}>Done</Text>
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
  serviceTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  serviceTypeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  topSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  topSummaryLeft: {
    flex: 1,
  },
  topServicesCount: {
    fontSize: 14,
    fontWeight: '800',
  },
  topServicesSub: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  manageTypesTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  manageTypesTopBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inlineAddTypeBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  inlineAddTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  submitInlineBtn: {
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitInlineBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  typesIntroText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  typesListContainer: {
    gap: 8,
  },
  typeRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  typeNameLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  typeTimeLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  typeDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
