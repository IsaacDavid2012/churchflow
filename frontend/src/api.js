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

  if (response.status === 401) {
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
  setWorshipLeader: (id, worship_leader_id) =>
    request(`/services/${id}/worship-leader`, {
      method: 'POST',
      body: JSON.stringify({ worship_leader_id }),
    }),
  shuffleLineup: (id, options = {}) =>
    request(`/services/${id}/shuffle`, {
      method: 'POST',
      body: JSON.stringify(options),
    }),
  overrideSlot: (id, { position_id, role_slot, musician_id, notes }) =>
    request(`/services/${id}/assignments/override`, {
      method: 'POST',
      body: JSON.stringify({ position_id, role_slot, musician_id, notes }),
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

  // Small Groups
  getGroups: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/groups${query ? `?${query}` : ''}`);
  },
  getGroup: (id) => request(`/groups/${id}`),
  createGroup: (data) =>
    request('/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateGroup: (id, data) =>
    request(`/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteGroup: (id) =>
    request(`/groups/${id}`, {
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
