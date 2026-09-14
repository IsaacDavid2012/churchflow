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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { registerForPushNotificationsAsync } from '../services/fcm';

export default function LoginScreen({ onLoginSuccess, isDark = false }) {
  const [username, setUsername] = useState('Isaac');
  const [password, setPassword] = useState('IDC-201Two');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (customUser, customPass) => {
    const u = customUser !== undefined ? customUser : username;
    const p = customPass !== undefined ? customPass : password;

    if (!u.trim() || !p.trim()) {
      Alert.alert('Sign In', 'Please enter your username and password.');
      return;
    }

    setLoading(true);
    try {
      const data = await api.login(u.trim(), p.trim());
      registerForPushNotificationsAsync();
      onLoginSuccess(data.user);
    } catch (err) {
      Alert.alert('Sign In Failed', err.message || 'Invalid username or password. Please verify credentials.');
    } finally {
      setLoading(false);
    }
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
          <View style={styles.topAccentBar} />

          {/* Logo & Header */}
          <View style={styles.header}>
            <View style={[styles.logoContainer, { backgroundColor: isDark ? '#1e293b' : '#fee2e2' }]}>
              <Ionicons name="flash" size={28} color="#dc2626" />
            </View>
            <Text style={[styles.title, { color: textPrimary }]}>ChurchFlow</Text>
            <Text style={[styles.subtitle, { color: textSecondary }]}>
              Worship Team Rostering & Service Planning
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

            <TouchableOpacity
              style={[styles.adminQuickBtn, { borderColor: border, backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
              onPress={() => handleLogin('Isaac', 'IDC-201Two')}
            >
              <Text style={styles.adminQuickText}>🛡️ Quick Admin Sign In (Isaac)</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity onPress={() => Linking.openURL('https://creativeclicks.art')}>
          <Text style={[styles.footerText, { color: textSecondary }]}>
            Built by <Text style={{ color: '#dc2626', fontWeight: '700' }}>Creative Clicks Studios</Text>
          </Text>
        </TouchableOpacity>
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
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
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
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
    marginTop: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  button: {
    backgroundColor: '#dc2626',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#dc2626',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
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
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  adminQuickText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#dc2626',
  },
  footerText: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 12,
  },
});
