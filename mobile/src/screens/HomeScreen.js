import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Share,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { api } from '../api/client';
import { ROLES, normalizeRole, hasRole } from '../utils/roles';
import { pickMultipleMediaAttachments, pickMediaAttachment } from '../utils/mediaPicker';
import MediaAttachmentCard from '../components/MediaAttachmentCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen({ user, isDark = false, onSelectService, onNavigateTab }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'live', 'announcement', 'event', 'media'

  // YouTube Live Stream State
  const [liveStatus, setLiveStatus] = useState(null);
  const [checkingLive, setCheckingLive] = useState(false);
  const [isGoLiveModalOpen, setIsGoLiveModalOpen] = useState(false);
  const [manualLiveUrl, setManualLiveUrl] = useState('');
  const [manualLiveTitle, setManualLiveTitle] = useState('');

  // Live Theater In-App Player Modal (Watch Live Stream + Real-Time Chat In-App)
  const [liveTheaterPost, setLiveTheaterPost] = useState(null);
  const [theaterComments, setTheaterComments] = useState([]);
  const [theaterCommentText, setTheaterCommentText] = useState('');
  const [sendingTheaterComment, setSendingTheaterComment] = useState(false);
  const [loadingTheaterComments, setLoadingTheaterComments] = useState(false);
  const [theaterChatTab, setTheaterChatTab] = useState('church'); // 'church' or 'youtube'

  // Upcoming service widget
  const [upcomingService, setUpcomingService] = useState(null);

  // Ministries list for cross-posting
  const [ministries, setMinistries] = useState([]);

  // Create Post Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [postType, setPostType] = useState('announcement');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [destination, setDestination] = useState('home'); // 'home', 'ministry', 'both'
  const [selectedMinistryId, setSelectedMinistryId] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [mediaAttachments, setMediaAttachments] = useState([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [posting, setPosting] = useState(false);

  // Comments Bottom Sheet
  const [activePostForComments, setActivePostForComments] = useState(null);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Full Screen Lightbox
  const [fullScreenImage, setFullScreenImage] = useState(null);

  const userRole = normalizeRole(user?.role);
  const canPost = hasRole(userRole, [ROLES.ADMIN, ROLES.PASTOR, ROLES.MANAGER]);

  const colors = {
    bg: isDark ? '#020617' : '#ffffff',
    card: isDark ? '#0f172a' : '#ffffff',
    border: isDark ? '#1e293b' : '#eadbc4',
    text: isDark ? '#ffffff' : '#0f172a',
    subText: isDark ? '#94a3b8' : '#64748b',
    primary: '#c59c6c',
    primaryLight: isDark ? '#2e2112' : '#f5ede1',
    primaryDark: '#8c6738',
    inputBg: isDark ? '#1e293b' : '#fbf8f3',
    modalBg: isDark ? '#0f172a' : '#ffffff',
    danger: '#e11d48',
  };

  useEffect(() => {
    loadFeed();
    loadUpcomingService();
    loadMinistries();
    loadLiveStatus();

    const liveTimer = setInterval(loadLiveStatus, 25000);
    return () => clearInterval(liveTimer);
  }, []);

  // Auto-poll comments if comments bottom sheet is open for a live post
  useEffect(() => {
    if (!activePostForComments) return;
    const isLive = activePostForComments.post_type === 'live_stream' || activePostForComments.media_type === 'youtube_live';
    if (!isLive) return;

    const interval = setInterval(async () => {
      try {
        const latest = await api.getFeedPostComments(activePostForComments.id);
        if (Array.isArray(latest)) {
          setComments(latest);
        }
      } catch (e) {}
    }, 4000);

    return () => clearInterval(interval);
  }, [activePostForComments]);

  // Auto-poll theater comments while in-app Live Theater is open
  useEffect(() => {
    if (!liveTheaterPost || !liveTheaterPost.id || liveTheaterPost.id === 'live_stream_active') return;

    const interval = setInterval(async () => {
      try {
        const latest = await api.getFeedPostComments(liveTheaterPost.id);
        if (Array.isArray(latest)) {
          setTheaterComments(latest);
        }
      } catch (e) {}
    }, 3500);

    return () => clearInterval(interval);
  }, [liveTheaterPost]);

  const parseYouTubeVideoId = (input) => {
    if (!input || typeof input !== 'string') return null;
    const clean = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;
    const match = clean.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*?v=|live\/|embed\/))([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  };

  const handleOpenLiveTheater = (postOrStatus) => {
    let targetPost = null;
    let targetVideoId = null;

    if (postOrStatus?.id && postOrStatus.id !== 'live_stream_active') {
      targetPost = postOrStatus;
      targetVideoId = postOrStatus.media_name && /^[a-zA-Z0-9_-]{11}$/.test(postOrStatus.media_name)
        ? postOrStatus.media_name
        : parseYouTubeVideoId(postOrStatus.media_url);
    } else {
      const matched = posts.find(
        (p) =>
          (p.post_type === 'live_stream' || p.media_type === 'youtube_live') &&
          (p.media_name === liveStatus?.videoId || parseYouTubeVideoId(p.media_url) === liveStatus?.videoId)
      );
      if (matched) {
        targetPost = matched;
        targetVideoId = liveStatus?.videoId || matched.media_name || parseYouTubeVideoId(matched.media_url);
      } else if (liveStatus?.activePost) {
        targetPost = liveStatus.activePost;
        targetVideoId = liveStatus.videoId || liveStatus.activePost.media_name || parseYouTubeVideoId(liveStatus.activePost.media_url);
      } else {
        targetPost = {
          id: 'live_stream_active',
          title: liveStatus?.title || 'Jesus My Rock Church - Live Service',
          media_name: liveStatus?.videoId,
          media_url: liveStatus?.videoId ? `https://www.youtube.com/watch?v=${liveStatus.videoId}` : null,
          post_type: 'live_stream',
        };
        targetVideoId = liveStatus?.videoId;
      }
    }

    if (!targetVideoId && liveStatus?.videoId) {
      targetVideoId = liveStatus.videoId;
    }

    if (!targetVideoId) {
      Alert.alert('Live Stream', 'No active live stream video ID found.');
      return;
    }

    setLiveTheaterPost({
      ...targetPost,
      videoId: targetVideoId,
    });
    setTheaterChatTab('church');
    setTheaterCommentText('');
    loadTheaterComments(targetPost.id);
  };

  const loadTheaterComments = async (postId) => {
    if (!postId || postId === 'live_stream_active') return;
    setLoadingTheaterComments(true);
    try {
      const data = await api.getFeedPostComments(postId);
      setTheaterComments(data || []);
    } catch (e) {
      console.warn('Failed to load theater comments:', e);
    } finally {
      setLoadingTheaterComments(false);
    }
  };

  const handleAddTheaterComment = async () => {
    if (!theaterCommentText.trim() || !liveTheaterPost) return;
    const textToSend = theaterCommentText.trim();
    setSendingTheaterComment(true);

    try {
      let targetPostId = liveTheaterPost.id;
      if (targetPostId === 'live_stream_active') {
        const matched = posts.find((p) => p.post_type === 'live_stream' || p.media_type === 'youtube_live');
        if (matched) {
          targetPostId = matched.id;
        } else {
          Alert.alert('Notice', 'Comments will be available once the live post appears in the feed.');
          setSendingTheaterComment(false);
          return;
        }
      }

      const newComment = await api.addFeedPostComment(targetPostId, textToSend);
      setTheaterComments((prev) => [...prev, newComment]);
      setTheaterCommentText('');

      setPosts((prev) =>
        prev.map((p) =>
          p.id === targetPostId
            ? { ...p, comments_count: (p.comments_count || 0) + 1 }
            : p
        )
      );
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not post comment');
    } finally {
      setSendingTheaterComment(false);
    }
  };

  const loadLiveStatus = async () => {
    try {
      const data = await api.getChurchLiveStatus();
      setLiveStatus(data || null);
    } catch (e) {
      console.warn('Failed to load mobile live status:', e);
    }
  };

  const handleCheckLiveNow = async () => {
    setCheckingLive(true);
    try {
      const res = await api.checkChurchLiveNow();
      await loadLiveStatus();
      await loadFeed();
      if (res.isLive) {
        Alert.alert('🔴 Live Now!', 'Jesus My Rock Church is currently streaming live on YouTube!');
      } else {
        Alert.alert('Offline', 'YouTube channel is currently offline (no active stream detected).');
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Check failed');
    } finally {
      setCheckingLive(false);
    }
  };

  const handleManualGoLive = async () => {
    if (!manualLiveUrl.trim()) {
      Alert.alert('Required', 'Please enter a YouTube video URL or ID.');
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
      Alert.alert('🔴 Live Broadcast Active!', 'Live post published from "Jesus My Rock" and church phones notified.');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to trigger live');
    } finally {
      setCheckingLive(false);
    }
  };

  const handleEndLiveStream = () => {
    Alert.alert('End Live Stream', 'Are you sure you want to mark the live stream as ended? The post will stay in feed for replay.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Stream',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.endLiveStream();
            await loadLiveStatus();
            await loadFeed();
            Alert.alert('Stream Ended', 'Live stream marked as ended.');
          } catch (err) {
            Alert.alert('Error', err.message || 'Failed to end stream');
          }
        },
      },
    ]);
  };

  const loadFeed = async () => {
    try {
      const data = await api.getFeedPosts({ destination: 'home' });
      setPosts(data || []);
    } catch (err) {
      console.error('Failed to load feed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadFeed();
    loadLiveStatus();
    loadUpcomingService();
  };

  const loadUpcomingService = async () => {
    try {
      const services = await api.getServices();
      if (Array.isArray(services) && services.length > 0) {
        const now = new Date();
        const future = services.find((s) => new Date(s.service_date) >= now) || services[0];
        setUpcomingService(future);
      }
    } catch (e) {
      console.warn('Failed to load service:', e);
    }
  };

  const loadMinistries = async () => {
    try {
      const data = await api.getMinistries();
      setMinistries(data || []);
      if (data && data.length > 0 && !selectedMinistryId) {
        setSelectedMinistryId(data[0].id);
      }
    } catch (e) {
      console.warn('Failed to load ministries:', e);
    }
  };

  // Pick Media (Up to 10 photos, <= 20MB each)
  const handlePickMedia = async () => {
    if (mediaAttachments.length >= 10) {
      Alert.alert('Limit Reached', 'You can upload up to 10 media items per post.');
      return;
    }

    setUploadingMedia(true);
    try {
      const items = await pickMultipleMediaAttachments(10 - mediaAttachments.length);
      if (items && items.length > 0) {
        for (const item of items) {
          if (!item.base64) continue;
          const uploadRes = await api.uploadMedia({
            fileBase64: item.base64,
            fileName: item.fileName,
            fileType: item.fileType,
          });
          setMediaAttachments((prev) => [...prev, uploadRes]);
        }
      }
    } catch (err) {
      Alert.alert('Upload Error', err.message || 'Could not upload selected media.');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleRemoveMedia = (index) => {
    setMediaAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle Post Creation
  const handleCreatePost = async () => {
    if (!title.trim() && !content.trim() && mediaAttachments.length === 0) {
      Alert.alert('Missing Details', 'Please provide a title, message, or photo.');
      return;
    }

    if ((destination === 'ministry' || destination === 'both') && !selectedMinistryId) {
      Alert.alert('Select Ministry', 'Please select a target Ministry Hub for this post.');
      return;
    }

    setPosting(true);
    try {
      const payload = {
        title: title.trim() || 'Church Update',
        content: content.trim(),
        post_type: postType,
        destination,
        ministry_id: (destination === 'ministry' || destination === 'both') ? selectedMinistryId : null,
        event_date: (postType === 'event' && eventDate.trim()) ? eventDate.trim() : null,
        event_location: (postType === 'event' && eventLocation.trim()) ? eventLocation.trim() : null,
        is_pinned: isPinned,
        media_attachments: mediaAttachments,
        media_url: mediaAttachments[0]?.url || null,
        media_type: mediaAttachments[0]?.type || null,
        media_name: mediaAttachments[0]?.name || null,
        media_size: mediaAttachments[0]?.size || null,
      };

      const newPost = await api.createFeedPost(payload);
      setPosts((prev) => [newPost, ...prev]);

      setIsCreateOpen(false);
      setTitle('');
      setContent('');
      setEventDate('');
      setEventLocation('');
      setPostType('announcement');
      setDestination('home');
      setIsPinned(false);
      setMediaAttachments([]);
      Alert.alert('Success', 'Post published to church feed!');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  // Handle Post Deletion
  const handleDeletePost = (postId) => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this church post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteFeedPost(postId);
            setPosts((prev) => prev.filter((p) => p.id !== postId));
          } catch (err) {
            Alert.alert('Error', err.message || 'Failed to delete post');
          }
        },
      },
    ]);
  };

  // Handle Like Toggle
  const handleToggleLike = async (postId) => {
    // Optimistic toggle
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
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, has_liked: res.liked, likes_count: res.likes_count } : p))
      );
    } catch (err) {
      console.warn('Like toggle error:', err);
      loadFeed();
    }
  };

  // Handle Share Post
  const handleSharePost = async (post) => {
    try {
      await Share.share({
        title: post.title,
        message: `${post.title}\n\n${post.content}\n\nShared via ChurchFlow`,
      });
    } catch (e) {}
  };

  // Open Comments Modal
  const handleOpenComments = async (post) => {
    setActivePostForComments(post);
    setLoadingComments(true);
    setComments([]);
    setCommentText('');

    try {
      const data = await api.getFeedPostComments(post.id);
      setComments(data || []);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  // Submit Comment
  const handleAddComment = async () => {
    if (!commentText.trim() || !activePostForComments) return;
    setSubmittingComment(true);

    try {
      const newComment = await api.addFeedPostComment(activePostForComments.id, commentText.trim());
      setComments((prev) => [...prev, newComment]);
      setCommentText('');

      // Update post count
      setPosts((prev) =>
        prev.map((p) =>
          p.id === activePostForComments.id
            ? { ...p, comments_count: (p.comments_count || 0) + 1 }
            : p
        )
      );
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Delete Comment
  const handleDeleteComment = async (commentId) => {
    if (!activePostForComments) return;
    try {
      await api.deleteFeedPostComment(activePostForComments.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setPosts((prev) =>
        prev.map((p) =>
          p.id === activePostForComments.id
            ? { ...p, comments_count: Math.max(0, (p.comments_count || 0) - 1) }
            : p
        )
      );
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to delete comment');
    }
  };

  // Filter posts
  const filteredPosts = posts.filter((p) => {
    if (filter === 'all') return true;
    if (filter === 'announcement') return p.post_type === 'announcement';
    if (filter === 'event') return p.post_type === 'event';
    if (filter === 'media') return p.post_type === 'media' || (p.media_attachments && p.media_attachments.length > 0) || p.media_url;
    return true;
  });

  // Render Post Item
  const renderPostItem = ({ item }) => {
    const isEvent = item.post_type === 'event' || !!item.event_date;
    const isLiveStream = item.post_type === 'live_stream' || item.media_type === 'youtube_live';
    const liveVideoId = item.media_name && /^[a-zA-Z0-9_-]{11}$/.test(item.media_name)
      ? item.media_name
      : parseYouTubeVideoId(item.media_url);

    const hasAttachments = Array.isArray(item.media_attachments) && item.media_attachments.length > 0;
    const attachmentsList = hasAttachments
      ? item.media_attachments
      : item.media_url
      ? [{ url: item.media_url, type: item.media_type, name: item.media_name, size: item.media_size }]
      : [];

    return (
      <View
        style={[
          styles.postCard,
          {
            backgroundColor: colors.card,
            borderColor: isLiveStream ? '#ef4444' : item.is_pinned ? colors.primary : colors.border,
            borderWidth: isLiveStream ? 2 : item.is_pinned ? 1.5 : 1,
            shadowColor: isLiveStream ? '#ef4444' : '#000000',
            shadowOpacity: isLiveStream ? 0.15 : 0.05,
            shadowRadius: isLiveStream ? 8 : 4,
            elevation: isLiveStream ? 4 : 2,
          },
        ]}
      >
        {/* Post Header */}
        <View style={styles.postHeader}>
          <View style={styles.postAuthorGroup}>
            {(isLiveStream || item.author_name === 'Jesus My Rock') ? (
              <View style={[styles.avatarBadge, styles.jmrAvatarBadge]}>
                <Image
                  source={require('../../assets/jmrlogo.png')}
                  style={styles.jmrAvatarImg}
                  resizeMode="contain"
                />
              </View>
            ) : (
              <View style={[styles.avatarBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>
                  {(item.author_name || 'C').slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.authorRow}>
                <Text style={[styles.authorName, { color: colors.text, fontWeight: isLiveStream ? '900' : '800' }]} numberOfLines={1}>
                  {isLiveStream ? 'Jesus My Rock' : item.author_name}
                </Text>
                {isLiveStream ? (
                  <View style={[styles.roleBadge, { backgroundColor: '#dc2626' }]}>
                    <Text style={[styles.roleText, { color: '#ffffff', fontWeight: '900' }]}>
                      LIVE BROADCAST
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.roleBadge, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.roleText, { color: colors.primaryDark }]}>
                      {item.author_role}
                    </Text>
                  </View>
                )}
              </View>

              {/* Destination Pill */}
              {item.destination === 'both' && (
                <View style={styles.destinationPill}>
                  <Text style={styles.destinationPillText}>
                    🏛️ {item.ministry_name || 'Ministry Hub'} • Church-wide
                  </Text>
                </View>
              )}

              <View style={styles.timeRow}>
                <Ionicons name="time-outline" size={12} color={colors.subText} />
                <Text style={[styles.timeText, { color: colors.subText }]}>
                  {new Date(item.created_at).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                {item.is_pinned && (
                  <View style={styles.pinnedBadge}>
                    <Ionicons name="pin" size={12} color={isLiveStream ? '#dc2626' : colors.primary} />
                    <Text style={[styles.pinnedText, { color: isLiveStream ? '#dc2626' : colors.primary }]}>Pinned</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Delete action if author, pastor, admin, or manager */}
          {(user?.id === item.author_id || canPost) && (
            <TouchableOpacity
              onPress={() => handleDeletePost(item.id)}
              style={styles.deleteButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="trash-outline" size={16} color={colors.subText} />
            </TouchableOpacity>
          )}
        </View>

        {/* Post Title & Content */}
        <View style={styles.postBody}>
          <Text style={[styles.postTitle, { color: colors.text }]}>{item.title}</Text>
          {!!item.content && (
            <Text style={[styles.postContent, { color: colors.text }]}>{item.content}</Text>
          )}
        </View>

        {/* Event Box (if post is event) */}
        {isEvent && (
          <View style={[styles.eventBox, { backgroundColor: isDark ? '#064e3b30' : '#ecfdf5', borderColor: '#a7f3d0' }]}>
            <View style={styles.calendarBadge}>
              <Text style={styles.calendarMonth}>
                {item.event_date ? new Date(item.event_date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : 'EVENT'}
              </Text>
              <Text style={styles.calendarDay}>
                {item.event_date ? new Date(item.event_date).getDate() : '📅'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eventDateText}>
                {item.event_date
                  ? new Date(item.event_date).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : 'Upcoming Church Gathering'}
              </Text>
              {!!item.event_location && (
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color="#059669" />
                  <Text style={styles.locationText} numberOfLines={1}>{item.event_location}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Live Stream Quick Action Banner for In-App Watch & Chat */}
        {isLiveStream && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handleOpenLiveTheater(item)}
            style={styles.watchLiveCardBanner}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.livePulseDot} />
              <Text style={styles.watchLiveCardBannerText}>
                🔴 Tap to Watch In-App & Join Church Chat
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#ffffff" />
          </TouchableOpacity>
        )}

        {/* Media Attachments Gallery */}
        {attachmentsList.length > 0 && (
          <View style={styles.mediaContainer}>
            {attachmentsList.length === 1 ? (
              <MediaAttachmentCard
                mediaUrl={attachmentsList[0].url}
                mediaType={attachmentsList[0].type}
                mediaName={attachmentsList[0].name}
                mediaSize={attachmentsList[0].size}
                onOpenLiveTheater={isLiveStream ? () => handleOpenLiveTheater(item) : undefined}
              />
            ) : (
              // Multi-Photo Gallery (up to 10 photos)
              <View>
                <Text style={[styles.galleryTitle, { color: colors.subText }]}>
                  📸 {attachmentsList.length} Photos Attached (Tap to enlarge)
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
                  {attachmentsList.map((photo, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => setFullScreenImage(photo.url)}
                      style={styles.galleryThumbWrapper}
                    >
                      <Image source={{ uri: photo.url }} style={styles.galleryThumb} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* Social Engagement Actions (Likes & Comments) */}
        <View style={[styles.socialRow, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={styles.socialActionBtn}
            onPress={() => handleToggleLike(item.id)}
          >
            <Ionicons
              name={item.has_liked ? 'heart' : 'heart-outline'}
              size={18}
              color={item.has_liked ? '#e11d48' : colors.subText}
            />
            <Text
              style={[
                styles.socialActionCount,
                { color: item.has_liked ? '#e11d48' : colors.text },
              ]}
            >
              {item.likes_count || 0}
            </Text>
            <Text style={[styles.socialActionLabel, { color: colors.subText }]}>Likes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialActionBtn}
            onPress={() => {
              if (isLiveStream) {
                handleOpenLiveTheater(item);
              } else {
                handleOpenComments(item);
              }
            }}
          >
            <Ionicons
              name={isLiveStream ? 'chatbubbles' : 'chatbubble-outline'}
              size={16}
              color={isLiveStream ? '#dc2626' : colors.subText}
            />
            <Text style={[styles.socialActionCount, { color: isLiveStream ? '#dc2626' : colors.text }]}>
              {item.comments_count || 0}
            </Text>
            <Text style={[styles.socialActionLabel, { color: isLiveStream ? '#dc2626' : colors.subText }]}>
              {isLiveStream ? 'Live Chat' : 'Comments'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialActionBtn}
            onPress={() => handleSharePost(item)}
          >
            <Ionicons name="share-social-outline" size={17} color={colors.subText} />
            <Text style={[styles.socialActionLabel, { color: colors.subText }]}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <FlatList
        data={filteredPosts}
        keyExtractor={(item) => item.id}
        renderItem={renderPostItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            {/* 0. Live Now Alert Banner */}
            {liveStatus?.isLive && (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => handleOpenLiveTheater(liveStatus)}
                style={styles.liveHeroBanner}
              >
                <View style={styles.liveHeroTop}>
                  <Image
                    source={require('../../assets/jmrlogo.png')}
                    style={styles.liveHeroLogo}
                    resizeMode="contain"
                  />
                  <View style={styles.livePulseDot} />
                  <Text style={styles.liveHeroTag}>JESUS MY ROCK • LIVE NOW</Text>
                </View>
                <Text style={styles.liveHeroTitle} numberOfLines={2}>
                  {liveStatus.title || 'Sunday Worship Service & Prophetic Word'}
                </Text>
                <Text style={styles.liveHeroSub}>
                  Streaming live on YouTube. Tap to watch in-app with church chat!
                </Text>
                <View style={styles.watchLiveBtnRow}>
                  <TouchableOpacity
                    onPress={() => handleOpenLiveTheater(liveStatus)}
                    style={styles.watchLiveBtn}
                  >
                    <Ionicons name="play" size={13} color="#dc2626" />
                    <Text style={styles.watchLiveBtnText}>Watch Live & Chat</Text>
                  </TouchableOpacity>
                  {canPost && (
                    <TouchableOpacity
                      onPress={handleEndLiveStream}
                      style={styles.endLiveHeroBtn}
                    >
                      <Text style={styles.endLiveHeroBtnText}>End Stream</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            )}

            {/* 1. Hero Upcoming Service Banner */}
            {upcomingService && (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => onSelectService && onSelectService(upcomingService)}
                style={styles.heroBanner}
              >
                <View style={styles.heroAccentBar} />
                <View style={styles.heroContent}>
                  <View style={styles.heroBadge}>
                    <Ionicons name="sparkles" size={12} color="#c59c6c" />
                    <Text style={styles.heroBadgeText}>Next Worship Service</Text>
                  </View>
                  <Text style={styles.heroTitle}>
                    {upcomingService.service_type || 'Sunday Morning Celebration'}
                  </Text>
                  <Text style={styles.heroSub}>
                    {new Date(upcomingService.service_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    • {upcomingService.service_time || '10:00 AM'}
                  </Text>
                  <View style={styles.heroBtn}>
                    <Text style={styles.heroBtnText}>View Lineup & Roster</Text>
                    <Ionicons name="chevron-forward" size={14} color="#ffffff" />
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {/* 2. Admin / Pastor / Manager Composer Bar */}
            {canPost && (
              <View style={[styles.composerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.composerTop}>
                  <View style={[styles.avatarBadgeSmall, { backgroundColor: colors.primary }]}>
                    <Text style={styles.avatarTextSmall}>
                      {(user?.name || 'U').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.composerInputBtn, { backgroundColor: colors.inputBg }]}
                    onPress={() => setIsCreateOpen(true)}
                  >
                    <Text style={[styles.composerPlaceholder, { color: colors.subText }]}>
                      Share an update, event, or photo with church...
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.composerActions}>
                  <TouchableOpacity
                    style={styles.composerActionItem}
                    onPress={() => {
                      setPostType('announcement');
                      setIsCreateOpen(true);
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>📢</Text>
                    <Text style={[styles.composerActionText, { color: colors.text }]}>Announcement</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.composerActionItem}
                    onPress={() => {
                      setPostType('event');
                      setIsCreateOpen(true);
                    }}
                  >
                    <Ionicons name="calendar" size={16} color="#10b981" />
                    <Text style={[styles.composerActionText, { color: colors.text }]}>Event</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.composerActionItem}
                    onPress={() => {
                      setPostType('media');
                      setIsCreateOpen(true);
                    }}
                  >
                    <Ionicons name="images" size={16} color="#0284c7" />
                    <Text style={[styles.composerActionText, { color: colors.text }]}>
                      Photos (≤20MB)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.composerActionItem}
                    onPress={() => setIsGoLiveModalOpen(true)}
                  >
                    <Ionicons name="radio" size={16} color="#dc2626" />
                    <Text style={[styles.composerActionText, { color: '#dc2626', fontWeight: '800' }]}>
                      Live
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 3. Filter Chips */}
            <View style={styles.filterRow}>
              {[
                { id: 'all', label: 'All Updates' },
                ...(liveStatus?.isLive ? [{ id: 'live', label: '🔴 LIVE NOW' }] : []),
                { id: 'announcement', label: '📢 Announcements' },
                { id: 'event', label: '📅 Events' },
                { id: 'media', label: '📸 Photos & Media' },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setFilter(tab.id)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: filter === tab.id ? colors.primary : colors.card,
                      borderColor: filter === tab.id ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: filter === tab.id ? '#ffffff' : colors.text },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>⛪</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No feed posts yet</Text>
              <Text style={[styles.emptySub, { color: colors.subText }]}>
                {canPost
                  ? 'Pastors and Managers can tap the composer to publish church news and events.'
                  : 'Check back soon for church announcements and ministry updates.'}
              </Text>
            </View>
          )
        }
      />

      {/* 4. Create Post Modal (Pastor, Admin, & Manager) */}
      <Modal visible={isCreateOpen} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.modalBg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Create Church Post</Text>
                <Text style={[styles.modalSubtitle, { color: colors.subText }]}>
                  Post to church feed and ministry hubs
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsCreateOpen(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.subText} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {/* Post Type Selector */}
              <Text style={[styles.fieldLabel, { color: colors.subText }]}>POST TYPE</Text>
              <View style={styles.typeSelectorRow}>
                {[
                  { id: 'announcement', label: '📢 Announcement' },
                  { id: 'event', label: '📅 Church Event' },
                  { id: 'media', label: '📸 Media' },
                ].map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => setPostType(t.id)}
                    style={[
                      styles.typeBtn,
                      {
                        backgroundColor: postType === t.id ? colors.primaryLight : colors.inputBg,
                        borderColor: postType === t.id ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBtnText,
                        { color: postType === t.id ? colors.primaryDark : colors.text },
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Title Input */}
              <Text style={[styles.fieldLabel, { color: colors.subText }]}>HEADLINE / TITLE</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                placeholder="e.g. Worship Night & Encounter / Youth Camp 2026"
                placeholderTextColor={colors.subText}
                value={title}
                onChangeText={setTitle}
              />

              {/* If Event: Date & Location */}
              {postType === 'event' && (
                <View style={[styles.eventInputGroup, { borderColor: '#a7f3d0' }]}>
                  <Text style={[styles.fieldLabel, { color: '#065f46' }]}>EVENT DATE / TIME</Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#d1fae5' }]}
                    placeholder="e.g. Sunday Nov 15, 7:00 PM"
                    placeholderTextColor="#9ca3af"
                    value={eventDate}
                    onChangeText={setEventDate}
                  />

                  <Text style={[styles.fieldLabel, { color: '#065f46', marginTop: 8 }]}>LOCATION / ROOM</Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#d1fae5' }]}
                    placeholder="e.g. Main Sanctuary / Level 2"
                    placeholderTextColor="#9ca3af"
                    value={eventLocation}
                    onChangeText={setEventLocation}
                  />
                </View>
              )}

              {/* Content Textarea */}
              <Text style={[styles.fieldLabel, { color: colors.subText }]}>MESSAGE DETAILS</Text>
              <TextInput
                style={[styles.modalTextArea, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                placeholder="Write the full message, details, or scriptures..."
                placeholderTextColor={colors.subText}
                value={content}
                onChangeText={setContent}
                multiline
                numberOfLines={4}
              />

              {/* Multi-Destination Selector */}
              <View style={[styles.destinationCard, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>PUBLISHING DESTINATION</Text>
                <View style={styles.destBtnRow}>
                  {[
                    { id: 'home', label: '🏠 Home' },
                    { id: 'ministry', label: '🏛️ Hub' },
                    { id: 'both', label: '🔄 Both' },
                  ].map((dest) => (
                    <TouchableOpacity
                      key={dest.id}
                      onPress={() => setDestination(dest.id)}
                      style={[
                        styles.destBtn,
                        {
                          backgroundColor: destination === dest.id ? colors.primary : colors.card,
                          borderColor: destination === dest.id ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.destBtnText,
                          { color: destination === dest.id ? '#ffffff' : colors.text },
                        ]}
                      >
                        {dest.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {(destination === 'ministry' || destination === 'both') && ministries.length > 0 && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={[styles.fieldLabel, { color: colors.subText }]}>TARGET MINISTRY TEAM</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                      {ministries.map((m) => (
                        <TouchableOpacity
                          key={m.id}
                          onPress={() => setSelectedMinistryId(m.id)}
                          style={[
                            styles.ministryChip,
                            {
                              backgroundColor: selectedMinistryId === m.id ? colors.primaryDark : colors.card,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.ministryChipText,
                              { color: selectedMinistryId === m.id ? '#ffffff' : colors.text },
                            ]}
                          >
                            {m.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Media Attachments (Up to 10 photos/media, <= 20MB each) */}
              <View style={{ marginTop: 12 }}>
                <View style={styles.attachHeader}>
                  <Text style={[styles.fieldLabel, { color: colors.subText }]}>
                    ATTACHMENTS (MAX 10, ≤ 20MB EACH)
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.subText }}>
                    {mediaAttachments.length}/10 selected
                  </Text>
                </View>

                {mediaAttachments.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbScroll}>
                    {mediaAttachments.map((item, idx) => (
                      <View key={idx} style={styles.thumbContainer}>
                        {item.type === 'image' ? (
                          <Image source={{ uri: item.url }} style={styles.thumbImg} />
                        ) : (
                          <View style={styles.videoThumbBox}>
                            <Ionicons name="videocam" size={20} color="#ffffff" />
                            <Text style={styles.videoThumbText}>Video</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          onPress={() => handleRemoveMedia(idx)}
                          style={styles.removeMediaBtn}
                        >
                          <Ionicons name="close" size={14} color="#ffffff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}

                {mediaAttachments.length < 10 && (
                  <TouchableOpacity
                    onPress={handlePickMedia}
                    disabled={uploadingMedia}
                    style={[styles.attachButton, { borderColor: colors.primary }]}
                  >
                    <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
                    <Text style={[styles.attachButtonText, { color: colors.primary }]}>
                      {uploadingMedia ? 'Uploading...' : 'Attach Photos / Videos (≤20MB)'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Pin to Top Toggle */}
              <TouchableOpacity
                onPress={() => setIsPinned(!isPinned)}
                style={styles.pinToggleRow}
              >
                <Ionicons
                  name={isPinned ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={colors.primary}
                />
                <Text style={[styles.pinToggleText, { color: colors.text }]}>
                  Pin announcement to top of feed
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Modal Footer */}
            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => setIsCreateOpen(false)}
                style={[styles.cancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCreatePost}
                disabled={posting || uploadingMedia}
                style={[styles.publishBtn, { backgroundColor: colors.primary }]}
              >
                {posting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.publishBtnText}>Publish Post</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 5. Comments Modal / Bottom Sheet */}
      <Modal visible={!!activePostForComments} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.commentsCard, { backgroundColor: colors.modalBg }]}>
            <View style={[styles.commentsHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.commentsTitle, { color: colors.text }]} numberOfLines={1}>
                  Comments: {activePostForComments?.title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <Text style={[styles.commentsSub, { color: colors.subText }]}>
                    {comments.length} comment{comments.length === 1 ? '' : 's'}
                  </Text>
                  {(activePostForComments?.post_type === 'live_stream' || activePostForComments?.media_type === 'youtube_live') && (
                    <View style={styles.liveChatTag}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveChatTagText}>LIVE STREAM CHAT (REAL-TIME)</Text>
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setActivePostForComments(null)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color={colors.subText} />
              </TouchableOpacity>
            </View>

            {/* Comments List */}
            {loadingComments ? (
              <View style={styles.loadingComments}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : comments.length === 0 ? (
              <View style={styles.emptyCommentsBox}>
                <Text style={[styles.emptyCommentsText, { color: colors.subText }]}>
                  No comments yet. Be the first to join the conversation!
                </Text>
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.commentsListContent}
                renderItem={({ item }) => (
                  <View style={styles.commentItem}>
                    <View style={[styles.commentAvatar, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.commentAvatarText, { color: colors.primaryDark }]}>
                        {(item.user_name || 'U').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={[styles.commentBubble, { backgroundColor: colors.inputBg }]}>
                      <View style={styles.commentBubbleHeader}>
                        <Text style={[styles.commentAuthor, { color: colors.text }]}>
                          {item.user_name}
                        </Text>
                        {(user?.id === item.user_id || canPost) && (
                          <TouchableOpacity
                            onPress={() => handleDeleteComment(item.id)}
                            style={{ padding: 2 }}
                          >
                            <Ionicons name="trash-outline" size={13} color={colors.subText} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={[styles.commentContent, { color: colors.text }]}>
                        {item.content}
                      </Text>
                      <Text style={[styles.commentTime, { color: colors.subText }]}>
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                )}
              />
            )}

            {/* Comment Input Bar */}
            <View style={[styles.commentInputRow, { borderTopColor: colors.border }]}>
              <TextInput
                style={[styles.commentTextInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                placeholder={`Write a comment as ${user?.name || 'Member'}...`}
                placeholderTextColor={colors.subText}
                value={commentText}
                onChangeText={setCommentText}
              />
              <TouchableOpacity
                onPress={handleAddComment}
                disabled={submittingComment || !commentText.trim()}
                style={[styles.sendCommentBtn, { backgroundColor: colors.primary }]}
              >
                {submittingComment ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Ionicons name="send" size={16} color="#ffffff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 5.5. Live Stream Controls Modal */}
      <Modal visible={isGoLiveModalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.modalBg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#dc2626', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="radio" size={16} color="#ffffff" />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>YouTube Live Controls</Text>
                  <Text style={{ fontSize: 10, color: colors.subText }}>Channel: {liveStatus?.channelHandle || '@jesusmyrockchurchkl'}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsGoLiveModalOpen(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.subText} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Status Box */}
              <View style={[styles.liveStatusBox, { backgroundColor: liveStatus?.isLive ? 'rgba(220, 38, 38, 0.1)' : colors.inputBg, borderColor: liveStatus?.isLive ? '#ef4444' : colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: liveStatus?.isLive ? '#dc2626' : '#94a3b8' }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: liveStatus?.isLive ? '#dc2626' : colors.text }}>
                      {liveStatus?.isLive ? '🔴 Currently Live on YouTube' : '⚪ Channel is Offline'}
                    </Text>
                    {liveStatus?.isLive && liveStatus.title ? (
                      <Text style={{ fontSize: 11, color: colors.subText, marginTop: 2 }} numberOfLines={1}>{liveStatus.title}</Text>
                    ) : null}
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleCheckLiveNow}
                  disabled={checkingLive}
                  style={[styles.checkLiveBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Text style={[styles.checkLiveBtnText, { color: colors.text }]}>
                    {checkingLive ? 'Checking...' : 'Check Now'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, { color: colors.subText, marginTop: 16 }]}>
                QUICK GO LIVE (PASTE YOUTUBE LINK OR ID)
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                placeholder="https://www.youtube.com/watch?v=... or 11-char ID"
                placeholderTextColor={colors.subText}
                value={manualLiveUrl}
                onChangeText={setManualLiveUrl}
                autoCapitalize="none"
              />

              <Text style={[styles.fieldLabel, { color: colors.subText, marginTop: 12 }]}>
                BROADCAST TITLE (OPTIONAL)
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                placeholder="Sunday Celebration Service & Worship"
                placeholderTextColor={colors.subText}
                value={manualLiveTitle}
                onChangeText={setManualLiveTitle}
              />
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              {liveStatus?.isLive ? (
                <TouchableOpacity
                  onPress={handleEndLiveStream}
                  disabled={checkingLive}
                  style={[styles.cancelBtn, { borderColor: '#ef4444' }]}
                >
                  <Text style={[styles.cancelBtnText, { color: '#ef4444' }]}>End Stream</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setIsGoLiveModalOpen(false)}
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.text }]}>Close</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={handleManualGoLive}
                disabled={checkingLive || !manualLiveUrl.trim()}
                style={[styles.publishBtn, { backgroundColor: '#dc2626' }]}
              >
                {checkingLive ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.publishBtnText}>🔴 Broadcast Live</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 5.6. In-App Live Service Theater Modal (Watch + Live Chat) */}
      <Modal
        visible={!!liveTheaterPost}
        animationType="slide"
        onRequestClose={() => setLiveTheaterPost(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.theaterContainer}
        >
          {/* Top Bar Header */}
          <View style={styles.theaterHeader}>
            <TouchableOpacity
              onPress={() => setLiveTheaterPost(null)}
              style={styles.theaterCloseBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>

            <View style={styles.theaterTitleGroup}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Image
                  source={require('../../assets/jmrlogo.png')}
                  style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#000000' }}
                  resizeMode="contain"
                />
                <View style={styles.theaterLiveBadge}>
                  <View style={styles.livePulseDot} />
                  <Text style={styles.theaterLiveBadgeText}>LIVE SERVICE</Text>
                </View>
              </View>
              <Text style={styles.theaterTitleText} numberOfLines={1}>
                {liveTheaterPost?.title || 'Jesus My Rock Live Service'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                if (liveTheaterPost?.videoId) {
                  Linking.openURL(`https://www.youtube.com/watch?v=${liveTheaterPost.videoId}`).catch(() => {});
                }
              }}
              style={styles.theaterYtBtn}
            >
              <Ionicons name="logo-youtube" size={16} color="#ef4444" />
              <Ionicons name="open-outline" size={12} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* 16:9 Video Player embedded via react-native-webview */}
          {liveTheaterPost?.videoId && (
            <View style={styles.theaterPlayerBox}>
              <WebView
                source={{
                  html: `
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                        <style>
                          * { margin: 0; padding: 0; box-sizing: border-box; }
                          body { background: #000; overflow: hidden; }
                          .container { position: relative; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
                          iframe { width: 100%; height: 100%; border: 0; }
                        </style>
                      </head>
                      <body>
                        <div class="container">
                          <iframe
                            src="https://www.youtube.com/embed/${liveTheaterPost.videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowfullscreen>
                          </iframe>
                        </div>
                      </body>
                    </html>
                  `,
                }}
                style={styles.theaterWebView}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                allowsFullscreenVideo={true}
              />
            </View>
          )}

          {/* Chat Section Header & Tabs */}
          <View style={styles.theaterChatTabsRow}>
            <TouchableOpacity
              onPress={() => setTheaterChatTab('church')}
              style={[
                styles.theaterChatTabBtn,
                theaterChatTab === 'church' && styles.theaterChatTabBtnActive,
              ]}
            >
              <Ionicons
                name="chatbubbles"
                size={14}
                color={theaterChatTab === 'church' ? '#ffffff' : '#94a3b8'}
              />
              <Text
                style={[
                  styles.theaterChatTabText,
                  theaterChatTab === 'church' && styles.theaterChatTabTextActive,
                ]}
              >
                ⛪ Church Live Chat ({theaterComments.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setTheaterChatTab('youtube')}
              style={[
                styles.theaterChatTabBtn,
                theaterChatTab === 'youtube' && styles.theaterChatTabBtnActive,
              ]}
            >
              <Ionicons
                name="logo-youtube"
                size={14}
                color={theaterChatTab === 'youtube' ? '#ef4444' : '#94a3b8'}
              />
              <Text
                style={[
                  styles.theaterChatTabText,
                  theaterChatTab === 'youtube' && styles.theaterChatTabTextActive,
                ]}
              >
                YouTube Chat
              </Text>
            </TouchableOpacity>
          </View>

          {/* Chat Body */}
          {theaterChatTab === 'church' ? (
            <View style={{ flex: 1, backgroundColor: '#090d16' }}>
              {loadingTheaterComments && theaterComments.length === 0 ? (
                <View style={styles.theaterLoadingBox}>
                  <ActivityIndicator size="small" color="#c59c6c" />
                  <Text style={styles.theaterLoadingText}>Connecting to church live chat...</Text>
                </View>
              ) : theaterComments.length === 0 ? (
                <View style={styles.theaterEmptyBox}>
                  <Text style={{ fontSize: 28, marginBottom: 6 }}>🙏</Text>
                  <Text style={styles.theaterEmptyTitle}>Welcome to the Live Stream!</Text>
                  <Text style={styles.theaterEmptySub}>
                    Be the first to share an Amen, praise report, or say hello to church family.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={theaterComments}
                  keyExtractor={(c) => c.id}
                  contentContainerStyle={styles.theaterCommentsList}
                  renderItem={({ item }) => (
                    <View style={styles.theaterCommentItem}>
                      <View style={styles.theaterAvatarBadge}>
                        <Text style={styles.theaterAvatarText}>
                          {(item.user_name || 'U').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.theaterBubble}>
                        <View style={styles.theaterBubbleHeader}>
                          <Text style={styles.theaterAuthorName}>{item.user_name}</Text>
                          <Text style={styles.theaterTimeText}>
                            {new Date(item.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                        <Text style={styles.theaterCommentContent}>{item.content}</Text>
                      </View>
                    </View>
                  )}
                />
              )}

              {/* Sticky Input Bar */}
              <View style={styles.theaterInputBar}>
                <TextInput
                  style={styles.theaterTextInput}
                  placeholder={`Share an Amen or chat as ${user?.name || 'Member'}...`}
                  placeholderTextColor="#64748b"
                  value={theaterCommentText}
                  onChangeText={setTheaterCommentText}
                />
                <TouchableOpacity
                  onPress={handleAddTheaterComment}
                  disabled={sendingTheaterComment || !theaterCommentText.trim()}
                  style={[
                    styles.theaterSendBtn,
                    { opacity: sendingTheaterComment || !theaterCommentText.trim() ? 0.5 : 1 },
                  ]}
                >
                  {sendingTheaterComment ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Ionicons name="send" size={16} color="#ffffff" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // YouTube Live Chat Tab
            <View style={{ flex: 1, backgroundColor: '#000000' }}>
              <WebView
                source={{
                  uri: `https://www.youtube.com/live_chat?v=${liveTheaterPost.videoId}&embed_domain=serve.creativeclicks.art`,
                }}
                style={{ flex: 1, backgroundColor: '#000000' }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                renderLoading={() => (
                  <View style={styles.theaterLoadingBox}>
                    <ActivityIndicator size="small" color="#ef4444" />
                    <Text style={styles.theaterLoadingText}>Loading YouTube Live Chat...</Text>
                  </View>
                )}
              />
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* 6. Full-Screen Photo Lightbox */}
      <Modal visible={!!fullScreenImage} transparent animationType="fade">
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity
            style={styles.lightboxCloseBtn}
            onPress={() => setFullScreenImage(null)}
          >
            <Ionicons name="close" size={28} color="#ffffff" />
          </TouchableOpacity>
          {fullScreenImage && (
            <Image
              source={{ uri: fullScreenImage }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 40,
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  // Hero Banner
  heroBanner: {
    borderRadius: 16,
    backgroundColor: '#0f172a',
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  heroAccentBar: {
    height: 4,
    backgroundColor: '#c59c6c',
  },
  heroContent: {
    padding: 16,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(197, 156, 108, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  heroBadgeText: {
    color: '#f5ede1',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  heroSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 3,
  },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#c59c6c',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  heroBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  // Composer Card
  composerCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  composerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarBadgeSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTextSmall: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  composerInputBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  composerPlaceholder: {
    fontSize: 12,
  },
  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 10,
    paddingTop: 8,
  },
  composerActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  composerActionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Filter Row
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  // Post Card
  postCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  postAuthorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jmrAvatarBadge: {
    backgroundColor: '#000000',
    borderWidth: 1.5,
    borderColor: '#ef4444',
    overflow: 'hidden',
    shadowColor: '#ef4444',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  jmrAvatarImg: {
    width: 38,
    height: 38,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '800',
  },
  roleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  destinationPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  destinationPillText: {
    color: '#92400e',
    fontSize: 10,
    fontWeight: '800',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  timeText: {
    fontSize: 11,
  },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 6,
  },
  pinnedText: {
    fontSize: 11,
    fontWeight: '800',
  },
  deleteButton: {
    padding: 4,
  },
  // Post Body
  postBody: {
    marginBottom: 8,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    marginBottom: 4,
  },
  postContent: {
    fontSize: 13,
    lineHeight: 19,
  },
  // Event Box
  eventBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  calendarBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarMonth: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  calendarDay: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  eventDateText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '800',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  locationText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '600',
  },
  // Media Gallery
  mediaContainer: {
    marginBottom: 8,
  },
  galleryTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  photoScroll: {
    flexDirection: 'row',
  },
  galleryThumbWrapper: {
    marginRight: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  galleryThumb: {
    width: 140,
    height: 140,
    borderRadius: 12,
  },
  // Social Engagement Row
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 6,
  },
  socialActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  socialActionCount: {
    fontSize: 13,
    fontWeight: '800',
  },
  socialActionLabel: {
    fontSize: 11,
  },
  // Modal Common
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  modalScroll: {
    padding: 16,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  typeBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  modalInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    marginBottom: 12,
  },
  modalTextArea: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  eventInputGroup: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#ecfdf5',
    marginBottom: 12,
  },
  destinationCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  destBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  destBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  destBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  ministryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
  },
  ministryChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  attachHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  thumbScroll: {
    marginVertical: 8,
  },
  thumbContainer: {
    position: 'relative',
    marginRight: 8,
  },
  thumbImg: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  videoThumbBox: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoThumbText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  removeMediaBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    padding: 2,
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  attachButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  pinToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  pinToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
  },
  cancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  publishBtn: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  publishBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  // Comments Sheet
  commentsCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '75%',
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  commentsTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  commentsSub: {
    fontSize: 11,
    marginTop: 1,
  },
  loadingComments: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCommentsBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyCommentsText: {
    fontSize: 12,
    textAlign: 'center',
  },
  commentsListContent: {
    padding: 16,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentAvatarText: {
    fontSize: 11,
    fontWeight: '800',
  },
  commentBubble: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
  },
  commentBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '800',
  },
  commentContent: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  commentTime: {
    fontSize: 9,
    marginTop: 4,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
  },
  commentTextInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
  },
  sendCommentBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Lightbox
  lightboxOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  lightboxImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.2,
  },
  // Loading & Empty
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyCard: {
    margin: 20,
    padding: 30,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  // YouTube Live Stream Styles
  liveHeroBanner: {
    borderRadius: 16,
    backgroundColor: '#b91c1c',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#ef4444',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: '#fca5a5',
  },
  liveHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  liveHeroLogo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#000000',
    marginRight: 2,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  liveHeroTag: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  liveHeroTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
  },
  liveHeroSub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    marginTop: 4,
    marginBottom: 12,
  },
  watchLiveBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  watchLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  watchLiveBtnText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '900',
  },
  endLiveHeroBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  endLiveHeroBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  liveStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  checkLiveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  checkLiveBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  liveChatTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#dc2626',
  },
  liveChatTagText: {
    color: '#dc2626',
    fontSize: 10,
    fontWeight: '900',
  },
  // In-Card Live Stream Action Banner
  watchLiveCardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#dc2626',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#ef4444',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  watchLiveCardBannerText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  // In-App Live Service Theater Modal Styles
  theaterContainer: {
    flex: 1,
    backgroundColor: '#05070d',
  },
  theaterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 12,
    paddingHorizontal: 14,
    backgroundColor: '#0a0e1a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  theaterCloseBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  theaterTitleGroup: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 10,
  },
  theaterLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 3,
  },
  theaterLiveBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  theaterTitleText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
  },
  theaterYtBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  theaterPlayerBox: {
    width: '100%',
    height: SCREEN_WIDTH * (9 / 16),
    backgroundColor: '#000000',
  },
  theaterWebView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  theaterChatTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  theaterChatTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  theaterChatTabBtnActive: {
    borderBottomColor: '#c59c6c',
    backgroundColor: 'rgba(197, 156, 108, 0.1)',
  },
  theaterChatTabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  theaterChatTabTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  theaterLoadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 20,
  },
  theaterLoadingText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  theaterEmptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  theaterEmptyTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
  },
  theaterEmptySub: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  theaterCommentsList: {
    padding: 14,
    paddingBottom: 20,
  },
  theaterCommentItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  theaterAvatarBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#c59c6c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  theaterAvatarText: {
    color: '#c59c6c',
    fontSize: 11,
    fontWeight: '900',
  },
  theaterBubble: {
    flex: 1,
    backgroundColor: '#131b2e',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  theaterBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  theaterAuthorName: {
    color: '#f1f5f9',
    fontSize: 12,
    fontWeight: '800',
  },
  theaterTimeText: {
    color: '#64748b',
    fontSize: 10,
  },
  theaterCommentContent: {
    color: '#e2e8f0',
    fontSize: 12,
    lineHeight: 17,
  },
  theaterInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: '#0a0e1a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  theaterTextInput: {
    flex: 1,
    backgroundColor: '#131b2e',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#f8fafc',
    fontSize: 12,
  },
  theaterSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
