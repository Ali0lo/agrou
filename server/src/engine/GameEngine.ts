import crypto from 'node:crypto';
import {
  ALL_PLAYABLE_ROLES,
  FACTION_QUOTA_TABLE,
  NORMAL_SPECIAL_ROLES,
  QATIL_SPECIAL_ROLES,
  TEREFSIZ_ROLES,
} from '../constants/roles.js';
import {
  ChatChannel,
  ChatMessage,
  DeathCause,
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
import {
  getFactionForRole,
  isQatilFactionRole,
  isWolfPackRole,
} from './roles/RoleStrategy.js';
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
  ELDER: true,
  BEAR_TAMER: true,
  CROW: true,
  CUPID: true,
  WEREWOLF: true,
  BLACK_WOLF: true,
  MYSTIC_WOLF: true,
  VENGEFUL_WOLF: true,
  SHADOW_WOLF: true,
  ANGEL: true,
  WHITE_WOLF: true,
  ARSONIST: true,
  JESTER: true,
  WILD_CHILD: true,
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
    crowTargetId: null,
    cupidTargetIds: null,
    wildChildModelId: null,
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
    shadowWolfAbilityAvailable: true,
    dayVotesHidden: false,
    villagePowersLost: false,
    lastBearGrowled: false,
    cursedPlayerId: null,
    cupidLinked: false,
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
    elderLivesRemaining: 2,
    loverPartnerId: null,
    roleModelId: null,
    transformedFromWildChild: false,
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
   * 1. Looks up exact (normal, qatil, terefsiz) quota from FACTION_QUOTA_TABLE[playerCount].
   * 2. Picks up to `terefsiz` unique enabled Tərəfsiz special roles (max 1 each).
   *    Any disabled shortage overflows into Normal filler slots.
   * 3. Picks up to `qatil` unique enabled Qatil special roles (max 1 each);
   *    remaining Qatil slots fill with base `WEREWOLF`.
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

    // 2. Qatil (Killer/Werewolf) Pool — max 1 per enabled special role, filled by WEREWOLF
    const enabledQatilSpecials = cryptoShuffle(
      QATIL_SPECIAL_ROLES.filter((role) => Boolean(enabledRoles[role]))
    );
    const pickedQatilSpecials = enabledQatilSpecials.slice(0, quota.qatil);
    const wolfFillerCount = quota.qatil - pickedQatilSpecials.length;
    const qatilDeck: RoleType[] = [
      ...pickedQatilSpecials,
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

    return cryptoShuffle([...normalDeck, ...qatilDeck, ...pickedTerefsiz]);
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
      player.elderLivesRemaining = assignedRole === 'ELDER' ? 2 : 1;
      player.loverPartnerId = null;
      player.roleModelId = null;
      player.transformedFromWildChild = false;
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
    room.shadowWolfAbilityAvailable = true;
    room.dayVotesHidden = false;
    room.villagePowersLost = false;
    room.lastBearGrowled = false;
    room.cursedPlayerId = null;
    room.cupidLinked = false;
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
    room.dayVotesHidden = false;
    room.lastBearGrowled = false;
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
   * Checks whether all mandatory active night roles have submitted.
   */
  private static haveAllRequiredNightActorsActed(room: RoomState): boolean {
    const submitted = new Set(room.nightActions.submittedPlayerIds);
    for (const player of room.players) {
      if (!player.isAlive) continue;

      if (isWolfPackRole(player.role)) {
        if (!room.nightActions.wolfVotes[player.id]) return false;
        continue;
      }

      if (player.role === 'ARSONIST') {
        if (!submitted.has(player.id)) return false;
        continue;
      }

      if (
        !room.villagePowersLost &&
        (player.role === 'SEER' ||
          player.role === 'GUARD' ||
          player.role === 'CROW')
      ) {
        if (!submitted.has(player.id)) return false;
        continue;
      }

      if (
        !room.villagePowersLost &&
        player.role === 'CUPID' &&
        room.nightNumber === 1 &&
        !room.cupidLinked
      ) {
        if (!submitted.has(player.id)) return false;
        continue;
      }

      if (
        player.role === 'WILD_CHILD' &&
        room.nightNumber === 1 &&
        !player.roleModelId
      ) {
        if (!submitted.has(player.id)) return false;
        continue;
      }

      if (!room.villagePowersLost && player.role === 'WITCH') {
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

    if (room.villagePowersLost) {
      return {
        valid: false,
        error: 'Ağsaqqal edam edildiyi üçün Normal rolların xüsusi gücləri itirilib.',
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
        '⚠️ Qatillər! Qaranlıqda kimsə canavar söhbətinizi gizlicə izləyir!',
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

    // Notify Cupid Lovers in private chat on Night 1 -> Dawn 1 if linked and alive
    if (room.nightNumber === 1 && room.cupidLinked) {
      const aliveLovers = room.players.filter(
        (p) => p.isAlive && Boolean(p.loverPartnerId)
      );
      if (aliveLovers.length === 2) {
        GameEngine.appendSystemMessage(
          room,
          `💘 Kupid sizi Aşiq olaraq bağladı (${aliveLovers[0].nickname} ❤️ ${aliveLovers[1].nickname})! Biriniz ölərsə, digəriniz də kədərdən öləcək.`,
          'lovers'
        );
      }
    }

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
        const prefix =
          c.cause === 'HEARTBREAK'
            ? `💔 ${c.nickname} aşiqi öldüyü üçün kədərdən öldü — `
            : `💀 ${c.nickname} gecə həlak oldu — `;
        GameEngine.appendSystemMessage(room, `${prefix}${rolePart}.`);
      }
    }

    // Bear Tamer Dawn check: if alive & village powers active, check circular living neighbors
    room.lastBearGrowled = false;
    const bearTamer = room.players.find(
      (p) => p.isAlive && p.role === 'BEAR_TAMER'
    );
    if (bearTamer && !room.villagePowersLost) {
      const aliveSorted = room.players
        .filter((p) => p.isAlive)
        .sort((a, b) => a.seatIndex - b.seatIndex);
      const btIdx = aliveSorted.findIndex((p) => p.id === bearTamer.id);
      if (btIdx !== -1 && aliveSorted.length >= 2) {
        const left =
          aliveSorted[(btIdx - 1 + aliveSorted.length) % aliveSorted.length];
        const right = aliveSorted[(btIdx + 1) % aliveSorted.length];
        if (
          isQatilFactionRole(left.role) ||
          isQatilFactionRole(right.role)
        ) {
          room.lastBearGrowled = true;
          GameEngine.appendSystemMessage(
            room,
            '🐻 Ayı nərildəyir! (The bear growls!) Ayı Təlimçisinin yanında bir Qatil oturub!'
          );
        }
      }
    }

    const deadHunter = !room.villagePowersLost
      ? context.casualties
          .map((c) => room.players.find((p) => p.id === c.playerId))
          .find((p) => p && p.role === 'HUNTER')
      : undefined;

    if (deadHunter) {
      const endsAt = Date.now() + room.config.timers.hunterRevenge * 1000;
      room.hunterRevenge = {
        hunterId: deadHunter.id,
        revengeRole: 'HUNTER',
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
        error: 'Aktiv intiqam atışı gözlənilmir.',
        gameEnded: false,
      };
    }

    const revengeRole = room.hunterRevenge.revengeRole ?? 'HUNTER';
    const roleLabel =
      revengeRole === 'VENGEFUL_WOLF' ? 'İntiqamçı Qurd' : 'Ovçu';
    const roleIcon = revengeRole === 'VENGEFUL_WOLF' ? '🩸' : '🏹';

    if (room.hunterRevenge.hunterId !== hunterId) {
      return {
        valid: false,
        error: `Bu atışı yalnız ölən ${roleLabel} edə bilər.`,
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
          error: 'Hədəf almaq üçün canlı oyunçu seçməlisiniz.',
          gameEnded: false,
        };
      }

      room.hunterRevenge.shotTargetId = target.id;
      if (hunter) {
        hunter.stats.abilitiesUsed += 1;
        hunter.stats.killsTriggered += 1;
      }

      const shotList: NightCasualty[] = [];
      const shotCause: DeathCause =
        revengeRole === 'VENGEFUL_WOLF' ? 'VENGEFUL_WOLF_SHOT' : 'HUNTER_SHOT';
      NightResolver.eliminatePlayer(
        room,
        target.id,
        shotCause,
        room.phase,
        shotList
      );
      NightResolver.applyWildChildTransformations(room);

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
      const actionVerb =
        revengeRole === 'VENGEFUL_WOLF'
          ? 'intiqam alaraq özü ilə apardı'
          : 'son nəfəsində vurdu';
      GameEngine.appendSystemMessage(
        room,
        `💥 ${hunter?.nickname ?? roleLabel} ${target.nickname} adlı oyunçunu ${actionVerb} — ${revealedInfo}!`
      );
      for (const extra of shotList.slice(1)) {
        if (extra.cause === 'HEARTBREAK') {
          const extraRole =
            room.config.revealDeadRoles && extra.role !== 'UNKNOWN'
              ? `Rolu: ${extra.role}`
              : 'Rolu gizlidir 🔒';
          GameEngine.appendSystemMessage(
            room,
            `💔 ${extra.nickname} aşiqi öldüyü üçün kədərdən öldü — ${extraRole}.`
          );
        }
      }
    } else {
      GameEngine.appendSystemMessage(
        room,
        `${roleIcon} ${hunter?.nickname ?? roleLabel} vaxt bitdiyi üçün heç kimi seçmədi.`
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
    room.dayVotesHidden = false;
    room.phaseEndsAt = Date.now() + room.config.timers.dayVoting * 1000;

    GameEngine.appendSystemMessage(
      room,
      `🗳️ Səsvermə başladı! Kimi edam edəcəksiniz? (${room.config.timers.dayVoting}s)`
    );

    if (room.cursedPlayerId) {
      const cursed = room.players.find(
        (p) => p.id === room.cursedPlayerId && p.isAlive
      );
      if (cursed) {
        GameEngine.appendSystemMessage(
          room,
          `🐦‍⬛ Qarğanın lənəti! ${cursed.nickname} səsverməyə +2 avtomatik cəza səsi ilə başlayır.`
        );
      }
    }
  }

  static activateShadowWolfHideVotes(
    room: RoomState,
    actorId: string
  ): { valid: boolean; error?: string } {
    if (room.phase !== 'DAY_VOTING') {
      return {
        valid: false,
        error: 'Kölgə gücü yalnız gündüz səsverməsi mərhələsində işlədilə bilər.',
      };
    }

    const actor = room.players.find((p) => p.id === actorId && p.isAlive);
    if (!actor || actor.role !== 'SHADOW_WOLF') {
      return {
        valid: false,
        error: 'Bu gücü yalnız sağ olan Kölgə Qurd işlədə bilər.',
      };
    }

    if (!room.shadowWolfAbilityAvailable) {
      return {
        valid: false,
        error: 'Kölgə Qurd gücü bu oyunda artıq işlənib.',
      };
    }

    room.shadowWolfAbilityAvailable = false;
    room.dayVotesHidden = true;
    actor.stats.abilitiesUsed += 1;

    GameEngine.appendSystemMessage(
      room,
      '🌑 Kölgələr tonqalı bürüdü! Səsvermə bitənə qədər canlı səs sayları gizlədildi.'
    );

    return { valid: true };
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
    room.dayVotesHidden = false;
    const tally = new Map<string, number>();

    for (const [voterId, targetId] of Object.entries(room.dayVotes)) {
      const voter = room.players.find((p) => p.id === voterId && p.isAlive);
      if (!voter || targetId === 'SKIP') continue;
      const target = room.players.find((p) => p.id === targetId && p.isAlive);
      if (!target) continue;

      tally.set(target.id, (tally.get(target.id) ?? 0) + 1);
    }

    // Apply Crow's +2 automatic penalty votes against cursed living target
    if (room.cursedPlayerId) {
      const cursedTarget = room.players.find(
        (p) => p.id === room.cursedPlayerId && p.isAlive
      );
      if (cursedTarget) {
        tally.set(cursedTarget.id, (tally.get(cursedTarget.id) ?? 0) + 2);
      }
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

    for (const extra of tempCasualties.slice(1)) {
      if (extra.cause === 'HEARTBREAK') {
        const extraRole =
          room.config.revealDeadRoles && extra.role !== 'UNKNOWN'
            ? `Rolu: ${extra.role}`
            : 'Rolu gizlidir 🔒';
        GameEngine.appendSystemMessage(
          room,
          `💔 ${extra.nickname} aşiqi öldüyü üçün kədərdən öldü — ${extraRole}.`
        );
      }
    }

    // 1. Check Day execution instant solo wins (Jester any day, Angel Day 1) BEFORE anything else
    if (
      executed.role === 'JESTER' ||
      (executed.role === 'ANGEL' && room.dayNumber === 1)
    ) {
      const soloWin = WinConditionChecker.check(room, {
        justExecutedPlayerId: executed.id,
      });
      if (soloWin.isGameOver && soloWin.winner) {
        GameEngine.enterGameOver(
          room,
          soloWin.winner,
          soloWin.reason ?? ''
        );
        return {
          executedPlayer: room.lastExecutedPlayer,
          hunterTriggered: false,
          gameEnded: true,
        };
      }
    }

    // 2. Elder executed by Village vote -> all Normal roles lose their special powers
    if (executed.role === 'ELDER' && !room.villagePowersLost) {
      room.villagePowersLost = true;
      GameEngine.appendSystemMessage(
        room,
        '⚠️ Ağsaqqal (Elder) kənd səsverməsi ilə edam edildi! Bütün Normal (Kənd) rolları oyunun sonuna qədər xüsusi güclərini itirdi!'
      );
    }

    // 3. Transform any Wild Child whose Role Model just died
    NightResolver.applyWildChildTransformations(room);

    // 4. Check dying Vengeful Wolf or Hunter (when village powers intact) 15s revenge shot
    const revengeTargetPlayer =
      executed.role === 'VENGEFUL_WOLF'
        ? executed
        : !room.villagePowersLost
          ? tempCasualties
              .map((c) => room.players.find((p) => p.id === c.playerId))
              .find((p) => p && p.role === 'HUNTER')
          : undefined;

    if (
      revengeTargetPlayer &&
      (revengeTargetPlayer.role === 'VENGEFUL_WOLF' ||
        revengeTargetPlayer.role === 'HUNTER')
    ) {
      const revengeRole = revengeTargetPlayer.role;
      const endsAt = Date.now() + room.config.timers.hunterRevenge * 1000;
      room.hunterRevenge = {
        hunterId: revengeTargetPlayer.id,
        revengeRole,
        triggeredFromPhase: 'EXECUTION_REVEAL',
        endsAt,
        resolved: false,
        shotTargetId: null,
      };
      room.phaseEndsAt = endsAt;
      GameEngine.appendSystemMessage(
        room,
        revengeRole === 'VENGEFUL_WOLF'
          ? `🩸 ${revengeTargetPlayer.nickname} (İntiqamçı Qurd) edam edilərkən son intiqamını almaq üçün hədəf seçir!`
          : `🏹 ${revengeTargetPlayer.nickname} (Ovçu) edam edilərkən son gülləsini atmaq üçün hədəf seçir!`
      );
      return {
        executedPlayer: room.lastExecutedPlayer,
        hunterTriggered: true,
        gameEnded: false,
      };
    }

    // 5. Check standard win conditions
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
    room.cursedPlayerId = null;
    room.dayVotesHidden = false;
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
    room.shadowWolfAbilityAvailable = true;
    room.dayVotesHidden = false;
    room.villagePowersLost = false;
    room.lastBearGrowled = false;
    room.cursedPlayerId = null;
    room.cupidLinked = false;
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
      player.elderLivesRemaining = 2;
      player.loverPartnerId = null;
      player.roleModelId = null;
      player.transformedFromWildChild = false;
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
        channel === 'wolves' ? 'Qatil Səsi' : 'Tonqal Bələdçisi',
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
