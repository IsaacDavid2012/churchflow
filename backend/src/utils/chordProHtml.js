/**
 * Renders ChordPro text to a high-contrast, printable HTML lead sheet
 */
function renderChordProToHtml(contentOrSong, options = {}) {
  let content = contentOrSong;
  let opts = options;
  if (contentOrSong && typeof contentOrSong === 'object') {
    content = contentOrSong.content;
    opts = {
      title: contentOrSong.title,
      artist: contentOrSong.artist,
      key: contentOrSong.key,
      tempo: contentOrSong.tempo,
      ...options,
    };
  }
  const { title = 'Untitled Song', artist = '', key = 'C', tempo = null } = opts;
  const lines = (content || '').split('\n');
  const renderedLines = [];

  for (let rawLine of lines) {
    const line = rawLine.trimEnd();

    // Check for comment / section header directive: {c: Verse 1} or {comment: Chorus}
    const cMatch = line.match(/^\{(?:c|comment):\s*(.+?)\}/i);
    if (cMatch) {
      renderedLines.push(`<div class="section-header">${escapeHtml(cMatch[1])}</div>`);
      continue;
    }

    // Skip metadata directives that are displayed in header
    if (line.match(/^\{(?:title|t|artist|a|key|k|tempo|bpm|time|capo):/i)) {
      continue;
    }

    // Line with chords in brackets: [Em]Text [G]more text
    if (line.includes('[') && line.includes(']')) {
      renderedLines.push(renderChordLine(line));
    } else if (line.trim() === '') {
      renderedLines.push('<div class="empty-line">&nbsp;</div>');
    } else {
      renderedLines.push(`<div class="lyric-only-line">${escapeHtml(line)}</div>`);
    }
  }

  return `
    <div class="song-card">
      <div class="song-header">
        <div class="song-title-row">
          <h1 class="song-title">${escapeHtml(title)}</h1>
          <div class="song-badges">
            ${key ? `<span class="badge badge-key">Key: ${escapeHtml(key)}</span>` : ''}
            ${tempo ? `<span class="badge badge-tempo">${escapeHtml(tempo)} BPM</span>` : ''}
          </div>
        </div>
        ${artist ? `<div class="song-artist">${escapeHtml(artist)}</div>` : ''}
      </div>
      <div class="song-body">
        ${renderedLines.join('\n')}
      </div>
    </div>
  `;
}

function renderChordLine(line) {
  // Regex to extract chords and following lyrics
  const parts = [];
  const regex = /\[([A-Ga-g][^\]]*)\]([^\[]*)/g;
  let match;
  let lastIndex = 0;

  // Initial lyric segment before first chord
  const firstBracket = line.indexOf('[');
  if (firstBracket > 0) {
    parts.push(`
      <span class="chord-pair">
        <span class="chord">&nbsp;</span>
        <span class="lyric">${escapeHtml(line.substring(0, firstBracket))}</span>
      </span>
    `);
  }

  while ((match = regex.exec(line)) !== null) {
    const chord = match[1] || '';
    const lyric = match[2] || '';
    parts.push(`
      <span class="chord-pair">
        <span class="chord">${escapeHtml(chord)}</span>
        <span class="lyric">${escapeHtml(lyric) || '&nbsp;'}</span>
      </span>
    `);
    lastIndex = regex.lastIndex;
  }

  // Any remaining lyric at end
  if (lastIndex < line.length && firstBracket === -1) {
    parts.push(`
      <span class="chord-pair">
        <span class="chord">&nbsp;</span>
        <span class="lyric">${escapeHtml(line.substring(lastIndex))}</span>
      </span>
    `);
  }

  return `<div class="chord-line">${parts.join('')}</div>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Builds a full printable multi-song booklet HTML document for PDF generation
 */
function buildPrintableBookletHtml({ title = 'Worship Setlist', date = '', songs = [] }) {
  const renderedSongs = songs.map((s, idx) => {
    return `
      <div class="page-break-container ${idx > 0 ? 'page-break' : ''}">
        <div class="song-order-num">Song ${idx + 1} of ${songs.length}</div>
        ${renderChordProToHtml(s.content, {
          title: s.title,
          artist: s.artist,
          key: s.key,
          tempo: s.tempo,
        })}
      </div>
    `;
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(title)} - Chord Charts</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #0f172a;
      background: #ffffff;
      font-size: 13px;
      line-height: 1.35;
    }
    .cover-header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .church-name {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #c59c6c;
      margin-bottom: 4px;
    }
    .setlist-title {
      font-size: 24px;
      font-weight: 900;
      margin: 0 0 6px 0;
      color: #0f172a;
    }
    .setlist-meta {
      font-size: 12px;
      color: #64748b;
    }
    .page-break {
      page-break-before: always;
      break-before: page;
      margin-top: 24px;
    }
    .song-order-num {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      color: #94a3b8;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .song-card {
      margin-bottom: 24px;
    }
    .song-header {
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 8px;
      margin-bottom: 14px;
    }
    .song-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .song-title {
      font-size: 18px;
      font-weight: 900;
      margin: 0;
      color: #0f172a;
    }
    .song-artist {
      font-size: 12px;
      color: #64748b;
      margin-top: 3px;
    }
    .song-badges {
      display: flex;
      gap: 6px;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 800;
    }
    .badge-key {
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fde68a;
    }
    .badge-tempo {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #e2e8f0;
    }
    .song-body {
      font-family: "Courier New", Courier, monospace;
      font-size: 12.5px;
    }
    .section-header {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #475569;
      background: #f8fafc;
      border-left: 3px solid #c59c6c;
      padding: 3px 8px;
      margin: 12px 0 6px 0;
      border-radius: 0 4px 4px 0;
    }
    .chord-line {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      line-height: 1.25;
      margin-bottom: 3px;
    }
    .chord-pair {
      display: inline-flex;
      flex-direction: column;
      margin-right: 0px;
    }
    .chord {
      font-weight: 900;
      color: #b45309;
      font-size: 11.5px;
      min-height: 14px;
      line-height: 14px;
    }
    .lyric {
      color: #0f172a;
      white-space: pre;
      line-height: 16px;
    }
    .lyric-only-line {
      white-space: pre-wrap;
      line-height: 18px;
      color: #334155;
    }
    .empty-line {
      height: 10px;
    }
  </style>
</head>
<body>
  <div class="cover-header">
    <div class="church-name">Jesus My Rock Worship Ministry</div>
    <h1 class="setlist-title">${escapeHtml(title)}</h1>
    <div class="setlist-meta">
      ${date ? `<span>Date: ${escapeHtml(date)} • </span>` : ''}
      <span>${songs.length} Song${songs.length !== 1 ? 's' : ''}</span>
    </div>
  </div>

  ${renderedSongs.join('\n')}
</body>
</html>`;
}

module.exports = {
  renderChordProToHtml,
  buildPrintableBookletHtml,
};
