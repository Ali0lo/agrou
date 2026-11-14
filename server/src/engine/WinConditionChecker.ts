import { MvpAward, RoomState, WinningFaction } from '../types/game.js';

export interface WinCheckResult {
  isGameOver: boolean;
  winner: WinningFaction | null;
  reason: string | null;
}

export class WinConditionChecker {
  /**
   * Evaluates whether any faction or independent neutral has won the game.
   *
   * Rules:
   * 1. Angel: Wins immediately if voted out by the village on Day 1.
   * 2. White Wolf: Wins ONLY if they are the very last player alive.
   * 3. Village Team: Wins when all Werewolves (WEREWOLF, BLACK_WOLF) and Killing Neutrals (WHITE_WOLF) are dead.
   * 4. Werewolf Team: Wins when Werewolves equal or outnumber non-Werewolves (and White Wolf is not alive contesting solo victory).
   */
  static check(
    room: RoomState,
    context?: { justExecutedPlayerId?: string }
  ): WinCheckResult {
    // 1. Check Day 1 Angel Execution Win
    if (context?.justExecutedPlayerId && room.dayNumber === 1) {
      const executed = room.players.find(
        (p) => p.id === context.justExecutedPlayerId
      );
      if (executed && executed.role === 'ANGEL') {
        return {
          isGameOver: true,
          winner: 'ANGEL',
          reason: `${executed.nickname} (the Angel) was executed by the village on Day 1 and ascended to victory!`,
        };
      }
    }

    const alivePlayers = room.players.filter((p) => p.isAlive);
    const aliveWhiteWolves = alivePlayers.filter((p) => p.role === 'WHITE_WOLF');
    const alivePackWolves = alivePlayers.filter(
      (p) => p.role === 'WEREWOLF' || p.role === 'BLACK_WOLF'
    );
    const totalHostileWolves = alivePackWolves.length + aliveWhiteWolves.length;
    const aliveNonWolves = alivePlayers.filter(
      (p) =>
        p.role !== 'WEREWOLF' &&
        p.role !== 'BLACK_WOLF' &&
        p.role !== 'WHITE_WOLF'
    );

    // 2. White Wolf solo win: only when White Wolf is the very last player alive
    if (alivePlayers.length === 1 && aliveWhiteWolves.length === 1) {
      const ww = aliveWhiteWolves[0];
      return {
        isGameOver: true,
        winner: 'WHITE_WOLF',
        reason: `${ww.nickname} (the White Wolf) devoured both village and pack to stand as the sole survivor!`,
      };
    }

    // 3. Village Team win: all Werewolves and Killing Neutrals (White Wolf) are dead
    if (totalHostileWolves === 0) {
      return {
        isGameOver: true,
        winner: 'VILLAGE',
        reason:
          'All Werewolves and hostile beasts have been vanquished! Peace returns to the campfire.',
      };
    }

    // 4. Werewolf Team win: Werewolves equal or outnumber non-Werewolves
    // Note: If a White Wolf is still alive alongside others, the game continues until either
    // the White Wolf is the last player alive or is eliminated.
    if (
      aliveWhiteWolves.length === 0 &&
      alivePackWolves.length >= aliveNonWolves.length
    ) {
      return {
        isGameOver: true,
        winner: 'WEREWOLF',
        reason:
          'The Werewolves now equal or outnumber the villagers and overrun the campfire!',
      };
    }

    return {
      isGameOver: false,
      winner: null,
      reason: null,
    };
  }

  /**
   * Converts any living Angel into a standard Villager after surviving Day 1.
   */
  static convertSurvivingAngelsAfterDay1(room: RoomState): string[] {
    if (room.dayNumber !== 1) return [];
    const convertedIds: string[] = [];

    for (const player of room.players) {
      if (player.isAlive && player.role === 'ANGEL') {
        player.role = 'VILLAGER';
        player.faction = 'VILLAGE';
        convertedIds.push(player.id);
      }
    }

    return convertedIds;
  }

  /**
   * Computes end-of-match MVP awards based on player actions and survival.
   */
  static computeMvpAwards(room: RoomState): MvpAward[] {
    const awards: MvpAward[] = [];
    if (room.players.length === 0) return awards;

    // 1. Apex Strategist / Winning Faction Star
    const sortedByImpact = [...room.players].sort((a, b) => {
      const scoreA =
        a.stats.abilitiesUsed * 3 +
        a.stats.correctWolfVotes * 4 +
        a.stats.killsTriggered * 3 +
        a.stats.nightsSurvived * 2 +
        (a.isAlive ? 5 : 0);
      const scoreB =
        b.stats.abilitiesUsed * 3 +
        b.stats.correctWolfVotes * 4 +
        b.stats.killsTriggered * 3 +
        b.stats.nightsSurvived * 2 +
        (b.isAlive ? 5 : 0);
      return scoreB - scoreA;
    });

    const topPlayer = sortedByImpact[0];
    if (topPlayer) {
      awards.push({
        playerId: topPlayer.id,
        nickname: topPlayer.nickname,
        role: topPlayer.role,
        title: 'Campfire MVP',
        description: `Survived ${topPlayer.stats.nightsSurvived} night(s) and made the highest impact around the fire.`,
      });
    }

    // 2. Eagle-Eyed Detective (most accurate votes against wolves)
    const bestVoter = [...room.players]
      .filter((p) => p.stats.correctWolfVotes > 0)
      .sort((a, b) => b.stats.correctWolfVotes - a.stats.correctWolfVotes)[0];

    if (bestVoter && bestVoter.id !== topPlayer?.id) {
      awards.push({
        playerId: bestVoter.id,
        nickname: bestVoter.nickname,
        role: bestVoter.role,
        title: 'Sharpest Instincts',
        description: `Cast ${bestVoter.stats.correctWolfVotes} vote(s) directly targeting Werewolves.`,
      });
    }

    // 3. Night Owl (most night abilities used)
    const nightOwl = [...room.players]
      .filter((p) => p.stats.abilitiesUsed > 0)
      .sort((a, b) => b.stats.abilitiesUsed - a.stats.abilitiesUsed)[0];

    if (
      nightOwl &&
      !awards.some((existing) => existing.playerId === nightOwl.id)
    ) {
      awards.push({
        playerId: nightOwl.id,
        nickname: nightOwl.nickname,
        role: nightOwl.role,
        title: 'Master of the Night',
        description: `Activated ${nightOwl.stats.abilitiesUsed} pivotal night ability action(s).`,
      });
    }

    return awards;
  }
}
