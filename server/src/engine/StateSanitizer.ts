import {
  NightCasualty,
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
 * 2. Both players are on the Qatil (Werewolf) team (except White Wolf appears as standard WEREWOLF to teammates).
 * 3. The game has ended (`phase === 'GAME_OVER'`).
 * 4. The requesting player is dead (Spectator mode).
 */
export function sanitizeStateForPlayer(
  roomState: RoomState,
  playerId: string
): SanitizedRoomState {
  const viewer = roomState.players.find((p) => p.id === playerId) ?? null;
  const isGameOver = roomState.phase === 'GAME_OVER';
  const isViewerDeadSpectator =
    viewer !== null && !viewer.isAlive && roomState.phase !== 'LOBBY';
  const isViewerWolf = viewer !== null && isWolfPackRole(viewer.role);
  const revealDeadRoles = roomState.config.revealDeadRoles !== false;

  const sanitizedPlayers: SanitizedPlayerState[] = roomState.players.map(
    (target) => {
      const isSelf = viewer !== null && target.id === viewer.id;
      const bothAreWolves = isViewerWolf && isWolfPackRole(target.role);

      let visibleRole: VisibleRoleType = 'UNKNOWN';
      let visibleFaction: VisibleFaction = 'UNKNOWN';

      if (isSelf || isGameOver || isViewerDeadSpectator) {
        visibleRole = target.role;
        visibleFaction = target.faction;
      } else if (bothAreWolves) {
        // White Wolf appears as a standard Werewolf to fellow Qatil teammates
        visibleRole = target.role === 'WHITE_WOLF' ? 'WEREWOLF' : target.role;
        visibleFaction = 'WEREWOLF';
      }

      let revealedRole: SanitizedPlayerState['revealedRole'] = null;
      if (!target.isAlive || isGameOver) {
        if (isGameOver || isViewerDeadSpectator || revealDeadRoles) {
          revealedRole = target.revealedRole ?? target.role;
        }
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
        revealedRole,
        deathReason: target.deathReason,
        isSpeaking: target.isSpeaking,
        isTyping: target.isTyping,
      };
    }
  );

  const consensusWolfTargetId = computeConsensusWolfTarget(roomState);
  const aliveDousedIds = roomState.arsonistDousedIds.filter((id) =>
    roomState.players.some((p) => p.id === id && p.isAlive)
  );

  let selfSecret: SanitizedSelfSecretState | null = null;
  if (viewer) {
    const canSeeWolfVictim =
      roomState.phase === 'NIGHT_PHASE' &&
      viewer.isAlive &&
      (isWolfPackRole(viewer.role) || viewer.role === 'WITCH');

    let nightActionSummary: string | null = null;
    if (roomState.phase === 'NIGHT_PHASE') {
      if (viewer.role === 'GUARD' && roomState.nightActions.guardTargetId) {
        const t = roomState.players.find(
          (p) => p.id === roomState.nightActions.guardTargetId
        );
        nightActionSummary = t ? `Qorunur: ${t.nickname}` : null;
      } else if (viewer.role === 'SEER' && roomState.nightActions.seerTargetId) {
        const t = roomState.players.find(
          (p) => p.id === roomState.nightActions.seerTargetId
        );
        nightActionSummary = t
          ? `Yoxlanıldı: ${t.nickname} (${t.role})`
          : null;
      } else if (
        viewer.role === 'MYSTIC_WOLF' &&
        roomState.nightActions.mysticWolfTargetId
      ) {
        const targetId = roomState.nightActions.mysticWolfTargetId;
        const t = roomState.players.find((p) => p.id === targetId);
        const hasPower = viewer.mysticWolfInspections[targetId];
        if (t && typeof hasPower === 'boolean') {
          nightActionSummary = hasPower
            ? `👁️‍🗨️ ${t.nickname}: ✨ Xüsusi gücü VAR (Normal/Tərəfsiz)!`
            : `👁️‍🗨️ ${t.nickname}: 🌾 Sadə Kəndlidir (Xüsusi gücü yoxdur).`;
        }
      } else if (viewer.role === 'WITCH') {
        const parts: string[] = [];
        if (roomState.nightActions.witchHealUsedThisNight) {
          parts.push('Həyat İksiri seçildi');
        }
        if (roomState.nightActions.witchPoisonTargetId) {
          const t = roomState.players.find(
            (p) => p.id === roomState.nightActions.witchPoisonTargetId
          );
          if (t) parts.push(`Ölüm İksiri: ${t.nickname}`);
        }
        nightActionSummary = parts.length > 0 ? parts.join(' & ') : null;
      } else if (
        viewer.role === 'BLACK_WOLF' &&
        roomState.nightActions.blackWolfInfectUsedThisNight
      ) {
        nightActionSummary = 'Bu gecə sürünün hədəfi yoluxdurulur!';
      } else if (
        viewer.role === 'WHITE_WOLF' &&
        roomState.nightActions.whiteWolfTargetId
      ) {
        const t = roomState.players.find(
          (p) => p.id === roomState.nightActions.whiteWolfTargetId
        );
        nightActionSummary = t ? `Xəyanət hədəfi: ${t.nickname}` : null;
      } else if (viewer.role === 'ARSONIST') {
        if (roomState.nightActions.arsonistActionThisNight === 'IGNITE') {
          nightActionSummary = `🔥 Alovlandır: ${aliveDousedIds.length} benzinli oyunçu yandırılacaq!`;
        } else if (
          roomState.nightActions.arsonistActionThisNight === 'DOUSE' &&
          roomState.nightActions.arsonistTargetId
        ) {
          const t = roomState.players.find(
            (p) => p.id === roomState.nightActions.arsonistTargetId
          );
          nightActionSummary = t ? `🛢️ Benzin tökülür: ${t.nickname}` : null;
        }
      } else if (viewer.role === 'CROW' && roomState.nightActions.crowTargetId) {
        const t = roomState.players.find(
          (p) => p.id === roomState.nightActions.crowTargetId
        );
        nightActionSummary = t ? `🐦‍⬛ Lənətlənir: ${t.nickname}` : null;
      } else if (
        viewer.role === 'CUPID' &&
        roomState.nightActions.cupidTargetIds
      ) {
        const [id1, id2] = roomState.nightActions.cupidTargetIds;
        const p1 = roomState.players.find((p) => p.id === id1);
        const p2 = roomState.players.find((p) => p.id === id2);
        if (p1 && p2) {
          nightActionSummary = `💘 Aşiqlər seçildi: ${p1.nickname} & ${p2.nickname}`;
        }
      } else if (
        viewer.role === 'WILD_CHILD' &&
        roomState.nightActions.wildChildModelId
      ) {
        const t = roomState.players.find(
          (p) => p.id === roomState.nightActions.wildChildModelId
        );
        nightActionSummary = t ? `🐾 Rol Model seçildi: ${t.nickname}` : null;
      }
    }

    selfSecret = {
      playerId: viewer.id,
      role: viewer.role,
      originalRole: viewer.originalRole,
      faction: viewer.faction,
      knownRoles: { ...viewer.knownRoles },
      mysticWolfInspections:
        viewer.role === 'MYSTIC_WOLF'
          ? { ...viewer.mysticWolfInspections }
          : {},
      arsonistDousedTargetIds:
        viewer.role === 'ARSONIST' || isGameOver || isViewerDeadSpectator
          ? aliveDousedIds
          : [],
      lastProtectedPlayerId:
        viewer.role === 'GUARD' ? viewer.lastProtectedPlayerId : null,
      isPeeking: viewer.role === 'LITTLE_GIRL' ? viewer.isPeeking : false,
      exposureLevel: viewer.role === 'LITTLE_GIRL' ? viewer.exposureLevel : 0,
      witchPotions:
        viewer.role === 'WITCH' ? { ...roomState.witchPotions } : null,
      blackWolfInfectionAvailable:
        viewer.role === 'BLACK_WOLF'
          ? roomState.blackWolfInfectionAvailable
          : null,
      shadowWolfAbilityAvailable:
        viewer.role === 'SHADOW_WOLF'
          ? roomState.shadowWolfAbilityAvailable
          : null,
      loverPartnerId: viewer.loverPartnerId,
      roleModelId:
        viewer.role === 'WILD_CHILD' || viewer.transformedFromWildChild
          ? viewer.roleModelId
          : null,
      transformedFromWildChild: viewer.transformedFromWildChild,
      currentWolfTargetId: canSeeWolfVictim ? consensusWolfTargetId : null,
      hasSubmittedNightAction:
        roomState.nightActions.submittedPlayerIds.includes(viewer.id),
      nightActionSummary,
      wasInfectedToWolf:
        !viewer.transformedFromWildChild &&
        viewer.originalRole !== 'WEREWOLF' &&
        viewer.role === 'WEREWOLF',
    };
  }

  const sanitizeCasualty = (c: NightCasualty): NightCasualty => {
    const rawPlayer = roomState.players.find((p) => p.id === c.playerId);
    const knownRole = viewer?.knownRoles[c.playerId];
    if (isGameOver || isViewerDeadSpectator || revealDeadRoles) {
      return {
        ...c,
        role: rawPlayer?.role ?? c.role,
      };
    }
    if (knownRole) {
      return {
        ...c,
        role: knownRole,
      };
    }
    return {
      ...c,
      role: 'UNKNOWN',
    };
  };

  const canSeeWolfVotes = isViewerWolf || isViewerDeadSpectator || isGameOver;
  const hideVotesNow =
    roomState.dayVotesHidden && roomState.phase === 'DAY_VOTING';
  const sanitizedDayVotes: Record<string, string | 'SKIP'> = {};
  if (hideVotesNow) {
    if (viewer && viewer.id in roomState.dayVotes) {
      sanitizedDayVotes[viewer.id] = roomState.dayVotes[viewer.id];
    }
  } else {
    Object.assign(sanitizedDayVotes, roomState.dayVotes);
  }

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
    wolfAlertedThisNight:
      isViewerWolf || isViewerDeadSpectator || isGameOver
        ? roomState.wolfAlertedThisNight
        : false,
    lastNightCasualties: roomState.lastNightCasualties.map(sanitizeCasualty),
    skipDiscussionVotes: roomState.skipDiscussionVotes,
    dayVotes: sanitizedDayVotes,
    dayVotesHidden: roomState.dayVotesHidden,
    villagePowersLost: roomState.villagePowersLost,
    lastBearGrowled: roomState.lastBearGrowled,
    cursedPlayerId: roomState.cursedPlayerId,
    lastExecutedPlayer: roomState.lastExecutedPlayer
      ? sanitizeCasualty(roomState.lastExecutedPlayer)
      : null,
    hunterRevenge: roomState.hunterRevenge,
    winner: roomState.winner,
    winReason: roomState.winReason,
    mvpAwards: roomState.mvpAwards,
  };
}
