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
  AlertCircle,
  Paperclip,
  Image as ImageIcon
} from 'lucide-react';
import { api } from '../api';
import { ROLES, normalizeRole, hasRole } from '../utils/roles';
import MediaAttachmentCard from './MediaAttachmentCard';

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
  const [annMedia, setAnnMedia] = useState(null);
  const [alsoShareToHome, setAlsoShareToHome] = useState(false);
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
  const [chatMedia, setChatMedia] = useState(null);
  const [sendingChat, setSendingChat] = useState(false);
  const chatBottomRef = useRef(null);

  const handleSelectMedia = (file, target) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert(`File size exceeds 10MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please select a file below 10MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const mediaObj = {
        name: file.name,
        size: file.size,
        type: file.type,
        base64: reader.result,
      };
      if (target === 'ann') setAnnMedia(mediaObj);
      else setChatMedia(mediaObj);
    };
    reader.readAsDataURL(file);
  };

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
      const interval = setInterval(() => {
        loadChat();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

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
    if (!announcementContent.trim() && !annMedia) return;
    setPostingAnnouncement(true);
    try {
      let mediaUrl = null;
      let mediaType = null;
      let mediaName = null;
      let mediaSize = null;

      if (annMedia) {
        const uploadRes = await api.uploadMedia({
          fileBase64: annMedia.base64,
          fileName: annMedia.name,
          fileType: annMedia.type,
        });
        mediaUrl = uploadRes.url;
        mediaType = uploadRes.type;
        mediaName = uploadRes.name;
        mediaSize = uploadRes.size;
      }

      if (alsoShareToHome) {
        // Cross-post to both Church Home Feed and Ministry Hub
        await api.createFeedPost({
          title: announcementTitle.trim() || `${ministry.name} Update`,
          content: announcementContent.trim(),
          post_type: 'announcement',
          destination: 'both',
          ministry_id: ministry.id,
          media_url: mediaUrl,
          media_type: mediaType,
          media_name: mediaName,
          media_size: mediaSize,
          media_attachments: mediaUrl ? [{ url: mediaUrl, type: mediaType, name: mediaName, size: mediaSize }] : [],
        });
      } else {
        await api.createMinistryAnnouncement(ministry.id, {
          title: announcementTitle.trim() || undefined,
          content: announcementContent.trim(),
          media_url: mediaUrl,
          media_type: mediaType,
          media_name: mediaName,
          media_size: mediaSize,
        });
      }

      setAnnouncementTitle('');
      setAnnouncementContent('');
      setAnnMedia(null);
      setAlsoShareToHome(false);
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

  async function handleSendChat(e) {
    if (e && e.preventDefault) e.preventDefault();
    if ((!chatInput.trim() && !chatMedia) || sendingChat) return;

    const textToSend = chatInput.trim();
    const mediaToUpload = chatMedia;
    setChatInput('');
    setChatMedia(null);
    setSendingChat(true);

    try {
      let mediaUrl = null;
      let mediaType = null;
      let mediaName = null;
      let mediaSize = null;

      if (mediaToUpload) {
        const uploadRes = await api.uploadMedia({
          fileBase64: mediaToUpload.base64,
          fileName: mediaToUpload.name,
          fileType: mediaToUpload.type,
        });
        mediaUrl = uploadRes.url;
        mediaType = uploadRes.type;
        mediaName = uploadRes.name;
        mediaSize = uploadRes.size;
      }

      await api.sendMinistryChat(ministry.id, {
        message: textToSend,
        media_url: mediaUrl,
        media_type: mediaType,
        media_name: mediaName,
        media_size: mediaSize,
      });
      await loadChat();
    } catch (err) {
      alert(err.message || 'Failed to send message');
    } finally {
      setSendingChat(false);
    }
  }

  async function handleDeleteChatMessage(msgId) {
    if (!window.confirm('Delete this message?')) return;
    try {
      await api.deleteMinistryChat(ministry.id, msgId);
      loadChat();
    } catch (err) {
      alert(err.message || 'Failed to delete message');
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

          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-white/20 text-xs">
            {ministry.leader_name && (
              <div className="flex items-center gap-1.5 opacity-95">
                <Users className="w-3.5 h-3.5" />
                <span>Leader: <strong>{ministry.leader_name}</strong></span>
              </div>
            )}
            {ministry.leader_phone && (
              <div className="flex items-center gap-2">
                <a
                  href={`https://wa.me/${ministry.leader_phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-emerald-500/30 hover:bg-emerald-500/40 text-white border border-emerald-400/40 transition-colors"
                >
                  <MessageCircle className="w-3 h-3" />
                  WhatsApp Leader
                </a>
                <a
                  href={`tel:${ministry.leader_phone}`}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-white/20 hover:bg-white/30 text-white border border-white/30 transition-colors"
                >
                  <Phone className="w-3 h-3" />
                  Call
                </a>
              </div>
            )}
            <div className="flex items-center gap-1.5 opacity-90 text-[11px] italic sm:ml-auto">
              <span>* Meetings & call times are coordinated directly in the Team Chat Space</span>
            </div>
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
          <MessageCircle className="w-4 h-4" />
          <span>Team Chat Space</span>
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
                  className="w-full bg-[#fbf8f3] dark:bg-slate-800 border border-[#eadbc4] dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#c59c6c]"
                />

                {/* Media Attachment Chip */}
                {annMedia && (
                  <div className="flex items-center justify-between gap-2 bg-[#f5ede1] dark:bg-slate-800 border border-[#eadbc4] dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs">
                    <span className="flex items-center gap-2 truncate text-slate-800 dark:text-slate-200">
                      <Paperclip className="w-3.5 h-3.5 text-[#c59c6c]" />
                      <span className="font-bold truncate">{annMedia.name}</span>
                      <span className="text-[10px] text-slate-400">({(annMedia.size / 1024).toFixed(0)} KB)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setAnnMedia(null)}
                      className="p-1 hover:text-rose-500 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-[#c59c6c] hover:bg-[#f5ede1] dark:hover:bg-slate-800 text-[#8c6738] dark:text-[#c59c6c] text-xs font-bold cursor-pointer transition-colors">
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>{annMedia ? 'Change Attachment' : 'Attach Photo/Video (≤20MB)'}</span>
                      <input
                        type="file"
                        accept="image/*,video/*,.sbp,.pdf"
                        className="hidden"
                        onChange={(e) => handleSelectMedia(e.target.files?.[0], 'ann')}
                      />
                    </label>

                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={alsoShareToHome}
                        onChange={(e) => setAlsoShareToHome(e.target.checked)}
                        className="rounded border-slate-300 text-[#c59c6c] focus:ring-[#c59c6c]"
                      />
                      <span>Also publish to Church Home Feed</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={postingAnnouncement || (!announcementContent.trim() && !annMedia)}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#c59c6c] hover:bg-[#b08756] text-white font-bold text-xs shadow-md shadow-[#c59c6c]/20 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{postingAnnouncement ? 'Posting...' : 'Post Announcement'}</span>
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

                    {ann.content && (
                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-2 whitespace-pre-wrap leading-relaxed">
                        {ann.content}
                      </p>
                    )}

                    {ann.media_url && (
                      <MediaAttachmentCard
                        mediaUrl={ann.media_url}
                        mediaType={ann.media_type}
                        mediaName={ann.media_name}
                        mediaSize={ann.media_size}
                      />
                    )}
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

      {/* TAB 3: TEAM CHAT SPACE (Real Group Chat for Team) */}
      {activeTab === 'chat' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[650px]">
          {/* Chat Header */}
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-[#fbf8f3] to-white dark:from-slate-800/80 dark:to-slate-900 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#c59c6c] to-[#e4c59e] text-white flex items-center justify-center shadow-md shadow-[#c59c6c]/20">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">
                    {ministry.name} Team Chat Space
                  </h3>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                    Live Team Chat
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Real group chat for {ministry.name} volunteers and leaders to plan, discuss, and coordinate meetings.
                </p>
              </div>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#faf7f2]/30 dark:bg-slate-950/20">
            {chatMessages.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <MessageCircle className="w-12 h-12 mx-auto text-[#c59c6c] opacity-40 mb-2" />
                <div className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                  Welcome to the {ministry.name} Team Chat!
                </div>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Start the conversation! Leaders post meeting times, rehearsal schedules, or encouragement here.
                </p>
              </div>
            ) : (
              chatMessages.map((msg, i) => {
                const isMe =
                  (msg.user_id && currentUser?.id && msg.user_id === currentUser.id) ||
                  (msg.sender_name && msg.sender_name === currentUser?.name);
                const role = (msg.sender_role || '').toLowerCase();
                const canDeleteThis = canAdminOrPastor || isMe;

                return (
                  <div
                    key={msg.id || i}
                    className={`flex items-start gap-2.5 ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isMe && (
                      <div className="w-8 h-8 rounded-xl bg-[#c59c6c] text-white flex items-center justify-center text-xs font-black shrink-0 shadow-sm">
                        {(msg.sender_name || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <div
                      className={`max-w-[75%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-sm ${
                        isMe
                          ? 'bg-[#c59c6c] text-white'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1 text-[10px]">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span>{isMe ? 'You' : msg.sender_name || 'Team Member'}</span>
                          {role && role !== 'member' && (
                            <span
                              className={`text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded ${
                                isMe
                                  ? 'bg-white/20 text-white'
                                  : role === 'pastor'
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                                  : role === 'admin'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                              }`}
                            >
                              {role}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={isMe ? 'text-white/80' : 'text-slate-400'}>
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {canDeleteThis && (
                            <button
                              onClick={() => handleDeleteChatMessage(msg.id)}
                              className={`p-0.5 rounded hover:bg-black/10 transition-colors cursor-pointer ${
                                isMe ? 'text-white/80 hover:text-white' : 'text-slate-400 hover:text-rose-600'
                              }`}
                              title="Delete message"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      {msg.message && <div className="whitespace-pre-wrap">{msg.message}</div>}
                      {msg.media_url && (
                        <MediaAttachmentCard
                          mediaUrl={msg.media_url}
                          mediaType={msg.media_type}
                          mediaName={msg.media_name}
                          mediaSize={msg.media_size}
                          isMe={isMe}
                        />
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat Media Attachment Preview Chip */}
          {chatMedia && (
            <div className="mx-3 mt-2 flex items-center justify-between gap-2 bg-[#f5ede1] dark:bg-slate-800 border border-[#eadbc4] dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs">
              <span className="flex items-center gap-2 truncate text-slate-800 dark:text-slate-200">
                <Paperclip className="w-3.5 h-3.5 text-[#c59c6c]" />
                <span className="font-bold truncate">{chatMedia.name}</span>
                <span className="text-[10px] text-slate-400">({(chatMedia.size / 1024).toFixed(0)} KB)</span>
              </span>
              <button
                type="button"
                onClick={() => setChatMedia(null)}
                className="p-1 hover:text-rose-500 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Chat Input */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <form onSubmit={handleSendChat} className="flex items-center gap-2">
              <label
                className={`p-2.5 rounded-xl border transition-colors cursor-pointer flex items-center justify-center ${
                  chatMedia
                    ? 'border-[#c59c6c] bg-[#f5ede1] dark:bg-slate-800 text-[#c59c6c]'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'
                }`}
                title="Attach Photo or Video (< 10MB)"
              >
                <Paperclip className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/*,video/*,.sbp,.pdf"
                  className="hidden"
                  onChange={(e) => handleSelectMedia(e.target.files?.[0], 'chat')}
                />
              </label>

              <input
                type="text"
                placeholder={`Message ${ministry.name} team (e.g. rehearsal details, meeting location)...`}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-[#fbf8f3] dark:bg-slate-800 border border-[#eadbc4] dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#c59c6c]"
              />
              <button
                type="submit"
                disabled={sendingChat || (!chatInput.trim() && !chatMedia)}
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
