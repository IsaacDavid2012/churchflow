import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Calendar, 
  MapPin, 
  Pin, 
  Plus, 
  Trash2, 
  Send, 
  X, 
  Image as ImageIcon, 
  Video, 
  Clock, 
  Sparkles, 
  Layers, 
  ChevronRight,
  Upload,
  CheckCircle2,
  FileText,
  Radio,
  ExternalLink,
  Play,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { api } from '../api';
import MediaAttachmentCard from './MediaAttachmentCard';

export default function HomeFeed({ currentUser, onNavigateTab }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'announcement', 'event', 'media', 'live'
  
  // YouTube Live Stream State
  const [liveStatus, setLiveStatus] = useState(null);
  const [checkingLive, setCheckingLive] = useState(false);
  const [isGoLiveModalOpen, setIsGoLiveModalOpen] = useState(false);
  const [manualLiveUrl, setManualLiveUrl] = useState('');
  const [manualLiveTitle, setManualLiveTitle] = useState('');
  const [liveChatTab, setLiveChatTab] = useState({}); // { [postId]: 'church' | 'youtube' }

  // Upcoming Service widget
  const [upcomingService, setUpcomingService] = useState(null);

  // Active Ministries (for cross-posting dropdown)
  const [ministries, setMinistries] = useState([]);

  // Create Post Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [postType, setPostType] = useState('announcement');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [destination, setDestination] = useState('home'); // 'home', 'ministry', 'both'
  const [selectedMinistryId, setSelectedMinistryId] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  
  // Multiple media attachments (up to 10 photos/media items, <= 20MB each)
  const [mediaAttachments, setMediaAttachments] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');

  // Comments state: { [postId]: { isOpen: boolean, loading: boolean, comments: [] } }
  const [activeComments, setActiveComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [submittingComment, setSubmittingComment] = useState({});

  // Lightbox for multi-photo gallery
  const [lightbox, setLightbox] = useState({ isOpen: false, photos: [], index: 0 });

  const userRole = (currentUser?.role || '').toLowerCase();
  const canPost = ['admin', 'pastor', 'manager', 'leader'].includes(userRole);

  useEffect(() => {
    loadFeed();
    loadUpcomingService();
    loadMinistries();
    loadLiveStatus();

    // Poll live status every 30s
    const liveTimer = setInterval(loadLiveStatus, 30000);
    return () => clearInterval(liveTimer);
  }, []);

  async function loadLiveStatus() {
    try {
      const data = await api.getChurchLiveStatus();
      setLiveStatus(data || null);
    } catch (e) {
      console.warn('Failed to load church live status:', e);
    }
  }

  // Auto-refresh comments for any open live stream post every 4 seconds
  useEffect(() => {
    const openLivePostIds = Object.keys(activeComments).filter((id) => {
      if (!activeComments[id]?.isOpen) return false;
      const post = posts.find((p) => p.id === id);
      return post?.post_type === 'live_stream' || post?.media_type === 'youtube_live';
    });

    if (openLivePostIds.length === 0) return;

    const interval = setInterval(async () => {
      for (const id of openLivePostIds) {
        try {
          const latestComments = await api.getFeedPostComments(id);
          setActiveComments((prev) => ({
            ...prev,
            [id]: {
              ...prev[id],
              comments: latestComments || [],
            },
          }));
        } catch (e) {
          // ignore background polling error
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeComments, posts]);

  async function handleCheckLiveNow() {
    setCheckingLive(true);
    try {
      const res = await api.checkChurchLiveNow();
      await loadLiveStatus();
      await loadFeed();
      if (res.isLive) {
        alert('🔴 Church is currently LIVE on YouTube! Feed post and phone alerts updated.');
      } else {
        alert('Channel is currently offline (no active live stream detected).');
      }
    } catch (err) {
      alert('Live check error: ' + err.message);
    } finally {
      setCheckingLive(false);
    }
  }

  async function handleManualGoLive(e) {
    e.preventDefault();
    if (!manualLiveUrl.trim()) {
      alert('Please enter a YouTube video URL or ID.');
      return;
    }
    setCheckingLive(true);
    try {
      await api.manualGoLive({
        urlOrVideoId: manualLiveUrl.trim(),
        customTitle: manualLiveTitle.trim() || undefined,
      });
      setIsGoLiveModalOpen(false);
      setManualLiveUrl('');
      setManualLiveTitle('');
      await loadLiveStatus();
      await loadFeed();
      alert('🔴 Live stream broadcast activated! Feed post created from "Jesus My Rock" and church members notified.');
    } catch (err) {
      alert('Failed to trigger live: ' + err.message);
    } finally {
      setCheckingLive(false);
    }
  }

  async function handleEndLiveStream() {
    if (!window.confirm('Are you sure you want to mark the live stream as ended? The post will remain in feed for replay.')) return;
    setCheckingLive(true);
    try {
      await api.endLiveStream();
      await loadLiveStatus();
      await loadFeed();
      alert('Live stream marked as ended.');
    } catch (err) {
      alert('Failed to end stream: ' + err.message);
    } finally {
      setCheckingLive(false);
    }
  }

  async function loadFeed() {
    setLoading(true);
    try {
      const data = await api.getFeedPosts({ destination: 'home' });
      setPosts(data || []);
    } catch (err) {
      console.error('Failed to load feed:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadUpcomingService() {
    try {
      const services = await api.getServices();
      if (Array.isArray(services) && services.length > 0) {
        // Pick the first upcoming service
        const now = new Date();
        const future = services.find((s) => new Date(s.service_date) >= now) || services[0];
        setUpcomingService(future);
      }
    } catch (e) {
      console.warn('Failed to load upcoming service for home banner:', e);
    }
  }

  async function loadMinistries() {
    try {
      const data = await api.getMinistries();
      setMinistries(data || []);
      if (data && data.length > 0 && !selectedMinistryId) {
        setSelectedMinistryId(data[0].id);
      }
    } catch (e) {
      console.warn('Failed to load ministries for destination dropdown:', e);
    }
  }

  // Handle Multi-file Upload (Up to 10 items, <= 20MB each)
  async function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (mediaAttachments.length + files.length > 10) {
      alert('You can upload a maximum of 10 media items per post.');
      return;
    }

    setUploadingFiles(true);
    setPostError('');

    try {
      for (const file of files) {
        if (file.size > 20 * 1024 * 1024) {
          alert(`File "${file.name}" exceeds the 20MB limit. Please upload files under 20MB.`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        const token = localStorage.getItem('servesync_token');
        const res = await fetch('/api/community/upload', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Upload failed');
        }

        const uploaded = await res.json();
        setMediaAttachments((prev) => [...prev, uploaded]);
      }
    } catch (err) {
      setPostError(err.message || 'Failed to upload attachments.');
    } finally {
      setUploadingFiles(false);
      e.target.value = '';
    }
  }

  function handleRemoveAttachment(index) {
    setMediaAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  // Handle Post Creation
  async function handleCreatePost(e) {
    e.preventDefault();
    if (!title.trim() && !content.trim() && mediaAttachments.length === 0) {
      setPostError('Please enter a title, content, or add a media attachment.');
      return;
    }

    if ((destination === 'ministry' || destination === 'both') && !selectedMinistryId) {
      setPostError('Please select a target Ministry Hub.');
      return;
    }

    setPosting(true);
    setPostError('');

    try {
      const payload = {
        title: title.trim() || 'Church Update',
        content: content.trim(),
        post_type: postType,
        destination,
        ministry_id: (destination === 'ministry' || destination === 'both') ? selectedMinistryId : null,
        event_date: (postType === 'event' && eventDate) ? new Date(eventDate).toISOString() : null,
        event_location: (postType === 'event' && eventLocation) ? eventLocation.trim() : null,
        is_pinned: isPinned,
        media_attachments: mediaAttachments,
        media_url: mediaAttachments[0]?.url || null,
        media_type: mediaAttachments[0]?.type || null,
        media_name: mediaAttachments[0]?.name || null,
        media_size: mediaAttachments[0]?.size || null,
      };

      const newPost = await api.createFeedPost(payload);
      setPosts((prev) => [newPost, ...prev]);

      // Reset modal state
      setIsCreateOpen(false);
      setTitle('');
      setContent('');
      setEventDate('');
      setEventLocation('');
      setPostType('announcement');
      setDestination('home');
      setIsPinned(false);
      setMediaAttachments([]);
    } catch (err) {
      setPostError(err.message || 'Failed to create post');
    } finally {
      setPosting(false);
    }
  }

  // Handle Post Deletion
  async function handleDeletePost(postId) {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await api.deleteFeedPost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      alert('Failed to delete post: ' + err.message);
    }
  }

  // Handle Like Toggle
  async function handleToggleLike(postId) {
    // Optimistic UI update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const nextLiked = !p.has_liked;
          const nextCount = nextLiked ? (p.likes_count || 0) + 1 : Math.max(0, (p.likes_count || 0) - 1);
          return { ...p, has_liked: nextLiked, likes_count: nextCount };
        }
        return p;
      })
    );

    try {
      const res = await api.toggleFeedLike(postId);
      // Reconcile with server response
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, has_liked: res.liked, likes_count: res.likes_count } : p
        )
      );
    } catch (err) {
      console.error('Like error:', err);
      // Revert optimistic update
      loadFeed();
    }
  }

  // Handle Comments Drawer Toggle & Load
  async function toggleComments(postId) {
    const isCurrentlyOpen = activeComments[postId]?.isOpen;
    if (isCurrentlyOpen) {
      setActiveComments((prev) => ({
        ...prev,
        [postId]: { ...prev[postId], isOpen: false },
      }));
      return;
    }

    setActiveComments((prev) => ({
      ...prev,
      [postId]: { isOpen: true, loading: true, comments: prev[postId]?.comments || [] },
    }));

    try {
      const data = await api.getFeedPostComments(postId);
      setActiveComments((prev) => ({
        ...prev,
        [postId]: { isOpen: true, loading: false, comments: data || [] },
      }));
    } catch (err) {
      console.error('Failed to load comments:', err);
      setActiveComments((prev) => ({
        ...prev,
        [postId]: { isOpen: true, loading: false, comments: [] },
      }));
    }
  }

  // Handle Add Comment
  async function handleAddComment(postId) {
    const input = (commentInputs[postId] || '').trim();
    if (!input) return;

    setSubmittingComment((prev) => ({ ...prev, [postId]: true }));
    try {
      const newComment = await api.addFeedPostComment(postId, input);
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));

      // Add to comments list and increment count
      setActiveComments((prev) => ({
        ...prev,
        [postId]: {
          ...prev[postId],
          comments: [...(prev[postId]?.comments || []), newComment],
        },
      }));

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p
        )
      );
    } catch (err) {
      alert('Failed to post comment: ' + err.message);
    } finally {
      setSubmittingComment((prev) => ({ ...prev, [postId]: false }));
    }
  }

  // Handle Delete Comment
  async function handleDeleteComment(postId, commentId) {
    try {
      await api.deleteFeedPostComment(postId, commentId);
      setActiveComments((prev) => ({
        ...prev,
        [postId]: {
          ...prev[postId],
          comments: (prev[postId]?.comments || []).filter((c) => c.id !== commentId),
        },
      }));

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comments_count: Math.max(0, (p.comments_count || 0) - 1) } : p
        )
      );
    } catch (err) {
      alert('Failed to delete comment: ' + err.message);
    }
  }

  // Helper to extract 11-char YouTube ID
  function parseYouTubeId(url) {
    if (!url) return null;
    if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*?v=|live\/|embed\/))([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  // Filter posts
  const filteredPosts = posts.filter((p) => {
    if (filter === 'all') return true;
    if (filter === 'live') return p.post_type === 'live_stream' || p.media_type === 'youtube_live' || (p.media_name && /^[a-zA-Z0-9_-]{11}$/.test(p.media_name));
    if (filter === 'announcement') return p.post_type === 'announcement';
    if (filter === 'event') return p.post_type === 'event';
    if (filter === 'media') return p.post_type === 'media' || (p.media_attachments && p.media_attachments.length > 0) || p.media_url;
    return true;
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* 1. Hero & Upcoming Service Countdown Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-[#2c2214] text-white p-6 sm:p-8 shadow-xl border border-slate-700">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#c59c6c]/25 border border-[#c59c6c]/40 text-[#f5ede1] text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-[#c59c6c]" /> Church Community Feed
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {currentUser?.name || 'Church Family'}! 👋
            </h1>
            <p className="text-slate-300 text-sm max-w-xl">
              Stay connected with upcoming services, church announcements, worship events, and team updates.
            </p>
          </div>

          {upcomingService && (
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-4 sm:p-5 shrink-0 min-w-[280px]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#c59c6c] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Next Worship Service
              </div>
              <div className="font-extrabold text-base mt-1 text-white">
                {upcomingService.service_type || 'Sunday Celebration'}
              </div>
              <div className="text-xs text-slate-300 mt-0.5">
                {new Date(upcomingService.service_date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                • {upcomingService.service_time || '10:00 AM'}
              </div>
              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('services')}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#c59c6c] hover:bg-[#b08756] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  View Lineup & Roster <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 1.5. Sticky YouTube Live Stream Alert Banner */}
      {liveStatus?.isLive && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white p-5 sm:p-6 shadow-xl border border-red-400/50 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-black tracking-wider uppercase">
                <img src="/jmrlogo.png" alt="Jesus My Rock" className="w-4 h-4 rounded-full object-contain bg-black ring-1 ring-white/50" />
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                JESUS MY ROCK IS LIVE NOW
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                {liveStatus.title || 'Sunday Worship Service & Prophetic Word'}
              </h2>
              <p className="text-white/90 text-xs sm:text-sm">
                Join our live praise, worship, and Sunday sermon. Watch the broadcast below and participate in live comments!
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {liveStatus.videoId && (
                <a
                  href={`https://www.youtube.com/watch?v=${liveStatus.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-white text-red-600 font-extrabold text-xs shadow-lg hover:bg-slate-100 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Watch on YouTube
                </a>
              )}
              {canPost && (
                <button
                  onClick={handleEndLiveStream}
                  disabled={checkingLive}
                  className="px-3 py-2 rounded-xl bg-black/30 hover:bg-black/50 text-white font-bold text-xs transition-all border border-white/20 cursor-pointer"
                >
                  End Stream
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Admin / Pastor / Manager Post Composer Bar */}
      {canPost && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm transition-all hover:border-[#c59c6c]/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#c59c6c] to-[#8c6738] text-white font-bold flex items-center justify-center shadow-sm shrink-0">
              {(currentUser?.name || 'U').slice(0, 2).toUpperCase()}
            </div>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex-1 text-left px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 text-slate-500 dark:text-slate-400 text-sm font-medium transition-colors cursor-pointer border border-transparent hover:border-slate-300 dark:hover:border-slate-600"
            >
              Share an announcement, event, or photo with church...
            </button>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-around sm:justify-start sm:gap-6 text-xs font-bold text-slate-600 dark:text-slate-400">
            <button
              onClick={() => { setPostType('announcement'); setIsCreateOpen(true); }}
              className="flex items-center gap-1.5 hover:text-[#c59c6c] transition-colors py-1 cursor-pointer"
            >
              <span className="text-base">📢</span> Announcement
            </button>
            <button
              onClick={() => { setPostType('event'); setIsCreateOpen(true); }}
              className="flex items-center gap-1.5 hover:text-[#c59c6c] transition-colors py-1 cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-emerald-500" /> Church Event
            </button>
            <button
              onClick={() => { setPostType('media'); setIsCreateOpen(true); }}
              className="flex items-center gap-1.5 hover:text-[#c59c6c] transition-colors py-1 cursor-pointer"
            >
              <ImageIcon className="w-4 h-4 text-sky-500" /> Photo / Video (<span className="text-[10px] text-amber-600">≤20MB</span>)
            </button>
            <button
              onClick={() => setIsGoLiveModalOpen(true)}
              className="flex items-center gap-1.5 hover:text-red-600 transition-colors py-1 cursor-pointer text-red-600 dark:text-red-400"
            >
              <Radio className="w-4 h-4 animate-pulse" /> Live Stream
            </button>
          </div>
        </div>
      )}

      {/* 3. Feed Navigation Filters */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1">
        <div className="flex items-center gap-2">
          {[
            { id: 'all', label: 'All Updates' },
            ...(liveStatus?.isLive ? [{ id: 'live', label: '🔴 LIVE NOW' }] : []),
            { id: 'announcement', label: '📢 Announcements' },
            { id: 'event', label: '📅 Events' },
            { id: 'media', label: '📸 Photos & Media' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                filter === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-400 font-medium shrink-0">
          {filteredPosts.length} post{filteredPosts.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* 4. Feed Stream */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 animate-pulse space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
              </div>
              <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-[#f5ede1] dark:bg-slate-800 text-[#c59c6c] flex items-center justify-center mx-auto mb-4 text-2xl shadow-sm">
            ⛪
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No posts in this feed yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            {canPost
              ? 'Be the first to share an announcement, upcoming event, or worship video with the church!'
              : 'Check back soon for church announcements and ministry updates.'}
          </p>
          {canPost && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-[#c59c6c] hover:bg-[#b08756] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4 inline mr-1" /> Create First Post
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {filteredPosts.map((post) => {
            const hasAttachments = Array.isArray(post.media_attachments) && post.media_attachments.length > 0;
            const attachmentsList = hasAttachments
              ? post.media_attachments
              : post.media_url
              ? [{ url: post.media_url, type: post.media_type, name: post.media_name, size: post.media_size }]
              : [];

            const isEvent = post.post_type === 'event' || !!post.event_date;
            const isLiveStream = post.post_type === 'live_stream' || post.media_type === 'youtube_live';
            const liveVideoId = post.media_name && /^[a-zA-Z0-9_-]{11}$/.test(post.media_name)
              ? post.media_name
              : parseYouTubeId(post.media_url);

            const commentsOpen = isLiveStream ? true : activeComments[post.id]?.isOpen;
            const commentsList = activeComments[post.id]?.comments || [];
            const commentsLoading = activeComments[post.id]?.loading;
            const currentChatTab = liveChatTab[post.id] || 'church';

            return (
              <article
                key={post.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border ${
                  isLiveStream
                    ? 'border-red-500/60 ring-2 ring-red-500/20 shadow-md'
                    : post.is_pinned
                    ? 'border-[#c59c6c] ring-1 ring-[#c59c6c]/20 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 shadow-sm'
                } p-5 sm:p-6 transition-all`}
              >
                {/* Post Top Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-full font-black flex items-center justify-center shrink-0 shadow-sm text-sm text-white overflow-hidden ${
                      isLiveStream || post.author_name === 'Jesus My Rock'
                        ? 'bg-black ring-2 ring-red-500'
                        : 'bg-gradient-to-br from-[#c59c6c] to-[#8c6738]'
                    }`}>
                      {isLiveStream || post.author_name === 'Jesus My Rock' ? (
                        <img
                          src="/jmrlogo.png"
                          alt="Jesus My Rock"
                          className="w-full h-full object-contain p-0.5"
                        />
                      ) : (
                        (post.author_name || 'C').slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                          {isLiveStream ? 'Jesus My Rock' : post.author_name}
                        </span>
                        {isLiveStream ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-600 text-white flex items-center gap-1 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                            Live Broadcast
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold capitalize bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {post.author_role}
                          </span>
                        )}
                        {post.destination === 'both' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            🏛️ {post.ministry_name || 'Ministry Hub'} • Church-wide
                          </span>
                        )}
                        {post.destination === 'ministry' && post.ministry_name && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                            🏛️ {post.ministry_name}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(post.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        {post.is_pinned && (
                          <span className={`${isLiveStream ? 'text-red-500' : 'text-[#c59c6c]'} font-bold flex items-center gap-0.5`}>
                            <Pin className="w-3 h-3" /> Pinned
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Options (Delete if Author, Pastor, Admin, or Manager) */}
                  {(currentUser?.id === post.author_id || ['admin', 'pastor', 'manager'].includes(userRole)) && (
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                      title="Delete Post"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Post Body: Title & Content */}
                <div className="mt-3.5 space-y-2">
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-snug">
                    {post.title}
                  </h2>
                  {post.content && (
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                      {post.content}
                    </p>
                  )}
                </div>

                {/* YouTube Live Stream Embedded Console */}
                {isLiveStream && liveVideoId && (
                  <div className="mt-4 rounded-2xl overflow-hidden border border-red-200 dark:border-red-900/60 bg-black shadow-lg">
                    {/* 16:9 Video Player */}
                    <div className="relative w-full aspect-video bg-black">
                      <iframe
                        src={`https://www.youtube.com/embed/${liveVideoId}?autoplay=1&rel=0`}
                        title={post.title || 'Jesus My Rock Live Broadcast'}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>

                    {/* Live Stream Tabs */}
                    <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setLiveChatTab((prev) => ({ ...prev, [post.id]: 'church' }))}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            currentChatTab === 'church'
                              ? 'bg-red-600 text-white shadow-sm'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          ChurchFlow Live Chat ({commentsList.length || post.comments_count || 0})
                        </button>

                        <button
                          type="button"
                          onClick={() => setLiveChatTab((prev) => ({ ...prev, [post.id]: 'youtube' }))}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            currentChatTab === 'youtube'
                              ? 'bg-red-600 text-white shadow-sm'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          <Radio className="w-3.5 h-3.5" />
                          YouTube Live Chat
                        </button>
                      </div>

                      <a
                        href={`https://www.youtube.com/watch?v=${liveVideoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <span>Open on YouTube</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    {/* YouTube Live Chat Embedded Frame */}
                    {currentChatTab === 'youtube' && (
                      <div className="p-3 bg-slate-950 border-t border-slate-800">
                        <div className="text-[11px] text-slate-400 mb-2 flex items-center gap-1.5">
                          <Radio className="w-3 h-3 text-red-500" />
                          Live YouTube Chat (sign in with your Google account on YouTube to post directly)
                        </div>
                        <iframe
                          src={`https://www.youtube.com/live_chat?v=${liveVideoId}&embed_domain=${window.location.hostname}`}
                          title="YouTube Live Chat"
                          className="w-full h-80 rounded-xl border border-slate-800 bg-black"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Event Details Card (if post is an event) */}
                {isEvent && (
                  <div className="mt-3.5 p-3.5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-200/80 dark:border-emerald-800/40 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex flex-col items-center justify-center font-extrabold shrink-0 shadow-sm leading-tight">
                      <span className="text-[10px] uppercase">
                        {post.event_date ? new Date(post.event_date).toLocaleDateString('en-US', { month: 'short' }) : 'EVENT'}
                      </span>
                      <span className="text-base">
                        {post.event_date ? new Date(post.event_date).getDate() : '📅'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                        {post.event_date
                          ? new Date(post.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : 'Upcoming Church Gathering'}
                      </div>
                      {post.event_location && (
                        <div className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0" /> {post.event_location}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Media Gallery (Up to 10 photos/media items, <= 20MB each) - Do not duplicate for live stream posts */}
                {!isLiveStream && attachmentsList.length > 0 && (
                  <div className="mt-3.5">
                    {attachmentsList.length === 1 ? (
                      <MediaAttachmentCard
                        mediaUrl={attachmentsList[0].url}
                        mediaType={attachmentsList[0].type}
                        mediaName={attachmentsList[0].name}
                        mediaSize={attachmentsList[0].size}
                      />
                    ) : (
                      // Multi-Photo Responsive Gallery Grid
                      <div className="space-y-2">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <ImageIcon className="w-3 h-3 text-[#c59c6c]" /> {attachmentsList.length} Photos Attached
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {attachmentsList.slice(0, 6).map((item, idx) => (
                            <div
                              key={idx}
                              onClick={() => setLightbox({ isOpen: true, photos: attachmentsList, index: idx })}
                              className="relative group rounded-xl overflow-hidden cursor-pointer border border-slate-200 dark:border-slate-700 aspect-square bg-black/5"
                            >
                              <img
                                src={item.url}
                                alt={item.name || `Photo ${idx + 1}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                              {idx === 5 && attachmentsList.length > 6 && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-extrabold text-lg">
                                  +{attachmentsList.length - 6} more
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Social Interactions Bar (Likes & Comments) */}
                <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-4">
                    {/* Like button */}
                    <button
                      onClick={() => handleToggleLike(post.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                        post.has_liked
                          ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/40'
                          : 'hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Heart
                        className={`w-4 h-4 transition-transform active:scale-125 ${
                          post.has_liked ? 'fill-rose-600 text-rose-600' : ''
                        }`}
                      />
                      <span>{post.likes_count || 0}</span>
                      <span className="hidden sm:inline font-normal">Likes</span>
                    </button>

                    {/* Comments button */}
                    <button
                      onClick={() => toggleComments(post.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{post.comments_count || 0}</span>
                      <span className="hidden sm:inline font-normal">Comments</span>
                    </button>
                  </div>

                  {/* Share button */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${post.title}\n${post.content}\n\nShared from ChurchFlow: https://serve.creativeclicks.art`
                      );
                      alert('Post copied to clipboard!');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                    title="Share post"
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="hidden sm:inline font-normal">Share</span>
                  </button>
                </div>

                {/* Expandable Comments Thread */}
                {commentsOpen && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3.5">
                    {commentsLoading ? (
                      <div className="text-center py-3 text-xs text-slate-400">Loading comments...</div>
                    ) : commentsList.length === 0 ? (
                      <div className="text-center py-2 text-xs text-slate-400">
                        No comments yet. Join the conversation!
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                        {commentsList.map((c) => (
                          <div key={c.id} className="flex items-start gap-2.5 group">
                            <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center shrink-0">
                              {(c.user_name || 'U').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3 py-2 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-slate-900 dark:text-white">{c.user_name}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {(currentUser?.id === c.user_id || ['admin', 'pastor', 'manager'].includes(userRole)) && (
                                    <button
                                      onClick={() => handleDeleteComment(post.id, c.id)}
                                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition-opacity cursor-pointer"
                                      title="Delete Comment"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">{c.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Comment Input Bar */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={commentInputs[post.id] || ''}
                        onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddComment(post.id);
                        }}
                        placeholder={`Write a comment as ${currentUser?.name || 'Member'}...`}
                        className="flex-1 text-xs px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-[#c59c6c]"
                      />
                      <button
                        onClick={() => handleAddComment(post.id)}
                        disabled={submittingComment[post.id] || !(commentInputs[post.id] || '').trim()}
                        className="p-2 rounded-xl bg-[#c59c6c] hover:bg-[#b08756] text-white disabled:opacity-50 transition-all cursor-pointer shadow-sm"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* 5. Create Post Modal (Pastor, Admin, & Manager ONLY) */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Create Church Post</h3>
                <p className="text-xs text-slate-400">Post an announcement, event, or media to the church feed</p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreatePost} className="p-5 space-y-4 overflow-y-auto flex-1">
              {postError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 text-xs font-semibold">
                  {postError}
                </div>
              )}

              {/* Post Type Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Post Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'announcement', label: '📢 Announcement' },
                    { id: 'event', label: '📅 Church Event' },
                    { id: 'media', label: '📸 Media Highlight' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPostType(t.id)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                        postType === t.id
                          ? 'bg-[#f5ede1] dark:bg-slate-800 text-[#8c6738] dark:text-[#c59c6c] border-[#c59c6c]'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Headline / Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Worship Night & Prophetic Encounter / Youth Camp 2026"
                  className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-[#c59c6c]"
                  required
                />
              </div>

              {/* If Event: Date & Location */}
              {postType === 'event' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase mb-1">
                      Event Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase mb-1">
                      Location / Room
                    </label>
                    <input
                      type="text"
                      value={eventLocation}
                      onChange={(e) => setEventLocation(e.target.value)}
                      placeholder="e.g. Main Sanctuary / Room 201"
                      className="w-full text-xs px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Content Textarea */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Content / Details
                </label>
                <textarea
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write the full announcement, scriptures, details, or reminders..."
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-[#c59c6c]"
                />
              </div>

              {/* Multi-Destination Cross-Posting Selector */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  Publishing Destination
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'home', label: '🏠 Church Home Feed' },
                    { id: 'ministry', label: '🏛️ Ministry Hub' },
                    { id: 'both', label: '🔄 Both Home & Hub' },
                  ].map((dest) => (
                    <button
                      key={dest.id}
                      type="button"
                      onClick={() => setDestination(dest.id)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                        destination === dest.id
                          ? 'bg-[#c59c6c] text-white border-[#c59c6c] shadow-sm'
                          : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      {dest.label}
                    </button>
                  ))}
                </div>

                {/* If Ministry or Both, select specific Ministry */}
                {(destination === 'ministry' || destination === 'both') && (
                  <div className="pt-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Select Target Ministry
                    </label>
                    <select
                      value={selectedMinistryId}
                      onChange={(e) => setSelectedMinistryId(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 focus:outline-none font-semibold"
                    >
                      {ministries.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Photos & Videos Upload (Up to 10 photos, <= 20MB each) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Attachments (<span className="text-[#c59c6c]">Up to 10 items, ≤ 20MB each</span>)
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {mediaAttachments.length}/10 selected
                  </span>
                </div>

                {/* Previews */}
                {mediaAttachments.length > 0 && (
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mb-3">
                    {mediaAttachments.map((item, idx) => (
                      <div key={idx} className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 aspect-square group">
                        {item.type === 'image' ? (
                          <img src={item.url} alt="Upload preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-slate-800 text-white flex flex-col items-center justify-center p-1 text-[10px] text-center font-bold">
                            <Video className="w-4 h-4 mb-1" /> Video
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(idx)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white hover:bg-rose-600 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* File picker button */}
                {mediaAttachments.length < 10 && (
                  <label className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-[#c59c6c] bg-slate-50/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 text-[#c59c6c]" />
                    {uploadingFiles ? 'Uploading attachment...' : 'Upload Photos / Video (Max 20MB)'}
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*,.sbp,.pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={uploadingFiles}
                    />
                  </label>
                )}
              </div>

              {/* Pin to top */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pinPost"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="rounded border-slate-300 text-[#c59c6c] focus:ring-[#c59c6c]"
                />
                <label htmlFor="pinPost" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  📌 Pin announcement to top of feed
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={posting || uploadingFiles}
                  className="px-5 py-2.5 rounded-xl bg-[#c59c6c] hover:bg-[#b08756] text-white text-xs font-bold transition-all shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {posting ? 'Publishing...' : 'Publish to Feed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5.5. YouTube Live Stream Controls Modal */}
      {isGoLiveModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setIsGoLiveModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold">
                  <Radio className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    YouTube Live Stream Controls
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Channel: {liveStatus?.channelHandle || '@jesusmyrockchurchkl'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGoLiveModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Status Box */}
            <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
              liveStatus?.isLive
                ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-900 dark:text-red-200'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${
                  liveStatus?.isLive ? 'bg-red-600 animate-ping' : 'bg-slate-400'
                }`} />
                <div>
                  <div className="text-xs font-bold">
                    {liveStatus?.isLive ? '🔴 Currently Streaming Live' : '⚪ Channel is Offline'}
                  </div>
                  {liveStatus?.isLive && liveStatus.title && (
                    <div className="text-[11px] text-red-700 dark:text-red-300 truncate max-w-xs">
                      {liveStatus.title}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCheckLiveNow}
                disabled={checkingLive}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-bold shadow-sm hover:bg-slate-50 cursor-pointer"
              >
                {checkingLive ? 'Checking...' : 'Check Live Now'}
              </button>
            </div>

            {/* Quick Go Live Form */}
            <form onSubmit={handleManualGoLive} className="space-y-3.5">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span>Quick Go Live (Paste Link or Video ID)</span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  YouTube Live Stream URL or Video ID
                </label>
                <input
                  type="text"
                  value={manualLiveUrl}
                  onChange={(e) => setManualLiveUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or ID"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Broadcast Title (Optional)
                </label>
                <input
                  type="text"
                  value={manualLiveTitle}
                  onChange={(e) => setManualLiveTitle(e.target.value)}
                  placeholder="Sunday Celebration Service & Worship"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800">
                {liveStatus?.isLive ? (
                  <button
                    type="button"
                    onClick={handleEndLiveStream}
                    disabled={checkingLive}
                    className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer"
                  >
                    End Current Stream
                  </button>
                ) : <div />}

                <button
                  type="submit"
                  disabled={checkingLive || !manualLiveUrl.trim()}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <Radio className="w-3.5 h-3.5" />
                  Broadcast Live to Church
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Lightbox for Multi-photo gallery */}
      {lightbox.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setLightbox({ isOpen: false, photos: [], index: 0 })}
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightbox({ isOpen: false, photos: [], index: 0 })}
              className="absolute -top-10 right-0 p-1.5 text-white/80 hover:text-white bg-white/10 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightbox.photos[lightbox.index]?.url}
              alt="Full view"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
            {lightbox.photos.length > 1 && (
              <div className="absolute -bottom-8 left-0 right-0 text-center text-white/80 text-xs font-bold">
                {lightbox.index + 1} of {lightbox.photos.length}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
