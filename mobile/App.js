import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar as RNStatusBar,
  Platform,
  BackHandler,
  ToastAndroid,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';

import { api } from './src/api/client';
import { registerForPushNotificationsAsync } from './src/services/fcm';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ServicesScreen from './src/screens/ServicesScreen';
import ServiceDetailScreen from './src/screens/ServiceDetailScreen';
import PeopleScreen from './src/screens/PeopleScreen';
import PositionsScreen from './src/screens/PositionsScreen';
import MinistriesScreen from './src/screens/MinistriesScreen';
import SongBookScreen from './src/screens/SongBookScreen';
import ChurchScreen from './src/screens/ChurchScreen';
import PublicConfirmScreen from './src/screens/PublicConfirmScreen';
import ErrorBoundary from './src/components/ErrorBoundary';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isDark, setIsDark] = useState(false); // Clean light mode default
  const [activeTab, setActiveTab] = useState('home');
  const [tabHistory, setTabHistory] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [publicToken, setPublicToken] = useState(null);
  const [pendingSbpUri, setPendingSbpUri] = useState(null);
  const lastBackPressRef = useRef(0);

  const switchTab = (nextTab) => {
    if (nextTab === activeTab) return;
    setTabHistory((prev) => [...prev.filter((t) => t !== nextTab), activeTab]);
    setActiveTab(nextTab);
  };

  // Android Hardware / Swipe Back Button Handling
  useEffect(() => {
    const onBackPress = () => {
      // 1. If viewing deep link token screen, close it
      if (publicToken) {
        setPublicToken(null);
        return true;
      }

      // 2. If viewing a service detail, return to services list
      if (selectedService) {
        setSelectedService(null);
        return true;
      }

      // 3. If there is navigation history between tabs, pop previous tab
      if (tabHistory.length > 0) {
        const prevTab = tabHistory[tabHistory.length - 1];
        setTabHistory((prev) => prev.slice(0, -1));
        setActiveTab(prevTab);
        return true;
      }

      // 4. If on another tab without history, navigate back to 'home' tab
      if (activeTab !== 'home') {
        setActiveTab('home');
        return true;
      }

      // 5. At root home screen: double-tap to exit within 2 seconds
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        return false; // Exit app
      }
      lastBackPressRef.current = now;
      if (Platform.OS === 'android') {
        ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      }
      return true; // Prevent exit on first press
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSub.remove();
  }, [publicToken, selectedService, tabHistory, activeTab]);

  useEffect(() => {
    api.setOnUnauthorized(() => {
      handleLogout();
    });

    const initApp = async () => {
      try {
        const savedUser = await api.init();
        if (savedUser) {
          setUser(savedUser);
          // Verify session in background without blocking initial render
          api.getMe().then((res) => {
            if (res && res.user) {
              setUser(res.user);
            }
          }).catch((err) => {
            if (err && err.message && (err.message.includes('401') || err.message.includes('Unauthorized'))) {
              handleLogout();
            }
          });
        }
      } catch (err) {
        console.error('App init error:', err);
      } finally {
        setLoading(false);
      }
    };

    initApp();

    const handleDeepLink = (event) => {
      if (!event?.url) return;
      const rawUrl = event.url;

      // Check if incoming SBP / chord file from WhatsApp or file manager
      if (
        rawUrl.toLowerCase().endsWith('.sbp') ||
        rawUrl.toLowerCase().endsWith('.sbpbackup') ||
        rawUrl.startsWith('content://') ||
        (rawUrl.startsWith('file://') && (rawUrl.includes('.sbp') || rawUrl.includes('WhatsApp') || rawUrl.includes('SongBook')))
      ) {
        setPendingSbpUri(rawUrl);
        switchTab('songbook');
        return;
      }

      const data = Linking.parse(rawUrl);
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

    // FCM Push Notification Response Listener (e.g. YouTube Live Stream Notification)
    const notifSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data;
      if (data?.type === 'youtube_live') {
        switchTab('home');
        if (data.url) {
          Linking.openURL(data.url).catch(() => {});
        }
      }
    });

    return () => {
      subscription.remove();
      notifSub.remove();
    };
  }, []);

  const handleToggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    await api.clearTokens();
    setUser(null);
    setSelectedService(null);
    setTabHistory([]);
    setActiveTab('home');
  };

  const themeColors = {
    bg: isDark ? '#020617' : '#ffffff',
    navBg: isDark ? '#0f172a' : '#ffffff',
    border: isDark ? '#1e293b' : '#eadbc4',
    text: isDark ? '#ffffff' : '#0f172a',
    subText: isDark ? '#94a3b8' : '#64748b',
    primary: '#c59c6c',
    activeTabBg: isDark ? '#1e293b' : '#f5ede1',
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: themeColors.bg }]}>
        <ActivityIndicator size="large" color="#c59c6c" />
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
        <ErrorBoundary
          isDark={isDark}
          onReset={() => setSelectedService(null)}
          onNavigateHome={() => setSelectedService(null)}
        >
          <ServiceDetailScreen
            service={selectedService}
            user={user}
            isDark={isDark}
            onBack={() => setSelectedService(null)}
          />
        </ErrorBoundary>
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
                <Image
                  source={require('./assets/jmrlogo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <View>
                <Text style={[styles.brandTitle, { color: themeColors.text }]}>ChurchFlow</Text>
                <Text style={[styles.brandSub, { color: themeColors.primary }]}>
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
                style={[styles.userBadge, { backgroundColor: isDark ? '#1e293b' : '#f5ede1' }]}
                onPress={() => switchTab('church')}
              >
                <Text style={[styles.userBadgeText, { color: '#9e7343' }]}>
                  {(user?.name || 'U').slice(0, 2).toUpperCase()}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Active Tab Screen Content */}
          <ErrorBoundary
            isDark={isDark}
            onReset={() => {}}
            onNavigateHome={() => setActiveTab('home')}
          >
            <View style={styles.contentContainer}>
              {activeTab === 'home' && (
                <HomeScreen
                  user={user}
                  isDark={isDark}
                  onSelectService={(s) => setSelectedService(s)}
                  onNavigateTab={(tab) => switchTab(tab)}
                />
              )}
              {activeTab === 'services' && (
                <ServicesScreen
                  user={user}
                  isDark={isDark}
                  onSelectService={(s) => setSelectedService(s)}
                  onLogout={handleLogout}
                />
              )}
              {activeTab === 'songbook' && (
                <SongBookScreen
                  user={user}
                  isDark={isDark}
                  pendingSbpUri={pendingSbpUri}
                  onClearPendingSbp={() => setPendingSbpUri(null)}
                />
              )}
              {activeTab === 'people' && <PeopleScreen user={user} isDark={isDark} />}
              {activeTab === 'positions' && <PositionsScreen user={user} isDark={isDark} />}
              {(activeTab === 'ministries' || activeTab === 'groups') && (
                <MinistriesScreen user={user} isDark={isDark} />
              )}
              {activeTab === 'church' && (
                <ChurchScreen
                  user={user}
                  isDark={isDark}
                  onToggleTheme={handleToggleTheme}
                  onLogout={handleLogout}
                />
              )}
            </View>
          </ErrorBoundary>

          {/* Bottom Tab Bar with Ionicons */}
          <View
            style={[
              styles.bottomTabBar,
              { backgroundColor: themeColors.navBg, borderColor: themeColors.border },
            ]}
          >
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => switchTab('home')}
            >
              <Ionicons
                name={activeTab === 'home' ? 'home' : 'home-outline'}
                size={22}
                color={activeTab === 'home' ? themeColors.primary : themeColors.subText}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: activeTab === 'home' ? themeColors.primary : themeColors.subText,
                    fontWeight: activeTab === 'home' ? '800' : '600',
                  },
                ]}
              >
                Home
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => switchTab('services')}
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
              onPress={() => switchTab('songbook')}
            >
              <Ionicons
                name={activeTab === 'songbook' ? 'musical-notes' : 'musical-notes-outline'}
                size={22}
                color={activeTab === 'songbook' ? themeColors.primary : themeColors.subText}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: activeTab === 'songbook' ? themeColors.primary : themeColors.subText,
                    fontWeight: activeTab === 'songbook' ? '800' : '600',
                  },
                ]}
              >
                SongBook
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => switchTab('people')}
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
              onPress={() => switchTab('positions')}
            >
              <Ionicons
                name={activeTab === 'positions' ? 'layers' : 'layers-outline'}
                size={22}
                color={activeTab === 'positions' ? themeColors.primary : themeColors.subText}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: activeTab === 'positions' ? themeColors.primary : themeColors.subText,
                    fontWeight: activeTab === 'positions' ? '800' : '600',
                  },
                ]}
              >
                Positions
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => switchTab('ministries')}
            >
              <Ionicons
                name={activeTab === 'ministries' || activeTab === 'groups' ? 'heart-circle' : 'heart-circle-outline'}
                size={22}
                color={activeTab === 'ministries' || activeTab === 'groups' ? themeColors.primary : themeColors.subText}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: activeTab === 'ministries' || activeTab === 'groups' ? themeColors.primary : themeColors.subText,
                    fontWeight: activeTab === 'ministries' || activeTab === 'groups' ? '800' : '600',
                  },
                ]}
              >
                Ministries
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => switchTab('church')}
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
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#eadbc4',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  logoImage: {
    width: '100%',
    height: '100%',
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
