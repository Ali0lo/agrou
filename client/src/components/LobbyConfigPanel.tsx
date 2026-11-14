import React, { useState } from 'react';
import {
  Bot,
  Check,
  Clock,
  Copy,
  Link2,
  Minus,
  Play,
  Plus,
  Settings,
  Users,
} from 'lucide-react';
import {
  PhaseTimers,
  ROLE_CATALOG,
  RoleType,
  SanitizedRoomState,
} from '../types/game';
import { soundEngine } from '../services/soundEngine';

interface LobbyConfigPanelProps {
  room: SanitizedRoomState;
  onUpdateConfig: (update: {
    timers?: Partial<PhaseTimers>;
    enabledRoles?: Partial<Record<RoleType, number>>;
  }) => void;
  onAddBot: () => void;
  onStartGame: () => void;
}

const ORDERED_ROLES: RoleType[] = [
  'WEREWOLF',
  'BLACK_WOLF',
  'WHITE_WOLF',
  'SEER',
  'WITCH',
  'GUARD',
  'HUNTER',
  'LITTLE_GIRL',
  'ANGEL',
  'VILLAGER',
];

export const LobbyConfigPanel: React.FC<LobbyConfigPanelProps> = ({
  room,
  onUpdateConfig,
  onAddBot,
  onStartGame,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const selfPlayer =
    room.players.find((p) => p.id === room.self?.playerId) ?? null;
  const isHost = Boolean(selfPlayer?.isHost);
  const playerCount = room.players.length;
  const canStart = playerCount >= 4 && playerCount <= 12;

  const totalConfiguredRoles = Object.values(room.config.enabledRoles).reduce(
    (sum, n) => sum + n,
    0
  );

  const copyRoomCode = () => {
    navigator.clipboard.writeText(room.roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${room.roomCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const adjustRoleCount = (role: RoleType, delta: number) => {
    if (!isHost) return;
    soundEngine.play('CLICK');
    const current = room.config.enabledRoles[role] ?? 0;
    const next = Math.max(0, Math.min(8, current + delta));
    onUpdateConfig({
      enabledRoles: {
        ...room.config.enabledRoles,
        [role]: next,
      },
    });
  };

  const adjustTimer = (key: keyof PhaseTimers, val: number) => {
    if (!isHost) return;
    onUpdateConfig({
      timers: {
        ...room.config.timers,
        [key]: val,
      },
    });
  };

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md p-4 space-y-5 shadow-2xl">
      {/* Room Code & Shareable Invite Link */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-slate-900 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-amber-300/90 font-bold">
            Campfire Invite Code
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-2xl font-black tracking-widest text-white font-mono">
              {room.roomCode}
            </span>
            <button
              type="button"
              onClick={copyRoomCode}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1 transition"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Code
                </>
              )}
            </button>
            <button
              type="button"
              onClick={copyInviteLink}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-semibold text-amber-200 flex items-center gap-1 transition"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Link Copied!
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5" /> Invite Link
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-bold flex items-center gap-1.5">
            <Users className="w-4 h-4 text-amber-400" />
            <span>{playerCount} / 12 Seated</span>
          </div>

          {isHost && playerCount < 12 && (
            <button
              type="button"
              onClick={onAddBot}
              className="px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/40 text-indigo-200 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Bot className="w-4 h-4" /> + Add Bot
            </button>
          )}
        </div>
      </div>

      {/* Role Deck Configuration */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-300">
            <Settings className="w-3.5 h-3.5 text-amber-400" /> Role Deck
            Configuration
          </div>
          <span className="text-[11px] text-slate-400">
            Deck Cards: <strong className="text-amber-300">{totalConfiguredRoles}</strong>{' '}
            (Auto-pads/trims to {playerCount} players)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ORDERED_ROLES.map((roleKey) => {
            const meta = ROLE_CATALOG[roleKey];
            const count = room.config.enabledRoles[roleKey] ?? 0;

            return (
              <div
                key={roleKey}
                className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                  count > 0
                    ? 'bg-slate-950/90 border-amber-500/40'
                    : 'bg-slate-950/40 border-slate-800/70 opacity-65'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xl">{meta.icon}</span>
                  <div className="min-w-0">
                    <p className={`text-xs font-bold truncate ${meta.colorClass}`}>
                      {meta.name}
                    </p>
                    <p className="text-[10px] text-slate-400">{meta.faction}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {isHost && (
                    <button
                      type="button"
                      onClick={() => adjustRoleCount(roleKey, -1)}
                      disabled={count <= 0}
                      className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 flex items-center justify-center text-slate-200"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  )}
                  <span className="w-5 text-center text-xs font-extrabold text-white">
                    {count}
                  </span>
                  {isHost && (
                    <button
                      type="button"
                      onClick={() => adjustRoleCount(roleKey, 1)}
                      className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Phase Timers Configuration */}
      <div className="pt-2 border-t border-slate-800/80">
        <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-3">
          <Clock className="w-3.5 h-3.5 text-amber-400" /> Phase Timers
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Night Phase</span>
              <span className="font-bold text-indigo-300">
                {room.config.timers.nightPhase}s
              </span>
            </div>
            <input
              type="range"
              min={15}
              max={90}
              step={5}
              disabled={!isHost}
              value={room.config.timers.nightPhase}
              onChange={(e) => adjustTimer('nightPhase', Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Day Discussion</span>
              <span className="font-bold text-amber-300">
                {room.config.timers.dayDiscussion}s
              </span>
            </div>
            <input
              type="range"
              min={30}
              max={180}
              step={15}
              disabled={!isHost}
              value={room.config.timers.dayDiscussion}
              onChange={(e) =>
                adjustTimer('dayDiscussion', Number(e.target.value))
              }
              className="w-full accent-amber-500"
            />
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Day Voting</span>
              <span className="font-bold text-rose-300">
                {room.config.timers.dayVoting}s
              </span>
            </div>
            <input
              type="range"
              min={15}
              max={90}
              step={5}
              disabled={!isHost}
              value={room.config.timers.dayVoting}
              onChange={(e) => adjustTimer('dayVoting', Number(e.target.value))}
              className="w-full accent-rose-500"
            />
          </div>
        </div>
      </div>

      {/* Start Game Action Bar */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          {canStart
            ? 'Ready to light the ritual fire!'
            : `Need at least ${4 - playerCount} more player(s) or bot(s) to start (4–12 required).`}
        </p>

        {isHost ? (
          <button
            type="button"
            disabled={!canStart}
            onClick={onStartGame}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-slate-950 font-black text-sm shadow-lg flex items-center justify-center gap-2 transition"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start Match ({playerCount} Players)</span>
          </button>
        ) : (
          <div className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-300 font-semibold">
            Waiting for Host to start the match...
          </div>
        )}
      </div>
    </div>
  );
};
