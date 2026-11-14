import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Award,
  Crown,
  Eye,
  Heart,
  Lock,
  Mic,
  Shield,
  Skull,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';
import {
  ActiveNightSubMode,
  NightActionPayload,
  ROLE_CATALOG,
  RoleType,
  SanitizedPlayerState,
  SanitizedRoomState,
} from '../types/game';
import { CampfireSvg } from './CampfireSvg';
import { soundEngine } from '../services/soundEngine';

interface CampfireArenaProps {
  room: SanitizedRoomState;
  activeNightMode: ActiveNightSubMode;
  onSelectNightTarget: (payload: NightActionPayload) => void;
  onCastDayVote: (targetId: string | 'SKIP' | null) => void;
  onHunterShoot: (targetId: string) => void;
  onRemovePlayer: (playerId: string) => void;
}

export const CampfireArena: React.FC<CampfireArenaProps> = ({
  room,
  activeNightMode,
  onSelectNightTarget,
  onCastDayVote,
  onHunterShoot,
  onRemovePlayer,
}) => {
  const [firstCupidTargetId, setFirstCupidTargetId] = useState<string | null>(
    null
  );

  const self = room.self;
  const selfPlayer = room.players.find((p) => p.id === self?.playerId) ?? null;
  const isNight = room.phase === 'NIGHT_PHASE';
  const isDayVoting = room.phase === 'DAY_VOTING';
  const isHunterTurn =
    room.hunterRevenge !== null &&
    !room.hunterRevenge.resolved &&
    room.hunterRevenge.hunterId === self?.playerId;

  const isWolfSelf =
    self?.role === 'WEREWOLF' ||
    self?.role === 'BIG_BAD_WOLF' ||
    self?.role === 'BLACK_WOLF' ||
    self?.role === 'WOLF_SEER' ||
    self?.role === 'WHITE_WOLF';

  const isSleepingVillager =
    isNight &&
    Boolean(selfPlayer?.isAlive) &&
    (self?.role === 'VILLAGER' ||
      self?.role === 'ANGEL' ||
      self?.role === 'JESTER' ||
      self?.role === 'ELDER' ||
      self?.role === 'MAYOR' ||
      self?.role === 'HUNTER');

  // Count day votes per candidate (including Mayor 2x weight & Crow +2 curse)
  const dayVoteCountByTarget: Record<string, number> = {};
  if (room.crowCursedPlayerId) {
    dayVoteCountByTarget[room.crowCursedPlayerId] = 2;
  }
  for (const [voterId, target] of Object.entries(room.dayVotes)) {
    if (target && target !== 'SKIP') {
      const voter = room.players.find((p) => p.id === voterId);
      const weight =
        !room.villagePowersLost && voter?.isMayor ? 2 : 1;
      dayVoteCountByTarget[target] =
        (dayVoteCountByTarget[target] ?? 0) + weight;
    }
  }

  // Count wolf votes per candidate
  const wolfVoteCountByTarget: Record<string, number> = {};
  if (room.wolfVotes) {
    for (const target of Object.values(room.wolfVotes)) {
      if (target) {
        wolfVoteCountByTarget[target] =
          (wolfVoteCountByTarget[target] ?? 0) + 1;
      }
    }
  }

  const totalPlayers = Math.max(room.players.length, 1);
  const radiusPercent = 38; // Responsive percentage radius from (50%, 50%) center

  const canTargetSeat = (
    seat: SanitizedPlayerState
  ): {
    selectable: boolean;
    actionLabel: string | null;
    disabledReason?: string;
  } => {
    // Special case: Medium (Ruhçağıran) inspects DEAD players at night!
    if (
      isNight &&
      selfPlayer?.isAlive &&
      self?.role === 'MEDIUM' &&
      !room.villagePowersLost
    ) {
      if (!seat.isAlive && !self.hasSubmittedNightAction) {
        return { selectable: true, actionLabel: 'Ruhu Yoxla 👻' };
      }
      return { selectable: false, actionLabel: null };
    }

    if (!seat.isAlive) {
      return { selectable: false, actionLabel: null };
    }

    // 1. Hunter's 15-second Revenge Shot
    if (isHunterTurn && seat.id !== self?.playerId) {
      return { selectable: true, actionLabel: 'Vur 🎯' };
    }

    // 2. Day Voting
    if (isDayVoting && selfPlayer?.isAlive) {
      const myCurrentVote = self ? room.dayVotes[self.playerId] : null;
      return {
        selectable: true,
        actionLabel: myCurrentVote === seat.id ? 'Səs verildi ✓' : 'Səs ver ⚖️',
      };
    }

    // 3. Night Phase Actions
    if (isNight && selfPlayer?.isAlive && self) {
      // Witch Poison mode override
      if (
        self.role === 'WITCH' &&
        !room.villagePowersLost &&
        activeNightMode === 'WITCH_POISON' &&
        self.witchPotions?.poisonAvailable
      ) {
        return { selectable: true, actionLabel: 'Zəhərlə 🧪' };
      }

      // White Wolf Betrayal mode override (even nights only)
      if (
        self.role === 'WHITE_WOLF' &&
        activeNightMode === 'WHITE_WOLF_KILL' &&
        room.nightNumber % 2 === 0
      ) {
        const isTargetFellowWolf =
          seat.id !== self.playerId &&
          (seat.role === 'WEREWOLF' ||
            seat.role === 'BIG_BAD_WOLF' ||
            seat.role === 'BLACK_WOLF' ||
            seat.role === 'WOLF_SEER');
        if (isTargetFellowWolf) {
          return { selectable: true, actionLabel: 'Xəyanət 🐻‍❄️' };
        }
        return { selectable: false, actionLabel: null };
      }

      // Big Bad Wolf extra attack mode
      if (
        self.role === 'BIG_BAD_WOLF' &&
        activeNightMode === 'BIG_BAD_WOLF_KILL' &&
        self.canBigBadWolfKill
      ) {
        const isTargetWolf =
          seat.role === 'WEREWOLF' ||
          seat.role === 'BIG_BAD_WOLF' ||
          seat.role === 'BLACK_WOLF' ||
          seat.role === 'WOLF_SEER';
        if (!isTargetWolf) {
          return { selectable: true, actionLabel: '2-ci Qurban 🐾' };
        }
        return { selectable: false, actionLabel: null };
      }

      // Wolf Seer inspect mode
      if (
        self.role === 'WOLF_SEER' &&
        activeNightMode === 'WOLF_SEER_INSPECT' &&
        !self.hasSubmittedNightAction
      ) {
        if (seat.id !== self.playerId) {
          return { selectable: true, actionLabel: 'Yoxla 👁️‍🗨️' };
        }
        return { selectable: false, actionLabel: null };
      }

      // Standard Wolf Pack Vote
      if (isWolfSelf) {
        const myWolfVote = room.wolfVotes?.[self.playerId];
        return {
          selectable: true,
          actionLabel: myWolfVote === seat.id ? 'Hədəfdə 🐺' : 'Parçala 🐺',
        };
      }

      // Seer Inspect
      if (
        self.role === 'SEER' &&
        !room.villagePowersLost &&
        seat.id !== self.playerId
      ) {
        if (self.hasSubmittedNightAction) {
          return { selectable: false, actionLabel: null };
        }
        return { selectable: true, actionLabel: 'Yoxla 🔮' };
      }

      // Fox Sniff (checks target + left/right neighbors)
      if (
        self.role === 'FOX' &&
        !room.villagePowersLost &&
        !self.foxPowerLost
      ) {
        if (self.hasSubmittedNightAction) {
          return { selectable: false, actionLabel: null };
        }
        return { selectable: true, actionLabel: 'İylə (3 nəfər) 🦊' };
      }

      // Guard Protect
      if (self.role === 'GUARD' && !room.villagePowersLost) {
        if (self.lastProtectedPlayerId === seat.id) {
          return {
            selectable: false,
            actionLabel: null,
            disabledReason: 'Keçən gecə qorunub',
          };
        }
        return { selectable: true, actionLabel: 'Qoru 🛡️' };
      }

      // Crow Curse (+2 votes)
      if (
        self.role === 'CROW' &&
        !room.villagePowersLost &&
        seat.id !== self.playerId
      ) {
        return { selectable: true, actionLabel: 'Lənətlə (+2) 🐦‍⬛' };
      }

      // Cupid Link (Night 1)
      if (self.role === 'CUPID' && room.nightNumber === 1) {
        if (firstCupidTargetId === seat.id) {
          return { selectable: true, actionLabel: '1-ci Aşiq ✓' };
        }
        return {
          selectable: true,
          actionLabel: firstCupidTargetId ? '2-ci Aşiqi seç 💘' : '1-ci Aşiqi seç 💘',
        };
      }

      // Wild Child Role Model (Night 1)
      if (
        self.role === 'WILD_CHILD' &&
        room.nightNumber === 1 &&
        !self.roleModelId &&
        seat.id !== self.playerId
      ) {
        return { selectable: true, actionLabel: 'Kumir seç 🐾' };
      }

      // Serial Killer Night Kill
      if (self.role === 'SERIAL_KILLER' && seat.id !== self.playerId) {
        return { selectable: true, actionLabel: 'Qətlə yetir 🗡️' };
      }
    }

    return { selectable: false, actionLabel: null };
  };

  const handleSeatClick = (seat: SanitizedPlayerState) => {
    const check = canTargetSeat(seat);
    if (!check.selectable || !self) return;

    soundEngine.play('CLICK');

    if (isHunterTurn) {
      onHunterShoot(seat.id);
      return;
    }

    if (isDayVoting) {
      const currentVote = room.dayVotes[self.playerId];
      onCastDayVote(currentVote === seat.id ? null : seat.id);
      return;
    }

    if (isNight) {
      if (self.role === 'MEDIUM' && !seat.isAlive) {
        onSelectNightTarget({
          actionType: 'MEDIUM_INSPECT',
          targetId: seat.id,
        });
        return;
      }

      if (self.role === 'WITCH' && activeNightMode === 'WITCH_POISON') {
        onSelectNightTarget({
          actionType: 'WITCH_POISON',
          targetId: seat.id,
        });
        return;
      }

      if (
        self.role === 'WHITE_WOLF' &&
        activeNightMode === 'WHITE_WOLF_KILL'
      ) {
        onSelectNightTarget({
          actionType: 'WHITE_WOLF_KILL',
          targetId: seat.id,
        });
        return;
      }

      if (
        self.role === 'BIG_BAD_WOLF' &&
        activeNightMode === 'BIG_BAD_WOLF_KILL'
      ) {
        onSelectNightTarget({
          actionType: 'BIG_BAD_WOLF_KILL',
          targetId: seat.id,
        });
        return;
      }

      if (
        self.role === 'WOLF_SEER' &&
        activeNightMode === 'WOLF_SEER_INSPECT'
      ) {
        onSelectNightTarget({
          actionType: 'WOLF_SEER_INSPECT',
          targetId: seat.id,
        });
        return;
      }

      if (isWolfSelf) {
        onSelectNightTarget({
          actionType: 'WOLF_VOTE',
          targetId: seat.id,
        });
        return;
      }

      if (self.role === 'SEER') {
        onSelectNightTarget({
          actionType: 'SEER_INSPECT',
          targetId: seat.id,
        });
        return;
      }

      if (self.role === 'FOX') {
        onSelectNightTarget({
          actionType: 'FOX_SNIFF',
          targetId: seat.id,
        });
        return;
      }

      if (self.role === 'GUARD') {
        onSelectNightTarget({
          actionType: 'GUARD_PROTECT',
          targetId: seat.id,
        });
        return;
      }

      if (self.role === 'CROW') {
        onSelectNightTarget({
          actionType: 'CROW_CURSE',
          targetId: seat.id,
        });
        return;
      }

      if (self.role === 'CUPID') {
        if (!firstCupidTargetId) {
          setFirstCupidTargetId(seat.id);
        } else if (firstCupidTargetId === seat.id) {
          setFirstCupidTargetId(null);
        } else {
          onSelectNightTarget({
            actionType: 'CUPID_LINK',
            targetId: firstCupidTargetId,
            secondTargetId: seat.id,
          });
          setFirstCupidTargetId(null);
        }
        return;
      }

      if (self.role === 'WILD_CHILD') {
        onSelectNightTarget({
          actionType: 'WILD_CHILD_MODEL',
          targetId: seat.id,
        });
        return;
      }

      if (self.role === 'SERIAL_KILLER') {
        onSelectNightTarget({
          actionType: 'SERIAL_KILLER_KILL',
          targetId: seat.id,
        });
      }
    }
  };

  const getDisplayRoleForSeat = (
    seat: SanitizedPlayerState
  ): RoleType | null => {
    if (seat.role !== 'UNKNOWN') return seat.role;
    if (seat.revealedRole) return seat.revealedRole;
    if (self?.knownRoles[seat.id]) return self.knownRoles[seat.id];
    return null;
  };

  return (
    <div className="relative w-full max-w-[680px] aspect-square mx-auto flex items-center justify-center">
      {/* Concentric Campfire Circle Guides centered strictly at (50%, 50%) */}
      <div
        className={`absolute inset-6 rounded-full border transition-colors duration-1000 pointer-events-none ${
          isNight
            ? 'border-indigo-500/20 bg-indigo-950/25 shadow-[inset_0_0_80px_rgba(30,27,75,0.6)]'
            : 'border-amber-500/20 bg-amber-950/15 shadow-[inset_0_0_80px_rgba(120,53,15,0.35)]'
        }`}
      />
      <div
        className="absolute rounded-full border border-dashed border-slate-700/35 pointer-events-none"
        style={{
          width: `${radiusPercent * 2}%`,
          height: `${radiusPercent * 2}%`,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Central Campfire Strictly Anchored at Mathematical Center (50%, 50%) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
        <CampfireSvg
          phase={room.phase}
          isSleepingVillager={isSleepingVillager}
        />
      </div>

      {/* Radial Player Seats Positioned via Exact Trigonometry Around (50%, 50%) */}
      {room.players.map((seat, index) => {
        const angle = (2 * Math.PI * index) / totalPlayers - Math.PI / 2; // Start at 12 o'clock
        const x = 50 + radiusPercent * Math.cos(angle);
        const y = 50 + radiusPercent * Math.sin(angle);

        const isSelf = seat.id === self?.playerId;
        const knownRole = getDisplayRoleForSeat(seat);
        const roleMeta = knownRole ? ROLE_CATALOG[knownRole] : null;
        const isDeadRoleHidden =
          !seat.isAlive &&
          !knownRole &&
          room.config.revealDeadRoles === false &&
          room.phase !== 'GAME_OVER';

        const targetInfo = canTargetSeat(seat);
        const dayVotes = dayVoteCountByTarget[seat.id] ?? 0;
        const wolfVotes = wolfVoteCountByTarget[seat.id] ?? 0;
        const isWolfTargetUnderAttack =
          isNight && self?.currentWolfTargetId === seat.id;
        const isMyDayVote =
          isDayVoting && self && room.dayVotes[self.playerId] === seat.id;

        return (
          <div
            key={seat.id}
            style={{ left: `${x}%`, top: `${y}%` }}
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.75 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="relative flex flex-col items-center group"
            >
              {/* Floating Top Status Indicators (positioned above avatar so avatar center stays at exact x%, y%) */}
              <div className="absolute bottom-full mb-1.5 flex items-center gap-1 whitespace-nowrap pointer-events-none">
                {seat.isSpeaking && seat.isAlive && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/90 text-slate-950 text-[10px] font-bold flex items-center gap-0.5 shadow animate-pulse">
                    <Mic className="w-2.5 h-2.5" /> Voice
                  </span>
                )}
                {seat.isTyping && seat.isAlive && (
                  <span className="px-2 py-0.5 rounded-full bg-slate-800/95 border border-slate-600 text-[10px] text-slate-200 flex items-center gap-1 shadow">
                    <span className="w-1 h-1 rounded-full bg-amber-400 animate-bounce" />
                    <span className="w-1 h-1 rounded-full bg-amber-400 animate-bounce [animation-delay:0.15s]" />
                    <span className="w-1 h-1 rounded-full bg-amber-400 animate-bounce [animation-delay:0.3s]" />
                  </span>
                )}
                {isWolfTargetUnderAttack && (
                  <span className="px-2 py-0.5 rounded-full bg-red-600/90 text-white text-[10px] font-bold flex items-center gap-1 shadow-lg animate-pulse">
                    <Target className="w-2.5 h-2.5" /> Sürü Hədəfi
                  </span>
                )}
                {seat.isCrowCursed && seat.isAlive && (
                  <span className="px-1.5 py-0.5 rounded-full bg-violet-600/90 text-white text-[9px] font-bold shadow">
                    🐦‍⬛ +2 Səs
                  </span>
                )}
                {targetInfo.disabledReason && (
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-800/90 border border-slate-600 text-[9px] text-slate-400 flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" /> {targetInfo.disabledReason}
                  </span>
                )}
              </div>

              {/* Avatar Circle Seat (Strictly centered on the trigonometric ring) */}
              <div className="relative">
                <button
                  type="button"
                  disabled={!targetInfo.selectable}
                  onClick={() => handleSeatClick(seat)}
                  className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-200 ${
                    !seat.isAlive
                      ? targetInfo.selectable
                        ? 'bg-indigo-950/90 border-2 border-indigo-400 cursor-pointer ring-2 ring-indigo-400 hover:scale-110'
                        : 'bg-slate-900/90 border-2 border-slate-700 grayscale opacity-75 cursor-default'
                      : targetInfo.selectable
                      ? 'cursor-pointer ring-2 ring-amber-400/80 hover:scale-110 hover:ring-4 hover:ring-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.35)]'
                      : 'cursor-default'
                  } ${
                    isSelf
                      ? 'ring-2 ring-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.4)]'
                      : ''
                  } ${
                    seat.isSpeaking && seat.isAlive
                      ? 'ring-4 ring-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.6)]'
                      : ''
                  }`}
                  style={{
                    backgroundColor: seat.isAlive
                      ? `${seat.color}28`
                      : undefined,
                    borderColor: seat.isAlive ? seat.color : undefined,
                    borderWidth: '2px',
                  }}
                >
                  {seat.isAlive ? (
                    <span className="text-2xl sm:text-3xl select-none">
                      {seat.avatar}
                    </span>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Skull className="w-6 h-6 text-rose-400/80" />
                      <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">
                        RIP
                      </span>
                    </div>
                  )}

                  {/* Host Crown */}
                  {seat.isHost && (
                    <span
                      title="Otaq Sahibi (Host)"
                      className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow"
                    >
                      <Crown className="w-3 h-3" />
                    </span>
                  )}

                  {/* Mayor / Sheriff Badge */}
                  {seat.isMayor && seat.isAlive && (
                    <span
                      title="Şerif / Bələdiyyə Başçısı (2x Səs)"
                      className="absolute -bottom-1.5 -left-1.5 w-5 h-5 rounded-full bg-yellow-400 text-slate-950 flex items-center justify-center shadow"
                    >
                      <Award className="w-3 h-3" />
                    </span>
                  )}

                  {/* Lovers Heart Badge */}
                  {seat.isLoverWithSelf && (
                    <span
                      title="Aşiq (Lover)"
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-pink-500 text-white flex items-center justify-center shadow"
                    >
                      <Heart className="w-3 h-3 fill-current" />
                    </span>
                  )}

                  {/* Connection Status Dot */}
                  <span
                    title={seat.isConnected ? 'Onlayn' : 'Bağlantı kəsilib'}
                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-950 ${
                      seat.isConnected ? 'bg-emerald-400' : 'bg-rose-500'
                    }`}
                  />
                </button>

                {/* Host Remove Bot/Player Button in Lobby */}
                {room.phase === 'LOBBY' &&
                  selfPlayer?.isHost &&
                  !isSelf && (
                    <button
                      type="button"
                      onClick={() => onRemovePlayer(seat.id)}
                      title={`Sil: ${seat.nickname}`}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}

                {/* Live Day Vote Tally Badge */}
                {dayVotes > 0 && (
                  <div
                    className={`absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-xs font-extrabold shadow-lg border ${
                      isMyDayVote
                        ? 'bg-amber-400 text-slate-950 border-amber-200'
                        : 'bg-rose-600 text-white border-rose-400'
                    }`}
                  >
                    {dayVotes} ⚖️
                  </div>
                )}

                {/* Live Wolf Pack Vote Badge */}
                {isNight && wolfVotes > 0 && (
                  <div className="absolute -bottom-1 -left-2 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold border border-red-300 shadow">
                    {wolfVotes} 🐺
                  </div>
                )}
              </div>

              {/* Floating Bottom Name & Role Label (positioned below avatar so avatar center stays at exact x%, y%) */}
              <div className="absolute top-full mt-1.5 flex flex-col items-center w-32 pointer-events-auto">
                <div className="px-2 py-0.5 rounded-md bg-slate-950/90 border border-slate-800 text-xs font-semibold text-slate-100 truncate max-w-full flex items-center gap-1 shadow">
                  <span className="truncate">{seat.nickname}</span>
                  {isSelf && (
                    <span className="text-[10px] text-orange-400 font-bold">
                      (Sən)
                    </span>
                  )}
                </div>

                {/* Role Pill (Shown if Self, Fellow Wolf, Sisters, Seer/Medium-Inspected, Revealed Dead, or Game Over) */}
                {roleMeta ? (
                  <div
                    className={`mt-0.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold flex items-center gap-1 shadow-sm whitespace-nowrap ${roleMeta.badgeBg}`}
                  >
                    <span>{roleMeta.icon}</span>
                    <span>{roleMeta.nameAz}</span>
                    {self?.knownRoles[seat.id] && !isSelf && (
                      <Eye className="w-2.5 h-2.5 text-purple-300" />
                    )}
                  </div>
                ) : isDeadRoleHidden ? (
                  <div className="mt-0.5 px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900/90 text-[10px] font-semibold text-slate-400 flex items-center gap-1 shadow-sm whitespace-nowrap">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Rolu gizlidir 🔒</span>
                  </div>
                ) : null}

                {/* Interactive Action Call-to-Action Button */}
                {targetInfo.selectable && targetInfo.actionLabel && (
                  <button
                    type="button"
                    onClick={() => handleSeatClick(seat)}
                    className="mt-1 px-2.5 py-0.5 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] shadow-md transition transform hover:scale-105 flex items-center gap-1 whitespace-nowrap"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    {targetInfo.actionLabel}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        );
      })}

      {/* Bottom Legend for Night Action Summary */}
      {isNight && self?.nightActionSummary && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-full bg-indigo-950/90 border border-indigo-400/40 text-xs text-indigo-200 flex items-center gap-2 shadow-xl">
          <Shield className="w-3.5 h-3.5 text-indigo-300" />
          <span>{self.nightActionSummary}</span>
        </div>
      )}
    </div>
  );
};
