import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Megaphone,
  Users,
  Bot,
  Send,
  Plus,
  Trash2,
  ShieldCheck,
  UserCheck,
  UserX,
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  MessageCircle,
  Phone,
  Mail,
  X,
  AlertCircle
} from 'lucide-react';
import { api } from '../api';
import { ROLES, normalizeRole, hasRole } from '../utils/roles';

export default function MinistryHub({ ministry, currentUser, onBack }) {
  const [activeTab, setActiveTab] = useState('stream'); // 'stream' | 'people' | 'chat'
  
  // Role checks
  const userRole = normalizeRole(currentUser?.role);
  const isAdmin = userRole === ROLES.ADMIN;
  const isPastor = userRole === ROLES.PASTOR;
  const isGlobalManager = userRole === ROLES.MANAGER;
  const canAdminOrPastor = isAdmin || isPastor;

  // Announcements State
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

  // Members State
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [allPeople, setAllPeople] = useState([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [assignRole, setAssignRole] = useState('member');
  const [assigning, setAssigning] = useState(false);

  // Chatbot State
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const chatBottomRef = useRef(null);

  // Check if current user is designated manager in this ministry
  const isMinistryLeader = members.some(
    (m) =>
      (m.user_id === currentUser?.id || (m.email && m.email.toLowerCase() === currentUser?.email?.toLowerCase())) &&
      m.ministry_role === 'manager'
  );
  const canPostAnnouncements = isAdmin || isPastor || isGlobalManager || isMinistryLeader;
  const canManageMembers = isAdmin || isPastor || isGlobalManager || isMinistryLeader;

  useEffect(() => {
    loadAnnouncements();
    loadMembers();
    loadChat();
  }, [ministry.id]);

  useEffect(() => {
    if (activeTab === 'chat') {
      scrollToBottom();
    }
  }, [chatMessages, activeTab]);

  function scrollToBottom() {
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  async function loadAnnouncements() {
    setLoadingAnnouncements(true);
    try {
      const data = await api.getMinistryAnnouncements(ministry.id);
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load announcements:', err);
    } finally {
      setLoadingAnnouncements(false);
    }
  }

  async function loadMembers() {
    setLoadingMembers(true);
    try {
      const data = await api.getMinistryMembers(ministry.id);
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load ministry members:', err);
    } finally {
      setLoadingMembers(false);
    }
  }

  async function loadChat() {
    try {
      const data = await api.getMinistryChat(ministry.id);
      setChatMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load ministry chat:', err);
    }
  }

  async function handleOpenAssignModal() {
    try {
      const people = await api.getPeople({ active: true });
      // Filter out people already assigned
      const assignedIds = new Set(members.map((m) => m.musician_id));
      const unassigned = (people || []).filter((p) => !assignedIds.has(p.id));
      setAllPeople(unassigned);
      if (unassigned.length > 0) {
        setSelectedPersonId(unassigned[0].id);
      }
      setAssignRole('member');
      setIsAssignModalOpen(true);
    } catch (err) {
      alert('Failed to load people directory: ' + err.message);
    }
  }

  async function handleAssignMember(e) {
    e.preventDefault();
    if (!selectedPersonId) return;
    setAssigning(true);
    try {
      await api.assignMinistryMember(ministry.id, {
        musician_id: selectedPersonId,
        role: assignRole,
      });
      setIsAssignModalOpen(false);
      loadMembers();
    } catch (err) {
      alert(err.message || 'Failed to assign member');
    } finally {
      setAssigning(false);
    }
  }

  async function handleToggleMemberRole(musicianId, newRole) {
    if (!canAdminOrPastor) {
      alert('Only Admins and Pastors can assign or change Manager roles.');
      return;
    }
    try {
      await api.updateMinistryMemberRole(ministry.id, musicianId, newRole);
      loadMembers();
    } catch (err) {
      alert(err.message || 'Failed to update member role');
    }
  }

  async function handleRemoveMember(musicianId, name) {
    if (!canManageMembers) return;
    if (!window.confirm(`Remove ${name} from ${ministry.name}?`)) return;
    try {
      await api.removeMinistryMember(ministry.id, musicianId);
      loadMembers();
    } catch (err) {
      alert(err.message || 'Failed to remove member');
    }
  }

  async function handlePostAnnouncement(e) {
    e.preventDefault();
    if (!announcementContent.trim()) return;
    setPostingAnnouncement(true);
    try {
      await api.createMinistryAnnouncement(ministry.id, {
        title: announcementTitle.trim() || undefined,
        content: announcementContent.trim(),
      });
      setAnnouncementTitle('');
      setAnnouncementContent('');
      loadAnnouncements();
    } catch (err) {
      alert(err.message || 'Failed to post announcement');
    } finally {
      setPostingAnnouncement(false);
    }
  }

  async function handleDeleteAnnouncement(announcementId) {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await api.deleteMinistryAnnouncement(ministry.id, announcementId);
      loadAnnouncements();
    } catch (err) {
      alert(err.message || 'Failed to delete announcement');
    }
  }

  async function handleSendChat(customMessage) {
    const textToSend = customMessage || chatInput;
    if (!textToSend.trim() || sendingChat) return;

    const userMsg = {
      id: 'temp-' + Date.now(),
      sender_role: 'user',
      sender_name: currentUser?.name || 'You',
      message: textToSend.trim(),
      created_at: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!customMessage) setChatInput('');
    setSendingChat(true);

    try {
      const res = await api.sendMinistryChat(ministry.id, textToSend.trim());
      if (res && res.reply) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: 'bot-' + Date.now(),
            sender_role: 'assistant',
            sender_name: 'Ministry AI',
            message: res.reply,
            created_at: new Date().toISOString(),
          },
        ]);
      } else {
        loadChat();
      }
    } catch (err) {
      alert(err.message || 'Failed to get AI response');
    } finally {
      setSendingChat(false);
    }
  }

  // Split members into Managers and Members
  const managerList = members.filter(
    (m) => m.ministry_role === 'manager' || m.role === 'pastor' || m.role === 'admin'
  );
  const volunteerList = members.filter(
    (m) => m.ministry_role !== 'manager' && m.role !== 'pastor' && m.role !== 'admin'
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Ministries</span>
        </button>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#f5ede1] text-[#8c6738] border border-[#eadbc4]">
            {ministry.category || 'Ministry'}
          </span>
          {members.length > 0 && (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {members.length} members
            </span>
          )}
        </div>
      </div>

      {/* Hero Ministry Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#c59c6c] via-[#b68953] to-[#8c6738] text-white p-6 sm:p-8 shadow-xl overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 transform skew-x-12 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-sm border border-white/20">
              {ministry.name} Hub
            </span>
            <span className="text-xs opacity-90">Jesus My Rock Church</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{ministry.name} Hub</h1>
          {ministry.description && (
            <p className="text-xs sm:text-sm text-amber-50/90 max-w-2xl mt-2 leading-relaxed">
              {ministry.description}
            </p>
          )}

          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-white/20 text-xs">
            {ministry.meeting_day && (
              <div className="flex items-center gap-1.5 opacity-95">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {ministry.meeting_day}s @ {ministry.meeting_time || 'TBD'}
                </span>
              </div>
            )}
            {ministry.location && (
              <div className="flex items-center gap-1.5 opacity-95">
                <MapPin className="w-3.5 h-3.5" />
                <span>{ministry.location}</span>
              </div>
            )}
            {ministry.leader_name && (
              <div className="flex items-center gap-1.5 opacity-95">
                <Users className="w-3.5 h-3.5" />
                <span>Leader: <strong>{ministry.leader_name}</strong></span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ministry Hub Navigation Tabs */}
      <div className="flex items-center space-x-1 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <button
          onClick={() => setActiveTab('stream')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'stream'
              ? 'bg-[#c59c6c] text-white shadow-md shadow-[#c59c6c]/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>Stream & Announcements</span>
        </button>

        <button
          onClick={() => setActiveTab('people')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'people'
              ? 'bg-[#c59c6c] text-white shadow-md shadow-[#c59c6c]/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>People & Leaders ({members.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'chat'
              ? 'bg-[#c59c6c] text-white shadow-md shadow-[#c59c6c]/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>AI Ministry Assistant</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-200/80 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 font-extrabold">
            AI
          </span>
        </button>
      </div>

      {/* TAB 1: STREAM & ANNOUNCEMENTS */}
      {activeTab === 'stream' && (
        <div className="space-y-4">
          {/* Post Composer - Strictly for Managers, Pastors, Admin */}
          {canPostAnnouncements ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-slate-200 mb-3">
                <Megaphone className="w-4 h-4 text-[#c59c6c]" />
                <span>Post Announcement to {ministry.name}</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#f5ede1] text-[#8c6738] border border-[#eadbc4]">
                  Leader Composer
                </span>
              </div>

              <form onSubmit={handlePostAnnouncement} className="space-y-3">
                <input
                  type="text"
                  placeholder="Title (e.g. Thursday Rehearsal Song List & Call Time)"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  className="w-full bg-[#fbf8f3] dark:bg-slate-800 border border-[#eadbc4] dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#c59c6c]"
                />
                <textarea
                  rows="3"
                  placeholder="Share details, worship songs, audio setup instructions, or prayer points..."
                  value={announcementContent}
                  onChange={(e) => setAnnouncementContent(e.target.value)}
                  required
                  className="w-full bg-[#fbf8f3] dark:bg-slate-800 border border-[#eadbc4] dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#c59c6c]"
                />
                <div className="flex justify-between items-center pt-1">
                  <span className="text-[11px] text-slate-400">
                    Visible to all assigned volunteers in {ministry.name}
                  </span>
                  <button
                    type="submit"
                    disabled={postingAnnouncement || !announcementContent.trim()}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#c59c6c] hover:bg-[#b08756] text-white font-bold text-xs shadow-md shadow-[#c59c6c]/20 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{postingAnnouncement ? 'Posting...' : 'Post to Ministry'}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-[#fbf8f3] dark:bg-slate-800/40 border border-[#eadbc4] dark:border-slate-700/60 rounded-2xl p-4 flex items-center space-x-3 text-slate-600 dark:text-slate-400">
              <Megaphone className="w-5 h-5 text-[#c59c6c] shrink-0" />
              <div className="text-xs">
                <strong className="text-slate-800 dark:text-slate-200">Ministry Announcement Feed</strong> — Only Managers, Pastors, and Admins can post announcements. Volunteers have read-only view.
              </div>
            </div>
          )}

          {/* Announcements Feed */}
          {loadingAnnouncements ? (
            <div className="text-center py-12 text-slate-500">
              <div className="animate-spin w-7 h-7 border-2 border-[#c59c6c] border-t-transparent rounded-full mx-auto mb-2" />
              <span className="text-xs">Loading announcements stream...</span>
            </div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 text-slate-500">
              <Megaphone className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">No announcements yet</div>
              <div className="text-xs text-slate-500 mt-1">
                Announcements, rehearsal setlists, and schedule updates from leaders will appear here.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((ann) => {
                const canDeleteThis =
                  canAdminOrPastor ||
                  ann.created_by_user_id === currentUser?.id ||
                  ann.created_by_name === currentUser?.name;

                return (
                  <div
                    key={ann.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-[#c59c6c]/50 transition-all shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-[#f5ede1] dark:bg-slate-800 text-[#8c6738] dark:text-[#c59c6c] flex items-center justify-center font-black text-sm border border-[#eadbc4] dark:border-slate-700">
                          {ann.created_by_name?.[0] || 'L'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-white">
                              {ann.created_by_name || 'Ministry Leader'}
                            </span>
                            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                              {ann.created_by_role || 'Manager'}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {new Date(ann.created_at).toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      {canDeleteThis && (
                        <button
                          onClick={() => handleDeleteAnnouncement(ann.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="Delete announcement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {ann.title && (
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-3">
                        {ann.title}
                      </h3>
                    )}

                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-2 whitespace-pre-wrap leading-relaxed">
                      {ann.content}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PEOPLE & MANAGERS */}
      {activeTab === 'people' && (
        <div className="space-y-6">
          {/* Top Actions: Assign Person */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Assigned Team Roster
              </h2>
              <p className="text-xs text-slate-500">
                Managers lead this ministry; Volunteers serve during scheduled services.
              </p>
            </div>

            {canManageMembers && (
              <button
                onClick={handleOpenAssignModal}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#c59c6c] hover:bg-[#b08756] text-white font-bold text-xs shadow-md shadow-[#c59c6c]/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Assign Person</span>
              </button>
            )}
          </div>

          {loadingMembers ? (
            <div className="text-center py-12 text-slate-500">
              <div className="animate-spin w-7 h-7 border-2 border-[#c59c6c] border-t-transparent rounded-full mx-auto mb-2" />
              <span className="text-xs">Loading ministry roster...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Section 1: Ministry Managers & Pastors */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-3">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-5 h-5 text-[#c59c6c]" />
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      Ministry Leaders & Managers
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-[#8c6738] bg-[#f5ede1] px-2 py-0.5 rounded-full border border-[#eadbc4]">
                    {managerList.length} leaders
                  </span>
                </div>

                {managerList.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">
                    No managers assigned yet. Pastors and Admins can promote members to Manager.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {managerList.map((m) => (
                      <div key={m.musician_id} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-sm border border-amber-200 dark:border-amber-800/40">
                            {m.name?.[0] || 'L'}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{m.name}</span>
                              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                                {m.role === 'admin' ? 'Admin' : m.role === 'pastor' ? 'Pastor' : 'Manager'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-3">
                              {m.phone && <span>{m.phone}</span>}
                              {m.email && <span>{m.email}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Demote Button: Admin & Pastor Only */}
                        {canAdminOrPastor && m.role !== 'admin' && m.role !== 'pastor' && (
                          <button
                            onClick={() => handleToggleMemberRole(m.musician_id, 'member')}
                            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-[11px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Demote to Member"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>Demote to Member</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: Serving Volunteers */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-3">
                  <div className="flex items-center space-x-2">
                    <Users className="w-5 h-5 text-[#c59c6c]" />
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      Volunteers & Team Members
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                    {volunteerList.length} volunteers
                  </span>
                </div>

                {volunteerList.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">
                    No volunteers assigned yet. Click "Assign Person" above to add team members.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {volunteerList.map((m) => (
                      <div key={m.musician_id} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs border border-slate-200 dark:border-slate-700">
                            {m.name?.[0] || 'V'}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{m.name}</span>
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                                Member
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {Array.isArray(m.roles) &&
                                m.roles.map((r, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-[#f5ede1] text-[#8c6738] border border-[#eadbc4]"
                                  >
                                    {r}
                                  </span>
                                ))}
                              {m.phone && (
                                <span className="text-[10px] text-slate-400 ml-1">{m.phone}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {/* Pastor & Admin Only: Promote to Manager */}
                          {canAdminOrPastor && (
                            <button
                              onClick={() => handleToggleMemberRole(m.musician_id, 'manager')}
                              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-[11px] font-bold hover:bg-amber-100 transition-colors cursor-pointer"
                              title="Promote to Manager"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Make Manager</span>
                            </button>
                          )}

                          {/* Remove from Ministry */}
                          {canManageMembers && (
                            <button
                              onClick={() => handleRemoveMember(m.musician_id, m.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Remove from Ministry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AI ASSISTANT CHATBOT */}
      {activeTab === 'chat' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[650px]">
          {/* Chatbot Header */}
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-[#fbf8f3] to-white dark:from-slate-800/80 dark:to-slate-900 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#c59c6c] to-[#e4c59e] text-white flex items-center justify-center shadow-md shadow-[#c59c6c]/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">
                    {ministry.name} AI Assistant
                  </h3>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                    Online
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Church-trained AI: setlists, rehearsal tips, tech troubleshooting & prayers.
                </p>
              </div>
            </div>
          </div>

          {/* Prompt suggestion chips */}
          <div className="px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
              Suggestions:
            </span>
            <button
              onClick={() => handleSendChat(`Suggest 4 worship songs on Faith & Grace suitable for this week's service`)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-[#c59c6c] shrink-0 transition-all cursor-pointer"
            >
              🎵 4 Worship Songs on Faith
            </button>
            <button
              onClick={() => handleSendChat(`Create a 4-step checklist for Sunday sound check and media broadcast`)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-[#c59c6c] shrink-0 transition-all cursor-pointer"
            >
              📋 Sound Check Checklist
            </button>
            <button
              onClick={() => handleSendChat(`Draft an encouraging announcement for our Thursday rehearsal at 8:00 PM`)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-[#c59c6c] shrink-0 transition-all cursor-pointer"
            >
              📢 Rehearsal Announcement
            </button>
            <button
              onClick={() => handleSendChat(`Provide an uplifting 1-minute devotional prayer for our volunteers before serving`)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-[#c59c6c] shrink-0 transition-all cursor-pointer"
            >
              🙏 Team Devotional Prayer
            </button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {chatMessages.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Bot className="w-12 h-12 mx-auto text-[#c59c6c] opacity-40 mb-2" />
                <div className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                  Welcome to the {ministry.name} AI Assistant!
                </div>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Ask me anything about worship setlists, band arrangements, audio & video routing, or volunteer encouragement.
                </p>
              </div>
            ) : (
              chatMessages.map((msg, i) => {
                const isAssistant = msg.sender_role === 'assistant';
                return (
                  <div
                    key={msg.id || i}
                    className={`flex items-start gap-3 ${isAssistant ? 'justify-start' : 'justify-end'}`}
                  >
                    {isAssistant && (
                      <div className="w-8 h-8 rounded-xl bg-[#c59c6c] text-white flex items-center justify-center text-xs font-black shrink-0 shadow-sm">
                        AI
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed shadow-sm ${
                        isAssistant
                          ? 'bg-[#fbf8f3] dark:bg-slate-800 border border-[#eadbc4] dark:border-slate-700 text-slate-800 dark:text-slate-200 whitespace-pre-wrap'
                          : 'bg-[#c59c6c] text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1 opacity-80 text-[10px] font-bold">
                        <span>{isAssistant ? 'Ministry AI' : msg.sender_name || 'You'}</span>
                        <span>
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="whitespace-pre-wrap">{msg.message}</div>
                    </div>
                  </div>
                );
              })
            )}

            {sendingChat && (
              <div className="flex items-center space-x-2 text-xs text-slate-400 p-2">
                <div className="w-6 h-6 rounded-lg bg-[#c59c6c] text-white flex items-center justify-center text-[10px] font-black animate-pulse">
                  AI
                </div>
                <span className="italic">AI assistant is thinking...</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat Input */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder={`Ask ${ministry.name} assistant (e.g. setlist ideas, rehearsal plan)...`}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-[#fbf8f3] dark:bg-slate-800 border border-[#eadbc4] dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#c59c6c]"
              />
              <button
                type="submit"
                disabled={sendingChat || !chatInput.trim()}
                className="flex items-center justify-center p-2.5 rounded-xl bg-[#c59c6c] hover:bg-[#b08756] text-white disabled:opacity-50 transition-all cursor-pointer shadow-md shadow-[#c59c6c]/20"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Assign Person Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#c59c6c]" />
                <span>Assign Person to {ministry.name}</span>
              </h3>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignMember} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Select Person from Church Directory *
                </label>
                {allPeople.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">
                    All active church members are already assigned to this ministry.
                  </p>
                ) : (
                  <select
                    value={selectedPersonId}
                    onChange={(e) => setSelectedPersonId(e.target.value)}
                    required
                    className="w-full bg-[#fbf8f3] dark:bg-slate-800 border border-[#eadbc4] dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#c59c6c]"
                  >
                    {allPeople.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.primary_instrument ? `(${p.primary_instrument})` : ''} - {p.phone || p.email || 'Member'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Ministry Role
                </label>
                <select
                  value={assignRole}
                  onChange={(e) => setAssignRole(e.target.value)}
                  disabled={!canAdminOrPastor}
                  className="w-full bg-[#fbf8f3] dark:bg-slate-800 border border-[#eadbc4] dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#c59c6c] disabled:opacity-60 cursor-pointer"
                >
                  <option value="member">Member (Serving Volunteer)</option>
                  <option value="manager">Manager (Can post announcements & lead team)</option>
                </select>
                {!canAdminOrPastor && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    * Only Admins and Pastors can designate a member as Ministry Manager.
                  </p>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || allPeople.length === 0}
                  className="px-5 py-2.5 bg-[#c59c6c] hover:bg-[#b08756] text-white rounded-xl text-xs font-bold shadow-md shadow-[#c59c6c]/20 disabled:opacity-50 cursor-pointer"
                >
                  {assigning ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
