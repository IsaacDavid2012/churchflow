const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// GET /api/songs - List all songs with search & sorting
router.get('/', async (req, res, next) => {
  try {
    const { search, key } = req.query;
    let query = 'SELECT * FROM songs WHERE 1=1';
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (title ILIKE $${params.length} OR artist ILIKE $${params.length} OR lyrics_preview ILIKE $${params.length})`;
    }

    if (key) {
      params.push(key);
      query += ` AND default_key = $${params.length}`;
    }

    query += ' ORDER BY title ASC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/songs/:id
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM songs WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Song not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/songs
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, artist, default_key, bpm, time_signature, ccli_number, lyrics_preview, chart_url, youtube_url } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const result = await db.query(`
      INSERT INTO songs (title, artist, default_key, bpm, time_signature, ccli_number, lyrics_preview, chart_url, youtube_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      title,
      artist || '',
      default_key || 'C',
      bpm ? parseInt(bpm, 10) : 72,
      time_signature || '4/4',
      ccli_number || '',
      lyrics_preview || '',
      chart_url || '',
      youtube_url || ''
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/songs/:id
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { title, artist, default_key, bpm, time_signature, ccli_number, lyrics_preview, chart_url, youtube_url } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const result = await db.query(`
      UPDATE songs
      SET 
        title = $1,
        artist = $2,
        default_key = $3,
        bpm = $4,
        time_signature = $5,
        ccli_number = $6,
        lyrics_preview = $7,
        chart_url = $8,
        youtube_url = $9,
        updated_at = NOW()
      WHERE id = $10
      RETURNING *
    `, [
      title,
      artist || '',
      default_key || 'C',
      bpm ? parseInt(bpm, 10) : 72,
      time_signature || '4/4',
      ccli_number || '',
      lyrics_preview || '',
      chart_url || '',
      youtube_url || '',
      req.params.id
    ]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Song not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/songs/:id
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM songs WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Song not found' });
    res.json({ message: 'Song deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
