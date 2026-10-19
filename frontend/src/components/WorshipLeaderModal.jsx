import React, { useState, useEffect } from 'react';
import { X, Mic, UserCheck, Shield } from 'lucide-react';
import { api } from '../api';

export default function WorshipLeaderModal({
  isOpen,
  onClose,
  service,
  onLeaderUpdated,
  autoFillRest = false,
  onToggleAutoFillRest,
}) {
  const [musicians, setMusicians] = useState([]);
  const [selectedLeaderId, setSelectedLeaderId] = useState('');
  const [showAll, setShowAll] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedLeaderId(service?.worship_leader_id || '');
      setShowAll(true);
      loadMusicians();
    }
  }, [isOpen, service]);

  async function loadMusicians() {
    setLoading(true);
    try {
      const data = await api.getMusicians({ active: 'true' });
      setMusicians(data);
    } catch (err) {
      setError('Failed to load team list');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const result = await api.setWorshipLeader(service.id, selectedLeaderId || null, Boolean(autoFillRest));
      onLeaderUpdated(result.service);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update team lead');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <Mic className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Select Team Lead</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
          {autoFillRest
            ? 'Auto-Fill Rest is ON: Selecting a lead will automatically schedule the remaining open positions.'
            : 'Auto-Fill Rest is OFF: Selecting a lead will only set this person without auto-filling the rest.'}
        </p>

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Team Lead
              </label>
              {!loading && (
                <span className="text-[11px] text-red-600 dark:text-red-400 font-bold">
                  {musicians.length} Members
                </span>
              )}
            </div>

            {loading ? (
              <div className="text-xs text-slate-400 py-3 text-center">Loading roster...</div>
            ) : (
              <select
                value={selectedLeaderId}
                onChange={(e) => setSelectedLeaderId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-red-500"
              >
                <option value="">-- No Team Lead Assigned --</option>
                {musicians.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.roles?.length ? `(${m.roles.join(', ')})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {onToggleAutoFillRest && (
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Auto-fill remaining positions when setting lead
              </span>
              <button
                type="button"
                onClick={onToggleAutoFillRest}
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                  autoFillRest ? 'bg-red-600 justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'
                }`}
              >
                <span className="bg-white w-4 h-4 rounded-full shadow-sm" />
              </button>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20 disabled:opacity-50"
            >
              {saving ? 'Saving...' : autoFillRest ? 'Set Lead & Auto-Fill Rest' : 'Set Team Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
