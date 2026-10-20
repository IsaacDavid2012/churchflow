const http = require('http');

const SONGBOOK_HOST = process.env.SONGBOOK_HOST || (process.env.NODE_ENV === 'production' ? '192.168.192.1' : 'localhost');
const SONGBOOK_PORT = parseInt(process.env.SONGBOOK_PORT || '3008', 10);
const SONGBOOK_USER = process.env.SBPRO_USER || 'Isaac';
const SONGBOOK_PASS = process.env.SBPRO_PASS || 'IDC-201Two';

let cachedToken = null;
let tokenExpiresAt = 0;
let userTeams = [];

/**
 * Make low-level HTTP request to SongBook Pro service
 */
function makeRequest(path, method = 'GET', payload = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : null;
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (data) {
      headers['Content-Length'] = Buffer.byteLength(data);
    }

    const options = {
      hostname: SONGBOOK_HOST,
      port: SONGBOOK_PORT,
      path,
      method,
      timeout: 10000,
      headers,
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, status: res.statusCode, data: parsed });
          } else {
            resolve({ success: false, status: res.statusCode, error: parsed.error || body });
          }
        } catch (e) {
          resolve({ success: false, status: res.statusCode, error: body });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'SongBook Pro request timed out' });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    if (data) req.write(data);
    req.end();
  });
}

/**
 * Obtain a valid JWT from SongBook Pro
 */
async function getAuthToken() {
  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60000) {
    return cachedToken;
  }

  const res = await makeRequest('/api/auth/login', 'POST', {
    username: SONGBOOK_USER,
    password: SONGBOOK_PASS,
  });

  if (!res.success || !res.data?.token) {
    throw new Error(res.error || 'Failed to authenticate with SongBook Pro');
  }

  cachedToken = res.data.token;
  userTeams = res.data.teams || [];
  // Default SongBook Pro tokens expire in 30 days; refresh after 25 days
  tokenExpiresAt = now + 25 * 24 * 60 * 60 * 1000;
  return cachedToken;
}

/**
 * Health / readiness check
 */
async function checkHealth() {
  try {
    const token = await getAuthToken();
    const res = await makeRequest('/api/auth/verify', 'GET', null, token);
    return {
      connected: res.success,
      username: res.data?.username || SONGBOOK_USER,
      teams: userTeams,
    };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

/**
 * List songs with client-side or backend search & filter
 */
async function getSongs({ search = '', key = '', tag = '', limit = 50, offset = 0, scope = 'user' } = {}) {
  const token = await getAuthToken();
  let path = '/api/songs';
  if (scope === 'team' && userTeams.length > 0) {
    path += `?ownerType=team&ownerId=${userTeams[0].id}`;
  }

  const res = await makeRequest(path, 'GET', null, token);
  if (!res.success) {
    throw new Error(res.error || 'Failed to fetch songs from SongBook Pro');
  }

  let songs = Array.isArray(res.data) ? res.data : [];

  // Filter by search query (title, artist, lyrics)
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    songs = songs.filter((s) => {
      const titleMatch = (s.title || '').toLowerCase().includes(q);
      const artistMatch = (s.artist || '').toLowerCase().includes(q);
      const contentMatch = (s.content || '').toLowerCase().includes(q);
      return titleMatch || artistMatch || contentMatch;
    });
  }

  // Filter by musical key
  if (key && key.trim()) {
    const k = key.trim().toUpperCase();
    songs = songs.filter((s) => (s.key || '').toUpperCase() === k);
  }

  // Filter by tag
  if (tag && tag.trim()) {
    const t = tag.trim().toLowerCase();
    songs = songs.filter((s) =>
      Array.isArray(s.tags) && s.tags.some((item) => String(item).toLowerCase().includes(t))
    );
  }

  const total = songs.length;
  const paginated = limit ? songs.slice(offset, offset + limit) : songs;

  return {
    total,
    count: paginated.length,
    offset,
    limit,
    songs: paginated,
  };
}

/**
 * Get single song by ID with full ChordPro content
 */
async function getSongById(id) {
  if (!id) throw new Error('Song ID is required');
  const token = await getAuthToken();
  const res = await makeRequest(`/api/songs/${id}`, 'GET', null, token);
  if (!res.success) {
    throw new Error(res.error || `Song not found: ${id}`);
  }
  return res.data;
}

/**
 * List all active church setlists
 */
async function getSetlists({ scope = 'all' } = {}) {
  const token = await getAuthToken();
  
  // Fetch personal setlists
  const personalRes = await makeRequest('/api/setlists', 'GET', null, token);
  let setlists = personalRes.success && Array.isArray(personalRes.data) ? personalRes.data : [];

  // Fetch team setlists if available
  if (userTeams.length > 0) {
    const teamRes = await makeRequest(`/api/setlists?ownerType=team&ownerId=${userTeams[0].id}`, 'GET', null, token);
    if (teamRes.success && Array.isArray(teamRes.data)) {
      setlists = [...setlists, ...teamRes.data];
    }
  }

  return setlists;
}

/**
 * Get single setlist with populated songs
 */
async function getSetlistById(id) {
  if (!id) throw new Error('Setlist ID is required');
  const token = await getAuthToken();
  const res = await makeRequest(`/api/setlists/${id}`, 'GET', null, token);
  if (!res.success) {
    throw new Error(res.error || `Setlist not found: ${id}`);
  }
  return res.data;
}

/**
 * Create a new song in SongBook Pro
 */
async function createSong(songData) {
  const token = await getAuthToken();
  const res = await makeRequest('/api/songs', 'POST', songData, token);
  if (!res.success) {
    throw new Error(res.error || 'Failed to create song in SongBook Pro');
  }
  return res.data;
}

/**
 * Update an existing song in SongBook Pro
 */
async function updateSong(id, songData) {
  const token = await getAuthToken();
  const res = await makeRequest(`/api/songs/${id}`, 'PUT', songData, token);
  if (!res.success) {
    throw new Error(res.error || 'Failed to update song in SongBook Pro');
  }
  return res.data;
}

/**
 * Delete a song in SongBook Pro
 */
async function deleteSong(id) {
  const token = await getAuthToken();
  const res = await makeRequest(`/api/songs/${id}`, 'DELETE', null, token);
  if (!res.success) {
    throw new Error(res.error || 'Failed to delete song in SongBook Pro');
  }
  return res.data;
}

/**
 * Get library stats
 */
async function getStats() {
  const token = await getAuthToken();
  const [songsRes, setlistsRes] = await Promise.all([
    makeRequest('/api/songs', 'GET', null, token),
    makeRequest('/api/setlists', 'GET', null, token),
  ]);

  const songs = songsRes.success && Array.isArray(songsRes.data) ? songsRes.data : [];
  const setlists = setlistsRes.success && Array.isArray(setlistsRes.data) ? setlistsRes.data : [];

  const artists = new Set();
  const keys = new Set();
  songs.forEach((s) => {
    if (s.artist) artists.add(s.artist);
    if (s.key) keys.add(s.key);
  });

  return {
    totalSongs: songs.length,
    totalSetlists: setlists.length,
    totalArtists: artists.size,
    availableKeys: Array.from(keys).sort(),
    teams: userTeams,
  };
}

module.exports = {
  checkHealth,
  getSongs,
  getSongById,
  getSetlists,
  getSetlistById,
  createSong,
  updateSong,
  deleteSong,
  getStats,
};
