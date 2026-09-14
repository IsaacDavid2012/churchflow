/**
 * Push Notification Setup for Mobile App
 * Handles FCM / Expo push token registration, foreground listeners, and notification response handling.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from '../api/client';

// Configure notification behavior when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'ServeSync Roster Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4f46e5',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for push notification permission.');
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'servesync-jesus-my-rock',
    });
    token = tokenData.data;

    // Register token with backend if user is logged in
    await api.registerDeviceToken(token, Platform.OS).catch((e) => {
      console.log('Could not register device token immediately:', e.message);
    });
  } catch (error) {
    console.log('Error getting push token:', error);
  }

  return token;
}
