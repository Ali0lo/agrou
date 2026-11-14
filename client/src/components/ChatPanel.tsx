import React, { useEffect, useRef, useState } from 'react';
import {
  Eye,
  Flame,
  Ghost,
  Mic,
  MicOff,
  Send,
  Skull,
} from 'lucide-react';
import { ChatMessage, SanitizedRoomState } from '../types/game';

interface ChatPanelProps {
  room: SanitizedRoomState;
  messages: ChatMessage[];
  onSendMessage: (content: string, channel: 'PUBLIC' | 'WOLF' | 'GHOST') => void;
  onTypingChange: (isTyping: boolean) => void;
  onSpeakingChange: (isSpeaking: boolean) => void;
}

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
  const isWolf =
    self?.role === 'WEREWOLF' ||
    self?.role === 'BLACK_WOLF' ||
    self?.role === 'WHITE_WOLF';
  const isLittleGirlPeeking =
    room.phase === 'NIGHT_PHASE' &&
    isAlive &&
    self?.role === 'LITTLE_GIRL' &&
    self.isPeeking;

  const canAccessWolfTab =
    (room.phase === 'NIGHT_PHASE' && isAlive && (isWolf || isLittleGirlPeeking)) ||
    !isAlive ||
    room.phase === 'GAME_OVER';

  const canAccessGhostTab = !isAlive || room.phase === 'GAME_OVER';

  const [activeTab, setActiveTab] = useState<'PUBLIC' | 'WOLF' | 'GHOST'>('PUBLIC');
  const [input, setInput] = useState('');
  const [isHoldingPtt, setIsHoldingPtt] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  // Automatically switch to Wolf Chat at night for Werewolves or Peeking Little Girl, or Ghost Chat on death
  useEffect(() => {
    if (room.phase === 'NIGHT_PHASE' && isAlive && (isWolf || isLittleGirlPeeking)) {
      setActiveTab('WOLF');
    } else if (!isAlive && room.phase !== 'LOBBY' && room.phase !== 'GAME_OVER') {
      setActiveTab('GHOST');
    } else {
      setActiveTab('PUBLIC');
    }
  }, [room.phase, isAlive, isWolf, isLittleGirlPeeking]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeTab]);

  const filteredMessages = messages.filter((msg) => {
    if (activeTab === 'PUBLIC') {
      return msg.channel === 'PUBLIC' || msg.channel === 'SYSTEM';
    }
    if (activeTab === 'WOLF') {
      return msg.channel === 'WOLF';
    }
    if (activeTab === 'GHOST') {
      return msg.channel === 'GHOST';
    }
    return true;
  });

  const canSendInActiveTab = (): { allowed: boolean; placeholder: string } => {
    if (activeTab === 'WOLF') {
      if (isLittleGirlPeeking) {
        return {
          allowed: false,
          placeholder: '🕯️ Peeking secretly at Werewolf chat (Read-only)...',
        };
      }
      if (room.phase === 'NIGHT_PHASE' && isAlive && isWolf) {
        return {
          allowed: true,
          placeholder: 'Whisper to the Werewolf pack...',
        };
      }
      return {
        allowed: false,
        placeholder: 'Werewolf chat is only active for living Wolves at night.',
      };
    }

    if (activeTab === 'GHOST') {
      if (!isAlive || room.phase === 'GAME_OVER') {
        return {
          allowed: true,
          placeholder: 'Whisper to fellow ghosts in the afterlife...',
        };
      }
      return {
        allowed: false,
        placeholder: 'Only ghosts can speak here.',
      };
    }

    // PUBLIC
    if (!isAlive && room.phase !== 'LOBBY' && room.phase !== 'GAME_OVER') {
      return {
        allowed: false,
        placeholder: 'Ghosts cannot speak to the living. Switch to Ghost Chat!',
      };
    }
    if (room.phase === 'NIGHT_PHASE') {
      return {
        allowed: false,
        placeholder: 'Public campfire chat is asleep during the night...',
      };
    }

    return {
      allowed: true,
      placeholder: 'Speak around the campfire...',
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

  return (
    <div
      className={`flex flex-col h-[460px] lg:h-[580px] rounded-2xl border backdrop-blur-md shadow-2xl overflow-hidden transition-colors duration-500 ${
        activeTab === 'WOLF'
          ? 'bg-red-950/40 border-red-500/40'
          : activeTab === 'GHOST'
          ? 'bg-slate-900/75 border-cyan-500/30'
          : 'bg-slate-900/75 border-slate-800'
      }`}
    >
      {/* Channel Tabs Header */}
      <div className="p-2.5 border-b border-slate-800/90 flex items-center justify-between gap-1 bg-slate-950/60">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('PUBLIC')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              activeTab === 'PUBLIC'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Campfire</span>
          </button>

          {canAccessWolfTab && (
            <button
              type="button"
              onClick={() => setActiveTab('WOLF')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeTab === 'WOLF'
                  ? 'bg-red-600/30 text-red-200 border border-red-500/50'
                  : 'text-red-400/80 hover:text-red-200 hover:bg-red-950/50'
              }`}
            >
              {isLittleGirlPeeking ? (
                <Eye className="w-3.5 h-3.5 animate-pulse" />
              ) : (
                <Skull className="w-3.5 h-3.5" />
              )}
              <span>{isLittleGirlPeeking ? 'Spying (Wolves)' : 'Wolf Pack'}</span>
            </button>
          )}

          {canAccessGhostTab && (
            <button
              type="button"
              onClick={() => setActiveTab('GHOST')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeTab === 'GHOST'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                  : 'text-cyan-400/80 hover:text-cyan-200 hover:bg-slate-800/60'
              }`}
            >
              <Ghost className="w-3.5 h-3.5" />
              <span>Ghost Chat</span>
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
            title="Hold to Speak (Push-to-Talk)"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition select-none ${
              isHoldingPtt
                ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            {isHoldingPtt ? (
              <>
                <Mic className="w-3.5 h-3.5 animate-pulse" /> Talking
              </>
            ) : (
              <>
                <MicOff className="w-3.5 h-3.5" /> Hold PTT
              </>
            )}
          </button>
        )}
      </div>

      {/* Messages Feed */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3.5 space-y-2.5 text-sm"
      >
        {filteredMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs px-4">
            <p>No messages in this channel yet.</p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            if (msg.channel === 'SYSTEM') {
              return (
                <div
                  key={msg.id}
                  className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs leading-relaxed"
                >
                  {msg.content}
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`p-2.5 rounded-xl border text-xs leading-relaxed ${
                  msg.channel === 'WOLF'
                    ? 'bg-red-950/60 border-red-800/50 text-red-100'
                    : msg.channel === 'GHOST'
                    ? 'bg-cyan-950/35 border-cyan-800/40 text-cyan-100 italic'
                    : 'bg-slate-950/65 border-slate-800/80 text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className="font-bold"
                    style={{ color: msg.senderColor }}
                  >
                    {msg.senderName}
                    {msg.isAnonymized && (
                      <span className="ml-1.5 px-1.5 py-0.2 rounded bg-red-500/20 text-[9px] text-red-300 uppercase">
                        Masked
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="break-words text-slate-200">{msg.content}</p>
              </div>
            );
          })
        )}
      </div>

      {/* Chat Input Form */}
      <form
        onSubmit={handleSubmit}
        className="p-2.5 border-t border-slate-800/90 bg-slate-950/70 flex items-center gap-2"
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
