import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  BookOpen,
  Clock,
  Flame,
  LogOut,
  Moon,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AVATAR_OPTIONS,
  ChatMessage,
  COLOR_OPTIONS,
  NightActionPayload,
  PhaseTimers,
  ROLE_CATALOG,
  RoleType,
  SanitizedRoomState,
} from './types/game';
import {
  clearSessionFromStorage,
  loadSessionFromStorage,
  saveSessionToStorage,
} from './services/sessionStorage';
import { SoundCueType, soundEngine } from './services/soundEngine';
import { CampfireArena } from './components/CampfireArena';
import { LobbyConfigPanel } from './components/LobbyConfigPanel';
import { ChatPanel } from './components/ChatPanel';
import { RoleReferenceDrawer } from './components/RoleReferenceDrawer';
import { RoleRevealModal } from './components/RoleRevealModal';
import { PhaseActionToolbar } from './components/PhaseActionToolbar';

export const App: React.FC = () => {
  const socketRef = useRef<Socket | null>(null);

  // Landing Form State
  const storedSession = loadSessionFromStorage();
  const urlParams = new URLSearchParams(window.location.search);
  const inviteCodeFromUrl = (urlParams.get('room') ?? '').toUpperCase().slice(0, 5);

  const [nickname, setNickname] = useState(storedSession?.nickname ?? '');
  const [avatar, setAvatar] = useState(storedSession?.avatar ?? AVATAR_OPTIONS[0]);
  const [color, setColor] = useState(storedSession?.color ?? COLOR_OPTIONS[0]);
  const [joinCode, setJoinCode] = useState(inviteCodeFromUrl);

  // Game & Room State
  const [room, setRoom] = useState<SanitizedRoomState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [wolfAlertBanner, setWolfAlertBanner] = useState<string | null>(null);
  const [isRoleDrawerOpen, setIsRoleDrawerOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(soundEngine.isMuted());
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [activeNightMode, setActiveNightMode] = useState<
    'DEFAULT' | 'WITCH_POISON' | 'WHITE_WOLF_KILL' | null
  >('DEFAULT');

  // Establish Socket.io connection & handle automatic sessionStorage reconnection
  useEffect(() => {
    const backendUrl =
      import.meta.env.VITE_SERVER_URL ||
      (window.location.port === '5173' ? 'http://localhost:4000' : window.location.origin);

    const socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      const saved = loadSessionFromStorage();
      if (saved?.roomCode && saved?.sessionToken) {
        socket.emit('room:reconnect', {
          roomCode: saved.roomCode,
          sessionToken: saved.sessionToken,
        });
      }
    });

    socket.on(
      'room:joined',
      (data: { roomCode: string; playerId: string; sessionToken: string }) => {
        saveSessionToStorage({
          roomCode: data.roomCode,
          playerId: data.playerId,
          sessionToken: data.sessionToken,
          nickname: nickname.trim() || storedSession?.nickname || 'Wanderer',
          avatar,
          color,
        });
        setErrorBanner(null);
      }
    );

    socket.on('room:state', (nextState: SanitizedRoomState) => {
      setRoom(nextState);
      if (nextState.phase !== 'NIGHT_PHASE') {
        setActiveNightMode('DEFAULT');
        setWolfAlertBanner(null);
      }
    });

    socket.on('chat:message', (msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev.slice(-150), msg];
      });
    });

    socket.on('sound:cue', (payload: { cue: SoundCueType }) => {
      soundEngine.play(payload.cue);
    });

    socket.on(
      'night:wolfAlert',
      (payload: { suspicionLevel: number; message: string }) => {
        setWolfAlertBanner(payload.message);
        soundEngine.play('NIGHTFALL');
      }
    );

    socket.on('room:error', (err: { code: string; message: string }) => {
      if (err.code === 'RECONNECT_FAILED') {
        clearSessionFromStorage();
        return;
      }
      setErrorBanner(err.message);
      setTimeout(() => setErrorBanner(null), 5000);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Countdown ticker synced with server's authoritative `phaseEndsAt`
  useEffect(() => {
    if (!room?.phaseEndsAt) {
      setSecondsRemaining(0);
      return;
    }

    const updateRemaining = () => {
      const diff = Math.max(0, Math.ceil((room.phaseEndsAt! - Date.now()) / 1000));
      setSecondsRemaining(diff);
    };

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 250);
    return () => window.clearInterval(interval);
  }, [room?.phaseEndsAt, room?.phase]);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.play('CLICK');
    setMessages([]);
    socketRef.current?.emit('room:create', {
      nickname: nickname.trim() || 'Firekeeper',
      avatar,
      color,
    });
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      setErrorBanner('Please enter a 5-character room code.');
      return;
    }
    soundEngine.play('CLICK');
    setMessages([]);
    const saved = loadSessionFromStorage();
    socketRef.current?.emit('room:join', {
      roomCode: joinCode.trim().toUpperCase(),
      nickname: nickname.trim() || 'Wanderer',
      avatar,
      color,
      sessionToken:
        saved?.roomCode === joinCode.trim().toUpperCase()
          ? saved.sessionToken
          : undefined,
    });
  };

  const handleLeaveRoom = () => {
    clearSessionFromStorage();
    setRoom(null);
    setMessages([]);
    window.history.replaceState({}, '', window.location.pathname);
    socketRef.current?.disconnect();
    socketRef.current?.connect();
  };

  const handleUpdateConfig = (update: {
    timers?: Partial<PhaseTimers>;
    enabledRoles?: Partial<Record<RoleType, number>>;
  }) => {
    socketRef.current?.emit('lobby:updateConfig', update);
  };

  const handleAddBot = () => {
    soundEngine.play('CLICK');
    socketRef.current?.emit('lobby:addBot');
  };

  const handleRemovePlayer = (playerId: string) => {
    soundEngine.play('CLICK');
    socketRef.current?.emit('lobby:removePlayer', { playerId });
  };

  const handleStartGame = () => {
    soundEngine.play('CLICK');
    socketRef.current?.emit('game:start');
  };

  const handlePlayAgain = () => {
    soundEngine.play('CLICK');
    socketRef.current?.emit('game:playAgain');
  };

  const handleNightAction = (payload: NightActionPayload) => {
    if (payload.actionType === 'WOLF_VOTE') {
      socketRef.current?.emit('night:wolfVote', {
        targetId: payload.targetId ?? null,
      });
    } else {
      socketRef.current?.emit('night:action', payload);
      setActiveNightMode('DEFAULT');
    }
  };

  const handleToggleLittleGirlPeek = (peeking: boolean) => {
    soundEngine.play('CLICK');
    socketRef.current?.emit('night:littleGirlPeek', { peeking });
  };

  const handleToggleSkipDiscussion = () => {
    soundEngine.play('CLICK');
    socketRef.current?.emit('day:skipVote');
  };

  const handleCastDayVote = (targetId: string | 'SKIP' | null) => {
    socketRef.current?.emit('day:vote', { targetId });
  };

  const handleHunterShoot = (targetId: string) => {
    socketRef.current?.emit('hunter:shoot', { targetId });
  };

  const handleSendMessage = (
    content: string,
    channel: 'PUBLIC' | 'WOLF' | 'GHOST'
  ) => {
    socketRef.current?.emit('chat:send', { content, channel });
  };

  const handleTypingChange = (isTyping: boolean) => {
    socketRef.current?.emit('chat:typing', { isTyping });
  };

  const handleSpeakingChange = (isSpeaking: boolean) => {
    socketRef.current?.emit('webrtc:speaking', { isSpeaking });
  };

  const toggleSoundMute = () => {
    const nextMuted = soundEngine.toggleMute();
    setIsMuted(nextMuted);
  };

  const isNight = room?.phase === 'NIGHT_PHASE';
  const selfRole = room?.self?.role ? ROLE_CATALOG[room.self.role] : null;

  return (
    <div
      className={`min-h-screen transition-colors duration-1000 flex flex-col ${
        isNight
          ? 'bg-gradient-to-b from-[#060913] via-[#0d152c] to-[#090d1a]'
          : 'bg-gradient-to-b from-[#13111c] via-[#1f1619] to-[#0e1318]'
      }`}
    >
      {/* Top Navigation & Atmosphere Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/75 backdrop-blur-md px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 shadow-lg">
              <Flame className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                <span>Campfire Wolves</span>
                {room && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-xs font-mono text-amber-300">
                    #{room.roomCode}
                  </span>
                )}
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Multiplayer Social Deduction Around the Fire
              </p>
            </div>
          </div>

          {/* Center Phase & Countdown Pill */}
          {room && (
            <div className="flex items-center gap-2">
              <div
                className={`px-3.5 py-1.5 rounded-full border text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow ${
                  isNight
                    ? 'bg-indigo-950/90 border-indigo-400/50 text-indigo-200'
                    : 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                }`}
              >
                {isNight ? (
                  <Moon className="w-3.5 h-3.5 text-indigo-300" />
                ) : (
                  <Sun className="w-3.5 h-3.5 text-amber-300" />
                )}
                <span>{room.phase.replace(/_/g, ' ')}</span>
                {room.dayNumber > 0 && (
                  <span className="text-slate-400">
                    • {isNight ? `Night ${room.nightNumber}` : `Day ${room.dayNumber}`}
                  </span>
                )}
              </div>

              {room.phaseEndsAt && secondsRemaining > 0 && (
                <div
                  className={`px-3 py-1.5 rounded-full border text-xs font-black font-mono flex items-center gap-1 ${
                    secondsRemaining <= 8
                      ? 'bg-rose-600/30 border-rose-400 text-rose-200 animate-pulse'
                      : 'bg-slate-900 border-slate-700 text-slate-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>{secondsRemaining}s</span>
                </div>
              )}
            </div>
          )}

          {/* Right Controls: Secret Role Badge, Almanac Drawer, Audio Mute, Leave */}
          <div className="flex items-center gap-2">
            {room && selfRole && room.phase !== 'LOBBY' && (
              <div
                className={`px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-1.5 ${selfRole.badgeBg}`}
              >
                <span>{selfRole.icon}</span>
                <span className="hidden md:inline">Your Role:</span>
                <span>{selfRole.name}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsRoleDrawerOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition"
            >
              <BookOpen className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Role Guide</span>
            </button>

            <button
              type="button"
              onClick={toggleSoundMute}
              title={isMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>

            {room && (
              <button
                type="button"
                onClick={handleLeaveRoom}
                title="Leave Campfire"
                className="p-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 border border-rose-700/50 text-rose-200 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Error / Alert Toast Notifications */}
      <AnimatePresence>
        {(errorBanner || wolfAlertBanner) && (
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="max-w-xl mx-auto mt-3 px-4 w-full z-40"
          >
            <div className="p-3 rounded-xl bg-rose-950/90 border border-rose-500/60 text-rose-100 text-xs font-semibold flex items-center justify-between gap-2 shadow-xl">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorBanner ?? wolfAlertBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setErrorBanner(null);
                  setWolfAlertBanner(null);
                }}
                className="text-rose-300 hover:text-white text-xs font-bold"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 flex flex-col justify-center">
        {!room ? (
          /* Landing Screen: Create or Join a Campfire Room */
          <div className="max-w-lg w-full mx-auto rounded-3xl bg-slate-900/85 border border-slate-800 backdrop-blur-xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/40 mx-auto flex items-center justify-center text-4xl shadow-inner">
                🔥
              </div>
              <h2 className="text-2xl font-black text-white">
                Gather Around the Campfire
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                4 to 12 players • Secret roles, midnight plots, and daytime
                tribunals inspired by <em>Agrou</em>.
              </p>
            </div>

            {/* Player Customization */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Your Nickname
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Enter your wanderer name..."
                  maxLength={20}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Choose Woodland Avatar
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {AVATAR_OPTIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        soundEngine.play('CLICK');
                        setAvatar(item);
                      }}
                      className={`h-11 rounded-xl text-xl flex items-center justify-center border transition ${
                        avatar === item
                          ? 'bg-amber-500/20 border-amber-400 scale-105 shadow'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Seat Aura Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => {
                        soundEngine.play('CLICK');
                        setColor(hex);
                      }}
                      className={`w-7 h-7 rounded-full border-2 transition ${
                        color === hex
                          ? 'scale-125 border-white shadow-lg'
                          : 'border-transparent opacity-75 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Create or Join Actions */}
            <div className="pt-2 space-y-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleCreateRoom}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-sm shadow-lg flex items-center justify-center gap-2 transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>Create New Campfire Room</span>
              </button>

              <form onSubmit={handleJoinRoom} className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="5-CHAR CODE"
                  maxLength={5}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm font-mono uppercase tracking-widest text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold text-sm transition"
                >
                  Join Room
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* Active Room Layout: Campfire Circle + Contextual Panels + Chat */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left / Center Column: Campfire Arena & Phase Controls */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-5">
              {room.phase !== 'LOBBY' && (
                <PhaseActionToolbar
                  room={room}
                  activeNightMode={activeNightMode}
                  onSetActiveNightMode={setActiveNightMode}
                  onSubmitNightAction={handleNightAction}
                  onToggleLittleGirlPeek={handleToggleLittleGirlPeek}
                  onToggleSkipDiscussion={handleToggleSkipDiscussion}
                  onCastDayVote={handleCastDayVote}
                  onPlayAgain={handlePlayAgain}
                />
              )}

              <CampfireArena
                room={room}
                activeNightMode={activeNightMode}
                onSelectNightTarget={handleNightAction}
                onCastDayVote={handleCastDayVote}
                onHunterShoot={handleHunterShoot}
                onRemovePlayer={handleRemovePlayer}
              />

              {room.phase === 'LOBBY' && (
                <LobbyConfigPanel
                  room={room}
                  onUpdateConfig={handleUpdateConfig}
                  onAddBot={handleAddBot}
                  onStartGame={handleStartGame}
                />
              )}
            </div>

            {/* Right Column: Multi-Channel Chat & Voice Controls */}
            <div className="lg:col-span-5 xl:col-span-4">
              <ChatPanel
                room={room}
                messages={messages}
                onSendMessage={handleSendMessage}
                onTypingChange={handleTypingChange}
                onSpeakingChange={handleSpeakingChange}
              />
            </div>
          </div>
        )}
      </main>

      {/* Role Reveal 3D Flip Overlay (ROLE_REVEAL Phase) */}
      {room?.phase === 'ROLE_REVEAL' && room.self && (
        <RoleRevealModal
          role={room.self.role}
          secondsRemaining={secondsRemaining}
        />
      )}

      {/* Slide-out Role Reference Almanac Drawer */}
      <RoleReferenceDrawer
        isOpen={isRoleDrawerOpen}
        onClose={() => setIsRoleDrawerOpen(false)}
      />
    </div>
  );
};
