import {
  DeathCause,
  NightCasualty,
  PlayerState,
  RoomState,
} from '../../types/game.js';
import {
  computeConsensusWolfTarget,
  isWolfPackRole,
  NightResolutionContext,
} from './RoleStrategy.js';
import { getRoleStrategy } from './RoleStrategies.js';

export class NightResolver {
  /**
   * Executes the deterministic night turn order:
   * Night 1 Setup (Thief -> Cupid -> Wild Child -> Sisters)
   * -> Fox / Seer / Wolf Seer / Medium
   * -> Bodyguard (Guard)
   * -> Werewolves
   * -> Big Bad Wolf / Infectious Father of Wolves (Black Wolf)
   * -> White Wolf
   * -> Witch
   * -> Crow
   * -> Serial Killer
   * -> Morning Resolution (Elder 2-lives, Lovers heartbreak, Wild Child conversion)
   */
  static resolve(room: RoomState): NightResolutionContext {
    const context: NightResolutionContext = {
      room,
      protectedPlayerIds: new Set<string>(),
      wolfVictimId: computeConsensusWolfTarget(room),
      bigBadWolfVictimId: null,
      witchSavedVictim: false,
      poisonedPlayerIds: new Set<string>(),
      infectedPlayerId: null,
      whiteWolfVictimId: null,
      serialKillerVictimId: null,
      crowCursedId: null,
      seerInspection: null,
      casualties: [],
    };

    const runRole = (role: PlayerState['role']) => {
      for (const player of room.players) {
        if (player.isAlive && player.role === role) {
          getRoleStrategy(role).resolveNightAction(context, player);
        }
      }
    };

    // =========================================================
    // 1. Night 1 Setup: Thief -> Cupid -> Wild Child -> Sisters
    // =========================================================
    if (room.nightNumber === 1) {
      runRole('THIEF');
      runRole('CUPID');
      runRole('WILD_CHILD');

      // Sisters recognize each other on Night 1
      const sisters = room.players.filter(
        (p) => p.isAlive && p.role === 'SISTERS'
      );
      if (sisters.length > 1) {
        for (const s1 of sisters) {
          for (const s2 of sisters) {
            if (s1.id !== s2.id) {
              s1.knownRoles[s2.id] = 'SISTERS';
            }
          }
        }
      }
    }

    // =========================================================
    // 2. Information Roles: Fox -> Seer -> Wolf Seer -> Medium
    // =========================================================
    runRole('FOX');
    runRole('SEER');
    runRole('WOLF_SEER');
    runRole('MEDIUM');

    // =========================================================
    // 3. Protection: Bodyguard (Guard)
    // =========================================================
    runRole('GUARD');

    // =========================================================
    // 4. Werewolf Pack Vote -> Witch -> Big Bad Wolf / Black Wolf
    // Note: Witch resolves heal before Black Wolf checks `!context.witchSavedVictim`
    // =========================================================
    context.wolfVictimId = computeConsensusWolfTarget(room);
    runRole('WITCH');
    runRole('BIG_BAD_WOLF');
    runRole('BLACK_WOLF');

    // =========================================================
    // 5. White Wolf Betrayal Kill (Even Nights)
    // =========================================================
    runRole('WHITE_WOLF');

    // =========================================================
    // 6. Crow Curse (+2 votes for next day)
    // =========================================================
    room.crowCursedPlayerId = null;
    runRole('CROW');
    if (context.crowCursedId) {
      room.crowCursedPlayerId = context.crowCursedId;
    }

    // =========================================================
    // 7. Serial Killer Independent Kill
    // =========================================================
    runRole('SERIAL_KILLER');

    // =========================================================
    // 8. Apply Black Wolf Infection if target wasn't poisoned/killed
    // =========================================================
    room.lastNightInfectedId = null;
    if (
      context.infectedPlayerId &&
      !context.poisonedPlayerIds.has(context.infectedPlayerId) &&
      context.serialKillerVictimId !== context.infectedPlayerId
    ) {
      const infectedPlayer = room.players.find(
        (p) => p.id === context.infectedPlayerId && p.isAlive
      );
      if (infectedPlayer) {
        infectedPlayer.role = 'WEREWOLF';
        infectedPlayer.faction = 'WEREWOLF';
        room.lastNightInfectedId = infectedPlayer.id;
      }
    }

    // =========================================================
    // 9. Morning Resolution: Aggregate Lethal Attacks & Elder 2-Lives
    // =========================================================
    const pendingDeaths = new Map<string, DeathCause>();

    const tryWolfKill = (victimId: string, cause: 'WEREWOLVES' | 'BIG_BAD_WOLF') => {
      if (context.protectedPlayerIds.has(victimId)) return;
      const victim = room.players.find((p) => p.id === victimId && p.isAlive);
      if (!victim) return;

      // Elder survives the first werewolf attack (2 lives against wolves)
      if (victim.role === 'ELDER' && victim.elderLivesRemaining > 1) {
        victim.elderLivesRemaining -= 1;
        return;
      }

      if (!pendingDeaths.has(victim.id)) {
        pendingDeaths.set(victim.id, cause);
      }
    };

    // 9a. Pack Wolf Victim
    if (
      context.wolfVictimId &&
      !context.witchSavedVictim &&
      context.infectedPlayerId !== context.wolfVictimId
    ) {
      tryWolfKill(context.wolfVictimId, 'WEREWOLVES');
    }

    // 9b. Big Bad Wolf Extra Victim
    if (context.bigBadWolfVictimId) {
      tryWolfKill(context.bigBadWolfVictimId, 'BIG_BAD_WOLF');
    }

    // 9c. White Wolf Victim (Blocked by Guard protection)
    if (
      context.whiteWolfVictimId &&
      !context.protectedPlayerIds.has(context.whiteWolfVictimId)
    ) {
      const victim = room.players.find(
        (p) => p.id === context.whiteWolfVictimId && p.isAlive
      );
      if (victim && !pendingDeaths.has(victim.id)) {
        pendingDeaths.set(victim.id, 'WHITE_WOLF');
      }
    }

    // 9d. Witch Poison Victim (Bypasses Guard & Elder armor)
    for (const poisonedId of context.poisonedPlayerIds) {
      const victim = room.players.find((p) => p.id === poisonedId && p.isAlive);
      if (victim && !pendingDeaths.has(victim.id)) {
        pendingDeaths.set(victim.id, 'WITCH_POISON');
      }
    }

    // 9e. Serial Killer Victim (Bypasses Guard & Elder wolf-armor)
    if (context.serialKillerVictimId) {
      const victim = room.players.find(
        (p) => p.id === context.serialKillerVictimId && p.isAlive
      );
      if (victim && !pendingDeaths.has(victim.id)) {
        pendingDeaths.set(victim.id, 'SERIAL_KILLER');
      }
    }

    // Apply primary deaths
    for (const [playerId, cause] of pendingDeaths.entries()) {
      this.eliminatePlayer(room, playerId, cause, 'NIGHT_PHASE', context.casualties);
    }

    // 10. Post-Death Chains: Lovers Heartbreak, Elder Power Loss, Wild Child Transformation
    this.processPostDeathEffects(room, 'NIGHT_PHASE', context.casualties);

    // 11. Increment survival stats for players who survived the night
    for (const player of room.players) {
      if (player.isAlive) {
        player.stats.nightsSurvived += 1;
      }
      player.isPeeking = false;
    }

    room.lastNightCasualties = context.casualties;
    return context;
  }

  /**
   * Eliminates a player and respects `room.config.revealDeadRoles`.
   */
  static eliminatePlayer(
    room: RoomState,
    playerId: string,
    cause: DeathCause,
    phase: RoomState['phase'],
    casualtiesList: NightCasualty[]
  ): PlayerState | null {
    const player = room.players.find((p) => p.id === playerId && p.isAlive);
    if (!player) return null;

    player.isAlive = false;
    player.isPeeking = false;
    player.diedAtPhase = phase;
    player.diedOnDay = room.dayNumber;
    player.deathReason = formatDeathCause(cause);

    // Respect `revealDeadRoles` setting!
    const shouldReveal = room.config.revealDeadRoles !== false;
    player.revealedRole = shouldReveal ? player.role : null;

    casualtiesList.push({
      playerId: player.id,
      nickname: player.nickname,
      role: shouldReveal ? player.role : 'UNKNOWN',
      cause,
    });

    if (isWolfPackRole(player.role)) {
      room.anyWolfHasDied = true;
    }

    // If Elder died due to village vote or Witch poison or Hunter shot, village loses special powers
    if (
      player.role === 'ELDER' &&
      (cause === 'EXECUTION' || cause === 'WITCH_POISON' || cause === 'HUNTER_SHOT')
    ) {
      room.villagePowersLost = true;
    }

    return player;
  }

  /**
   * Resolves cascading Lovers heartbreak deaths and Wild Child transformation.
   */
  static processPostDeathEffects(
    room: RoomState,
    phase: RoomState['phase'],
    casualtiesList: NightCasualty[]
  ): void {
    // 1. Lovers Heartbreak Chain
    let heartbreakTriggered = true;
    while (heartbreakTriggered) {
      heartbreakTriggered = false;
      for (const player of room.players) {
        if (!player.isAlive && player.loverPartnerId) {
          const partner = room.players.find(
            (p) => p.id === player.loverPartnerId && p.isAlive
          );
          if (partner) {
            this.eliminatePlayer(
              room,
              partner.id,
              'HEARTBREAK',
              phase,
              casualtiesList
            );
            heartbreakTriggered = true;
          }
        }
      }
    }

    // 2. Wild Child Transformation if Role Model is dead
    for (const player of room.players) {
      if (player.isAlive && player.role === 'WILD_CHILD' && player.roleModelId) {
        const model = room.players.find((p) => p.id === player.roleModelId);
        if (model && !model.isAlive) {
          player.role = 'WEREWOLF';
          player.faction = 'WEREWOLF';
        }
      }
    }
  }
}

export function formatDeathCause(cause: DeathCause): string {
  switch (cause) {
    case 'WEREWOLVES':
      return 'Canavarlar tərəfindən parçalandı (Devoured by Werewolves)';
    case 'BIG_BAD_WOLF':
      return 'Böyük Qara Canavar tərəfindən parçalandı (Slain by Big Bad Wolf)';
    case 'WITCH_POISON':
      return 'Cadugərin ölüm iksiri ilə zəhərləndi (Poisoned by the Witch)';
    case 'WHITE_WOLF':
      return 'Ağ Canavar tərəfindən parçalandı (Torn apart by White Wolf)';
    case 'SERIAL_KILLER':
      return 'Qatil tərəfindən gecə bıçaqlandı (Assassinated by Serial Killer)';
    case 'HUNTER_SHOT':
      return 'Ovçunun son gülləsi ilə vuruldu (Shot by the dying Hunter)';
    case 'HEARTBREAK':
      return 'Sevgilisinin ölümünə dözməyib ürəyi partladı (Died of Heartbreak 💔)';
    case 'EXECUTION':
      return 'Kənd məhkəməsi tərəfindən edam edildi (Executed by Village Vote)';
  }
}
