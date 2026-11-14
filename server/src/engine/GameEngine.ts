import crypto from 'node:crypto';
import { ALL_22_ROLES, ROLE_DEFINITIONS } from '../constants/roles.js';
import {
  ChatMessage,
  NightActionPayload,
  NightActionsState,
  PhaseTimers,
  PlayerState,
  RoleType,
  RoomConfig,
  RoomState,
} from '../types/game.js';
import { NightResolver } from './roles/NightResolver.js';
import {
  getFactionForRole,
  isWolfPackRole,
  ValidationResult,
} from './roles/RoleStrategy.js';
import { getRoleStrategy } from './roles/RoleStrategies.js';
import { WinConditionChecker } from './WinConditionChecker.js';

export const DEFAULT_TIMERS: PhaseTimers = {
  roleReveal: 8,
  nightPhase: 30,
  dawnSummary: 8,
  dayDiscussion: 90,
  dayVoting: 30,
  executionReveal: 6,
  hunterRevenge: 15,
};

export const DEFAULT_ENABLED_ROLES: Record<RoleType, number> = {
  VILLAGER: 2,
  SEER: 1,
  GUARD: 1,
  WITCH: 1,
  HUNTER: 0,
  CUPID: 0,
  LITTLE_GIRL: 0,
  ELDER: 0,
  CROW: 0,
  SISTERS: 0,
  MEDIUM: 0,
  FOX: 0,
  WEREWOLF: 1,
  BIG_BAD_WOLF: 0,
  BLACK_WOLF: 0,
  WOLF_SEER: 0,
  WHITE_WOLF: 0,
  THIEF: 0,
  WILD_CHILD: 0,
  JESTER: 0,
  SERIAL_KILLER: 0,
  MAYOR: 0,
  ANGEL: 0,
};

export function createEmptyNightActions(): NightActionsState {
  return {
    wolfVotes: {},
    guardTargetId: null,
    seerTargetId: null,
    seerInspectedThisNight: false,
    wolfSeerTargetId: null,
    wolfSeerInspectedThisNight: false,
    mediumTargetId: null,
    mediumInspectedThisNight: false,
    foxTargetId: null,
    foxSniffedThisNight: false,
    witchHealUsedThisNight: false,
    witchPoisonTargetId: null,
    blackWolfInfectUsedThisNight: false,
    bigBadWolfTargetId: null,
    whiteWolfTargetId: null,
    crowTargetId: null,
    serialKillerTargetId: null,
    cupidLoverIds: null,
    wildChildModelId: null,
    thiefChosenIndex: null,
    submittedPlayerIds: [],
  };
}

export function createInitialRoomState(roomCode: string): RoomState {
  const defaultConfig: RoomConfig = {
    timers: { ...DEFAULT_TIMERS },
    enabledRoles: { ...DEFAULT_ENABLED_ROLES },
    allowWebRTC: true,
    revealDeadRoles: true,
  };

  return {
    roomCode,
    createdAt: Date.now(),
    phase: 'LOBBY',
    dayNumber: 0,
    nightNumber: 0,
    phaseEndsAt: null,
    config: defaultConfig,
    players: [],
    nightActions: createEmptyNightActions(),
    witchPotions: {
      healAvailable: true,
      poisonAvailable: true,
    },
    blackWolfInfectionAvailable: true,
    wolfAlertedThisNight: false,
    wolfAliasMap: {},
    thiefExtraRoles: null,
    lovers: null,
    crowCursedPlayerId: null,
    villagePowersLost: false,
    anyWolfHasDied: false,
    lastNightCasualties: [],
    lastNightInfectedId: null,
    skipDiscussionVotes: [],
    dayVotes: {},
    lastExecutedPlayer: null,
    hunterRevenge: null,
    winner: null,
    winReason: null,
    mvpAwards: [],
    messages: [],
  };
}

export function createPlayerState(params: {
  id?: string;
  socketId: string | null;
  sessionToken?: string;
  nickname: string;
  avatar: string;
  color: string;
  seatIndex: number;
  isHost: boolean;
  isBot?: boolean;
}): PlayerState {
  return {
    id: params.id ?? crypto.randomUUID(),
    socketId: params.socketId,
    sessionToken: params.sessionToken ?? crypto.randomUUID(),
    nickname: params.nickname.trim().slice(0, 20) || 'Wanderer',
    avatar: params.avatar || '🦊',
    color: params.color || '#f97316',
    seatIndex: params.seatIndex,
    isHost: params.isHost,
    isBot: params.isBot ?? false,
    isConnected: true,
    isAlive: true,
    role: 'VILLAGER',
    originalRole: 'VILLAGER',
    faction: 'VILLAGE',
    revealedRole: null,
    deathReason: null,
    diedAtPhase: null,
    diedOnDay: null,
    isSpeaking: false,
    isTyping: false,
    knownRoles: {},
    lastProtectedPlayerId: null,
    isPeeking: false,
    exposureLevel: 0,
    elderLivesRemaining: 1,
    foxPowerLost: false,
    lastFoxSniff: null,
    loverPartnerId: null,
    roleModelId: null,
    isMayor: false,
    stats: {
      votesCast: 0,
      correctWolfVotes: 0,
      nightsSurvived: 0,
      abilitiesUsed: 0,
      killsTriggered: 0,
    },
  };
}

export class GameEngine {
  /**
   * Builds a role deck for `playerCount` players based on `enabledRoles`.
   * Ensures at least 1 Werewolf-pack member and pads/trims cleanly to `playerCount`.
   */
  static buildRoleDeck(
    playerCount: number,
    enabledRoles: Record<RoleType, number>
  ): RoleType[] {
    const deck: RoleType[] = [];

    const priorityRoles: RoleType[] = [
      'WEREWOLF',
      'BIG_BAD_WOLF',
      'BLACK_WOLF',
      'WOLF_SEER',
      'WHITE_WOLF',
      'SERIAL_KILLER',
      'SEER',
      'WITCH',
      'GUARD',
      'HUNTER',
      'CUPID',
      'LITTLE_GIRL',
      'ELDER',
      'CROW',
      'SISTERS',
      'MEDIUM',
      'FOX',
      'THIEF',
      'WILD_CHILD',
      'JESTER',
      'MAYOR',
      'ANGEL',
      'VILLAGER',
    ];

    for (const role of priorityRoles) {
      const count = Math.max(0, Math.floor(enabledRoles[role] ?? 0));
      for (let i = 0; i < count; i++) {
        deck.push(role);
      }
    }

    if (!deck.some((r) => isWolfPackRole(r))) {
      deck.unshift('WEREWOLF');
    }

    if (deck.length > playerCount) {
      deck.length = playerCount;
    }
    while (deck.length < playerCount) {
      deck.push('VILLAGER');
    }

    for (let i = deck.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      const tmp = deck[i];
      deck[i] = deck[j];
      deck[j] = tmp;
    }

    return deck;
  }

  /**
   * Starts the game from LOBBY -> ROLE_REVEAL.
   */
  static startGame(room: RoomState, customDeck?: RoleType[]): ValidationResult {
    if (room.phase !== 'LOBBY') {
      return { valid: false, error: 'Game has already started.' };
    }
    if (room.players.length < 4 || room.players.length > 16) {
      return {
        valid: false,
        error: 'Campfire Wolves requires at least 4 players to start.',
      };
    }

    const deck =
      customDeck && customDeck.length === room.players.length
        ? [...customDeck]
        : this.buildRoleDeck(room.players.length, room.config.enabledRoles);

    room.dayNumber = 1;
    room.nightNumber = 0;
    room.witchPotions = { healAvailable: true, poisonAvailable: true };
    room.blackWolfInfectionAvailable = true;
    room.thiefExtraRoles = null;
    room.lovers = null;
    room.crowCursedPlayerId = null;
    room.villagePowersLost = false;
    room.anyWolfHasDied = false;
    room.lastNightCasualties = [];
    room.lastNightInfectedId = null;
    room.lastExecutedPlayer = null;
    room.hunterRevenge = null;
    room.winner = null;
    room.winReason = null;
    room.mvpAwards = [];
    room.skipDiscussionVotes = [];
    room.dayVotes = {};
    room.nightActions = createEmptyNightActions();

    // If Thief is in the deck, prepare two unused center role cards
    if (deck.includes('THIEF')) {
      const extraPool: RoleType[] = [
        'SEER',
        'GUARD',
        'WITCH',
        'HUNTER',
        'FOX',
        'CROW',
        'WEREWOLF',
        'VILLAGER',
      ];
      const c1 = extraPool[crypto.randomInt(0, extraPool.length)];
      const c2 = extraPool[crypto.randomInt(0, extraPool.length)];
      room.thiefExtraRoles = [c1, c2];
    }

    room.players.forEach((player, idx) => {
      const assignedRole = deck[idx] ?? 'VILLAGER';
      player.seatIndex = idx;
      player.isAlive = true;
      player.role = assignedRole;
      player.originalRole = assignedRole;
      player.faction = getFactionForRole(assignedRole);
      player.revealedRole = null;
      player.deathReason = null;
      player.diedAtPhase = null;
      player.diedOnDay = null;
      player.knownRoles = {};
      player.lastProtectedPlayerId = null;
      player.isPeeking = false;
      player.exposureLevel = 0;
      player.elderLivesRemaining = assignedRole === 'ELDER' ? 2 : 1;
      player.foxPowerLost = false;
      player.lastFoxSniff = null;
      player.loverPartnerId = null;
      player.roleModelId = null;
      player.isMayor = assignedRole === 'MAYOR';
      player.stats = {
        votesCast: 0,
        correctWolfVotes: 0,
        nightsSurvived: 0,
        abilitiesUsed: 0,
        killsTriggered: 0,
      };
    });

    // Sisters recognize each other from the start
    const sisters = room.players.filter((p) => p.role === 'SISTERS');
    if (sisters.length > 1) {
      for (const s1 of sisters) {
        for (const s2 of sisters) {
          if (s1.id !== s2.id) {
            s1.knownRoles[s2.id] = 'SISTERS';
          }
        }
      }
    }

    room.phase = 'ROLE_REVEAL';
    room.phaseEndsAt = Date.now() + room.config.timers.roleReveal * 1000;
    this.appendSystemMessage(
      room,
      '🔥 Tonqal alovlanır! Gizli rol kartınızı yoxlayın — gecə başlayır!'
    );

    return { valid: true };
  }

  /**
   * Transitions room into NIGHT_PHASE.
   */
  static enterNightPhase(room: RoomState): void {
    room.phase = 'NIGHT_PHASE';
    room.nightNumber += 1;
    room.nightActions = createEmptyNightActions();
    room.wolfAlertedThisNight = false;
    room.lastExecutedPlayer = null;
    room.hunterRevenge = null;

    const wolves = room.players.filter((p) => p.isAlive && isWolfPackRole(p.role));
    const shuffledWolves = [...wolves].sort(() => Math.random() - 0.5);
    room.wolfAliasMap = {};
    shuffledWolves.forEach((w, idx) => {
      room.wolfAliasMap[w.id] = `Wolf ${idx + 1}`;
    });

    for (const p of room.players) {
      p.isPeeking = false;
    }

    room.phaseEndsAt = Date.now() + room.config.timers.nightPhase * 1000;
    this.appendSystemMessage(
      room,
      `🌙 Gecə ${room.nightNumber} düşür. Kənd yuxuya gedir, gecə rolları oyanır...`
    );
  }

  /**
   * Handles a night action from an alive player.
   */
  static submitNightAction(
    room: RoomState,
    playerId: string,
    payload: NightActionPayload
  ): ValidationResult {
    if (room.phase !== 'NIGHT_PHASE') {
      return { valid: false, error: 'Night actions can only be used during Night Phase.' };
    }
    const actor = room.players.find((p) => p.id === playerId);
    if (!actor || !actor.isAlive) {
      return { valid: false, error: 'Only living players can act at night.' };
    }

    const strategy = getRoleStrategy(actor.role);
    const validation = strategy.validateNightAction(room, actor, payload);
    if (!validation.valid) {
      return validation;
    }

    strategy.recordNightInput(room, actor, payload);
    return { valid: true };
  }

  /**
   * Toggles Little Girl peeking during NIGHT_PHASE.
   */
  static toggleLittleGirlPeek(
    room: RoomState,
    playerId: string,
    peeking: boolean
  ): ValidationResult {
    if (room.phase !== 'NIGHT_PHASE') {
      return { valid: false, error: 'Can only peek during the Night Phase.' };
    }
    const player = room.players.find((p) => p.id === playerId);
    if (!player || !player.isAlive || player.role !== 'LITTLE_GIRL') {
      return { valid: false, error: 'Only an alive Little Girl can peek.' };
    }
    if (room.villagePowersLost) {
      return { valid: false, error: 'Village special powers were lost!' };
    }
    player.isPeeking = peeking;
    if (peeking) {
      player.stats.abilitiesUsed += 1;
    }
    return { valid: true };
  }

  /**
   * Called once per second during NIGHT_PHASE to update Little Girl exposure and roll for wolf alert.
   */
  static tickLittleGirlExposure(
    room: RoomState,
    randomFn: () => number = Math.random
  ): { wolfAlertTriggered: boolean; exposureLevel: number } {
    if (room.phase !== 'NIGHT_PHASE') {
      return { wolfAlertTriggered: false, exposureLevel: 0 };
    }
    const littleGirl = room.players.find(
      (p) => p.isAlive && p.role === 'LITTLE_GIRL' && p.isPeeking
    );
    if (!littleGirl) {
      return { wolfAlertTriggered: false, exposureLevel: 0 };
    }

    littleGirl.exposureLevel = Math.min(100, littleGirl.exposureLevel + 7);

    const alertProbability = 0.06 + (littleGirl.exposureLevel / 100) * 0.09;
    let wolfAlertTriggered = false;

    if (!room.wolfAlertedThisNight && randomFn() < alertProbability) {
      room.wolfAlertedThisNight = true;
      wolfAlertTriggered = true;
    }

    return {
      wolfAlertTriggered,
      exposureLevel: littleGirl.exposureLevel,
    };
  }

  /**
   * Resolves NIGHT_PHASE and transitions to DAWN_SUMMARY.
   */
  static resolveNightAndEnterDawn(room: RoomState): void {
    const resolution = NightResolver.resolve(room);
    room.phase = 'DAWN_SUMMARY';
    const revealDeadRoles = room.config.revealDeadRoles !== false;

    if (resolution.casualties.length === 0) {
      this.appendSystemMessage(
        room,
        `🌅 Gün ${room.dayNumber} səhəri açıldı. Sakit gecə keçdi — heç kim ölmədi!`
      );
    } else {
      const summary = resolution.casualties
        .map((c) => {
          const rawPlayer = room.players.find((p) => p.id === c.playerId);
          const roleDef = rawPlayer ? ROLE_DEFINITIONS[rawPlayer.role] : null;
          return revealDeadRoles && roleDef
            ? `${c.nickname} öldürüldü — Rolu: ${roleDef.icon} ${roleDef.nameAz} (${roleDef.nameEn})`
            : `${c.nickname} öldürüldü — Rolu gizlidir 🔒`;
        })
        .join(' | ');
      this.appendSystemMessage(room, `🌅 Səhər xəbəri: ${summary}`);
    }

    if (room.crowCursedPlayerId) {
      const cursed = room.players.find((p) => p.id === room.crowCursedPlayerId);
      if (cursed && cursed.isAlive) {
        this.appendSystemMessage(
          room,
          `🐦‍⬛ Qarğa lənəti: ${cursed.nickname} bu gün səsverməyə avtomatik +2 səslə başlayır!`
        );
      }
    }

    // Check if an alive-at-night Hunter died during the night (and village powers are not lost)
    const deadHunterCasualty = !room.villagePowersLost
      ? resolution.casualties.find((c) => {
          const p = room.players.find((pl) => pl.id === c.playerId);
          return p?.role === 'HUNTER';
        })
      : undefined;
    const hasLivingTargets = room.players.some((p) => p.isAlive);

    if (deadHunterCasualty && hasLivingTargets) {
      const durationMs = room.config.timers.hunterRevenge * 1000;
      room.hunterRevenge = {
        hunterId: deadHunterCasualty.playerId,
        triggeredFromPhase: 'DAWN_SUMMARY',
        endsAt: Date.now() + durationMs,
        resolved: false,
        shotTargetId: null,
      };
      room.phaseEndsAt = Date.now() + durationMs;
      this.appendSystemMessage(
        room,
        `🎯 ${deadHunterCasualty.nickname} Ovçu (Hunter) idi! Son intiqam atəşi üçün ${room.config.timers.hunterRevenge} saniyəsi var!`
      );
      return;
    }

    const winCheck = WinConditionChecker.check(room);
    if (winCheck.isGameOver) {
      this.enterGameOver(room, winCheck.winner!, winCheck.reason!);
      return;
    }

    room.phaseEndsAt = Date.now() + room.config.timers.dawnSummary * 1000;
  }

  /**
   * Transitions from DAWN_SUMMARY -> DAY_DISCUSSION.
   */
  static enterDayDiscussion(room: RoomState): void {
    const winCheck = WinConditionChecker.check(room);
    if (winCheck.isGameOver) {
      this.enterGameOver(room, winCheck.winner!, winCheck.reason!);
      return;
    }

    room.phase = 'DAY_DISCUSSION';
    room.hunterRevenge = null;
    room.skipDiscussionVotes = [];
    room.dayVotes = {};
    room.phaseEndsAt = Date.now() + room.config.timers.dayDiscussion * 1000;
    this.appendSystemMessage(
      room,
      `☀️ Gün ${room.dayNumber} Müzakirəsi başladı. Tonqal ətrafında müzakirə edin!`
    );
  }

  /**
   * Toggles a player's vote to end DAY_DISCUSSION early.
   */
  static toggleSkipDiscussion(
    room: RoomState,
    playerId: string
  ): {
    valid: boolean;
    transitionedToVoting: boolean;
    error?: string;
  } {
    if (room.phase !== 'DAY_DISCUSSION') {
      return {
        valid: false,
        transitionedToVoting: false,
        error: 'Can only skip discussion during Day Discussion phase.',
      };
    }
    const player = room.players.find((p) => p.id === playerId);
    if (!player || !player.isAlive) {
      return {
        valid: false,
        transitionedToVoting: false,
        error: 'Only living players can vote to end discussion early.',
      };
    }

    const idx = room.skipDiscussionVotes.indexOf(playerId);
    if (idx >= 0) {
      room.skipDiscussionVotes.splice(idx, 1);
    } else {
      room.skipDiscussionVotes.push(playerId);
    }

    const aliveCount = room.players.filter((p) => p.isAlive).length;
    const validVotes = room.skipDiscussionVotes.filter((id) =>
      room.players.some((p) => p.id === id && p.isAlive)
    );
    room.skipDiscussionVotes = validVotes;

    if (aliveCount > 0 && validVotes.length > aliveCount / 2) {
      this.enterDayVoting(room);
      return { valid: true, transitionedToVoting: true };
    }

    return { valid: true, transitionedToVoting: false };
  }

  /**
   * Transitions from DAY_DISCUSSION -> DAY_VOTING.
   */
  static enterDayVoting(room: RoomState): void {
    room.phase = 'DAY_VOTING';
    room.dayVotes = {};
    room.skipDiscussionVotes = [];
    room.phaseEndsAt = Date.now() + room.config.timers.dayVoting * 1000;
    this.appendSystemMessage(
      room,
      `⚖️ Səsvermə başladı! Şübhəli bildiyiniz oyunçuya səs verin və ya Səsi Keç (Skip) seçin.`
    );
  }

  /**
   * Casts or updates an alive player's vote during DAY_VOTING.
   */
  static castDayVote(
    room: RoomState,
    voterId: string,
    targetId: string | 'SKIP' | null
  ): ValidationResult {
    if (room.phase !== 'DAY_VOTING') {
      return { valid: false, error: 'Voting is only open during the Day Voting phase.' };
    }
    const voter = room.players.find((p) => p.id === voterId);
    if (!voter || !voter.isAlive) {
      return { valid: false, error: 'Only living players can cast votes.' };
    }

    if (targetId === null) {
      delete room.dayVotes[voterId];
      return { valid: true };
    }

    if (targetId !== 'SKIP') {
      const target = room.players.find((p) => p.id === targetId);
      if (!target || !target.isAlive) {
        return { valid: false, error: 'Cannot vote for a dead or non-existent player.' };
      }
    }

    room.dayVotes[voterId] = targetId;
    return { valid: true };
  }

  /**
   * Resolves DAY_VOTING and transitions to EXECUTION_REVEAL.
   * Incorporates Crow's +2 automatic curse votes and Mayor's 2x vote weight + tie-breaking!
   */
  static resolveDayVotesAndEnterExecution(room: RoomState): void {
    room.phase = 'EXECUTION_REVEAL';
    room.lastExecutedPlayer = null;
    const revealDeadRoles = room.config.revealDeadRoles !== false;

    const voteCounts = new Map<string, number>();
    let skipCount = 0;
    let mayorChosenTargetId: string | null = null;

    // 1. Apply Crow's +2 automatic curse votes if the cursed player is alive
    if (room.crowCursedPlayerId) {
      const cursed = room.players.find(
        (p) => p.id === room.crowCursedPlayerId && p.isAlive
      );
      if (cursed) {
        voteCounts.set(cursed.id, 2);
      }
    }

    // 2. Tally player votes (Mayor's vote counts as 2!)
    for (const [voterId, targetId] of Object.entries(room.dayVotes)) {
      const voter = room.players.find((p) => p.id === voterId && p.isAlive);
      if (!voter) continue;

      voter.stats.votesCast += 1;
      const weight =
        !room.villagePowersLost && (voter.isMayor || voter.role === 'MAYOR')
          ? 2
          : 1;

      if (targetId === 'SKIP') {
        skipCount += weight;
        continue;
      }

      const target = room.players.find((p) => p.id === targetId && p.isAlive);
      if (!target) continue;

      if (isWolfPackRole(target.role)) {
        voter.stats.correctWolfVotes += 1;
      }

      if (weight === 2) {
        mayorChosenTargetId = target.id;
      }

      voteCounts.set(target.id, (voteCounts.get(target.id) ?? 0) + weight);
    }

    // Clear Crow curse after tallying
    room.crowCursedPlayerId = null;

    let highestVotes = 0;
    let topCandidates: string[] = [];

    for (const [candidateId, count] of voteCounts.entries()) {
      if (count > highestVotes) {
        highestVotes = count;
        topCandidates = [candidateId];
      } else if (count === highestVotes) {
        topCandidates.push(candidateId);
      }
    }

    // If tied between candidates and Mayor voted for one of the tied top candidates, Mayor breaks the tie!
    if (
      topCandidates.length > 1 &&
      mayorChosenTargetId &&
      topCandidates.includes(mayorChosenTargetId)
    ) {
      topCandidates = [mayorChosenTargetId];
    }

    const isTie =
      topCandidates.length !== 1 ||
      highestVotes === 0 ||
      skipCount >= highestVotes;

    if (isTie) {
      this.appendSystemMessage(
        room,
        '⚖️ Səsvermə bərabərliklə (və ya səsi keçməklə) nəticələndi. Bu gün heç kim edam edilmədi!'
      );
    } else {
      const executedId = topCandidates[0];
      const executionCasualties: RoomState['lastNightCasualties'] = [];
      const executedPlayer = NightResolver.eliminatePlayer(
        room,
        executedId,
        'EXECUTION',
        'EXECUTION_REVEAL',
        executionCasualties
      );

      if (executedPlayer) {
        const roleDef = ROLE_DEFINITIONS[executedPlayer.role];
        room.lastExecutedPlayer = executionCasualties[0] ?? null;

        if (revealDeadRoles) {
          this.appendSystemMessage(
            room,
            `⚖️ ${executedPlayer.nickname} səsvermə ilə edam edildi — Rolu: ${roleDef.icon} ${roleDef.nameAz} (${roleDef.nameEn})!`
          );
        } else {
          this.appendSystemMessage(
            room,
            `⚖️ ${executedPlayer.nickname} səsvermə ilə edam edildi — Rolu gizlidir 🔒`
          );
        }

        if (executedPlayer.role === 'ELDER') {
          this.appendSystemMessage(
            room,
            '⚠️ Ağsaqqal (Elder) kənd tərəfindən edam edildi! Kəndlilər bütün xüsusi gecə güclərini itirdilər!'
          );
        }

        // Check Jester (any day) or Angel (Day 1) instant win BEFORE anything else
        const executionWinCheck = WinConditionChecker.check(room, {
          justExecutedPlayerId: executedPlayer.id,
        });
        if (
          executionWinCheck.isGameOver &&
          (executionWinCheck.winner === 'JESTER' ||
            executionWinCheck.winner === 'ANGEL')
        ) {
          this.enterGameOver(
            room,
            executionWinCheck.winner,
            executionWinCheck.reason!
          );
          return;
        }

        // Process Lovers Heartbreak & Wild Child Transformation
        NightResolver.processPostDeathEffects(
          room,
          'EXECUTION_REVEAL',
          executionCasualties
        );

        // If Mayor died, pass Mayor badge to a living player if none exists
        if (executedPlayer.isMayor || executedPlayer.role === 'MAYOR') {
          executedPlayer.isMayor = false;
          const nextSuccessor = room.players.find((p) => p.isAlive);
          if (nextSuccessor) {
            nextSuccessor.isMayor = true;
            this.appendSystemMessage(
              room,
              `🎖️ Şerif nişanı ${nextSuccessor.nickname} oyunçusuna ötürüldü!`
            );
          }
        }

        // Check if executed player is the Hunter (and village powers are not lost)
        const hasLivingTargets = room.players.some((p) => p.isAlive);
        if (
          executedPlayer.role === 'HUNTER' &&
          !room.villagePowersLost &&
          hasLivingTargets
        ) {
          const durationMs = room.config.timers.hunterRevenge * 1000;
          room.hunterRevenge = {
            hunterId: executedPlayer.id,
            triggeredFromPhase: 'EXECUTION_REVEAL',
            endsAt: Date.now() + durationMs,
            resolved: false,
            shotTargetId: null,
          };
          room.phaseEndsAt = Date.now() + durationMs;
          this.appendSystemMessage(
            room,
            `🎯 ${executedPlayer.nickname} Ovçu (Hunter) idi! Son intiqam atəşi üçün ${room.config.timers.hunterRevenge} saniyəsi var!`
          );
          return;
        }
      }
    }

    if (room.dayNumber === 1) {
      WinConditionChecker.convertSurvivingAngelsAfterDay1(room);
    }

    const winCheck = WinConditionChecker.check(room);
    if (winCheck.isGameOver) {
      this.enterGameOver(room, winCheck.winner!, winCheck.reason!);
      return;
    }

    room.phaseEndsAt = Date.now() + room.config.timers.executionReveal * 1000;
  }

  /**
   * Resolves the dying Hunter's revenge shot.
   */
  static resolveHunterShot(
    room: RoomState,
    hunterId: string,
    targetId: string
  ): ValidationResult {
    if (!room.hunterRevenge || room.hunterRevenge.resolved) {
      return { valid: false, error: 'No active Hunter revenge shot is pending.' };
    }
    if (room.hunterRevenge.hunterId !== hunterId) {
      return { valid: false, error: 'Only the dying Hunter can take this shot.' };
    }
    const hunter = room.players.find((p) => p.id === hunterId);
    const target = room.players.find((p) => p.id === targetId);
    if (!target || !target.isAlive) {
      return { valid: false, error: 'Hunter must target a living player.' };
    }

    const shotCasualties: RoomState['lastNightCasualties'] = [];
    NightResolver.eliminatePlayer(
      room,
      target.id,
      'HUNTER_SHOT',
      room.phase,
      shotCasualties
    );
    NightResolver.processPostDeathEffects(room, room.phase, shotCasualties);

    if (hunter) {
      hunter.stats.abilitiesUsed += 1;
      hunter.stats.killsTriggered += 1;
    }

    if (room.hunterRevenge.triggeredFromPhase === 'DAWN_SUMMARY') {
      room.lastNightCasualties.push(...shotCasualties);
    } else if (shotCasualties[0]) {
      room.lastExecutedPlayer = shotCasualties[0];
    }

    room.hunterRevenge.resolved = true;
    room.hunterRevenge.shotTargetId = target.id;

    const revealDeadRoles = room.config.revealDeadRoles !== false;
    const roleDef = ROLE_DEFINITIONS[target.role];
    this.appendSystemMessage(
      room,
      revealDeadRoles
        ? `💥 BANG! Ovçu ${hunter?.nickname ?? ''} son nəfəsində ${target.nickname} (${roleDef.icon} ${roleDef.nameAz}) oyunçusunu vurdu!`
        : `💥 BANG! Ovçu ${hunter?.nickname ?? ''} son nəfəsində ${target.nickname} oyunçusunu vurdu — Rolu gizlidir 🔒`
    );

    if (
      room.hunterRevenge.triggeredFromPhase === 'EXECUTION_REVEAL' &&
      room.dayNumber === 1
    ) {
      WinConditionChecker.convertSurvivingAngelsAfterDay1(room);
    }

    const winCheck = WinConditionChecker.check(room);
    if (winCheck.isGameOver) {
      this.enterGameOver(room, winCheck.winner!, winCheck.reason!);
    }

    return { valid: true };
  }

  /**
   * Advances the room after EXECUTION_REVEAL finishes into the next NIGHT_PHASE.
   */
  static completeExecutionAndLoopToNight(room: RoomState): void {
    if (room.dayNumber === 1) {
      WinConditionChecker.convertSurvivingAngelsAfterDay1(room);
    }
    const winCheck = WinConditionChecker.check(room);
    if (winCheck.isGameOver) {
      this.enterGameOver(room, winCheck.winner!, winCheck.reason!);
      return;
    }
    room.dayNumber += 1;
    this.enterNightPhase(room);
  }

  /**
   * Enters GAME_OVER, reveals all roles on the Victory Screen, and calculates MVP awards.
   */
  static enterGameOver(
    room: RoomState,
    winner: NonNullable<RoomState['winner']>,
    reason: string
  ): void {
    room.phase = 'GAME_OVER';
    room.phaseEndsAt = null;
    room.hunterRevenge = null;
    room.winner = winner;
    room.winReason = reason;

    for (const player of room.players) {
      player.revealedRole = player.role;
      player.isPeeking = false;
    }

    room.mvpAwards = WinConditionChecker.computeMvpAwards(room);
    this.appendSystemMessage(room, `🏆 OYUN BİTDİ — ${reason}`);
  }

  /**
   * Resets a finished room back to LOBBY while keeping all connected players in their seats.
   */
  static resetToLobby(room: RoomState): void {
    room.phase = 'LOBBY';
    room.dayNumber = 0;
    room.nightNumber = 0;
    room.phaseEndsAt = null;
    room.nightActions = createEmptyNightActions();
    room.witchPotions = { healAvailable: true, poisonAvailable: true };
    room.blackWolfInfectionAvailable = true;
    room.wolfAlertedThisNight = false;
    room.thiefExtraRoles = null;
    room.lovers = null;
    room.crowCursedPlayerId = null;
    room.villagePowersLost = false;
    room.anyWolfHasDied = false;
    room.lastNightCasualties = [];
    room.lastNightInfectedId = null;
    room.skipDiscussionVotes = [];
    room.dayVotes = {};
    room.lastExecutedPlayer = null;
    room.hunterRevenge = null;
    room.winner = null;
    room.winReason = null;
    room.mvpAwards = [];

    for (const player of room.players) {
      player.isAlive = true;
      player.role = 'VILLAGER';
      player.originalRole = 'VILLAGER';
      player.faction = 'VILLAGE';
      player.revealedRole = null;
      player.deathReason = null;
      player.diedAtPhase = null;
      player.diedOnDay = null;
      player.knownRoles = {};
      player.lastProtectedPlayerId = null;
      player.isPeeking = false;
      player.exposureLevel = 0;
      player.elderLivesRemaining = 1;
      player.foxPowerLost = false;
      player.lastFoxSniff = null;
      player.loverPartnerId = null;
      player.roleModelId = null;
      player.isMayor = false;
    }

    this.appendSystemMessage(
      room,
      '🔥 Tonqal Lobbisinə qayıdıldı. Rolları tənzimləyin və yeni oyuna başlayın!'
    );
  }

  static appendSystemMessage(room: RoomState, content: string): ChatMessage {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      senderId: 'SYSTEM',
      senderName: 'Campfire Narrator',
      senderColor: '#f59e0b',
      channel: 'system',
      channelBadge: '🔥 Sistem',
      content,
      timestamp: Date.now(),
    };
    room.messages.push(msg);
    if (room.messages.length > 200) {
      room.messages.shift();
    }
    return msg;
  }

  static getAllRoleKeys(): RoleType[] {
    return ALL_22_ROLES;
  }
}
