import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Volume2, VolumeX, X, UserCog, LogIn, LogOut, Shield, BarChart3, Trophy, WifiOff, Zap } from 'lucide-react';
import {
  DifficultyLevel,
  RoomPublicState,
  MoveValidationResponse,
  UserAccount,
  LobbyInvite,
} from './types/game.ts';
import { LandingScreen } from './components/LandingScreen.tsx';
import { LobbyScreen } from './components/LobbyScreen.tsx';
import { GameScreen } from './components/GameScreen.tsx';
import { LeaderboardScreen } from './components/LeaderboardScreen.tsx';
import { ProfileModal } from './components/ProfileModal.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { CareerStatsModal } from './components/CareerStatsModal.tsx';
import { BgmController } from './components/BgmController.tsx';
import { AvatarBadge } from './components/AvatarBadge.tsx';
import { PWAInstallButton } from './components/PWAInstallButton.tsx';
import { soundEngine } from './utils/sound.ts';
import { useOnlineStatus } from './hooks/useOnlineStatus.ts';
import { generateSudokuBoard, calculateCompetitiveScore } from './sudokuEngine.ts';

type ActiveView = 'LANDING' | 'LOBBY' | 'GAME' | 'LEADERBOARD';

export function App() {
  const socketRef = useRef<Socket | null>(null);
  const [socketId, setSocketId] = useState<string>('');

  // Authentication State
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('nueve_auth_token') || sessionStorage.getItem('nueve_auth_token') || null;
  });
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Active Player Display Info
  const [playerName, setPlayerName] = useState<string>(() => {
    const saved = localStorage.getItem('nueve_player_name');
    return saved || `Player ${Math.floor(100 + Math.random() * 900)}`;
  });
  const [avatarId, setAvatarId] = useState<string>(() => {
    const saved = localStorage.getItem('nueve_avatar_id');
    return saved || 'avatar-falcon';
  });

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCareerStatsModal, setShowCareerStatsModal] = useState(false);

  const [room, setRoom] = useState<RoomPublicState | null>(null);
  const [view, setView] = useState<ActiveView>('LANDING');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [incomingInvite, setIncomingInvite] = useState<LobbyInvite | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Network and Offline Mode State
  const isOnline = useOnlineStatus();
  const [isOfflineMatch, setIsOfflineMatch] = useState(false);
  const offlineSolutionRef = useRef<number[][] | null>(null);
  const offlineFilledRef = useRef<number>(0);
  const offlineTotalEmptyRef = useRef<number>(0);
  const offlineMistakesRef = useRef<number>(0);
  const offlineStartTimeRef = useRef<number>(0);
  const offlineBotIntervalsRef = useRef<Array<ReturnType<typeof setInterval>>>([]);

  // Restore authenticated user session on mount
  useEffect(() => {
    if (authToken) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.ok && data.user) {
            setCurrentUser(data.user);
            setPlayerName(data.user.username);
            setAvatarId(data.user.avatarId);
            if (socketRef.current) {
              socketRef.current.emit('auth:attach', { token: authToken });
            }
          } else {
            // Invalid token
            localStorage.removeItem('nueve_auth_token');
            sessionStorage.removeItem('nueve_auth_token');
            setAuthToken(null);
            setCurrentUser(null);
          }
        })
        .catch(() => {});
    }
  }, [authToken]);

  useEffect(() => {
    if (playerName.trim()) {
      localStorage.setItem('nueve_player_name', playerName.trim());
    }
  }, [playerName]);

  useEffect(() => {
    if (avatarId) {
      localStorage.setItem('nueve_avatar_id', avatarId);
    }
  }, [avatarId]);

  useEffect(() => {
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketId(socket.id || '');
      const token = localStorage.getItem('nueve_auth_token');
      if (token) {
        socket.emit('auth:attach', { token });
      }
    });

    socket.on('room:updated', (updatedRoom: RoomPublicState) => {
      setRoom(updatedRoom);
      if (updatedRoom.status === 'LOBBY') {
        setView('LOBBY');
      } else if (updatedRoom.status === 'FINISHED') {
        setView('LEADERBOARD');
        // Refresh career stats if logged in
        if (authToken) {
          fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${authToken}` },
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.ok && data.user) setCurrentUser(data.user);
            })
            .catch(() => {});
        }
      }
    });

    socket.on('game:started', (startedRoom: RoomPublicState) => {
      setRoom(startedRoom);
      setView('GAME');
      setErrorMessage(null);
    });

    socket.on(
      'player:finished',
      (data: {
        playerId: string;
        playerName: string;
        rank: number;
        score: number;
      }) => {
        showToast(
          `${data.playerName} finished #${data.rank} (${data.score.toFixed(1)} pts)`
        );
      }
    );

    socket.on('chat:received', (msg) => {
      setRoom((prev) => {
        if (!prev) return prev;
        if (prev.messages.some((m) => m.id === msg.id)) return prev;
        return {
          ...prev,
          messages: [...prev.messages, msg],
        };
      });
    });

    socket.on('room:notification', (data: { message: string }) => {
      showToast(data.message);
    });

    socket.on('lobby:invite_received', (invite: LobbyInvite) => {
      setIncomingInvite(invite);
      soundEngine.playSelect();
      showToast(`🎮 ${invite.fromUsername} invited you to join Match #${invite.roomCode}!`);
    });

    return () => {
      socket.disconnect();
    };
  }, [authToken]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEngine.enabled = next;
  };

  const handleAuthSuccess = (user: UserAccount, token: string, remember: boolean = true) => {
    setCurrentUser(user);
    setAuthToken(token);
    if (remember) {
      localStorage.setItem('nueve_auth_token', token);
      sessionStorage.removeItem('nueve_auth_token');
    } else {
      sessionStorage.setItem('nueve_auth_token', token);
      localStorage.removeItem('nueve_auth_token');
    }
    setPlayerName(user.username);
    setAvatarId(user.avatarId);
    if (socketRef.current) {
      socketRef.current.emit('auth:attach', { token });
    }
    showToast(`Welcome back, ${user.username}!`);
  };

  const handleLogout = async () => {
    const token =
      authToken ||
      localStorage.getItem('nueve_auth_token') ||
      sessionStorage.getItem('nueve_auth_token');
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    localStorage.removeItem('nueve_auth_token');
    sessionStorage.removeItem('nueve_auth_token');
    localStorage.removeItem('nueve_auth_remember');
    setAuthToken(null);
    setCurrentUser(null);
    showToast('Signed out of competitor account.');
  };

  const handleSaveProfile = async (newUsername: string, newAvatarId: string) => {
    setPlayerName(newUsername);
    setAvatarId(newAvatarId);

    if (authToken) {
      try {
        const res = await fetch('/api/auth/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ username: newUsername, avatarId: newAvatarId }),
        });
        const data = await res.json();
        if (data.ok && data.user) {
          setCurrentUser(data.user);
        }
      } catch {}
    }

    // If currently inside a room, sync with server
    if (socketRef.current && room) {
      socketRef.current.emit(
        'player:update_profile',
        { username: newUsername, avatarId: newAvatarId },
        (res: { ok: boolean; error?: string }) => {
          if (!res.ok && res.error) {
            setErrorMessage(res.error);
          }
        }
      );
    }
  };

  const handleCreateRoom = (difficulty: DifficultyLevel) => {
    if (!socketRef.current) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    socketRef.current.emit(
      'room:create',
      {
        playerName: playerName.trim() || 'Player 1',
        avatarId,
        difficulty,
        userId: currentUser?.id,
      },
      (res: { ok: boolean; room?: RoomPublicState; error?: string }) => {
        setIsSubmitting(false);
        if (res.ok && res.room) {
          setRoom(res.room);
          setView('LOBBY');
        } else {
          setErrorMessage(res.error || 'Could not create room.');
        }
      }
    );
  };

  const handleStartOfflineGame = (difficulty: DifficultyLevel) => {
    // Clear any active offline bots
    offlineBotIntervalsRef.current.forEach(clearInterval);
    offlineBotIntervalsRef.current = [];

    const puzzle = generateSudokuBoard(difficulty);
    offlineSolutionRef.current = puzzle.solutionBoard;
    offlineFilledRef.current = 0;
    offlineTotalEmptyRef.current = puzzle.emptyCellsCount;
    offlineMistakesRef.current = 0;
    offlineStartTimeRef.current = Date.now();
    setIsOfflineMatch(true);

    const offlineRoom: RoomPublicState = {
      code: 'OFFLINE',
      hostId: 'offline-player',
      difficulty,
      status: 'PLAYING',
      maxPlayers: 2,
      players: [
        {
          id: 'offline-player',
          userId: currentUser?.id,
          name: playerName.trim() || 'Player 1',
          avatarId,
          isHost: true,
          isReady: true,
          isBot: false,
          connected: true,
          filledCount: 0,
          totalToFill: puzzle.emptyCellsCount,
          mistakes: 0,
          finished: false,
          finishTimeMs: null,
          deltaTSeconds: null,
          rank: null,
          score: null,
          maxPossibleScore: null,
          minPossibleScore: null,
        },
        {
          id: 'offline-bot-1',
          name: 'Kaito (AI)',
          avatarId: 'avatar-falcon',
          isHost: false,
          isReady: true,
          isBot: true,
          connected: true,
          filledCount: 0,
          totalToFill: puzzle.emptyCellsCount,
          mistakes: 0,
          finished: false,
          finishTimeMs: null,
          deltaTSeconds: null,
          rank: null,
          score: null,
          maxPossibleScore: null,
          minPossibleScore: null,
        },
      ],
      startTime: Date.now(),
      firstFinishTimeMs: null,
      initialBoard: puzzle.initialBoard,
      messages: [
        {
          id: 'msg-offline-1',
          senderId: 'system',
          senderName: 'System',
          senderAvatarId: 'avatar-falcon',
          text: 'Offline Solo Match active! Backtracking engine running locally.',
          timestamp: Date.now(),
        },
      ],
    };

    setRoom(offlineRoom);
    setSocketId('offline-player');
    setView('GAME');
    setErrorMessage(null);
    showToast(`⚡ Started Offline Match (${difficulty})`);

    // Simulated Bot progression
    let botFilled = 0;
    const botTimer = setInterval(() => {
      botFilled++;
      const isBotDone = botFilled >= puzzle.emptyCellsCount;
      setRoom((prev) => {
        if (!prev || prev.code !== 'OFFLINE') return prev;
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.id === 'offline-bot-1'
              ? {
                  ...p,
                  filledCount: Math.min(puzzle.emptyCellsCount, botFilled),
                  finished: isBotDone,
                  finishTimeMs: isBotDone ? Date.now() - offlineStartTimeRef.current : null,
                  rank: isBotDone ? 2 : null,
                }
              : p
          ),
        };
      });
      if (isBotDone) {
        clearInterval(botTimer);
      }
    }, 4500);

    offlineBotIntervalsRef.current.push(botTimer);
  };

  const handleJoinRoom = (code: string) => {
    if (!socketRef.current) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    socketRef.current.emit(
      'room:join',
      {
        code,
        playerName: playerName.trim() || 'Challenger',
        avatarId,
        userId: currentUser?.id,
      },
      (res: { ok: boolean; room?: RoomPublicState; error?: string }) => {
        setIsSubmitting(false);
        if (res.ok && res.room) {
          setRoom(res.room);
          setView('LOBBY');
        } else {
          setErrorMessage(res.error || 'Failed to join room.');
        }
      }
    );
  };

  const handleInviteFriend = (targetUserId: string, targetUsername: string) => {
    if (!socketRef.current) return;

    if (room && room.code) {
      socketRef.current.emit(
        'lobby:invite',
        { targetUserId, roomCode: room.code },
        (res: { ok: boolean; error?: string }) => {
          if (res?.ok) {
            showToast(`Match invitation sent to ${targetUsername}!`);
          } else {
            showToast(res?.error || `Could not invite ${targetUsername}.`);
          }
        }
      );
    } else {
      // Create a private room and send the invite
      socketRef.current.emit(
        'room:create',
        {
          playerName: playerName.trim() || 'Player 1',
          avatarId,
          difficulty: 'Medium',
          userId: currentUser?.id,
        },
        (res: { ok: boolean; room?: RoomPublicState; error?: string }) => {
          if (res.ok && res.room) {
            setRoom(res.room);
            setView('LOBBY');
            setShowProfileModal(false);
            socketRef.current?.emit(
              'lobby:invite',
              { targetUserId, roomCode: res.room.code },
              (invRes: { ok: boolean; error?: string }) => {
                if (invRes?.ok) {
                  showToast(`Created lobby ${res.room!.code} & invited ${targetUsername}!`);
                }
              }
            );
          }
        }
      );
    }
  };

  const handleToggleReady = () => {
    if (!socketRef.current) return;
    socketRef.current.emit(
      'player:toggle_ready',
      (res: { ok: boolean; error?: string }) => {
        if (!res.ok && res.error) {
          setErrorMessage(res.error);
        }
      }
    );
  };

  const handleSetDifficulty = (difficulty: DifficultyLevel) => {
    if (!socketRef.current) return;
    socketRef.current.emit(
      'room:set_difficulty',
      { difficulty },
      (res: { ok: boolean; error?: string }) => {
        if (!res.ok && res.error) {
          setErrorMessage(res.error);
        }
      }
    );
  };

  const handleStartGame = () => {
    if (!socketRef.current) return;
    socketRef.current.emit(
      'game:start',
      (res: { ok: boolean; error?: string }) => {
        if (!res.ok && res.error) {
          setErrorMessage(res.error);
        }
      }
    );
  };

  const handleAddBot = () => {
    if (!socketRef.current) return;
    socketRef.current.emit(
      'room:add_bot',
      (res: { ok: boolean; error?: string }) => {
        if (!res.ok && res.error) {
          setErrorMessage(res.error);
        }
      }
    );
  };

  const handleRemoveBot = (botId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit(
      'room:remove_bot',
      { botId },
      (res: { ok: boolean; error?: string }) => {
        if (!res.ok && res.error) {
          setErrorMessage(res.error);
        }
      }
    );
  };

  const handleSendMessage = (text: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit(
      'chat:send',
      { text },
      (res: { ok: boolean; error?: string }) => {
        if (!res.ok && res.error) {
          showToast(res.error);
        }
      }
    );
  };

  const handleDeleteChatMessage = (messageId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit(
      'chat:delete',
      { messageId },
      (res: { ok: boolean; error?: string }) => {
        if (!res.ok && res.error) {
          showToast(res.error);
        }
      }
    );
  };

  const handleSubmitMove = (
    row: number,
    col: number,
    value: number,
    cb: (res: { ok: boolean; validation?: MoveValidationResponse; error?: string }) => void
  ) => {
    if (isOfflineMatch) {
      const solution = offlineSolutionRef.current;
      if (!solution) return;
      const correct = solution[row][col] === value;
      if (correct) {
        offlineFilledRef.current++;
        const isDone = offlineFilledRef.current >= offlineTotalEmptyRef.current;
        const elapsed = Math.max(0, Date.now() - offlineStartTimeRef.current);
        const score = calculateCompetitiveScore(
          elapsed,
          offlineMistakesRef.current,
          room?.difficulty || 'Medium',
          1
        );

        setRoom((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: isDone ? 'FINISHED' : prev.status,
            players: prev.players.map((p) =>
              p.id === 'offline-player'
                ? {
                    ...p,
                    filledCount: offlineFilledRef.current,
                    finished: isDone,
                    finishTimeMs: isDone ? elapsed : undefined,
                    score: isDone ? score : p.score,
                    rank: isDone ? 1 : p.rank,
                  }
                : p
            ),
          };
        });

        cb({
          ok: true,
          validation: {
            correct: true,
            finished: isDone,
            rank: 1,
            score,
          },
        });
      } else {
        offlineMistakesRef.current++;
        setRoom((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.id === 'offline-player' ? { ...p, mistakes: p.mistakes + 1 } : p
            ),
          };
        });
        cb({
          ok: true,
          validation: {
            correct: false,
            finished: false,
          },
        });
      }
      return;
    }

    if (!socketRef.current) return;
    socketRef.current.emit('game:submit_move', { row, col, value }, cb);
  };

  const handleUndoMove = (row: number, col: number) => {
    if (isOfflineMatch) {
      offlineFilledRef.current = Math.max(0, offlineFilledRef.current - 1);
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.id === 'offline-player' ? { ...p, filledCount: offlineFilledRef.current } : p
          ),
        };
      });
      return;
    }

    if (!socketRef.current) return;
    socketRef.current.emit('game:undo_move', { row, col });
  };

  const handleReturnToLobby = () => {
    if (isOfflineMatch) {
      offlineBotIntervalsRef.current.forEach(clearInterval);
      offlineBotIntervalsRef.current = [];
      setIsOfflineMatch(false);
      setRoom(null);
      setView('LANDING');
      return;
    }

    if (!socketRef.current) return;
    socketRef.current.emit(
      'room:return_to_lobby',
      (res: { ok: boolean; error?: string }) => {
        if (!res.ok && res.error) {
          setErrorMessage(res.error);
        }
      }
    );
  };

  const handleLeaveRoom = () => {
    if (isOfflineMatch) {
      offlineBotIntervalsRef.current.forEach(clearInterval);
      offlineBotIntervalsRef.current = [];
      setIsOfflineMatch(false);
      setRoom(null);
      setView('LANDING');
      setErrorMessage(null);
      return;
    }

    if (!socketRef.current) return;
    socketRef.current.emit('room:leave', () => {
      setRoom(null);
      setView('LANDING');
      setErrorMessage(null);
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0F17] text-[#F8FAFC]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between px-3 sm:px-8 py-2.5 sm:py-3.5 border-b border-slate-800/80 bg-[#0B0F17]/90 backdrop-blur-md sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            if (!room) setView('LANDING');
          }}
          className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-50 whitespace-nowrap"
        >
          Nueve
        </a>

        {/* Zone 2: Navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <button
            type="button"
            onClick={() => {
              if (!room) setView('LANDING');
              else if (room.status === 'LOBBY') setView('LOBBY');
            }}
            className={`hover:text-slate-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap cursor-pointer ${
              view === 'LANDING' || view === 'LOBBY' ? 'text-slate-100' : ''
            }`}
          >
            Matchmaking
          </button>
          <button
            type="button"
            disabled={!room || room.status === 'LOBBY'}
            onClick={() => {
              if (room && room.status !== 'LOBBY') setView('GAME');
            }}
            className={`hover:text-slate-100 hover:underline underline-offset-4 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap cursor-pointer ${
              view === 'GAME' ? 'text-slate-100' : ''
            }`}
          >
            Active Board
          </button>
          <button
            type="button"
            onClick={() => setView('LEADERBOARD')}
            className={`hover:text-slate-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap cursor-pointer ${
              view === 'LEADERBOARD' ? 'text-amber-400 font-semibold' : ''
            }`}
          >
            Leaderboards
          </button>
        </nav>

        {/* Zone 3: Primary Actions (Auth / Profile Trigger + Rules + Sound) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Quick Mobile Leaderboard Access */}
          <button
            type="button"
            onClick={() => setView('LEADERBOARD')}
            className={`md:hidden p-2 rounded-xl border transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center ${
              view === 'LEADERBOARD'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                : 'bg-[#131B2E] hover:bg-slate-800 border-slate-800 text-amber-400'
            }`}
            title="Global Leaderboards"
            aria-label="Global Leaderboards"
          >
            <Trophy className="w-4 h-4" />
          </button>

          {currentUser ? (
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-[#131B2E] hover:bg-[#1A253F] border border-slate-800 flex items-center gap-2 transition-colors cursor-pointer min-h-[36px]"
              title="View Account Profile & Record"
            >
              <AvatarBadge avatarId={avatarId} size="sm" showBorder={false} />
              <div className="text-left hidden sm:block">
                <span className="text-xs font-semibold text-slate-200 block max-w-[100px] truncate leading-tight">
                  {playerName}
                </span>
                <span className="text-[10px] text-emerald-400 font-mono block leading-tight">
                  {currentUser.stats.gamesWon}W / {currentUser.stats.gamesPlayed}P
                </span>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#131B2E] hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer min-h-[36px]"
            >
              <LogIn className="w-3.5 h-3.5 text-amber-400" />
              <span>Sign In</span>
            </button>
          )}

          {/* Quick Career Stats Button */}
          {currentUser && (
            <button
              type="button"
              onClick={() => setShowCareerStatsModal(true)}
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#131B2E] hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer text-xs font-semibold min-w-[36px] min-h-[36px] justify-center"
              title="View Detailed Career Statistics (Win rate, Avg Time, History)"
              aria-label="Career Statistics"
            >
              <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Career Stats</span>
            </button>
          )}

          {/* Offline Status Badge */}
          {!isOnline && (
            <span
              className="px-2 py-1 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-mono flex items-center gap-1.5"
              title="No active internet connection. Offline Mode is active."
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Offline</span>
            </span>
          )}

          {/* Android App & PWA Install Button */}
          <PWAInstallButton />

          {/* Lo-Fi Background Music Controller */}
          <BgmController />

          <button
            type="button"
            onClick={toggleSound}
            className="p-2 sm:px-2.5 sm:py-2 text-xs font-medium text-slate-300 bg-[#131B2E] border border-slate-800 rounded-xl hover:text-white transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer min-w-[36px] min-h-[36px]"
            aria-label={soundEnabled ? 'Mute sound effects' : 'Unmute sound effects'}
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>
        </div>
      </header>

      {/* Live Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:bottom-5 z-40 max-w-sm bg-[#131B2E] border border-amber-500/40 text-slate-100 px-4 py-3 rounded-xl shadow-2xl text-xs font-medium flex items-center justify-between gap-3">
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content View Router */}
      <main className="flex-1 flex flex-col justify-center">
        {view === 'LANDING' && (
          <LandingScreen
            playerName={playerName}
            avatarId={avatarId}
            currentUser={currentUser}
            onOpenProfile={() => setShowProfileModal(true)}
            onOpenAuth={() => setShowAuthModal(true)}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onStartOfflineGame={handleStartOfflineGame}
            onOpenLeaderboard={() => setView('LEADERBOARD')}
            isSubmitting={isSubmitting}
            errorMessage={errorMessage}
            clearError={() => setErrorMessage(null)}
            isOnline={isOnline}
          />
        )}

        {view === 'LOBBY' && room && (
          <LobbyScreen
            room={room}
            currentPlayerId={socketId}
            onToggleReady={handleToggleReady}
            onSetDifficulty={handleSetDifficulty}
            onStartGame={handleStartGame}
            onAddBot={handleAddBot}
            onRemoveBot={handleRemoveBot}
            onLeaveRoom={handleLeaveRoom}
            onOpenProfile={() => setShowProfileModal(true)}
            onSendMessage={handleSendMessage}
            onDeleteMessage={handleDeleteChatMessage}
            errorMessage={errorMessage}
            clearError={() => setErrorMessage(null)}
          />
        )}

        {view === 'GAME' && room && (
          <GameScreen
            room={room}
            currentPlayerId={socketId}
            onSubmitMove={handleSubmitMove}
            onOpenLeaderboard={() => setView('LEADERBOARD')}
            onSendMessage={handleSendMessage}
            onDeleteMessage={handleDeleteChatMessage}
            onLeaveRoom={handleLeaveRoom}
            onUndoMove={handleUndoMove}
          />
        )}

        {view === 'LEADERBOARD' && (
          <LeaderboardScreen
            room={room}
            currentPlayerId={socketId}
            onReturnToLobby={handleReturnToLobby}
            onBackToBoard={room?.status === 'PLAYING' ? () => setView('GAME') : undefined}
            onLeaveRoom={handleLeaveRoom}
            onClose={() => setView(room ? (room.status === 'PLAYING' ? 'GAME' : 'LOBBY') : 'LANDING')}
          />
        )}
      </main>

      {/* Profile & Avatar Customization Modal */}
      {showProfileModal && (
        <ProfileModal
          currentUsername={playerName}
          currentAvatarId={avatarId}
          currentUser={currentUser}
          authToken={authToken}
          currentRoomCode={room?.code || null}
          onSave={handleSaveProfile}
          onLogout={handleLogout}
          onOpenAuth={() => setShowAuthModal(true)}
          onClose={() => setShowProfileModal(false)}
          onOpenCareerStats={() => setShowCareerStatsModal(true)}
          onInviteFriend={handleInviteFriend}
          onJoinRoomCode={handleJoinRoom}
          onUserUpdated={(updated) => setCurrentUser(updated)}
          socket={socketRef.current}
        />
      )}

      {/* Detailed Sudoku Career Statistics Modal */}
      {showCareerStatsModal && (
        <CareerStatsModal
          currentUser={currentUser}
          authToken={authToken}
          onClose={() => setShowCareerStatsModal(false)}
          onOpenAuth={() => {
            setShowCareerStatsModal(false);
            setShowAuthModal(true);
          }}
        />
      )}

      {/* Incoming Lobby Invitation Card */}
      {incomingInvite && (
        <div className="fixed top-16 right-4 sm:right-6 z-50 max-w-sm w-full bg-[#131B2E] border-2 border-amber-500/80 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-start gap-3">
            <AvatarBadge avatarId={incomingInvite.fromAvatarId} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                  Match Invitation
                </span>
                <button
                  type="button"
                  onClick={() => setIncomingInvite(null)}
                  className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-sm font-semibold text-slate-100 truncate mt-0.5">
                {incomingInvite.fromUsername}
              </p>
              <p className="text-xs text-slate-300 mt-0.5">
                Invited you to play Sudoku in Room{' '}
                <span className="font-mono font-bold text-amber-300">
                  #{incomingInvite.roomCode}
                </span>{' '}
                ({incomingInvite.difficulty || 'Medium'}).
              </p>

              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => {
                    handleJoinRoom(incomingInvite.roomCode);
                    setIncomingInvite(null);
                  }}
                  className="flex-1 py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer text-center"
                >
                  Accept & Join
                </button>
                <button
                  type="button"
                  onClick={() => setIncomingInvite(null)}
                  className="py-1.5 px-3 rounded-xl bg-[#0B0F17] hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Authentication Modal (Sign In / Register) */}
      {showAuthModal && (
        <AuthModal
          onSuccess={handleAuthSuccess}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}

export default App;
