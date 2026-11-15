import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye,
  Flame,
  Lock,
  MessageCircle,
  Mic,
  MicOff,
  Send,
  Skull,
} from 'lucide-react';
import { ChatChannel, ChatMessage, RoleType, SanitizedRoomState } from '../types/game';

export type ActiveChatTab = Exclude<ChatChannel, 'system'>;

interface ChatPanelProps {
  room: SanitizedRoomState;
  messages: ChatMessage[];
  onSendMessage: (content: string, channel: ActiveChatTab) => void;
  onTypingChange: (isTyping: boolean) => void;
  onSpeakingChange: (isSpeaking: boolean) => void;
}

const WOLF_ROLES: ReadonlySet<RoleType> = new Set([
  'WEREWOLF',
  'BLACK_WOLF',
  'MYSTIC_WOLF',
  'WHITE_WOLF',
]);

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
  const isNight = room.phase === 'NIGHT_PHASE';
  const isWolfPack = Boolean(self && isAlive && WOLF_ROLES.has(self.role));
  const isPeekingGirl = Boolean(
    isNight && isAlive && self?.role === 'LITTLE_GIRL' && self.isPeeking
  );

  const canSeeWolvesTab = isWolfPack || isPeekingGirl;
  const canSeeDeadTab = Boolean(selfPlayer && !selfPlayer.isAlive);

  const [activeTab, setActiveTab] = useState<ActiveChatTab>('public');
  const [draft, setDraft] = useState('');
  const [isMicHeld, setIsMicHeld] = useState(false);

  const endRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-switch to a sensible tab on phase/life changes
  useEffect(() => {
    if (activeTab === 'wolves' && !canSeeWolvesTab) {
      setActiveTab(!isAlive ? 'dead' : 'public');
    } else if (activeTab === 'dead' && !canSeeDeadTab) {
      setActiveTab('public');
    }
  }, [activeTab, canSeeWolvesTab, canSeeDeadTab, isAlive]);

  useEffect(() => {
    if (isNight && isWolfPack && room.phase === 'NIGHT_PHASE') {
      setActiveTab('wolves');
    } else if (
      room.phase === 'DAY_DISCUSSION' ||
      room.phase === 'DAY_VOTING'
    ) {
      if (isAlive) setActiveTab('public');
    }
  }, [room.phase, isNight, isWolfPack, isAlive]);

  const visibleMessages = useMemo(() => {
    return messages.filter((msg) => {
      if (activeTab === 'public') {
        return msg.channel === 'public' || msg.channel === 'system';
      }
      if (activeTab === 'wolves') {
        return msg.channel === 'wolves';
      }
      return msg.channel === 'dead';
    });
  }, [messages, activeTab]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages.length, activeTab]);

  const canWriteActiveTab = useMemo(() => {
    if (room.phase === 'GAME_OVER') return activeTab === 'public' || (activeTab === 'dead' && !isAlive);
    if (activeTab === 'public') {
      if (room.phase === 'LOBBY') return true;
      return isAlive && !isNight;
    }
    if (activeTab === 'wolves') {
      // Wolves write freely (especially at night); peeking Little Girl is strictly read-only
      return isWolfPack && !isPeekingGirl;
    }
    if (activeTab === 'dead') {
      return !isAlive;
    }
    return false;
  }, [activeTab, room.phase, isAlive, isNight, isWolfPack, isPeekingGirl]);

  const inputPlaceholder = useMemo(() => {
    if (activeTab === 'wolves') {
      if (isPeekingGirl) {
        return '👀 Gizlicə dinləyirsiniz (yalnız oxumaq mümkündür)...';
      }
      return '🐺 Qətil yoldaşlarınıza gizli mesaj yazın...';
    }
    if (activeTab === 'dead') {
      return '👻 Ruhlar aləmində mesaj yazın...';
    }
    if (!isAlive && room.phase !== 'LOBBY' && room.phase !== 'GAME_OVER') {
      return '💀 Ölü oyunçular Ümumi çata yaza bilməz.';
    }
    if (isNight) {
      return '🌙 Gecə Ümumi söhbət bağlıdır...';
    }
    return '💬 Tonqal ətrafına mesaj yazın...';
  }, [activeTab, isPeekingGirl, isAlive, room.phase, isNight]);

  const handleDraftChange = (value: string) => {
    setDraft(value);
    onTypingChange(Boolean(value.trim()));
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      onTypingChange(false);
    }, 1500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draft.trim();
    if (!cleaned || !canWriteActiveTab) return;
    onSendMessage(cleaned, activeTab);
    setDraft('');
    onTypingChange(false);
  };

  const toggleSpeaking = (nextState: boolean) => {
    setIsMicHeld(nextState);
    onSpeakingChange(nextState);
  };

  const containerBorder =
    activeTab === 'wolves'
      ? 'border-red-500/45 bg-red-950/20'
      : activeTab === 'dead'
        ? 'border-cyan-500/35 bg-slate-900/85'
        : 'border-slate-700/60 bg-slate-900/85';

  return (
    <div
      className={`rounded-2xl border backdrop-blur-md flex flex-col h-[500px] lg:h-[600px] shadow-2xl overflow-hidden transition-colors ${containerBorder}`}
    >
      {/* Channel Tabs */}
      <div className="p-2.5 border-b border-slate-800/80 flex items-center justify-between gap-2 bg-slate-950/60">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('public')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'public'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Ümumi
          </button>

          {canSeeWolvesTab && (
            <button
              type="button"
              onClick={() => setActiveTab('wolves')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'wolves'
                  ? 'bg-red-600 text-white shadow'
                  : 'bg-red-950/60 text-red-300 border border-red-500/30 hover:bg-red-900/60'
              }`}
            >
              {isPeekingGirl ? (
                <Eye className="w-3.5 h-3.5" />
              ) : (
                <Flame className="w-3.5 h-3.5" />
              )}
              {isPeekingGirl ? 'Qətillər (Gizli Baxış)' : 'Qətil Çatı'}
            </button>
          )}

          {canSeeDeadTab && (
            <button
              type="button"
              onClick={() => setActiveTab('dead')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'dead'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'bg-slate-800/80 text-cyan-300 border border-cyan-500/30 hover:bg-slate-700'
              }`}
            >
              <Skull className="w-3.5 h-3.5" />
              Ruhlar
            </button>
          )}
        </div>

        {/* Voice Indicator Toggle (Visual / WebRTC hook) */}
        {room.config.allowWebRTC && isAlive && (
          <button
            type="button"
            onClick={() => toggleSpeaking(!isMicHeld)}
            title="Səsli danışma indikatoru"
            className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
              isMicHeld
                ? 'bg-emerald-500 text-slate-950 border-emerald-300 animate-pulse'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {isMicHeld ? (
              <Mic className="w-3.5 h-3.5" />
            ) : (
              <MicOff className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Private Channel Confidentiality Notice */}
      {activeTab === 'wolves' && (
        <div className="px-3 py-1.5 bg-red-950/70 border-b border-red-500/25 text-[11px] text-red-200 flex items-center gap-1.5">
          <Lock className="w-3 h-3 shrink-0" />
          <span>
            {isPeekingGirl
              ? 'Qətillərin adları anonimləşdirilib (Wolf 1, Wolf 2...). Yalnız dinləyə bilərsiniz.'
              : 'Yalnız Qətil komandası və Ağ Canavar bu çatı görə bilər.'}
          </span>
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {visibleMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500 text-center px-4">
            {activeTab === 'wolves'
              ? 'Qaranlıq sürünün səssizliyi... Gecə planını buradan yazın.'
              : activeTab === 'dead'
                ? 'Ruhlar aləmi hələ səssizdir.'
                : 'Tonqal ətrafında söhbətə başlayın.'}
          </div>
        ) : (
          visibleMessages.map((msg) => {
            const isSystem = msg.channel === 'system' || msg.senderId === 'SYSTEM';
            if (isSystem) {
              return (
                <div
                  key={msg.id}
                  className="text-[11px] px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200/95 leading-relaxed"
                >
                  {msg.content}
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`rounded-xl px-3 py-2 text-xs border ${
                  msg.channel === 'wolves'
                    ? 'bg-red-950/45 border-red-500/25 text-red-100'
                    : msg.channel === 'dead'
                      ? 'bg-cyan-950/35 border-cyan-500/25 text-cyan-100'
                      : 'bg-slate-800/75 border-slate-700/50 text-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span
                    className="font-bold text-[11px]"
                    style={{ color: msg.senderColor }}
                  >
                    {msg.senderName}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-xs leading-relaxed break-words text-slate-100">
                  {msg.content}
                </p>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="p-2.5 border-t border-slate-800/80 bg-slate-950/60 flex items-center gap-2"
      >
        <input
          type="text"
          maxLength={280}
          disabled={!canWriteActiveTab}
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          placeholder={inputPlaceholder}
          className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canWriteActiveTab || !draft.trim()}
          className={`p-2 rounded-xl transition ${
            canWriteActiveTab && draft.trim()
              ? activeTab === 'wolves'
                ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
