const express = require('express');
const router = express.Router();
const songbookService = require('../services/songbookService');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../../../shared/roles');

// GET /api/songbook/status — Gateway Health Check
router.get('/status', async (req, res, next) => {
  try {
    const health = await songbookService.checkHealth();
    res.json(health);
  } catch (err) {
    next(err);
  }
});

// GET /api/songbook/stats — Song library overview & key distributions
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await songbookService.getStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// GET /api/songbook/songs — Search & filter across church songbook
router.get('/songs', async (req, res, next) => {
  try {
    const { search, key, tag, limit, offset, scope } = req.query;
    const result = await songbookService.getSongs({
      search: search || '',
      key: key || '',
      tag: tag || '',
      limit: limit ? parseInt(limit, 10) : 50,
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
    const song = await songbookService.getSongById(req.params.id);
    res.json(song);
  } catch (err) {
    next(err);
  }
});

// GET /api/songbook/setlists — List all active church setlists
router.get('/setlists', async (req, res, next) => {
  try {
    const setlists = await songbookService.getSetlists({ scope: req.query.scope || 'all' });
    res.json(setlists);
  } catch (err) {
    next(err);
  }
});

// GET /api/songbook/setlists/:id — Single setlist with ordered songs
router.get('/setlists/:id', async (req, res, next) => {
  try {
    const setlist = await songbookService.getSetlistById(req.params.id);
    res.json(setlist);
  } catch (err) {
    next(err);
  }
});

// POST /api/songbook/songs — Add new song to library (Admin, Pastor, Manager, Leader)
router.post(
  '/songs',
  requireAuth,
  requireRole([ROLES.ADMIN, ROLES.PASTOR, ROLES.MANAGER, ROLES.LEADER]),
  async (req, res, next) => {
    try {
      const created = await songbookService.createSong(req.body);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/songbook/songs/:id — Edit song (Admin, Pastor, Manager, Leader)
router.put(
  '/songs/:id',
  requireAuth,
  requireRole([ROLES.ADMIN, ROLES.PASTOR, ROLES.MANAGER, ROLES.LEADER]),
  async (req, res, next) => {
    try {
      const updated = await songbookService.updateSong(req.params.id, req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/songbook/songs/:id — Delete song (Admin, Pastor only)
router.delete(
  '/songs/:id',
  requireAuth,
  requireRole([ROLES.ADMIN, ROLES.PASTOR]),
  async (req, res, next) => {
    try {
      const result = await songbookService.deleteSong(req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
