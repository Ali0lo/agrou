import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send } from 'lucide-react';
import { ChatChannel, ChatMessage, SanitizedRoomState } from '../types/game';

type ActiveChatTab = Exclude<ChatChannel, 'system'>;

interface ChatPanelProps {
  room: SanitizedRoomState;
  messages: ChatMessage[];
  onSendMessage: (content: string, channel: ActiveChatTab) => void;
  onTypingChange: (isTyping: boolean) => void;
  onSpeakingChange: (isSpeaking: boolean) => void;
}

const CHANNEL_HEADERS: Record<
  ActiveChatTab,
  {
    title: string;
    subtitle: string;
    containerClass: string;
    headerBannerClass: string;
    messageCardClass: string;
  }
> = {
  public: {
    title: '💬 Ümumi Söhbət',
    subtitle: 'Bütün otaq görür • Yalnız sağ oyunçular gündüz yaza bilər',
    containerClass: 'bg-slate-900/75 border-slate-700',
    headerBannerClass:
      'bg-slate-900/80 border-slate-700 text-slate-200',
    messageCardClass:
      'bg-slate-950/65 border-slate-700/80 text-slate-200',
  },
  wolves: {
    title: '🐺 Canavarlar Sürüsü — Yalnız canavarlar görür',
    subtitle: 'Gecə hücum hədəfini seçin və kəndi aldatmaq üçün plan qurun',
    containerClass: 'bg-rose-950/40 border-rose-500/40 text-rose-200',
    headerBannerClass:
      'bg-rose-950/60 border-rose-500/40 text-rose-200',
    messageCardClass:
      'bg-rose-950/55 border-rose-500/40 text-rose-100',
  },
  siblings: {
    title: '👥 Qardaşlar Kanalı',
    subtitle: 'Gecə və gündüz qardaş/bacınızla gizli alibi yoxlayın',
    containerClass: 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200',
    headerBannerClass:
      'bg-indigo-950/60 border-indigo-500/40 text-indigo-200',
    messageCardClass:
      'bg-indigo-950/55 border-indigo-500/40 text-indigo-100',
  },
  lovers: {
    title: '💘 Aşiqlər Kanalı',
    subtitle: 'Kupidon tərəfindən birləşdirilmiş aşiqlərin gizli rabitəsi',
    containerClass: 'bg-pink-950/40 border-pink-500/40 text-pink-200',
    headerBannerClass:
      'bg-pink-950/60 border-pink-500/40 text-pink-200',
    messageCardClass:
      'bg-pink-950/55 border-pink-500/40 text-pink-100',
  },
  dead: {
    title: '👻 Ruhlar Aləmi',
    subtitle: 'Ölülər sərbəst danışır • Gecələr Ruhçağıran (Medium) sizi eşidir',
    containerClass: 'bg-teal-950/40 border-teal-500/40 text-teal-200',
    headerBannerClass:
      'bg-teal-950/60 border-teal-500/40 text-teal-200',
    messageCardClass:
      'bg-teal-950/55 border-teal-500/40 text-teal-100',
  },
};

export const ChatPanel: React.FC<ChatPanelProps> = ({
  room,
  messages,
  onSendMessage,
  onTypingChange,
  onSpeakingChange,
}) => {
  const self = room.self;
  const selfPlayer = room.players.find((p) => p.id === self?.playerId) ?? null;
  const isAlive = Boolean(selfPlayer?.isAlive);

  const isWolfTeam =
    self?.role === 'WEREWOLF' ||
    self?.role === 'BIG_BAD_WOLF' ||
    self?.role === 'BLACK_WOLF' ||
    self?.role === 'WOLF_SEER' ||
    self?.role === 'WHITE_WOLF' ||
    Boolean(self?.wasInfectedToWolf);

  const isSister = self?.role === 'SISTERS';

  const loverPartner = self?.loverPartnerId
    ? room.players.find((p) => p.id === self.loverPartnerId) ?? null
    : null;
  const isAliveLoverPair = Boolean(
    isAlive && self?.loverPartnerId && loverPartner?.isAlive
  );

  const isMediumAtNight =
    room.phase === 'NIGHT_PHASE' &&
    isAlive &&
    self?.role === 'MEDIUM' &&
    !room.villagePowersLost;

  const isLittleGirlPeeking =
    room.phase === 'NIGHT_PHASE' &&
    isAlive &&
    self?.role === 'LITTLE_GIRL' &&
    Boolean(self.isPeeking);

  // Authorized channels for current player
  const canAccessWolvesTab =
    (isAlive && isWolfTeam) ||
    isLittleGirlPeeking ||
    !isAlive ||
    room.phase === 'GAME_OVER';

  const canAccessSiblingsTab =
    (isAlive && isSister) || !isAlive || room.phase === 'GAME_OVER';

  const canAccessLoversTab =
    isAliveLoverPair ||
    (!isAlive && Boolean(self?.loverPartnerId)) ||
    room.phase === 'GAME_OVER';

  const canAccessDeadTab =
    !isAlive || isMediumAtNight || room.phase === 'GAME_OVER';

  const [activeTab, setActiveTab] = useState<ActiveChatTab>('public');
  const [unreadCounts, setUnreadCounts] = useState<Record<ActiveChatTab, number>>({
    public: 0,
    wolves: 0,
    siblings: 0,
    lovers: 0,
    dead: 0,
  });
  const [input, setInput] = useState('');
  const [isHoldingPtt, setIsHoldingPtt] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const prevPhaseRef = useRef<string>(room.phase);

  const selectTab = (tab: ActiveChatTab) => {
    setActiveTab(tab);
    setUnreadCounts((prev) => ({ ...prev, [tab]: 0 }));
  };

  // Auto-Switch Helper on phase transitions:
  // - Switch Werewolves to 'wolves' when Night begins, and back to 'public' at Dawn/Day
  // - Switch Medium to 'dead' when Night begins, and back to 'public' at Dawn/Day
  // - Switch eliminated players to 'dead'
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = room.phase;

    if (room.phase === 'NIGHT_PHASE') {
      if (isAlive && (isWolfTeam || isLittleGirlPeeking)) {
        selectTab('wolves');
      } else if (isMediumAtNight) {
        selectTab('dead');
      } else if (!isAlive) {
        selectTab('dead');
      }
    } else if (
      (room.phase === 'DAWN_SUMMARY' || room.phase === 'DAY_DISCUSSION') &&
      prevPhase === 'NIGHT_PHASE'
    ) {
      if (isAlive) {
        selectTab('public');
      } else {
        selectTab('dead');
      }
    } else if (
      !isAlive &&
      room.phase !== 'LOBBY' &&
      room.phase !== 'GAME_OVER' &&
      activeTab === 'public'
    ) {
      selectTab('dead');
    }
  }, [
    room.phase,
    isAlive,
    isWolfTeam,
    isLittleGirlPeeking,
    isMediumAtNight,
  ]);

  // Ensure activeTab falls back to 'public' if access is lost (e.g., Medium at dawn)
  useEffect(() => {
    if (activeTab === 'wolves' && !canAccessWolvesTab) {
      selectTab('public');
    } else if (activeTab === 'siblings' && !canAccessSiblingsTab) {
      selectTab('public');
    } else if (activeTab === 'lovers' && !canAccessLoversTab) {
      selectTab('public');
    } else if (activeTab === 'dead' && !canAccessDeadTab) {
      selectTab('public');
    }
  }, [
    activeTab,
    canAccessWolvesTab,
    canAccessSiblingsTab,
    canAccessLoversTab,
    canAccessDeadTab,
  ]);

  // Track unread message counts for inactive tabs
  useEffect(() => {
    for (const msg of messages) {
      if (seenMessageIdsRef.current.has(msg.id)) continue;
      seenMessageIdsRef.current.add(msg.id);

      const targetTab: ActiveChatTab =
        msg.channel === 'system' ? 'public' : msg.channel;

      if (targetTab !== activeTab) {
        setUnreadCounts((prev) => ({
          ...prev,
          [targetTab]: (prev[targetTab] ?? 0) + 1,
        }));
      }
    }
  }, [messages, activeTab]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeTab]);

  const filteredMessages = messages.filter((msg) => {
    if (activeTab === 'public') {
      return msg.channel === 'public' || msg.channel === 'system';
    }
    return msg.channel === activeTab;
  });

  const canSendInActiveTab = (): { allowed: boolean; placeholder: string } => {
    if (activeTab === 'wolves') {
      if (isLittleGirlPeeking) {
        return {
          allowed: false,
          placeholder:
            '🕯️ Kiçik Qız olaraq canavarları gizlicə izləyirsiniz (Yalnız oxu)...',
        };
      }
      if (room.phase === 'NIGHT_PHASE' && isAlive && isWolfTeam) {
        return {
          allowed: true,
          placeholder: '🐺 Canavarlar sürüsünə yazın...',
        };
      }
      return {
        allowed: false,
        placeholder: 'Canavarlar çatı yalnız gecə aktivdir (Gündüz yalnız oxu).',
      };
    }

    if (activeTab === 'siblings') {
      if (isAlive && isSister) {
        return {
          allowed: true,
          placeholder: '👥 Qardaş/Bacı ilə gizli söhbət...',
        };
      }
      return {
        allowed: false,
        placeholder: 'Yalnız sağ Qardaşlar/Bacılar bu kanala yaza bilər.',
      };
    }

    if (activeTab === 'lovers') {
      if (isAliveLoverPair) {
        return {
          allowed: true,
          placeholder: `💘 Aşiqiniz (${loverPartner?.nickname ?? ''}) ilə gizli söhbət...`,
        };
      }
      return {
        allowed: false,
        placeholder: 'Yalnız sağ Aşiqlər bu kanala yaza bilər.',
      };
    }

    if (activeTab === 'dead') {
      if (!isAlive || isMediumAtNight || room.phase === 'GAME_OVER') {
        return {
          allowed: true,
          placeholder: isMediumAtNight
            ? '🔮 Ruhçağıran olaraq ölüləri sorğu-suala tutun...'
            : '👻 Ruhlar aləmində sərbəst danışın...',
        };
      }
      return {
        allowed: false,
        placeholder: 'Yalnız ölülər və gecə Ruhçağıran burada danışa bilər.',
      };
    }

    // 'public' channel rules
    if (!isAlive && room.phase !== 'LOBBY' && room.phase !== 'GAME_OVER') {
      return {
        allowed: false,
        placeholder: 'Ölülər ümumi söhbətə yaza bilməz — 👻 Ruhlar kanalına keçin.',
      };
    }
    if (room.phase === 'NIGHT_PHASE') {
      return {
        allowed: false,
        placeholder: '🌙 Gecə vaxtı kənd yatıb — ümumi söhbət bağlıdır...',
      };
    }

    return {
      allowed: true,
      placeholder: '💬 Ümumi söhbətə mesaj yazın...',
    };
  };

  const handleInputChange = (val: string) => {
    setInput(val);
    onTypingChange(val.trim().length > 0);
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      onTypingChange(false);
    }, 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { allowed } = canSendInActiveTab();
    if (!allowed || !input.trim()) return;
    onSendMessage(input.trim(), activeTab);
    setInput('');
    onTypingChange(false);
  };

  const togglePushToTalk = (speaking: boolean) => {
    if (!isAlive && room.phase !== 'LOBBY' && room.phase !== 'GAME_OVER') return;
    setIsHoldingPtt(speaking);
    onSpeakingChange(speaking);
  };

  const { allowed, placeholder } = canSendInActiveTab();
  const currentTheme = CHANNEL_HEADERS[activeTab];

  const renderUnreadBadge = (tab: ActiveChatTab, dotColorClass: string) => {
    const count = unreadCounts[tab] ?? 0;
    if (count <= 0 || activeTab === tab) return null;
    return (
      <span
        className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold text-white shadow-sm flex items-center gap-1 ${dotColorClass}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
        {count > 9 ? '9+' : count}
      </span>
    );
  };

  return (
    <div
      className={`flex flex-col h-[500px] lg:h-[620px] rounded-2xl border backdrop-blur-md shadow-2xl overflow-hidden transition-colors duration-500 ${currentTheme.containerClass}`}
    >
      {/* Authorized Channel Tabs Bar */}
      <div className="p-2 border-b border-slate-800/90 flex flex-wrap items-center justify-between gap-1 bg-slate-950/75">
        <div className="flex flex-wrap items-center gap-1">
          {/* 1. Ümumi Söhbət (public) */}
          <button
            type="button"
            onClick={() => selectTab('public')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition border ${
              activeTab === 'public'
                ? 'bg-slate-800 text-slate-100 border-slate-600 shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>💬 Ümumi</span>
            {renderUnreadBadge('public', 'bg-amber-500')}
          </button>

          {/* 2. Canavarlar Çatı (wolves) */}
          {canAccessWolvesTab && (
            <button
              type="button"
              onClick={() => selectTab('wolves')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition border ${
                activeTab === 'wolves'
                  ? 'bg-rose-950/80 text-rose-200 border-rose-500/60 shadow-[0_0_12px_rgba(244,63,94,0.25)]'
                  : 'border-transparent text-rose-400/85 hover:text-rose-200 hover:bg-rose-950/40'
              }`}
            >
              <span>🐺 Canavarlar</span>
              {renderUnreadBadge('wolves', 'bg-rose-600')}
            </button>
          )}

          {/* 3. Qardaşlar / Bacılar Çatı (siblings) */}
          {canAccessSiblingsTab && (
            <button
              type="button"
              onClick={() => selectTab('siblings')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition border ${
                activeTab === 'siblings'
                  ? 'bg-indigo-950/80 text-indigo-200 border-indigo-500/60 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                  : 'border-transparent text-indigo-400/85 hover:text-indigo-200 hover:bg-indigo-950/40'
              }`}
            >
              <span>👥 Qardaşlar</span>
              {renderUnreadBadge('siblings', 'bg-indigo-600')}
            </button>
          )}

          {/* 4. Aşiqlər Çatı (lovers) */}
          {canAccessLoversTab && (
            <button
              type="button"
              onClick={() => selectTab('lovers')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition border ${
                activeTab === 'lovers'
                  ? 'bg-pink-950/80 text-pink-200 border-pink-500/60 shadow-[0_0_12px_rgba(236,72,153,0.25)]'
                  : 'border-transparent text-pink-400/85 hover:text-pink-200 hover:bg-pink-950/40'
              }`}
            >
              <span>💘 Aşiqlər</span>
              {renderUnreadBadge('lovers', 'bg-pink-600')}
            </button>
          )}

          {/* 5. Ruhlar / Ölülər Çatı (dead) */}
          {canAccessDeadTab && (
            <button
              type="button"
              onClick={() => selectTab('dead')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition border ${
                activeTab === 'dead'
                  ? 'bg-teal-950/80 text-teal-200 border-teal-500/60 shadow-[0_0_12px_rgba(20,184,166,0.25)]'
                  : 'border-transparent text-teal-400/85 hover:text-teal-200 hover:bg-teal-950/40'
              }`}
            >
              <span>👻 Ruhlar</span>
              {renderUnreadBadge('dead', 'bg-teal-600')}
            </button>
          )}
        </div>

        {/* Push-to-Talk Voice Indicator Button */}
        {room.config.allowWebRTC && isAlive && (
          <button
            type="button"
            onMouseDown={() => togglePushToTalk(true)}
            onMouseUp={() => togglePushToTalk(false)}
            onMouseLeave={() => isHoldingPtt && togglePushToTalk(false)}
            onTouchStart={() => togglePushToTalk(true)}
            onTouchEnd={() => togglePushToTalk(false)}
            title="Bas-Danış (Push-to-Talk)"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition select-none ${
              isHoldingPtt
                ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            {isHoldingPtt ? (
              <>
                <Mic className="w-3.5 h-3.5 animate-pulse" /> Danışır
              </>
            ) : (
              <>
                <MicOff className="w-3.5 h-3.5" /> PTT
              </>
            )}
          </button>
        )}
      </div>

      {/* Active Channel Context Header Banner */}
      <div
        className={`px-3.5 py-2 border-b text-xs flex items-center justify-between gap-2 ${currentTheme.headerBannerClass}`}
      >
        <div>
          <div className="font-bold tracking-wide">{currentTheme.title}</div>
          <div className="text-[10px] opacity-80">{currentTheme.subtitle}</div>
        </div>
        {activeTab === 'wolves' && isLittleGirlPeeking && (
          <span className="px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-400/40 text-[10px] font-semibold text-rose-200">
            👀 Gizli İzləmə
          </span>
        )}
        {activeTab === 'dead' && isMediumAtNight && (
          <span className="px-2 py-0.5 rounded-md bg-teal-500/20 border border-teal-400/40 text-[10px] font-semibold text-teal-200">
            🔮 Ruhçağıran Seansı
          </span>
        )}
      </div>

      {/* Messages Feed */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3.5 space-y-2.5 text-sm"
      >
        {filteredMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400/80 text-xs px-4">
            <p>Bu kanalda hələ mesaj yoxdur.</p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            if (msg.channel === 'system') {
              return (
                <div
                  key={msg.id}
                  className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs leading-relaxed"
                >
                  <div className="flex items-center justify-between text-[10px] text-amber-300/80 mb-0.5 font-semibold">
                    <span>{msg.channelBadge ?? '🔥 Sistem'}</span>
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div>{msg.content}</div>
                </div>
              );
            }

            const cardClass =
              CHANNEL_HEADERS[msg.channel]?.messageCardClass ??
              CHANNEL_HEADERS.public.messageCardClass;

            return (
              <div
                key={msg.id}
                className={`p-2.5 rounded-xl border text-xs leading-relaxed ${cardClass}`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {msg.channelBadge && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-900/70 border border-white/10 text-[9px] font-bold tracking-tight opacity-90">
                        {msg.channelBadge}
                      </span>
                    )}
                    <span
                      className="font-bold"
                      style={{ color: msg.senderColor }}
                    >
                      {msg.senderName}
                    </span>
                    {msg.isAnonymized && (
                      <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-[9px] text-rose-300 uppercase font-semibold">
                        Anonim Sürü
                      </span>
                    )}
                    {msg.isSpiritMessage && (
                      <span className="px-1.5 py-0.2 rounded bg-teal-500/20 text-[9px] text-teal-200 uppercase font-semibold">
                        Ruh Səsi
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] opacity-60 shrink-0">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="break-words">{msg.content}</p>
              </div>
            );
          })
        )}
      </div>

      {/* Chat Input Form */}
      <form
        onSubmit={handleSubmit}
        className="p-2.5 border-t border-slate-800/90 bg-slate-950/75 flex items-center gap-2"
      >
        <input
          type="text"
          disabled={!allowed}
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          maxLength={280}
          className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!allowed || !input.trim()}
          className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold transition"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
