import React, { useState, useEffect } from 'react';
import { X, Copy, Check, MessageSquare, Link, Zap, Send, Radio } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';
import { api } from '../api';

export default function ShareLinkModal({
  isOpen,
  onClose,
  serviceId,
  serviceDate,
  token,
  worshipLeaderName,
  positions = [],
  campusName,
  theme,
  serviceType,
}) {
  const [copied, setCopied] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [waReady, setWaReady] = useState(false);
  const [checkingWa, setCheckingWa] = useState(true);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [broadcastGroupId, setBroadcastGroupId] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setInviteResult(null);
      setBroadcastResult(null);
      return;
    }

    setCheckingWa(true);
    api.getWhatsAppStatus()
      .then((res) => {
        setWaReady(res.ready === true);
      })
      .catch(() => setWaReady(false))
      .finally(() => setCheckingWa(false));
  }, [isOpen]);

  if (!isOpen || !token) return null;

  const baseUrl = typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')
    ? window.location.origin
    : 'https://serve.creativeclicks.art';
  const url = `${baseUrl}/avail/${token}`;

  const serviceTypeStr = serviceType || 'Sunday Worship Service';
  const fullShareText = `⛪ *Jesus My Rock Church — ${serviceTypeStr}*\n📅 *Date:* ${serviceDate}${campusName ? `\n📍 *Campus:* ${campusName}` : ''}${theme ? `\n🔥 *Theme:* "${theme}"` : ''}\n\n👉 *Please tap below to confirm your availability or decline:*\n${url}`;

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

  async function handleSendInvitesToAll() {
    if (!serviceId) return;
    setSendingInvites(true);
    setInviteResult(null);

    try {
      const res = await api.sendWhatsAppNotifyAll(serviceId);
      setInviteResult({
        success: true,
        message: `Dispatched invitations to ${res.dispatched} of ${res.total} scheduled volunteers!`,
      });
    } catch (err) {
      setInviteResult({
        success: false,
        message: err.message || 'Failed to dispatch WhatsApp invites.',
      });
    } finally {
      setSendingInvites(false);
    }
  }

  async function handleBroadcastRunSheet() {
    if (!serviceId || !broadcastGroupId.trim()) return;
    setBroadcasting(true);
    setBroadcastResult(null);

    try {
      const res = await api.broadcastWhatsAppRunSheet(serviceId, broadcastGroupId.trim());
      setBroadcastResult({
        success: true,
        message: res.message || 'Run-sheet broadcasted successfully to WhatsApp group!',
      });
    } catch (err) {
      setBroadcastResult({
        success: false,
        message: err.message || 'Failed to broadcast run-sheet.',
      });
    } finally {
      setBroadcasting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <Link className="w-5 h-5 text-red-600 dark:text-red-400" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Share Volunteer Attendance Link</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Guarded 4-digit PIN verification portal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* WhatsApp Automated Gateway Banner */}
        <div className="mt-4 p-3.5 rounded-xl border bg-slate-50 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              WhatsApp Automated Server
            </span>
            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
              waReady
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
            }`}>
              {checkingWa ? 'Checking...' : waReady ? 'ONLINE 🟢' : 'OFFLINE ⚪'}
            </span>
          </div>

          {serviceId && (
            <button
              onClick={handleSendInvitesToAll}
              disabled={sendingInvites || !waReady}
              className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                waReady && !sendingInvites
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/20'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>{sendingInvites ? 'Sending WhatsApp Invitations...' : '⚡ Send WhatsApp Invites to All Volunteers'}</span>
            </button>
          )}

          {inviteResult && (
            <div className={`p-2.5 rounded-lg text-xs font-medium border ${
              inviteResult.success
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
            }`}>
              {inviteResult.message}
            </div>
          )}

          {/* Group Broadcast input */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              📢 Broadcast Run-Sheet & Lineup to WhatsApp Group:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter Group JID or Phone"
                value={broadcastGroupId}
                onChange={(e) => setBroadcastGroupId(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                onClick={handleBroadcastRunSheet}
                disabled={broadcasting || !waReady || !broadcastGroupId.trim()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{broadcasting ? 'Posting...' : 'Post'}</span>
              </button>
            </div>

            {broadcastResult && (
              <div className={`mt-2 p-2 rounded-lg text-xs font-medium border ${
                broadcastResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
              }`}>
                {broadcastResult.message}
              </div>
            )}
          </div>
        </div>

        {/* WhatsApp Manual Message Preview Box */}
        <div className="mt-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 text-xs text-slate-800 dark:text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
          {fullShareText}
        </div>

        <div className="mt-4 space-y-2.5">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center space-x-2 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer block text-center"
          >
            <MessageSquare className="w-4 h-4 text-emerald-500" />
            <span>Open in WhatsApp Web (Manual Share)</span>
          </a>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopyFullMessage}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 border cursor-pointer ${
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
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 border cursor-pointer ${
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
            className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
