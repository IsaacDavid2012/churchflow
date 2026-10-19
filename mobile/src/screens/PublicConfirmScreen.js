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
        <ActivityIndicator size="large" color="#c59c6c" />
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
    backgroundColor: '#ffffff',
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
    color: '#c59c6c',
  },
  churchTagline: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#eadbc4',
    shadowColor: '#c59c6c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  serviceDate: {
    color: '#9e7343',
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  serviceTheme: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  serviceMeta: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
  },
  stepTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  musicianList: {
    maxHeight: 200,
  },
  musicianItem: {
    backgroundColor: '#fbf8f3',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eadbc4',
  },
  musicianItemSelected: {
    borderColor: '#c59c6c',
    backgroundColor: '#f5ede1',
  },
  musicianName: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '600',
  },
  musicianNameSelected: {
    color: '#9e7343',
    fontWeight: '700',
  },
  musicianRoles: {
    color: '#64748b',
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
    borderRadius: 10,
    alignItems: 'center',
  },
  btnAvailable: {
    backgroundColor: '#16a34a',
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
    color: '#0f172a',
    fontSize: 18,
    fontWeight: 'bold',
  },
  submittedSub: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  btnSecondary: {
    backgroundColor: '#c59c6c',
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
    backgroundColor: '#ffffff',
    padding: 20,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 16,
    marginBottom: 16,
  },
});
