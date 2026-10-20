const API_BASE = '/api';

function getAuthHeader() {
  const token = localStorage.getItem('servesync_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && endpoint !== '/auth/login') {
    localStorage.removeItem('servesync_token');
    localStorage.removeItem('servesync_user');
    window.dispatchEvent(new Event('auth-logout'));
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `HTTP error! status: ${response.status}`);
  }
  return data;
}

export const api = {
  // Auth & Users
  login: (username, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  getMe: () => request('/auth/me'),
  getUsers: () => request('/auth/users'),
  createUser: (data) =>
    request('/auth/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateUser: (id, data) =>
    request(`/auth/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteUser: (id) =>
    request(`/auth/users/${id}`, {
      method: 'DELETE',
    }),
  resetUserPassword: (id, newPassword) =>
    request(`/auth/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),

  // Church Profile & Campuses
  getChurch: () => request('/church'),
  updateChurch: (data) =>
    request('/church', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getCampuses: () => request('/church/campuses'),
  createCampus: (data) =>
    request('/church/campuses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getMinistries: () => request('/church/ministries'),
  createMinistry: (data) =>
    request('/church/ministries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Services
  getServices: () => request('/services'),
  getService: (id) => request(`/services/${id}`),
  createService: (data) =>
    request('/services', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateService: (id, data) =>
    request(`/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteService: (id) =>
    request(`/services/${id}`, {
      method: 'DELETE',
    }),
  getServiceTypes: () => request('/service-types'),
  createServiceType: (data) =>
    request('/service-types', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteServiceType: (id) =>
    request(`/service-types/${id}`, {
      method: 'DELETE',
    }),
  setWorshipLeader: (id, worship_leader_id, auto_roster = false) =>
    request(`/services/${id}/worship-leader`, {
      method: 'POST',
      body: JSON.stringify({ worship_leader_id, auto_roster }),
    }),
  shuffleLineup: (id, options = {}) =>
    request(`/services/${id}/shuffle`, {
      method: 'POST',
      body: JSON.stringify(options),
    }),
  overrideSlot: (id, { position_id, role_slot, musician_id, notes, auto_roster = false }) =>
    request(`/services/${id}/assignments/override`, {
      method: 'POST',
      body: JSON.stringify({ position_id, role_slot, musician_id, notes, auto_roster }),
    }),
  confirmLineup: (id) =>
    request(`/services/${id}/assignments/confirm`, {
      method: 'POST',
    }),
  checkDeadline: (id) =>
    request(`/services/${id}/check-deadline`, {
      method: 'POST',
    }),
  getCandidates: (serviceId, positionId) =>
    request(`/services/${serviceId}/candidates/${positionId}`),

  // WhatsApp Automation Gateway
  getWhatsAppStatus: () => request('/services/whatsapp/status'),
  sendWhatsAppNotifyAll: (serviceId) =>
    request(`/services/${serviceId}/whatsapp-notify-all`, {
      method: 'POST',
    }),
  broadcastWhatsAppRunSheet: (serviceId, groupId) =>
    request(`/services/${serviceId}/whatsapp-broadcast`, {
      method: 'POST',
      body: JSON.stringify({ group_id: groupId }),
    }),

  // Service Plan / Order of Service (Run Sheet)
  getPlanItems: (serviceId) => request(`/services/${serviceId}/plan`),
  addPlanItem: (serviceId, data) =>
    request(`/services/${serviceId}/plan`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updatePlanItem: (serviceId, itemId, data) =>
    request(`/services/${serviceId}/plan/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deletePlanItem: (serviceId, itemId) =>
    request(`/services/${serviceId}/plan/${itemId}`, {
      method: 'DELETE',
    }),

  // People / Musicians Directory
  getPeople: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/musicians${query ? `?${query}` : ''}`);
  },
  getMusicians: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/musicians${query ? `?${query}` : ''}`);
  },
  getPerson: (id) => request(`/musicians/${id}`),
  getMusician: (id) => request(`/musicians/${id}`),
  createPerson: (data) =>
    request('/musicians', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createMusician: (data) =>
    request('/musicians', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updatePerson: (id, data) =>
    request(`/musicians/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateMusician: (id, data) =>
    request(`/musicians/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deletePerson: (id) =>
    request(`/musicians/${id}`, {
      method: 'DELETE',
    }),
  deleteMusician: (id) =>
    request(`/musicians/${id}`, {
      method: 'DELETE',
    }),
  getHouseholds: () => request('/musicians/households'),
  createHousehold: (data) =>
    request('/musicians/households', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Songs Library
  getSongs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/songs${query ? `?${query}` : ''}`);
  },
  getSong: (id) => request(`/songs/${id}`),
  createSong: (data) =>
    request('/songs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateSong: (id, data) =>
    request(`/songs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteSong: (id) =>
    request(`/songs/${id}`, {
      method: 'DELETE',
    }),

  // Standalone SongBook Pro Integration (User-Scoped & Online Engine)
  getSongbookStatus: () => request('/songbook/status'),
  getSongbookMe: () => request('/songbook/me'),
  getSongbookStats: () => request('/songbook/stats'),
  getSongbookSongs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/songbook/songs${query ? `?${query}` : ''}`);
  },
  getSongbookSong: (id) => request(`/songbook/songs/${id}`),
  createSongbookSong: (data) =>
    request('/songbook/songs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateSongbookSong: (id, data) =>
    request(`/songbook/songs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteSongbookSong: (id) =>
    request(`/songbook/songs/${id}`, {
      method: 'DELETE',
    }),
  copySongbookSong: (id, data = {}) =>
    request(`/songbook/songs/${id}/copy`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getSongbookSetlists: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/songbook/setlists${query ? `?${query}` : ''}`);
  },
  getSongbookSetlist: (id) => request(`/songbook/setlists/${id}`),
  createSongbookSetlist: (data) =>
    request('/songbook/setlists', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteSongbookSetlist: (id) =>
    request(`/songbook/setlists/${id}`, {
      method: 'DELETE',
    }),
  parseSongbookBackup: (data) =>
    request('/songbook/backup/parse', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  previewSongbookBackup: (data) =>
    request('/songbook/backup/preview', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  importSongbookBackup: (data) =>
    request('/songbook/backup/import', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  exportSongbookBackup: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const token = localStorage.getItem('servesync_token');
    const url = `/api/songbook/backup/export${query ? `?${query}` : ''}`;
    // Directly trigger browser download
    return fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.blob())
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `SongBook_${Date.now()}.sbp`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
      });
  },
  exportSongbookSetlistSbp: (id, name = 'Worship_Set') => {
    const token = localStorage.getItem('servesync_token');
    const url = `/api/songbook/setlists/${id}/export/sbp`;
    return fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.blob())
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.sbp`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
      });
  },
  exportSongbookSongSbp: (id, title = 'Song') => {
    const token = localStorage.getItem('servesync_token');
    const url = `/api/songbook/songs/${id}/export/sbp`;
    return fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.blob())
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.sbp`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
      });
  },
  getSongbookSetlistPdf: (id) => request(`/songbook/setlists/${id}/export/pdf`),
  getSongbookSongPdf: (id) => request(`/songbook/songs/${id}/export/pdf`),
  searchSongbookOnline: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/songbook/online/search${query ? `?${query}` : ''}`);
  },
  fetchSongbookOnline: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/songbook/online/fetch${query ? `?${query}` : ''}`);
  },
  importSongbookOnline: (data) =>
    request('/songbook/online/import', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Church Ministries
  getMinistries: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/ministries${query ? `?${query}` : ''}`);
  },
  getMinistry: (id) => request(`/ministries/${id}`),
  createMinistry: (data) =>
    request('/ministries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateMinistry: (id, data) =>
    request(`/ministries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteMinistry: (id) =>
    request(`/ministries/${id}`, {
      method: 'DELETE',
    }),

  // Ministry Hub: Announcements Stream
  getMinistryAnnouncements: (ministryId) => request(`/ministries/${ministryId}/announcements`),
  createMinistryAnnouncement: (ministryId, data) =>
    request(`/ministries/${ministryId}/announcements`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteMinistryAnnouncement: (ministryId, announcementId) =>
    request(`/ministries/${ministryId}/announcements/${announcementId}`, {
      method: 'DELETE',
    }),

  // Ministry Hub: Members & Managers Assignment
  getMinistryMembers: (ministryId) => request(`/ministries/${ministryId}/members`),
  assignMinistryMember: (ministryId, data) =>
    request(`/ministries/${ministryId}/members`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  removeMinistryMember: (ministryId, musicianId) =>
    request(`/ministries/${ministryId}/members/${musicianId}`, {
      method: 'DELETE',
    }),
  updateMinistryMemberRole: (ministryId, musicianId, role) =>
    request(`/ministries/${ministryId}/members/${musicianId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),

  // Ministry Team Chat Space
  getMinistryChat: (ministryId) => request(`/ministries/${ministryId}/chat`),
  sendMinistryChat: (ministryId, message) =>
    request(`/ministries/${ministryId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  deleteMinistryChat: (ministryId, messageId) =>
    request(`/ministries/${ministryId}/chat/${messageId}`, {
      method: 'DELETE',
    }),

  // Church Community (WhatsApp Community: General Announcements & Church Family Chat)
  getCommunityAnnouncements: () => request('/community/announcements'),
  createCommunityAnnouncement: (data) =>
    request('/community/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteCommunityAnnouncement: (id) =>
    request(`/community/announcements/${id}`, {
      method: 'DELETE',
    }),
  getCommunityChat: () => request('/community/chat'),
  sendCommunityChat: (message) =>
    request('/community/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  deleteCommunityChat: (id) =>
    request(`/community/chat/${id}`, {
      method: 'DELETE',
    }),

  // Legacy Groups Aliases
  getGroups: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/ministries${query ? `?${query}` : ''}`);
  },
  getGroup: (id) => request(`/ministries/${id}`),
  createGroup: (data) =>
    request('/ministries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateGroup: (id, data) =>
    request(`/ministries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteGroup: (id) =>
    request(`/ministries/${id}`, {
      method: 'DELETE',
    }),

  // Positions
  getPositions: () => request('/positions'),
  createPosition: (data) =>
    request('/positions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updatePosition: (id, data) =>
    request(`/positions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deletePosition: (id) =>
    request(`/positions/${id}`, {
      method: 'DELETE',
    }),

  // Notifications
  getNotifications: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/notifications${query ? `?${query}` : ''}`);
  },
};
