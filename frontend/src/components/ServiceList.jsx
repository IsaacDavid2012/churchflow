import React, { useState } from 'react';
import { 
  Calendar, 
  Plus, 
  Copy, 
  Check, 
  Users, 
  ChevronRight, 
  ShieldCheck, 
  Clock, 
  Share2, 
  Trash2,
  MapPin,
  FileText
} from 'lucide-react';
import { formatServiceDate, formatMonthShort, formatDayNumber } from '../utils/date';
import { copyToClipboard } from '../utils/clipboard';
import { api } from '../api';
import ShareLinkModal from './ShareLinkModal';

export default function ServiceList({ services, onSelectService, onCreateClick, onServiceDeleted }) {
  const [copiedToken, setCopiedToken] = useState(null);
  const [shareModal, setShareModal] = useState({ isOpen: false, serviceDate: '', token: '' });
  const [deletingId, setDeletingId] = useState(null);

  async function handleDelete(e, service) {
    e.stopPropagation();
    const formatted = formatServiceDate(service.service_date);
    if (!window.confirm(`Are you sure you want to permanently delete the service on ${formatted}?`)) {
      return;
    }

    setDeletingId(service.id);
    try {
      await api.deleteService(service.id);
      if (onServiceDeleted) onServiceDeleted(service.id);
    } catch (err) {
      alert(err.message || 'Failed to delete service');
    } finally {
      setDeletingId(null);
    }
  }

  async function copyShareLink(e, service) {
    e.stopPropagation();
    const baseUrl = typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')
      ? window.location.origin
      : 'https://serve.creativeclicks.art';
    const url = `${baseUrl}/avail/${service.token}`;
    const success = await copyToClipboard(url);
    if (success) {
      setCopiedToken(service.token);
      setTimeout(() => setCopiedToken(null), 2500);
    } else {
      setShareModal({
        isOpen: true,
        serviceDate: formatServiceDate(service.service_date),
        token: service.token,
        worshipLeaderName: service.worship_leader_name,
        campusName: service.campus_name,
        theme: service.theme,
      });
    }
  }

  function openShareDialog(e, service) {
    e.stopPropagation();
    setShareModal({
      isOpen: true,
      serviceDate: formatServiceDate(service.service_date),
      token: service.token,
      worshipLeaderName: service.worship_leader_name,
      campusName: service.campus_name,
      theme: service.theme,
    });
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'confirmed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Confirmed
          </span>
        );
      case 'rostered':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 flex items-center gap-1">
            <Users className="w-3 h-3" /> Rostered
          </span>
        );
      case 'availability_open':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Availability Open
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Draft
          </span>
        );
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-red-600 dark:text-red-400" />
            Services & Run Sheets
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Planning Center Services plans for Jesus My Rock Church — Order of Service, song keys, and multi-team scheduling.
          </p>
        </div>
        <button
          onClick={onCreateClick}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs sm:text-sm shadow-lg shadow-red-600/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Service Plan</span>
        </button>
      </div>

      {/* Services List */}
      {services.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
          <Calendar className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No service plans scheduled yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Create your first worship service date to start planning songs and collecting team availability.
          </p>
          <button
            onClick={onCreateClick}
            className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Service</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {services.map((service) => {
            const isCopied = copiedToken === service.token;

            return (
              <div
                key={service.id}
                onClick={() => onSelectService(service.id)}
                className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-red-500/40 rounded-2xl p-5 transition-all cursor-pointer shadow-sm hover:shadow-md group"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Service Info */}
                  <div className="flex items-start space-x-4">
                    <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/40 flex flex-col items-center justify-center text-red-600 dark:text-red-400 shrink-0 shadow-inner">
                      <span className="text-[11px] uppercase font-bold tracking-wider">
                        {formatMonthShort(service.service_date)}
                      </span>
                      <span className="text-xl font-black leading-none text-slate-900 dark:text-white mt-0.5">
                        {formatDayNumber(service.service_date)}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center space-x-3 flex-wrap gap-y-1">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                          {formatServiceDate(service.service_date, { weekday: 'long', month: 'long' })}
                        </h3>
                        {getStatusBadge(service.status)}
                        {service.service_type && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {service.service_type}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center space-x-3 flex-wrap gap-y-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">⏰ {service.service_time || '10:00 AM'}</span>
                        {service.campus_name && (
                          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                            <MapPin className="w-3 h-3 text-red-500" /> {service.campus_name}
                          </span>
                        )}
                        {service.theme && (
                          <span className="text-red-700 dark:text-red-400 italic">
                            Theme: "{service.theme}"
                          </span>
                        )}
                        {service.worship_leader_name && (
                          <span className="text-red-700 dark:text-red-400 font-semibold">
                            🎤 WL: {service.worship_leader_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Plan Items count & Actions */}
                  <div className="flex items-center justify-between lg:justify-end space-x-4 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center space-x-2 text-xs">
                      {service.plan_items_count > 0 && (
                        <div className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-300 font-medium flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          <span>{service.plan_items_count} items</span>
                        </div>
                      )}
                      <div className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300">
                        <span className="font-bold">{service.available_count || 0}</span> Available
                      </div>
                      <div className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300">
                        <span className="font-bold">{service.declined_count || 0}</span> Declined
                      </div>
                    </div>

                    {/* Copy Link button */}
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={(e) => copyShareLink(e, service)}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          isCopied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                        }`}
                        title="Copy Volunteer Availability Link"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-red-500" />}
                        <span>{isCopied ? 'Copied!' : 'Volunteer Link'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => openShareDialog(e, service)}
                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                        title="Open Share Options"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, service)}
                        disabled={deletingId === service.id}
                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-500/30 transition-all cursor-pointer"
                        title="Delete Service"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-red-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Share Modal */}
      <ShareLinkModal
        isOpen={shareModal.isOpen}
        onClose={() => setShareModal({ ...shareModal, isOpen: false })}
        serviceDate={shareModal.serviceDate}
        token={shareModal.token}
        worshipLeaderName={shareModal.worshipLeaderName}
        campusName={shareModal.campusName}
        theme={shareModal.theme}
      />
    </div>
  );
}
