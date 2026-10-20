const crypto = require('crypto');
const AdmZip = require('adm-zip');

// SongBook Pro numerical key mapping
const SBP_KEY_MAP = {
  0: 'A', 1: 'Bb', 2: 'B', 3: 'C', 4: 'C#', 5: 'D', 6: 'Eb', 7: 'E', 8: 'F', 9: 'F#', 10: 'G', 11: 'Ab',
  12: 'F#m', 13: 'Gm', 14: 'Abm', 15: 'Am', 16: 'Bbm', 17: 'Bm', 18: 'Cm', 19: 'C#m', 20: 'Dm', 21: 'Ebm', 22: 'Em', 23: 'Fm'
};

const KEY_TO_SBP = {
  'A': 0, 'Bb': 1, 'A#': 1, 'B': 2, 'C': 3, 'C#': 4, 'Db': 4, 'D': 5, 'Eb': 6, 'D#': 6, 'E': 7,
  'F': 8, 'F#': 9, 'Gb': 9, 'G': 10, 'Ab': 11, 'G#': 11,
  'F#m': 12, 'Gbm': 12, 'Gm': 13, 'Abm': 14, 'G#m': 14, 'Am': 15, 'Bbm': 16, 'A#m': 16, 'Bm': 17,
  'Cm': 18, 'C#m': 19, 'Dbm': 19, 'Dm': 20, 'Ebm': 21, 'D#m': 21, 'Em': 22, 'Fm': 23
};

/**
 * Creates an authentic SongBook Pro .sbp ZIP Archive (dataFile.txt + dataFile.hash)
 */
function createSbpZipArchive({ songs = [], setlists = [], name = 'Worship_Set' }) {
  const zip = new AdmZip();

  // Convert songs to SongBook Pro schema
  const sbpSongs = songs.map((s, idx) => {
    const rawKey = (s.key || 'C').trim();
    const sbpKeyNum = KEY_TO_SBP[rawKey] !== undefined ? KEY_TO_SBP[rawKey] : 3;

    return {
      Id: parseInt(s.id, 10) || (1000 + idx),
      name: s.title || 'Untitled Song',
      author: s.artist || '',
      Capo: 0,
      content: s.content || '',
      hash: crypto.createHash('md5').update(s.content || s.title || '').digest('hex'),
      key: sbpKeyNum,
      KeyShift: 0,
      subTitle: '',
      type: 1,
      ModifiedDateTime: new Date().toISOString(),
      Deleted: false,
      SyncId: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
      timeSig: s.timeSig || '4/4',
      ZoomFactor: 1.0,
      Duration: 0,
      Duration2: 0,
      _displayParams: '{}',
      TempoInt: parseInt(s.tempo, 10) || 100,
      _tags: JSON.stringify(Array.isArray(s.tags) ? s.tags : []),
      Url: '',
      DeepSearch: `${s.title || ''}\n${s.artist || ''}\n`.toLowerCase(),
      Copyright: '',
      NotesText: s.notes || '',
      Zoom: 1.0,
      SectionOrder: '',
      SongNumber: 0,
      HasChildren: 0,
      ParentId: 0,
      vName: null,
      locked: 0,
      LinkedAudio: null,
      Chords: null,
      midiOnLoad: null,
      importSource: null,
      _folders: '[]',
      drawingPathsBackup: null,
    };
  });

  // Convert setlists to SongBook Pro sets schema
  const sbpSets = setlists.map((sl, setIdx) => {
    const setId = parseInt(sl.id, 10) || (2000 + setIdx);
    const contents = (sl.songIds || []).map((songId, order) => {
      const targetSong = sbpSongs.find((s) => String(s.Id) === String(songId)) || sbpSongs[order];
      const overrideKey = sl.songKeyOverrides ? sl.songKeyOverrides[songId] : null;
      const keyOfSet = overrideKey && KEY_TO_SBP[overrideKey] !== undefined ? KEY_TO_SBP[overrideKey] : (targetSong ? targetSong.key : 0);

      return {
        Id: 5000 + order,
        Order: order,
        Capo: 0,
        SetId: setId,
        SongId: targetSong ? targetSong.Id : (parseInt(songId, 10) || 1000 + order),
        keyOfset: keyOfSet,
        ModifiedDateTime: new Date().toISOString(),
        Deleted: 0,
        SyncId: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
        NotesText: null,
        SectionOrder: '',
        ItemType: 1,
        Content: '',
        drawingPathsBackup: null,
      };
    });

    return {
      details: {
        Id: setId,
        name: sl.name || name || 'Worship Set',
        date: sl.date || new Date().toISOString(),
        ModifiedDateTime: new Date().toISOString(),
        Deleted: 0,
        SyncId: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
        pinned: 0,
      },
      contents,
    };
  });

  const payloadObj = {
    songs: sbpSongs,
    sets: sbpSets,
    folders: [],
  };

  const jsonString = JSON.stringify(payloadObj);
  const dataFileContent = `1.0\n${jsonString}`;
  const dataFileHash = crypto.createHash('md5').update(dataFileContent).digest('hex');

  // Add files to ZIP
  zip.addFile('dataFile.txt', Buffer.from(dataFileContent, 'utf8'));
  zip.addFile('dataFile.hash', Buffer.from(dataFileHash, 'utf8'));

  return zip.toBuffer();
}

/**
 * Universal Parser for incoming .sbp (ZIP), SQLite, JSON, or ChordPro buffer
 */
function parseSbpBuffer(buffer, fallbackName = 'Imported_Setlist') {
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty file buffer provided');
  }

  // 1. Check if ZIP Archive (SongBook Pro format)
  if (buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4B) {
    try {
      const zip = new AdmZip(buffer);
      const zipEntries = zip.getEntries();
      const dataEntry = zipEntries.find((e) => e.entryName.toLowerCase() === 'datafile.txt');

      if (dataEntry) {
        let text = dataEntry.getData().toString('utf8');
        // Strip version line
        const vMatch = text.match(/^(\d+\.\d+)\r?\n([\s\S]+)$/);
        if (vMatch) {
          text = vMatch[2];
        }
        const json = JSON.parse(text);
        return formatParsedResult(json, fallbackName);
      }
    } catch (err) {
      console.warn('[sbpZip] Failed to parse as ZIP archive:', err.message);
    }
  }

  // 2. Check if JSON string
  try {
    const text = buffer.toString('utf8').trim();
    if (text.startsWith('{') || text.startsWith('[')) {
      const json = JSON.parse(text);
      return formatParsedResult(json, fallbackName);
    }
  } catch (err) {
    // Not valid JSON
  }

  // 3. ChordPro Plain Text Fallback
  const textContent = buffer.toString('utf8');
  return parseChordProPlainText(textContent, fallbackName);
}

function formatParsedResult(data, fallbackName) {
  const songs = [];
  const rawSongs = Array.isArray(data.songs) ? data.songs : [];

  for (const s of rawSongs) {
    let key = 'C';
    if (typeof s.key === 'number' && SBP_KEY_MAP[s.key]) {
      key = SBP_KEY_MAP[s.key];
    } else if (s.key && typeof s.key === 'string') {
      key = s.key;
    }

    let tags = [];
    if (s._tags) {
      try {
        tags = JSON.parse(s._tags);
      } catch (e) {
        tags = String(s._tags).split(',').map((t) => t.trim()).filter(Boolean);
      }
    } else if (Array.isArray(s.tags)) {
      tags = s.tags;
    }

    songs.push({
      id: String(s.Id || s.id || crypto.randomBytes(6).toString('hex')),
      title: s.name || s.title || 'Untitled Song',
      artist: s.author || s.artist || '',
      key,
      tempo: parseInt(s.TempoInt || s.tempo || s.bpm, 10) || 100,
      tags,
      content: s.content || '',
    });
  }

  const setlists = [];
  const rawSets = Array.isArray(data.sets) ? data.sets : (Array.isArray(data.setlists) ? data.setlists : []);

  for (const setItem of rawSets) {
    let slName = '';
    let slId = '';
    let slSongIds = [];
    let slOverrides = {};

    if (setItem.details) {
      slName = setItem.details.name || fallbackName;
      slId = String(setItem.details.Id || crypto.randomBytes(6).toString('hex'));
      const contents = Array.isArray(setItem.contents) ? setItem.contents : [];
      contents.sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0));
      for (const item of contents) {
        const sid = String(item.SongId || item.songId || item.Id);
        slSongIds.push(sid);
        if (item.keyOfset !== undefined && SBP_KEY_MAP[item.keyOfset]) {
          slOverrides[sid] = SBP_KEY_MAP[item.keyOfset];
        }
      }
    } else if (setItem.name || setItem.title) {
      slName = setItem.name || setItem.title;
      slId = String(setItem.id || crypto.randomBytes(6).toString('hex'));
      slSongIds = (setItem.songIds || setItem.songs || []).map(String);
      if (setItem.songKeyOverrides) slOverrides = setItem.songKeyOverrides;
    }

    if (slName) {
      setlists.push({
        id: slId,
        name: slName.trim(),
        songIds: slSongIds,
        songKeyOverrides: slOverrides,
      });
    }
  }

  // If there are songs but no setlist, create a default setlist containing all songs
  if (setlists.length === 0 && songs.length > 0) {
    setlists.push({
      id: crypto.randomBytes(6).toString('hex'),
      name: fallbackName,
      songIds: songs.map((s) => s.id),
      songKeyOverrides: {},
    });
  }

  return {
    format: 'songbook-pro-zip',
    name: setlists.length > 0 ? setlists[0].name : fallbackName,
    songs,
    setlists,
  };
}

function parseChordProPlainText(text, fallbackName) {
  const lines = text.split('\n');
  let title = '';
  let artist = '';
  let key = 'C';
  let tempo = 100;

  for (const line of lines) {
    const t = line.match(/^\{(?:title|t):\s*(.+?)\}/i);
    if (t && !title) title = t[1].trim();
    const a = line.match(/^\{(?:artist|a|subtitle|st):\s*(.+?)\}/i);
    if (a && !artist) artist = a[1].trim();
    const k = line.match(/^\{(?:key|k):\s*(.+?)\}/i);
    if (k) key = k[1].trim();
    const b = line.match(/^\{(?:tempo|bpm):\s*(\d+)\}/i);
    if (b) tempo = parseInt(b[1], 10) || 100;
  }

  const songId = crypto.randomBytes(6).toString('hex');
  const song = {
    id: songId,
    title: title || fallbackName,
    artist: artist || '',
    key: key || 'C',
    tempo: tempo || 100,
    tags: [],
    content: text,
  };

  return {
    format: 'chordpro-text',
    name: fallbackName,
    songs: [song],
    setlists: [
      {
        id: crypto.randomBytes(6).toString('hex'),
        name: fallbackName,
        songIds: [songId],
        songKeyOverrides: {},
      },
    ],
  };
}

function keyToSbpNumber(key) {
  const clean = (key || 'C').trim();
  return KEY_TO_SBP[clean] !== undefined ? KEY_TO_SBP[clean] : 3;
}

function sbpNumberToKey(num) {
  return SBP_KEY_MAP[num] || 'C';
}

module.exports = {
  createSbpZipArchive,
  parseSbpBuffer,
  keyToSbpNumber,
  sbpNumberToKey,
  SBP_KEY_MAP,
  KEY_TO_SBP,
};
