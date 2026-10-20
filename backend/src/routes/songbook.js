const express = require('express');
const router = express.Router();
const songbookService = require('../services/songbookService');
const { authMiddleware } = require('../middleware/auth');

// GET /api/songbook/status — Gateway Health Check (Public or Auth)
router.get('/status', async (req, res, next) => {
  try {
    const health = await songbookService.checkHealth();
    res.json(health);
  } catch (err) {
    next(err);
  }
});

// All following routes require ChurchFlow authentication (Volunteers, Musicians, Leaders, Admins)
router.use(authMiddleware);

// GET /api/songbook/me — Get authenticated user's SongBook identity, personal song count, teams
router.get('/me', async (req, res, next) => {
  try {
    const profile = await songbookService.getMyProfile(req.user);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

// GET /api/songbook/songs — Search & filter across personal, team, or all songs
router.get('/songs', async (req, res, next) => {
  try {
    const { search, key, tag, limit, offset, scope } = req.query;
    const result = await songbookService.getSongs(req.user, {
      search: search || '',
      key: key || '',
      tag: tag || '',
      limit: limit ? parseInt(limit, 10) : 1000,
      offset: offset ? parseInt(offset, 10) : 0,
      scope: scope || 'user',
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/songbook/songs/:id — Single song with full ChordPro content
router.get('/songs/:id', async (req, res, next) => {
  try {
    const song = await songbookService.getSongById(req.user, req.params.id);
    res.json(song);
  } catch (err) {
    next(err);
  }
});

// POST /api/songbook/songs — Add new or update song in personal or team library
router.post('/songs', async (req, res, next) => {
  try {
    const saved = await songbookService.saveSong(req.user, req.body);
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

// PUT /api/songbook/songs/:id — Edit song
router.put('/songs/:id', async (req, res, next) => {
  try {
    const saved = await songbookService.saveSong(req.user, { ...req.body, id: req.params.id });
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/songbook/songs/:id — Delete song
router.delete('/songs/:id', async (req, res, next) => {
  try {
    const result = await songbookService.deleteSong(req.user, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/songbook/songs/:id/copy — Copy song between personal and team
router.post('/songs/:id/copy', async (req, res, next) => {
  try {
    const copied = await songbookService.copySong(req.user, req.params.id, req.body || {});
    res.json(copied);
  } catch (err) {
    next(err);
  }
});

// GET /api/songbook/setlists — List setlists
router.get('/setlists', async (req, res, next) => {
  try {
    const setlists = await songbookService.getSetlists(req.user, { scope: req.query.scope || 'all' });
    res.json(setlists);
  } catch (err) {
    next(err);
  }
});

// GET /api/songbook/setlists/:id — Single setlist with ordered songs
router.get('/setlists/:id', async (req, res, next) => {
  try {
    const setlist = await songbookService.getSetlistById(req.user, req.params.id);
    res.json(setlist);
  } catch (err) {
    next(err);
  }
});

// POST /api/songbook/setlists — Create or update setlist (upsert)
router.post('/setlists', async (req, res, next) => {
  try {
    const saved = await songbookService.saveSetlist(req.user, req.body);
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/songbook/setlists/:id — Delete setlist
router.delete('/setlists/:id', async (req, res, next) => {
  try {
    const result = await songbookService.deleteSetlist(req.user, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// --- Backup & Universal Import / Export ---

// POST /api/songbook/backup/parse — Universal parser for .sbp, .sbpbackup, ChordPro, text
router.post('/backup/parse', async (req, res, next) => {
  try {
    const parsed = await songbookService.parseBackup(req.user, req.body);
    res.json(parsed);
  } catch (err) {
    next(err);
  }
});

// POST /api/songbook/backup/preview — Dry-run preview of import before committing
router.post('/backup/preview', async (req, res, next) => {
  try {
    const preview = await songbookService.previewBackup(req.user, req.body);
    res.json(preview);
  } catch (err) {
    next(err);
  }
});

// POST /api/songbook/backup/import — Commit import into personal or team library
router.post('/backup/import', async (req, res, next) => {
  try {
    const result = await songbookService.importBackup(req.user, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/songbook/backup/export — Download personal or team library as .sbp file
router.get('/backup/export', async (req, res, next) => {
  try {
    const exportData = await songbookService.exportBackup(req.user, req.query);
    const cleanFilename = `${(exportData.ownerName || 'SongBook').replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.sbp`;
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(exportData);
  } catch (err) {
    next(err);
  }
});

// --- Online Search & 1-Click Import ---

// GET /api/songbook/online/search — Search UltimateGuitar & WorshipTogether
router.get('/online/search', async (req, res, next) => {
  try {
    const results = await songbookService.searchOnline(req.user, {
      query: req.query.q || req.query.query || '',
      site: req.query.site || 'all',
      instrument: req.query.instrument || 'all',
    });
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// GET /api/songbook/online/fetch — Fetch online chord sheet
router.get('/online/fetch', async (req, res, next) => {
  try {
    const fetched = await songbookService.fetchOnlineSong(req.user, {
      url: req.query.url,
      site: req.query.site,
    });
    res.json(fetched);
  } catch (err) {
    next(err);
  }
});

// POST /api/songbook/online/import — 1-Click import from online source directly into library
router.post('/online/import', async (req, res, next) => {
  try {
    const imported = await songbookService.importOnlineSong(req.user, req.body);
    res.status(201).json(imported);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
