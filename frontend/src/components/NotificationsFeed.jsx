import React, { useState, useEffect } from 'react';
import { Bell, RefreshCw, Sparkles, Shield, UserCheck, Edit3, Filter, Clock } from 'lucide-react';
import { api } from '../api';
import { formatServiceDate } from '../utils/date';

export default function NotificationsFeed() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    setLoading(true);
    try {
      const data = await api.getNotifications({ limit: 100 });
      setNotifications(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function getTypeBadge(type) {
    switch (type) {
      case 'promotion':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
            Auto-Promotion
          </span>
        );
      case 'reshuffle':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
            Auto-Shuffle
          </span>
        );
      case 'manual_override':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
            Manual Override
          </span>
        );
      case 'worship_leader_selected':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
            Worship Leader
          </span>
        );
      case 'lineup_confirmed':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
            Lineup Confirmed
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-300 uppercase">
            {type}
          </span>
        );
    }
  }

  const filteredNotifs = notifications.filter((n) => {
    if (filterType === 'all') return true;
    return n.type === filterType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Audit Trail & Event Logs</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Full audit log of auto-promotions, live re-shuffles, and manual lineup adjustments.
          </p>
        </div>
        <button
          onClick={loadNotifications}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        {[
          { id: 'all', label: 'All Events' },
          { id: 'promotion', label: 'Promotions' },
          { id: 'reshuffle', label: 'Shuffles' },
          { id: 'manual_override', label: 'Overrides' },
          { id: 'worship_leader_selected', label: 'Worship Leader' },
          { id: 'lineup_confirmed', label: 'Confirmed' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilterType(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              filterType === f.id
                ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Feed list */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-colors">
        {loading && notifications.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">Loading audit events...</div>
        ) : filteredNotifs.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">No events logged for this filter.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredNotifs.map((n) => (
              <div key={n.id} className="p-4 sm:p-5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center space-x-2.5">
                    {getTypeBadge(n.type)}
                    {n.service_date && (
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        Service: {formatServiceDate(n.service_date)}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                </div>

                <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">{n.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
