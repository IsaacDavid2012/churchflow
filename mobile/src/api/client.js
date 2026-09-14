/**
 * ServeSync Mobile API Client
 * Configurable base URL with JWT auth header injection and automatic token refresh.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://servesync.creativeclicks.art/api';

class ApiClient {
  constructor() {
    this.token = null;
    this.refreshToken = null;
  }

  async init() {
    try {
      this.token = await AsyncStorage.getItem('servesync_token');
      this.refreshToken = await AsyncStorage.getItem('servesync_refresh_token');
    } catch (e) {
      console.warn('Failed to load token from storage:', e);
    }
  }

  async setTokens(token, refreshToken) {
    this.token = token;
    this.refreshToken = refreshToken;
    if (token) {
      await AsyncStorage.setItem('servesync_token', token);
    } else {
      await AsyncStorage.removeItem('servesync_token');
    }
    if (refreshToken) {
      await AsyncStorage.setItem('servesync_refresh_token', refreshToken);
    } else {
      await AsyncStorage.removeItem('servesync_refresh_token');
    }
  }

  async clearTokens() {
    this.token = null;
    this.refreshToken = null;
    await AsyncStorage.multiRemove(['servesync_token', 'servesync_refresh_token', 'servesync_user']);
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const url = `${API_BASE_URL}${endpoint}`;
    let response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle token expired (try refresh once)
    if (response.status === 401 && this.refreshToken && !options._retry) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        options._retry = true;
        headers.Authorization = `Bearer ${this.token}`;
        return fetch(url, { ...options, headers }).then(r => r.json());
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network request failed' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async tryRefresh() {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
      if (res.ok) {
        const data = await res.json();
        await this.setTokens(data.token, this.refreshToken);
        return true;
      }
    } catch (e) {
      console.warn('Token refresh failed:', e);
    }
    await this.clearTokens();
    return false;
  }

  // Auth endpoints
  async login(username, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    await this.setTokens(data.token, data.refreshToken);
    if (data.user) {
      await AsyncStorage.setItem('servesync_user', JSON.stringify(data.user));
    }
    return data;
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  // Services
  async getServices() {
    return this.request('/services');
  }

  async getServiceDetail(id) {
    return this.request(`/services/${id}`);
  }

  async autoShuffle(serviceId, pool = 'auto') {
    return this.request(`/services/${serviceId}/shuffle`, {
      method: 'POST',
      body: JSON.stringify({ pool }),
    });
  }

  async manualOverride(serviceId, positionId, roleSlot, musicianId) {
    return this.request(`/services/${serviceId}/override`, {
      method: 'POST',
      body: JSON.stringify({ position_id: positionId, role_slot: roleSlot, musician_id: musicianId }),
    });
  }

  async confirmLineup(serviceId) {
    return this.request(`/services/${serviceId}/confirm`, {
      method: 'POST',
    });
  }

  // People
  async getMusicians(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/musicians${query ? '?' + query : ''}`);
  }

  // Songs
  async getSongs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/songs${query ? '?' + query : ''}`);
  }

  // Groups
  async getGroups() {
    return this.request('/groups');
  }

  // Public Tokenized Availability Endpoint (Zero Login)
  async getPublicService(token) {
    const res = await fetch(`${API_BASE_URL}/public/avail/${token}`);
    if (!res.ok) throw new Error('Invalid or expired link');
    return res.json();
  }

  async submitPublicAvailability(token, musicianId, status) {
    const res = await fetch(`${API_BASE_URL}/public/avail/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ musician_id: musicianId, status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Submission failed' }));
      throw new Error(err.error || 'Failed to submit response');
    }
    return res.json();
  }

  // Register push token
  async registerDeviceToken(token, platform = 'android') {
    return this.request('/notifications/register-device', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    });
  }
}

export const api = new ApiClient();
