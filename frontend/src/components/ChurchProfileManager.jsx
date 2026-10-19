import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  MapPin, 
  Users, 
  Mail, 
  Phone, 
  Globe, 
  ShieldCheck, 
  Sparkles, 
  Plus, 
  Save, 
  Check, 
  Layers,
  Music,
  Video,
  HeartHandshake,
  Baby,
  Flame
} from 'lucide-react';
import { api } from '../api';

const ICON_MAP = {
  Music: Music,
  Video: Video,
  HeartHandshake: HeartHandshake,
  Baby: Baby,
  Flame: Flame,
  Users: Users,
};

export default function ChurchProfileManager() {
  const [profile, setProfile] = useState({
    name: 'Jesus My Rock Church',
    tagline: 'Standing Firm on Christ the Solid Rock',
    lead_pastor: 'Pastor Joseph',
    email: 'jesusmyrockchurch@gmail.com',
    phone: '+60 3-7722 1484',
    address: '18-3, Jalan PJU 8/5G, Damansara Perdana, 47820 Petaling Jaya, Selangor, Malaysia',
    website: 'https://www.instagram.com/jesusmyrockchurch/',
  });
  const [stats, setStats] = useState({
    totalPeople: 0,
    totalServices: 0,
    totalGroups: 0,
    totalCampuses: 1,
  });
  const [campuses, setCampuses] = useState([]);
  const [ministries, setMinistries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    loadChurchData();
  }, []);

  async function loadChurchData() {
    setLoading(true);
    try {
      const [churchRes, campusesRes, ministriesRes] = await Promise.all([
        api.getChurch(),
        api.getCampuses(),
        api.getMinistries(),
      ]);
      if (churchRes.profile) setProfile(churchRes.profile);
      if (churchRes.stats) setStats(churchRes.stats);
      setCampuses(campusesRes ? campusesRes.slice(0, 1) : []);
      setMinistries(ministriesRes || []);
    } catch (err) {
      console.error('Failed to load church profile:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateChurch(profile);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 dark:text-slate-400">
        <div className="animate-spin w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full mr-3"></div>
        <span className="text-xs font-semibold">Loading Church Profile...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center shadow-sm flex-shrink-0">
              <Building2 className="w-8 h-8 text-red-600" />
            </div>
            <div>
              <div className="flex items-center space-x-3 flex-wrap gap-y-1">
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{profile.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-600 border border-red-200">
                  Petaling Jaya, Malaysia
                </span>
              </div>
              <p className="text-slate-600 text-xs mt-1">{profile.tagline}</p>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-600">
                <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-red-600" /> {profile.lead_pastor}</span>
                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-red-600" /> {profile.address}</span>
                <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-red-600" /> {profile.website}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Church Key Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200">
            <div className="text-xs text-slate-500">Total Directory</div>
            <div className="text-xl font-bold text-slate-900 mt-1">{stats.totalPeople} <span className="text-xs font-normal text-slate-500">people</span></div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200">
            <div className="text-xs text-slate-500">Campus</div>
            <div className="text-xl font-bold text-red-600 mt-1">1 <span className="text-xs font-normal text-slate-500">Damansara Perdana</span></div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200">
            <div className="text-xs text-slate-500">Ministries</div>
            <div className="text-xl font-bold text-blue-600 mt-1">{ministries.length}</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200">
            <div className="text-xs text-slate-500">Life Groups</div>
            <div className="text-xl font-bold text-amber-600 mt-1">{stats.totalGroups} <span className="text-xs font-normal text-slate-500">groups</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Church Profile Settings */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm transition-colors">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                Church Profile & Organization Settings
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Primary information displayed across services and member communications.</p>
            </div>
            {savedSuccess && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/20">
                <Check className="w-3.5 h-3.5" /> Saved Successfully!
              </span>
            )}
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Church Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Tagline / Mission</label>
                <input
                  type="text"
                  value={profile.tagline || ''}
                  onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Lead Pastors</label>
                <input
                  type="text"
                  value={profile.lead_pastor || ''}
                  onChange={(e) => setProfile({ ...profile, lead_pastor: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Primary Email</label>
                <input
                  type="email"
                  value={profile.email || ''}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Phone Number</label>
                <input
                  type="text"
                  value={profile.phone || ''}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Website URL</label>
                <input
                  type="text"
                  value={profile.website || ''}
                  onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Physical Address</label>
              <input
                type="text"
                value={profile.address || ''}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all shadow-lg shadow-red-600/25 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Church Settings'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Campus & Ministries */}
        <div className="space-y-6">
          {/* Single Campus Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm transition-colors">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-red-600 dark:text-red-400" />
                Campus Location
              </h2>
            </div>

            <div className="space-y-2.5">
              {campuses.length > 0 ? (
                campuses.map((campus) => (
                  <div key={campus.id} className="flex items-start justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{campus.name}</span>
                        <span className="text-[10px] uppercase font-bold bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-300 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-500/30">
                          Main Sanctuary
                        </span>
                      </div>
                      {campus.address && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{campus.address}</p>}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100">Damansara Perdana Sanctuary</span>
                    <span className="text-[10px] uppercase font-bold bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-300 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-500/30">
                      Main Sanctuary
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{profile.address}</p>
                </div>
              )}
            </div>
          </div>

          {/* Ministry Teams Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm transition-colors">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-red-600 dark:text-red-400" />
                Active Ministries & Teams
              </h2>
            </div>

            <div className="space-y-2.5">
              {ministries.map((min) => {
                const IconComponent = ICON_MAP[min.icon] || Users;
                return (
                  <div key={min.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-600/20 text-red-600 dark:text-red-400 flex items-center justify-center">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-slate-200">{min.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{min.description}</div>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {min.member_count || 0} members
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
