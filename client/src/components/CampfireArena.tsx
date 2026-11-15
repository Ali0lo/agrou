import React from 'react';
import { motion } from 'framer-motion';
import { Crown, Lock, Mic, Skull, Target, X } from 'lucide-react';
import { ROLE_CATALOG } from '../constants/roles';
import {
  ActiveNightSubMode,
  NightActionPayload,
  RoleType,
  SanitizedPlayerState,
  SanitizedRoomState,
} from '../types/game';
import { CampfireSvg } from './CampfireSvg';

interface CampfireArenaProps {
  room: SanitizedRoomState;
  activeNightMode: ActiveNightSubMode;
  onSelectNightTarget: (payload: NightActionPayload) => void;
  onCastDayVote: (targetId: string | 'SKIP' | null) => void;
  onHunterShoot: (targetId: string) => void;
  onRemovePlayer: (playerId: string) => void;
}

const WOLF_PACK_ROLES: ReadonlySet<RoleType | 'UNKNOWN'> = new Set([
  'WEREWOLF',
  'BLACK_WOLF',
  'MYSTIC_WOLF',
  'WHITE_WOLF',
]);

export const CampfireArena: React.FC<CampfireArenaProps> = ({
  room,
  activeNightMode,
  onSelectNightTarget,
  onCastDayVote,
  onHunterShoot,
  onRemovePlayer,
}) => {
  const self = room.self;
  const selfPlayer = room.players.find((p) => p.id === self?.playerId) ?? null;
  const isNight = room.phase === 'NIGHT_PHASE';
  const isVoting = room.phase === 'DAY_VOTING';
  const isHunterActive = Boolean(
    room.hunterRevenge && !room.hunterRevenge.resolved
  );
  const isSelfHunter =
    isHunterActive && room.hunterRevenge?.hunterId === self?.playerId;

  const isWolfPack = self ? WOLF_PACK_ROLES.has(self.role) : false;

  const totalPlayers = room.players.length;
  const isDenseRing = totalPlayers >= 12;
  const isUltraDenseRing = totalPlayers >= 14;

  // Dynamic ring scaling for 4 to 16 seats without crowding the center campfire
  const maxWidthClass = isDenseRing
    ? 'max-w-[740px]'
    : totalPlayers >= 8
      ? 'max-w-[660px]'
      : 'max-w-[580px]';

  const radiusPercent =
    totalPlayers <= 6
      ? 35
      : totalPlayers <= 9
        ? 38
        : totalPlayers <= 12
          ? 40
          : 42;

  const canTargetSeat = (seat: SanitizedPlayerState): boolean => {
    if (!self) return false;

    if (isHunterActive) {
      return isSelfHunter && seat.isAlive && seat.id !== self.playerId;
    }

    if (isVoting) {
      return Boolean(
        selfPlayer?.isAlive && seat.isAlive && seat.id !== self.playerId
      );
    }

    if (!isNight || !selfPlayer?.isAlive) return false;

    if (activeNightMode === 'WITCH_POISON') {
      return (
        self.role === 'WITCH' &&
        Boolean(self.witchPotions?.poisonAvailable) &&
        seat.isAlive &&
        seat.id !== self.playerId
      );
    }

    if (activeNightMode === 'MYSTIC_WOLF_INSPECT') {
      return (
        self.role === 'MYSTIC_WOLF' &&
        seat.isAlive &&
        seat.id !== self.playerId &&
        !WOLF_PACK_ROLES.has(seat.role)
      );
    }

    if (activeNightMode === 'WHITE_WOLF_KILL') {
      return (
        self.role === 'WHITE_WOLF' &&
        room.nightNumber % 2 === 0 &&
        seat.isAlive &&
        seat.id !== self.playerId &&
        WOLF_PACK_ROLES.has(seat.role)
      );
    }

    // Default Night targeting based on player's role
    if (isWolfPack) {
      return seat.isAlive && !WOLF_PACK_ROLES.has(seat.role);
    }

    if (self.role === 'SEER') {
      return seat.isAlive && seat.id !== self.playerId;
    }

    if (self.role === 'GUARD') {
      return seat.isAlive && seat.id !== self.lastProtectedPlayerId;
    }

    if (self.role === 'ARSONIST') {
      return seat.isAlive && seat.id !== self.playerId;
    }

    return false;
  };

  const handleSeatClick = (seat: SanitizedPlayerState) => {
    if (!canTargetSeat(seat) || !self) return;

    if (isHunterActive && isSelfHunter) {
      onHunterShoot(seat.id);
      return;
    }

    if (isVoting) {
      const currentVote = room.dayVotes[self.playerId];
      onCastDayVote(currentVote === seat.id ? null : seat.id);
      return;
    }

    if (!isNight) return;

    if (activeNightMode === 'WITCH_POISON') {
      onSelectNightTarget({ actionType: 'WITCH_POISON', targetId: seat.id });
      return;
    }

    if (activeNightMode === 'MYSTIC_WOLF_INSPECT') {
      onSelectNightTarget({
        actionType: 'MYSTIC_WOLF_INSPECT',
        targetId: seat.id,
      });
      return;
    }

    if (activeNightMode === 'WHITE_WOLF_KILL') {
      onSelectNightTarget({
        actionType: 'WHITE_WOLF_KILL',
        targetId: seat.id,
      });
      return;
    }

    if (isWolfPack) {
      onSelectNightTarget({ actionType: 'WOLF_VOTE', targetId: seat.id });
    } else if (self.role === 'SEER') {
      onSelectNightTarget({ actionType: 'SEER_INSPECT', targetId: seat.id });
    } else if (self.role === 'GUARD') {
      onSelectNightTarget({ actionType: 'GUARD_PROTECT', targetId: seat.id });
    } else if (self.role === 'ARSONIST') {
      onSelectNightTarget({ actionType: 'ARSONIST_DOUSE', targetId: seat.id });
    }
  };

  // Precompute vote counts per seat
  const dayVoteTally: Record<string, number> = {};
  Object.values(room.dayVotes).forEach((targetId) => {
    if (targetId && targetId !== 'SKIP') {
      dayVoteTally[targetId] = (dayVoteTally[targetId] ?? 0) + 1;
    }
  });

  const wolfVoteTally: Record<string, number> = {};
  if (room.wolfVotes) {
    Object.values(room.wolfVotes).forEach((targetId) => {
      if (targetId) {
        wolfVoteTally[targetId] = (wolfVoteTally[targetId] ?? 0) + 1;
      }
    });
  }

  const isSleepingVillagerAtNight = Boolean(
    isNight &&
      selfPlayer?.isAlive &&
      self &&
      !isWolfPack &&
      self.role !== 'SEER' &&
      self.role !== 'WITCH' &&
      self.role !== 'GUARD' &&
      self.role !== 'LITTLE_GIRL' &&
      self.role !== 'ARSONIST'
  );

  const seatCircleSizeClass = isUltraDenseRing
    ? 'w-10 h-10 sm:w-12 sm:h-12 text-lg sm:text-xl'
    : isDenseRing
      ? 'w-11 h-11 sm:w-14 sm:h-14 text-xl sm:text-2xl'
      : 'w-14 h-14 sm:w-16 sm:h-16 text-2xl sm:text-3xl';

  const seatLabelWidthClass = isUltraDenseRing
    ? 'w-20 sm:w-24'
    : isDenseRing
      ? 'w-24 sm:w-28'
      : 'w-28 sm:w-32';

  return (
    <div
      className={`relative w-full ${maxWidthClass} aspect-square mx-auto my-4 flex items-center justify-center select-none overflow-visible`}
    >
      {/* Subtle geometric circle ring matching exact player placement radius */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-amber-500/15 pointer-events-none"
        style={{
          width: `${radiusPercent * 2}%`,
          height: `${radiusPercent * 2}%`,
        }}
      />

      {/* Campfire strictly pinned to mathematical center (50%, 50%) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none flex items-center justify-center">
        <div
          className={`transition-transform duration-300 ${
            isDenseRing ? 'scale-75 sm:scale-90' : 'scale-90 sm:scale-100'
          }`}
        >
          <CampfireSvg
            phase={room.phase}
            isSleepingVillager={isSleepingVillagerAtNight}
          />
        </div>
      </div>

      {/* Empty state if alone in lobby */}
      {totalPlayers === 0 && (
        <div className="absolute bottom-6 text-xs text-slate-400">
          Oyunçular gözlənilir...
        </div>
      )}

      {/* Circular Player Seats (4 to 16 players) */}
      {room.players.map((seat, idx) => {
        const angle =
          (idx / Math.max(1, totalPlayers)) * Math.PI * 2 - Math.PI / 2;
        const leftPct = 50 + radiusPercent * Math.cos(angle);
        const topPct = 50 + radiusPercent * Math.sin(angle);

        const targetable = canTargetSeat(seat);
        const isSelf = seat.id === self?.playerId;
        const knownSeerRole = self?.knownRoles?.[seat.id];
        const displayRole: RoleType | null =
          seat.role !== 'UNKNOWN'
            ? seat.role
            : knownSeerRole
              ? knownSeerRole
              : seat.revealedRole;
        const roleMeta = displayRole ? ROLE_CATALOG[displayRole] : null;

        const isWolfTarget =
          self?.currentWolfTargetId === seat.id ||
          (isWolfPack && (wolfVoteTally[seat.id] ?? 0) > 0);
        const isDayVoteTarget =
          selfPlayer && room.dayVotes[selfPlayer.id] === seat.id;

        const mysticResult = self?.mysticWolfInspections?.[seat.id];
        const isDousedBySelf = Boolean(
          seat.isAlive && self?.arsonistDousedTargetIds?.includes(seat.id)
        );
        const votesOnSeat = dayVoteTally[seat.id] ?? 0;
        const wolfVotesOnSeat = wolfVoteTally[seat.id] ?? 0;

        const showHiddenDeadLock =
          !seat.isAlive &&
          !roleMeta &&
          room.phase !== 'LOBBY' &&
          !room.config.revealDeadRoles;

        return (
          <div
            key={seat.id}
            style={{ left: `${leftPct}%`, top: `${topPct}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, delay: idx * 0.025 }}
              className="relative flex flex-col items-center group"
            >
            <div className="relative">
              {/* Day Vote Count Pill */}
              {isVoting && votesOnSeat > 0 && (
                <div className="absolute -top-2 -right-2 z-30 px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-extrabold text-[10px] shadow-md border border-amber-200">
                  🗳️ {votesOnSeat}
                </div>
              )}

              {/* Wolf Pack Vote Pill */}
              {isNight && isWolfPack && wolfVotesOnSeat > 0 && (
                <div className="absolute -top-2 -right-2 z-30 px-1.5 py-0.5 rounded-full bg-red-600 text-white font-extrabold text-[10px] shadow-md border border-red-300">
                  🐺 {wolfVotesOnSeat}
                </div>
              )}

              {/* Doused Oil Indicator for Arsonist */}
              {isDousedBySelf && (
                <div
                  className="absolute -top-2 -left-2 z-30 px-1.5 py-0.5 rounded-full bg-orange-600 text-white font-bold text-[10px] shadow-md border border-orange-300"
                  title="Benzinlənib — Alovlandır düyməsi ilə yandırıla bilər"
                >
                  🛢️
                </div>
              )}

              {/* Host Remove Bot/Player button in Lobby */}
              {room.phase === 'LOBBY' && selfPlayer?.isHost && !isSelf && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemovePlayer(seat.id);
                  }}
                  title="Oyunçunu çıxar"
                  className="absolute -top-1.5 -right-1.5 z-30 w-5 h-5 rounded-full bg-slate-800 hover:bg-red-600 border border-slate-600 text-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}

              <button
                type="button"
                disabled={!targetable}
                onClick={() => handleSeatClick(seat)}
                style={{
                  borderColor: !seat.isAlive
                    ? '#475569'
                    : isDayVoteTarget
                      ? '#f59e0b'
                      : isWolfTarget
                        ? '#ef4444'
                        : seat.color,
                }}
                className={`relative ${seatCircleSizeClass} rounded-full border-[3px] flex items-center justify-center transition-all shadow-lg ${
                  !seat.isAlive
                    ? 'bg-slate-900/90 grayscale opacity-60'
                    : isSelf
                      ? 'bg-slate-900 ring-2 ring-amber-400/70 ring-offset-2 ring-offset-slate-950'
                      : 'bg-slate-900/95'
                } ${
                  targetable
                    ? 'cursor-pointer hover:scale-110 ring-2 ring-amber-400/60 hover:ring-amber-300 animate-pulse'
                    : 'cursor-default'
                }`}
              >
                <span className={!seat.isAlive ? 'opacity-40' : ''}>
                  {seat.avatar}
                </span>

                {!seat.isAlive && (
                  <div className="absolute inset-0 rounded-full bg-slate-950/60 flex items-center justify-center">
                    <Skull className="w-5 h-5 text-red-400" />
                  </div>
                )}

                {targetable && isHunterActive && isSelfHunter && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-red-600 flex items-center justify-center border border-white">
                    <Target className="w-3 h-3 text-white" />
                  </div>
                )}

                {seat.isSpeaking && seat.isAlive && (
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center border border-slate-950 animate-bounce">
                    <Mic className="w-3 h-3 text-slate-950" />
                  </div>
                )}
              </button>
            </div>

            {/* Seat Nameplate & Secret Role / Status Badges */}
            <div
              className={`absolute top-full mt-1 left-1/2 -translate-x-1/2 ${seatLabelWidthClass} flex flex-col items-center text-center pointer-events-none`}
            >
              <div className="flex items-center justify-center gap-1 bg-slate-950/85 border border-slate-800/90 rounded-md px-1.5 py-0.5 max-w-full shadow">
                {seat.isHost && (
                  <Crown className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                )}
                <span
                  className={`font-semibold truncate ${
                    isUltraDenseRing ? 'text-[10px]' : 'text-[11px]'
                  } ${
                    !seat.isAlive
                      ? 'text-slate-400 line-through'
                      : isSelf
                        ? 'text-amber-300'
                        : 'text-slate-100'
                  }`}
                >
                  {seat.nickname}
                </span>
                {seat.isTyping && (
                  <span className="text-[9px] text-amber-400 animate-pulse">
                    ...
                  </span>
                )}
                {!seat.isConnected && !seat.isBot && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"
                    title="Əlaqə kəsilib"
                  />
                )}
              </div>

              {/* Known / Revealed Role Badge */}
              {roleMeta && (
                <div
                  className={`mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border truncate max-w-full flex items-center gap-0.5 ${roleMeta.badgeBg}`}
                >
                  <span>{roleMeta.icon}</span>
                  <span className="truncate">{roleMeta.nameAz}</span>
                </div>
              )}

              {/* Locked Dead Role Badge when revealDeadRoles === false */}
              {showHiddenDeadLock && (
                <div className="mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold border bg-slate-900/90 border-slate-700 text-slate-400 flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Gizli</span>
                </div>
              )}

              {/* Mystic Wolf Boolean Power Badge */}
              {mysticResult !== undefined && seat.isAlive && (
                <div
                  className={`mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border truncate max-w-full ${
                    mysticResult
                      ? 'bg-fuchsia-950/85 text-fuchsia-300 border-fuchsia-500/50'
                      : 'bg-slate-900/90 text-slate-300 border-slate-600/60'
                  }`}
                >
                  {mysticResult ? '✨ Güclü Rol' : '🌾 Adi Kəndli'}
                </div>
              )}
            </div>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
};
