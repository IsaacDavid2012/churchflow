/**
 * Ministry AI Assistant Service
 * Provides intelligent, ministry-specific assistant responses for ChurchFlow.
 * Supports Google Gemini API if GEMINI_API_KEY is configured, with a rich
 * built-in Jesus My Rock Church ministry intelligence engine as a reliable fallback.
 */

const https = require('https');

async function callGeminiApi(prompt, systemInstruction) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const payload = JSON.stringify({
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ]
  });

  return new Promise((resolve) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 8000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const parsed = JSON.parse(data);
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) return resolve(text.trim());
          }
        } catch (e) {
          // Fall back to built-in generator
        }
        resolve(null);
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.write(payload);
    req.end();
  });
}

function generateLocalMinistryResponse(ministry, query) {
  const q = (query || '').toLowerCase().trim();
  const ministryName = ministry?.name || 'Church Ministry';
  const category = ministry?.category || '';

  // 1. Announcements / Drafting reminders
  if (q.includes('announcement') || q.includes('draft') || q.includes('reminder') || q.includes('whatsapp') || q.includes('message')) {
    return `📢 **Draft Announcement for ${ministryName}:**\n\n` +
      `"Hi ${ministryName} family! 👋 Grace and peace to you in Jesus' name.\n\n` +
      `A quick reminder regarding our upcoming schedule on **${ministry?.meeting_day || 'Sunday'} at ${ministry?.meeting_time || '10:00 AM'}** at **${ministry?.location || 'Main Sanctuary'}**.\n\n` +
      `📌 **Key Items:**\n` +
      `• Please arrive 15 minutes early for pre-service prayer and setup.\n` +
      `• Confirm your availability in the ChurchFlow app.\n` +
      `• Reach out to your team lead if you have any questions.\n\n` +
      `*'Whatever you do, work at it with all your heart, as working for the Lord, not for human masters.'* (Colossians 3:23)\n\n` +
      `Looking forward to serving together with joy! 🙌"`;
  }

  // 2. Worship Ministry Specific
  if (category.includes('Worship') || ministryName.toLowerCase().includes('worship')) {
    if (q.includes('song') || q.includes('setlist') || q.includes('worship') || q.includes('praise')) {
      return `🎶 **Suggested Worship Setlist for Jesus My Rock Church:**\n\n` +
        `1. **Firm Foundation (He Won't)** — Key of D (Uplifting & Prophetic Opener, 75 BPM)\n` +
        `2. **Praise the Lord (Psalm 150)** — Key of D / G (High Energy Celebration Praise)\n` +
        `3. **Goodness of God** — Key of G (Intimate Transition into Thanksgiving)\n` +
        `4. **Holy Forever** — Key of G / A (Deep Altar Worship & Throne Room Adoration)\n\n` +
        `💡 **Transition Tip:** Modulate smoothly from D to G using a suspended 4th chord (Dsus4 -> G). Keep vocal harmonies balanced and leave 2-3 minutes for spontaneous praise after Song 3.`;
    }

    if (q.includes('rehearsal') || q.includes('warmup') || q.includes('practice')) {
      return `🎼 **Worship Rehearsal Flow (60 Mins):**\n\n` +
        `1. **00-10m:** Devotional Prayer & Scripture declaration (Psalm 96).\n` +
        `2. **10-15m:** Vocal warmups (lip trills, 5-tone scales) and instrument level line checks.\n` +
        `3. **15-35m:** Tightening song transitions, intros, and endings.\n` +
        `4. **35-50m:** Full run-through of the setlist without stopping.\n` +
        `5. **50-60m:** Notes from Worship Leader & closing prayer.`;
    }
  }

  // 3. Production & Sound & Tech
  if (category.includes('Production') || category.includes('Tech') || category.includes('Media') || ministryName.toLowerCase().includes('production') || ministryName.toLowerCase().includes('media')) {
    if (q.includes('feedback') || q.includes('sound') || q.includes('mic') || q.includes('mixer') || q.includes('eq')) {
      return `🎛️ **Audio Troubleshooting & Gain Staging Guide:**\n\n` +
        `• **Preventing Feedback:** Notch out high-mid frequencies (around 2.5kHz - 4kHz) on vocal wedges. Avoid pointing stage mics directly into monitors.\n` +
        `• **Gain Staging:** Set preamp gain so vocal peaks hit between -18dBFS and -12dBFS on digital meters.\n` +
        `• **High-Pass Filter (HPF):** Engage HPF at 80Hz-100Hz on all vocals to clean up low-end stage rumble.\n` +
        `• **Wireless Mics:** Verify RF frequencies are clear and always keep a fresh pair of AA batteries staged in the booth.`;
    }

    if (q.includes('stream') || q.includes('obs') || q.includes('camera') || q.includes('live')) {
      return `📹 **Livestream & OBS Sunday Checklist:**\n\n` +
        `1. **Bitrate & Output:** 1080p60 at 6000 Kbps (ensure network upload speed > 15 Mbps).\n` +
        `2. **Audio Sync:** Confirm audio latency offset between desk audio interface and video capture card (typically 40ms - 80ms).\n` +
        `3. **Lower Thirds:** Test scripture overlays and song lyrics in ProPresenter.\n` +
        `4. **Camera White Balance:** Lock Kelvin temperature (approx. 4500K-5200K) to avoid color shifting during stage lighting changes.`;
    }
  }

  // 4. Hospitality & Ushers
  if (category.includes('Hospitality') || ministryName.toLowerCase().includes('hospitality') || ministryName.toLowerCase().includes('usher')) {
    return `🤝 **Hospitality & Ushering Team Best Practices:**\n\n` +
      `• **First 30 Seconds:** Greet every visitor with a warm smile, eye contact, and a welcoming word: *"Welcome to Jesus My Rock Church, so glad you're here!"*\n` +
      `• **Seating Flow:** Fill rows from front-to-back and center-outward to avoid bottlenecking latecomers at the back foyer.\n` +
      `• **Communion Logistics:** Have ushers synchronized on left and right aisles; count elements before pre-service prayer.\n` +
      `• **Emergency / Medical:** Know the location of the First Aid Kit in the church office and fire exits.`;
  }

  // 5. Prayer & Intercession
  if (category.includes('Prayer') || ministryName.toLowerCase().includes('prayer') || q.includes('prayer')) {
    return `🙏 **Scriptures & Prayer Focus for ${ministryName}:**\n\n` +
      `• **Unity & Anointing:** *"How good and pleasant it is when God’s people live together in unity!... For there the Lord bestows his blessing."* (Psalm 133)\n` +
      `• **Spiritual Protection:** Ephesians 6:10-18 (Armor of God over pastors, leaders, and families).\n` +
      `• **Salvation & Hearts:** Pray that every person who enters our doors encounters the living Christ and receives eternal life.\n` +
      `• **Prophetic Declarations:** Declare breakthrough, physical healing, and peace over our Sunday services.`;
  }

  // General helpful response
  return `✨ **${ministryName} Assistant Advice:**\n\n` +
    `Thank you for reaching out regarding: *"${query}"*.\n\n` +
    `Here are 3 key recommendations for our **${ministryName}**:\n\n` +
    `1. **Clear Communication:** Post team updates in our Classroom stream so every volunteer stays informed.\n` +
    `2. **Spiritual Preparation:** Encourage volunteers to pray for the congregation throughout their week before serving.\n` +
    `3. **Excellence & Humility:** *'Serve wholeheartedly, as if you were serving the Lord, not people.'* (Ephesians 6:7)\n\n` +
    `Let me know if you would like me to draft an announcement, suggest schedule ideas, or give technical tips!`;
}

async function getMinistryAssistantReply(ministry, query, history = []) {
  const ministryName = ministry?.name || 'Church Ministry';
  const category = ministry?.category || 'General';
  const description = ministry?.description || '';

  const systemInstruction = 
    `You are the Jesus My Rock Church AI Ministry Assistant for "${ministryName}" (${category} department). ` +
    `Description: ${description}. ` +
    `Church motto: "Standing Firm on Christ the Solid Rock". ` +
    `You provide helpful, encouraging, practical, and biblically sound advice for church volunteers, worship leaders, tech team, and pastors. ` +
    `Always respond in clean markdown with bullet points and friendly encouraging tone. Keep responses actionable and concise.`;

  // Try Gemini API if key is set
  const geminiReply = await callGeminiApi(query, systemInstruction);
  if (geminiReply) return geminiReply;

  // Fallback to local intelligence generator
  return generateLocalMinistryResponse(ministry, query);
}

module.exports = {
  getMinistryAssistantReply,
};
