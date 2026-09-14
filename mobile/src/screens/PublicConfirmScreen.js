import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { api } from '../api/client';

export default function PublicConfirmScreen({ token, onDone }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMusician, setSelectedMusician] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedStatus, setSubmittedStatus] = useState(null);

  const fetchServiceData = async () => {
    try {
      const res = await api.getPublicService(token);
      setData(res);
      if (res.musicians && res.musicians.length === 1) {
        setSelectedMusician(res.musicians[0]);
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Invalid or expired service link');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchServiceData();
  }, [token]);

  const handleRespond = async (status) => {
    if (!selectedMusician) {
      Alert.alert('Select Your Name', 'Please select your name from the roster list first.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.submitPublicAvailability(token, selectedMusician.id, status);
      setSubmittedStatus(status);
      Alert.alert('Response Recorded', res.message || `You have marked: ${status}`);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!data || !data.service) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Invalid or expired service link.</Text>
        <TouchableOpacity style={styles.btnSecondary} onPress={onDone}>
          <Text style={styles.btnSecondaryText}>Go to App</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { service, church, assignments = [] } = data;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.churchBanner}>
        <Text style={styles.churchName}>{church?.name || 'Jesus My Rock Church'}</Text>
        <Text style={styles.churchTagline}>{church?.tagline || 'Standing Firm on Christ the Solid Rock'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.serviceDate}>{service.service_date} • {service.service_time}</Text>
        <Text style={styles.serviceTheme}>{service.theme || 'Sunday Service'}</Text>
        <Text style={styles.serviceMeta}>📍 {service.campus_name || 'Main Sanctuary'}</Text>

        {submittedStatus ? (
          <View style={styles.submittedBox}>
            <Text style={styles.submittedEmoji}>
              {submittedStatus === 'available' ? '✅' : '❌'}
            </Text>
            <Text style={styles.submittedTitle}>
              {submittedStatus === 'available' ? 'Availability Confirmed!' : 'Declined'}
            </Text>
            <Text style={styles.submittedSub}>
              Thank you for keeping our team schedule accurate.
            </Text>
            <TouchableOpacity style={styles.btnSecondary} onPress={onDone}>
              <Text style={styles.btnSecondaryText}>Back to App</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.stepTitle}>1. Select Your Name</Text>
            <View style={styles.musicianList}>
              {data.musicians?.map((m) => {
                const isSelected = selectedMusician?.id === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.musicianItem, isSelected && styles.musicianItemSelected]}
                    onPress={() => setSelectedMusician(m)}
                  >
                    <Text style={[styles.musicianName, isSelected && styles.musicianNameSelected]}>
                      {m.name}
                    </Text>
                    <Text style={styles.musicianRoles}>{m.roles?.join(', ')}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.stepTitle, { marginTop: 20 }]}>2. Confirm Your Availability</Text>
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.respondBtn, styles.btnAvailable, submitting && styles.btnDisabled]}
                onPress={() => handleRespond('available')}
                disabled={submitting}
              >
                <Text style={styles.respondBtnText}>✓ Available / Accept</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.respondBtn, styles.btnDecline, submitting && styles.btnDisabled]}
                onPress={() => handleRespond('declined')}
                disabled={submitting}
              >
                <Text style={styles.respondBtnText}>✕ Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 20,
    paddingTop: 50,
  },
  churchBanner: {
    alignItems: 'center',
    marginBottom: 20,
  },
  churchName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#818cf8',
  },
  churchTagline: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  serviceDate: {
    color: '#818cf8',
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  serviceTheme: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  serviceMeta: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
  },
  stepTitle: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  musicianList: {
    maxHeight: 200,
  },
  musicianItem: {
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  musicianItemSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#312e81',
  },
  musicianName: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
  },
  musicianNameSelected: {
    color: '#a5b4fc',
  },
  musicianRoles: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  respondBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnAvailable: {
    backgroundColor: '#059669',
  },
  btnDecline: {
    backgroundColor: '#dc2626',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  respondBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  submittedBox: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  submittedEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  submittedTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  submittedSub: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  btnSecondary: {
    backgroundColor: '#334155',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnSecondaryText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    marginBottom: 16,
  },
});
