import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, SafeAreaView, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from './src/api/client';
import { registerForPushNotificationsAsync } from './src/services/fcm';
import LoginScreen from './src/screens/LoginScreen';
import ServicesScreen from './src/screens/ServicesScreen';
import ServiceDetailScreen from './src/screens/ServiceDetailScreen';
import PublicConfirmScreen from './src/screens/PublicConfirmScreen';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [publicToken, setPublicToken] = useState(null);

  useEffect(() => {
    // 1. Initialize API client & Auth state
    const initApp = async () => {
      try {
        await api.init();
        const storedUser = await AsyncStorage.getItem('servesync_user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
          registerForPushNotificationsAsync();
        }
      } catch (err) {
        console.error('App init error:', err);
      } finally {
        setLoading(false);
      }
    };

    initApp();

    // 2. Handle Deep Linking for zero-login confirmation links (e.g. servesync://avail/token or https://servesync.creativeclicks.art/avail/token)
    const handleDeepLink = (event) => {
      const data = Linking.parse(event.url);
      if (data.path && data.path.includes('avail')) {
        const parts = data.path.split('/');
        const token = parts[parts.length - 1];
        if (token) {
          setPublicToken(token);
        }
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    await api.clearTokens();
    setUser(null);
    setSelectedService(null);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Zero-login Deep link Confirmation Screen */}
      {publicToken ? (
        <PublicConfirmScreen token={publicToken} onDone={() => setPublicToken(null)} />
      ) : !user ? (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      ) : selectedService ? (
        <ServiceDetailScreen
          service={selectedService}
          user={user}
          onBack={() => setSelectedService(null)}
        />
      ) : (
        <ServicesScreen
          user={user}
          onSelectService={(s) => setSelectedService(s)}
          onLogout={handleLogout}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  center: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
