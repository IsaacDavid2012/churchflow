/**
 * Renders ChordPro text to a high-contrast, printable 2-column HTML lead sheet
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
      time: contentOrSong.time,
      ...options,
    };
  }
  const { title = 'Untitled Song', artist = '', key = 'C', tempo = null, time = null } = opts;
  const lines = (content || '').split('\n');

  // Group lines into logical section blocks (Verse, Chorus, Bridge, etc.)
  const sections = [];
  let currentSection = {
    header: '',
    lines: [],
  };

  const pushCurrentSection = () => {
    if (currentSection.header || currentSection.lines.length > 0) {
      sections.push({ ...currentSection });
      currentSection = { header: '', lines: [] };
    }
  };

  for (let rawLine of lines) {
    const line = rawLine.trimEnd();

    // Directive {c: Verse 1} or {comment: Chorus}
    const cMatch = line.match(/^\{(?:c|comment):\s*(.+?)\}/i);
    if (cMatch) {
      pushCurrentSection();
      currentSection.header = cMatch[1];
      continue;
    }

    // Skip metadata directives that are displayed in the header
    if (line.match(/^\{(?:title|t|artist|a|key|k|tempo|bpm|time|capo):/i)) {
      continue;
    }

    // Direct section headers written as text like "Verse 1:" or "[Chorus]" or "Bridge"
    const headingMatch = line.match(/^(?:\[?(Verse\s*\d*|Chorus\s*\d*|Bridge\s*\d*|Intro|Outro|Pre-Chorus\s*\d*|Tag|Interlude|Ending|Refrain|Hook)\]?:?)$/i);
    if (headingMatch && !line.includes('[') && !line.includes(']')) {
      pushCurrentSection();
      currentSection.header = line.replace(/[:\[\]]/g, '').trim();
      continue;
    }

    // Empty line indicates section separation
    if (line.trim() === '') {
      if (currentSection.lines.length > 0) {
        pushCurrentSection();
      }
      continue;
    }

    // Line with chords: [Em]Text [G]more text
    if (line.includes('[') && line.includes(']')) {
      currentSection.lines.push(renderChordLine(line));
    } else {
      currentSection.lines.push(`<div class="lyric-only-line">${escapeHtml(line)}</div>`);
    }
  }
  pushCurrentSection();

  const renderedSectionsHtml = sections.map((sec) => `
    <div class="section-block">
      ${sec.header ? `<div class="section-header">${escapeHtml(sec.header)}</div>` : ''}
      <div class="section-content">
        ${sec.lines.join('\n')}
      </div>
    </div>
  `).join('\n');

  return `
    <div class="song-card">
      <div class="song-header">
        <div class="song-title-row">
          <div>
            <h1 class="song-title">${escapeHtml(title)}</h1>
            ${artist ? `<div class="song-artist">${escapeHtml(artist)}</div>` : ''}
          </div>
          <div class="song-badges">
            ${key ? `<span class="badge badge-key">Key: ${escapeHtml(key)}</span>` : ''}
            ${tempo ? `<span class="badge badge-tempo">${escapeHtml(tempo)} BPM</span>` : ''}
            ${time ? `<span class="badge badge-time">${escapeHtml(time)}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="song-body">
        ${renderedSectionsHtml}
      </div>
    </div>
  `;
}

function renderChordLine(line) {
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
 * Builds a full printable multi-song booklet HTML document for PDF generation.
 * Formats lead sheets into 2-column layout to eliminate unnecessary page overflow.
 */
function buildPrintableBookletHtml({ title = 'Worship Setlist', date = '', songs = [] }) {
  const isSingleSong = songs.length === 1;

  const renderedSongs = songs.map((s, idx) => {
    return `
      <div class="page-break-container ${idx > 0 ? 'page-break' : ''}">
        ${!isSingleSong ? `<div class="song-order-num">Song ${idx + 1} of ${songs.length}</div>` : ''}
        ${renderChordProToHtml(s.content, {
          title: s.title,
          artist: s.artist,
          key: s.key,
          tempo: s.tempo,
          time: s.time,
        })}
      </div>
    `;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(title)} - Lead Sheet</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
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
      font-size: 12px;
      line-height: 1.3;
    }

    /* Top Branding Banner */
    .top-brand-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 6px;
      margin-bottom: 12px;
    }
    .church-name {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #b45309;
    }
    .sheet-badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.5px;
    }

    /* Multi-Song Setlist Cover Header */
    .setlist-cover-header {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 14px;
    }
    .setlist-title {
      font-size: 18px;
      font-weight: 900;
      margin: 0 0 3px 0;
      color: #0f172a;
    }
    .setlist-meta {
      font-size: 11px;
      color: #64748b;
    }

    /* Page Breaks for Multi-Song Booklets */
    .page-break {
      page-break-before: always;
      break-before: page;
      margin-top: 18px;
    }
    .song-order-num {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      color: #94a3b8;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    /* Song Header */
    .song-card {
      margin-bottom: 16px;
    }
    .song-header {
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    .song-title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
    }
    .song-title {
      font-size: 18px;
      font-weight: 900;
      margin: 0;
      color: #0f172a;
      letter-spacing: -0.3px;
    }
    .song-artist {
      font-size: 11.5px;
      color: #64748b;
      margin-top: 2px;
      font-weight: 600;
    }
    .song-badges {
      display: flex;
      gap: 5px;
    }
    .badge {
      display: inline-block;
      padding: 2.5px 7px;
      border-radius: 4px;
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
    .badge-time {
      background: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }

    /* Two-Column Printable Lead Sheet Body */
    .song-body {
      column-count: 2;
      column-gap: 22px;
      column-rule: 1px solid #e2e8f0;
      font-family: "Courier New", Courier, monospace;
      font-size: 11.5px;
    }

    /* Section Block (Keeps verses and choruses unbroken across columns) */
    .section-block {
      break-inside: avoid;
      page-break-inside: avoid;
      display: inline-block;
      width: 100%;
      margin-bottom: 10px;
      vertical-align: top;
    }
    .section-header {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 10.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #334155;
      background: #f1f5f9;
      border-left: 3px solid #b45309;
      padding: 2px 6px;
      margin: 0 0 4px 0;
      border-radius: 0 3px 3px 0;
    }
    .section-content {
      padding-left: 2px;
    }

    /* Chord & Lyric Alignment */
    .chord-line {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      line-height: 1.15;
      margin-bottom: 2px;
    }
    .chord-pair {
      display: inline-flex;
      flex-direction: column;
      margin-right: 0px;
    }
    .chord {
      font-weight: 900;
      color: #b45309;
      font-size: 11px;
      min-height: 13px;
      line-height: 13px;
    }
    .lyric {
      color: #0f172a;
      white-space: pre;
      line-height: 15px;
      font-size: 11.5px;
    }
    .lyric-only-line {
      white-space: pre-wrap;
      line-height: 15px;
      color: #334155;
      font-size: 11.5px;
      margin-bottom: 2px;
    }

    /* Print media optimization */
    @media print {
      body {
        font-size: 11px;
      }
      .song-body {
        column-count: 2;
        column-gap: 20px;
      }
      .section-block {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
    }
  </style>
</head>
<body>
  <div class="top-brand-banner">
    <div class="church-name">Jesus My Rock Church • Worship Ministry</div>
    <div class="sheet-badge">${isSingleSong ? 'Lead Sheet' : 'Setlist Booklet'}</div>
  </div>

  ${!isSingleSong ? `
    <div class="setlist-cover-header">
      <h1 class="setlist-title">${escapeHtml(title)}</h1>
      <div class="setlist-meta">
        ${date ? `<span>Date: ${escapeHtml(date)} • </span>` : ''}
        <span>${songs.length} Song${songs.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  ` : ''}

  ${renderedSongs.join('\n')}
</body>
</html>`;
}

module.exports = {
  renderChordProToHtml,
  buildPrintableBookletHtml,
};
