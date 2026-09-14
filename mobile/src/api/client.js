/**
 * ChurchFlow Mobile API Client
 * 100% matched to ChurchFlow backend routes (/api)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://serve.creativeclicks.art/api';

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
        const retryRes = await fetch(url, { ...options, headers });
        if (!retryRes.ok) {
          const err = await retryRes.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${retryRes.status}`);
        }
        return retryRes.json();
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

  // --- Auth & User Endpoints ---
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

  async getMe() {
    return this.request('/auth/me');
  }

  async getUsers() {
    return this.request('/auth/users');
  }

  async createUser(userData) {
    return this.request('/auth/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id) {
    return this.request(`/auth/users/${id}`, {
      method: 'DELETE',
    });
  }

  async resetUserPassword(id, newPassword) {
    return this.request(`/auth/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  }

  // --- Services Endpoints ---
  async getServices() {
    return this.request('/services');
  }

  async getService(id) {
    return this.request(`/services/${id}`);
  }

  async getServiceById(id) {
    return this.request(`/services/${id}`);
  }

  async createService(payload) {
    return this.request('/services', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async deleteService(id) {
    return this.request(`/services/${id}`, {
      method: 'DELETE',
    });
  }

  async shuffleLineup(serviceId, options = {}) {
    return this.request(`/services/${serviceId}/shuffle`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async autoSchedule(serviceId) {
    return this.shuffleLineup(serviceId, { pool: 'available_and_unresponsive' });
  }

  async setWorshipLeader(serviceId, worshipLeaderId) {
    return this.request(`/services/${serviceId}/worship-leader`, {
      method: 'POST',
      body: JSON.stringify({ worship_leader_id: worshipLeaderId }),
    });
  }

  async overrideSlot(serviceId, { position_id, role_slot = 'primary', musician_id, notes = '' }) {
    return this.request(`/services/${serviceId}/assignments/override`, {
      method: 'POST',
      body: JSON.stringify({ position_id, role_slot, musician_id, notes }),
    });
  }

  async manualAssignSlot(serviceId, positionId, musicianId) {
    return this.overrideSlot(serviceId, {
      position_id: positionId,
      role_slot: 'primary',
      musician_id: musicianId,
    });
  }

  async confirmLineup(serviceId) {
    return this.request(`/services/${serviceId}/assignments/confirm`, {
      method: 'POST',
    });
  }

  async getCandidates(serviceId, positionId) {
    return this.request(`/services/${serviceId}/candidates/${positionId}`);
  }

  // --- Service Plan (Run Sheet) ---
  async getPlanItems(serviceId) {
    return this.request(`/services/${serviceId}/plan`);
  }

  async addPlanItem(serviceId, itemData) {
    return this.request(`/services/${serviceId}/plan`, {
      method: 'POST',
      body: JSON.stringify(itemData),
    });
  }

  async deletePlanItem(serviceId, itemId) {
    return this.request(`/services/${serviceId}/plan/${itemId}`, {
      method: 'DELETE',
    });
  }

  // --- People Directory ---
  async getMusicians(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/musicians${query ? '?' + query : ''}`);
  }

  async getPeople(params = {}) {
    return this.getMusicians(params);
  }

  async createMusician(musicianData) {
    return this.request('/musicians', {
      method: 'POST',
      body: JSON.stringify(musicianData),
    });
  }

  async updateMusician(id, musicianData) {
    return this.request(`/musicians/${id}`, {
      method: 'PUT',
      body: JSON.stringify(musicianData),
    });
  }

  async deleteMusician(id) {
    return this.request(`/musicians/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Worship Songs ---
  async getSongs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/songs${query ? '?' + query : ''}`);
  }

  async createSong(songData) {
    return this.request('/songs', {
      method: 'POST',
      body: JSON.stringify(songData),
    });
  }

  async deleteSong(id) {
    return this.request(`/songs/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Small Groups ---
  async getGroups(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/groups${query ? '?' + query : ''}`);
  }

  async createGroup(groupData) {
    return this.request('/groups', {
      method: 'POST',
      body: JSON.stringify(groupData),
    });
  }

  async deleteGroup(id) {
    return this.request(`/groups/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Church Profile, Campuses & Ministries ---
  async getChurch() {
    return this.request('/church');
  }

  async updateChurch(churchData) {
    return this.request('/church', {
      method: 'PUT',
      body: JSON.stringify(churchData),
    });
  }

  async getCampuses() {
    return this.request('/church/campuses');
  }

  async getMinistries() {
    return this.request('/church/ministries');
  }

  async getNotifications() {
    return this.request('/notifications');
  }

  async getAuditLogs(serviceId) {
    return this.request('/notifications');
  }

  // --- Public Confirmation ---
  async getPublicAvailability(token) {
    return this.request(`/public/avail/${token}`);
  }

  async submitPublicResponse(token, status, notes = '') {
    return this.request(`/public/avail/${token}/respond`, {
      method: 'POST',
      body: JSON.stringify({ status, notes }),
    });
  }
}

export const api = new ApiClient();
