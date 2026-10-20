import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { api } from '../api/client';

export default function PublicConfirmScreen({ token, onDone }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMusician, setSelectedMusician] = useState(null);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pin, setPin] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [claimToken, setClaimToken] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedStatus, setSubmittedStatus] = useState(null);

  const fetchServiceData = async () => {
    try {
      const res = await api.getPublicService(token);
      setData(res);
    } catch (err) {
      Alert.alert('Error', err.message || 'Invalid or expired service link');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchServiceData();
  }, [token]);

  const handleSelectMusician = (m) => {
    if (claimToken && selectedMusician?.id === m.id) {
      // Already verified for this person
      return;
    }

    Alert.alert(
      'Confirm Identity',
      `You selected ${m.name}. Once confirmed, this phone will be linked to ${m.name} for this service.\n\nIs this you?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, this is me',
          onPress: () => {
            setSelectedMusician(m);
            if (m.has_phone === false) {
              Alert.alert(
                'Phone Not Registered',
                'You are not registered with a mobile number. Please contact your church administrator or leader to register your phone.'
              );
            } else {
              setPin('');
              setPinModalVisible(true);
            }
          },
        },
      ]
    );
  };

  const handleVerifyPin = async () => {
    if (!pin || pin.trim().length < 4) {
      Alert.alert('Invalid PIN', 'Please enter the 4-digit PIN (last 4 digits of your phone).');
      return;
    }

    setVerifyingPin(true);
    try {
      const res = await api.verifyPublicPin(token, selectedMusician.id, pin.trim());
      setClaimToken(res.claim_token);
      setPinModalVisible(false);
      Alert.alert('Verified!', `Welcome, ${selectedMusician.name}. Please select your availability below.`);
    } catch (err) {
      Alert.alert('Verification Failed', err.message || 'Incorrect PIN. Enter the last 4 digits of your phone.');
    } finally {
      setVerifyingPin(false);
    }
  };

  const handleRespond = async (status) => {
    if (!selectedMusician) {
      Alert.alert('Select Your Name', 'Please select your name from the roster list first.');
      return;
    }

    if (!claimToken) {
      setPinModalVisible(true);
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.submitPublicAvailability(token, selectedMusician.id, status, claimToken);
      setSubmittedStatus(status);
      Alert.alert('Response Recorded', res.message || `You have marked: ${status === 'available' ? 'Serving' : 'Declined'}`);
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

  const { service, church } = data;

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
              Thank you {selectedMusician?.name} for keeping our team schedule accurate.
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
                const isLockedOther = claimToken && selectedMusician && selectedMusician.id !== m.id;

                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.musicianItem,
                      isSelected && styles.musicianItemSelected,
                      isLockedOther && styles.musicianItemLocked,
                    ]}
                    onPress={() => handleSelectMusician(m)}
                    disabled={isLockedOther}
                  >
                    <View style={styles.musicianRow}>
                      <Text style={[styles.musicianName, isSelected && styles.musicianNameSelected]}>
                        {m.name} {isSelected && claimToken ? ' (YOU)' : ''}
                      </Text>
                      {isLockedOther && <Text style={styles.lockedBadge}>🔒 Locked</Text>}
                    </View>
                    <Text style={styles.musicianRoles}>{m.roles?.join(', ')}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {claimToken && (
              <View style={{ marginTop: 22 }}>
                <Text style={styles.stepTitle}>2. Confirm Your Availability ({selectedMusician?.name})</Text>
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[styles.respondBtn, styles.btnAvailable, submitting && styles.btnDisabled]}
                    onPress={() => handleRespond('available')}
                    disabled={submitting}
                  >
                    <Text style={styles.respondBtnText}>✓ Available / Serving</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.respondBtn, styles.btnDecline, submitting && styles.btnDisabled]}
                    onPress={() => handleRespond('declined')}
                    disabled={submitting}
                  >
                    <Text style={styles.respondBtnText}>✕ Can't Make It</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {/* PIN Verification Modal */}
      <Modal visible={pinModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🔒 Enter 4-Digit PIN</Text>
            <Text style={styles.modalSub}>
              Enter the last 4 digits of your mobile number to verify as {selectedMusician?.name}:
            </Text>

            <TextInput
              style={styles.pinInput}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              placeholder="••••"
              value={pin}
              onChangeText={setPin}
              autoFocus
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setPinModalVisible(false)}
                disabled={verifyingPin}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalBtnSubmit}
                onPress={handleVerifyPin}
                disabled={verifyingPin}
              >
                {verifyingPin ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalBtnSubmitText}>Verify PIN</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  musicianItemLocked: {
    opacity: 0.5,
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  musicianRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lockedBadge: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eadbc4',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  modalSub: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  pinInput: {
    width: 160,
    height: 50,
    borderWidth: 2,
    borderColor: '#c59c6c',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 8,
    backgroundColor: '#fbf8f3',
    color: '#0f172a',
    marginBottom: 20,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnCancelText: {
    color: '#475569',
    fontWeight: 'bold',
    fontSize: 13,
  },
  modalBtnSubmit: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#c59c6c',
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnSubmitText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
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
