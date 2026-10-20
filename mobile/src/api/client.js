/**
 * ChurchFlow Mobile API Client
 * 100% matched to ChurchFlow backend routes (/api)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://serve.creativeclicks.art/api';

function buildQueryString(params = {}) {
  if (!params || typeof params !== 'object') return '';
  const parts = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

class ApiClient {
  constructor() {
    this.token = null;
    this.refreshToken = null;
    this.refreshPromise = null;
    this.onUnauthorized = null;
  }

  setOnUnauthorized(callback) {
    this.onUnauthorized = callback;
  }

  async init() {
    try {
      const [token, refreshToken, userStr] = await Promise.all([
        AsyncStorage.getItem('@churchflow_token'),
        AsyncStorage.getItem('@churchflow_refresh_token'),
        AsyncStorage.getItem('@churchflow_user'),
      ]);
      this.token = token || null;
      this.refreshToken = refreshToken || null;
      if (userStr) {
        try {
          return JSON.parse(userStr);
        } catch (e) {
          return null;
        }
      }
      return null;
    } catch (e) {
      this.token = null;
      this.refreshToken = null;
      return null;
    }
  }

  async setTokens(token, refreshToken, user = null) {
    this.token = token || null;
    this.refreshToken = refreshToken || null;
    try {
      if (token) {
        await AsyncStorage.setItem('@churchflow_token', token);
      } else {
        await AsyncStorage.removeItem('@churchflow_token');
      }
      if (refreshToken) {
        await AsyncStorage.setItem('@churchflow_refresh_token', refreshToken);
      } else {
        await AsyncStorage.removeItem('@churchflow_refresh_token');
      }
      if (user) {
        await AsyncStorage.setItem('@churchflow_user', JSON.stringify(user));
      }
    } catch (e) {
      console.warn('AsyncStorage setTokens error:', e);
    }
  }

  async clearTokens() {
    this.token = null;
    this.refreshToken = null;
    try {
      await AsyncStorage.multiRemove([
        '@churchflow_token',
        '@churchflow_refresh_token',
        '@churchflow_user',
      ]);
    } catch (e) {}
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
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
    if (response.status === 401 && !endpoint.startsWith('/auth/login') && !options._retry) {
      if (this.refreshToken) {
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
      await this.clearTokens();
      if (this.onUnauthorized) {
        this.onUnauthorized();
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network request failed' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async tryRefresh() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    this.refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
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
    })();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  // --- Auth & User Endpoints ---
  async login(username, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    await this.setTokens(data.token, data.refreshToken, data.user);
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

  async updateService(id, payload) {
    return this.request(`/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteService(id) {
    return this.request(`/services/${id}`, {
      method: 'DELETE',
    });
  }

  async getServiceTypes() {
    return this.request('/service-types');
  }

  async createServiceType(payload) {
    return this.request('/service-types', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async deleteServiceType(id) {
    return this.request(`/service-types/${id}`, {
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

  async setWorshipLeader(serviceId, worshipLeaderId, autoRoster = false) {
    return this.request(`/services/${serviceId}/worship-leader`, {
      method: 'POST',
      body: JSON.stringify({ worship_leader_id: worshipLeaderId, auto_roster: autoRoster }),
    });
  }

  async overrideSlot(serviceId, { position_id, role_slot = 'primary', musician_id, notes = '', auto_roster = false }) {
    return this.request(`/services/${serviceId}/assignments/override`, {
      method: 'POST',
      body: JSON.stringify({ position_id, role_slot, musician_id, notes, auto_roster }),
    });
  }

  async manualAssignSlot(serviceId, positionId, musicianId, autoRoster = false) {
    return this.overrideSlot(serviceId, {
      position_id: positionId,
      role_slot: 'primary',
      musician_id: musicianId,
      auto_roster: autoRoster,
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

  // --- WhatsApp Automation Gateway ---
  async getWhatsAppStatus() {
    return this.request('/services/whatsapp/status');
  }

  async sendWhatsAppNotifyAll(serviceId) {
    return this.request(`/services/${serviceId}/whatsapp-notify-all`, {
      method: 'POST',
    });
  }

  async broadcastWhatsAppRunSheet(serviceId, groupId) {
    return this.request(`/services/${serviceId}/whatsapp-broadcast`, {
      method: 'POST',
      body: JSON.stringify({ group_id: groupId }),
    });
  }

  // --- Standalone SongBook Pro Integration (User-Scoped & Online Engine) ---
  async getSongbookStatus() {
    return this.request('/songbook/status');
  }

  async getSongbookMe() {
    return this.request('/songbook/me');
  }

  async getSongbookStats() {
    return this.request('/songbook/stats');
  }

  async getSongbookSongs(params = {}) {
    return this.request(`/songbook/songs${buildQueryString(params)}`);
  }

  async getSongbookSong(id) {
    return this.request(`/songbook/songs/${id}`);
  }

  async createSongbookSong(data) {
    return this.request('/songbook/songs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSongbookSong(id, data) {
    return this.request(`/songbook/songs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSongbookSong(id) {
    return this.request(`/songbook/songs/${id}`, {
      method: 'DELETE',
    });
  }

  async copySongbookSong(id, data = {}) {
    return this.request(`/songbook/songs/${id}/copy`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSongbookSetlists(params = {}) {
    return this.request(`/songbook/setlists${buildQueryString(params)}`);
  }

  async getSongbookSetlist(id) {
    return this.request(`/songbook/setlists/${id}`);
  }

  async createSongbookSetlist(data) {
    return this.request('/songbook/setlists', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteSongbookSetlist(id) {
    return this.request(`/songbook/setlists/${id}`, {
      method: 'DELETE',
    });
  }

  async parseSongbookBackup(data) {
    return this.request('/songbook/backup/parse', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async previewSongbookBackup(data) {
    return this.request('/songbook/backup/preview', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async importSongbookBackup(data) {
    return this.request('/songbook/backup/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async searchSongbookOnline(params = {}) {
    return this.request(`/songbook/online/search${buildQueryString(params)}`);
  }

  async fetchSongbookOnline(params = {}) {
    return this.request(`/songbook/online/fetch${buildQueryString(params)}`);
  }

  async importSongbookOnline(data) {
    return this.request('/songbook/online/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
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
    return this.request(`/musicians${buildQueryString(params)}`);
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

  // --- Positions Template ---
  async getPositions() {
    return this.request('/positions');
  }

  async createPosition(positionData) {
    return this.request('/positions', {
      method: 'POST',
      body: JSON.stringify(positionData),
    });
  }

  async updatePosition(id, positionData) {
    return this.request(`/positions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(positionData),
    });
  }

  async deletePosition(id) {
    return this.request(`/positions/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Worship Songs ---
  async getSongs(params = {}) {
    return this.request(`/songs${buildQueryString(params)}`);
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

  // --- Church Ministries ---
  async getMinistries(params = {}) {
    return this.request(`/ministries${buildQueryString(params)}`);
  }

  async getMinistry(id) {
    return this.request(`/ministries/${id}`);
  }

  async createMinistry(data) {
    return this.request('/ministries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMinistry(id, data) {
    return this.request(`/ministries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteMinistry(id) {
    return this.request(`/ministries/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Ministry Hub: Stream, Members, Managers & AI Assistant ---
  async getMinistryAnnouncements(ministryId) {
    return this.request(`/ministries/${ministryId}/announcements`);
  }

  async createMinistryAnnouncement(ministryId, data) {
    return this.request(`/ministries/${ministryId}/announcements`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteMinistryAnnouncement(ministryId, announcementId) {
    return this.request(`/ministries/${ministryId}/announcements/${announcementId}`, {
      method: 'DELETE',
    });
  }

  async getMinistryMembers(ministryId) {
    return this.request(`/ministries/${ministryId}/members`);
  }

  async assignMinistryMember(ministryId, data) {
    return this.request(`/ministries/${ministryId}/members`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async removeMinistryMember(ministryId, musicianId) {
    return this.request(`/ministries/${ministryId}/members/${musicianId}`, {
      method: 'DELETE',
    });
  }

  async updateMinistryMemberRole(ministryId, musicianId, role) {
    return this.request(`/ministries/${ministryId}/members/${musicianId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  async getMinistryChat(ministryId) {
    return this.request(`/ministries/${ministryId}/chat`);
  }

  async sendMinistryChat(ministryId, message) {
    return this.request(`/ministries/${ministryId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async deleteMinistryChat(ministryId, messageId) {
    return this.request(`/ministries/${ministryId}/chat/${messageId}`, {
      method: 'DELETE',
    });
  }

  // --- Church Community (WhatsApp Community architecture) ---
  async getCommunityAnnouncements() {
    return this.request('/community/announcements');
  }

  async createCommunityAnnouncement(data) {
    return this.request('/community/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteCommunityAnnouncement(id) {
    return this.request(`/community/announcements/${id}`, {
      method: 'DELETE',
    });
  }

  async getCommunityChat() {
    return this.request('/community/chat');
  }

  async sendCommunityChat(message) {
    return this.request('/community/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async deleteCommunityChat(id) {
    return this.request(`/community/chat/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Small Groups (Aliases for compatibility) ---
  async getGroups(params = {}) {
    return this.getMinistries(params);
  }

  async createGroup(groupData) {
    return this.createMinistry(groupData);
  }

  async deleteGroup(id) {
    return this.deleteMinistry(id);
  }

  // --- Church Profile, Campuses & Settings ---
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

  async getChurchMinistries() {
    return this.request('/church/ministries');
  }

  async getNotifications() {
    return this.request('/notifications');
  }

  async getAuditLogs(serviceId) {
    return this.request(`/notifications${serviceId ? '?service_id=' + encodeURIComponent(serviceId) : ''}`);
  }

  // --- Public Confirmation ---
  async getPublicService(token) {
    return this.request(`/public/avail/${token}`);
  }

  async getPublicAvailability(token) {
    return this.request(`/public/avail/${token}`);
  }

  async verifyPublicPin(token, musicianId, pin) {
    return this.request(`/public/avail/${token}/verify-pin`, {
      method: 'POST',
      body: JSON.stringify({ musician_id: musicianId, pin }),
    });
  }

  async submitPublicAvailability(token, musicianId, status, claimToken = null, pin = null) {
    return this.request(`/public/avail/${token}`, {
      method: 'POST',
      body: JSON.stringify({ musician_id: musicianId, status, claim_token: claimToken, pin }),
    });
  }

  async submitPublicResponse(token, musicianId, status, claimToken = null, pin = null) {
    return this.submitPublicAvailability(token, musicianId, status, claimToken, pin);
  }
}

export const api = new ApiClient();
