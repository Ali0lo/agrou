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
   * Guard -> Qatil Pack Vote -> Witch -> Black Wolf Infect -> White Wolf
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

    // Reset previous night's Crow curse before resolving tonight's actions
    room.cursedPlayerId = null;

    // 0. Night 1 setup roles (Cupid, Wild Child) & Crow curse (apply before deaths)
    runRole('CUPID');
    runRole('WILD_CHILD');
    runRole('CROW');

    // 1. Guard protection
    runRole('GUARD');

    // 2. Consensus Qatil pack victim + Witch potions + Black Wolf infect + White Wolf betrayal
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

    // 6a. Pack Wolf Victim (blocked by Guard, Witch Heal, Black Wolf Infection, or Elder's extra life)
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
        if (victim.role === 'ELDER' && victim.elderLivesRemaining > 1) {
          victim.elderLivesRemaining -= 1;
        } else {
          if (victim.role === 'ELDER') {
            victim.elderLivesRemaining = 0;
          }
          pendingDeaths.set(victim.id, 'WEREWOLVES');
        }
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

    // Transform any living Wild Child whose Role Model died tonight
    this.applyWildChildTransformations(room);

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
   * Eliminates a player, cascades Cupid Lovers Heartbreak (`HEARTBREAK`),
   * and respects `room.config.revealDeadRoles`.
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

    // Cupid Heartbreak cascade: if the victim had a living Lover, that Lover dies too
    if (player.loverPartnerId) {
      const partner = room.players.find(
        (p) => p.id === player.loverPartnerId && p.isAlive
      );
      if (partner) {
        this.eliminatePlayer(room, partner.id, 'HEARTBREAK', phase, casualtiesList);
      }
    }

    return player;
  }

  /**
   * Checks whether any living Wild Child lost their Role Model and secretly
   * transforms them into a WEREWOLF (Qatil team). Returns newly transformed players.
   */
  static applyWildChildTransformations(room: RoomState): PlayerState[] {
    const transformed: PlayerState[] = [];
    for (const player of room.players) {
      if (!player.isAlive || player.role !== 'WILD_CHILD' || !player.roleModelId) {
        continue;
      }
      const model = room.players.find((p) => p.id === player.roleModelId);
      if (model && !model.isAlive) {
        player.role = 'WEREWOLF';
        player.faction = 'WEREWOLF';
        player.transformedFromWildChild = true;
        transformed.push(player);
        room.messages.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          senderId: 'SYSTEM',
          senderName: 'Qatil Səsi',
          senderColor: '#ef4444',
          channel: 'wolves',
          channelBadge: '🐺 Qatil Çatı',
          content: `🐾 ${player.nickname} (Vəhşi Uşaq) Rol Modelini itirdi və gizlicə Qatil (Canavar) komandasına qoşuldu!`,
          timestamp: Date.now(),
        });
      }
    }
    return transformed;
  }
}

export function formatDeathCause(cause: DeathCause): string {
  switch (cause) {
    case 'WEREWOLVES':
      return 'Qatil canavarlar tərəfindən parçalandı (Devoured by Wolves)';
    case 'WITCH_POISON':
      return 'Cadugərin ölüm iksiri ilə zəhərləndi (Poisoned by the Witch)';
    case 'WHITE_WOLF':
      return 'Ağ Canavar tərəfindən parçalandı (Torn apart by White Wolf)';
    case 'ARSONIST_IGNITE':
      return 'Alovçunun alovuna qərq oldu (Burned by the Arsonist)';
    case 'HUNTER_SHOT':
      return 'Ovçunun son gülləsi ilə vuruldu (Shot by the dying Hunter)';
    case 'VENGEFUL_WOLF_SHOT':
      return 'İntiqamçı Qurdun son hücumu ilə öldürüldü (Dragged down by Vengeful Wolf)';
    case 'HEARTBREAK':
      return 'Aşiqi öldüyü üçün kədərdən öldü (Died of Heartbreak)';
    case 'EXECUTION':
      return 'Kənd məhkəməsi tərəfindən edam edildi (Executed by Village Vote)';
  }
}
