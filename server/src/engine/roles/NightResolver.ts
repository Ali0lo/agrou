import {
  DeathCause,
  NightCasualty,
  PlayerState,
  RoomState,
} from '../../types/game.js';
import {
  computeConsensusWolfTarget,
  NightResolutionContext,
} from './RoleStrategy.js';
import { getRoleStrategy } from './RoleStrategies.js';

export class NightResolver {
  /**
   * Executes deterministic night turn resolution:
   * Guard -> Qətil Pack Vote -> Witch -> Black Wolf Infect -> White Wolf
   * -> Seer & Mystic Wolf -> Arsonist Douse/Ignite -> Morning Aggregation
   */
  static resolve(room: RoomState): NightResolutionContext {
    const context: NightResolutionContext = {
      room,
      protectedPlayerIds: new Set<string>(),
      wolfVictimId: computeConsensusWolfTarget(room),
      witchSavedVictim: false,
      poisonedPlayerIds: new Set<string>(),
      infectedPlayerId: null,
      whiteWolfVictimId: null,
      arsonistIgnitedIds: new Set<string>(),
      casualties: [],
    };

    const runRole = (role: PlayerState['role']) => {
      for (const player of room.players) {
        if (player.isAlive && player.role === role) {
          getRoleStrategy(role).resolveNightAction(context, player);
        }
      }
    };

    // 1. Guard protection
    runRole('GUARD');

    // 2. Consensus Qətil pack victim + Witch potions + Black Wolf infect + White Wolf betrayal
    context.wolfVictimId = computeConsensusWolfTarget(room);
    runRole('WITCH');
    runRole('BLACK_WOLF');
    runRole('WHITE_WOLF');

    // 3. Information inspection roles
    runRole('SEER');
    runRole('MYSTIC_WOLF');

    // 4. Arsonist Douse or Ignite all doused simultaneously
    runRole('ARSONIST');

    // 5. Apply Black Wolf Infection if victim wasn't simultaneously killed by poison or fire
    room.lastNightInfectedId = null;
    if (
      context.infectedPlayerId &&
      !context.poisonedPlayerIds.has(context.infectedPlayerId) &&
      !context.arsonistIgnitedIds.has(context.infectedPlayerId)
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

    // 6. Aggregate Morning Deaths
    const pendingDeaths = new Map<string, DeathCause>();

    // 6a. Pack Wolf Victim (blocked by Guard, Witch Heal, or Black Wolf Infection)
    if (
      context.wolfVictimId &&
      !context.protectedPlayerIds.has(context.wolfVictimId) &&
      !context.witchSavedVictim &&
      context.infectedPlayerId !== context.wolfVictimId
    ) {
      const victim = room.players.find(
        (p) => p.id === context.wolfVictimId && p.isAlive
      );
      if (victim) {
        pendingDeaths.set(victim.id, 'WEREWOLVES');
      }
    }

    // 6b. White Wolf Betrayal Kill (blocked by Guard)
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

    // 6c. Witch Poison Victim (bypasses Guard)
    for (const poisonedId of context.poisonedPlayerIds) {
      const victim = room.players.find((p) => p.id === poisonedId && p.isAlive);
      if (victim && !pendingDeaths.has(victim.id)) {
        pendingDeaths.set(victim.id, 'WITCH_POISON');
      }
    }

    // 6d. Arsonist Ignite Victims (simultaneous fire, bypasses Guard)
    for (const ignitedId of context.arsonistIgnitedIds) {
      const victim = room.players.find((p) => p.id === ignitedId && p.isAlive);
      if (victim && !pendingDeaths.has(victim.id)) {
        pendingDeaths.set(victim.id, 'ARSONIST_IGNITE');
      }
    }

    for (const [playerId, cause] of pendingDeaths.entries()) {
      this.eliminatePlayer(room, playerId, cause, 'NIGHT_PHASE', context.casualties);
    }

    // Clean any eliminated targets from future Arsonist doused list
    room.arsonistDousedIds = room.arsonistDousedIds.filter((id) =>
      room.players.some((p) => p.id === id && p.isAlive)
    );

    // 7. Increment survival stats & reset Little Girl peek flag
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

    const shouldReveal = room.config.revealDeadRoles !== false;
    player.revealedRole = shouldReveal ? player.role : null;

    casualtiesList.push({
      playerId: player.id,
      nickname: player.nickname,
      role: shouldReveal ? player.role : 'UNKNOWN',
      cause,
    });

    return player;
  }
}

export function formatDeathCause(cause: DeathCause): string {
  switch (cause) {
    case 'WEREWOLVES':
      return 'Qətil canavarlar tərəfindən parçalandı (Devoured by Wolves)';
    case 'WITCH_POISON':
      return 'Cadugərin ölüm iksiri ilə zəhərləndi (Poisoned by the Witch)';
    case 'WHITE_WOLF':
      return 'Ağ Canavar tərəfindən parçalandı (Torn apart by White Wolf)';
    case 'ARSONIST_IGNITE':
      return 'Alovçunun alovuna qərq oldu (Burned by the Arsonist)';
    case 'HUNTER_SHOT':
      return 'Ovçunun son gülləsi ilə vuruldu (Shot by the dying Hunter)';
    case 'EXECUTION':
      return 'Kənd məhkəməsi tərəfindən edam edildi (Executed by Village Vote)';
  }
}
