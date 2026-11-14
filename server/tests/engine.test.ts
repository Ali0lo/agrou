import { describe, expect, it } from 'vitest';
import {
  canReadChannel,
  canWriteToChannel,
  formatMessageForRecipient,
} from '../src/engine/ChatAuthorization.js';
import {
  createInitialRoomState,
  createPlayerState,
  GameEngine,
} from '../src/engine/GameEngine.js';
import { sanitizeStateForPlayer } from '../src/engine/StateSanitizer.js';
import { WinConditionChecker } from '../src/engine/WinConditionChecker.js';
import { ChatMessage, RoleType, RoomState } from '../src/types/game.js';

function createTestRoomWithRoles(roles: RoleType[]): RoomState {
  const room = createInitialRoomState('TEST1');
  roles.forEach((role, idx) => {
    const player = createPlayerState({
      id: `p${idx + 1}`,
      socketId: `sock-${idx + 1}`,
      nickname: `Player${idx + 1}`,
      avatar: '🦊',
      color: '#f97316',
      seatIndex: idx,
      isHost: idx === 0,
    });
    room.players.push(player);
  });

  const startRes = GameEngine.startGame(room, roles);
  expect(startRes.valid).toBe(true);
  GameEngine.enterNightPhase(room);
  return room;
}

describe('Campfire Wolves - State Sanitization & Anti-Cheat', () => {
  it('strips other players roles to UNKNOWN for a living Villager (Rule 1)', () => {
    const room = createTestRoomWithRoles([
      'VILLAGER',
      'WEREWOLF',
      'SEER',
      'WITCH',
    ]);

    const sanitized = sanitizeStateForPlayer(room, 'p1');
    const p1 = sanitized.players.find((p) => p.id === 'p1')!;
    const p2 = sanitized.players.find((p) => p.id === 'p2')!;
    const p3 = sanitized.players.find((p) => p.id === 'p3')!;

    expect(p1.role).toBe('VILLAGER');
    expect(p2.role).toBe('UNKNOWN');
    expect(p3.role).toBe('UNKNOWN');
    expect(sanitized.wolfVotes).toBeNull();
  });

  it('allows Werewolves to see each other while masking White Wolf as a normal WEREWOLF (Rule 2)', () => {
    const room = createTestRoomWithRoles([
      'WEREWOLF',
      'BLACK_WOLF',
      'WHITE_WOLF',
      'VILLAGER',
    ]);

    const sanitizedForWolf = sanitizeStateForPlayer(room, 'p1');
    expect(sanitizedForWolf.players.find((p) => p.id === 'p1')?.role).toBe('WEREWOLF');
    expect(sanitizedForWolf.players.find((p) => p.id === 'p2')?.role).toBe('BLACK_WOLF');
    // White Wolf appears as a normal WEREWOLF to other wolves
    expect(sanitizedForWolf.players.find((p) => p.id === 'p3')?.role).toBe('WEREWOLF');
    // Non-wolf remains UNKNOWN
    expect(sanitizedForWolf.players.find((p) => p.id === 'p4')?.role).toBe('UNKNOWN');

    // White Wolf sees their own true role as WHITE_WOLF
    const sanitizedForWhiteWolf = sanitizeStateForPlayer(room, 'p3');
    expect(sanitizedForWhiteWolf.players.find((p) => p.id === 'p3')?.role).toBe('WHITE_WOLF');
  });

  it('reveals all roles when phase is GAME_OVER (Rule 3)', () => {
    const room = createTestRoomWithRoles([
      'VILLAGER',
      'WEREWOLF',
      'WHITE_WOLF',
      'SEER',
    ]);
    GameEngine.enterGameOver(room, 'VILLAGE', 'Village won!');

    const sanitized = sanitizeStateForPlayer(room, 'p1');
    expect(sanitized.players.map((p) => p.role)).toEqual([
      'VILLAGER',
      'WEREWOLF',
      'WHITE_WOLF',
      'SEER',
    ]);
  });

  it('reveals all roles when the requesting player is dead / Spectator mode (Rule 4)', () => {
    const room = createTestRoomWithRoles([
      'VILLAGER',
      'WEREWOLF',
      'SEER',
      'WITCH',
    ]);
    room.players[0].isAlive = false;

    const sanitized = sanitizeStateForPlayer(room, 'p1');
    expect(sanitized.players.map((p) => p.role)).toEqual([
      'VILLAGER',
      'WEREWOLF',
      'SEER',
      'WITCH',
    ]);
  });
});

describe('Campfire Wolves - Role Resolution Engine & Edge Cases', () => {
  it('resolves Guard protection against Werewolf attack and blocks consecutive same-target protection', () => {
    const room = createTestRoomWithRoles([
      'WEREWOLF',
      'GUARD',
      'VILLAGER',
      'SEER',
    ]);

    // Wolves vote to devour p3 (Villager)
    expect(
      GameEngine.submitNightAction(room, 'p1', {
        actionType: 'WOLF_VOTE',
        targetId: 'p3',
      }).valid
    ).toBe(true);

    // Guard protects p3
    expect(
      GameEngine.submitNightAction(room, 'p2', {
        actionType: 'GUARD_PROTECT',
        targetId: 'p3',
      }).valid
    ).toBe(true);

    GameEngine.resolveNightAndEnterDawn(room);

    // p3 survived!
    expect(room.lastNightCasualties).toHaveLength(0);
    expect(room.players.find((p) => p.id === 'p3')?.isAlive).toBe(true);
    expect(room.players.find((p) => p.id === 'p2')?.lastProtectedPlayerId).toBe('p3');

    // Advance to Night 2 and verify Guard cannot protect p3 again consecutively
    GameEngine.enterDayDiscussion(room);
    GameEngine.enterDayVoting(room);
    GameEngine.resolveDayVotesAndEnterExecution(room);
    GameEngine.completeExecutionAndLoopToNight(room);

    const consecutiveAttempt = GameEngine.submitNightAction(room, 'p2', {
      actionType: 'GUARD_PROTECT',
      targetId: 'p3',
    });
    expect(consecutiveAttempt.valid).toBe(false);
    expect(consecutiveAttempt.error).toContain('two nights in a row');
  });

  it('handles Witch Heal + Guard Protect edge cases and Witch Poison bypassing Guard protection', () => {
    const room = createTestRoomWithRoles([
      'WEREWOLF',
      'WITCH',
      'GUARD',
      'VILLAGER',
      'SEER',
    ]);

    // Wolves target p4 (Villager)
    GameEngine.submitNightAction(room, 'p1', {
      actionType: 'WOLF_VOTE',
      targetId: 'p4',
    });

    // Verify Witch can see who is under attack via sanitized state
    const witchSanitized = sanitizeStateForPlayer(room, 'p2');
    expect(witchSanitized.self?.currentWolfTargetId).toBe('p4');

    // Witch uses Heal Potion on p4 AND Guard also protects p5 (Seer) while Witch poisons p5!
    expect(
      GameEngine.submitNightAction(room, 'p2', {
        actionType: 'WITCH_HEAL',
      }).valid
    ).toBe(true);

    expect(
      GameEngine.submitNightAction(room, 'p3', {
        actionType: 'GUARD_PROTECT',
        targetId: 'p5',
      }).valid
    ).toBe(true);

    expect(
      GameEngine.submitNightAction(room, 'p2', {
        actionType: 'WITCH_POISON',
        targetId: 'p5',
      }).valid
    ).toBe(true);

    GameEngine.resolveNightAndEnterDawn(room);

    // p4 was saved by Witch Heal
    expect(room.players.find((p) => p.id === 'p4')?.isAlive).toBe(true);
    expect(room.witchPotions.healAvailable).toBe(false);

    // p5 died to Witch Poison even though Guard protected p5!
    expect(room.players.find((p) => p.id === 'p5')?.isAlive).toBe(false);
    expect(room.witchPotions.poisonAvailable).toBe(false);
    expect(room.lastNightCasualties).toHaveLength(1);
    expect(room.lastNightCasualties[0].playerId).toBe('p5');
    expect(room.lastNightCasualties[0].cause).toBe('WITCH_POISON');
  });

  it('resolves Black Wolf infection converting victim into a Werewolf instead of killing them', () => {
    const room = createTestRoomWithRoles([
      'BLACK_WOLF',
      'VILLAGER',
      'SEER',
      'GUARD',
      'VILLAGER',
    ]);

    // Black Wolf votes to devour p2
    GameEngine.submitNightAction(room, 'p1', {
      actionType: 'WOLF_VOTE',
      targetId: 'p2',
    });

    // Black Wolf activates single-use infection
    const infectRes = GameEngine.submitNightAction(room, 'p1', {
      actionType: 'BLACK_WOLF_INFECT',
    });
    expect(infectRes.valid).toBe(true);

    GameEngine.resolveNightAndEnterDawn(room);

    // Nobody died publicly, and p2 is now a WEREWOLF!
    expect(room.lastNightCasualties).toHaveLength(0);
    const p2 = room.players.find((p) => p.id === 'p2')!;
    expect(p2.isAlive).toBe(true);
    expect(p2.role).toBe('WEREWOLF');
    expect(p2.originalRole).toBe('VILLAGER');
    expect(p2.faction).toBe('WEREWOLF');
    expect(room.blackWolfInfectionAvailable).toBe(false);

    // Verify Black Wolf cannot infect again on Night 2
    GameEngine.enterDayDiscussion(room);
    GameEngine.enterDayVoting(room);
    GameEngine.resolveDayVotesAndEnterExecution(room);
    GameEngine.completeExecutionAndLoopToNight(room);

    GameEngine.submitNightAction(room, 'p1', {
      actionType: 'WOLF_VOTE',
      targetId: 'p3',
    });
    const secondInfect = GameEngine.submitNightAction(room, 'p1', {
      actionType: 'BLACK_WOLF_INFECT',
    });
    expect(secondInfect.valid).toBe(false);
  });

  it('prevents Black Wolf infection if the victim is protected by the Guard', () => {
    const room = createTestRoomWithRoles([
      'BLACK_WOLF',
      'GUARD',
      'VILLAGER',
      'SEER',
    ]);

    GameEngine.submitNightAction(room, 'p1', {
      actionType: 'WOLF_VOTE',
      targetId: 'p3',
    });
    GameEngine.submitNightAction(room, 'p1', {
      actionType: 'BLACK_WOLF_INFECT',
    });
    GameEngine.submitNightAction(room, 'p2', {
      actionType: 'GUARD_PROTECT',
      targetId: 'p3',
    });

    GameEngine.resolveNightAndEnterDawn(room);

    const p3 = room.players.find((p) => p.id === 'p3')!;
    expect(p3.isAlive).toBe(true);
    expect(p3.role).toBe('VILLAGER');
    // Infection was blocked so it remains available
    expect(room.blackWolfInfectionAvailable).toBe(true);
  });

  it('allows White Wolf to kill a fellow Werewolf only on even nights', () => {
    const room = createTestRoomWithRoles([
      'WHITE_WOLF',
      'WEREWOLF',
      'VILLAGER',
      'SEER',
      'GUARD',
    ]);

    // Night 1 (odd): White Wolf solo kill is rejected
    const night1Attempt = GameEngine.submitNightAction(room, 'p1', {
      actionType: 'WHITE_WOLF_KILL',
      targetId: 'p2',
    });
    expect(night1Attempt.valid).toBe(false);

    // Advance to Night 2 (even)
    GameEngine.resolveNightAndEnterDawn(room);
    GameEngine.enterDayDiscussion(room);
    GameEngine.enterDayVoting(room);
    GameEngine.resolveDayVotesAndEnterExecution(room);
    GameEngine.completeExecutionAndLoopToNight(room);
    expect(room.nightNumber).toBe(2);

    // Night 2 (even): White Wolf kills fellow Werewolf p2
    const night2Attempt = GameEngine.submitNightAction(room, 'p1', {
      actionType: 'WHITE_WOLF_KILL',
      targetId: 'p2',
    });
    expect(night2Attempt.valid).toBe(true);

    GameEngine.resolveNightAndEnterDawn(room);
    expect(room.players.find((p) => p.id === 'p2')?.isAlive).toBe(false);
    expect(
      room.lastNightCasualties.some(
        (c) => c.playerId === 'p2' && c.cause === 'WHITE_WOLF'
      )
    ).toBe(true);
  });

  it('triggers Hunter revenge window on death and eliminates the Hunter shot target', () => {
    const room = createTestRoomWithRoles([
      'WEREWOLF',
      'HUNTER',
      'VILLAGER',
      'SEER',
    ]);

    // Wolves kill Hunter (p2) at night
    GameEngine.submitNightAction(room, 'p1', {
      actionType: 'WOLF_VOTE',
      targetId: 'p2',
    });

    GameEngine.resolveNightAndEnterDawn(room);

    expect(room.players.find((p) => p.id === 'p2')?.isAlive).toBe(false);
    expect(room.hunterRevenge).not.toBeNull();
    expect(room.hunterRevenge?.hunterId).toBe('p2');

    // Hunter shoots the Werewolf (p1)
    const shotRes = GameEngine.resolveHunterShot(room, 'p2', 'p1');
    expect(shotRes.valid).toBe(true);
    expect(room.players.find((p) => p.id === 'p1')?.isAlive).toBe(false);

    // Since all Werewolves are now dead, Village wins immediately!
    expect(room.phase).toBe('GAME_OVER');
    expect(room.winner).toBe('VILLAGE');
  });

  it('tracks Little Girl peeking exposure and alerts Werewolves when detection roll triggers', () => {
    const room = createTestRoomWithRoles([
      'WEREWOLF',
      'LITTLE_GIRL',
      'VILLAGER',
      'SEER',
    ]);

    expect(GameEngine.toggleLittleGirlPeek(room, 'p2', true).valid).toBe(true);
    expect(room.players[1].isPeeking).toBe(true);

    // Tick with high random number -> increases exposure without triggering wolf alert
    const tick1 = GameEngine.tickLittleGirlExposure(room, () => 0.99);
    expect(tick1.exposureLevel).toBeGreaterThan(0);
    expect(tick1.wolfAlertTriggered).toBe(false);

    // Tick with low random number -> triggers wolf alert
    const tick2 = GameEngine.tickLittleGirlExposure(room, () => 0.01);
    expect(tick2.wolfAlertTriggered).toBe(true);
    expect(room.wolfAlertedThisNight).toBe(true);
  });

  it('skips Day Discussion early when >50% of living players vote to skip, and handles tied Day Votes with no elimination', () => {
    const room = createTestRoomWithRoles([
      'WEREWOLF',
      'VILLAGER',
      'SEER',
      'GUARD',
    ]);

    GameEngine.resolveNightAndEnterDawn(room);
    GameEngine.enterDayDiscussion(room);
    expect(room.phase).toBe('DAY_DISCUSSION');

    // 2 of 4 players (50%) is not >50%
    GameEngine.toggleSkipDiscussion(room, 'p1');
    const secondSkip = GameEngine.toggleSkipDiscussion(room, 'p2');
    expect(secondSkip.transitionedToVoting).toBe(false);
    expect(room.phase).toBe('DAY_DISCUSSION');

    // 3 of 4 players (75% > 50%) skips straight to DAY_VOTING
    const thirdSkip = GameEngine.toggleSkipDiscussion(room, 'p3');
    expect(thirdSkip.transitionedToVoting).toBe(true);
    expect(room.phase).toBe('DAY_VOTING');

    // Cast tied votes (2 for p1, 2 for p2)
    GameEngine.castDayVote(room, 'p1', 'p2');
    GameEngine.castDayVote(room, 'p3', 'p2');
    GameEngine.castDayVote(room, 'p2', 'p1');
    GameEngine.castDayVote(room, 'p4', 'p1');

    GameEngine.resolveDayVotesAndEnterExecution(room);
    expect(room.lastExecutedPlayer).toBeNull();
    expect(room.players.every((p) => p.isAlive)).toBe(true);
  });
});

describe('Campfire Wolves - Win Condition Checks', () => {
  it('awards Angel immediate solo win when voted out on Day 1, and converts Angel to Villager if they survive Day 1', () => {
    // Case 1: Angel voted out on Day 1
    const room1 = createTestRoomWithRoles([
      'ANGEL',
      'WEREWOLF',
      'VILLAGER',
      'SEER',
    ]);
    GameEngine.resolveNightAndEnterDawn(room1);
    GameEngine.enterDayDiscussion(room1);
    GameEngine.enterDayVoting(room1);

    GameEngine.castDayVote(room1, 'p2', 'p1');
    GameEngine.castDayVote(room1, 'p3', 'p1');
    GameEngine.resolveDayVotesAndEnterExecution(room1);

    expect(room1.phase).toBe('GAME_OVER');
    expect(room1.winner).toBe('ANGEL');

    // Case 2: Angel survives Day 1 -> converts into VILLAGER
    const room2 = createTestRoomWithRoles([
      'ANGEL',
      'WEREWOLF',
      'VILLAGER',
      'SEER',
    ]);
    GameEngine.resolveNightAndEnterDawn(room2);
    GameEngine.enterDayDiscussion(room2);
    GameEngine.enterDayVoting(room2);
    // Tie vote on Day 1 -> nobody executed
    GameEngine.castDayVote(room2, 'p1', 'SKIP');
    GameEngine.resolveDayVotesAndEnterExecution(room2);

    const formerAngel = room2.players.find((p) => p.id === 'p1')!;
    expect(formerAngel.isAlive).toBe(true);
    expect(formerAngel.role).toBe('VILLAGER');
    expect(formerAngel.faction).toBe('VILLAGE');
  });

  it('awards Werewolf Team win when Werewolves equal or outnumber non-Werewolves (with no White Wolf alive)', () => {
    const room = createTestRoomWithRoles([
      'WEREWOLF',
      'WEREWOLF',
      'VILLAGER',
      'SEER',
    ]);

    const check = WinConditionChecker.check(room);
    expect(check.isGameOver).toBe(true);
    expect(check.winner).toBe('WEREWOLF');
  });

  it('awards White Wolf win ONLY when White Wolf is the very last player alive', () => {
    const room = createTestRoomWithRoles([
      'WHITE_WOLF',
      'WEREWOLF',
      'VILLAGER',
      'SEER',
    ]);

    // Eliminate Villager and Seer -> 1 White Wolf + 1 Werewolf left
    room.players[2].isAlive = false;
    room.players[3].isAlive = false;

    const midCheck = WinConditionChecker.check(room);
    expect(midCheck.isGameOver).toBe(false);

    // Eliminate the last fellow Werewolf -> White Wolf is sole survivor
    room.players[1].isAlive = false;
    const finalCheck = WinConditionChecker.check(room);
    expect(finalCheck.isGameOver).toBe(true);
    expect(finalCheck.winner).toBe('WHITE_WOLF');
  });

  it('awards Village Team win when all Werewolves and Killing Neutrals are dead', () => {
    const room = createTestRoomWithRoles([
      'WEREWOLF',
      'WHITE_WOLF',
      'VILLAGER',
      'SEER',
    ]);

    room.players[0].isAlive = false;
    room.players[1].isAlive = false;

    const check = WinConditionChecker.check(room);
    expect(check.isGameOver).toBe(true);
    expect(check.winner).toBe('VILLAGE');
  });
});

describe('Campfire Wolves - revealDeadRoles & 22 Classic Agrou Roles', () => {
  it('verifies all 22 classic Agrou roles are registered in the role engine', () => {
    const all22 = GameEngine.getAllRoleKeys();
    expect(all22).toHaveLength(22);
  });

  it('hides eliminated player roles when revealDeadRoles is false, except for Medium inspection or Game Over', () => {
    const room = createTestRoomWithRoles([
      'WEREWOLF',
      'MEDIUM',
      'VILLAGER',
      'SEER',
    ]);
    room.config.revealDeadRoles = false;

    // Night 1: Werewolf kills p3 (Villager)
    GameEngine.submitNightAction(room, 'p1', {
      actionType: 'WOLF_VOTE',
      targetId: 'p3',
    });
    GameEngine.resolveNightAndEnterDawn(room);

    // Living player p4 sees p3 as dead, but their role is hidden (UNKNOWN / null)
    const sanitizedForVillager = sanitizeStateForPlayer(room, 'p4');
    const deadSeatForVillager = sanitizedForVillager.players.find(
      (p) => p.id === 'p3'
    )!;
    expect(deadSeatForVillager.isAlive).toBe(false);
    expect(deadSeatForVillager.revealedRole).toBeNull();
    expect(sanitizedForVillager.lastNightCasualties[0].role).toBe('UNKNOWN');

    // Advance to Night 2: Medium (p2) inspects dead p3
    GameEngine.enterDayDiscussion(room);
    GameEngine.enterDayVoting(room);
    GameEngine.castDayVote(room, 'p1', 'SKIP');
    GameEngine.resolveDayVotesAndEnterExecution(room);
    GameEngine.completeExecutionAndLoopToNight(room);

    const mediumInspect = GameEngine.submitNightAction(room, 'p2', {
      actionType: 'MEDIUM_INSPECT',
      targetId: 'p3',
    });
    expect(mediumInspect.valid).toBe(true);

    // Medium now sees p3's true role even though revealDeadRoles is false!
    const sanitizedForMedium = sanitizeStateForPlayer(room, 'p2');
    expect(
      sanitizedForMedium.players.find((p) => p.id === 'p3')?.revealedRole
    ).toBe('VILLAGER');
  });

  it('handles Elder 2 lives against wolves and village power loss when Elder is executed', () => {
    const room = createTestRoomWithRoles([
      'WEREWOLF',
      'ELDER',
      'SEER',
      'VILLAGER',
    ]);

    // Night 1: Wolf attacks Elder (p2) -> Elder survives with 1 life left!
    GameEngine.submitNightAction(room, 'p1', {
      actionType: 'WOLF_VOTE',
      targetId: 'p2',
    });
    GameEngine.resolveNightAndEnterDawn(room);

    const elder = room.players.find((p) => p.id === 'p2')!;
    expect(elder.isAlive).toBe(true);
    expect(elder.elderLivesRemaining).toBe(1);
    expect(room.lastNightCasualties).toHaveLength(0);

    // Day 1: Village mistakenly votes out Elder (p2) -> villagePowersLost becomes true!
    GameEngine.enterDayDiscussion(room);
    GameEngine.enterDayVoting(room);
    GameEngine.castDayVote(room, 'p1', 'p2');
    GameEngine.castDayVote(room, 'p3', 'p2');
    GameEngine.resolveDayVotesAndEnterExecution(room);

    expect(elder.isAlive).toBe(false);
    expect(room.villagePowersLost).toBe(true);
  });

  it('handles Cupid Lovers heartbreak chain and Wild Child transformation when Role Model dies', () => {
    const room = createTestRoomWithRoles([
      'WEREWOLF',
      'CUPID',
      'WILD_CHILD',
      'VILLAGER',
      'VILLAGER',
    ]);

    // Night 1: Cupid links p4 and p5 as Lovers; Wild Child chooses p4 as Role Model
    expect(
      GameEngine.submitNightAction(room, 'p2', {
        actionType: 'CUPID_LINK',
        targetId: 'p4',
        secondTargetId: 'p5',
      }).valid
    ).toBe(true);

    expect(
      GameEngine.submitNightAction(room, 'p3', {
        actionType: 'WILD_CHILD_MODEL',
        targetId: 'p4',
      }).valid
    ).toBe(true);

    // Werewolf kills p4 -> p5 dies of Heartbreak AND Wild Child (p3) transforms into WEREWOLF!
    GameEngine.submitNightAction(room, 'p1', {
      actionType: 'WOLF_VOTE',
      targetId: 'p4',
    });
    GameEngine.resolveNightAndEnterDawn(room);

    expect(room.players.find((p) => p.id === 'p4')?.isAlive).toBe(false);
    expect(room.players.find((p) => p.id === 'p5')?.isAlive).toBe(false);
    expect(room.players.find((p) => p.id === 'p3')?.role).toBe('WEREWOLF');
  });

  it('applies Crow +2 automatic votes, Mayor 2x vote weight, and Jester execution solo win', () => {
    const room = createTestRoomWithRoles([
      'WEREWOLF',
      'CROW',
      'MAYOR',
      'JESTER',
      'VILLAGER',
    ]);

    // Night 1: Crow curses Jester (p4) with +2 votes
    expect(
      GameEngine.submitNightAction(room, 'p2', {
        actionType: 'CROW_CURSE',
        targetId: 'p4',
      }).valid
    ).toBe(true);

    GameEngine.resolveNightAndEnterDawn(room);
    expect(room.crowCursedPlayerId).toBe('p4');

    GameEngine.enterDayDiscussion(room);
    GameEngine.enterDayVoting(room);

    // Mayor (p3) also votes for p4 (+2 weight -> total 4 votes on Jester)
    GameEngine.castDayVote(room, 'p3', 'p4');
    GameEngine.resolveDayVotesAndEnterExecution(room);

    expect(room.phase).toBe('GAME_OVER');
    expect(room.winner).toBe('JESTER');
  });

  it('handles Fox sniffing 3 adjacent players and losing power when no wolf is in the trio', () => {
    const room = createTestRoomWithRoles([
      'WEREWOLF', // seat 0 (p1)
      'VILLAGER', // seat 1 (p2)
      'FOX',      // seat 2 (p3)
      'SEER',     // seat 3 (p4)
      'GUARD',    // seat 4 (p5)
    ]);

    // Fox sniffs p3 (neighbors p2 and p4 -> none of p2, p3, p4 are wolves!)
    const sniffRes = GameEngine.submitNightAction(room, 'p3', {
      actionType: 'FOX_SNIFF',
      targetId: 'p3',
    });
    expect(sniffRes.valid).toBe(true);
    const fox = room.players.find((p) => p.id === 'p3')!;
    expect(fox.lastFoxSniff?.hasWolf).toBe(false);
    expect(fox.foxPowerLost).toBe(true);
  });

  it('enforces server-authoritative access control for all 5 inner chat channels (public, wolves, siblings, lovers, dead)', () => {
    const room = createTestRoomWithRoles([
      'WEREWOLF',    // p1
      'LITTLE_GIRL', // p2
      'SISTERS',     // p3
      'SISTERS',     // p4
      'CUPID',       // p5
      'MEDIUM',      // p6
      'VILLAGER',    // p7
    ]);

    const wolf = room.players.find((p) => p.id === 'p1')!;
    const littleGirl = room.players.find((p) => p.id === 'p2')!;
    const sister1 = room.players.find((p) => p.id === 'p3')!;
    const sister2 = room.players.find((p) => p.id === 'p4')!;
    const medium = room.players.find((p) => p.id === 'p6')!;
    const villager = room.players.find((p) => p.id === 'p7')!;

    // Link wolf (p1) and villager (p7) as Lovers via Cupid (p5)
    GameEngine.submitNightAction(room, 'p5', {
      actionType: 'CUPID_LINK',
      targetId: 'p1',
      secondTargetId: 'p7',
    });

    // 1. PUBLIC channel: locked during NIGHT_PHASE, writable by alive players during Day
    expect(canWriteToChannel(room, villager, 'public').allowed).toBe(false);
    expect(canReadChannel(room, villager, 'public')).toBe(true);

    // 2. WOLVES channel: writable by alive Werewolf at night; blocked for Villager
    expect(canWriteToChannel(room, wolf, 'wolves').allowed).toBe(true);
    expect(canWriteToChannel(room, villager, 'wolves').allowed).toBe(false);
    expect(canReadChannel(room, villager, 'wolves')).toBe(false);

    // Little Girl peeking at night gets read-only access with sender anonymized as "Canavar ???"
    littleGirl.isPeeking = true;
    expect(canReadChannel(room, littleGirl, 'wolves')).toBe(true);
    expect(canWriteToChannel(room, littleGirl, 'wolves').allowed).toBe(false);

    const wolfMsg: ChatMessage = {
      id: 'm-wolf-1',
      senderId: wolf.id,
      senderName: wolf.nickname,
      senderColor: '#fb7185',
      channel: 'wolves',
      channelBadge: '🐺 Canavarlar',
      content: 'Bu gecə kimi yeyirik?',
      timestamp: Date.now(),
    };

    const forWolf = formatMessageForRecipient(room, wolf, wolfMsg);
    expect(forWolf?.senderName).toBe(wolf.nickname);
    expect(forWolf?.isAnonymized).toBeUndefined();

    const forLittleGirl = formatMessageForRecipient(room, littleGirl, wolfMsg);
    expect(forLittleGirl).not.toBeNull();
    expect(forLittleGirl?.senderName).toBe('Canavar ???');
    expect(forLittleGirl?.senderId).toBe('ANONYMOUS_WOLF');
    expect(forLittleGirl?.isAnonymized).toBe(true);

    const forVillager = formatMessageForRecipient(room, villager, wolfMsg);
    expect(forVillager).toBeNull();

    // 3. SIBLINGS channel: accessible Day & Night only to alive SISTERS
    expect(canWriteToChannel(room, sister1, 'siblings').allowed).toBe(true);
    expect(canReadChannel(room, sister2, 'siblings')).toBe(true);
    expect(canReadChannel(room, villager, 'siblings')).toBe(false);
    expect(canWriteToChannel(room, wolf, 'siblings').allowed).toBe(false);

    // 4. LOVERS channel: accessible Day & Night only to the two alive linked Lovers (p1 & p7)
    expect(canWriteToChannel(room, wolf, 'lovers').allowed).toBe(true);
    expect(canWriteToChannel(room, villager, 'lovers').allowed).toBe(true);
    expect(canReadChannel(room, sister1, 'lovers')).toBe(false);

    // 5. DEAD channel: accessible to dead players anytime, and to alive MEDIUM during NIGHT_PHASE
    expect(canWriteToChannel(room, medium, 'dead').allowed).toBe(true);
    expect(canReadChannel(room, medium, 'dead')).toBe(true);
    expect(canReadChannel(room, villager, 'dead')).toBe(false);

    // Eliminate sister2 and transition to DAY_DISCUSSION
    sister2.isAlive = false;
    room.phase = 'DAY_DISCUSSION';

    // Dead player can write to 'dead' but NOT 'public' or 'siblings'
    expect(canWriteToChannel(room, sister2, 'dead').allowed).toBe(true);
    expect(canWriteToChannel(room, sister2, 'public').allowed).toBe(false);
    expect(canWriteToChannel(room, sister2, 'siblings').allowed).toBe(false);

    // During Day, alive Medium loses access to 'dead', and alive players can write to 'public'
    expect(canReadChannel(room, medium, 'dead')).toBe(false);
    expect(canWriteToChannel(room, villager, 'public').allowed).toBe(true);
    // Siblings and Lovers remain active during Day
    expect(canWriteToChannel(room, sister1, 'siblings').allowed).toBe(true);
    expect(canWriteToChannel(room, villager, 'lovers').allowed).toBe(true);
  });
});
