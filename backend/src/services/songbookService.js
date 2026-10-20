const http = require('http');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const SONGBOOK_HOST = process.env.SONGBOOK_HOST || (process.env.NODE_ENV === 'production' ? '192.168.192.1' : 'localhost');
const SONGBOOK_PORT = parseInt(process.env.SONGBOOK_PORT || '3008', 10);
const SONGBOOK_JWT_SECRET = process.env.SONGBOOK_JWT_SECRET || '94789bd10ed22b9bbe1f6523b35f5ba8178b1ea746600e2f239ab6c63406a0b9';
const JMR_TEAM_ID = '00ba67730fe5d7ebb82a25077fea05f2';
const JMR_INVITE_CODE = 'SBP-BHM3BZ';
const ADMIN_USER_ID = '049469692e37fb935003d1697995ee6c';

// In-memory cache for user tokens & metadata: cfUserId -> { token, sbUserId, sbUsername, teams, expiresAt }
const userTokenCache = new Map();

/**
 * Make low-level HTTP request to SongBook Pro service
 */
function makeRequest(path, method = 'GET', payload = null, token = null) {
  return new Promise((resolve) => {
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
      timeout: 12000,
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
 * Mint an Admin Token to query SongBook Pro administrative APIs
 */
function getAdminToken() {
  return jwt.sign(
    { userId: ADMIN_USER_ID, username: 'admin', isAdmin: true },
    SONGBOOK_JWT_SECRET,
    { expiresIn: '1d' }
  );
}

/**
 * Resolve or auto-provision a SongBook Pro user context for an authenticated ChurchFlow user
 */
async function getUserContext(cfUser) {
  if (!cfUser) {
    throw new Error('User context required');
  }

  const cacheKey = cfUser.id || cfUser.username;
  const cached = userTokenCache.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expiresAt > now + 60000) {
    return cached;
  }

  const adminToken = getAdminToken();
  const usersRes = await makeRequest('/api/admin/users', 'GET', null, adminToken);

  let sbUsers = usersRes.success && Array.isArray(usersRes.data) ? usersRes.data : [];
  let matchedSbUser = null;

  const cfUsername = (cfUser.username || '').toLowerCase().trim();
  const cfEmail = (cfUser.email || '').toLowerCase().trim();
  const cfName = (cfUser.name || '').toLowerCase().trim();

  // 1. Exact or case-insensitive match on username
  matchedSbUser = sbUsers.find(
    (u) => (u.username || '').toLowerCase() === cfUsername
  );

  // 2. Match on email if username didn't match
  if (!matchedSbUser && cfEmail) {
    matchedSbUser = sbUsers.find(
      (u) => (u.username || '').toLowerCase() === cfEmail
    );
  }

  // 3. Match on display name first word (e.g. Isaac, Cynthia)
  if (!matchedSbUser && cfName) {
    const firstName = cfName.split(' ')[0];
    matchedSbUser = sbUsers.find(
      (u) => (u.username || '').toLowerCase() === firstName
    );
  }

  // 4. Auto-provision in SongBook Pro if not found
  if (!matchedSbUser) {
    const regUsername = cfUser.username || (cfName ? cfName.replace(/\s+/g, '_') : `user_${cfUser.id.slice(0, 6)}`);
    const regPass = `CF_${crypto.randomBytes(6).toString('hex')}`;
    const regRes = await makeRequest('/api/auth/register', 'POST', {
      username: regUsername,
      password: regPass,
      inviteCode: JMR_INVITE_CODE,
    });

    if (regRes.success && regRes.data?.userId) {
      matchedSbUser = {
        id: regRes.data.userId,
        username: regRes.data.username || regUsername,
        isAdmin: false,
      };
    } else {
      // Fallback: use Isaac account if provisioning fails
      matchedSbUser = sbUsers.find((u) => u.username === 'Isaac') || {
        id: '0ba5967f1e0ebc418ee419358e61cf16',
        username: 'Isaac',
        isAdmin: false,
      };
    }
  }

  // Mint user-scoped SongBook Pro JWT
  const token = jwt.sign(
    {
      userId: matchedSbUser.id,
      username: matchedSbUser.username,
      isAdmin: cfUser.role === 'admin' || !!matchedSbUser.isAdmin,
    },
    SONGBOOK_JWT_SECRET,
    { expiresIn: '30d' }
  );

  // Verify and fetch user teams
  const verifyRes = await makeRequest('/api/auth/verify', 'GET', null, token);
  let teams = verifyRes.success && Array.isArray(verifyRes.data?.teams) ? verifyRes.data.teams : [];

  if (teams.length === 0) {
    teams = [{ id: JMR_TEAM_ID, name: 'Jesus My Rock', inviteCode: JMR_INVITE_CODE }];
  }

  const context = {
    token,
    userId: matchedSbUser.id,
    username: matchedSbUser.username,
    isAdmin: !!matchedSbUser.isAdmin || cfUser.role === 'admin',
    teams,
    primaryTeamId: teams[0]?.id || JMR_TEAM_ID,
    expiresAt: now + 25 * 24 * 60 * 60 * 1000,
  };

  userTokenCache.set(cacheKey, context);
  return context;
}

/**
 * Health / readiness check
 */
async function checkHealth() {
  try {
    const adminToken = getAdminToken();
    const res = await makeRequest('/api/auth/verify', 'GET', null, adminToken);
    return {
      connected: res.success,
      status: res.success ? 'healthy' : 'error',
      username: 'Isaac',
      port: SONGBOOK_PORT,
      host: SONGBOOK_HOST,
    };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

/**
 * Normalizes parameters so methods accept either (cfUser, options) or (options)
 */
function normalizeUserAndOptions(cfUserOrOptions, maybeOptions) {
  if (!maybeOptions && cfUserOrOptions && !cfUserOrOptions.id && !cfUserOrOptions.username && !cfUserOrOptions.role) {
    return {
      cfUser: { username: 'Isaac', role: 'admin' },
      options: cfUserOrOptions || {},
    };
  }
  const cfUser = cfUserOrOptions || { username: 'Isaac', role: 'admin' };
  const options = maybeOptions || {};
  return { cfUser, options };
}

/**
 * Get library overview stats
 */
async function getStats(cfUser) {
  const user = cfUser || { username: 'Isaac', role: 'admin' };
  const ctx = await getUserContext(user);
  const [songsRes, setlistsRes] = await Promise.all([
    makeRequest(`/api/songs?ownerType=user&ownerId=${ctx.userId}`, 'GET', null, ctx.token),
    makeRequest(`/api/setlists?ownerType=user&ownerId=${ctx.userId}`, 'GET', null, ctx.token),
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
    teams: ctx.teams,
  };
}

/**
 * Get current user SongBook profile & library stats
 */
async function getMyProfile(cfUser) {
  const ctx = await getUserContext(cfUser);
  const [songsRes, setlistsRes] = await Promise.all([
    makeRequest(`/api/songs?ownerType=user&ownerId=${ctx.userId}`, 'GET', null, ctx.token),
    makeRequest(`/api/setlists?ownerType=user&ownerId=${ctx.userId}`, 'GET', null, ctx.token),
  ]);

  const personalSongs = songsRes.success && Array.isArray(songsRes.data) ? songsRes.data : [];
  const personalSetlists = setlistsRes.success && Array.isArray(setlistsRes.data) ? setlistsRes.data : [];

  return {
    songbookUserId: ctx.userId,
    songbookUsername: ctx.username,
    personalSongCount: personalSongs.length,
    personalSetlistCount: personalSetlists.length,
    teams: ctx.teams,
  };
}

/**
 * List songs with client-side or backend search & filter for a user
 */
async function getSongs(cfUserOrOptions, maybeOptions) {
  const { cfUser, options } = normalizeUserAndOptions(cfUserOrOptions, maybeOptions);
  const { search = '', key = '', tag = '', limit = 1000, offset = 0, scope = 'user' } = options;
  const ctx = await getUserContext(cfUser);
  let songs = [];

  if (scope === 'user') {
    const res = await makeRequest(`/api/songs?ownerType=user&ownerId=${ctx.userId}`, 'GET', null, ctx.token);
    songs = res.success && Array.isArray(res.data) ? res.data : [];
  } else if (scope === 'team') {
    const teamId = ctx.primaryTeamId;
    const res = await makeRequest(`/api/songs?ownerType=team&ownerId=${teamId}`, 'GET', null, ctx.token);
    songs = res.success && Array.isArray(res.data) ? res.data : [];
  } else {
    // 'all' scope: merge personal and team songs
    const [personalRes, teamRes] = await Promise.all([
      makeRequest(`/api/songs?ownerType=user&ownerId=${ctx.userId}`, 'GET', null, ctx.token),
      makeRequest(`/api/songs?ownerType=team&ownerId=${ctx.primaryTeamId}`, 'GET', null, ctx.token),
    ]);
    const pSongs = personalRes.success && Array.isArray(personalRes.data) ? personalRes.data : [];
    const tSongs = teamRes.success && Array.isArray(teamRes.data) ? teamRes.data : [];
    
    // Deduplicate by title+artist
    const seen = new Set();
    for (const s of [...pSongs, ...tSongs]) {
      const k = `${(s.title || '').toLowerCase()}:::${(s.artist || '').toLowerCase()}`;
      if (!seen.has(k)) {
        seen.add(k);
        songs.push(s);
      }
    }
  }

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
  if (key && key.trim() && key !== 'All') {
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
    scope,
    username: ctx.username,
  };
}

/**
 * Get single song by ID with full ChordPro content
 */
async function getSongById(cfUserOrId, maybeId) {
  let cfUser = { username: 'Isaac', role: 'admin' };
  let id = cfUserOrId;
  if (maybeId) {
    cfUser = cfUserOrId;
    id = maybeId;
  }
  if (!id) throw new Error('Song ID is required');
  const ctx = await getUserContext(cfUser);
  const res = await makeRequest(`/api/songs/${id}`, 'GET', null, ctx.token);
  if (!res.success) {
    throw new Error(res.error || `Song not found: ${id}`);
  }
  return res.data;
}

/**
 * Create or update a song in user's personal or team library
 */
async function saveSong(cfUser, songData) {
  if (!songData || !songData.title) {
    throw new Error('Song title is required');
  }
  const ctx = await getUserContext(cfUser);
  const ownerType = songData.ownerType || 'user';
  const ownerId = ownerType === 'user' ? ctx.userId : (songData.ownerId || ctx.primaryTeamId);

  const payload = {
    id: songData.id || crypto.randomBytes(16).toString('hex'),
    ownerType,
    ownerId,
    title: songData.title.trim(),
    artist: songData.artist || '',
    key: songData.key || 'C',
    tempo: parseInt(songData.tempo || '100', 10),
    tags: Array.isArray(songData.tags) ? songData.tags : [],
    content: songData.content || '',
  };

  const res = await makeRequest('/api/songs', 'POST', payload, ctx.token);
  if (!res.success) {
    throw new Error(res.error || 'Failed to save song in SongBook Pro');
  }
  return res.data;
}

/**
 * Delete a song
 */
async function deleteSong(cfUser, id) {
  if (!id) throw new Error('Song ID is required');
  const ctx = await getUserContext(cfUser);
  const res = await makeRequest(`/api/songs/${id}`, 'DELETE', null, ctx.token);
  if (!res.success) {
    throw new Error(res.error || 'Failed to delete song');
  }
  return res.data;
}

/**
 * Copy song between personal and team libraries
 */
async function copySong(cfUser, id, { targetScope = 'team', targetScopeId = null }) {
  if (!id) throw new Error('Song ID is required');
  const ctx = await getUserContext(cfUser);
  const finalTargetOwnerId = targetScope === 'user' ? ctx.userId : (targetScopeId || ctx.primaryTeamId);

  const payload = {
    targetOwnerType: targetScope,
    targetOwnerId: finalTargetOwnerId,
  };

  const res = await makeRequest(`/api/songs/${id}/copy`, 'POST', payload, ctx.token);
  if (!res.success) {
    throw new Error(res.error || 'Failed to copy song');
  }
  return res.data;
}

/**
 * List setlists
 */
async function getSetlists(cfUserOrOptions, maybeOptions) {
  const { cfUser, options } = normalizeUserAndOptions(cfUserOrOptions, maybeOptions);
  const { scope = 'all' } = options;
  const ctx = await getUserContext(cfUser);
  let setlists = [];

  if (scope === 'user') {
    const res = await makeRequest(`/api/setlists?ownerType=user&ownerId=${ctx.userId}`, 'GET', null, ctx.token);
    setlists = res.success && Array.isArray(res.data) ? res.data : [];
  } else if (scope === 'team') {
    const res = await makeRequest(`/api/setlists?ownerType=team&ownerId=${ctx.primaryTeamId}`, 'GET', null, ctx.token);
    setlists = res.success && Array.isArray(res.data) ? res.data : [];
  } else {
    const [pRes, tRes] = await Promise.all([
      makeRequest(`/api/setlists?ownerType=user&ownerId=${ctx.userId}`, 'GET', null, ctx.token),
      makeRequest(`/api/setlists?ownerType=team&ownerId=${ctx.primaryTeamId}`, 'GET', null, ctx.token),
    ]);
    const pSetlists = pRes.success && Array.isArray(pRes.data) ? pRes.data : [];
    const tSetlists = tRes.success && Array.isArray(tRes.data) ? tRes.data : [];
    setlists = [...pSetlists, ...tSetlists];
  }

  return setlists;
}

/**
 * Get single setlist with populated songs
 */
async function getSetlistById(cfUserOrId, maybeId) {
  let cfUser = { username: 'Isaac', role: 'admin' };
  let id = cfUserOrId;
  if (maybeId) {
    cfUser = cfUserOrId;
    id = maybeId;
  }
  if (!id) throw new Error('Setlist ID is required');
  const ctx = await getUserContext(cfUser);
  const res = await makeRequest(`/api/setlists/${id}`, 'GET', null, ctx.token);
  if (!res.success) {
    throw new Error(res.error || `Setlist not found: ${id}`);
  }
  return res.data;
}

/**
 * Save or update setlist
 */
async function saveSetlist(cfUser, setlistData) {
  if (!setlistData || !setlistData.name) {
    throw new Error('Setlist name is required');
  }
  const ctx = await getUserContext(cfUser);
  const ownerType = setlistData.ownerType || 'user';
  const ownerId = ownerType === 'user' ? ctx.userId : (setlistData.ownerId || ctx.primaryTeamId);

  const payload = {
    id: setlistData.id || crypto.randomBytes(16).toString('hex'),
    ownerType,
    ownerId,
    name: setlistData.name.trim(),
    songIds: Array.isArray(setlistData.songIds) ? setlistData.songIds : [],
    songKeyOverrides: setlistData.songKeyOverrides || {},
  };

  const res = await makeRequest('/api/setlists', 'POST', payload, ctx.token);
  if (!res.success) {
    throw new Error(res.error || 'Failed to save setlist in SongBook Pro');
  }
  return res.data;
}

/**
 * Delete a setlist
 */
async function deleteSetlist(cfUser, id) {
  if (!id) throw new Error('Setlist ID is required');
  const ctx = await getUserContext(cfUser);
  const res = await makeRequest(`/api/setlists/${id}`, 'DELETE', null, ctx.token);
  if (!res.success) {
    throw new Error(res.error || 'Failed to delete setlist');
  }
  return res.data;
}

/**
 * Universal Backup Parse (.sbp, .sbpbackup, ChordPro, JSON, ZIP)
 */
async function parseBackup(cfUser, { fileBase64, fileText, fileName = 'Imported_SongBook.sbp' }) {
  const ctx = await getUserContext(cfUser);
  const res = await makeRequest('/api/backup/parse', 'POST', { fileBase64, fileText, fileName }, ctx.token);
  if (!res.success) {
    throw new Error(res.error || 'Failed to parse file format');
  }
  return res.data?.data || res.data;
}

/**
 * Dry-run preview of import before committing
 */
async function previewBackup(cfUser, { backupData, targetOwnerType = 'user', targetOwnerId = null, fileName = 'Imported_Setlist.sbp' }) {
  const ctx = await getUserContext(cfUser);
  const finalOwnerId = targetOwnerType === 'user' ? ctx.userId : (targetOwnerId || ctx.primaryTeamId);

  const payload = {
    backupData,
    targetOwnerType,
    targetOwnerId: finalOwnerId,
    fileName,
  };

  const res = await makeRequest('/api/backup/preview', 'POST', payload, ctx.token);
  if (!res.success) {
    throw new Error(res.error || 'Failed to preview backup');
  }
  return res.data;
}

/**
 * Commit import into user's personal or team library
 */
async function importBackup(cfUser, { backupData, targetOwnerType = 'user', targetOwnerId = null, strategy = 'skip' }) {
  const ctx = await getUserContext(cfUser);
  const finalOwnerId = targetOwnerType === 'user' ? ctx.userId : (targetOwnerId || ctx.primaryTeamId);

  const payload = {
    backupData,
    targetOwnerType,
    targetOwnerId: finalOwnerId,
    strategy, // 'skip' | 'overwrite' | 'duplicate'
  };

  const res = await makeRequest('/api/backup/import', 'POST', payload, ctx.token);
  if (!res.success) {
    throw new Error(res.error || 'Failed to import songs into SongBook Pro');
  }
  return res.data;
}

/**
 * Export library as .sbp format
 */
async function exportBackup(cfUser, { ownerType = 'user', ownerId = null } = {}) {
  const ctx = await getUserContext(cfUser);
  const finalOwnerId = ownerType === 'user' ? ctx.userId : (ownerId || ctx.primaryTeamId);

  const res = await makeRequest(`/api/backup/export?ownerType=${ownerType}&ownerId=${finalOwnerId}`, 'GET', null, ctx.token);
  if (!res.success) {
    throw new Error(res.error || 'Failed to export library');
  }
  return res.data;
}

/**
 * Search Online (UltimateGuitar & WorshipTogether)
 */
async function searchOnline(cfUser, { query, site = 'all', instrument = 'all' }) {
  if (!query || !query.trim()) {
    throw new Error('Search query is required');
  }
  const ctx = await getUserContext(cfUser);
  const q = encodeURIComponent(query.trim());
  const s = encodeURIComponent(site);
  const inst = encodeURIComponent(instrument);

  const res = await makeRequest(`/api/online/search?q=${q}&site=${s}&instrument=${inst}`, 'GET', null, ctx.token);
  if (!res.success) {
    throw new Error(res.error || 'Failed to search online sources');
  }
  return res.data;
}

/**
 * Fetch online song details & ChordPro content from UltimateGuitar or WorshipTogether
 */
async function fetchOnlineSong(cfUser, { url, site }) {
  if (!url) throw new Error('Song URL is required');
  const ctx = await getUserContext(cfUser);
  const u = encodeURIComponent(url);
  const s = encodeURIComponent(site || '');

  const res = await makeRequest(`/api/online/fetch?url=${u}&site=${s}`, 'GET', null, ctx.token);
  if (!res.success) {
    throw new Error(res.error || 'Failed to fetch online song chord sheet');
  }
  return res.data;
}

/**
 * One-click Import Online Song directly into personal or team library
 */
async function importOnlineSong(cfUser, { url, site, targetOwnerType = 'user', targetOwnerId = null }) {
  const fetched = await fetchOnlineSong(cfUser, { url, site });
  if (!fetched || !fetched.title) {
    throw new Error('Invalid song content retrieved from source');
  }

  const saved = await saveSong(cfUser, {
    ownerType: targetOwnerType,
    ownerId: targetOwnerId,
    title: fetched.title,
    artist: fetched.artist || '',
    key: fetched.key || 'C',
    content: fetched.content || '',
    tags: [site || 'OnlineImport'],
  });

  return saved;
}

module.exports = {
  checkHealth,
  getUserContext,
  getMyProfile,
  getStats,
  getSongs,
  getSongById,
  saveSong,
  deleteSong,
  copySong,
  getSetlists,
  getSetlistById,
  saveSetlist,
  deleteSetlist,
  parseBackup,
  previewBackup,
  importBackup,
  exportBackup,
  searchOnline,
  fetchOnlineSong,
  importOnlineSong,
};
