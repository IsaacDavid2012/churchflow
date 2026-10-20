import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Sparkles,
  HeartHandshake,
  Phone,
  MessageCircle,
  Megaphone,
  Send,
  Eye,
  ShieldCheck,
  CheckCircle2,
  Paperclip,
  Image as ImageIcon
} from 'lucide-react';
import { api } from '../api';
import { ROLES, normalizeRole, hasRole } from '../utils/roles';
import MediaAttachmentCard from './MediaAttachmentCard';
import MinistryHub from './MinistryHub';

export default function MinistriesManager({ currentUser }) {
  // Navigation: WhatsApp Community layout
  const [activeSection, setActiveSection] = useState('ministries'); // 'ministries' | 'announcements' | 'chat'

  // Ministries State
  const [ministries, setMinistries] = useState([]);
  const [selectedMinistry, setSelectedMinistry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [peopleList, setPeopleList] = useState([]);

  // Role permissions
  const userRole = normalizeRole(currentUser?.role);
  const isMember = userRole === ROLES.MEMBER;
  const isAdmin = userRole === ROLES.ADMIN;
  const isPastor = userRole === ROLES.PASTOR;
  const canManage = !isMember; // Admin, Pastor, Manager
  const canDelete = hasRole(userRole, [ROLES.ADMIN, ROLES.PASTOR]); // Admin, Pastor
  const canPostGeneralAnnouncement = isAdmin || isPastor; // Only Pastors and Admins

  // Ministry Create/Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMinistry, setEditingMinistry] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    leader_id: '',
    leader_name: '',
    leader_phone: '',
    description: '',
  });

  // General Announcements State
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [annMedia, setAnnMedia] = useState(null);
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

  // General Church Chat State
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

  useEffect(() => {
    loadMinistries();
    loadPeople();
  }, [search]);

  useEffect(() => {
    if (activeSection === 'announcements') {
      loadAnnouncements();
    } else if (activeSection === 'chat') {
      loadChat();
      scrollToBottom();
      const interval = setInterval(() => {
        loadChat();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === 'chat') {
      scrollToBottom();
    }
  }, [chatMessages, activeSection]);

  function scrollToBottom() {
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  async function loadMinistries() {
    setLoading(true);
    try {
      const data = await api.getMinistries({ search });
      setMinistries(data || []);
    } catch (err) {
      console.error('Failed to load ministries:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadPeople() {
    try {
      const data = await api.getPeople({ active: true });
      setPeopleList(data || []);
    } catch (err) {
      console.error('Failed to load people:', err);
    }
  }

  async function loadAnnouncements() {
    setLoadingAnnouncements(true);
    try {
      const data = await api.getCommunityAnnouncements();
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load community announcements:', err);
    } finally {
      setLoadingAnnouncements(false);
    }
  }

  async function loadChat() {
    try {
      const data = await api.getCommunityChat();
      setChatMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load community chat:', err);
    }
  }

  // --- Ministry Modal Handlers ---
  function handleOpenCreate() {
    if (isMember) return;
    setEditingMinistry(null);
    setFormData({
      name: '',
      leader_id: '',
      leader_name: '',
      leader_phone: '',
      description: '',
    });
    setIsModalOpen(true);
  }

  function handleOpenEdit(m) {
    if (!canManage) return;
    setEditingMinistry(m);
    setFormData({
      name: m.name || '',
      leader_id: m.leader_id || '',
      leader_name: m.leader_name || '',
      leader_phone: m.leader_phone || '',
      description: m.description || '',
    });
    setIsModalOpen(true);
  }

  function handleSelectLeader(musicianId) {
    if (!musicianId) {
      setFormData((prev) => ({
        ...prev,
        leader_id: '',
        leader_name: '',
        leader_phone: '',
      }));
      return;
    }
    const found = peopleList.find((p) => p.id === musicianId);
    if (found) {
      setFormData((prev) => ({
        ...prev,
        leader_id: found.id,
        leader_name: found.name,
        leader_phone: found.phone || '',
      }));
    }
  }

  async function handleSaveMinistry(e) {
    e.preventDefault();
    if (isMember) {
      alert('Members have read-only access. You cannot create or modify ministries.');
      return;
    }
    if (!formData.name.trim()) return;

    try {
      if (editingMinistry) {
        await api.updateMinistry(editingMinistry.id, formData);
      } else {
        await api.createMinistry(formData);
      }
      setIsModalOpen(false);
      loadMinistries();
    } catch (err) {
      alert(err.message || 'Failed to save ministry');
    }
  }

  async function handleDeleteMinistry(m) {
    if (!canDelete) {
      alert('Only Admins and Pastors have permission to delete ministries.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete the ministry "${m.name}"?`)) return;
    try {
      await api.deleteMinistry(m.id);
      loadMinistries();
    } catch (err) {
      alert(err.message || 'Failed to delete ministry');
    }
  }

  // --- General Announcements Handlers ---
  async function handlePostAnnouncement(e) {
    e.preventDefault();
    if (!canPostGeneralAnnouncement) {
      alert('Only Pastors and Admins can post general church announcements.');
      return;
    }
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

      await api.createCommunityAnnouncement({
        title: announcementTitle.trim() || undefined,
        content: announcementContent.trim(),
        media_url: mediaUrl,
        media_type: mediaType,
        media_name: mediaName,
        media_size: mediaSize,
      });
      setAnnouncementTitle('');
      setAnnouncementContent('');
      setAnnMedia(null);
      loadAnnouncements();
    } catch (err) {
      alert(err.message || 'Failed to post announcement');
    } finally {
      setPostingAnnouncement(false);
    }
  }

  async function handleDeleteAnnouncement(id) {
    if (!canDelete) {
      alert('Only Admins and Pastors can delete announcements.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await api.deleteCommunityAnnouncement(id);
      loadAnnouncements();
    } catch (err) {
      alert(err.message || 'Failed to delete announcement');
    }
  }

  // --- General Church Chat Handlers ---
  async function handleSendChat(e) {
    if (e && e.preventDefault) e.preventDefault();
    if ((!chatInput.trim() && !chatMedia) || sendingChat) return;

    const text = chatInput.trim();
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

      await api.sendCommunityChat({
        message: text,
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

  async function handleDeleteChatMessage(id) {
    if (!window.confirm('Delete this message?')) return;
    try {
      await api.deleteCommunityChat(id);
      loadChat();
    } catch (err) {
      alert(err.message || 'Failed to delete message');
    }
  }

  // If a specific ministry hub is opened
  if (selectedMinistry) {
    return (
      <MinistryHub
        ministry={selectedMinistry}
        currentUser={currentUser}
        onBack={() => {
          setSelectedMinistry(null);
          loadMinistries();
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Community Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
              <HeartHandshake className="w-7 h-7 text-[#c59c6c]" />
              Church Community & Ministries
            </h1>
            {isMember && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                <Eye className="w-3 h-3 text-slate-500" />
                Member View
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            WhatsApp Community model: General church broadcasts, whole-church family chat, and dedicated ministry hubs.
          </p>
        </div>

        {activeSection === 'ministries' && canManage && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-[#c59c6c] hover:bg-[#b08756] text-white font-bold text-xs shadow-md shadow-[#c59c6c]/20 transition-all self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Ministry</span>
          </button>
        )}
      </div>

      {/* WhatsApp Community Navigation Tabs */}
      <div className="flex items-center space-x-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
        <button
          onClick={() => setActiveSection('ministries')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeSection === 'ministries'
              ? 'bg-[#c59c6c] text-white shadow-md shadow-[#c59c6c]/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Church Ministries ({ministries.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('announcements')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeSection === 'announcements'
              ? 'bg-[#c59c6c] text-white shadow-md shadow-[#c59c6c]/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>General Announcements</span>
        </button>

        <button
          onClick={() => setActiveSection('chat')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeSection === 'chat'
              ? 'bg-[#c59c6c] text-white shadow-md shadow-[#c59c6c]/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>General Church Chat</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: CHURCH MINISTRIES                             */}
      {/* ======================================================== */}
      {activeSection === 'ministries' && (
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search church ministries by name, leader, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#fbf8f3] border border-[#eadbc4] rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#c59c6c]"
            />
          </div>

          {/* Ministries Grid */}
          {loading ? (
            <div className="text-center py-16 text-slate-500">
              <div className="animate-spin w-8 h-8 border-2 border-[#c59c6c] border-t-transparent rounded-full mx-auto mb-3"></div>
              <span className="text-xs">Loading church ministries...</span>
            </div>
          ) : ministries.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 text-slate-500 shadow-sm">
              <Users className="w-12 h-12 mx-auto text-slate-400 mb-3" />
              <div className="font-bold text-slate-800">No ministries found</div>
              <div className="text-xs text-slate-500 mt-1">
                {canManage ? 'Click "Create Ministry" above to set up a new church team.' : 'Check back later for active ministry teams.'}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
              {ministries.map((m) => (
                <div
                  key={m.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-[#c59c6c]/60 transition-all shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-base text-slate-900">{m.name}</h3>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Department Ministry
                        </div>
                      </div>

                      {/* Edit / Delete Buttons - HIDDEN for members */}
                      {canManage && (
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleOpenEdit(m)}
                            className="p-1.5 text-slate-400 hover:text-[#c59c6c] hover:bg-[#f5ede1] rounded-lg transition-colors cursor-pointer"
                            title="Edit Ministry"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteMinistry(m)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Ministry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {m.description && (
                      <p className="mt-3 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                        {m.description}
                      </p>
                    )}

                    <div className="mt-4 text-xs text-slate-600 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#c59c6c] shrink-0" />
                        <span>Leader: <strong className="text-slate-900">{m.leader_name || 'TBD'}</strong></span>
                      </div>

                      {/* Leader Contact Buttons */}
                      {m.leader_phone && (
                        <div className="flex items-center space-x-2 pt-2">
                          <a
                            href={`https://wa.me/${m.leader_phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                          >
                            <MessageCircle className="w-3 h-3 text-emerald-600" />
                            WhatsApp Leader
                          </a>
                          <a
                            href={`tel:${m.leader_phone}`}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors"
                          >
                            <Phone className="w-3 h-3 text-slate-500" />
                            Call
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                      <span>Serving Volunteers</span>
                      <span className="font-bold text-[#8c6738] bg-[#f5ede1] px-2 py-0.5 rounded-md border border-[#eadbc4]">
                        {m.member_count === 1 ? '1 member serving' : `${m.member_count || 0} members serving`}
                      </span>
                    </div>

                    {/* Enter Ministry Hub Button */}
                    <button
                      onClick={() => setSelectedMinistry(m)}
                      className="flex items-center justify-center space-x-1.5 w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#c59c6c] to-[#b08756] hover:from-[#b08756] hover:to-[#9b7242] text-white font-bold text-xs shadow-md shadow-[#c59c6c]/20 transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Open {m.name} Hub</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 2: GENERAL ANNOUNCEMENTS                         */}
      {/* ======================================================== */}
      {activeSection === 'announcements' && (
        <div className="space-y-4">
          {/* Post Composer - Strictly for Pastors and Admins */}
          {canPostGeneralAnnouncement ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 mb-3">
                <Megaphone className="w-4 h-4 text-[#c59c6c]" />
                <span>Broadcast General Church Announcement</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  Pastor & Admin Only
                </span>
              </div>

              <form onSubmit={handlePostAnnouncement} className="space-y-3">
                <input
                  type="text"
                  placeholder="Announcement Title (e.g. Sunday Combined Celebration & Call Times)"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  className="w-full bg-[#fbf8f3] border border-[#eadbc4] rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#c59c6c]"
                />
                <textarea
                  rows="3"
                  placeholder="Write official church announcement for the entire congregation and serving teams..."
                  value={announcementContent}
                  onChange={(e) => setAnnouncementContent(e.target.value)}
                  className="w-full bg-[#fbf8f3] border border-[#eadbc4] rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#c59c6c]"
                />

                {/* Media Attachment Chip */}
                {annMedia && (
                  <div className="flex items-center justify-between gap-2 bg-[#f5ede1] border border-[#eadbc4] px-3 py-1.5 rounded-xl text-xs">
                    <span className="flex items-center gap-2 truncate text-slate-800">
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

                <div className="flex justify-between items-center pt-1">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-[#c59c6c] hover:bg-[#f5ede1] text-[#8c6738] text-xs font-bold cursor-pointer transition-colors">
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>{annMedia ? 'Change Attachment' : 'Attach Photo/Video (<10MB)'}</span>
                      <input
                        type="file"
                        accept="image/*,video/*,.sbp,.pdf"
                        className="hidden"
                        onChange={(e) => handleSelectMedia(e.target.files?.[0], 'ann')}
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={postingAnnouncement || (!announcementContent.trim() && !annMedia)}
                    className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-[#c59c6c] hover:bg-[#b08756] text-white font-bold text-xs shadow-md shadow-[#c59c6c]/20 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{postingAnnouncement ? 'Broadcasting...' : 'Broadcast Announcement'}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-[#fbf8f3] border border-[#eadbc4] rounded-2xl p-4 flex items-center space-x-3 text-slate-700">
              <Megaphone className="w-5 h-5 text-[#c59c6c] shrink-0" />
              <div className="text-xs">
                <strong>General Church Announcements Channel</strong> — Official broadcast stream for Jesus My Rock Church. Only Pastors and Admins can publish announcements. All members have read-only view.
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
            <div className="text-center py-14 bg-white rounded-2xl border border-slate-200 p-6 text-slate-500">
              <Megaphone className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <div className="font-bold text-slate-800 text-sm">No general announcements yet</div>
              <div className="text-xs text-slate-500 mt-1">
                Official church updates, pastoral letters, and global announcements will appear here.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-[#c59c6c]/50 transition-all shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#c59c6c] to-[#e4c59e] text-white flex items-center justify-center font-black text-sm shadow-sm">
                        {(ann.author_name || 'P')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">
                            {ann.author_name || 'Pastor / Church Leadership'}
                          </span>
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            {ann.author_role || 'Pastor'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(ann.created_at).toLocaleDateString([], {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}{' '}
                          at{' '}
                          {new Date(ann.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    {canDelete && (
                      <button
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Announcement"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {ann.title && (
                    <h4 className="font-bold text-sm text-slate-900 mt-3">{ann.title}</h4>
                  )}
                  {ann.content && (
                    <p className="text-xs text-slate-700 mt-2 leading-relaxed whitespace-pre-wrap">
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
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 3: GENERAL CHURCH CHAT                           */}
      {/* ======================================================== */}
      {activeSection === 'chat' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[650px]">
          {/* Chat Header */}
          <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-[#fbf8f3] to-white flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#c59c6c] to-[#e4c59e] text-white flex items-center justify-center shadow-md shadow-[#c59c6c]/20">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-black text-sm text-slate-900">
                    General Church Family Chat
                  </h3>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                    Whole Church Live Chat
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Open discussion space for all church members to greet, pray, and encourage one another.
                </p>
              </div>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#faf7f2]/30">
            {chatMessages.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <MessageCircle className="w-12 h-12 mx-auto text-[#c59c6c] opacity-40 mb-2" />
                <div className="font-bold text-slate-700 text-sm">
                  Welcome to Jesus My Rock Church Family Chat!
                </div>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Say hello, share a scripture, or post a prayer request for the church community.
                </p>
              </div>
            ) : (
              chatMessages.map((msg, i) => {
                const isMe =
                  (msg.user_id && currentUser?.id && msg.user_id === currentUser.id) ||
                  (msg.sender_name && msg.sender_name === currentUser?.name);
                const role = (msg.sender_role || '').toLowerCase();
                const canDeleteThis = canDelete || isMe;

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
                          : 'bg-white border border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1 text-[10px]">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span>{isMe ? 'You' : msg.sender_name || 'Church Member'}</span>
                          {role && role !== 'member' && (
                            <span
                              className={`text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded ${
                                isMe
                                  ? 'bg-white/20 text-white'
                                  : role === 'pastor'
                                  ? 'bg-rose-100 text-rose-700'
                                  : role === 'admin'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-amber-100 text-amber-800'
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
            <div className="mx-3 mt-2 flex items-center justify-between gap-2 bg-[#f5ede1] border border-[#eadbc4] px-3 py-1.5 rounded-xl text-xs">
              <span className="flex items-center gap-2 truncate text-slate-800">
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
          <div className="p-3 border-t border-slate-200 bg-white">
            <form onSubmit={handleSendChat} className="flex items-center gap-2">
              <label
                className={`p-2.5 rounded-xl border transition-colors cursor-pointer flex items-center justify-center ${
                  chatMedia
                    ? 'border-[#c59c6c] bg-[#f5ede1] text-[#c59c6c]'
                    : 'border-slate-200 hover:bg-slate-100 text-slate-500'
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
                placeholder="Type a message to the church family..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-[#fbf8f3] border border-[#eadbc4] rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#c59c6c]"
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

      {/* ======================================================== */}
      {/* CREATE / EDIT MINISTRY MODAL                             */}
      {/* ======================================================== */}
      {isModalOpen && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl transition-colors">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">
                {editingMinistry ? 'Edit Church Ministry' : 'Create New Ministry'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMinistry} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Ministry Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Media Team, Worship Ministry, or Production Team"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full bg-[#fbf8f3] border border-[#eadbc4] rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#c59c6c]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Ministry Leader (Selected from People List) *
                </label>
                <select
                  value={formData.leader_id}
                  onChange={(e) => handleSelectLeader(e.target.value)}
                  className="w-full bg-[#fbf8f3] border border-[#eadbc4] rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#c59c6c] cursor-pointer"
                >
                  <option value="">-- Select Leader from People Directory --</option>
                  {peopleList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.phone ? `(${p.phone})` : ''} - {p.role || 'Member'}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Selecting a leader automatically assigns them as manager of this ministry and links their contact info.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Ministry Description (Optional)
                </label>
                <textarea
                  rows="3"
                  placeholder="Describe ministry mission, volunteer duties, and equipment used..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-[#fbf8f3] border border-[#eadbc4] rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#c59c6c]"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#c59c6c] hover:bg-[#b08756] text-white rounded-xl text-xs font-bold shadow-md shadow-[#c59c6c]/20 cursor-pointer"
                >
                  {editingMinistry ? 'Save Changes' : 'Create Ministry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
