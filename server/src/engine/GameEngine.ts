import crypto from 'node:crypto';
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
import { formatDeathCause, NightResolver } from './roles/NightResolver.js';
import { getFactionForRole, isWolfPackRole } from './roles/RoleStrategy.js';
import { getRoleStrategy } from './roles/RoleStrategies.js';
import { ValidationResult } from './roles/RoleStrategy.js';
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
  WEREWOLF: 1,
  BLACK_WOLF: 0,
  WHITE_WOLF: 0,
  SEER: 1,
  WITCH: 1,
  GUARD: 1,
  HUNTER: 0,
  LITTLE_GIRL: 0,
  ANGEL: 0,
  VILLAGER: 2,
};

export function createEmptyNightActions(): NightActionsState {
  return {
    wolfVotes: {},
    guardTargetId: null,
    seerTargetId: null,
    seerInspectedThisNight: false,
    witchHealUsedThisNight: false,
    witchPoisonTargetId: null,
    blackWolfInfectUsedThisNight: false,
    whiteWolfTargetId: null,
    submittedPlayerIds: [],
  };
}

export function createInitialRoomState(roomCode: string): RoomState {
  const defaultConfig: RoomConfig = {
    timers: { ...DEFAULT_TIMERS },
    enabledRoles: { ...DEFAULT_ENABLED_ROLES },
    allowWebRTC: true,
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

    for (const role of priorityRoles) {
      const count = Math.max(0, Math.floor(enabledRoles[role] ?? 0));
      for (let i = 0; i < count; i++) {
        deck.push(role);
      }
    }

    // Ensure at least one wolf exists
    if (!deck.some((r) => isWolfPackRole(r))) {
      deck.unshift('WEREWOLF');
    }

    // Trim or pad with VILLAGER to match exact player count
    if (deck.length > playerCount) {
      deck.length = playerCount;
    }
    while (deck.length < playerCount) {
      deck.push('VILLAGER');
    }

    // Fisher-Yates shuffle
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
    if (room.players.length < 4 || room.players.length > 12) {
      return {
        valid: false,
        error: 'Campfire Wolves requires between 4 and 12 players to start.',
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
      player.stats = {
        votesCast: 0,
        correctWolfVotes: 0,
        nightsSurvived: 0,
        abilitiesUsed: 0,
        killsTriggered: 0,
      };
    });

    room.phase = 'ROLE_REVEAL';
    room.phaseEndsAt = Date.now() + room.config.timers.roleReveal * 1000;
    this.appendSystemMessage(
      room,
      'The campfire crackles as night approaches. Inspect your secret role card!'
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

    // Assign anonymized aliases ("Wolf 1", "Wolf 2", ...) for Little Girl peeking
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
      `Night ${room.nightNumber} falls over the forest. The campfire dims to embers...`
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

    // Base 6% chance per second, scaling up slightly with exposure
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

    if (room.lastNightInfectedId) {
      const infected = room.players.find((p) => p.id === room.lastNightInfectedId);
      if (infected) {
        // Note: public message stays peaceful; private state notifies the infected player
      }
    }

    if (resolution.casualties.length === 0) {
      this.appendSystemMessage(
        room,
        `Dawn breaks on Day ${room.dayNumber}. It was a peaceful night—no one died!`
      );
    } else {
      const summary = resolution.casualties
        .map((c) => `${c.nickname} (${c.role})`)
        .join(', ');
      this.appendSystemMessage(
        room,
        `Dawn breaks on Day ${room.dayNumber}. Tragic news: ${summary} perished in the night!`
      );
    }

    // Check if a Hunter died during the night
    const deadHunterCasualty = resolution.casualties.find(
      (c) => c.role === 'HUNTER'
    );
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
        `🎯 ${deadHunterCasualty.nickname} was the Hunter! They have ${room.config.timers.hunterRevenge}s to fire their final revenge shot!`
      );
      return;
    }

    // Otherwise check win conditions immediately at Dawn
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
      `Day ${room.dayNumber} Discussion has begun. Debate around the campfire who among you is a Werewolf!`
    );
  }

  /**
   * Toggles a player's vote to end DAY_DISCUSSION early.
   * Returns true if >50% of alive players have agreed to skip straight to DAY_VOTING.
   */
  static toggleSkipDiscussion(room: RoomState, playerId: string): {
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

    // >50% of alive players agree -> skip straight to voting
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
      `Voting has begun! Select a player around the campfire to eliminate, or choose Skip Vote.`
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
   * Ties result in no elimination.
   */
  static resolveDayVotesAndEnterExecution(room: RoomState): void {
    room.phase = 'EXECUTION_REVEAL';
    room.lastExecutedPlayer = null;

    const voteCounts = new Map<string, number>();
    let skipCount = 0;

    for (const [voterId, targetId] of Object.entries(room.dayVotes)) {
      const voter = room.players.find((p) => p.id === voterId && p.isAlive);
      if (!voter) continue;

      voter.stats.votesCast += 1;

      if (targetId === 'SKIP') {
        skipCount += 1;
        continue;
      }

      const target = room.players.find((p) => p.id === targetId && p.isAlive);
      if (!target) continue;

      if (isWolfPackRole(target.role)) {
        voter.stats.correctWolfVotes += 1;
      }

      voteCounts.set(target.id, (voteCounts.get(target.id) ?? 0) + 1);
    }

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

    // Tie or skip plurality or zero votes -> no elimination
    const isTie = topCandidates.length !== 1 || highestVotes === 0 || skipCount >= highestVotes;

    if (isTie) {
      this.appendSystemMessage(
        room,
        'The village vote ended in indecision or a tie. No one is executed today!'
      );
    } else {
      const executedId = topCandidates[0];
      const executedPlayer = room.players.find((p) => p.id === executedId);
      if (executedPlayer) {
        executedPlayer.isAlive = false;
        executedPlayer.isPeeking = false;
        executedPlayer.revealedRole = executedPlayer.role;
        executedPlayer.diedAtPhase = 'EXECUTION_REVEAL';
        executedPlayer.diedOnDay = room.dayNumber;
        executedPlayer.deathReason = formatDeathCause('EXECUTION');

        room.lastExecutedPlayer = {
          playerId: executedPlayer.id,
          nickname: executedPlayer.nickname,
          role: executedPlayer.role,
          cause: 'EXECUTION',
        };

        this.appendSystemMessage(
          room,
          `⚖️ The village has spoken! ${executedPlayer.nickname} was executed. Their true role was ${executedPlayer.role}!`
        );

        // Check Day 1 Angel instant win BEFORE anything else
        const angelWinCheck = WinConditionChecker.check(room, {
          justExecutedPlayerId: executedPlayer.id,
        });
        if (angelWinCheck.isGameOver && angelWinCheck.winner === 'ANGEL') {
          this.enterGameOver(room, angelWinCheck.winner, angelWinCheck.reason!);
          return;
        }

        // Check if executed player is the Hunter
        const hasLivingTargets = room.players.some((p) => p.isAlive);
        if (executedPlayer.role === 'HUNTER' && hasLivingTargets) {
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
            `🎯 ${executedPlayer.nickname} was the Hunter! They have ${room.config.timers.hunterRevenge}s to fire their final revenge shot!`
          );
          return;
        }
      }
    }

    // If Day 1 has concluded without Angel winning, convert surviving Angels into standard Villagers
    if (room.dayNumber === 1) {
      const convertedIds = WinConditionChecker.convertSurvivingAngelsAfterDay1(room);
      if (convertedIds.length > 0) {
        this.appendSystemMessage(
          room,
          'Day 1 has passed—any surviving Angel has lost their grace and become a standard Villager.'
        );
      }
    }

    // Check standard win conditions
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

    target.isAlive = false;
    target.isPeeking = false;
    target.revealedRole = target.role;
    target.diedAtPhase = room.phase;
    target.diedOnDay = room.dayNumber;
    target.deathReason = formatDeathCause('HUNTER_SHOT');

    if (hunter) {
      hunter.stats.abilitiesUsed += 1;
      hunter.stats.killsTriggered += 1;
    }

    const shotCasualty = {
      playerId: target.id,
      nickname: target.nickname,
      role: target.role,
      cause: 'HUNTER_SHOT' as const,
    };

    if (room.hunterRevenge.triggeredFromPhase === 'DAWN_SUMMARY') {
      room.lastNightCasualties.push(shotCasualty);
    } else {
      room.lastExecutedPlayer = shotCasualty;
    }

    room.hunterRevenge.resolved = true;
    room.hunterRevenge.shotTargetId = target.id;

    this.appendSystemMessage(
      room,
      `💥 BANG! With their final breath, Hunter ${hunter?.nickname ?? ''} shot ${target.nickname} (${target.role})!`
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
   * Enters GAME_OVER, reveals all roles, and calculates MVP awards.
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
    this.appendSystemMessage(room, `🏆 GAME OVER — ${reason}`);
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
    }

    this.appendSystemMessage(
      room,
      'Returned to the Campfire Lobby. Configure the deck and start a new match!'
    );
  }

  static appendSystemMessage(room: RoomState, content: string): ChatMessage {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      senderId: 'SYSTEM',
      senderName: 'Campfire Narrator',
      senderColor: '#f59e0b',
      channel: 'SYSTEM',
      content,
      timestamp: Date.now(),
    };
    room.messages.push(msg);
    if (room.messages.length > 200) {
      room.messages.shift();
    }
    return msg;
  }
}
