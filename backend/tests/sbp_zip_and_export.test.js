const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  createSbpZipArchive,
  parseSbpBuffer,
  keyToSbpNumber,
  sbpNumberToKey,
} = require('../src/utils/sbpZip');
const {
  renderChordProToHtml,
  buildPrintableBookletHtml,
} = require('../src/utils/chordProHtml');

describe('SongBook Pro (.sbp) ZIP Archive & Lead Sheet PDF Engine', () => {
  it('correctly maps between musical keys and SongBook Pro key integers', () => {
    assert.strictEqual(keyToSbpNumber('A'), 0);
    assert.strictEqual(keyToSbpNumber('C'), 3);
    assert.strictEqual(keyToSbpNumber('G'), 10);
    assert.strictEqual(keyToSbpNumber('F#m'), 12);

    assert.strictEqual(sbpNumberToKey(0), 'A');
    assert.strictEqual(sbpNumberToKey(3), 'C');
    assert.strictEqual(sbpNumberToKey(10), 'G');
    assert.strictEqual(sbpNumberToKey(12), 'F#m');
  });

  it('creates an authentic .sbp zip archive with dataFile.txt and dataFile.hash', () => {
    const songs = [
      {
        id: 101,
        title: 'Goodness of God',
        artist: 'Bethel Music',
        key: 'G',
        content: '{c:Verse 1}\n[G]I love You Lord\nFor Your [C]mercy never fails me',
      },
      {
        id: 102,
        title: 'Way Maker',
        artist: 'Sinach',
        key: 'E',
        content: '{c:Chorus}\n[E]Way maker, miracle worker\n[B]Promise keeper',
      },
    ];

    const setlists = [
      {
        id: 1,
        name: 'Sunday Morning Praise',
        songs: [
          { songId: 101, key: 'G' },
          { songId: 102, key: 'E' },
        ],
      },
    ];

    const zipBuffer = createSbpZipArchive({
      songs,
      setlists,
      name: 'Sunday Morning Praise',
    });

    assert.ok(Buffer.isBuffer(zipBuffer), 'Output should be a Buffer');
    assert.ok(zipBuffer.length > 500, 'Zip buffer should have valid archive length');

    // Parse it back using parseSbpBuffer
    const parsed = parseSbpBuffer(zipBuffer, 'Sunday Morning Praise.sbp');
    assert.strictEqual(parsed.songs.length, 2);
    assert.strictEqual(parsed.songs[0].title, 'Goodness of God');
    assert.strictEqual(parsed.songs[0].key, 'G');
    assert.strictEqual(parsed.songs[1].title, 'Way Maker');
    assert.strictEqual(parsed.songs[1].key, 'E');
    assert.strictEqual(parsed.setlists.length, 1);
    assert.strictEqual(parsed.setlists[0].name, 'Sunday Morning Praise');
  });

  it('correctly parses existing church SongBook Pro .sbp file from disk', () => {
    const samplePath = '/jarvis/code/songbook/Malvina (9-13-2026).sbp';
    if (fs.existsSync(samplePath)) {
      const buffer = fs.readFileSync(samplePath);
      const parsed = parseSbpBuffer(buffer, 'Malvina (9-13-2026).sbp');

      assert.ok(parsed.songs.length >= 4, 'Should parse all songs in the setlist archive');
      assert.ok(parsed.setlists.length >= 1);
      assert.ok(parsed.setlists[0].name.includes('Malvina'));

      const songTitles = parsed.songs.map((s) => s.title);
      assert.ok(songTitles.includes('Breathe'), 'Breathe should be found');
      assert.ok(songTitles.includes('The Blessing'), 'The Blessing should be found');
    }
  });

  it('renders clean HTML chord chart and printable booklet HTML for PDF export', () => {
    const song = {
      title: '10,000 Reasons',
      artist: 'Matt Redman',
      key: 'G',
      tempo: 72,
      content: '{c:Chorus}\n[C]Bless the [G]Lord O my [D/F#]soul\n[Em]O my [C]soul',
    };

    const songHtml = renderChordProToHtml(song);
    assert.ok(songHtml.includes('10,000 Reasons'), 'Title must be present in HTML');
    assert.ok(songHtml.includes('Matt Redman'), 'Artist must be present in HTML');
    assert.ok(songHtml.includes('Chorus'), 'Section comment must be rendered');
    assert.ok(songHtml.includes('chord'), 'Chords must have chord styling class');

    const bookletHtml = buildPrintableBookletHtml({
      title: 'Sunday Service Set',
      songs: [song],
    });

    assert.ok(bookletHtml.includes('<!DOCTYPE html>'));
    assert.ok(bookletHtml.includes('Sunday Service Set'));
    assert.ok(bookletHtml.includes('page-break-before: always;'));
  });
});
