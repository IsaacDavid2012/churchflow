import React, { useState } from 'react';
import { Sparkles, CheckCheck, Clock, RefreshCw, Edit3, AlertCircle, Users, Dices, Copy, Check } from 'lucide-react';
import { api } from '../api';
import { formatLastServed } from '../utils/date';
import { copyToClipboard, formatFinalLineupForWhatsApp } from '../utils/clipboard';

export default function LineupReview({
  service,
  lineup,
  availability,
  onLineupChanged,
  onOverrideClick,
  autoFillRest = false,
  onToggleAutoFillRest,
}) {
  const [shuffling, setShuffling] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [checkingDeadline, setCheckingDeadline] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const availCount = availability?.available?.length || 0;
  const declinedCount = availability?.declined?.length || 0;
  const isLineupConfirmed = service?.status === 'confirmed' || justConfirmed;

  async function handleAutoShuffle() {
    setShuffling(true);
    setError('');
    setMessage('');

    try {
      const res = await api.shuffleLineup(service.id, { pool: 'auto' });
      setMessage(res.message || 'Auto-shuffle completed successfully!');
      onLineupChanged();
    } catch (err) {
      setError(err.message || 'Auto-shuffle failed');
    } finally {
      setShuffling(false);
    }
  }

  async function handleConfirmLineup() {
    setConfirming(true);
    setError('');
    setMessage('');

    try {
      const res = await api.confirmLineup(service.id);
      setJustConfirmed(true);
      setMessage('Lineup confirmed! You can now copy the final lineup for WhatsApp.');
      onLineupChanged();
    } catch (err) {
      setError(err.message || 'Failed to confirm lineup');
    } finally {
      setConfirming(false);
    }
  }

  async function handleCopyFinalLineup() {
    const text = formatFinalLineupForWhatsApp(service, lineup);
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedWhatsApp(true);
      setTimeout(() => setCopiedWhatsApp(false), 2500);
    }
  }

  async function handleDeadlineCheck() {
    setCheckingDeadline(true);
    setError('');
    setMessage('');

    try {
      const res = await api.checkDeadline(service.id);
      if (res.promotions?.length > 0) {
        setMessage(`Deadline triggered ${res.promotions.length} auto-promotions.`);
      } else {
        setMessage('Deadline check completed (no unconfirmed promotions needed).');
      }
      onLineupChanged();
    } catch (err) {
      setError(err.message || 'Deadline check failed');
    } finally {
      setCheckingDeadline(false);
    }
  }

  function getSlotStatusBadge(status) {
    switch (status) {
      case 'confirmed':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Confirmed</span>;
      case 'promoted':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">Auto-Promoted</span>;
      case 'declined':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">Declined</span>;
      default:
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">Suggested</span>;
    }
  }

  const displayedLineup = (lineup || []).filter((pos) => {
    const posName = (pos.positionName || pos.position_name || '').toLowerCase();
    if (!autoFillRest && posName.includes('worship leader')) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-red-600 dark:text-red-400" />
            Media & Team Lineup
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {autoFillRest
              ? 'Auto-Fill Rest is ON: Assigning 1 person automatically schedules the remaining positions.'
              : 'Auto-Fill Rest is OFF: Assign each Media Team position individually without auto-setting the rest.'}
          </p>
        </div>

        <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
          {/* Toggle for "Set 1 Person & Auto-Fill Rest" */}
          {onToggleAutoFillRest && (
            <button
              type="button"
              onClick={onToggleAutoFillRest}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                autoFillRest
                  ? 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
              title="Turn ON if you want setting 1 person to auto-fill the rest of the slots; keep OFF to assign each person manually"
            >
              <span
                className={`w-7 h-4 flex items-center rounded-full p-0.5 transition-colors ${
                  autoFillRest ? 'bg-red-600 justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'
                }`}
              >
                <span className="bg-white w-3 h-3 rounded-full shadow-sm" />
              </span>
              <span>Set 1 & Auto-Fill Rest: {autoFillRest ? 'ON' : 'OFF'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDeadlineCheck}
            disabled={checkingDeadline}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 disabled:opacity-50 transition-all cursor-pointer"
            title="Check 48hr deadline auto-promotions"
          >
            <Clock className={`w-3.5 h-3.5 ${checkingDeadline ? 'animate-spin' : ''}`} />
            <span>Check Deadline</span>
          </button>

          <button
            type="button"
            onClick={handleAutoShuffle}
            disabled={shuffling}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black shadow-lg shadow-red-600/25 disabled:opacity-50 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${shuffling ? 'animate-spin' : ''}`} />
            <span>{shuffling ? 'Ranking & Rostering...' : '⚡ Run Auto-Roster'}</span>
          </button>

          <button
            type="button"
            onClick={handleConfirmLineup}
            disabled={confirming}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 disabled:opacity-50 transition-all cursor-pointer"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>{isLineupConfirmed ? 'Re-Confirm Lineup' : 'Confirm Lineup'}</span>
          </button>

          {isLineupConfirmed && (
            <button
              type="button"
              onClick={handleCopyFinalLineup}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer ${
                copiedWhatsApp
                  ? 'bg-emerald-700 text-white shadow-emerald-700/25'
                  : 'bg-green-600 hover:bg-green-500 text-white shadow-green-600/25'
              }`}
              title="Copy confirmed final lineup (Date, Time & Lineup) for WhatsApp"
            >
              {copiedWhatsApp ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedWhatsApp ? 'Copied for WhatsApp!' : 'Copy Final Lineup for WhatsApp'}</span>
            </button>
          )}
        </div>
      </div>

      {isLineupConfirmed && (
        <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <CheckCheck className="w-4 h-4" />
              <span>Final Lineup Confirmed — Ready for WhatsApp</span>
            </div>
            <pre className="text-xs text-slate-800 dark:text-slate-200 font-mono bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-800/50 rounded-xl p-3 whitespace-pre-wrap leading-relaxed">
              {formatFinalLineupForWhatsApp(service, lineup)}
            </pre>
          </div>
          <button
            type="button"
            onClick={handleCopyFinalLineup}
            className={`flex items-center justify-center space-x-2 px-5 py-3 rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer shrink-0 ${
              copiedWhatsApp
                ? 'bg-emerald-700 text-white shadow-emerald-700/25'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
            }`}
          >
            {copiedWhatsApp ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedWhatsApp ? 'Copied to Clipboard!' : 'Copy Final Lineup for WhatsApp'}</span>
          </button>
        </div>
      )}

      {message && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 text-xs flex items-center space-x-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Roster Slots Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl transition-colors">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Position & Lineup Slots</h4>
          <span className="text-xs text-slate-500 dark:text-slate-400">Tap Change to assign any individual position</span>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800/80">
          {displayedLineup.map((pos) => {
            const posId = pos.positionId || pos.position_id;
            const posName = pos.positionName || pos.position_name;
            const hasAssigned = Boolean(pos.primary && (pos.primary.musicianId || pos.primary.musician_id || pos.primary.name));
            const musicianId = pos.primary?.musicianId || pos.primary?.musician_id;
            const musicianName = pos.primary?.name;
            const lastServed = pos.primary?.lastServedDate || pos.primary?.last_served_date;

            return (
              <div key={posId} className="p-4 sm:p-5 hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Position Title & Ministry */}
                  <div className="w-full sm:w-56 shrink-0">
                    <div className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{posName}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-medium border border-slate-200 dark:border-slate-700/60">
                        {pos.ministry && pos.ministry !== 'Worship Team' ? pos.ministry : 'Media Team'}
                      </span>
                    </div>
                  </div>

                  {/* Single Lineup Slot Card */}
                  <div className="flex-1 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-700/50 flex items-center justify-center text-red-600 dark:text-red-300 font-bold text-xs shrink-0">
                        {hasAssigned ? musicianName.substring(0, 2).toUpperCase() : '?'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {hasAssigned ? musicianName : <span className="text-slate-400 font-normal italic">Vacant / Unassigned</span>}
                          </span>
                          {hasAssigned && getSlotStatusBadge(pos.primary.status)}
                        </div>
                        {hasAssigned && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {formatLastServed(lastServed)}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onOverrideClick(
                          posId,
                          posName,
                          'primary',
                          musicianId
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors shrink-0 flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-red-500" />
                      <span>Change</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
