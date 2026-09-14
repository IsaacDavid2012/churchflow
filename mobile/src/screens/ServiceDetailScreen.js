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

export default function ServiceDetailScreen({ service, onBack, user, isDark = false }) {
  const [activeTab, setActiveTab] = useState('lineup'); // 'lineup' | 'runsheet' | 'availability' | 'logs'
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [planItems, setPlanItems] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [worshipLeaders, setWorshipLeaders] = useState([]);

  // Modals
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isWorshipLeaderModalOpen, setIsWorshipLeaderModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

  // Plan Item Form State
  const [planTitle, setPlanTitle] = useState('');
  const [planType, setPlanType] = useState('song');
  const [planDuration, setPlanDuration] = useState('5');
  const [planPresenter, setPlanPresenter] = useState('');
  const [planNotes, setPlanNotes] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);

  const fetchServiceData = async () => {
    try {
      setLoading(true);
      const [svcData, planData, logsData, musiciansData] = await Promise.all([
        api.getServiceById(service.id),
        api.getPlanItems(service.id).catch(() => []),
        api.getAuditLogs(service.id).catch(() => []),
        api.getMusicians().catch(() => []),
      ]);

      setDetail(svcData || service);
      setPlanItems(planData || []);
      setAuditLogs(logsData || []);
      setWorshipLeaders((musiciansData || []).filter((m) => m.primary_instrument === 'Worship Leader' || m.can_lead_worship));
    } catch (err) {
      console.error('Fetch service detail error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceData();
  }, [service.id]);

  const handleOpenAssignModal = async (slot) => {
    setSelectedSlot(slot);
    setIsAssignModalOpen(true);
    try {
      const cList = await api.getCandidates(service.id, slot.role_name);
      setCandidates(cList || []);
    } catch (err) {
      console.error('Fetch candidates error:', err);
      setCandidates([]);
    }
  };

  const handleAssignCandidate = async (musicianId) => {
    if (!selectedSlot) return;
    try {
      await api.manualAssignSlot(service.id, selectedSlot.id, musicianId);
      setIsAssignModalOpen(false);
      fetchServiceData();
      Alert.alert('Roster Updated', 'Volunteer assigned successfully.');
    } catch (err) {
      Alert.alert('Assignment Error', err.response?.data?.error || 'Could not assign volunteer');
    }
  };

  const handleSelectWorshipLeader = async (musicianId) => {
    try {
      await api.setWorshipLeader(service.id, musicianId);
      setIsWorshipLeaderModalOpen(false);
      fetchServiceData();
      Alert.alert('Worship Leader Updated', 'Leader set and lineup updated.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not update leader');
    }
  };

  const handleAutoSchedule = async () => {
    Alert.alert(
      'Auto-Fill Lineup',
      'Generate smart volunteer rotation based on availability, skill, and attendance history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate Lineup',
          onPress: async () => {
            try {
              setLoading(true);
              await api.autoSchedule(service.id);
              fetchServiceData();
              Alert.alert('Success', 'Lineup roster filled based on fair rotation rules!');
            } catch (err) {
              Alert.alert('Scheduling Error', err.response?.data?.error || 'Failed to auto-schedule');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleShareWhatsApp = () => {
    const lines = [
      `⛪ *ChurchFlow Lineup - ${detail?.type || 'Sunday Service'}*`,
      `📅 *Date:* ${detail?.date} at ${detail?.time || '10:00 AM'}`,
      `🏛️ *Campus:* ${detail?.campus?.name || 'Main Sanctuary'}`,
      detail?.theme ? `📖 *Theme:* "${detail.theme}"` : '',
      `\n👥 *Stage Roster:*`,
    ];

    detail?.slots?.forEach((s) => {
      const name = s.musician?.name || 'Unassigned';
      const statusIcon = s.status === 'confirmed' ? '✅' : s.status === 'declined' ? '❌' : '⏳';
      lines.push(`• *${s.role_name}:* ${name} ${statusIcon}`);
    });

    lines.push(`\n🔗 Confirm your serving status: https://serve.creativeclicks.art`);

    const text = encodeURIComponent(lines.filter(Boolean).join('\n'));
    Linking.openURL(`whatsapp://send?text=${text}`).catch(() => {
      Linking.openURL(`https://api.whatsapp.com/send?text=${text}`);
    });
  };

  const handleAddPlanItem = async () => {
    if (!planTitle.trim()) {
      Alert.alert('Missing Title', 'Please enter an item title (e.g. Song name, Sermon).');
      return;
    }

    setSavingPlan(true);
    try {
      await api.addPlanItem(service.id, {
        title: planTitle.trim(),
        item_type: planType,
        duration_minutes: parseInt(planDuration, 10) || 5,
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
      Alert.alert('Error', err.response?.data?.error || 'Failed to add run sheet item');
    } finally {
      setSavingPlan(false);
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

  const getRoleIcon = (role) => {
    const r = (role || '').toLowerCase();
    if (r.includes('worship') || r.includes('lead vocal')) return 'mic';
    if (r.includes('guitar')) return 'musical-note';
    if (r.includes('keys') || r.includes('piano') || r.includes('synth')) return 'keypad';
    if (r.includes('drum')) return 'disc';
    if (r.includes('bass')) return 'pulse';
    if (r.includes('media') || r.includes('visual') || r.includes('slides')) return 'tv';
    if (r.includes('sound') || r.includes('audio')) return 'volume-high';
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

  const confirmedCount = detail?.slots?.filter((s) => s.status === 'confirmed').length || 0;
  const totalSlots = detail?.slots?.length || 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Top Header App Bar */}
      <View style={[styles.topBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={[styles.topBarTitle, { color: colors.text }]} numberOfLines={1}>
            {detail?.type || 'Service Roster'}
          </Text>
          <Text style={[styles.topBarSub, { color: colors.subText }]}>
            {detail?.date} • {detail?.time || '10:00 AM'}
          </Text>
        </View>

        <TouchableOpacity style={styles.shareIconBtn} onPress={handleShareWhatsApp}>
          <Ionicons name="logo-whatsapp" size={22} color="#16a34a" />
        </TouchableOpacity>
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
                  <Text style={[styles.heroTheme, { color: colors.text }]}>
                    {detail?.theme ? `"${detail.theme}"` : detail?.type}
                  </Text>
                  <Text style={[styles.heroCampus, { color: colors.subText }]}>
                    📍 {detail?.campus?.name || 'Sanctuary Campus'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.autoFillBtn, { backgroundColor: colors.primary }]}
                  onPress={handleAutoSchedule}
                >
                  <Ionicons name="sparkles" size={14} color="#fff" />
                  <Text style={styles.autoFillBtnText}>Auto-Fill</Text>
                </TouchableOpacity>
              </View>

              {/* Worship Leader Tile */}
              <TouchableOpacity
                style={[styles.leaderBanner, { backgroundColor: colors.primaryLight }]}
                onPress={() => setIsWorshipLeaderModalOpen(true)}
              >
                <View style={styles.crownCircle}>
                  <Text style={{ fontSize: 16 }}>👑</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.leaderTag, { color: colors.primary }]}>Assigned Worship Leader</Text>
                  <Text style={[styles.leaderName, { color: colors.text }]}>
                    {detail?.worship_leader?.name || 'Tap to assign Worship Leader'}
                  </Text>
                </View>
                <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Lineup Slots List */}
            <Text style={[styles.sectionHeading, { color: colors.text }]}>
              Stage Positions & Ministry Roles
            </Text>

            {detail?.slots?.map((slot) => {
              const isConfirmed = slot.status === 'confirmed';
              const isDeclined = slot.status === 'declined';
              const hasMusician = !!slot.musician;

              return (
                <View
                  key={slot.id}
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
                        name={getRoleIcon(slot.role_name)}
                        size={18}
                        color={isConfirmed ? '#16a34a' : isDeclined ? '#dc2626' : colors.primary}
                      />
                    </View>

                    {/* Volunteer Info */}
                    <View style={styles.slotInfo}>
                      <View style={styles.roleTitleRow}>
                        <Text style={[styles.roleNameText, { color: colors.text }]}>
                          {slot.role_name}
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
                        {hasMusician ? slot.musician.name : 'Open Position (Not filled)'}
                      </Text>

                      {hasMusician && slot.musician.phone ? (
                        <Text style={[styles.volunteerContact, { color: colors.subText }]}>
                          📞 {slot.musician.phone}
                        </Text>
                      ) : null}
                    </View>

                    {/* Swap / Assign Action */}
                    <TouchableOpacity
                      style={[styles.assignBtn, { borderColor: colors.border }]}
                      onPress={() => handleOpenAssignModal(slot)}
                    >
                      <Text style={[styles.assignBtnText, { color: colors.text }]}>
                        {hasMusician ? 'Swap' : '+ Assign'}
                      </Text>
                    </TouchableOpacity>
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
                Service Flow & Run Sheet
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
                  Add songs, prayers, scripture readings, and sermon segments.
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
                    {item.presenter ? (
                      <Text style={[styles.itemPresenter, { color: colors.subText }]}>
                        Lead: {item.presenter}
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
                <Text style={[styles.statBoxNum, { color: '#15803d' }]}>{confirmedCount}</Text>
                <Text style={[styles.statBoxLabel, { color: '#15803d' }]}>Confirmed</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: '#fef3c7', borderColor: '#fde047' }]}>
                <Text style={[styles.statBoxNum, { color: '#b45309' }]}>
                  {totalSlots - confirmedCount}
                </Text>
                <Text style={[styles.statBoxLabel, { color: '#b45309' }]}>Pending</Text>
              </View>
            </View>

            {detail?.slots?.map((slot) => (
              <View
                key={slot.id}
                style={[styles.availRowCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.availAvatar}>
                  <Text style={styles.availAvatarText}>
                    {(slot.musician?.name || 'U').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.availName, { color: colors.text }]}>
                    {slot.musician?.name || 'Open Position'}
                  </Text>
                  <Text style={[styles.availRole, { color: colors.subText }]}>
                    Role: {slot.role_name}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusChip,
                    slot.status === 'confirmed'
                      ? styles.statusConfirmed
                      : slot.status === 'declined'
                      ? styles.statusDeclined
                      : styles.statusPending,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      {
                        color: slot.status === 'confirmed'
                          ? '#15803d'
                          : slot.status === 'declined'
                          ? '#b91c1c'
                          : '#b45309',
                      },
                    ]}
                  >
                    {slot.status === 'confirmed' ? 'Accepted' : slot.status === 'declined' ? 'Declined' : 'No Reply'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* TAB 4: AUDIT LOGS / HISTORY */}
        {activeTab === 'logs' && (
          <View>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>
              Service Audit Trail & Activity
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
                      {log.action || 'Roster modified'}
                    </Text>
                    <Text style={[styles.logDetailsText, { color: colors.subText }]}>
                      {log.details || log.notes}
                    </Text>
                    <Text style={[styles.logTimestamp, { color: colors.subText }]}>
                      {new Date(log.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                Assign {selectedSlot?.role_name}
              </Text>
              <TouchableOpacity onPress={() => setIsAssignModalOpen(false)}>
                <Ionicons name="close" size={22} color={colors.subText} />
              </TouchableOpacity>
            </View>

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
                        {c.primary_instrument || 'Musician'} • {c.serving_status || 'Available'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.subText} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
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
                    <Text style={[styles.candSub, { color: colors.subText }]}>{wl.primary_instrument}</Text>
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
                placeholder="e.g. Song: Way Maker"
                placeholderTextColor={colors.subText}
              />

              <Text style={[styles.inputLabel, { color: colors.subText }]}>Item Type</Text>
              <View style={styles.pillsWrap}>
                {['song', 'sermon', 'welcome', 'prayer', 'announcement'].map((t) => (
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
                placeholder="e.g. Key of G, transition directly into chorus"
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
  shareIconBtn: {
    padding: 8,
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
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  availAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#dc2626',
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
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  candAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#dc2626',
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
});
