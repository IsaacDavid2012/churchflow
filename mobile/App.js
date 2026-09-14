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
import { Ionicons } from '@expo/vector-icons';

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
  const [isDark, setIsDark] = useState(false); // Clean light mode default
  const [activeTab, setActiveTab] = useState('services');
  const [selectedService, setSelectedService] = useState(null);
  const [publicToken, setPublicToken] = useState(null);

  useEffect(() => {
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

      {/* Deep Link Zero-Login Confirmation */}
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
                <Ionicons name="flash" size={18} color="#ffffff" />
              </View>
              <View>
                <Text style={[styles.brandTitle, { color: themeColors.text }]}>ChurchFlow</Text>
                <Text style={[styles.brandSub, { color: themeColors.subText }]}>
                  Jesus My Rock
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.iconButton, { borderColor: themeColors.border }]}
                onPress={handleToggleTheme}
              >
                <Ionicons
                  name={isDark ? 'sunny' : 'moon'}
                  size={18}
                  color={isDark ? '#facc15' : '#475569'}
                />
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

          {/* Bottom Tab Bar with Ionicons */}
          <View
            style={[
              styles.bottomTabBar,
              { backgroundColor: themeColors.navBg, borderColor: themeColors.border },
            ]}
          >
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => setActiveTab('services')}
            >
              <Ionicons
                name={activeTab === 'services' ? 'calendar' : 'calendar-outline'}
                size={22}
                color={activeTab === 'services' ? themeColors.primary : themeColors.subText}
              />
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
              style={styles.tabItem}
              onPress={() => setActiveTab('people')}
            >
              <Ionicons
                name={activeTab === 'people' ? 'people' : 'people-outline'}
                size={22}
                color={activeTab === 'people' ? themeColors.primary : themeColors.subText}
              />
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
              style={styles.tabItem}
              onPress={() => setActiveTab('songs')}
            >
              <Ionicons
                name={activeTab === 'songs' ? 'musical-notes' : 'musical-notes-outline'}
                size={22}
                color={activeTab === 'songs' ? themeColors.primary : themeColors.subText}
              />
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
              style={styles.tabItem}
              onPress={() => setActiveTab('groups')}
            >
              <Ionicons
                name={activeTab === 'groups' ? 'chatbubbles' : 'chatbubbles-outline'}
                size={22}
                color={activeTab === 'groups' ? themeColors.primary : themeColors.subText}
              />
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
              style={styles.tabItem}
              onPress={() => setActiveTab('church')}
            >
              <Ionicons
                name={activeTab === 'church' ? 'business' : 'business-outline'}
                size={22}
                color={activeTab === 'church' ? themeColors.primary : themeColors.subText}
              />
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
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  brandSub: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  contentContainer: {
    flex: 1,
  },
  bottomTabBar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
  },
});
