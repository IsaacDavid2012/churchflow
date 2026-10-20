const { test, describe } = require('node:test');
const assert = require('node:assert');
const songbookService = require('../src/services/songbookService');

describe('SongBook Pro User Scoping & Online Search Engine', () => {
  const isaacUser = { id: '4e496f6c-7c51-4479-af63-85930f9ed90f', username: 'Isaac', name: 'Isaac David', role: 'admin' };
  const cynthiaUser = { id: 'cf_cynthia_test_id', username: 'Cynthia', name: 'Cynthia', role: 'volunteer' };

  test('getUserContext resolves distinct identities for Isaac and Cynthia', async () => {
    const health = await songbookService.checkHealth();
    if (!health.connected) return;

    const [isaacCtx, cynthiaCtx] = await Promise.all([
      songbookService.getUserContext(isaacUser),
      songbookService.getUserContext(cynthiaUser),
    ]);

    assert.ok(isaacCtx.userId);
    assert.ok(cynthiaCtx.userId);
    assert.notStrictEqual(isaacCtx.userId, cynthiaCtx.userId);
    assert.strictEqual(isaacCtx.username, 'Isaac');
    assert.strictEqual(cynthiaCtx.username, 'Cynthia');
  });

  test('getMyProfile returns user-specific personal song counts', async () => {
    const health = await songbookService.checkHealth();
    if (!health.connected) return;

    const [isaacProfile, cynthiaProfile] = await Promise.all([
      songbookService.getMyProfile(isaacUser),
      songbookService.getMyProfile(cynthiaUser),
    ]);

    assert.strictEqual(typeof isaacProfile.personalSongCount, 'number');
    assert.strictEqual(typeof cynthiaProfile.personalSongCount, 'number');
    assert.ok(isaacProfile.personalSongCount > 900);
    assert.ok(cynthiaProfile.personalSongCount > 900);
  });

  test('getSongs respects user scope and returns user-specific library', async () => {
    const health = await songbookService.checkHealth();
    if (!health.connected) return;

    const cynthiaSongs = await songbookService.getSongs(cynthiaUser, { scope: 'user', limit: 10 });
    assert.strictEqual(cynthiaSongs.scope, 'user');
    assert.strictEqual(cynthiaSongs.username, 'Cynthia');
    assert.ok(cynthiaSongs.songs.length > 0);
  });

  test('searchOnline queries UltimateGuitar and WorshipTogether successfully', async () => {
    const health = await songbookService.checkHealth();
    if (!health.connected) return;

    const searchRes = await songbookService.searchOnline(isaacUser, { query: 'Way Maker', site: 'all' });
    assert.ok(Array.isArray(searchRes.results));
    assert.ok(searchRes.results.length > 0);

    const first = searchRes.results[0];
    assert.ok(first.title);
    assert.ok(first.url);
    assert.ok(first.site);
  });

  test('fetchOnlineSong retrieves chord sheet and converts into ChordPro', async () => {
    const health = await songbookService.checkHealth();
    if (!health.connected) return;

    const searchRes = await songbookService.searchOnline(isaacUser, { query: '10000 Reasons', site: 'ug' });
    if (!searchRes.results || searchRes.results.length === 0) return;

    const song = searchRes.results[0];
    const fetched = await songbookService.fetchOnlineSong(isaacUser, { url: song.url, site: song.site });
    assert.ok(fetched.title);
    assert.ok(typeof fetched.content, 'string');
    assert.ok(fetched.content.length > 0);
  });

  test('parseBackup parses raw ChordPro text into song structure', async () => {
    const sampleChordPro = `{title: Amazing Grace}
{artist: John Newton}
{key: G}
[G]Amazing grace how [C]sweet the [G]sound`;

    const parsed = await songbookService.parseBackup(isaacUser, {
      fileText: sampleChordPro,
      fileName: 'Amazing_Grace.pro',
    });

    assert.ok(parsed);
    assert.ok(Array.isArray(parsed.songs));
    assert.strictEqual(parsed.songs.length, 1);
    assert.strictEqual(parsed.songs[0].title, 'Amazing Grace');
  });
});
