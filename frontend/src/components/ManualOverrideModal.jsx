import React, { useState, useEffect } from 'react';
import { X, Check, AlertTriangle, UserCheck, ShieldAlert, Sparkles } from 'lucide-react';
import { api } from '../api';
import { formatLastServed } from '../utils/date';

export default function ManualOverrideModal({
  isOpen,
  onClose,
  serviceId,
  positionId,
  positionName,
  roleSlot,
  currentMusicianId,
  onOverrideSaved,
}) {
  const [candidates, setCandidates] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [notes, setNotes] = useState('');
  const [showOnlyQualified, setShowOnlyQualified] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && serviceId && positionId) {
      setSelectedId(currentMusicianId || '');
      setNotes('');
      setShowOnlyQualified(true);
      loadCandidates();
    }
  }, [isOpen, serviceId, positionId, currentMusicianId]);

  async function loadCandidates() {
    setLoading(true);
    try {
      const data = await api.getCandidates(serviceId, positionId);
      setCandidates(data.candidates || []);
    } catch (err) {
      setError('Failed to load candidate list');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      await api.overrideSlot(serviceId, {
        position_id: positionId,
        role_slot: roleSlot,
        musician_id: selectedId || null,
        notes,
      });
      onOverrideSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to override slot');
    } finally {
      setSaving(false);
    }
  }



  if (!isOpen) return null;

  const qualifiedCandidates = candidates.filter((m) => m.has_role);
  const displayedCandidates = showOnlyQualified
    ? qualifiedCandidates
    : candidates;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Assign Musician: {positionName}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Select a team member to assign to the {positionName} position.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Filter header */}
        {!loading && candidates.length > 0 && (
          <div className="flex items-center justify-between mt-3 px-1 text-xs">
            <span className="text-red-600 dark:text-red-400 font-bold">
              {showOnlyQualified
                ? `Showing ${qualifiedCandidates.length} musician${qualifiedCandidates.length === 1 ? '' : 's'} tagged for ${positionName}`
                : `Showing all ${candidates.length} team members`}
            </span>
            <button
              type="button"
              onClick={() => setShowOnlyQualified(!showOnlyQualified)}
              className="text-[11px] text-slate-500 hover:text-red-600 dark:hover:text-red-400 underline cursor-pointer"
            >
              {showOnlyQualified ? `Show all (${candidates.length})` : `Show only ${positionName} (${qualifiedCandidates.length})`}
            </button>
          </div>
        )}

        {/* Candidate Selector List */}
        <div className="my-3 overflow-y-auto flex-1 pr-1 space-y-2">
          {loading ? (
            <div className="text-xs text-slate-400 text-center py-8">Loading candidates...</div>
          ) : (
            <>
              {/* Option to leave vacant */}
              <div
                onClick={() => setSelectedId('')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedId === ''
                    ? 'bg-red-50 dark:bg-red-500/15 border-red-500 text-slate-900 dark:text-white'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">Leave Slot Vacant (Unassigned)</span>
                  {selectedId === '' && <Check className="w-4 h-4 text-red-600 dark:text-red-400" />}
                </div>
              </div>

              {displayedCandidates.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs space-y-2">
                  <p>No musicians currently tagged for <strong>{positionName}</strong>.</p>
                  <button
                    type="button"
                    onClick={() => setShowOnlyQualified(false)}
                    className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-300 font-bold"
                  >
                    Show all musicians ({candidates.length})
                  </button>
                </div>
              ) : (
                displayedCandidates.map((m) => {
                  const isSelected = selectedId === m.id;
                  const isAvailable = m.availability_status === 'available';
                  const isDeclined = m.availability_status === 'declined';

                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedId(m.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-red-50 dark:bg-red-500/20 border-red-500 text-slate-900 dark:text-white shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{m.name}</span>
                            {m.is_worship_leader && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                                Worship Leader
                              </span>
                            )}
                            {m.currently_assigned_as && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                                Assigned: {m.currently_assigned_as}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-2 mt-1.5 flex-wrap gap-y-1">
                            {/* Availability badge */}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isAvailable
                                  ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                                  : isDeclined
                                  ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
                                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {m.availability_status === 'available'
                                ? '✓ Available'
                                : m.availability_status === 'declined'
                                ? '✕ Declined'
                                : '? No Response'}
                            </span>

                            {/* Role match badge */}
                            {m.has_role ? (
                              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                Plays {positionName}
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400/80">
                                Not tagged for {positionName}
                              </span>
                            )}

                            {/* Last served */}
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              • Last: {formatLastServed(m.last_served_date)}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 pt-0.5">
                          {isSelected && <Check className="w-5 h-5 text-red-600 dark:text-red-400" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {/* Notes & Save */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0 space-y-3">
          <input
            type="text"
            placeholder="Optional override note (e.g. Special arrangement)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-red-500"
          />

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20 disabled:opacity-50"
            >
              {saving ? 'Applying...' : 'Apply Override'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
