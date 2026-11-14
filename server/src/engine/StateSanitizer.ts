import {
  RoomState,
  SanitizedPlayerState,
  SanitizedRoomState,
  SanitizedSelfSecretState,
  VisibleFaction,
  VisibleRoleType,
} from '../types/game.js';
import {
  computeConsensusWolfTarget,
  isWolfPackRole,
} from './roles/RoleStrategy.js';

/**
 * Sanitizes the authoritative RoomState for a specific player to prevent cheating.
 *
 * Strips hidden roles from other players, sending `role: "UNKNOWN"` unless:
 * 1. The target is the requesting player themselves.
 * 2. Both players are Werewolves (Werewolves can see each other; White Wolf appears as WEREWOLF to fellow wolves).
 * 3. The game has ended (`phase === 'GAME_OVER'`).
 * 4. The requesting player is dead (Spectator mode).
 */
export function sanitizeStateForPlayer(
  roomState: RoomState,
  playerId: string
): SanitizedRoomState {
  const viewer = roomState.players.find((p) => p.id === playerId) ?? null;
  const isGameOver = roomState.phase === 'GAME_OVER';
  const isViewerDeadSpectator = viewer !== null && !viewer.isAlive && roomState.phase !== 'LOBBY';
  const isViewerWolf = viewer !== null && isWolfPackRole(viewer.role);

  const sanitizedPlayers: SanitizedPlayerState[] = roomState.players.map((target) => {
    const isSelf = viewer !== null && target.id === viewer.id;
    const bothAreWolves = isViewerWolf && isWolfPackRole(target.role);

    let visibleRole: VisibleRoleType = 'UNKNOWN';
    let visibleFaction: VisibleFaction = 'UNKNOWN';

    if (isSelf || isGameOver || isViewerDeadSpectator) {
      visibleRole = target.role;
      visibleFaction = target.faction;
    } else if (bothAreWolves) {
      // White Wolf appears as a normal Werewolf to other Wolves during the match
      visibleRole = target.role === 'WHITE_WOLF' ? 'WEREWOLF' : target.role;
      visibleFaction = 'WEREWOLF';
    }

    return {
      id: target.id,
      nickname: target.nickname,
      avatar: target.avatar,
      color: target.color,
      seatIndex: target.seatIndex,
      isHost: target.isHost,
      isBot: target.isBot,
      isConnected: target.isConnected,
      isAlive: target.isAlive,
      role: visibleRole,
      faction: visibleFaction,
      revealedRole: !target.isAlive || isGameOver ? target.revealedRole ?? target.role : null,
      deathReason: target.deathReason,
      isSpeaking: target.isSpeaking,
      isTyping: target.isTyping,
    };
  });

  const consensusWolfTargetId = computeConsensusWolfTarget(roomState);

  let selfSecret: SanitizedSelfSecretState | null = null;
  if (viewer) {
    const canSeeWolfVictim =
      roomState.phase === 'NIGHT_PHASE' &&
      viewer.isAlive &&
      (isWolfPackRole(viewer.role) || viewer.role === 'WITCH');

    let nightActionSummary: string | null = null;
    if (roomState.phase === 'NIGHT_PHASE') {
      if (viewer.role === 'GUARD' && roomState.nightActions.guardTargetId) {
        const t = roomState.players.find((p) => p.id === roomState.nightActions.guardTargetId);
        nightActionSummary = t ? `Protecting ${t.nickname}` : null;
      } else if (viewer.role === 'SEER' && roomState.nightActions.seerTargetId) {
        const t = roomState.players.find((p) => p.id === roomState.nightActions.seerTargetId);
        nightActionSummary = t ? `Inspected ${t.nickname} (${t.role})` : null;
      } else if (viewer.role === 'WITCH') {
        const parts: string[] = [];
        if (roomState.nightActions.witchHealUsedThisNight) parts.push('Heal Potion queued');
        if (roomState.nightActions.witchPoisonTargetId) {
          const t = roomState.players.find((p) => p.id === roomState.nightActions.witchPoisonTargetId);
          if (t) parts.push(`Poisoning ${t.nickname}`);
        }
        nightActionSummary = parts.length > 0 ? parts.join(' & ') : null;
      } else if (viewer.role === 'BLACK_WOLF' && roomState.nightActions.blackWolfInfectUsedThisNight) {
        nightActionSummary = 'Infecting pack victim tonight';
      } else if (viewer.role === 'WHITE_WOLF' && roomState.nightActions.whiteWolfTargetId) {
        const t = roomState.players.find((p) => p.id === roomState.nightActions.whiteWolfTargetId);
        nightActionSummary = t ? `Devouring fellow wolf ${t.nickname}` : null;
      }
    }

    selfSecret = {
      playerId: viewer.id,
      role: viewer.role,
      originalRole: viewer.originalRole,
      faction: viewer.faction,
      knownRoles: { ...viewer.knownRoles },
      lastProtectedPlayerId: viewer.role === 'GUARD' ? viewer.lastProtectedPlayerId : null,
      isPeeking: viewer.role === 'LITTLE_GIRL' ? viewer.isPeeking : false,
      exposureLevel: viewer.role === 'LITTLE_GIRL' ? viewer.exposureLevel : 0,
      witchPotions: viewer.role === 'WITCH' ? { ...roomState.witchPotions } : null,
      blackWolfInfectionAvailable:
        viewer.role === 'BLACK_WOLF' ? roomState.blackWolfInfectionAvailable : null,
      currentWolfTargetId: canSeeWolfVictim ? consensusWolfTargetId : null,
      hasSubmittedNightAction: roomState.nightActions.submittedPlayerIds.includes(viewer.id),
      nightActionSummary,
      wasInfectedToWolf: viewer.originalRole !== 'WEREWOLF' && viewer.role === 'WEREWOLF',
    };
  }

  const canSeeWolfVotes = isViewerWolf || isViewerDeadSpectator || isGameOver;

  return {
    roomCode: roomState.roomCode,
    phase: roomState.phase,
    dayNumber: roomState.dayNumber,
    nightNumber: roomState.nightNumber,
    phaseEndsAt: roomState.phaseEndsAt,
    config: roomState.config,
    players: sanitizedPlayers,
    self: selfSecret,
    wolfVotes: canSeeWolfVotes ? { ...roomState.nightActions.wolfVotes } : null,
    wolfAlertedThisNight: isViewerWolf || isViewerDeadSpectator || isGameOver ? roomState.wolfAlertedThisNight : false,
    lastNightCasualties: roomState.lastNightCasualties,
    skipDiscussionVotes: roomState.skipDiscussionVotes,
    dayVotes: roomState.dayVotes,
    lastExecutedPlayer: roomState.lastExecutedPlayer,
    hunterRevenge: roomState.hunterRevenge,
    winner: roomState.winner,
    winReason: roomState.winReason,
    mvpAwards: roomState.mvpAwards,
  };
}
