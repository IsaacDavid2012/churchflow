import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  Mic,
  Copy,
  Check,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Bell,
  Trash2,
  MapPin,
  FileText,
  Layers,
  Music
} from 'lucide-react';
import { api } from '../api';
import { formatServiceDate } from '../utils/date';
import { copyToClipboard } from '../utils/clipboard';
import LineupReview from './LineupReview';
import WorshipLeaderModal from './WorshipLeaderModal';
import ManualOverrideModal from './ManualOverrideModal';
import ShareLinkModal from './ShareLinkModal';
import OrderOfServicePlanner from './OrderOfServicePlanner';

export default function ServiceDetail({ serviceId, onBack, user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('plan'); // 'plan', 'lineup', 'availability', 'notifications'
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Modal states
  const [wlModalOpen, setWlModalOpen] = useState(false);
  const [overrideModal, setOverrideModal] = useState({
    isOpen: false,
    positionId: '',
    positionName: '',
    roleSlot: 'primary',
    musicianId: null,
  });

  // Service notifications
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    loadServiceDetails();
  }, [serviceId]);

  async function loadServiceDetails() {
    setLoading(true);
    setError('');
    try {
      const res = await api.getService(serviceId);
      setData(res);
      try {
        const notifs = await api.getNotifications({ service_id: serviceId, limit: 30 });
        setNotifications(notifs || []);
      } catch (e) {
        setNotifications([]);
      }
    } catch (err) {
      console.error('loadServiceDetails error:', err);
      setError(err.message || 'Failed to load service details');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyShareLink() {
    if (!data?.service?.token) return;
    const baseUrl = typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')
      ? window.location.origin
      : 'https://serve.creativeclicks.art';
    const url = `${baseUrl}/avail/${data.service.token}`;
    const success = await copyToClipboard(url);
    if (success) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } else {
      setShareModalOpen(true);
    }
  }

  async function handleDeleteService() {
    if (!data?.service) return;
    const formatted = formatServiceDate(data.service.service_date);
    if (!window.confirm(`Are you sure you want to permanently delete the service on ${formatted}? This cannot be undone.`)) {
      return;
    }

    try {
      await api.deleteService(data.service.id);
      onBack();
    } catch (err) {
      alert(err.message || 'Failed to delete service');
    }
  }

  function openOverrideModal(positionId, positionName, roleSlot, musicianId) {
    setOverrideModal({
      isOpen: true,
      positionId,
      positionName,
      roleSlot,
      musicianId,
    });
  }

  if (loading && !data) {
    return (
      <div className="py-20 text-center text-slate-400">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3"></div>
        <span>Loading service workspace...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-400 mb-4">{error || 'Service not found'}</div>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-medium"
        >
          ← Back to Services
        </button>
      </div>
    );
  }

  const { service, lineup, availability, planItems } = data;
  const availCount = availability?.available?.length || 0;
  const declinedCount = availability?.declined?.length || 0;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 text-sm font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Services</span>
        </button>
      </div>

      {/* Service Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl relative overflow-hidden transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-3 flex-wrap gap-y-1">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                {formatServiceDate(service.service_date, { weekday: 'long', month: 'long' })}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 capitalize">
                {service.status?.replace('_', ' ') || 'Planning'}
              </span>
              {service.service_type && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {service.service_type}
                </span>
              )}
            </div>

            {/* Sub-details (Campus, Time, Theme) */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1 font-semibold text-slate-900 dark:text-white">
                <Clock className="w-3.5 h-3.5 text-red-500" />
                {service.service_time || '10:00 AM'}
              </span>
              {service.campus_name && (
                <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-red-500" />
                  {service.campus_name}
                </span>
              )}
              {service.theme && (
                <span className="text-red-600 dark:text-red-400 italic font-medium">
                  Theme: "{service.theme}"
                </span>
              )}
            </div>

            {service.notes && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80">
                📝 {service.notes}
              </p>
            )}
          </div>

          {/* Quick Action Badges */}
          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
            {/* Worship Leader button */}
            <button
              onClick={() => setWlModalOpen(true)}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-700/50 text-red-700 dark:text-red-300 text-xs font-bold transition-all cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5 text-red-500" />
              <span>
                {service.worship_leader_name ? `WL: ${service.worship_leader_name}` : 'Select Worship Leader'}
              </span>
            </button>

            {/* Copy Group Link */}
            <button
              onClick={handleCopyShareLink}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                copiedLink
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-red-500" />}
              <span>{copiedLink ? 'Group Link Copied!' : 'Copy Volunteer Link'}</span>
            </button>

            {/* Delete Service */}
            <button
              onClick={handleDeleteService}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-500/30 text-xs font-semibold transition-all cursor-pointer"
              title="Permanently Delete Service"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6">
        <button
          onClick={() => setActiveSubTab('plan')}
          className={`pb-3 text-xs sm:text-sm font-bold transition-all border-b-2 flex items-center space-x-2 ${
            activeSubTab === 'plan'
              ? 'text-red-600 dark:text-red-400 border-red-600 dark:border-red-400'
              : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Order of Service</span>
          {planItems?.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
              {planItems.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('lineup')}
          className={`pb-3 text-xs sm:text-sm font-bold transition-all border-b-2 flex items-center space-x-2 ${
            activeSubTab === 'lineup'
              ? 'text-red-600 dark:text-red-400 border-red-600 dark:border-red-400'
              : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Lineup</span>
        </button>

        <button
          onClick={() => setActiveSubTab('availability')}
          className={`pb-3 text-xs sm:text-sm font-bold transition-all border-b-2 flex items-center space-x-2 ${
            activeSubTab === 'availability'
              ? 'text-red-600 dark:text-red-400 border-red-600 dark:border-red-400'
              : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Availability ({availCount})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('notifications')}
          className={`pb-3 text-xs sm:text-sm font-bold transition-all border-b-2 flex items-center space-x-2 ${
            activeSubTab === 'notifications'
              ? 'text-red-600 dark:text-red-400 border-red-600 dark:border-red-400'
              : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Audit Log</span>
        </button>
      </div>

      {/* Sub Tab Contents */}
      {activeSubTab === 'plan' && (
        <OrderOfServicePlanner serviceId={service.id} serviceTime={service.service_time} />
      )}

      {activeSubTab === 'lineup' && (
        <LineupReview
          service={service}
          lineup={lineup}
          availability={{ available_count: availCount, declined_count: declinedCount }}
          onLineupChanged={loadServiceDetails}
          onOverrideClick={openOverrideModal}
        />
      )}

      {activeSubTab === 'availability' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl transition-colors">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Musician & Volunteer Availability</h4>
            <span className="text-xs text-slate-500 dark:text-slate-400">Live responses from shared group link</span>
          </div>

          <div className="p-4 space-y-3">
            <div className="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400">Available Volunteers ({availCount})</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {(availability?.available || []).map((m) => (
                <div key={m.musician_id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">{m.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{(m.roles || []).join(', ')}</div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
              ))}
              {availCount === 0 && <div className="text-xs text-slate-500">No available responses yet.</div>}
            </div>

            {declinedCount > 0 && (
              <>
                <div className="text-xs font-bold uppercase text-rose-600 dark:text-rose-400 pt-3">Declined Volunteers ({declinedCount})</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {(availability?.declined || []).map((m) => (
                    <div key={m.musician_id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-sm text-slate-800 dark:text-slate-300">{m.name}</div>
                        <div className="text-[11px] text-slate-500">{(m.roles || []).join(', ')}</div>
                      </div>
                      <XCircle className="w-4 h-4 text-rose-500" />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'notifications' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl p-5 space-y-3 transition-colors">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Service Auto-Promotion & Re-Shuffle Audit Trail
          </h4>

          {notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">No logged events for this service yet.</div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="font-bold uppercase text-[10px] text-red-600 dark:text-red-400">{n.type}</span>
                  <span>{new Date(n.created_at).toLocaleTimeString()}</span>
                </div>
                <div className="text-slate-800 dark:text-slate-200 font-medium">{n.message}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modals */}
      <WorshipLeaderModal
        isOpen={wlModalOpen}
        onClose={() => setWlModalOpen(false)}
        service={service}
        onLeaderUpdated={loadServiceDetails}
      />

      <ManualOverrideModal
        isOpen={overrideModal.isOpen}
        onClose={() => setOverrideModal({ ...overrideModal, isOpen: false })}
        serviceId={service.id}
        positionId={overrideModal.positionId}
        positionName={overrideModal.positionName}
        roleSlot={overrideModal.roleSlot}
        currentMusicianId={overrideModal.musicianId}
        onOverrideSaved={loadServiceDetails}
      />

      <ShareLinkModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        serviceDate={formatServiceDate(service.service_date)}
        token={service.token}
        worshipLeaderName={service.worship_leader_name}
        positions={lineup}
        campusName={service.campus_name}
        theme={service.theme}
      />
    </div>
  );
}
