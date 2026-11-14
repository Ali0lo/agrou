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
 * 2. Both players are Werewolves (Werewolves can see each other; White Wolf appears as WEREWOLF to fellow wolves).
 * 3. Both players are Sisters (`SISTERS`).
 * 4. The game has ended (`phase === 'GAME_OVER'`).
 * 5. The requesting player is dead (Spectator mode).
 *
 * Also respects `roomState.config.revealDeadRoles`:
 * - When `revealDeadRoles === true`, dead players' `revealedRole` is visible.
 * - When `revealDeadRoles === false`, dead players' `revealedRole` is hidden (`null`) from living players
 *   (unless the viewer inspected them via Medium/Seer `knownRoles`, is dead, or `phase === 'GAME_OVER'`).
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
  const isViewerSister = viewer !== null && viewer.role === 'SISTERS';
  const revealDeadRoles = roomState.config.revealDeadRoles !== false;

  const sanitizedPlayers: SanitizedPlayerState[] = roomState.players.map(
    (target) => {
      const isSelf = viewer !== null && target.id === viewer.id;
      const bothAreWolves = isViewerWolf && isWolfPackRole(target.role);
      const bothAreSisters = isViewerSister && target.role === 'SISTERS';
      const knownByViewer = viewer?.knownRoles[target.id] ?? null;

      let visibleRole: VisibleRoleType = 'UNKNOWN';
      let visibleFaction: VisibleFaction = 'UNKNOWN';

      if (isSelf || isGameOver || isViewerDeadSpectator) {
        visibleRole = target.role;
        visibleFaction = target.faction;
      } else if (bothAreWolves) {
        visibleRole = target.role === 'WHITE_WOLF' ? 'WEREWOLF' : target.role;
        visibleFaction = 'WEREWOLF';
      } else if (bothAreSisters) {
        visibleRole = 'SISTERS';
        visibleFaction = 'VILLAGE';
      }

      let revealedRole: SanitizedPlayerState['revealedRole'] = null;
      if (!target.isAlive || isGameOver) {
        if (isGameOver || isViewerDeadSpectator || revealDeadRoles) {
          revealedRole = target.revealedRole ?? target.role;
        } else if (knownByViewer) {
          // Medium or Seer who inspected this dead player sees their role even when revealDeadRoles is OFF
          revealedRole = knownByViewer;
        } else {
          revealedRole = null;
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
        isMayor: target.isMayor || target.role === 'MAYOR',
        isCrowCursed: roomState.crowCursedPlayerId === target.id,
        isLoverWithSelf: Boolean(
          viewer &&
            viewer.loverPartnerId &&
            (target.id === viewer.loverPartnerId || target.id === viewer.id)
        ),
      };
    }
  );

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
        const t = roomState.players.find(
          (p) => p.id === roomState.nightActions.guardTargetId
        );
        nightActionSummary = t ? `Qorunur (Protecting): ${t.nickname}` : null;
      } else if (viewer.role === 'SEER' && roomState.nightActions.seerTargetId) {
        const t = roomState.players.find(
          (p) => p.id === roomState.nightActions.seerTargetId
        );
        nightActionSummary = t
          ? `Yoxlanıldı (Inspected): ${t.nickname} (${t.role})`
          : null;
      } else if (
        viewer.role === 'WOLF_SEER' &&
        roomState.nightActions.wolfSeerTargetId
      ) {
        const t = roomState.players.find(
          (p) => p.id === roomState.nightActions.wolfSeerTargetId
        );
        nightActionSummary = t
          ? `Görücü Canavar yoxladı: ${t.nickname} (${t.role})`
          : null;
      } else if (
        viewer.role === 'MEDIUM' &&
        roomState.nightActions.mediumTargetId
      ) {
        const t = roomState.players.find(
          (p) => p.id === roomState.nightActions.mediumTargetId
        );
        nightActionSummary = t
          ? `Ruh yoxlanıldı: ${t.nickname} (${t.role})`
          : null;
      } else if (viewer.role === 'FOX' && viewer.lastFoxSniff) {
        nightActionSummary = viewer.lastFoxSniff.hasWolf
          ? '🦊 Qoxu nəticəsi: Bu 3 nəfərdən ən azı biri CANAVARDIR! 🐺'
          : '🦊 Qoxu nəticəsi: Bu 3 nəfər təmizdir (Tülkü gücünü itirdi).';
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
        viewer.role === 'BIG_BAD_WOLF' &&
        roomState.nightActions.bigBadWolfTargetId
      ) {
        const t = roomState.players.find(
          (p) => p.id === roomState.nightActions.bigBadWolfTargetId
        );
        nightActionSummary = t ? `Əlavə hücum: ${t.nickname}` : null;
      } else if (
        viewer.role === 'WHITE_WOLF' &&
        roomState.nightActions.whiteWolfTargetId
      ) {
        const t = roomState.players.find(
          (p) => p.id === roomState.nightActions.whiteWolfTargetId
        );
        nightActionSummary = t ? `Xəyanət hədəfi: ${t.nickname}` : null;
      } else if (viewer.role === 'CROW' && roomState.nightActions.crowTargetId) {
        const t = roomState.players.find(
          (p) => p.id === roomState.nightActions.crowTargetId
        );
        nightActionSummary = t ? `Lənətləndi (+2 səs): ${t.nickname}` : null;
      } else if (
        viewer.role === 'SERIAL_KILLER' &&
        roomState.nightActions.serialKillerTargetId
      ) {
        const t = roomState.players.find(
          (p) => p.id === roomState.nightActions.serialKillerTargetId
        );
        nightActionSummary = t ? `Qatil hədəfi: ${t.nickname}` : null;
      } else if (viewer.role === 'CUPID' && roomState.lovers) {
        const p1 = roomState.players.find((p) => p.id === roomState.lovers?.[0]);
        const p2 = roomState.players.find((p) => p.id === roomState.lovers?.[1]);
        nightActionSummary =
          p1 && p2 ? `Aşiqlər: ${p1.nickname} 💘 ${p2.nickname}` : null;
      } else if (viewer.role === 'WILD_CHILD' && viewer.roleModelId) {
        const t = roomState.players.find((p) => p.id === viewer.roleModelId);
        nightActionSummary = t ? `Kumir (Role Model): ${t.nickname}` : null;
      }
    }

    selfSecret = {
      playerId: viewer.id,
      role: viewer.role,
      originalRole: viewer.originalRole,
      faction: viewer.faction,
      knownRoles: { ...viewer.knownRoles },
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
      currentWolfTargetId: canSeeWolfVictim ? consensusWolfTargetId : null,
      hasSubmittedNightAction:
        roomState.nightActions.submittedPlayerIds.includes(viewer.id),
      nightActionSummary,
      wasInfectedToWolf:
        viewer.originalRole !== 'WEREWOLF' && viewer.role === 'WEREWOLF',
      elderLivesRemaining: viewer.elderLivesRemaining,
      foxPowerLost: viewer.foxPowerLost,
      lastFoxSniff: viewer.role === 'FOX' ? viewer.lastFoxSniff : null,
      loverPartnerId: viewer.loverPartnerId,
      roleModelId: viewer.role === 'WILD_CHILD' ? viewer.roleModelId : null,
      thiefExtraRoles:
        viewer.role === 'THIEF' && roomState.nightNumber === 1
          ? roomState.thiefExtraRoles
          : null,
      canBigBadWolfKill:
        viewer.role === 'BIG_BAD_WOLF' && !roomState.anyWolfHasDied,
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
    crowCursedPlayerId: roomState.crowCursedPlayerId,
    villagePowersLost: roomState.villagePowersLost,
    skipDiscussionVotes: roomState.skipDiscussionVotes,
    dayVotes: roomState.dayVotes,
    lastExecutedPlayer: roomState.lastExecutedPlayer
      ? sanitizeCasualty(roomState.lastExecutedPlayer)
      : null,
    hunterRevenge: roomState.hunterRevenge,
    winner: roomState.winner,
    winReason: roomState.winReason,
    mvpAwards: roomState.mvpAwards,
  };
}
