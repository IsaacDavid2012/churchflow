import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { api } from '../api/client';
import { registerForPushNotificationsAsync } from '../services/fcm';

export default function LoginScreen({ onLoginSuccess, isDark = false }) {
  const [username, setUsername] = useState('Isaac');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (customUser, customPass) => {
    const u = customUser || username;
    const p = customPass || password;

    if (!u || !p) {
      Alert.alert('Sign In', 'Please enter your username and password');
      return;
    }

    setLoading(true);
    try {
      const data = await api.login(u, p);
      registerForPushNotificationsAsync();
      onLoginSuccess(data.user);
    } catch (err) {
      Alert.alert('Sign In Failed', err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  const fillAdmin = () => {
    setUsername('Isaac');
  };

  const bg = isDark ? '#020617' : '#f8fafc';
  const cardBg = isDark ? '#0f172a' : '#ffffff';
  const border = isDark ? '#1e293b' : '#e2e8f0';
  const textPrimary = isDark ? '#ffffff' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? '#1e293b' : '#f1f5f9';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: bg }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          {/* Red Accent Top Bar */}
          <View style={styles.topAccentBar} />

          {/* Logo & Header */}
          <View style={styles.header}>
            <View style={[styles.logoContainer, { backgroundColor: isDark ? '#1e293b' : '#fef2f2' }]}>
              <Text style={styles.logoIcon}>⚡</Text>
            </View>
            <Text style={[styles.title, { color: textPrimary }]}>ChurchFlow</Text>
            <Text style={[styles.subtitle, { color: textSecondary }]}>
              Worship Team Rostering & Planning
            </Text>
            <View style={styles.churchBadge}>
              <Text style={styles.churchBadgeText}>Jesus My Rock Church</Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={[styles.label, { color: textPrimary }]}>USERNAME</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
              placeholder="e.g. Isaac"
              placeholderTextColor="#94a3b8"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />

            <Text style={[styles.label, { color: textPrimary, marginTop: 14 }]}>PASSWORD</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={() => handleLogin()}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Sign In to Dashboard</Text>
              )}
            </TouchableOpacity>

            {/* Quick Admin Button */}
            <TouchableOpacity
              style={[styles.adminQuickBtn, { borderColor: border, backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
              onPress={fillAdmin}
            >
              <Text style={styles.adminQuickText}>🛡️ Admin Sign In (Isaac)</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.footerText, { color: textSecondary }]}>
          Built by Creative Clicks Studios • creativeclicks.art
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  topAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#dc2626',
  },
  header: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  logoContainer: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoIcon: {
    fontSize: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  churchBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 20,
  },
  churchBadgeText: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '700',
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  button: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  adminQuickBtn: {
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  adminQuickText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 11,
    marginTop: 24,
    fontWeight: '500',
  },
});
