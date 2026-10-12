import React, { useState, useEffect } from 'react';
import {
  User,
  Check,
  Sparkles,
  Trophy,
  LogOut,
  Flame,
  Target,
  Award,
  Users,
  UserPlus,
  Trash2,
  Send,
  Radio,
  Circle,
  Loader2,
  X,
  ShieldCheck,
  UserCheck,
  BarChart3,
  KeyRound,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Shield,
} from 'lucide-react';
import { AVATAR_OPTIONS, getAvatarById } from '../utils/avatars.ts';
import { AvatarBadge } from './AvatarBadge.tsx';
import { UserAccount, FriendUser } from '../types/game.ts';
import { Socket } from 'socket.io-client';

interface ProfileModalProps {
  currentUsername: string;
  currentAvatarId: string;
  currentUser: UserAccount | null;
  authToken?: string | null;
  currentRoomCode?: string | null;
  onSave: (username: string, avatarId: string) => void;
  onLogout?: () => void;
  onOpenAuth?: () => void;
  onClose: () => void;
  onOpenCareerStats?: () => void;
  onInviteFriend?: (friendId: string, friendUsername: string) => void;
  onJoinRoomCode?: (code: string) => void;
  onUserUpdated?: (user: UserAccount) => void;
  socket?: Socket | null;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  currentUsername,
  currentAvatarId,
  currentUser,
  authToken,
  currentRoomCode,
  onSave,
  onLogout,
  onOpenAuth,
  onClose,
  onOpenCareerStats,
  onInviteFriend,
  onJoinRoomCode,
  onUserUpdated,
  socket,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'matches' | 'security' | 'friends'>('profile');
  const [name, setName] = useState(currentUsername);
  const [selectedAvatarId, setSelectedAvatarId] = useState(currentAvatarId);

  // Security & Account state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [emailInput, setEmailInput] = useState(currentUser?.email || '');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (currentUser?.email) {
      setEmailInput(currentUser.email);
    }
  }, [currentUser?.email]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken || !currentUser) return;
    setPasswordFeedback(null);

    if (!currentPassword) {
      setPasswordFeedback({ type: 'error', text: 'Please enter your current password.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordFeedback({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordFeedback({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.ok) {
        setPasswordFeedback({ type: 'success', text: 'Password successfully updated!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        if (data.user && onUserUpdated) {
          onUserUpdated(data.user);
        }
      } else {
        setPasswordFeedback({ type: 'error', text: data.error || 'Failed to update password.' });
      }
    } catch {
      setPasswordFeedback({ type: 'error', text: 'Network error updating password.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleEmailUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken || !currentUser) return;
    setEmailFeedback(null);

    const cleanEmail = emailInput.trim();
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setEmailFeedback({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    setEmailLoading(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json();
      if (data.ok && data.user) {
        setEmailFeedback({ type: 'success', text: 'Email address updated!' });
        if (onUserUpdated) {
          onUserUpdated(data.user);
        }
      } else {
        setEmailFeedback({ type: 'error', text: data.error || 'Failed to update email.' });
      }
    } catch {
      setEmailFeedback({ type: 'error', text: 'Network error updating email.' });
    } finally {
      setEmailLoading(false);
    }
  };

  // Friends state
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [loadingFriends, setLoadingFriends] = useState<boolean>(false);
  const [newFriendUsername, setNewFriendUsername] = useState<string>('');
  const [addingFriend, setAddingFriend] = useState<boolean>(false);
  const [friendFeedback, setFriendFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [invitedUserIds, setInvitedUserIds] = useState<Record<string, boolean>>({});

  const selectedAvatar = getAvatarById(selectedAvatarId);

  // Load friends list
  const fetchFriends = async () => {
    if (!authToken) return;
    setLoadingFriends(true);
    try {
      const res = await fetch('/api/friends/list', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.friends)) {
        setFriends(data.friends);
      }
    } catch (err) {
      console.error('Failed to fetch friends:', err);
    } finally {
      setLoadingFriends(false);
    }
  };

  useEffect(() => {
    if (currentUser && authToken) {
      fetchFriends();
    }
  }, [currentUser, authToken]);

  // Realtime presence listener via socket
  useEffect(() => {
    if (!socket) return;

    const handlePresence = (payload: { userId: string; online: boolean }) => {
      setFriends((prev) =>
        prev.map((f) => (f.id === payload.userId ? { ...f, online: payload.online } : f))
      );
    };

    socket.on('friends:presence_update', handlePresence);
    return () => {
      socket.off('friends:presence_update', handlePresence);
    };
  }, [socket]);

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTarget = newFriendUsername.trim();
    if (!cleanTarget) return;

    if (!authToken) {
      setFriendFeedback({
        type: 'error',
        text: 'You must be signed in to add friends.',
      });
      return;
    }

    setAddingFriend(true);
    setFriendFeedback(null);

    try {
      const res = await fetch('/api/friends/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ username: cleanTarget }),
      });
      const data = await res.json();
      if (data.ok && data.friend) {
        setFriends((prev) => {
          if (prev.some((f) => f.id === data.friend.id)) return prev;
          return [...prev, data.friend];
        });
        setNewFriendUsername('');
        setFriendFeedback({
          type: 'success',
          text: `Added ${data.friend.username} to your friends list!`,
        });
      } else {
        setFriendFeedback({
          type: 'error',
          text: data.error || 'Failed to add friend.',
        });
      }
    } catch {
      setFriendFeedback({
        type: 'error',
        text: 'Network error while adding friend.',
      });
    } finally {
      setAddingFriend(false);
    }
  };

  const handleRemoveFriend = async (friendId: string, friendName: string) => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/friends/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ friendId }),
      });
      const data = await res.json();
      if (data.ok) {
        setFriends((prev) => prev.filter((f) => f.id !== friendId));
        setFriendFeedback({
          type: 'success',
          text: `Removed ${friendName} from friends.`,
        });
      }
    } catch (err) {
      console.error('Error removing friend:', err);
    }
  };

  const handleInvite = (friendId: string, friendName: string) => {
    if (!onInviteFriend) return;
    onInviteFriend(friendId, friendName);
    setInvitedUserIds((prev) => ({ ...prev, [friendId]: true }));
    setTimeout(() => {
      setInvitedUserIds((prev) => ({ ...prev, [friendId]: false }));
    }, 4000);
  };

  const handleSubmitProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim().slice(0, 20) || 'Competitor';
    onSave(cleanName, selectedAvatarId);
    onClose();
  };

  const onlineFriendsCount = friends.filter((f) => f.online).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#131B2E] border border-slate-700/90 rounded-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl max-h-[92dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header & Tabs */}
        <div className="border-b border-slate-800 pb-3 sm:pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <User className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <h2 className="font-display text-base sm:text-lg font-semibold text-slate-50 truncate">
                  {currentUser ? currentUser.username : 'Competitor Hub'}
                </h2>
                <p className="text-xs text-slate-400 truncate">
                  {currentUser
                    ? 'Authenticated player profile, career records, & friends.'
                    : 'Manage your local profile or log in for multiplayer friends.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 -mr-1 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center shrink-0"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1.5 p-1 bg-[#0B0F17] rounded-xl border border-slate-800/90 text-xs font-semibold overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex-1 min-h-[40px] py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Profile</span>
            </button>
            {currentUser && (
              <button
                type="button"
                onClick={() => setActiveTab('matches')}
                className={`flex-1 min-h-[40px] py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'matches'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Recent</span>
              </button>
            )}
            {currentUser && (
              <button
                type="button"
                onClick={() => setActiveTab('security')}
                className={`flex-1 min-h-[40px] py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'security'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Security</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('friends')}
              className={`flex-1 min-h-[40px] py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'friends'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Friends</span>
              {friends.length > 0 && (
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    activeTab === 'friends'
                      ? 'bg-slate-950 text-amber-300 font-bold'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {onlineFriendsCount > 0 ? `${onlineFriendsCount} online` : friends.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* TAB 1: PROFILE & INSIGNIA */}
        {activeTab === 'profile' && (
          <div className="space-y-5 animate-in fade-in duration-150">
            {/* Career Stats Grid if Logged in */}
            {currentUser && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span>Career Tournament Record</span>
                  </span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    Member since {new Date(currentUser.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div className="p-3 bg-[#0B0F17] border border-slate-800 rounded-xl text-center">
                    <div className="text-[10px] text-slate-400 font-medium">Matches</div>
                    <div className="font-mono text-base font-bold text-slate-100">
                      {currentUser.stats.gamesPlayed}
                    </div>
                  </div>
                  <div className="p-3 bg-[#0B0F17] border border-slate-800 rounded-xl text-center">
                    <div className="text-[10px] text-emerald-400 font-medium">Wins</div>
                    <div className="font-mono text-base font-bold text-emerald-300">
                      {currentUser.stats.gamesWon}
                    </div>
                  </div>
                  <div className="p-3 bg-[#0B0F17] border border-slate-800 rounded-xl text-center">
                    <div className="text-[10px] text-amber-400 font-medium">Win Rate</div>
                    <div className="font-mono text-base font-bold text-amber-300">
                      {currentUser.stats.gamesPlayed > 0
                        ? `${Math.round(
                            (currentUser.stats.gamesWon / currentUser.stats.gamesPlayed) * 100
                          )}%`
                        : '0%'}
                    </div>
                  </div>
                  <div className="p-3 bg-[#0B0F17] border border-slate-800 rounded-xl text-center">
                    <div className="text-[10px] text-sky-400 font-medium">Top Score</div>
                    <div className="font-mono text-base font-bold text-sky-300">
                      {currentUser.stats.bestScore}
                    </div>
                  </div>
                </div>

                {onOpenCareerStats && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCareerStats();
                    }}
                    className="w-full py-2.5 px-3.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer group"
                  >
                    <span className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                      <span>View Detailed Career Statistics & Timelines</span>
                    </span>
                    <span className="text-[11px] font-mono text-amber-400/90 flex items-center gap-1">
                      <span>Full Stats</span>
                      <span>→</span>
                    </span>
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleSubmitProfile} className="space-y-5">
              {/* Active Preview */}
              <div className="p-3.5 rounded-xl bg-[#0B0F17] border border-slate-800 flex items-center gap-4">
                <AvatarBadge avatarId={selectedAvatarId} size="lg" />
                <div className="min-w-0">
                  <div className="text-xs text-amber-400 font-medium">Active Competitor Card</div>
                  <div className="text-base font-semibold text-slate-100 truncate">
                    {name.trim() || 'Anonymous Solver'}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    {selectedAvatar.name} · {selectedAvatar.title}
                  </div>
                </div>
              </div>

              {/* Username Input */}
              <div>
                <label
                  htmlFor="modal-username"
                  className="block text-xs font-medium text-slate-300 mb-2"
                >
                  Handle / Display Name (Max 20 chars)
                </label>
                <input
                  id="modal-username"
                  type="text"
                  maxLength={20}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Satoshi_9, Grandmaster_X..."
                  className="w-full px-4 py-2.5 bg-[#0B0F17] border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-base sm:text-sm font-medium focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>

              {/* Avatar Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300">
                    Choose Pre-Designed Avatar Insignia
                  </span>
                  <span className="text-slate-500">{AVATAR_OPTIONS.length} options</span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {AVATAR_OPTIONS.map((avatar) => {
                    const isSelected = avatar.id === selectedAvatarId;
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => setSelectedAvatarId(avatar.id)}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/30'
                            : 'bg-[#0B0F17] hover:bg-slate-800/80 border-slate-800'
                        }`}
                      >
                        <AvatarBadge avatarId={avatar.id} size="sm" />
                        <span className="text-[11px] font-medium text-slate-200 truncate max-w-full">
                          {avatar.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                {currentUser && onLogout ? (
                  <button
                    type="button"
                    onClick={() => {
                      onLogout();
                      onClose();
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                ) : onOpenAuth ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAuth();
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Have an account? Sign In</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* TAB: RECENT MATCHES (LAST 10 COMPLETED MATCHES) */}
        {activeTab === 'matches' && currentUser && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Header info */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Recent Matches Record</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Outcome, completion date, and final rank for your last 10 tournament games.
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {(currentUser.stats.recentMatches || []).length} Recorded
              </span>
            </div>

            {/* List of last 10 completed matches */}
            {(() => {
              const matches = (currentUser.stats.recentMatches || []).slice(0, 10);

              if (matches.length === 0) {
                return (
                  <div className="p-8 rounded-2xl bg-[#0B0F17] border border-slate-800 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
                      <Trophy className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-200">No Matches Completed Yet</h4>
                      <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                        Complete your first competitive Sudoku match in a private room or lobby to record official standings and ranks here.
                      </p>
                    </div>
                  </div>
                );
              }

              return (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {matches.map((match, idx) => {
                    const isWin = match.rank === 1;
                    const isPodium = match.rank <= 3;
                    const formattedDate = new Date(match.timestamp).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    // Format duration mm:ss
                    const totalSec = Math.max(0, Math.floor((match.finishTimeMs || 0) / 1000));
                    const mins = Math.floor(totalSec / 60);
                    const secs = totalSec % 60;
                    const formattedTime = `${mins}:${secs.toString().padStart(2, '0')}`;

                    return (
                      <div
                        key={match.id || idx}
                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                          isWin
                            ? 'bg-amber-500/10 border-amber-500/40 hover:border-amber-400/60'
                            : isPodium
                            ? 'bg-[#131B2E] border-slate-750 hover:border-slate-700'
                            : 'bg-[#0B0F17] border-slate-800 hover:border-slate-750'
                        }`}
                      >
                        {/* Left: Final Rank Badge & Outcome */}
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Final Rank Badge */}
                          <div
                            className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center font-mono font-bold shrink-0 border ${
                              isWin
                                ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md shadow-amber-500/30'
                                : match.rank === 2
                                ? 'bg-slate-300 text-slate-950 border-white'
                                : match.rank === 3
                                ? 'bg-amber-700/80 text-amber-100 border-amber-600'
                                : 'bg-[#0B0F17] text-slate-300 border-slate-800'
                            }`}
                          >
                            <span className="text-[9px] uppercase font-semibold leading-none">Rank</span>
                            <span className="text-base font-extrabold leading-none mt-0.5">#{match.rank}</span>
                          </div>

                          {/* Outcome & Details */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-xs font-bold leading-tight ${
                                  isWin
                                    ? 'text-amber-300'
                                    : match.rank === 2
                                    ? 'text-slate-100'
                                    : match.rank === 3
                                    ? 'text-amber-200'
                                    : 'text-slate-300'
                                }`}
                              >
                                {isWin
                                  ? '1st Place Victory'
                                  : match.rank === 2
                                  ? '2nd Place (Silver)'
                                  : match.rank === 3
                                  ? '3rd Place (Bronze)'
                                  : `Completed #${match.rank}`}
                              </span>

                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                {match.score} pts
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 font-mono flex-wrap">
                              <span className="px-1.5 py-0.2 rounded bg-slate-800/80 text-slate-300 text-[10px]">
                                {match.difficulty || 'Medium'}
                              </span>
                              <span>·</span>
                              <span>⏱ {formattedTime}</span>
                              {match.mistakes !== undefined && (
                                <>
                                  <span>·</span>
                                  <span className={match.mistakes > 0 ? 'text-rose-400' : 'text-slate-400'}>
                                    {match.mistakes} error{match.mistakes === 1 ? '' : 's'}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Date */}
                        <div className="text-right shrink-0">
                          <div className="text-xs text-slate-300 font-medium">{formattedDate}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Match #{matches.length - idx}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Footer Close */}
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: SECURITY & CREDENTIALS */}
        {activeTab === 'security' && currentUser && (
          <div className="space-y-5 animate-in fade-in duration-150">
            {/* Email Management Card */}
            <div className="p-4 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-slate-200">Email Address</span>
                </div>
                {currentUser.email ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                    Registered
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">Not provided</span>
                )}
              </div>

              {emailFeedback && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                    emailFeedback.type === 'success'
                      ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-950/60 border border-rose-500/40 text-rose-200'
                  }`}
                >
                  {emailFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  )}
                  <span>{emailFeedback.text}</span>
                </div>
              )}

              <form onSubmit={handleEmailUpdate} className="flex gap-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setEmailFeedback(null);
                  }}
                  placeholder="your-email@example.com"
                  className="flex-1 px-3.5 py-2 bg-[#131B2E] border border-slate-750 rounded-xl text-slate-100 placeholder-slate-500 text-xs font-medium focus:outline-none focus:border-amber-400 transition-colors"
                />
                <button
                  type="submit"
                  disabled={emailLoading}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-xs whitespace-nowrap cursor-pointer transition-colors"
                >
                  {emailLoading ? 'Saving...' : 'Save Email'}
                </button>
              </form>
            </div>

            {/* Change Password Card */}
            <div className="p-4 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-3.5">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-slate-200">Change Account Password</span>
              </div>

              {passwordFeedback && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                    passwordFeedback.type === 'success'
                      ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-950/60 border border-rose-500/40 text-rose-200'
                  }`}
                >
                  {passwordFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  )}
                  <span>{passwordFeedback.text}</span>
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="space-y-3">
                {/* Current Password */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        setPasswordFeedback(null);
                      }}
                      placeholder="Enter existing password"
                      className="w-full pl-3.5 pr-10 py-2 bg-[#131B2E] border border-slate-750 focus:border-amber-400 rounded-xl text-slate-100 placeholder-slate-500 text-xs font-medium focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                      title={showCurrentPass ? 'Hide password' : 'Show password'}
                    >
                      {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    New Password (Min 6 characters)
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setPasswordFeedback(null);
                      }}
                      placeholder="Enter strong new password"
                      className="w-full pl-3.5 pr-10 py-2 bg-[#131B2E] border border-slate-750 focus:border-amber-400 rounded-xl text-slate-100 placeholder-slate-500 text-xs font-medium focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                      title={showNewPass ? 'Hide password' : 'Show password'}
                    >
                      {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-slate-400">
                      Confirm New Password
                    </label>
                    {confirmNewPassword.length > 0 && (
                      <span className="text-[10px] font-mono">
                        {newPassword === confirmNewPassword ? (
                          <span className="text-emerald-400">Passwords match</span>
                        ) : (
                          <span className="text-rose-400">Passwords do not match</span>
                        )}
                      </span>
                    )}
                  </div>
                  <input
                    type="password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => {
                      setConfirmNewPassword(e.target.value);
                      setPasswordFeedback(null);
                    }}
                    placeholder="Re-enter new password"
                    className="w-full px-3.5 py-2 bg-[#131B2E] border border-slate-750 focus:border-amber-400 rounded-xl text-slate-100 placeholder-slate-500 text-xs font-medium focus:outline-none transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{passwordLoading ? 'Updating Password...' : 'Update Password'}</span>
                </button>
              </form>
            </div>

            {/* Cryptographic Standards & Security Audit Info */}
            <div className="p-3.5 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-300 font-semibold text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Security & Cryptography Audit</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-[#131B2E] border border-slate-800/80">
                  <div className="text-slate-500 text-[10px]">Algorithm</div>
                  <div className="font-mono text-slate-200">PBKDF2 SHA-512</div>
                  <div className="text-[9px] text-emerald-400">12,000 Key Rounds</div>
                </div>
                <div className="p-2 rounded-lg bg-[#131B2E] border border-slate-800/80">
                  <div className="text-slate-500 text-[10px]">Protection</div>
                  <div className="font-mono text-slate-200">Brute-Force Guard</div>
                  <div className="text-[9px] text-emerald-400">5-attempt lockout</div>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-800/60 flex items-center justify-between">
                <span>Account ID: {currentUser.id}</span>
                <span>Active Token</span>
              </div>
            </div>

            {/* Close footer */}
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: FRIENDS SYSTEM */}
        {activeTab === 'friends' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* If not logged in, prompt user to create/log in to an account */}
            {!currentUser ? (
              <div className="p-6 rounded-2xl bg-[#0B0F17] border border-slate-800 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold text-slate-100 mb-1">
                    Sign In to Add Friends
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                    Create a competitor account to add friends by username, check their live online
                    status, and send private lobby match invitations!
                  </p>
                </div>
                {onOpenAuth && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAuth();
                    }}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer inline-flex items-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Sign In / Create Account</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Add Friend Input Form */}
                <form onSubmit={handleAddFriend} className="space-y-2">
                  <label
                    htmlFor="add-friend-input"
                    className="block text-xs font-semibold text-slate-300"
                  >
                    Add Friend by Username
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="add-friend-input"
                      type="text"
                      maxLength={20}
                      value={newFriendUsername}
                      onChange={(e) => setNewFriendUsername(e.target.value)}
                      placeholder="e.g. Elena, Kaito_9..."
                      className="flex-1 px-4 py-2.5 bg-[#0B0F17] border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-base sm:text-xs font-medium focus:outline-none focus:border-amber-400 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={addingFriend || !newFriendUsername.trim()}
                      className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      {addingFriend ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="w-3.5 h-3.5" />
                      )}
                      <span>Add</span>
                    </button>
                  </div>

                  {/* Feedback Banner */}
                  {friendFeedback && (
                    <div
                      className={`text-xs p-2.5 rounded-xl flex items-center gap-2 animate-in fade-in duration-150 ${
                        friendFeedback.type === 'success'
                          ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300'
                          : 'bg-rose-950/40 border border-rose-500/40 text-rose-300'
                      }`}
                    >
                      {friendFeedback.type === 'success' ? (
                        <UserCheck className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <X className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span className="flex-1">{friendFeedback.text}</span>
                    </div>
                  )}
                </form>

                {/* Friends List Header */}
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 pt-2 border-t border-slate-800">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>Your Friends ({friends.length})</span>
                  </span>
                  <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    <span>{onlineFriendsCount} Online</span>
                  </span>
                </div>

                {/* Friends Cards */}
                {loadingFriends ? (
                  <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Loading friends circle...</span>
                  </div>
                ) : friends.length === 0 ? (
                  <div className="p-6 rounded-xl bg-[#0B0F17] border border-slate-800/80 text-center space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-800/50 flex items-center justify-center mx-auto text-slate-500">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="text-xs text-slate-300 font-medium">No friends added yet</div>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      Enter another player's handle above to add them, see their live online status,
                      and send one-tap match invitations!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {friends.map((friend) => {
                      const isInvited = Boolean(invitedUserIds[friend.id]);
                      const isInMyRoom = Boolean(currentRoomCode && friend.currentRoomCode === currentRoomCode);

                      return (
                        <div
                          key={friend.id}
                          className="p-3 rounded-xl bg-[#0B0F17] border border-slate-800 hover:border-slate-700/80 flex items-center justify-between gap-3 transition-colors"
                        >
                          {/* Avatar & Info */}
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative shrink-0">
                              <AvatarBadge avatarId={friend.avatarId} size="md" />
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0B0F17] ${
                                  friend.online
                                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                                    : 'bg-slate-600'
                                }`}
                                title={friend.online ? 'Online' : 'Offline'}
                              />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-sm text-slate-100 truncate">
                                  {friend.username}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                {friend.online ? (
                                  friend.currentRoomCode ? (
                                    <span className="text-amber-400 font-medium">
                                      In Room #{friend.currentRoomCode}
                                    </span>
                                  ) : (
                                    <span className="text-emerald-400 font-medium">
                                      Online · In Menu
                                    </span>
                                  )
                                ) : (
                                  <span className="text-slate-500">Offline</span>
                                )}

                                {friend.stats && (
                                  <>
                                    <span>·</span>
                                    <span className="font-mono text-slate-400">
                                      {friend.stats.gamesWon} wins
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* If friend is in a room and not my room, allow joining */}
                            {friend.online && friend.currentRoomCode && !isInMyRoom && onJoinRoomCode && (
                              <button
                                type="button"
                                onClick={() => {
                                  onJoinRoomCode(friend.currentRoomCode!);
                                  onClose();
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition-colors cursor-pointer"
                                title={`Join match in room ${friend.currentRoomCode}`}
                              >
                                Join Room
                              </button>
                            )}

                            {/* Invite to match / lobby */}
                            {friend.online && (
                              <button
                                type="button"
                                disabled={isInvited || isInMyRoom}
                                onClick={() => handleInvite(friend.id, friend.username)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-all cursor-pointer ${
                                  isInMyRoom
                                    ? 'bg-slate-800/60 border-slate-700 text-slate-400 cursor-default'
                                    : isInvited
                                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                                    : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-300'
                                }`}
                                title={
                                  isInMyRoom
                                    ? 'Already in your room'
                                    : currentRoomCode
                                    ? `Invite to Room ${currentRoomCode}`
                                    : 'Create room & invite friend'
                                }
                              >
                                {isInvited ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span>Invited!</span>
                                  </>
                                ) : isInMyRoom ? (
                                  <span>In Room</span>
                                ) : (
                                  <>
                                    <Send className="w-3 h-3" />
                                    <span>Invite</span>
                                  </>
                                )}
                              </button>
                            )}

                            {/* Remove Friend */}
                            <button
                              type="button"
                              onClick={() => handleRemoveFriend(friend.id, friend.username)}
                              className="p-1.5 rounded-lg hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                              title={`Remove ${friend.username} from friends`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Close footer */}
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
