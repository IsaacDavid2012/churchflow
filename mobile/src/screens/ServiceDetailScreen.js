import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { api } from '../api/client';

export default function ServiceDetailScreen({ service, onBack, user }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('lineup'); // 'lineup' | 'plan' | 'avail'
  const [shuffling, setShuffling] = useState(false);

  const fetchDetail = async () => {
    try {
      const data = await api.getServiceDetail(service.id);
      setDetail(data);
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
      'Run Fairness Auto-Roster',
      'This will calculate days-since-last-served and assign Primary and Backup slots for all positions.',
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
              Alert.alert('Shuffle Failed', err.message);
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
      Alert.alert('Lineup Confirmed', 'All primary assignments are now confirmed.');
      fetchDetail();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const { service: s, lineup = [], planItems = [], availability = {} } = detail || {};

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {s.service_date}
        </Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Service Header Info */}
      <View style={styles.serviceHeader}>
        <Text style={styles.serviceTitle}>{s.theme || 'Sunday Morning Celebration'}</Text>
        <Text style={styles.serviceMeta}>
          🕒 {s.service_time} • 📍 {s.campus_name || 'Main Sanctuary'}
        </Text>
        <Text style={styles.worshipLeader}>
          🎤 Worship Leader: <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>{s.worship_leader_name || 'TBD'}</Text>
        </Text>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.shuffleBtn]}
            onPress={handleAutoShuffle}
            disabled={shuffling}
          >
            <Text style={styles.actionBtnText}>
              {shuffling ? 'Shuffling...' : '⚡ Auto-Roster'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.confirmBtn]}
            onPress={handleConfirmLineup}
          >
            <Text style={styles.actionBtnText}>✓ Confirm Lineup</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'lineup' && styles.activeTab]}
          onPress={() => setActiveTab('lineup')}
        >
          <Text style={[styles.tabText, activeTab === 'lineup' && styles.activeTabText]}>
            Lineup ({lineup.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'plan' && styles.activeTab]}
          onPress={() => setActiveTab('plan')}
        >
          <Text style={[styles.tabText, activeTab === 'plan' && styles.activeTabText]}>
            Run Sheet ({planItems.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'avail' && styles.activeTab]}
          onPress={() => setActiveTab('avail')}
        >
          <Text style={[styles.tabText, activeTab === 'avail' && styles.activeTabText]}>
            Availability ({availability.available?.length || 0})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {activeTab === 'lineup' && (
          <View>
            {lineup.map((slot) => (
              <View key={slot.positionId} style={styles.slotCard}>
                <View style={styles.slotHeader}>
                  <Text style={styles.positionName}>{slot.positionName}</Text>
                  <Text style={styles.ministryTag}>{slot.ministry}</Text>
                </View>

                {/* Primary */}
                <View style={styles.slotRow}>
                  <Text style={styles.slotRoleLabel}>PRIMARY:</Text>
                  {slot.primary ? (
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{slot.primary.name}</Text>
                      <View style={styles.badgeRow}>
                        <Text style={[styles.statusBadge, getStatusStyle(slot.primary.status)]}>
                          {slot.primary.status}
                        </Text>
                        <Text style={styles.daysServed}>
                          {slot.primary.lastServedDate
                            ? `Last: ${slot.primary.lastServedDate}`
                            : 'Never served before'}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.vacantText}>Vacant (tap auto-roster)</Text>
                  )}
                </View>

                {/* Backup */}
                <View style={[styles.slotRow, { marginTop: 8 }]}>
                  <Text style={styles.slotRoleLabel}>BACKUP:</Text>
                  {slot.backup ? (
                    <View style={styles.memberInfo}>
                      <Text style={styles.backupName}>{slot.backup.name}</Text>
                      <Text style={styles.daysServed}>
                        {slot.backup.lastServedDate
                          ? `Last: ${slot.backup.lastServedDate}`
                          : 'Never served before'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.vacantText}>No backup</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'plan' && (
          <View>
            {planItems.map((item, idx) => (
              <View key={item.id} style={styles.planCard}>
                <View style={styles.planIndexBadge}>
                  <Text style={styles.planIndexText}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planTitle}>{item.title}</Text>
                  <Text style={styles.planMeta}>
                    {item.item_type?.toUpperCase()} • {item.duration_minutes} mins • Leader: {item.leader || 'Team'}
                  </Text>
                  {item.song_title && (
                    <Text style={styles.songTag}>
                      🎵 Key of {item.song_key || 'C'} ({item.song_bpm || 72} BPM)
                    </Text>
                  )}
                  {item.notes ? <Text style={styles.planNotes}>📝 {item.notes}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'avail' && (
          <View>
            <Text style={styles.sectionHeader}>Available ({availability.available?.length || 0})</Text>
            {availability.available?.map((m) => (
              <View key={m.musician_id} style={styles.availRow}>
                <Text style={styles.availName}>✓ {m.name}</Text>
                <Text style={styles.availRoles}>{m.roles?.join(', ')}</Text>
              </View>
            ))}

            <Text style={[styles.sectionHeader, { marginTop: 20 }]}>
              Declined ({availability.declined?.length || 0})
            </Text>
            {availability.declined?.map((m) => (
              <View key={m.musician_id} style={styles.availRow}>
                <Text style={[styles.availName, { color: '#f87171' }]}>✕ {m.name}</Text>
                <Text style={styles.availRoles}>{m.roles?.join(', ')}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function getStatusStyle(status) {
  switch (status) {
    case 'confirmed':
      return { backgroundColor: '#065f46', color: '#34d399' };
    case 'promoted':
      return { backgroundColor: '#4338ca', color: '#a5b4fc' };
    case 'declined':
      return { backgroundColor: '#7f1d1d', color: '#fca5a5' };
    default:
      return { backgroundColor: '#78350f', color: '#fcd34d' };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  backButtonText: {
    color: '#818cf8',
    fontSize: 15,
    fontWeight: 'bold',
  },
  topBarTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  serviceHeader: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  serviceMeta: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
  worshipLeader: {
    fontSize: 13,
    color: '#cbd5e1',
    marginTop: 6,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  shuffleBtn: {
    backgroundColor: '#4f46e5',
  },
  confirmBtn: {
    backgroundColor: '#059669',
  },
  actionBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#6366f1',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#818cf8',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  slotCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  positionName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  ministryTag: {
    color: '#94a3b8',
    fontSize: 11,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  slotRoleLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 'bold',
    width: 65,
    marginTop: 2,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  backupName: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  daysServed: {
    fontSize: 11,
    color: '#64748b',
  },
  vacantText: {
    color: '#ef4444',
    fontSize: 13,
    fontStyle: 'italic',
  },
  planCard: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    gap: 12,
  },
  planIndexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  planIndexText: {
    color: '#f8fafc',
    fontWeight: 'bold',
    fontSize: 12,
  },
  planTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  planMeta: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  songTag: {
    color: '#818cf8',
    fontSize: 12,
    marginTop: 4,
  },
  planNotes: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 4,
  },
  sectionHeader: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  availRow: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 6,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  availName: {
    color: '#34d399',
    fontWeight: '600',
    fontSize: 13,
  },
  availRoles: {
    color: '#94a3b8',
    fontSize: 12,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
});
