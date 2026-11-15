import crypto from 'node:crypto';
import {
  ALL_PLAYABLE_ROLES,
  FACTION_QUOTA_TABLE,
  NORMAL_SPECIAL_ROLES,
  QETIL_SPECIAL_ROLES,
  TEREFSIZ_ROLES,
} from '../constants/roles.js';
import {
  ChatChannel,
  ChatMessage,
  NightActionPayload,
  NightActionsState,
  NightCasualty,
  PhaseTimers,
  PlayerState,
  RoleType,
  RoomState,
  WinningFaction,
} from '../types/game.js';
import { CHANNEL_BADGES } from './ChatAuthorization.js';
import { NightResolver } from './roles/NightResolver.js';
import { getRoleStrategy } from './roles/RoleStrategies.js';
import { getFactionForRole, isWolfPackRole } from './roles/RoleStrategy.js';
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

export const DEFAULT_ENABLED_ROLES: Record<RoleType, boolean> = {
  VILLAGER: true,
  SEER: true,
  WITCH: true,
  GUARD: true,
  HUNTER: true,
  LITTLE_GIRL: true,
  WEREWOLF: true,
  BLACK_WOLF: true,
  MYSTIC_WOLF: true,
  ANGEL: true,
  WHITE_WOLF: true,
  ARSONIST: true,
};

export function createEmptyNightActions(): NightActionsState {
  return {
    wolfVotes: {},
    guardTargetId: null,
    seerTargetId: null,
    seerInspectedThisNight: false,
    mysticWolfTargetId: null,
    mysticWolfInspectedThisNight: false,
    witchHealUsedThisNight: false,
    witchPoisonTargetId: null,
    blackWolfInfectUsedThisNight: false,
    whiteWolfTargetId: null,
    arsonistActionThisNight: null,
    arsonistTargetId: null,
    submittedPlayerIds: [],
  };
}

export function createInitialRoomState(roomCode: string): RoomState {
  return {
    roomCode,
    createdAt: Date.now(),
    phase: 'LOBBY',
    dayNumber: 0,
    nightNumber: 0,
    phaseEndsAt: null,
    config: {
      timers: { ...DEFAULT_TIMERS },
      enabledRoles: { ...DEFAULT_ENABLED_ROLES },
      allowWebRTC: true,
      revealDeadRoles: true,
    },
    players: [],
    nightActions: createEmptyNightActions(),
    witchPotions: {
      healAvailable: true,
      poisonAvailable: true,
    },
    blackWolfInfectionAvailable: true,
    arsonistDousedIds: [],
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
    nickname: params.nickname,
    avatar: params.avatar,
    color: params.color,
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
    mysticWolfInspections: {},
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

/**
 * Cryptographic Fisher-Yates shuffle using `node:crypto` randomInt.
 */
function cryptoShuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export class GameEngine {
  static getAllRoleKeys(): RoleType[] {
    return [...ALL_PLAYABLE_ROLES];
  }

  /**
   * Automatic Faction-Quota Deck Builder (4–16 Players):
   * 1. Looks up exact (normal, qetil, terefsiz) quota from FACTION_QUOTA_TABLE[playerCount].
   * 2. Picks up to `terefsiz` unique enabled Tərəfsiz special roles (max 1 each).
   *    Any disabled shortage overflows into Normal filler slots.
   * 3. Picks up to `qetil` unique enabled Qətil special roles (max 1 each);
   *    remaining Qətil slots fill with base `WEREWOLF`.
   * 4. Picks up to adjusted `normal` unique enabled Normal special roles (max 1 each);
   *    remaining Normal slots fill with base `VILLAGER`.
   * 5. Cryptographically shuffles and returns the deck of length `playerCount`.
   */
  static buildRoleDeck(
    playerCount: number,
    enabledRoles: Record<RoleType, boolean>
  ): RoleType[] {
    const quota = FACTION_QUOTA_TABLE[playerCount];
    if (!quota) {
      throw new Error(
        `Oyunçu sayı 4 ilə 16 arasında olmalıdır (daxil olan: ${playerCount}).`
      );
    }

    // 1. Tərəfsiz (Neutral) Pool — max 1 per enabled special role
    const enabledTerefsiz = cryptoShuffle(
      TEREFSIZ_ROLES.filter((role) => Boolean(enabledRoles[role]))
    );
    const pickedTerefsiz = enabledTerefsiz.slice(0, quota.terefsiz);
    const terefsizShortage = quota.terefsiz - pickedTerefsiz.length;

    const adjustedNormalQuota = quota.normal + terefsizShortage;

    // 2. Qətil (Killer/Werewolf) Pool — max 1 per enabled special role, filled by WEREWOLF
    const enabledQetilSpecials = cryptoShuffle(
      QETIL_SPECIAL_ROLES.filter((role) => Boolean(enabledRoles[role]))
    );
    const pickedQetilSpecials = enabledQetilSpecials.slice(0, quota.qetil);
    const wolfFillerCount = quota.qetil - pickedQetilSpecials.length;
    const qetilDeck: RoleType[] = [
      ...pickedQetilSpecials,
      ...Array.from({ length: wolfFillerCount }, (): RoleType => 'WEREWOLF'),
    ];

    // 3. Normal (Village) Pool — max 1 per enabled special role, filled by VILLAGER
    const enabledNormalSpecials = cryptoShuffle(
      NORMAL_SPECIAL_ROLES.filter((role) => Boolean(enabledRoles[role]))
    );
    const pickedNormalSpecials = enabledNormalSpecials.slice(
      0,
      adjustedNormalQuota
    );
    const villagerFillerCount =
      adjustedNormalQuota - pickedNormalSpecials.length;
    const normalDeck: RoleType[] = [
      ...pickedNormalSpecials,
      ...Array.from({ length: villagerFillerCount }, (): RoleType => 'VILLAGER'),
    ];

    return cryptoShuffle([...normalDeck, ...qetilDeck, ...pickedTerefsiz]);
  }

  static startGame(room: RoomState): { valid: boolean; error?: string } {
    if (room.phase !== 'LOBBY') {
      return { valid: false, error: 'Oyun artıq davam edir.' };
    }

    if (room.players.length < 4 || room.players.length > 16) {
      return {
        valid: false,
        error: 'Oyuna başlamaq üçün 4 ilə 16 arası oyunçu olmalıdır.',
      };
    }

    const deck = GameEngine.buildRoleDeck(
      room.players.length,
      room.config.enabledRoles
    );

    room.players.forEach((player, index) => {
      const assignedRole = deck[index];
      player.seatIndex = index;
      player.isAlive = true;
      player.role = assignedRole;
      player.originalRole = assignedRole;
      player.faction = getFactionForRole(assignedRole);
      player.revealedRole = null;
      player.deathReason = null;
      player.diedAtPhase = null;
      player.diedOnDay = null;
      player.isSpeaking = false;
      player.isTyping = false;
      player.knownRoles = {};
      player.mysticWolfInspections = {};
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

    room.dayNumber = 1;
    room.nightNumber = 1;
    room.nightActions = createEmptyNightActions();
    room.witchPotions = {
      healAvailable: true,
      poisonAvailable: true,
    };
    room.blackWolfInfectionAvailable = true;
    room.arsonistDousedIds = [];
    room.wolfAlertedThisNight = false;
    room.wolfAliasMap = {};
    room.lastNightCasualties = [];
    room.lastNightInfectedId = null;
    room.skipDiscussionVotes = [];
    room.dayVotes = {};
    room.lastExecutedPlayer = null;
    room.hunterRevenge = null;
    room.winner = null;
    room.winReason = null;
    room.mvpAwards = [];
    room.messages = [];

    room.phase = 'ROLE_REVEAL';
    room.phaseEndsAt = Date.now() + room.config.timers.roleReveal * 1000;

    GameEngine.appendSystemMessage(
      room,
      `🔥 Oyun başladı! ${room.players.length} oyunçu tonqal ətrafına toplaşdı. Gizli rollar paylandı.`
    );

    return { valid: true };
  }

  static enterNightPhase(room: RoomState): { gameEnded: boolean } {
    const winCheck = WinConditionChecker.check(room);
    if (winCheck.isGameOver && winCheck.winner) {
      GameEngine.enterGameOver(room, winCheck.winner, winCheck.reason ?? '');
      return { gameEnded: true };
    }

    // If Night 2 begins and an Angel survived Day 1 without winning, convert to VILLAGER
    if (room.nightNumber >= 2) {
      const convertedAngelIds =
        WinConditionChecker.convertSurvivingAngelsAfterDay1(room);
      for (const id of convertedAngelIds) {
        const angel = room.players.find((p) => p.id === id);
        if (angel) {
          GameEngine.appendSystemMessage(
            room,
            `😇 ${angel.nickname} 1-ci gündə edam olunmadığı üçün adi Kəndliyə çevrildi.`
          );
        }
      }
    }

    // Assign anonymized aliases ("Wolf 1", "Wolf 2", ...) for Little Girl peek chat
    room.wolfAliasMap = {};
    let wolfCounter = 1;
    const sortedPlayers = [...room.players].sort(
      (a, b) => a.seatIndex - b.seatIndex
    );
    for (const player of sortedPlayers) {
      player.isPeeking = false;
      if (player.isAlive && isWolfPackRole(player.role)) {
        room.wolfAliasMap[player.id] = `Wolf ${wolfCounter++}`;
      }
    }

    room.nightActions = createEmptyNightActions();
    room.wolfAlertedThisNight = false;
    room.lastNightCasualties = [];
    room.lastNightInfectedId = null;
    room.skipDiscussionVotes = [];
    room.dayVotes = {};
    room.lastExecutedPlayer = null;
    room.hunterRevenge = null;

    room.phase = 'NIGHT_PHASE';
    room.phaseEndsAt = Date.now() + room.config.timers.nightPhase * 1000;

    GameEngine.appendSystemMessage(
      room,
      `🌙 ${room.nightNumber}-ci Gecə düşdü. Kənd yatır, gizli rollar oyanır...`
    );

    return { gameEnded: false };
  }

  static submitNightAction(
    room: RoomState,
    actorId: string,
    payload: NightActionPayload
  ): { valid: boolean; error?: string; allActed: boolean } {
    if (room.phase !== 'NIGHT_PHASE') {
      return {
        valid: false,
        error: 'Gecə qabiliyyətləri yalnız gecə mərhələsində işlədilir.',
        allActed: false,
      };
    }

    const actor = room.players.find((p) => p.id === actorId);
    if (!actor || !actor.isAlive) {
      return {
        valid: false,
        error: 'Yalnız sağ olan oyunçular gecə hərəkəti edə bilər.',
        allActed: false,
      };
    }

    const strategy = getRoleStrategy(actor.role);
    if (!strategy.canActAtNight(room, actor)) {
      return {
        valid: false,
        error: 'Hazırda gecə aktiv qabiliyyətiniz mövcud deyil.',
        allActed: false,
      };
    }

    const validation = strategy.validateNightAction(room, actor, payload);
    if (!validation.valid) {
      return {
        valid: false,
        error: validation.error,
        allActed: false,
      };
    }

    strategy.recordNightInput(room, actor, payload);

    return {
      valid: true,
      allActed: GameEngine.haveAllRequiredNightActorsActed(room),
    };
  }

  /**
   * Checks whether all mandatory active night roles (including wolves, Seer, Guard,
   * Mystic Wolf, Arsonist, and Witch if she still holds a potion) have submitted.
   */
  private static haveAllRequiredNightActorsActed(room: RoomState): boolean {
    const submitted = new Set(room.nightActions.submittedPlayerIds);
    for (const player of room.players) {
      if (!player.isAlive) continue;

      if (isWolfPackRole(player.role)) {
        if (!room.nightActions.wolfVotes[player.id]) return false;
        continue;
      }

      if (
        player.role === 'SEER' ||
        player.role === 'GUARD' ||
        player.role === 'ARSONIST'
      ) {
        if (!submitted.has(player.id)) return false;
        continue;
      }

      if (player.role === 'WITCH') {
        const hasAnyPotion =
          room.witchPotions.healAvailable || room.witchPotions.poisonAvailable;
        if (hasAnyPotion && !submitted.has(player.id)) {
          return false;
        }
      }
    }
    return true;
  }

  static toggleLittleGirlPeek(
    room: RoomState,
    playerId: string,
    isPeeking: boolean
  ): { valid: boolean; error?: string } {
    if (room.phase !== 'NIGHT_PHASE') {
      return {
        valid: false,
        error: 'Gizli izləmə yalnız gecə mərhələsində mümkündür.',
      };
    }

    const player = room.players.find((p) => p.id === playerId);
    if (!player || !player.isAlive || player.role !== 'LITTLE_GIRL') {
      return {
        valid: false,
        error: 'Yalnız sağ olan Kiçik Qız gizlicə baxa bilər.',
      };
    }

    player.isPeeking = isPeeking;
    return { valid: true };
  }

  static tickLittleGirlExposure(
    room: RoomState,
    rng: () => number = Math.random
  ): { exposureLevel: number; wolfAlertTriggered: boolean } {
    if (room.phase !== 'NIGHT_PHASE') {
      return { exposureLevel: 0, wolfAlertTriggered: false };
    }

    const peekingGirl = room.players.find(
      (p) => p.isAlive && p.role === 'LITTLE_GIRL' && p.isPeeking
    );
    if (!peekingGirl) {
      return { exposureLevel: 0, wolfAlertTriggered: false };
    }

    peekingGirl.exposureLevel = Math.min(100, peekingGirl.exposureLevel + 15);
    const detectionProbability = Math.min(
      0.85,
      (peekingGirl.exposureLevel / 100) * 0.5
    );

    const triggered =
      !room.wolfAlertedThisNight &&
      (rng() < detectionProbability || peekingGirl.exposureLevel >= 85);

    if (triggered) {
      room.wolfAlertedThisNight = true;
      GameEngine.appendSystemMessage(
        room,
        '⚠️ Qətillər! Qaranlıqda kimsə canavar söhbətinizi gizlicə izləyir!',
        'wolves'
      );
    }

    return {
      exposureLevel: peekingGirl.exposureLevel,
      wolfAlertTriggered: triggered,
    };
  }

  static resolveNightAndEnterDawn(room: RoomState): {
    casualties: NightCasualty[];
    hunterTriggered: boolean;
    gameEnded: boolean;
  } {
    const context = NightResolver.resolve(room);

    for (const player of room.players) {
      player.isPeeking = false;
      if (player.isAlive) {
        player.stats.nightsSurvived += 1;
      }
    }

    // Keep doused list synced to living players only
    const aliveSet = new Set(
      room.players.filter((p) => p.isAlive).map((p) => p.id)
    );
    room.arsonistDousedIds = room.arsonistDousedIds.filter((id) =>
      aliveSet.has(id)
    );

    room.lastNightCasualties = context.casualties;
    room.lastNightInfectedId = context.infectedPlayerId;

    if (context.casualties.length === 0) {
      GameEngine.appendSystemMessage(
        room,
        `🌅 ${room.dayNumber}-ci Gün açıldı — bu gecə kənddə heç kim ölmədi!`
      );
    } else {
      for (const c of context.casualties) {
        const rolePart =
          room.config.revealDeadRoles && c.role !== 'UNKNOWN'
            ? `Rolu: ${c.role}`
            : 'Rolu gizlidir 🔒';
        GameEngine.appendSystemMessage(
          room,
          `💀 ${c.nickname} gecə həlak oldu — ${rolePart}.`
        );
      }
    }

    const deadHunter = context.casualties
      .map((c) => room.players.find((p) => p.id === c.playerId))
      .find((p) => p && p.role === 'HUNTER');

    if (deadHunter) {
      const endsAt = Date.now() + room.config.timers.hunterRevenge * 1000;
      room.hunterRevenge = {
        hunterId: deadHunter.id,
        triggeredFromPhase: 'DAWN_SUMMARY',
        endsAt,
        resolved: false,
        shotTargetId: null,
      };
      room.phase = 'DAWN_SUMMARY';
      room.phaseEndsAt = endsAt;
      GameEngine.appendSystemMessage(
        room,
        `🏹 ${deadHunter.nickname} (Ovçu) ölərkən son gülləsini atmaq üçün 15 saniyə ərzində hədəf seçir!`
      );
      return {
        casualties: context.casualties,
        hunterTriggered: true,
        gameEnded: false,
      };
    }

    room.phase = 'DAWN_SUMMARY';
    room.phaseEndsAt = Date.now() + room.config.timers.dawnSummary * 1000;

    return {
      casualties: context.casualties,
      hunterTriggered: false,
      gameEnded: false,
    };
  }

  static resolveHunterShot(
    room: RoomState,
    hunterId: string,
    targetId: string | null
  ): { valid: boolean; error?: string; gameEnded: boolean } {
    if (!room.hunterRevenge || room.hunterRevenge.resolved) {
      return {
        valid: false,
        error: 'Aktiv Ovçu intiqamı gözlənilmir.',
        gameEnded: false,
      };
    }

    if (room.hunterRevenge.hunterId !== hunterId) {
      return {
        valid: false,
        error: 'Bu atışı yalnız ölən Ovçu edə bilər.',
        gameEnded: false,
      };
    }

    const hunter = room.players.find((p) => p.id === hunterId);
    room.hunterRevenge.resolved = true;

    if (targetId) {
      const target = room.players.find((p) => p.id === targetId && p.isAlive);
      if (!target) {
        room.hunterRevenge.resolved = false;
        return {
          valid: false,
          error: 'Atəş açmaq üçün canlı oyunçu seçməlisiniz.',
          gameEnded: false,
        };
      }

      room.hunterRevenge.shotTargetId = target.id;
      if (hunter) {
        hunter.stats.abilitiesUsed += 1;
        hunter.stats.killsTriggered += 1;
      }

      const shotList: NightCasualty[] = [];
      NightResolver.eliminatePlayer(
        room,
        target.id,
        'HUNTER_SHOT',
        room.phase,
        shotList
      );

      room.arsonistDousedIds = room.arsonistDousedIds.filter((id) =>
        room.players.some((p) => p.id === id && p.isAlive)
      );

      if (room.hunterRevenge.triggeredFromPhase === 'DAWN_SUMMARY') {
        room.lastNightCasualties.push(...shotList);
      }

      const revealedInfo =
        room.config.revealDeadRoles && target.revealedRole
          ? `Rolu: ${target.revealedRole}`
          : 'Rolu gizlidir 🔒';
      GameEngine.appendSystemMessage(
        room,
        `💥 ${hunter?.nickname ?? 'Ovçu'} son nəfəsində ${target.nickname} adlı oyunçunu vurdu — ${revealedInfo}!`
      );
    } else {
      GameEngine.appendSystemMessage(
        room,
        `🏹 ${hunter?.nickname ?? 'Ovçu'} vaxt bitdiyi üçün heç kimə atəş açmadı.`
      );
    }

    const winCheck = WinConditionChecker.check(room);
    if (winCheck.isGameOver && winCheck.winner) {
      GameEngine.enterGameOver(room, winCheck.winner, winCheck.reason ?? '');
      return { valid: true, gameEnded: true };
    }

    room.hunterRevenge = null;
    room.phaseEndsAt =
      Date.now() +
      (room.phase === 'DAWN_SUMMARY'
        ? room.config.timers.dawnSummary
        : room.config.timers.executionReveal) *
        1000;

    return { valid: true, gameEnded: false };
  }

  static enterDayDiscussion(room: RoomState): { gameEnded: boolean } {
    const winCheck = WinConditionChecker.check(room);
    if (winCheck.isGameOver && winCheck.winner) {
      GameEngine.enterGameOver(room, winCheck.winner, winCheck.reason ?? '');
      return { gameEnded: true };
    }

    room.phase = 'DAY_DISCUSSION';
    room.skipDiscussionVotes = [];
    room.phaseEndsAt = Date.now() + room.config.timers.dayDiscussion * 1000;

    GameEngine.appendSystemMessage(
      room,
      `☀️ ${room.dayNumber}-ci Günün müzakirəsi başladı. Şübhəliləri müzakirə edin!`
    );

    return { gameEnded: false };
  }

  static toggleSkipDiscussion(
    room: RoomState,
    playerId: string
  ): { valid: boolean; error?: string; transitionedToVoting: boolean } {
    if (room.phase !== 'DAY_DISCUSSION') {
      return {
        valid: false,
        error: 'Yalnız müzakirə mərhələsində keçmək üçün səs verə bilərsiniz.',
        transitionedToVoting: false,
      };
    }

    const player = room.players.find((p) => p.id === playerId && p.isAlive);
    if (!player) {
      return {
        valid: false,
        error: 'Yalnız sağ oyunçular müzakirəni tez bitirə bilər.',
        transitionedToVoting: false,
      };
    }

    const idx = room.skipDiscussionVotes.indexOf(playerId);
    if (idx === -1) {
      room.skipDiscussionVotes.push(playerId);
    } else {
      room.skipDiscussionVotes.splice(idx, 1);
    }

    const aliveCount = room.players.filter((p) => p.isAlive).length;
    if (room.skipDiscussionVotes.length > aliveCount / 2) {
      GameEngine.enterDayVoting(room);
      return { valid: true, transitionedToVoting: true };
    }

    return { valid: true, transitionedToVoting: false };
  }

  static enterDayVoting(room: RoomState): void {
    room.phase = 'DAY_VOTING';
    room.dayVotes = {};
    room.phaseEndsAt = Date.now() + room.config.timers.dayVoting * 1000;

    GameEngine.appendSystemMessage(
      room,
      `🗳️ Səsvermə başladı! Kimi edam edəcəksiniz? (${room.config.timers.dayVoting}s)`
    );
  }

  static castDayVote(
    room: RoomState,
    voterId: string,
    targetId: string | 'SKIP' | null
  ): { valid: boolean; error?: string } {
    if (room.phase !== 'DAY_VOTING') {
      return {
        valid: false,
        error: 'Səsvermə yalnız səsvermə mərhələsində mümkündür.',
      };
    }

    const voter = room.players.find((p) => p.id === voterId && p.isAlive);
    if (!voter) {
      return {
        valid: false,
        error: 'Yalnız sağ olan oyunçular səs verə bilər.',
      };
    }

    if (targetId === null) {
      delete room.dayVotes[voterId];
      return { valid: true };
    }

    if (targetId !== 'SKIP') {
      const target = room.players.find((p) => p.id === targetId && p.isAlive);
      if (!target) {
        return {
          valid: false,
          error: 'Yalnız sağ olan oyunçuya səs verə bilərsiniz.',
        };
      }
      if (target.id === voter.id) {
        return { valid: false, error: 'Özünüzə səs verə bilməzsiniz.' };
      }
    }

    const isFirstVoteThisDay = !(voterId in room.dayVotes);
    room.dayVotes[voterId] = targetId;

    if (isFirstVoteThisDay && targetId !== 'SKIP') {
      voter.stats.votesCast += 1;
      const target = room.players.find((p) => p.id === targetId);
      if (target && isWolfPackRole(target.role)) {
        voter.stats.correctWolfVotes += 1;
      }
    }

    return { valid: true };
  }

  static resolveDayVotesAndEnterExecution(room: RoomState): {
    executedPlayer: NightCasualty | null;
    hunterTriggered: boolean;
    gameEnded: boolean;
  } {
    const tally = new Map<string, number>();

    for (const [voterId, targetId] of Object.entries(room.dayVotes)) {
      const voter = room.players.find((p) => p.id === voterId && p.isAlive);
      if (!voter || targetId === 'SKIP') continue;
      const target = room.players.find((p) => p.id === targetId && p.isAlive);
      if (!target) continue;

      tally.set(target.id, (tally.get(target.id) ?? 0) + 1);
    }

    let topCandidateId: string | null = null;
    let topVotes = 0;
    let tie = false;

    for (const [candidateId, count] of tally.entries()) {
      if (count > topVotes) {
        topVotes = count;
        topCandidateId = candidateId;
        tie = false;
      } else if (count === topVotes && count > 0) {
        tie = true;
      }
    }

    room.lastExecutedPlayer = null;
    room.phase = 'EXECUTION_REVEAL';

    if (!topCandidateId || tie || topVotes === 0) {
      room.phaseEndsAt =
        Date.now() + room.config.timers.executionReveal * 1000;
      GameEngine.appendSystemMessage(
        room,
        tie
          ? '⚖️ Səslər bərabər bölündü — bu gün heç kim edam edilmədi.'
          : '🕊️ Kənd bu gün heç kimi edam etməmək qərarına gəldi.'
      );
      return {
        executedPlayer: null,
        hunterTriggered: false,
        gameEnded: false,
      };
    }

    const tempCasualties: NightCasualty[] = [];
    const executed = NightResolver.eliminatePlayer(
      room,
      topCandidateId,
      'EXECUTION',
      'EXECUTION_REVEAL',
      tempCasualties
    );

    if (!executed || tempCasualties.length === 0) {
      room.phaseEndsAt =
        Date.now() + room.config.timers.executionReveal * 1000;
      return {
        executedPlayer: null,
        hunterTriggered: false,
        gameEnded: false,
      };
    }

    room.lastExecutedPlayer = tempCasualties[0];
    room.arsonistDousedIds = room.arsonistDousedIds.filter((id) =>
      room.players.some((p) => p.id === id && p.isAlive)
    );

    const rolePart =
      room.config.revealDeadRoles && room.lastExecutedPlayer.role !== 'UNKNOWN'
        ? `Rolu: ${room.lastExecutedPlayer.role}`
        : 'Rolu gizlidir 🔒';
    GameEngine.appendSystemMessage(
      room,
      `🔨 ${executed.nickname} səsvermə ilə edam edildi (${topVotes} səs) — ${rolePart}.`
    );

    // 1. Check Day 1 Angel immediate solo win BEFORE anything else
    if (executed.role === 'ANGEL' && room.dayNumber === 1) {
      const angelWin = WinConditionChecker.check(room, {
        justExecutedPlayerId: executed.id,
      });
      if (angelWin.isGameOver && angelWin.winner) {
        GameEngine.enterGameOver(
          room,
          angelWin.winner,
          angelWin.reason ?? ''
        );
        return {
          executedPlayer: room.lastExecutedPlayer,
          hunterTriggered: false,
          gameEnded: true,
        };
      }
    }

    // 2. Check dying Hunter 15-second revenge shot
    if (executed.role === 'HUNTER') {
      const endsAt = Date.now() + room.config.timers.hunterRevenge * 1000;
      room.hunterRevenge = {
        hunterId: executed.id,
        triggeredFromPhase: 'EXECUTION_REVEAL',
        endsAt,
        resolved: false,
        shotTargetId: null,
      };
      room.phaseEndsAt = endsAt;
      GameEngine.appendSystemMessage(
        room,
        `🏹 ${executed.nickname} (Ovçu) edam edilərkən son gülləsini atmaq üçün hədəf seçir!`
      );
      return {
        executedPlayer: room.lastExecutedPlayer,
        hunterTriggered: true,
        gameEnded: false,
      };
    }

    // 3. Check standard win conditions
    const winCheck = WinConditionChecker.check(room);
    if (winCheck.isGameOver && winCheck.winner) {
      GameEngine.enterGameOver(room, winCheck.winner, winCheck.reason ?? '');
      return {
        executedPlayer: room.lastExecutedPlayer,
        hunterTriggered: false,
        gameEnded: true,
      };
    }

    room.phaseEndsAt = Date.now() + room.config.timers.executionReveal * 1000;
    return {
      executedPlayer: room.lastExecutedPlayer,
      hunterTriggered: false,
      gameEnded: false,
    };
  }

  static completeExecutionAndLoopToNight(room: RoomState): {
    gameEnded: boolean;
  } {
    const winCheck = WinConditionChecker.check(room);
    if (winCheck.isGameOver && winCheck.winner) {
      GameEngine.enterGameOver(room, winCheck.winner, winCheck.reason ?? '');
      return { gameEnded: true };
    }

    room.dayNumber += 1;
    room.nightNumber += 1;
    return GameEngine.enterNightPhase(room);
  }

  static enterGameOver(
    room: RoomState,
    winner: WinningFaction,
    reason: string
  ): void {
    room.phase = 'GAME_OVER';
    room.phaseEndsAt = null;
    room.hunterRevenge = null;
    room.winner = winner;
    room.winReason = reason;
    room.mvpAwards = WinConditionChecker.computeMvpAwards(room);

    // Reveal everyone's role on Game Over
    for (const player of room.players) {
      player.revealedRole = player.role;
    }

    GameEngine.appendSystemMessage(room, `🏆 OYUN BİTDİ: ${reason}`);
  }

  static resetToLobby(room: RoomState): void {
    room.phase = 'LOBBY';
    room.dayNumber = 0;
    room.nightNumber = 0;
    room.phaseEndsAt = null;
    room.nightActions = createEmptyNightActions();
    room.witchPotions = { healAvailable: true, poisonAvailable: true };
    room.blackWolfInfectionAvailable = true;
    room.arsonistDousedIds = [];
    room.wolfAlertedThisNight = false;
    room.wolfAliasMap = {};
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
      player.isSpeaking = false;
      player.isTyping = false;
      player.knownRoles = {};
      player.mysticWolfInspections = {};
      player.lastProtectedPlayerId = null;
      player.isPeeking = false;
      player.exposureLevel = 0;
    }

    GameEngine.appendSystemMessage(
      room,
      '🔥 Oyunçular yeni matç üçün lobbiyə qayıtdı!'
    );
  }

  static appendSystemMessage(
    room: RoomState,
    content: string,
    channel: ChatChannel = 'system'
  ): ChatMessage {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      senderId: 'SYSTEM',
      senderName:
        channel === 'wolves' ? 'Qətil Səsi' : 'Tonqal Bələdçisi',
      senderColor: channel === 'wolves' ? '#ef4444' : '#f59e0b',
      channel,
      channelBadge: CHANNEL_BADGES[channel],
      content,
      timestamp: Date.now(),
    };
    room.messages.push(msg);
    if (room.messages.length > 250) {
      room.messages.splice(0, room.messages.length - 250);
    }
    return msg;
  }
}
