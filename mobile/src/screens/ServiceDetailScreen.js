import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import { api } from '../api/client';

export default function ServiceDetailScreen({ service, onBack, user, isDark = false }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('lineup'); // 'lineup' | 'plan' | 'avail' | 'audit'
  const [shuffling, setShuffling] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Modals
  const [isWlModalOpen, setIsWlModalOpen] = useState(false);
  const [musicians, setMusicians] = useState([]);
  const [selectedLeaderId, setSelectedLeaderId] = useState('');

  // Add Plan Item Modal
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planTitle, setPlanTitle] = useState('');
  const [planDuration, setPlanDuration] = useState('5');
  const [planLeader, setPlanLeader] = useState('');
  const [planKey, setPlanKey] = useState('C');
  const [planNotes, setPlanNotes] = useState('');

  // Override Modal
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [candidates, setCandidates] = useState([]);

  const fetchDetail = async () => {
    try {
      const [data, notifs, musList] = await Promise.all([
        api.getServiceDetail(service.id),
        api.getNotifications({ limit: 20 }).catch(() => []),
        api.getMusicians({ active: 'true' }).catch(() => []),
      ]);
      setDetail(data);
      setNotifications(notifs || []);
      setMusicians(musList || []);
      if (data?.service?.worship_leader_id) {
        setSelectedLeaderId(data.service.worship_leader_id);
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to load service detail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [service.id]);

  const handleAutoShuffle = async () => {
    Alert.alert(
      'Fairness Auto-Roster',
      'Run 100% conflict-free fairness algorithm. Never-served volunteers are prioritized.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Auto-Roster Now',
          onPress: async () => {
            setShuffling(true);
            try {
              const res = await api.autoShuffle(service.id, 'auto');
              Alert.alert('Success', res.message || 'Lineup generated successfully');
              fetchDetail();
            } catch (err) {
              Alert.alert('Roster Failed', err.message);
            } finally {
              setShuffling(false);
            }
          },
        },
      ]
    );
  };

  const handleConfirmLineup = async () => {
    try {
      await api.confirmLineup(service.id);
      Alert.alert('Lineup Confirmed', 'All primary assignments are locked in.');
      fetchDetail();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  // Simulate volunteer decline & test auto-promotion
  const handleSimulateDecline = async (slot) => {
    if (!slot.primary?.musicianId) return;
    try {
      await api.submitPublicAvailability(service.token, slot.primary.musicianId, 'declined');
      Alert.alert(
        'Decline Processed',
        `${slot.primary.name} declined. Backup volunteer was instantly auto-promoted!`
      );
      fetchDetail();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  // Save Worship Leader
  const handleSaveWorshipLeader = async () => {
    try {
      await api.setWorshipLeader(service.id, selectedLeaderId || null);
      setIsWlModalOpen(false);
      fetchDetail();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  // Open Override Modal
  const handleOpenOverride = async (slot) => {
    setSelectedSlot(slot);
    try {
      const data = await api.getCandidates(service.id, slot.positionId);
      setCandidates(data.candidates || []);
      setIsOverrideModalOpen(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to load candidates');
    }
  };

  const handleApplyOverride = async (musicianId) => {
    if (!selectedSlot) return;
    try {
      await api.manualOverride(service.id, selectedSlot.positionId, 'primary', musicianId);
      setIsOverrideModalOpen(false);
      fetchDetail();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  // Add Plan Item
  const handleAddPlanItem = async () => {
    if (!planTitle.trim()) {
      Alert.alert('Required', 'Item title is required');
      return;
    }
    try {
      await api.addPlanItem(service.id, {
        item_type: 'song',
        title: planTitle,
        duration_minutes: parseInt(planDuration, 10) || 5,
        leader: planLeader,
        song_key: planKey,
        notes: planNotes,
      });
      setIsPlanModalOpen(false);
      setPlanTitle('');
      fetchDetail();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  // WhatsApp Share
  const handleShareWhatsApp = () => {
    const s = detail?.service || service;
    const url = `https://serve.creativeclicks.art/avail/${s.token}`;
    const text = `🎸 *ChurchFlow — Jesus My Rock Church*\n📅 *${s.service_date}* • ${s.service_time}\n📖 Theme: ${s.theme || 'Sunday Service'}\n\n👉 *Tap to confirm availability:*\n${url}`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`).catch(() => {
      Alert.alert('WhatsApp Link', `Share link:\n${url}`);
    });
  };

  const bg = isDark ? '#020617' : '#f8fafc';
  const cardBg = isDark ? '#0f172a' : '#ffffff';
  const border = isDark ? '#1e293b' : '#e2e8f0';
  const textPrimary = isDark ? '#ffffff' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? '#1e293b' : '#f1f5f9';

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  const { service: s = service, lineup = [], planItems = [], availability = {} } = detail || {};
  const serviceNotifs = notifications.filter(
    (n) => n.service_id === s.id || (n.service_date && n.service_date === s.service_date)
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Top Bar */}
      <View style={[styles.topBar, { backgroundColor: cardBg, borderBottomColor: border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Services</Text>
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: textPrimary }]} numberOfLines={1}>
          {s.service_date}
        </Text>
        <TouchableOpacity onPress={handleShareWhatsApp} style={styles.shareIconBtn}>
          <Text style={styles.shareIconText}>🔗 Share</Text>
        </TouchableOpacity>
      </View>

      {/* Main Service Info Header Card */}
      <View style={[styles.serviceHeader, { backgroundColor: cardBg, borderBottomColor: border }]}>
        <Text style={[styles.serviceTheme, { color: textPrimary }]}>
          {s.theme || 'Sunday Morning Celebration'}
        </Text>
        <Text style={[styles.serviceMeta, { color: textSecondary }]}>
          🕒 {s.service_time} • 📍 {s.campus_name || 'Main Sanctuary'}
        </Text>

        <View style={styles.wlRow}>
          <Text style={[styles.wlLabel, { color: textSecondary }]}>
            🎤 Leader: <Text style={{ color: textPrimary, fontWeight: '800' }}>{s.worship_leader_name || 'Unassigned'}</Text>
          </Text>
          <TouchableOpacity
            style={[styles.wlPickBtn, { backgroundColor: isDark ? '#1e293b' : '#fef2f2' }]}
            onPress={() => setIsWlModalOpen(true)}
          >
            <Text style={styles.wlPickText}>Change</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.shuffleBtn]}
            onPress={handleAutoShuffle}
            disabled={shuffling}
          >
            <Text style={styles.actionBtnText}>{shuffling ? 'Shuffling...' : '⚡ Auto-Roster'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.confirmBtn]}
            onPress={handleConfirmLineup}
          >
            <Text style={styles.actionBtnText}>✓ Confirm</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.shareBtn]}
            onPress={handleShareWhatsApp}
          >
            <Text style={styles.actionBtnText}>💬 WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabContainer, { backgroundColor: cardBg, borderBottomColor: border }]}>
        {[
          { id: 'lineup', label: `Roster (${lineup.length})` },
          { id: 'plan', label: `Run Sheet (${planItems.length})` },
          { id: 'avail', label: `Availability (${availability.available?.length || 0})` },
          { id: 'audit', label: `Audit Trail` },
        ].map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, activeTab === t.id && styles.activeTab]}
            onPress={() => setActiveTab(t.id)}
          >
            <Text
              style={[
                styles.tabText,
                { color: textSecondary },
                activeTab === t.id && styles.activeTabText,
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Contents */}
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 50 }}>
        {/* TAB 1: Roster */}
        {activeTab === 'lineup' && (
          <View>
            <View style={styles.tabHeaderRow}>
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>Stage Lineup & Positions</Text>
              <Text style={[styles.sectionSub, { color: textSecondary }]}>
                {lineup.filter((s) => s.primary).length}/{lineup.length} Slots Filled
              </Text>
            </View>

            {lineup.map((slot) => {
              const hasPrimary = !!slot.primary;
              const hasBackup = !!slot.backup;
              return (
                <View
                  key={slot.positionId}
                  style={[styles.slotCard, { backgroundColor: cardBg, borderColor: border }]}
                >
                  <View style={styles.slotHeader}>
                    <Text style={[styles.positionTitle, { color: textPrimary }]}>{slot.positionName}</Text>
                    <TouchableOpacity
                      style={styles.changeSlotBtn}
                      onPress={() => handleOpenOverride(slot)}
                    >
                      <Text style={styles.changeSlotText}>Assign</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Primary Row */}
                  <View style={styles.assignmentBlock}>
                    <View style={styles.avatarInitial}>
                      <Text style={styles.avatarText}>
                        {slot.primary?.name ? slot.primary.name[0] : '?'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowBetween}>
                        <Text style={[styles.assigneeName, { color: textPrimary }]}>
                          {slot.primary?.name || 'Vacant Slot'}
                        </Text>
                        <Text
                          style={[
                            styles.slotRoleTag,
                            hasPrimary ? styles.tagConfirmed : styles.tagVacant,
                          ]}
                        >
                          {slot.primary?.status || 'VACANT'}
                        </Text>
                      </View>
                      <Text style={[styles.serveHistory, { color: textSecondary }]}>
                        {slot.primary?.lastServedDate
                          ? `Last served: ${slot.primary.lastServedDate}`
                          : '⚡ Never served (Highest priority)'}
                      </Text>
                    </View>
                  </View>

                  {/* Backup / Decline actions */}
                  <View style={[styles.slotActionsRow, { borderTopColor: border }]}>
                    <Text style={[styles.backupText, { color: textSecondary }]}>
                      Backup: <Text style={{ color: textPrimary, fontWeight: '600' }}>{slot.backup?.name || 'Auto-fallback'}</Text>
                    </Text>

                    {hasPrimary && (
                      <TouchableOpacity
                        style={styles.declineSimBtn}
                        onPress={() => handleSimulateDecline(slot)}
                      >
                        <Text style={styles.declineSimText}>✕ Simulate Decline</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* TAB 2: Order of Service Plan */}
        {activeTab === 'plan' && (
          <View>
            <View style={styles.tabHeaderRow}>
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>Order of Service Run Sheet</Text>
              <TouchableOpacity
                style={styles.addItemBtn}
                onPress={() => setIsPlanModalOpen(true)}
              >
                <Text style={styles.addItemBtnText}>+ Add Item</Text>
              </TouchableOpacity>
            </View>

            {planItems.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border }]}>
                <Text style={[styles.emptySub, { color: textSecondary }]}>
                  No items in run sheet yet. Tap "+ Add Item" above.
                </Text>
              </View>
            ) : (
              planItems.map((item, idx) => (
                <View
                  key={item.id}
                  style={[styles.planCard, { backgroundColor: cardBg, borderColor: border }]}
                >
                  <View style={styles.planNumBadge}>
                    <Text style={styles.planNumText}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowBetween}>
                      <Text style={[styles.planItemTitle, { color: textPrimary }]}>{item.title}</Text>
                      <Text style={styles.planDuration}>{item.duration_minutes} min</Text>
                    </View>
                    <View style={styles.planBadgeRow}>
                      <Text style={styles.planCategoryTag}>{item.item_type?.toUpperCase()}</Text>
                      {item.song_key && (
                        <Text style={styles.planKeyTag}>Key: {item.song_key}</Text>
                      )}
                      {item.leader && (
                        <Text style={[styles.planLeaderText, { color: textSecondary }]}>
                          Leader: {item.leader}
                        </Text>
                      )}
                    </View>
                    {item.notes ? (
                      <Text style={[styles.planNotesText, { color: textSecondary }]}>
                        "{item.notes}"
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* TAB 3: Availability */}
        {activeTab === 'avail' && (
          <View>
            <Text style={[styles.sectionTitle, { color: textPrimary, marginBottom: 12 }]}>
              Team Availability Responses
            </Text>

            <View style={[styles.availCard, { backgroundColor: cardBg, borderColor: border }]}>
              <Text style={styles.availSectionHeader}>✓ AVAILABLE ({availability.available?.length || 0})</Text>
              {availability.available?.map((m) => (
                <View key={m.musician_id} style={[styles.availItem, { borderBottomColor: border }]}>
                  <Text style={[styles.availPersonName, { color: textPrimary }]}>{m.name}</Text>
                  <Text style={[styles.availRolesTag, { color: textSecondary }]}>
                    {m.roles?.join(', ')}
                  </Text>
                </View>
              ))}
            </View>

            <View style={[styles.availCard, { backgroundColor: cardBg, borderColor: border, marginTop: 14 }]}>
              <Text style={[styles.availSectionHeader, { color: '#dc2626' }]}>
                ✕ DECLINED ({availability.declined?.length || 0})
              </Text>
              {availability.declined?.map((m) => (
                <View key={m.musician_id} style={[styles.availItem, { borderBottomColor: border }]}>
                  <Text style={[styles.availPersonName, { color: textPrimary }]}>{m.name}</Text>
                  <Text style={[styles.availRolesTag, { color: textSecondary }]}>
                    Auto-promoted backup
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* TAB 4: Audit Logs */}
        {activeTab === 'audit' && (
          <View>
            <Text style={[styles.sectionTitle, { color: textPrimary, marginBottom: 12 }]}>
              Audit Trail & Event Feed
            </Text>
            {serviceNotifs.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border }]}>
                <Text style={[styles.emptySub, { color: textSecondary }]}>
                  No events logged for this service yet.
                </Text>
              </View>
            ) : (
              serviceNotifs.map((n) => (
                <View
                  key={n.id}
                  style={[styles.auditCard, { backgroundColor: cardBg, borderColor: border }]}
                >
                  <View style={styles.rowBetween}>
                    <Text style={styles.auditTypeTag}>{n.type?.toUpperCase()}</Text>
                    <Text style={[styles.auditTime, { color: textSecondary }]}>
                      {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={[styles.auditMsg, { color: textPrimary }]}>{n.message}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Worship Leader Picker Modal */}
      <Modal visible={isWlModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: border }]}>
              <Text style={[styles.modalTitle, { color: textPrimary }]}>Pick Worship Leader</Text>
              <TouchableOpacity onPress={() => setIsWlModalOpen(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {musicians.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.candidateRow,
                    { borderBottomColor: border },
                    selectedLeaderId === m.id && styles.candidateRowSelected,
                  ]}
                  onPress={() => setSelectedLeaderId(m.id)}
                >
                  <Text style={[styles.candidateName, { color: textPrimary }]}>{m.name}</Text>
                  <Text style={[styles.candidateRoles, { color: textSecondary }]}>
                    {m.roles?.join(', ')}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSaveWorshipLeader}
              >
                <Text style={styles.submitBtnText}>Save Worship Leader</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Override Slot Modal */}
      <Modal visible={isOverrideModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: border }]}>
              <Text style={[styles.modalTitle, { color: textPrimary }]}>
                Assign: {selectedSlot?.positionName}
              </Text>
              <TouchableOpacity onPress={() => setIsOverrideModalOpen(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {candidates.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.candidateRow, { borderBottomColor: border }]}
                  onPress={() => handleApplyOverride(c.id)}
                >
                  <View>
                    <Text style={[styles.candidateName, { color: textPrimary }]}>{c.name}</Text>
                    <Text style={[styles.candidateRoles, { color: textSecondary }]}>
                      {c.availability_status ? `Status: ${c.availability_status}` : 'Qualified volunteer'}
                    </Text>
                  </View>
                  <Text style={styles.assignActionText}>Assign →</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Plan Item Modal */}
      <Modal visible={isPlanModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: border }]}>
              <Text style={[styles.modalTitle, { color: textPrimary }]}>Add Order of Service Item</Text>
              <TouchableOpacity onPress={() => setIsPlanModalOpen(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={[styles.formLabel, { color: textPrimary }]}>TITLE / SONG NAME *</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                value={planTitle}
                onChangeText={setPlanTitle}
                placeholder="e.g. Firm Foundation (He Won't)"
                placeholderTextColor="#94a3b8"
              />

              <Text style={[styles.formLabel, { color: textPrimary }]}>DURATION (MINUTES)</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                value={planDuration}
                onChangeText={setPlanDuration}
                keyboardType="numeric"
              />

              <Text style={[styles.formLabel, { color: textPrimary }]}>LEADER / SPEAKER</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                value={planLeader}
                onChangeText={setPlanLeader}
                placeholder="e.g. Marcus Reed"
                placeholderTextColor="#94a3b8"
              />

              <Text style={[styles.formLabel, { color: textPrimary }]}>KEY</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                value={planKey}
                onChangeText={setPlanKey}
                placeholder="e.g. Bb or G"
                placeholderTextColor="#94a3b8"
              />

              <TouchableOpacity style={styles.submitBtn} onPress={handleAddPlanItem}>
                <Text style={styles.submitBtnText}>Add to Run Sheet</Text>
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
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '800',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  shareIconBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#dcfce7',
    borderRadius: 8,
  },
  shareIconText: {
    color: '#16a34a',
    fontSize: 11,
    fontWeight: '800',
  },
  serviceHeader: {
    padding: 16,
    borderBottomWidth: 1,
  },
  serviceTheme: {
    fontSize: 18,
    fontWeight: '900',
  },
  serviceMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  wlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 6,
  },
  wlLabel: {
    fontSize: 12,
  },
  wlPickBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  wlPickText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  shuffleBtn: {
    backgroundColor: '#dc2626',
  },
  confirmBtn: {
    backgroundColor: '#16a34a',
  },
  shareBtn: {
    backgroundColor: '#059669',
  },
  actionBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 11,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#dc2626',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
  },
  activeTabText: {
    color: '#dc2626',
    fontWeight: '900',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  tabHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  sectionSub: {
    fontSize: 11,
    fontWeight: '600',
  },
  slotCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  positionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  changeSlotBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
  },
  changeSlotText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  assignmentBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarInitial: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#dc2626',
    fontWeight: '900',
    fontSize: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assigneeName: {
    fontSize: 14,
    fontWeight: '800',
  },
  slotRoleTag: {
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagConfirmed: {
    backgroundColor: '#dcfce7',
    color: '#16a34a',
  },
  tagVacant: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
  },
  serveHistory: {
    fontSize: 11,
    marginTop: 2,
  },
  slotActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 8,
  },
  backupText: {
    fontSize: 11,
  },
  declineSimBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 6,
  },
  declineSimText: {
    color: '#dc2626',
    fontSize: 10,
    fontWeight: '800',
  },
  addItemBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  addItemBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 10,
  },
  planNumBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planNumText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 11,
  },
  planItemTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  planDuration: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
  },
  planBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  planCategoryTag: {
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    color: '#475569',
  },
  planKeyTag: {
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    borderRadius: 4,
  },
  planLeaderText: {
    fontSize: 11,
  },
  planNotesText: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },
  availCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  availSectionHeader: {
    fontSize: 12,
    fontWeight: '900',
    color: '#16a34a',
    marginBottom: 8,
  },
  availItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  availPersonName: {
    fontSize: 13,
    fontWeight: '700',
  },
  availRolesTag: {
    fontSize: 11,
  },
  auditCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  auditTypeTag: {
    fontSize: 9,
    fontWeight: '900',
    color: '#dc2626',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  auditTime: {
    fontSize: 10,
  },
  auditMsg: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptySub: {
    fontSize: 12,
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
    maxHeight: '80%',
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
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
    padding: 16,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  submitBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  candidateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  candidateRowSelected: {
    backgroundColor: '#fee2e2',
  },
  candidateName: {
    fontSize: 13,
    fontWeight: '800',
  },
  candidateRoles: {
    fontSize: 11,
    marginTop: 2,
  },
  assignActionText: {
    color: '#dc2626',
    fontWeight: '800',
    fontSize: 12,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
