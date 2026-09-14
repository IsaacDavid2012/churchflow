import React, { useState } from 'react';
import { X, Copy, Check, MessageSquare, ExternalLink, Link, Users } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

export default function ShareLinkModal({
  isOpen,
  onClose,
  serviceDate,
  token,
  worshipLeaderName,
  positions = [],
  campusName,
  theme,
}) {
  const [copied, setCopied] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  if (!isOpen || !token) return null;

  const baseUrl = typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')
    ? window.location.origin
    : 'https://serve.creativeclicks.art';
  const url = `${baseUrl}/avail/${token}`;

  let lineupLines = [];
  if (worshipLeaderName) {
    lineupLines.push(`• 🎤 Worship Leader: ${worshipLeaderName}`);
  }
  if (positions && positions.length > 0) {
    positions.forEach((p) => {
      const posName = p.position_name || p.positionName || p.name || 'Position';
      const primary = p.primary_musician_name || p.primary_musician?.name || p.primary?.name;
      // Avoid duplicate worship leader row if already added
      if (primary && (!worshipLeaderName || !posName.toLowerCase().includes('worship leader'))) {
        lineupLines.push(`• ${posName}: ${primary}`);
      }
    });
  }

  const lineupSection = lineupLines.length > 0
    ? `👥 *Team Lineup:*\n${lineupLines.join('\n')}\n\n`
    : '';

  const fullShareText = `🎸 *ChurchFlow — Jesus My Rock Church*\n📅 *${serviceDate}*${campusName ? ` • ${campusName}` : ''}${theme ? `\n📖 Theme: ${theme}` : ''}\n\n${lineupSection}👉 *Please tap below to confirm your availability or decline:*\n${url}`;

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullShareText)}`;

  async function handleCopyUrl() {
    await copyToClipboard(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleCopyFullMessage() {
    await copyToClipboard(fullShareText);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <Link className="w-5 h-5 text-red-600 dark:text-red-400" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Share Draft Lineup & Link</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Volunteers can confirm or decline in 1 tap</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* WhatsApp Message Preview Box */}
        <div className="mt-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 text-xs text-slate-800 dark:text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
          {fullShareText}
        </div>

        <div className="mt-4 space-y-2.5">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-lg shadow-emerald-950/20 cursor-pointer block text-center"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Send Lineup & Link via WhatsApp</span>
          </a>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopyFullMessage}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 border ${
                copiedMsg
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
            >
              {copiedMsg ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedMsg ? 'Message Copied!' : 'Copy WhatsApp Text'}</span>
            </button>

            <button
              onClick={handleCopyUrl}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 border ${
                copied
                  ? 'bg-red-600 text-white border-red-500'
                  : 'bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Link className="w-4 h-4" />}
              <span>{copied ? 'Link Copied!' : 'Copy Portal URL'}</span>
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 text-xs text-slate-500">
          <span>Jesus My Rock Volunteer Portal</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
