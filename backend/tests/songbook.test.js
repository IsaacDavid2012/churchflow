const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const songbookService = require('../src/services/songbookService');

describe('SongBook Pro Standalone Integration Engine', () => {
  test('checkHealth verifies connection to live SongBook Pro service', async () => {
    const health = await songbookService.checkHealth();
    assert.strictEqual(typeof health, 'object');
    // If running in environment with songbook container up:
    if (health.connected) {
      assert.strictEqual(health.connected, true);
      assert.strictEqual(typeof health.username, 'string');
    }
  });

  test('getSongs retrieves songs and filters accurately by search query', async () => {
    const health = await songbookService.checkHealth();
    if (!health.connected) return; // Skip if offline

    const allRes = await songbookService.getSongs({ limit: 10 });
    assert.ok(allRes.total > 0);
    assert.ok(allRes.songs.length > 0);

    // Search for a known song
    const searchRes = await songbookService.getSongs({ search: '10000', limit: 5 });
    assert.ok(searchRes.songs.length > 0);
    assert.ok(
      searchRes.songs.some((s) => s.title.toLowerCase().includes('10000'))
    );
  });

  test('getSongById retrieves complete song with ChordPro content', async () => {
    const health = await songbookService.checkHealth();
    if (!health.connected) return;

    const listRes = await songbookService.getSongs({ limit: 1 });
    const firstSong = listRes.songs[0];
    assert.ok(firstSong?.id);

    const fullSong = await songbookService.getSongById(firstSong.id);
    assert.strictEqual(fullSong.id, firstSong.id);
    assert.strictEqual(fullSong.title, firstSong.title);
    assert.strictEqual(typeof fullSong.content, 'string');
    assert.ok(fullSong.content.length > 0);
  });

  test('getSetlists and getSetlistById retrieves church worship sets', async () => {
    const health = await songbookService.checkHealth();
    if (!health.connected) return;

    const setlists = await songbookService.getSetlists();
    assert.ok(Array.isArray(setlists));
    assert.ok(setlists.length > 0);

    const firstSet = setlists[0];
    const fullSet = await songbookService.getSetlistById(firstSet.id);
    assert.strictEqual(fullSet.id, firstSet.id);
    assert.ok(Array.isArray(fullSet.songs));
  });

  test('getStats returns total songs, setlists, and distinct artists', async () => {
    const health = await songbookService.checkHealth();
    if (!health.connected) return;

    const stats = await songbookService.getStats();
    assert.ok(stats.totalSongs > 0);
    assert.ok(stats.totalSetlists >= 0);
    assert.ok(stats.totalArtists > 0);
    assert.ok(Array.isArray(stats.availableKeys));
  });
});
