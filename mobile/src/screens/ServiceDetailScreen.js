import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Linking,
  Platform,
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

const SERVICE_STATUSES = [
  { id: 'draft', label: 'Draft' },
  { id: 'published', label: 'Published' },
  { id: 'confirmed', label: 'Confirmed' },
];

export default function ServiceDetailScreen({ service, onBack, user, isDark = false }) {
  const userRole = (user?.role || '').toLowerCase();
  const isAdmin = userRole === 'admin';
  const isPastor = userRole === 'pastor';
  const canDeleteServices = isAdmin || isPastor;
  const canManage = ['admin', 'pastor', 'manager', 'leader'].includes(userRole);
  const isMember = !canManage;

  const [activeTab, setActiveTab] = useState('lineup'); // 'lineup' | 'runsheet' | 'availability' | 'logs'
  const [loading, setLoading] = useState(true);
  const [serviceInfo, setServiceInfo] = useState(service);
  const [campuses, setCampuses] = useState([]);
  const [lineup, setLineup] = useState([]);
  const [planItems, setPlanItems] = useState([]);
  const [availability, setAvailability] = useState({ available: [], declined: [] });
  const [auditLogs, setAuditLogs] = useState([]);
  const [worshipLeaders, setWorshipLeaders] = useState([]);

  // Dynamic Service Types
  const [serviceTypes, setServiceTypes] = useState(
    DEFAULT_SERVICE_TYPES.map((name, i) => ({ id: `default-${i}`, name, default_time: '10:00 AM' }))
  );
  const [showInlineAddType, setShowInlineAddType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeTime, setNewTypeTime] = useState('10:00 AM');
  const [creatingType, setCreatingType] = useState(false);

  // Modals
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isWorshipLeaderModalOpen, setIsWorshipLeaderModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [autoFillRest, setAutoFillRest] = useState(false);
  const [confirmingLineup, setConfirmingLineup] = useState(false);

  // Edit Service Details Form State
  const [isEditServiceModalOpen, setIsEditServiceModalOpen] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('10:00 AM');
  const [editType, setEditType] = useState('Sunday Morning Celebration');
  const [editTheme, setEditTheme] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCampusId, setEditCampusId] = useState('');
  const [editStatus, setEditStatus] = useState('draft');
  const [savingService, setSavingService] = useState(false);
  const [deletingService, setDeletingService] = useState(false);

  // Plan Item Form State
  const [planTitle, setPlanTitle] = useState('');
  const [planType, setPlanType] = useState('media');
  const [planDuration, setPlanDuration] = useState('5');
  const [planPresenter, setPlanPresenter] = useState('');
  const [planNotes, setPlanNotes] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);

  const fetchServiceData = async () => {
    try {
      setLoading(true);
      const [svcData, musiciansData, logsData, campusesData, typesData] = await Promise.all([
        api.getService(service.id),
        api.getMusicians().catch(() => []),
        api.getAuditLogs(service.id).catch(() => []),
        api.getCampuses().catch(() => []),
        api.getServiceTypes().catch(() => []),
      ]);

      if (svcData) {
        setServiceInfo(svcData.service || service);
        setLineup(Array.isArray(svcData.lineup) ? svcData.lineup : []);
        const items = (svcData.planItems || svcData.plan || []).filter((i) => i.item_type !== 'song');
        setPlanItems(Array.isArray(items) ? items : []);
        setAvailability(svcData.availability || { available: [], declined: [] });
      }

      if (Array.isArray(typesData) && typesData.length > 0) {
        setServiceTypes(typesData);
      }

      setAuditLogs(Array.isArray(logsData) ? logsData : []);

      if (Array.isArray(musiciansData)) {
        setWorshipLeaders(musiciansData);
      }
      if (Array.isArray(campusesData)) {
        setCampuses(campusesData);
      }
    } catch (err) {
      console.error('Fetch service detail error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceData();
  }, [service.id]);

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
      setEditType(created.name);
      if (created.default_time) {
        setEditTime(created.default_time);
      }
      setNewTypeName('');
      setShowInlineAddType(false);
      Alert.alert('Service Type Added', `"${created.name}" is now ready.`);
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
      `Are you sure you want to delete "${typeItem.name}"? Previous services will retain their historical records.`,
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
              if (editType === typeItem.name && remaining.length > 0) {
                setEditType(remaining[0].name);
              }
              Alert.alert('Deleted', `"${typeItem.name}" was removed.`);
            } catch (err) {
              console.error('Delete service type error:', err);
              Alert.alert('Delete Failed', err.message || 'Could not delete service type');
            }
          },
        },
      ]
    );
  };

  const handleOpenEditModal = () => {
    setEditDate(serviceInfo?.service_date ? serviceInfo.service_date.split('T')[0] : '');
    setEditTime(serviceInfo?.service_time || '10:00 AM');
    setEditType(serviceInfo?.service_type || 'Sunday Morning Celebration');
    setEditTheme(serviceInfo?.theme || '');
    setEditNotes(serviceInfo?.notes || '');
    setEditCampusId(serviceInfo?.campus_id || (campuses[0]?.id || ''));
    setEditStatus(serviceInfo?.status || 'draft');
    setIsEditServiceModalOpen(true);
  };

  const handleSaveServiceDetails = async () => {
    if (!editDate.trim()) {
      Alert.alert('Missing Date', 'Please enter a service date (YYYY-MM-DD)');
      return;
    }

    setSavingService(true);
    try {
      const updated = await api.updateService(service.id, {
        service_date: editDate.trim(),
        service_time: editTime.trim(),
        service_type: editType,
        theme: editTheme.trim() || undefined,
        notes: editNotes.trim() || undefined,
        campus_id: editCampusId || undefined,
        status: editStatus,
      });

      const matchedCampus = campuses.find((c) => c.id === editCampusId);
      setServiceInfo((prev) => ({
        ...prev,
        ...updated,
        campus_name: matchedCampus?.name || prev.campus_name,
      }));
      setIsEditServiceModalOpen(false);
      Alert.alert('Service Updated', 'Service details have been updated.');
    } catch (err) {
      console.error('Update service error:', err);
      Alert.alert('Error', err.message || 'Failed to update service details');
    } finally {
      setSavingService(false);
    }
  };

  const handleDeleteService = () => {
    if (!canDeleteServices) {
      Alert.alert('Permission Denied', 'Only Admins and Pastors can delete services.');
      return;
    }
    Alert.alert(
      'Delete Service',
      `Are you sure you want to permanently delete the "${serviceInfo?.service_type || 'Service'}" on ${serviceInfo?.service_date}? This will delete all roster assignments, availability, and run sheet items for this service.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            setDeletingService(true);
            try {
              await api.deleteService(service.id);
              if (isEditServiceModalOpen) {
                setIsEditServiceModalOpen(false);
              }
              Alert.alert('Service Deleted', 'The service has been permanently deleted.');
              onBack();
            } catch (err) {
              console.error('Delete service error:', err);
              Alert.alert('Delete Failed', err.message || 'Failed to delete service');
              setDeletingService(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenAssignModal = async (slot) => {
    setSelectedSlot(slot);
    setIsAssignModalOpen(true);
    setLoadingCandidates(true);
    try {
      const cList = await api.getCandidates(service.id, slot.positionId);
      const list = Array.isArray(cList) ? cList : (cList?.candidates || []);
      setCandidates(list);
    } catch (err) {
      console.error('Fetch candidates error:', err);
      setCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleAssignCandidate = async (musicianId) => {
    if (!selectedSlot) return;
    try {
      await api.overrideSlot(service.id, {
        position_id: selectedSlot.positionId,
        role_slot: 'primary',
        musician_id: musicianId,
        auto_roster: Boolean(autoFillRest && musicianId),
      });
      setIsAssignModalOpen(false);
      fetchServiceData();
      Alert.alert(
        'Roster Updated',
        autoFillRest && musicianId
          ? 'Member assigned and remaining open slots auto-filled!'
          : 'Member assigned to position.'
      );
    } catch (err) {
      Alert.alert('Assignment Error', err.message || 'Could not assign member');
    }
  };

  const handleSelectWorshipLeader = async (musicianId) => {
    try {
      await api.setWorshipLeader(service.id, musicianId, Boolean(autoFillRest));
      setIsWorshipLeaderModalOpen(false);
      fetchServiceData();
      Alert.alert('Team Lead Updated', autoFillRest ? 'Lead set and remaining slots auto-filled.' : 'Team Lead updated.');
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not update team lead');
    }
  };

  const handleConfirmLineup = async () => {
    setConfirmingLineup(true);
    try {
      await api.confirmLineup(service.id);
      await fetchServiceData();
      Alert.alert('Lineup Confirmed', 'Final lineup is confirmed! You can now share the final lineup for WhatsApp.');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to confirm lineup');
    } finally {
      setConfirmingLineup(false);
    }
  };

  const handleAutoSchedule = async () => {
    Alert.alert(
      'Run Auto-Roster',
      'Generate fair team rotation based on availability and serving frequency?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate Lineup',
          onPress: async () => {
            try {
              setLoading(true);
              await api.shuffleLineup(service.id, { pool: 'auto' });
              fetchServiceData();
              Alert.alert('Success', 'Lineup roster updated!');
            } catch (err) {
              Alert.alert('Scheduling Error', err.message || 'Failed to auto-schedule');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const getFormattedFinalLineupText = () => {
    const displayedSlots = lineup.filter(
      (s) => autoFillRest || !(s.positionName || '').toLowerCase().includes('worship leader')
    );
    const lineupLines = [];
    displayedSlots.forEach((slot) => {
      if (slot.primary?.name) {
        lineupLines.push(`• ${slot.positionName}: ${slot.primary.name}`);
      }
    });
    return [
      `⛪ *Jesus My Rock Church — ${serviceInfo?.service_type || 'Sunday Service'}*`,
      `📅 *Date:* ${serviceInfo?.service_date}`,
      `⏰ *Time:* ${serviceInfo?.service_time || '10:00 AM'}`,
      serviceInfo?.campus_name ? `📍 *Campus:* ${serviceInfo.campus_name}` : '',
      serviceInfo?.theme ? `📖 *Theme:* "${serviceInfo.theme}"` : '',
      '',
      `👥 *Final Lineup:*`,
      ...(lineupLines.length > 0 ? lineupLines : ['• No assignments yet']),
    ].filter(Boolean).join('\n');
  };

  const handleShareWhatsApp = () => {
    const isLineupConfirmed = serviceInfo?.status === 'confirmed';
    let messageText = '';

    if (isLineupConfirmed) {
      messageText = getFormattedFinalLineupText();
    } else {
      const publicLink = serviceInfo?.token
        ? `https://serve.creativeclicks.art/avail/${serviceInfo.token}`
        : 'https://serve.creativeclicks.art';
      messageText = [
        `⛪ *Jesus My Rock Church — ${serviceInfo?.service_type || 'Sunday Service'}*`,
        `📅 *Date:* ${serviceInfo?.service_date} at ${serviceInfo?.service_time || '10:00 AM'}`,
        serviceInfo?.campus_name ? `📍 *Campus:* ${serviceInfo.campus_name}` : '',
        serviceInfo?.theme ? `📖 *Theme:* "${serviceInfo.theme}"` : '',
        '',
        `👉 *Confirm Your Availability:*`,
        publicLink,
      ]
        .filter(Boolean)
        .join('\n');
    }

    const encoded = encodeURIComponent(messageText);
    Linking.openURL(`whatsapp://send?text=${encoded}`).catch(() => {
      Linking.openURL(`https://api.whatsapp.com/send?text=${encoded}`);
    });
  };

  const handleAddPlanItem = async () => {
    if (!planTitle.trim()) {
      Alert.alert('Missing Title', 'Please enter an item title (e.g. Countdown, Sermon).');
      return;
    }

    setSavingPlan(true);
    try {
      await api.addPlanItem(service.id, {
        title: planTitle.trim(),
        item_type: planType,
        duration_minutes: parseInt(planDuration, 10) || 5,
        leader: planPresenter.trim() || undefined,
        presenter: planPresenter.trim() || undefined,
        notes: planNotes.trim() || undefined,
        sequence_order: planItems.length + 1,
      });

      setIsPlanModalOpen(false);
      setPlanTitle('');
      setPlanPresenter('');
      setPlanNotes('');
      fetchServiceData();
      Alert.alert('Item Added', 'Order of service run sheet updated.');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to add run sheet item');
    } finally {
      setSavingPlan(false);
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

  const getRoleIcon = (role) => {
    const r = (role || '').toLowerCase();
    if (r.includes('worship') || r.includes('vocal')) return 'mic';
    if (r.includes('guitar')) return 'musical-note';
    if (r.includes('keys') || r.includes('keyboard') || r.includes('piano')) return 'keypad';
    if (r.includes('drum')) return 'disc';
    if (r.includes('bass')) return 'pulse';
    if (r.includes('sound') || r.includes('foh') || r.includes('audio')) return 'volume-high';
    if (r.includes('media') || r.includes('slides') || r.includes('camera')) return 'tv';
    return 'person';
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.subText }]}>Loading service roster...</Text>
      </View>
    );
  }

  const confirmedCount = lineup.filter((s) => s.primary?.status === 'confirmed').length;
  const totalSlots = lineup.length || 9;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Top Header App Bar */}
      <View style={[styles.topBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={[styles.topBarTitle, { color: colors.text }]} numberOfLines={1}>
            {serviceInfo?.service_type || 'Service Roster'}
          </Text>
          <Text style={[styles.topBarSub, { color: colors.subText }]}>
            {serviceInfo?.service_date} • {serviceInfo?.service_time || '10:00 AM'}
          </Text>
        </View>

        <View style={styles.topBarActions}>
          {canManage && (
            <TouchableOpacity
              style={[styles.topActionBtn, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
              onPress={handleOpenEditModal}
            >
              <Ionicons name="create-outline" size={17} color={colors.primary} />
            </TouchableOpacity>
          )}

          {canDeleteServices && (
            <TouchableOpacity
              style={[styles.topActionBtn, styles.deleteTopBtn]}
              onPress={handleDeleteService}
            >
              <Ionicons name="trash-outline" size={17} color="#ef4444" />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.shareIconBtn} onPress={handleShareWhatsApp}>
            <Ionicons name="logo-whatsapp" size={20} color="#16a34a" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Segmented Tabs */}
      <View style={[styles.segmentedBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.segmentTab, activeTab === 'lineup' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
          onPress={() => setActiveTab('lineup')}
        >
          <Text style={[styles.segmentText, { color: activeTab === 'lineup' ? colors.primary : colors.subText, fontWeight: activeTab === 'lineup' ? '800' : '600' }]}>
            Roster ({confirmedCount}/{totalSlots})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentTab, activeTab === 'runsheet' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
          onPress={() => setActiveTab('runsheet')}
        >
          <Text style={[styles.segmentText, { color: activeTab === 'runsheet' ? colors.primary : colors.subText, fontWeight: activeTab === 'runsheet' ? '800' : '600' }]}>
            Run Sheet ({planItems.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentTab, activeTab === 'availability' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
          onPress={() => setActiveTab('availability')}
        >
          <Text style={[styles.segmentText, { color: activeTab === 'availability' ? colors.primary : colors.subText, fontWeight: activeTab === 'availability' ? '800' : '600' }]}>
            Responses
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentTab, activeTab === 'logs' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
          onPress={() => setActiveTab('logs')}
        >
          <Text style={[styles.segmentText, { color: activeTab === 'logs' ? colors.primary : colors.subText, fontWeight: activeTab === 'logs' ? '800' : '600' }]}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* TAB 1: LINEUP / ROSTER */}
        {activeTab === 'lineup' && (
          <View>
            {/* Service Summary Card */}
            <View style={[styles.heroSummaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.heroRow}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <View style={[styles.serviceTypeHeroBadge, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}>
                      <Ionicons name="sparkles" size={11} color={colors.primary} />
                      <Text style={[styles.serviceTypeHeroBadgeText, { color: colors.primary }]}>
                        {serviceInfo?.service_type || 'Sunday Service'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.heroTheme, { color: colors.text }]}>
                    {serviceInfo?.theme ? `"${serviceInfo.theme}"` : (serviceInfo?.service_type || 'Sunday Service')}
                  </Text>
                  <Text style={[styles.heroCampus, { color: colors.subText }]}>
                    📍 {serviceInfo?.campus_name || 'Damansara Perdana Sanctuary'}
                  </Text>
                </View>
                {canManage && (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={[styles.autoFillBtn, { backgroundColor: colors.primary }]}
                      onPress={handleAutoSchedule}
                    >
                      <Ionicons name="sparkles" size={14} color="#fff" />
                      <Text style={styles.autoFillBtnText}>Auto-Roster</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.autoFillBtn, { backgroundColor: '#059669' }]}
                      onPress={handleConfirmLineup}
                      disabled={confirmingLineup}
                    >
                      <Ionicons name="checkmark-done" size={14} color="#fff" />
                      <Text style={styles.autoFillBtnText}>
                        {serviceInfo?.status === 'confirmed' ? 'Re-Confirm' : 'Confirm'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Service Management Actions Row */}
              <View style={[styles.heroActionsRow, { borderTopColor: colors.border }]}>
                {canManage && (
                  <TouchableOpacity
                    style={[styles.heroActionPill, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
                    onPress={handleOpenEditModal}
                  >
                    <Ionicons name="create-outline" size={14} color={colors.primary} />
                    <Text style={[styles.heroActionPillText, { color: colors.text }]}>Edit Details</Text>
                  </TouchableOpacity>
                )}

                {canDeleteServices && (
                  <TouchableOpacity
                    style={[styles.heroActionPill, { borderColor: '#fca5a5', backgroundColor: '#fff1f2' }]}
                    onPress={handleDeleteService}
                  >
                    <Ionicons name="trash-outline" size={14} color="#ef4444" />
                    <Text style={[styles.heroActionPillText, { color: '#ef4444' }]}>Delete Service</Text>
                  </TouchableOpacity>
                )}

                {serviceInfo?.notes ? (
                  <View style={{ flex: 1, marginLeft: 4 }}>
                    <Text style={[styles.heroNotesPreview, { color: colors.subText }]} numberOfLines={1}>
                      📝 {serviceInfo.notes}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Toggle: Set 1 & Auto-Fill Rest (Default OFF for Media Team) */}
              <TouchableOpacity
                style={[
                  styles.leaderBanner,
                  {
                    backgroundColor: autoFillRest ? colors.primaryLight : colors.inputBg,
                    borderWidth: 1,
                    borderColor: autoFillRest ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setAutoFillRest(!autoFillRest)}
              >
                <Ionicons
                  name={autoFillRest ? 'toggle' : 'toggle-outline'}
                  size={24}
                  color={autoFillRest ? colors.primary : colors.subText}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.leaderTag, { color: autoFillRest ? colors.primary : colors.subText }]}>
                    Set 1 & Auto-Fill Rest: {autoFillRest ? 'ON' : 'OFF'}
                  </Text>
                  <Text style={[styles.leaderName, { color: colors.text, fontSize: 12 }]}>
                    {autoFillRest
                      ? 'Assigning 1 person auto-fills remaining open positions'
                      : 'Media Team Mode: Assign each position individually'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Team Lead Tile (Only shown when Auto-Fill Rest is ON) */}
              {autoFillRest && (
                <TouchableOpacity
                  style={[styles.leaderBanner, { backgroundColor: colors.primaryLight }]}
                  onPress={() => setIsWorshipLeaderModalOpen(true)}
                >
                  <View style={styles.crownCircle}>
                    <Text style={{ fontSize: 16 }}>🎬</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.leaderTag, { color: colors.primary }]}>Assigned Team Lead</Text>
                    <Text style={[styles.leaderName, { color: colors.text }]}>
                      {serviceInfo?.worship_leader_name || 'Tap to assign Team Lead'}
                    </Text>
                  </View>
                  <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
                </TouchableOpacity>
              )}

              {/* Final Lineup Confirmed — Share for WhatsApp */}
              {serviceInfo?.status === 'confirmed' && (
                <View
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: '#ecfdf5',
                    borderWidth: 1,
                    borderColor: '#6ee7b7',
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#047857', marginBottom: 6 }}>
                    ✅ FINAL LINEUP CONFIRMED — READY FOR WHATSAPP
                  </Text>
                  <Text style={{ fontSize: 12, color: '#064e3b', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 10 }}>
                    {getFormattedFinalLineupText()}
                  </Text>
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#059669',
                      paddingVertical: 10,
                      borderRadius: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                    onPress={handleShareWhatsApp}
                  >
                    <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>
                      Send Final Lineup to WhatsApp
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Lineup Slots List */}
            <Text style={[styles.sectionHeading, { color: colors.text }]}>
              Media & Team Lineup Positions
            </Text>

            {lineup
              .filter((slot) => autoFillRest || !(slot.positionName || '').toLowerCase().includes('worship leader'))
              .map((slot) => {
              const primary = slot.primary;
              const isConfirmed = primary?.status === 'confirmed';
              const isDeclined = primary?.status === 'declined';
              const hasMusician = !!primary?.name;

              return (
                <View
                  key={slot.positionId}
                  style={[
                    styles.slotCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.slotRow}>
                    {/* Role Icon Circle */}
                    <View
                      style={[
                        styles.roleIconCircle,
                        {
                          backgroundColor: isConfirmed
                            ? '#dcfce7'
                            : isDeclined
                            ? '#fee2e2'
                            : colors.inputBg,
                        },
                      ]}
                    >
                      <Ionicons
                        name={getRoleIcon(slot.positionName)}
                        size={18}
                        color={isConfirmed ? '#16a34a' : isDeclined ? '#dc2626' : colors.primary}
                      />
                    </View>

                    {/* Volunteer Info */}
                    <View style={styles.slotInfo}>
                      <View style={styles.roleTitleRow}>
                        <Text style={[styles.roleNameText, { color: colors.text }]}>
                          {slot.positionName}
                        </Text>
                        <View
                          style={[
                            styles.statusChip,
                            isConfirmed
                              ? styles.statusConfirmed
                              : isDeclined
                              ? styles.statusDeclined
                              : styles.statusPending,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusChipText,
                              {
                                color: isConfirmed
                                  ? '#15803d'
                                  : isDeclined
                                  ? '#b91c1c'
                                  : '#b45309',
                              },
                            ]}
                          >
                            {isConfirmed ? '✓ Confirmed' : isDeclined ? '✕ Declined' : '⏳ Pending'}
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={[
                          styles.volunteerNameText,
                          { color: hasMusician ? colors.text : colors.subText },
                        ]}
                      >
                        {hasMusician ? primary.name : 'Open Position (Not filled)'}
                      </Text>

                      {hasMusician && primary.phone ? (
                        <Text style={[styles.volunteerContact, { color: colors.subText }]}>
                          📞 {primary.phone}
                        </Text>
                      ) : null}
                    </View>

                    {/* Swap / Assign Action */}
                    {canManage && (
                      <TouchableOpacity
                        style={[styles.assignBtn, { borderColor: colors.border }]}
                        onPress={() => handleOpenAssignModal(slot)}
                      >
                        <Text style={[styles.assignBtnText, { color: colors.text }]}>
                          {hasMusician ? 'Swap' : '+ Assign'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* TAB 2: ORDER OF SERVICE RUN SHEET */}
        {activeTab === 'runsheet' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>
                Order of Service Flow
              </Text>
              <TouchableOpacity
                style={[styles.miniActionBtn, { backgroundColor: colors.primary }]}
                onPress={() => setIsPlanModalOpen(true)}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.miniActionBtnText}>Add Item</Text>
              </TouchableOpacity>
            </View>

            {planItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="list-outline" size={40} color={colors.subText} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No Run Sheet Items</Text>
                <Text style={[styles.emptySubtitle, { color: colors.subText }]}>
                  Add songs, scripture readings, prayers, and sermon timings.
                </Text>
              </View>
            ) : (
              planItems.map((item, idx) => (
                <View
                  key={item.id || idx}
                  style={[styles.timelineCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={[styles.stepNumberBadge, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.stepNumberText, { color: colors.primary }]}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.itemHeaderRow}>
                      <Text style={[styles.itemTitleText, { color: colors.text }]}>{item.title}</Text>
                      <Text style={[styles.durationBadge, { backgroundColor: colors.badgeBg, color: colors.subText }]}>
                        ⏱️ {item.duration_minutes || 5} min
                      </Text>
                    </View>
                    <Text style={[styles.itemTypeTag, { color: colors.primary }]}>
                      {(item.item_type || 'segment').toUpperCase()}
                    </Text>
                    {item.leader || item.presenter ? (
                      <Text style={[styles.itemPresenter, { color: colors.subText }]}>
                        Lead: {item.leader || item.presenter}
                      </Text>
                    ) : null}
                    {item.notes ? (
                      <Text style={[styles.itemNotes, { color: colors.subText }]}>
                        {item.notes}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* TAB 3: RESPONSES & AVAILABILITY */}
        {activeTab === 'availability' && (
          <View>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>
              Volunteer Availability Responses
            </Text>

            <View style={styles.statsSummaryGrid}>
              <View style={[styles.statBox, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}>
                <Text style={[styles.statBoxNum, { color: '#15803d' }]}>
                  {availability?.available?.length || 0}
                </Text>
                <Text style={[styles.statBoxLabel, { color: '#15803d' }]}>Available</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
                <Text style={[styles.statBoxNum, { color: '#b91c1c' }]}>
                  {availability?.declined?.length || 0}
                </Text>
                <Text style={[styles.statBoxLabel, { color: '#b91c1c' }]}>Declined</Text>
              </View>
            </View>

            {lineup.map((slot) => {
              const primary = slot.primary;
              const isConfirmed = primary?.status === 'confirmed';
              const isDeclined = primary?.status === 'declined';

              return (
                <View
                  key={slot.positionId}
                  style={[styles.availRowCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.availAvatar}>
                    <Text style={styles.availAvatarText}>
                      {(primary?.name || 'U').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.availName, { color: colors.text }]}>
                      {primary?.name || 'Open Position'}
                    </Text>
                    <Text style={[styles.availRole, { color: colors.subText }]}>
                      Position: {slot.positionName}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusChip,
                      isConfirmed
                        ? styles.statusConfirmed
                        : isDeclined
                        ? styles.statusDeclined
                        : styles.statusPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        {
                          color: isConfirmed
                            ? '#15803d'
                            : isDeclined
                            ? '#b91c1c'
                            : '#b45309',
                        },
                      ]}
                    >
                      {isConfirmed ? 'Accepted' : isDeclined ? 'Declined' : 'Invited'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* TAB 4: AUDIT LOGS / HISTORY */}
        {activeTab === 'logs' && (
          <View>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>
              Service Activity Feed
            </Text>

            {auditLogs.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={40} color={colors.subText} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No Activity Recorded</Text>
              </View>
            ) : (
              auditLogs.map((log, index) => (
                <View
                  key={log.id || index}
                  style={[styles.logRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Ionicons name="information-circle" size={18} color={colors.primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.logActionText, { color: colors.text }]}>
                      {log.type || log.action || 'Roster activity'}
                    </Text>
                    <Text style={[styles.logDetailsText, { color: colors.subText }]}>
                      {log.message || log.details}
                    </Text>
                    <Text style={[styles.logTimestamp, { color: colors.subText }]}>
                      {new Date(log.created_at || Date.now()).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Candidate / Swap Volunteer Modal */}
      <Modal visible={isAssignModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Assign {selectedSlot?.positionName}
              </Text>
              <TouchableOpacity onPress={() => setIsAssignModalOpen(false)}>
                <Ionicons name="close" size={22} color={colors.subText} />
              </TouchableOpacity>
            </View>

            {loadingCandidates ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <ActivityIndicator color={colors.primary} />
                <Text style={{ marginTop: 8, color: colors.subText }}>Finding eligible volunteers...</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 340 }}>
                {candidates.length === 0 ? (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: colors.subText }}>No candidates available for this role.</Text>
                  </View>
                ) : (
                  candidates.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.candidateRow, { borderColor: colors.border }]}
                      onPress={() => handleAssignCandidate(c.id)}
                    >
                      <View style={styles.candAvatar}>
                        <Text style={styles.candAvatarText}>{(c.name || 'U').slice(0, 2).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.candName, { color: colors.text }]}>{c.name}</Text>
                        <Text style={[styles.candSub, { color: colors.subText }]}>
                          {Array.isArray(c.roles) ? c.roles.join(', ') : c.roles || 'Volunteer'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.subText} />
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Worship Leader Picker Modal */}
      <Modal visible={isWorshipLeaderModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Worship Leader</Text>
              <TouchableOpacity onPress={() => setIsWorshipLeaderModalOpen(false)}>
                <Ionicons name="close" size={22} color={colors.subText} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {worshipLeaders.map((wl) => (
                <TouchableOpacity
                  key={wl.id}
                  style={[styles.candidateRow, { borderColor: colors.border }]}
                  onPress={() => handleSelectWorshipLeader(wl.id)}
                >
                  <Text style={{ fontSize: 18, marginRight: 10 }}>👑</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.candName, { color: colors.text }]}>{wl.name}</Text>
                    <Text style={[styles.candSub, { color: colors.subText }]}>
                      {Array.isArray(wl.roles) ? wl.roles.join(', ') : wl.ministry}
                    </Text>
                  </View>
                  <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Plan Item Modal */}
      <Modal visible={isPlanModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Run Sheet Item</Text>
              <TouchableOpacity onPress={() => setIsPlanModalOpen(false)}>
                <Ionicons name="close" size={22} color={colors.subText} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              <Text style={[styles.inputLabel, { color: colors.subText }]}>Item Title *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={planTitle}
                onChangeText={setPlanTitle}
                placeholder="e.g. 5-Minute Countdown Video"
                placeholderTextColor={colors.subText}
              />

              <Text style={[styles.inputLabel, { color: colors.subText }]}>Item Type</Text>
              <View style={styles.pillsWrap}>
                {['media', 'sermon', 'welcome', 'prayer', 'announcement'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.choicePill,
                      {
                        backgroundColor: planType === t ? colors.primaryLight : colors.inputBg,
                        borderColor: planType === t ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setPlanType(t)}
                  >
                    <Text style={[styles.choicePillText, { color: planType === t ? colors.primary : colors.text }]}>
                      {t.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: colors.subText }]}>Duration (Minutes)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={planDuration}
                onChangeText={setPlanDuration}
                keyboardType="numeric"
                placeholder="5"
                placeholderTextColor={colors.subText}
              />

              <Text style={[styles.inputLabel, { color: colors.subText }]}>Presenter / Leader</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={planPresenter}
                onChangeText={setPlanPresenter}
                placeholder="e.g. Pastor Marcus"
                placeholderTextColor={colors.subText}
              />

              <Text style={[styles.inputLabel, { color: colors.subText }]}>Notes</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={planNotes}
                onChangeText={setPlanNotes}
                placeholder="e.g. Transition directly to prayer"
                placeholderTextColor={colors.subText}
              />
            </ScrollView>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setIsPlanModalOpen(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                onPress={handleAddPlanItem}
                disabled={savingPlan}
              >
                {savingPlan ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Add Item</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Service Details Modal */}
      <Modal visible={isEditServiceModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="create" size={20} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Service Details</Text>
              </View>
              <TouchableOpacity onPress={() => setIsEditServiceModalOpen(false)}>
                <Ionicons name="close" size={22} color={colors.subText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={[styles.inputLabel, { color: colors.subText }]}>Service Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={editDate}
                onChangeText={setEditDate}
                placeholder="2026-09-20"
                placeholderTextColor={colors.subText}
              />

              <Text style={[styles.inputLabel, { color: colors.subText }]}>Service Time *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={editTime}
                onChangeText={setEditTime}
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

              <View style={styles.pillsWrap}>
                {serviceTypes.map((t) => {
                  const typeName = typeof t === 'string' ? t : t.name;
                  const isSelected = editType === typeName;
                  return (
                    <View
                      key={t.id || typeName}
                      style={[
                        styles.choicePill,
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
                          setEditType(typeName);
                          if (t.default_time) {
                            setEditTime(t.default_time);
                          }
                        }}
                        style={{ flexShrink: 1 }}
                      >
                        <Text
                          style={[
                            styles.choicePillText,
                            { color: isSelected ? colors.primary : colors.text },
                          ]}
                        >
                          {typeName}
                        </Text>
                      </TouchableOpacity>

                      {canDeleteServices && serviceTypes.length > 1 && (
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

              {campuses.length > 0 && (
                <>
                  <Text style={[styles.inputLabel, { color: colors.subText }]}>Campus / Location</Text>
                  <View style={styles.pillsWrap}>
                    {campuses.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.choicePill,
                          {
                            borderColor: editCampusId === c.id ? colors.primary : colors.border,
                            backgroundColor: editCampusId === c.id ? colors.primaryLight : colors.inputBg,
                          },
                        ]}
                        onPress={() => setEditCampusId(c.id)}
                      >
                        <Text
                          style={[
                            styles.choicePillText,
                            { color: editCampusId === c.id ? colors.primary : colors.text },
                          ]}
                        >
                          📍 {c.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={[styles.inputLabel, { color: colors.subText }]}>Status</Text>
              <View style={styles.pillsWrap}>
                {SERVICE_STATUSES.map((st) => (
                  <TouchableOpacity
                    key={st.id}
                    style={[
                      styles.choicePill,
                      {
                        borderColor: editStatus === st.id ? colors.primary : colors.border,
                        backgroundColor: editStatus === st.id ? colors.primaryLight : colors.inputBg,
                      },
                    ]}
                    onPress={() => setEditStatus(st.id)}
                  >
                    <Text
                      style={[
                        styles.choicePillText,
                        { color: editStatus === st.id ? colors.primary : colors.text },
                      ]}
                    >
                      {st.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: colors.subText }]}>Sermon / Service Theme</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={editTheme}
                onChangeText={setEditTheme}
                placeholder="e.g. Unshakable Faith"
                placeholderTextColor={colors.subText}
              />

              <Text style={[styles.inputLabel, { color: colors.subText }]}>Notes & Instructions</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={editNotes}
                onChangeText={setEditNotes}
                multiline
                numberOfLines={3}
                placeholderTextColor={colors.subText}
              />
            </ScrollView>

            <View style={styles.modalActionRow}>
              {canDeleteServices && (
                <TouchableOpacity
                  style={[styles.deleteModalBtn, { borderColor: '#fca5a5', backgroundColor: '#fff1f2' }]}
                  onPress={handleDeleteService}
                  disabled={deletingService}
                >
                  {deletingService ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                      <Text style={[styles.deleteModalBtnText, { color: '#ef4444' }]}>Delete</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <View style={{ flex: 1 }} />

              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setIsEditServiceModalOpen(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveServiceDetails}
                disabled={savingService}
              >
                {savingService ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Save Changes</Text>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
  },
  topBarCenter: {
    flex: 1,
    marginLeft: 8,
  },
  topBarTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  topBarSub: {
    fontSize: 11,
    fontWeight: '500',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteTopBtn: {
    borderColor: '#fca5a5',
    backgroundColor: '#fff1f2',
  },
  shareIconBtn: {
    padding: 6,
  },
  segmentedBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 12,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroSummaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTheme: {
    fontSize: 16,
    fontWeight: '800',
  },
  heroCampus: {
    fontSize: 12,
    marginTop: 2,
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  heroActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  heroActionPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroNotesPreview: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  autoFillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  autoFillBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  leaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    marginTop: 12,
  },
  crownCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderTag: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  leaderName: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  miniActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  miniActionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  slotCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotInfo: {
    flex: 1,
    marginLeft: 12,
  },
  roleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 6,
  },
  roleNameText: {
    fontSize: 13,
    fontWeight: '800',
  },
  statusChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusConfirmed: {
    backgroundColor: '#dcfce7',
  },
  statusDeclined: {
    backgroundColor: '#fee2e2',
  },
  statusPending: {
    backgroundColor: '#fef3c7',
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  volunteerNameText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  volunteerContact: {
    fontSize: 11,
    marginTop: 1,
  },
  assignBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  assignBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  timelineCard: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  stepNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '800',
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitleText: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  durationBadge: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemTypeTag: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  itemPresenter: {
    fontSize: 11,
    marginTop: 2,
  },
  itemNotes: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  statsSummaryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statBoxNum: {
    fontSize: 22,
    fontWeight: '900',
  },
  statBoxLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  availRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  availAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f5ede1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  availAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9e7343',
  },
  availName: {
    fontSize: 13,
    fontWeight: '700',
  },
  availRole: {
    fontSize: 11,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  logActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  logDetailsText: {
    fontSize: 11,
    marginTop: 2,
  },
  logTimestamp: {
    fontSize: 10,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
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
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  candAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5ede1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  candAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9e7343',
  },
  candName: {
    fontSize: 14,
    fontWeight: '700',
  },
  candSub: {
    fontSize: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  choicePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
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
  deleteModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  deleteModalBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  textArea: {
    height: 68,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
  serviceTypeHeroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  serviceTypeHeroBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
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
    height: 42,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitInlineBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
