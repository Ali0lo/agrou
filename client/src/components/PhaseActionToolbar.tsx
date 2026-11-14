import React from 'react';
import {
  AlertTriangle,
  Award,
  Crosshair,
  Eye,
  EyeOff,
  FastForward,
  FlaskConical,
  HeartPulse,
  RotateCcw,
  Skull,
  Sparkles,
  Trophy,
  Vote,
} from 'lucide-react';
import {
  NightActionPayload,
  ROLE_CATALOG,
  SanitizedRoomState,
} from '../types/game';

interface PhaseActionToolbarProps {
  room: SanitizedRoomState;
  activeNightMode: 'DEFAULT' | 'WITCH_POISON' | 'WHITE_WOLF_KILL' | null;
  onSetActiveNightMode: (
    mode: 'DEFAULT' | 'WITCH_POISON' | 'WHITE_WOLF_KILL' | null
  ) => void;
  onSubmitNightAction: (payload: NightActionPayload) => void;
  onToggleLittleGirlPeek: (peeking: boolean) => void;
  onToggleSkipDiscussion: () => void;
  onCastDayVote: (targetId: string | 'SKIP' | null) => void;
  onPlayAgain: () => void;
}

export const PhaseActionToolbar: React.FC<PhaseActionToolbarProps> = ({
  room,
  activeNightMode,
  onSetActiveNightMode,
  onSubmitNightAction,
  onToggleLittleGirlPeek,
  onToggleSkipDiscussion,
  onCastDayVote,
  onPlayAgain,
}) => {
  const self = room.self;
  const selfPlayer = room.players.find((p) => p.id === self?.playerId) ?? null;
  const isAlive = Boolean(selfPlayer?.isAlive);
  const aliveCount = room.players.filter((p) => p.isAlive).length;
  const skipThreshold = Math.floor(aliveCount / 2) + 1;

  const wolfTargetPlayer = self?.currentWolfTargetId
    ? room.players.find((p) => p.id === self.currentWolfTargetId)
    : null;

  // 1. Hunter's Revenge 15s Interrupt Banner
  if (room.hunterRevenge && !room.hunterRevenge.resolved) {
    const hunter = room.players.find(
      (p) => p.id === room.hunterRevenge?.hunterId
    );
    const isMeHunter = self?.playerId === room.hunterRevenge.hunterId;

    return (
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-600/30 via-red-900/40 to-slate-900 border-2 border-amber-400/70 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg">
            <Crosshair className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-amber-300">
              🎯 Hunter&apos;s Final Revenge (15s Window)
            </h3>
            <p className="text-xs text-slate-200">
              {isMeHunter
                ? 'Click any living player around the campfire NOW to fire your parting shot!'
                : `${hunter?.nickname ?? 'The Hunter'} is aiming their rifle before becoming a ghost...`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. GAME OVER Summary & MVP Awards
  if (room.phase === 'GAME_OVER') {
    return (
      <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/95 via-slate-950 to-slate-900 border-2 border-amber-500/50 shadow-2xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300">
              <Trophy className="w-7 h-7" />
            </div>
            <div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400">
                Match Complete — {room.winner} Victory
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white">
                {room.winReason}
              </h2>
            </div>
          </div>

          {selfPlayer?.isHost && (
            <button
              type="button"
              onClick={onPlayAgain}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition"
            >
              <RotateCcw className="w-4 h-4" /> Play Again (Same Lobby)
            </button>
          )}
        </div>

        {/* MVP Awards */}
        {room.mvpAwards.length > 0 && (
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" /> Campfire Honours &
              MVP Stats
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {room.mvpAwards.map((mvp) => {
                const roleMeta = ROLE_CATALOG[mvp.role];
                return (
                  <div
                    key={mvp.title}
                    className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-amber-300">
                        🏅 {mvp.title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleMeta.badgeBg}`}
                      >
                        {roleMeta.icon} {roleMeta.name}
                      </span>
                    </div>
                    <p className="text-sm font-black text-white">
                      {mvp.nickname}
                    </p>
                    <p className="text-xs text-slate-400">{mvp.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. NIGHT PHASE Role Controls
  if (room.phase === 'NIGHT_PHASE' && self) {
    return (
      <div className="p-3.5 rounded-2xl bg-indigo-950/60 border border-indigo-500/30 backdrop-blur-md space-y-3 shadow-xl">
        {/* Alert Banner for Wolves when Little Girl is detected spying */}
        {room.wolfAlertedThisNight &&
          (self.role === 'WEREWOLF' ||
            self.role === 'BLACK_WOLF' ||
            self.role === 'WHITE_WOLF') && (
            <div className="px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-200 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                👀 Rustling in the bushes! Someone (Little Girl) has been
                peeking at the Werewolf pack tonight!
              </span>
            </div>
          )}

        {!isAlive ? (
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>
              👻 Spectator Mode — You can see all roles and watch the night
              unfold.
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Role-Specific Night Controls */}
            {self.role === 'WITCH' && self.witchPotions && (
              <div className="w-full flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-200">
                  <span className="font-bold text-fuchsia-300">
                    🧪 Witch&apos;s Apothecary:
                  </span>{' '}
                  {wolfTargetPlayer ? (
                    <span>
                      Werewolves are attacking{' '}
                      <strong className="text-rose-400">
                        {wolfTargetPlayer.nickname}
                      </strong>
                      !
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      Waiting for Werewolves to lock a victim...
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={
                      !self.witchPotions.healAvailable || !wolfTargetPlayer
                    }
                    onClick={() =>
                      onSubmitNightAction({ actionType: 'WITCH_HEAL' })
                    }
                    className="px-3 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 disabled:opacity-40 border border-emerald-400/50 text-emerald-200 text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <HeartPulse className="w-3.5 h-3.5" />
                    <span>
                      {self.witchPotions.healAvailable
                        ? `Heal Potion (${
                            wolfTargetPlayer
                              ? `Save ${wolfTargetPlayer.nickname}`
                              : 'No Victim'
                          })`
                        : 'Heal Used'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={!self.witchPotions.poisonAvailable}
                    onClick={() =>
                      onSetActiveNightMode(
                        activeNightMode === 'WITCH_POISON'
                          ? 'DEFAULT'
                          : 'WITCH_POISON'
                      )
                    }
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
                      activeNightMode === 'WITCH_POISON'
                        ? 'bg-fuchsia-600 text-white border-fuchsia-300 shadow-lg'
                        : 'bg-fuchsia-600/25 hover:bg-fuchsia-600/40 border-fuchsia-400/40 text-fuchsia-200 disabled:opacity-40'
                    }`}
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    <span>
                      {self.witchPotions.poisonAvailable
                        ? activeNightMode === 'WITCH_POISON'
                          ? 'Click a Seat to Poison (Cancel)'
                          : 'Use Poison Potion'
                        : 'Poison Used'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {self.role === 'BLACK_WOLF' && (
              <div className="w-full flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-200">
                  <span className="font-bold text-red-400">
                    🖤 Black Wolf Pack & Infection:
                  </span>{' '}
                  Click a player to vote with the pack.{' '}
                  {wolfTargetPlayer && (
                    <span>
                      Current pack victim:{' '}
                      <strong className="text-amber-300">
                        {wolfTargetPlayer.nickname}
                      </strong>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={
                    !self.blackWolfInfectionAvailable || !wolfTargetPlayer
                  }
                  onClick={() =>
                    onSubmitNightAction({ actionType: 'BLACK_WOLF_INFECT' })
                  }
                  className="px-3.5 py-1.5 rounded-xl bg-red-600/35 hover:bg-red-600/55 disabled:opacity-40 border border-red-400/50 text-red-100 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {self.blackWolfInfectionAvailable
                      ? self.nightActionSummary
                        ? 'Cancel Infection'
                        : `Infect ${
                            wolfTargetPlayer?.nickname ?? 'Victim'
                          } (1x per game)`
                      : 'Infection Already Used'}
                  </span>
                </button>
              </div>
            )}

            {self.role === 'WHITE_WOLF' && (
              <div className="w-full flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-200">
                  <span className="font-bold text-indigo-300">
                    🐻‍❄️ White Wolf:
                  </span>{' '}
                  Vote with the pack, and on even nights you may secretly kill a
                  fellow Werewolf.
                </div>

                <button
                  type="button"
                  disabled={room.nightNumber % 2 !== 0}
                  onClick={() =>
                    onSetActiveNightMode(
                      activeNightMode === 'WHITE_WOLF_KILL'
                        ? 'DEFAULT'
                        : 'WHITE_WOLF_KILL'
                    )
                  }
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
                    activeNightMode === 'WHITE_WOLF_KILL'
                      ? 'bg-indigo-500 text-slate-950 border-indigo-200'
                      : 'bg-indigo-500/25 hover:bg-indigo-500/40 border-indigo-400/40 text-indigo-200 disabled:opacity-40'
                  }`}
                >
                  <Skull className="w-3.5 h-3.5" />
                  <span>
                    {room.nightNumber % 2 === 0
                      ? activeNightMode === 'WHITE_WOLF_KILL'
                        ? 'Click a Fellow Wolf to Betray (Cancel)'
                        : 'Betray Fellow Wolf (Night ' + room.nightNumber + ')'
                      : 'Solo Betrayal Unlocks Next Night (Even Nights)'}
                  </span>
                </button>
              </div>
            )}

            {self.role === 'LITTLE_GIRL' && (
              <div className="w-full flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onToggleLittleGirlPeek(!self.isPeeking)}
                    className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
                      self.isPeeking
                        ? 'bg-teal-500 text-slate-950 border-teal-200 shadow-[0_0_20px_rgba(20,184,166,0.5)]'
                        : 'bg-teal-500/20 hover:bg-teal-500/35 border-teal-400/40 text-teal-200'
                    }`}
                  >
                    {self.isPeeking ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" /> Stop Peeking
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" /> Peek at Werewolf Chat
                      </>
                    )}
                  </button>
                  <span className="text-xs text-slate-300">
                    {self.isPeeking
                      ? 'Spying on the Wolf Pack tab! Watch your exposure gauge...'
                      : 'Toggle Peek to read anonymized Wolf messages.'}
                  </span>
                </div>

                {/* Little Girl Exposure Warning Bar */}
                <div className="flex items-center gap-2 min-w-[180px]">
                  <span className="text-[11px] font-bold text-amber-300">
                    Exposure: {self.exposureLevel}%
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        self.exposureLevel > 60
                          ? 'bg-rose-500'
                          : self.exposureLevel > 30
                          ? 'bg-amber-400'
                          : 'bg-teal-400'
                      }`}
                      style={{ width: `${self.exposureLevel}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {(self.role === 'SEER' ||
              self.role === 'GUARD' ||
              self.role === 'WEREWOLF' ||
              self.role === 'VILLAGER' ||
              self.role === 'HUNTER' ||
              self.role === 'ANGEL') && (
              <div className="text-xs text-indigo-200 flex items-center gap-2">
                <span>{ROLE_CATALOG[self.role].icon}</span>
                <span>
                  {self.role === 'SEER'
                    ? 'Click a player seat around the campfire to inspect their true role.'
                    : self.role === 'GUARD'
                    ? 'Click a player seat around the campfire to protect them from Werewolves tonight.'
                    : self.role === 'WEREWOLF'
                    ? 'Coordinate in the Wolf Pack chat and click a villager seat to vote on tonight\'s victim.'
                    : 'Rest quietly by the sleeping fire while special roles act in the shadows...'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // 4. DAWN SUMMARY Banner
  if (room.phase === 'DAWN_SUMMARY') {
    return (
      <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 backdrop-blur-md space-y-2 shadow-xl">
        {self?.wasInfectedToWolf && (
          <div className="px-3 py-2 rounded-xl bg-red-600/30 border border-red-400/60 text-red-100 text-xs font-bold">
            🐺 You were infected by the Black Wolf in the night! You are now a
            member of the Werewolf Pack!
          </div>
        )}
        {room.lastNightCasualties.length === 0 ? (
          <p className="text-sm font-bold text-amber-200">
            🌅 The sun rises over a peaceful campfire—nobody died last night!
          </p>
        ) : (
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-rose-300">
              🌅 Dawn Casualties Revealed
            </p>
            <div className="flex flex-wrap gap-2">
              {room.lastNightCasualties.map((c) => (
                <div
                  key={c.playerId}
                  className="px-3 py-1.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-xs text-rose-100 flex items-center gap-2"
                >
                  <Skull className="w-3.5 h-3.5 text-rose-400" />
                  <span>
                    <strong>{c.nickname}</strong> was eliminated — Role:{' '}
                    <strong className="text-amber-300">
                      {ROLE_CATALOG[c.role].icon} {ROLE_CATALOG[c.role].name}
                    </strong>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 5. DAY DISCUSSION Toolbar ("End Discussion Early" >50% skip vote)
  if (room.phase === 'DAY_DISCUSSION') {
    const hasVotedSkip = Boolean(
      self && room.skipDiscussionVotes.includes(self.playerId)
    );

    return (
      <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-amber-500/30 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="text-xs text-slate-200">
          <span className="font-bold text-amber-300">
            ☀️ Day {room.dayNumber} Discussion:
          </span>{' '}
          Debate who is lying around the campfire before the tribunal vote begins.
        </div>

        {isAlive && (
          <button
            type="button"
            onClick={onToggleSkipDiscussion}
            className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
              hasVotedSkip
                ? 'bg-amber-500 text-slate-950 border-amber-200 shadow'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200'
            }`}
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>
              End Discussion Early ({room.skipDiscussionVotes.length}/
              {skipThreshold} needed)
            </span>
          </button>
        )}
      </div>
    );
  }

  // 6. DAY VOTING Toolbar ("Skip Vote" button)
  if (room.phase === 'DAY_VOTING') {
    const myVote = self ? room.dayVotes[self.playerId] : null;
    const skipVotesCount = Object.values(room.dayVotes).filter(
      (v) => v === 'SKIP'
    ).length;

    return (
      <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/40 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="text-xs text-slate-200 flex items-center gap-2">
          <Vote className="w-4 h-4 text-rose-400" />
          <span>
            <strong>Day {room.dayNumber} Tribunal Vote:</strong> Click a suspect
            around the campfire to cast your vote. Ties result in no elimination!
          </span>
        </div>

        {isAlive && (
          <button
            type="button"
            onClick={() =>
              onCastDayVote(myVote === 'SKIP' ? null : 'SKIP')
            }
            className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition ${
              myVote === 'SKIP'
                ? 'bg-amber-400 text-slate-950 border-amber-200 shadow'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200'
            }`}
          >
            Skip Vote ({skipVotesCount})
          </button>
        )}
      </div>
    );
  }

  // 7. EXECUTION REVEAL Banner
  if (room.phase === 'EXECUTION_REVEAL') {
    return (
      <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/50 backdrop-blur-md shadow-xl">
        {room.lastExecutedPlayer ? (
          <div className="flex items-center gap-3 text-xs sm:text-sm text-rose-100">
            <Skull className="w-5 h-5 text-rose-400 shrink-0" />
            <span>
              ⚖️ The village executed{' '}
              <strong>{room.lastExecutedPlayer.nickname}</strong>! Their role was{' '}
              <strong className="text-amber-300">
                {ROLE_CATALOG[room.lastExecutedPlayer.role].icon}{' '}
                {ROLE_CATALOG[room.lastExecutedPlayer.role].name}
              </strong>
              .
            </span>
          </div>
        ) : (
          <p className="text-sm font-bold text-amber-200">
            ⚖️ The vote ended in a tie or skip — no one was executed today!
          </p>
        )}
      </div>
    );
  }

  return null;
};
