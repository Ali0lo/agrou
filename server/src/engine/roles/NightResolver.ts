import { NightCasualty, RoomState } from '../../types/game.js';
import {
  computeConsensusWolfTarget,
  NightResolutionContext,
} from './RoleStrategy.js';
import { getRoleStrategy } from './RoleStrategies.js';

export class NightResolver {
  static resolve(room: RoomState): NightResolutionContext {
    const context: NightResolutionContext = {
      room,
      protectedPlayerIds: new Set<string>(),
      wolfVictimId: computeConsensusWolfTarget(room),
      witchSavedVictim: false,
      poisonedPlayerIds: new Set<string>(),
      infectedPlayerId: null,
      whiteWolfVictimId: null,
      seerInspection: null,
      casualties: [],
    };

    const alivePlayers = room.players.filter((p) => p.isAlive);

    // 1. Guard protection
    for (const player of alivePlayers) {
      if (player.role === 'GUARD') {
        getRoleStrategy('GUARD').resolveNightAction(context, player);
      }
    }

    // 2. Seer inspection (inspects current role before night mutations)
    for (const player of alivePlayers) {
      if (player.role === 'SEER') {
        getRoleStrategy('SEER').resolveNightAction(context, player);
      }
    }

    // 3. Witch potions (Heal & Poison)
    for (const player of alivePlayers) {
      if (player.role === 'WITCH') {
        getRoleStrategy('WITCH').resolveNightAction(context, player);
      }
    }

    // 4. Black Wolf infection (converts wolf victim instead of killing if not protected/healed)
    for (const player of alivePlayers) {
      if (player.role === 'BLACK_WOLF') {
        getRoleStrategy('BLACK_WOLF').resolveNightAction(context, player);
      }
    }

    // 5. White Wolf betrayal kill (even nights only)
    for (const player of alivePlayers) {
      if (player.role === 'WHITE_WOLF') {
        getRoleStrategy('WHITE_WOLF').resolveNightAction(context, player);
      }
    }

    // 6. Apply Black Wolf conversion if target wasn't poisoned to death
    room.lastNightInfectedId = null;
    if (
      context.infectedPlayerId &&
      !context.poisonedPlayerIds.has(context.infectedPlayerId)
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

    // 7. Aggregate casualties (avoid duplicate entries if targeted by multiple lethal sources)
    const casualtyMap = new Map<string, NightCasualty>();

    // 7a. Werewolf Pack Victim
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
        casualtyMap.set(victim.id, {
          playerId: victim.id,
          nickname: victim.nickname,
          role: victim.role,
          cause: 'WEREWOLVES',
        });
      }
    }

    // 7b. Witch Poison Victim (Bypasses Guard protection)
    for (const poisonedId of context.poisonedPlayerIds) {
      const victim = room.players.find((p) => p.id === poisonedId && p.isAlive);
      if (victim && !casualtyMap.has(victim.id)) {
        casualtyMap.set(victim.id, {
          playerId: victim.id,
          nickname: victim.nickname,
          role: victim.role,
          cause: 'WITCH_POISON',
        });
      }
    }

    // 7c. White Wolf Victim (Blocked by Guard protection)
    if (
      context.whiteWolfVictimId &&
      !context.protectedPlayerIds.has(context.whiteWolfVictimId)
    ) {
      const victim = room.players.find(
        (p) => p.id === context.whiteWolfVictimId && p.isAlive
      );
      if (victim && !casualtyMap.has(victim.id)) {
        casualtyMap.set(victim.id, {
          playerId: victim.id,
          nickname: victim.nickname,
          role: victim.role,
          cause: 'WHITE_WOLF',
        });
      }
    }

    // 8. Apply deaths & reveal roles of night casualties
    for (const casualty of casualtyMap.values()) {
      const player = room.players.find((p) => p.id === casualty.playerId);
      if (player) {
        player.isAlive = false;
        player.isPeeking = false;
        player.revealedRole = player.role;
        player.diedAtPhase = 'NIGHT_PHASE';
        player.diedOnDay = room.dayNumber;
        player.deathReason = formatDeathCause(casualty.cause);
        context.casualties.push(casualty);
      }
    }

    // 9. Increment survival stats for players who survived the night
    for (const player of room.players) {
      if (player.isAlive) {
        player.stats.nightsSurvived += 1;
      }
      // Reset Little Girl peeking at dawn
      player.isPeeking = false;
    }

    room.lastNightCasualties = context.casualties;
    return context;
  }
}

export function formatDeathCause(
  cause: NightCasualty['cause']
): string {
  switch (cause) {
    case 'WEREWOLVES':
      return 'Devoured by Werewolves in the night';
    case 'WITCH_POISON':
      return 'Succumbed to the Witch\'s lethal poison';
    case 'WHITE_WOLF':
      return 'Torn apart by the White Wolf';
    case 'HUNTER_SHOT':
      return 'Shot by the dying Hunter\'s final bullet';
    case 'EXECUTION':
      return 'Voted out by the village tribunal';
  }
}
