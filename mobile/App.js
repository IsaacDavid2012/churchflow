import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar as RNStatusBar,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from './src/api/client';
import { registerForPushNotificationsAsync } from './src/services/fcm';
import LoginScreen from './src/screens/LoginScreen';
import ServicesScreen from './src/screens/ServicesScreen';
import ServiceDetailScreen from './src/screens/ServiceDetailScreen';
import PeopleScreen from './src/screens/PeopleScreen';
import SongsScreen from './src/screens/SongsScreen';
import GroupsScreen from './src/screens/GroupsScreen';
import ChurchScreen from './src/screens/ChurchScreen';
import PublicConfirmScreen from './src/screens/PublicConfirmScreen';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isDark, setIsDark] = useState(false); // Default to clean light mode
  const [activeTab, setActiveTab] = useState('services'); // 'services' | 'people' | 'songs' | 'groups' | 'church'
  const [selectedService, setSelectedService] = useState(null);
  const [publicToken, setPublicToken] = useState(null);

  useEffect(() => {
    // 1. Initialize API client & Auth state & Theme
    const initApp = async () => {
      try {
        await api.init();
        const [storedUser, storedTheme] = await Promise.all([
          AsyncStorage.getItem('servesync_user'),
          AsyncStorage.getItem('servesync_theme'),
        ]);

        if (storedUser) {
          setUser(JSON.parse(storedUser));
          registerForPushNotificationsAsync();
        }

        if (storedTheme) {
          setIsDark(storedTheme === 'dark');
        }
      } catch (err) {
        console.error('App init error:', err);
      } finally {
        setLoading(false);
      }
    };

    initApp();

    // 2. Handle Deep Linking for zero-login confirmation links (e.g. servesync://avail/token or https://serve.creativeclicks.art/avail/token)
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

  const handleToggleTheme = async () => {
    const nextTheme = !isDark;
    setIsDark(nextTheme);
    await AsyncStorage.setItem('servesync_theme', nextTheme ? 'dark' : 'light');
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    await api.clearTokens();
    await AsyncStorage.removeItem('servesync_user');
    setUser(null);
    setSelectedService(null);
    setActiveTab('services');
  };

  const themeColors = {
    bg: isDark ? '#020617' : '#f8fafc',
    navBg: isDark ? '#0f172a' : '#ffffff',
    border: isDark ? '#1e293b' : '#e2e8f0',
    text: isDark ? '#ffffff' : '#0f172a',
    subText: isDark ? '#94a3b8' : '#64748b',
    primary: '#dc2626',
    activeTabBg: isDark ? '#1e293b' : '#fee2e2',
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: themeColors.bg }]}>
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Zero-login Deep link Confirmation Screen */}
      {publicToken ? (
        <PublicConfirmScreen token={publicToken} onDone={() => setPublicToken(null)} />
      ) : !user ? (
        <LoginScreen onLoginSuccess={handleLoginSuccess} isDark={isDark} />
      ) : selectedService ? (
        <ServiceDetailScreen
          service={selectedService}
          user={user}
          isDark={isDark}
          onBack={() => setSelectedService(null)}
        />
      ) : (
        <View style={styles.mainWrapper}>
          {/* Top Main Navigation Header */}
          <View
            style={[
              styles.topHeader,
              { backgroundColor: themeColors.navBg, borderColor: themeColors.border },
            ]}
          >
            <View style={styles.headerBrand}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoIcon}>⚡</Text>
              </View>
              <View>
                <Text style={[styles.brandTitle, { color: themeColors.text }]}>ChurchFlow</Text>
                <Text style={[styles.brandSub, { color: themeColors.subText }]}>
                  Jesus My Rock Church
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.iconButton, { borderColor: themeColors.border }]}
                onPress={handleToggleTheme}
              >
                <Text style={{ fontSize: 16 }}>{isDark ? '☀️' : '🌙'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.userBadge, { backgroundColor: isDark ? '#1e293b' : '#fee2e2' }]}
                onPress={() => setActiveTab('church')}
              >
                <Text style={[styles.userBadgeText, { color: themeColors.primary }]}>
                  {(user?.name || 'U').slice(0, 2).toUpperCase()}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Active Tab Screen Content */}
          <View style={styles.contentContainer}>
            {activeTab === 'services' && (
              <ServicesScreen
                user={user}
                isDark={isDark}
                onSelectService={(s) => setSelectedService(s)}
                onLogout={handleLogout}
              />
            )}
            {activeTab === 'people' && <PeopleScreen user={user} isDark={isDark} />}
            {activeTab === 'songs' && <SongsScreen user={user} isDark={isDark} />}
            {activeTab === 'groups' && <GroupsScreen user={user} isDark={isDark} />}
            {activeTab === 'church' && (
              <ChurchScreen
                user={user}
                isDark={isDark}
                onToggleTheme={handleToggleTheme}
                onLogout={handleLogout}
              />
            )}
          </View>

          {/* Bottom Tab Bar */}
          <View
            style={[
              styles.bottomTabBar,
              { backgroundColor: themeColors.navBg, borderColor: themeColors.border },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === 'services' && { backgroundColor: themeColors.activeTabBg },
              ]}
              onPress={() => setActiveTab('services')}
            >
              <Text style={styles.tabIcon}>📅</Text>
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: activeTab === 'services' ? themeColors.primary : themeColors.subText,
                    fontWeight: activeTab === 'services' ? '800' : '600',
                  },
                ]}
              >
                Services
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === 'people' && { backgroundColor: themeColors.activeTabBg },
              ]}
              onPress={() => setActiveTab('people')}
            >
              <Text style={styles.tabIcon}>👥</Text>
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: activeTab === 'people' ? themeColors.primary : themeColors.subText,
                    fontWeight: activeTab === 'people' ? '800' : '600',
                  },
                ]}
              >
                People
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === 'songs' && { backgroundColor: themeColors.activeTabBg },
              ]}
              onPress={() => setActiveTab('songs')}
            >
              <Text style={styles.tabIcon}>🎵</Text>
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: activeTab === 'songs' ? themeColors.primary : themeColors.subText,
                    fontWeight: activeTab === 'songs' ? '800' : '600',
                  },
                ]}
              >
                Songs
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === 'groups' && { backgroundColor: themeColors.activeTabBg },
              ]}
              onPress={() => setActiveTab('groups')}
            >
              <Text style={styles.tabIcon}>🌱</Text>
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: activeTab === 'groups' ? themeColors.primary : themeColors.subText,
                    fontWeight: activeTab === 'groups' ? '800' : '600',
                  },
                ]}
              >
                Groups
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === 'church' && { backgroundColor: themeColors.activeTabBg },
              ]}
              onPress={() => setActiveTab('church')}
            >
              <Text style={styles.tabIcon}>⛪</Text>
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: activeTab === 'church' ? themeColors.primary : themeColors.subText,
                    fontWeight: activeTab === 'church' ? '800' : '600',
                  },
                ]}
              >
                Church
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainWrapper: {
    flex: 1,
  },
  topHeader: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIcon: {
    fontSize: 18,
    color: '#ffffff',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  brandSub: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  contentContainer: {
    flex: 1,
  },
  bottomTabBar: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 10,
    marginHorizontal: 2,
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
  },
});
