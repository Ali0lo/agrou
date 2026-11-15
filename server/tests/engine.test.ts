import { describe, expect, it } from 'vitest';
import {
  FACTION_QUOTA_TABLE,
  NORMAL_SPECIAL_ROLES,
  QATIL_SPECIAL_ROLES,
  TEREFSIZ_ROLES,
} from '../src/constants/roles.js';
import {
  canReadChannel,
  canWriteToChannel,
  formatMessageForRecipient,
} from '../src/engine/ChatAuthorization.js';
import {
  createInitialRoomState,
  createPlayerState,
  DEFAULT_ENABLED_ROLES,
  GameEngine,
} from '../src/engine/GameEngine.js';
import { isQatilFactionRole, isWolfPackRole } from '../src/engine/roles/RoleStrategy.js';
import { sanitizeStateForPlayer } from '../src/engine/StateSanitizer.js';
import { WinConditionChecker } from '../src/engine/WinConditionChecker.js';
import { ChatMessage, RoleType, RoomState } from '../src/types/game.js';

function createTestRoomWithRoles(roles: RoleType[]): RoomState {
  const room = createInitialRoomState('TEST5');
  roles.forEach((role, index) => {
    const p = createPlayerState({
      id: `p${index + 1}`,
      socketId: `s${index + 1}`,
      nickname: `Player${index + 1}`,
      avatar: '🦊',
      color: '#f97316',
      seatIndex: index,
      isHost: index === 0,
      isBot: false,
    });
    p.role = role;
    p.originalRole = role;
    p.faction =
      role === 'WEREWOLF' ||
      role === 'BLACK_WOLF' ||
      role === 'MYSTIC_WOLF' ||
      role === 'VENGEFUL_WOLF' ||
      role === 'SHADOW_WOLF'
        ? 'WEREWOLF'
        : role === 'ANGEL' ||
            role === 'WHITE_WOLF' ||
            role === 'ARSONIST' ||
            role === 'JESTER'
          ? 'NEUTRAL'
          : 'VILLAGE';
    p.elderLivesRemaining = role === 'ELDER' ? 2 : 1;
    room.players.push(p);
  });
  room.dayNumber = 1;
  room.nightNumber = 1;
  room.phase = 'NIGHT_PHASE';
  return room;
}

describe('Campfire Wolves - Automatic Faction Quotas & 4-16 Player Deck Builder', () => {
  it('registers all 20 playable roles cleanly', () => {
    expect(GameEngine.getAllRoleKeys()).toHaveLength(20);
  });

  it('enforces exact Normal / Qatil / Tərəfsiz quotas and max-1 special uniqueness for every N in [4..16]', () => {
    for (let n = 4; n <= 16; n++) {
      const expected = FACTION_QUOTA_TABLE[n];
      expect(expected).toBeDefined();
      expect(expected.normal + expected.qatil + expected.terefsiz).toBe(n);

      const deck = GameEngine.buildRoleDeck(n, { ...DEFAULT_ENABLED_ROLES });
      expect(deck).toHaveLength(n);

      let normalCount = 0;
      let qatilCount = 0;
      let terefsizCount = 0;
      const specialCounts = new Map<RoleType, number>();

      for (const role of deck) {
        if (role === 'VILLAGER' || NORMAL_SPECIAL_ROLES.includes(role)) {
          normalCount += 1;
        } else if (role === 'WEREWOLF' || QATIL_SPECIAL_ROLES.includes(role)) {
          qatilCount += 1;
        } else if (TEREFSIZ_ROLES.includes(role)) {
          terefsizCount += 1;
        }

        if (role !== 'VILLAGER' && role !== 'WEREWOLF') {
          specialCounts.set(role, (specialCounts.get(role) ?? 0) + 1);
        }
      }

      expect(normalCount).toBe(expected.normal);
      expect(qatilCount).toBe(expected.qatil);
      expect(terefsizCount).toBe(expected.terefsiz);

      // Strict maximum of 1 per special role across every game
      for (const count of specialCounts.values()) {
        expect(count).toBe(1);
      }
    }
  });

  it('overflows missing disabled Tərəfsiz slots into Normal fillers and respects disabled specials', () => {
    // 12 players usually: Normal 7, Qatil 2, Tərəfsiz 3.
    // Disable ALL Tərəfsiz + ALL special roles -> 10 VILLAGER + 2 WEREWOLF.
    const toggles: Record<RoleType, boolean> = {
      VILLAGER: true,
      SEER: false,
      WITCH: false,
      GUARD: false,
      HUNTER: false,
      LITTLE_GIRL: false,
      ELDER: false,
      BEAR_TAMER: false,
      CROW: false,
      CUPID: false,
      WEREWOLF: true,
      BLACK_WOLF: false,
      MYSTIC_WOLF: false,
      VENGEFUL_WOLF: false,
      SHADOW_WOLF: false,
      ANGEL: false,
      WHITE_WOLF: false,
      ARSONIST: false,
      JESTER: false,
      WILD_CHILD: false,
    };

    const deck = GameEngine.buildRoleDeck(12, toggles);
    expect(deck).toHaveLength(12);
    expect(deck.filter((r) => r === 'VILLAGER')).toHaveLength(10);
    expect(deck.filter((r) => r === 'WEREWOLF')).toHaveLength(2);
    expect(deck.some((r) => TEREFSIZ_ROLES.includes(r))).toBe(false);

    // Enable only SEER and WHITE_WOLF for 12 players ->
    // 1 White Wolf + 2 Tərəfsiz shortage overflows into Normal (9 total Normal = 1 Seer + 8 Villager)
    const partialToggles: Record<RoleType, boolean> = {
      ...toggles,
      SEER: true,
      WHITE_WOLF: true,
    };
    const partialDeck = GameEngine.buildRoleDeck(12, partialToggles);
    expect(partialDeck.filter((r) => r === 'WHITE_WOLF')).toHaveLength(1);
    expect(partialDeck.filter((r) => r === 'SEER')).toHaveLength(1);
    expect(partialDeck.filter((r) => r === 'VILLAGER')).toHaveLength(8);
    expect(partialDeck.filter((r) => r === 'WEREWOLF')).toHaveLength(2);
  });

  it('enforces max-1 special role uniqueness across all 20 roles for player counts 4..16', () => {
    const allEnabled = { ...DEFAULT_ENABLED_ROLES };
    const fillerSet = new Set<RoleType>(['VILLAGER', 'WEREWOLF']);

    for (let playerCount = 4; playerCount <= 16; playerCount++) {
      const deck = GameEngine.buildRoleDeck(playerCount, allEnabled);
      expect(deck).toHaveLength(playerCount);

      const seenSpecials = new Set<RoleType>();
      for (const role of deck) {
        if (!fillerSet.has(role)) {
          expect(seenSpecials.has(role)).toBe(false);
          seenSpecials.add(role);
        }
      }
    }
  });

  it('rejects out-of-range player counts outside [4..16]', () => {
    expect(() =>
      GameEngine.buildRoleDeck(3, { ...DEFAULT_ENABLED_ROLES })
    ).toThrow();
    expect(() =>
      GameEngine.buildRoleDeck(17, { ...DEFAULT_ENABLED_ROLES })
    ).toThrow();
  });
});

describe('Campfire Wolves - State Sanitization & Security Boundaries', () => {
  it('masks hidden roles from living players, exposes Qatil allies (masking White Wolf as Werewolf), and reveals to spectators / Game Over', () => {
    const room = createTestRoomWithRoles([
      'SEER',       // p1
      'WEREWOLF',   // p2
      'WHITE_WOLF', // p3
      'ARSONIST',   // p4
      'VILLAGER',   // p5
    ]);

    // p1 (Seer) only sees self role
    const seerView = sanitizeStateForPlayer(room, 'p1');
    expect(seerView.self?.role).toBe('SEER');
    expect(seerView.players.find((p) => p.id === 'p1')?.role).toBe('SEER');
    expect(seerView.players.find((p) => p.id === 'p2')?.role).toBe('UNKNOWN');
    expect(seerView.players.find((p) => p.id === 'p3')?.role).toBe('UNKNOWN');
    expect(seerView.players.find((p) => p.id === 'p4')?.role).toBe('UNKNOWN');

    // p2 (Werewolf) sees p3 (White Wolf) disguised as base WEREWOLF
    const wolfView = sanitizeStateForPlayer(room, 'p2');
    expect(wolfView.players.find((p) => p.id === 'p2')?.role).toBe('WEREWOLF');
    expect(wolfView.players.find((p) => p.id === 'p3')?.role).toBe('WEREWOLF');
    expect(wolfView.players.find((p) => p.id === 'p4')?.role).toBe('UNKNOWN');

    // p3 (White Wolf) still knows their own true WHITE_WOLF identity
    const whiteWolfView = sanitizeStateForPlayer(room, 'p3');
    expect(whiteWolfView.self?.role).toBe('WHITE_WOLF');
    expect(whiteWolfView.players.find((p) => p.id === 'p3')?.role).toBe('WHITE_WOLF');
    expect(whiteWolfView.players.find((p) => p.id === 'p2')?.role).toBe('WEREWOLF');

    // Dead spectator p5 sees all true roles
    room.players[4].isAlive = false;
    const deadView = sanitizeStateForPlayer(room, 'p5');
    expect(deadView.players.find((p) => p.id === 'p3')?.role).toBe('WHITE_WOLF');
    expect(deadView.players.find((p) => p.id === 'p4')?.role).toBe('ARSONIST');
  });

  it('respects revealDeadRoles = false by hiding eliminated players roles from living players', () => {
    const room = createTestRoomWithRoles([
      'WEREWOLF', // p1
      'VILLAGER', // p2
      'SEER',     // p3
      'GUARD',    // p4
    ]);
    room.config.revealDeadRoles = false;

    GameEngine.submitNightAction(room, 'p1', {
      actionType: 'WOLF_VOTE',
      targetId: 'p2',
    });
    GameEngine.resolveNightAndEnterDawn(room);

    const livingView = sanitizeStateForPlayer(room, 'p3');
    const deadSeat = livingView.players.find((p) => p.id === 'p2')!;
    expect(deadSeat.isAlive).toBe(false);
    expect(deadSeat.revealedRole).toBeNull();
    expect(livingView.lastNightCasualties[0].role).toBe('UNKNOWN');
  });
});

describe('Campfire Wolves - Core & 12-Role Night Resolution Mechanics', () => {
  it('resolves Guard protection, consecutive-night block, and Witch Heal / Poison', () => {
    const room = createTestRoomWithRoles([
      'WEREWOLF', // p1
      'GUARD',    // p2
      'WITCH',    // p3
      'VILLAGER', // p4
      'SEER',     // p5
    ]);

    // Wolves target p5 (Seer), Guard protects p5 -> saved!
    GameEngine.submitNightAction(room, 'p1', {
      actionType: 'WOLF_VOTE',
      targetId: 'p5',
    });
    GameEngine.submitNightAction(room, 'p2', {
      actionType: 'GUARD_PROTECT',
      targetId: 'p5',
    });
    GameEngine.resolveNightAndEnterDawn(room);

    expect(room.players.find((p) => p.id === 'p5')?.isAlive).toBe(true);
    expect(room.lastNightCasualties).toHaveLength(0);

    // Night 2: Guard cannot protect p5 twice in a row
    room.nightNumber = 2;
    GameEngine.enterNightPhase(room);
    const repeatGuard = GameEngine.submitNightAction(room, 'p2', {
      actionType: 'GUARD_PROTECT',
      targetId: 'p5',
    });
    expect(repeatGuard.valid).toBe(false);

    // Wolves attack p4, Witch heals p4 AND poisons p1 -> p4 lives, p1 dies
    GameEngine.submitNightAction(room, 'p1', {
      actionType: 'WOLF_VOTE',
      targetId: 'p4',
    });
    GameEngine.submitNightAction(room, 'p3', {
      actionType: 'WITCH_HEAL',
      targetId: 'p4',
    });
    GameEngine.submitNightAction(room, 'p3', {
      actionType: 'WITCH_POISON',
      targetId: 'p1',
    });
    GameEngine.resolveNightAndEnterDawn(room);

    expect(room.players.find((p) => p.id === 'p4')?.isAlive).toBe(true);
    expect(room.players.find((p) => p.id === 'p1')?.isAlive).toBe(false);
    expect(room.witchPotions.healAvailable).toBe(false);
    expect(room.witchPotions.poisonAvailable).toBe(false);
  });

  it('allows Black Wolf 1x infection (turning victim into Werewolf) and blocks infection if victim was saved', () => {
    const room = createTestRoomWithRoles([
      'BLACK_WOLF', // p1
      'VILLAGER',   // p2
      'SEER',       // p3
      'GUARD',      // p4
    ]);

    GameEngine.submitNightAction(room, 'p1', {
      actionType: 'WOLF_VOTE',
      targetId: 'p2',
    });
    GameEngine.submitNightAction(room, 'p1', {
      actionType: 'BLACK_WOLF_INFECT',
      targetId: 'p2',
    });
    GameEngine.resolveNightAndEnterDawn(room);

    const infected = room.players.find((p) => p.id === 'p2')!;
    expect(infected.isAlive).toBe(true);
    expect(infected.role).toBe('WEREWOLF');
    expect(infected.faction).toBe('WEREWOLF');
    expect(room.blackWolfInfectionAvailable).toBe(false);
    expect(room.lastNightCasualties).toHaveLength(0);
  });

  it('implements Mystic Wolf inspection returning boolean special power vs base Villager without leaking exact role', () => {
    const room = createTestRoomWithRoles([
      'MYSTIC_WOLF', // p1
      'VILLAGER',    // p2
      'SEER',        // p3
      'ARSONIST',    // p4
      'WEREWOLF',    // p5
    ]);

    // Cannot inspect fellow wolf
    const invalidSelfTeam = GameEngine.submitNightAction(room, 'p1', {
      actionType: 'MYSTIC_WOLF_INSPECT',
      targetId: 'p5',
    });
    expect(invalidSelfTeam.valid).toBe(false);

    // Night 1: Inspect p3 (SEER -> true: hasSpecialPower)
    const inspectSeer = GameEngine.submitNightAction(room, 'p1', {
      actionType: 'MYSTIC_WOLF_INSPECT',
      targetId: 'p3',
    });
    expect(inspectSeer.valid).toBe(true);
    GameEngine.resolveNightAndEnterDawn(room);

    expect(room.players[0].mysticWolfInspections['p3']).toBe(true);

    // Sanitized state carries mysticWolfInspections booleans ONLY (not Seer's role name)
    const mysticSanitized = sanitizeStateForPlayer(room, 'p1');
    expect(mysticSanitized.self?.mysticWolfInspections['p3']).toBe(true);
    expect(mysticSanitized.players.find((p) => p.id === 'p3')?.role).toBe('UNKNOWN');

    // Night 2: Inspect p2 (VILLAGER -> false)
    room.nightNumber = 2;
    GameEngine.enterNightPhase(room);
    const inspectVillager = GameEngine.submitNightAction(room, 'p1', {
      actionType: 'MYSTIC_WOLF_INSPECT',
      targetId: 'p2',
    });
    expect(inspectVillager.valid).toBe(true);
    GameEngine.resolveNightAndEnterDawn(room);

    expect(room.players[0].mysticWolfInspections['p2']).toBe(false);

    // Night 3: Inspect p4 (ARSONIST -> true: neutral special role)
    room.nightNumber = 3;
    GameEngine.enterNightPhase(room);
    GameEngine.submitNightAction(room, 'p1', {
      actionType: 'MYSTIC_WOLF_INSPECT',
      targetId: 'p4',
    });
    GameEngine.resolveNightAndEnterDawn(room);
    expect(room.players[0].mysticWolfInspections['p4']).toBe(true);
  });

  it('implements Arsonist Douse across multiple nights and simultaneous Ignite (even piercing Guard protection) to win solo', () => {
    const room = createTestRoomWithRoles([
      'ARSONIST', // p1
      'GUARD',    // p2
      'WEREWOLF', // p3
      'VILLAGER', // p4
    ]);

    // Cannot ignite before dousing anyone
    const emptyIgnite = GameEngine.submitNightAction(room, 'p1', {
      actionType: 'ARSONIST_IGNITE',
    });
    expect(emptyIgnite.valid).toBe(false);

    // Night 1: Douse p2 (Guard)
    expect(
      GameEngine.submitNightAction(room, 'p1', {
        actionType: 'ARSONIST_DOUSE',
        targetId: 'p2',
      }).valid
    ).toBe(true);
    GameEngine.resolveNightAndEnterDawn(room);
    expect(room.arsonistDousedIds).toEqual(['p2']);

    // Night 2: Douse p3 (Werewolf)
    room.nightNumber = 2;
    GameEngine.enterNightPhase(room);
    GameEngine.submitNightAction(room, 'p1', {
      actionType: 'ARSONIST_DOUSE',
      targetId: 'p3',
    });
    GameEngine.resolveNightAndEnterDawn(room);
    expect(room.arsonistDousedIds).toEqual(['p2', 'p3']);

    // Night 3: Douse p4 (Villager)
    room.nightNumber = 3;
    GameEngine.enterNightPhase(room);
    GameEngine.submitNightAction(room, 'p1', {
      actionType: 'ARSONIST_DOUSE',
      targetId: 'p4',
    });
    GameEngine.resolveNightAndEnterDawn(room);

    // Night 4: Guard protects p2, Arsonist IGNITES -> p2, p3, p4 all burn simultaneously!
    room.nightNumber = 4;
    GameEngine.enterNightPhase(room);
    GameEngine.submitNightAction(room, 'p2', {
      actionType: 'GUARD_PROTECT',
      targetId: 'p2',
    });
    expect(
      GameEngine.submitNightAction(room, 'p1', {
        actionType: 'ARSONIST_IGNITE',
      }).valid
    ).toBe(true);

    GameEngine.resolveNightAndEnterDawn(room);
    expect(room.players.find((p) => p.id === 'p2')?.isAlive).toBe(false);
    expect(room.players.find((p) => p.id === 'p3')?.isAlive).toBe(false);
    expect(room.players.find((p) => p.id === 'p4')?.isAlive).toBe(false);
    expect(room.players.find((p) => p.id === 'p1')?.isAlive).toBe(true);
    expect(room.arsonistDousedIds).toEqual([]);

    // Next check awards ARSONIST solo survivor victory
    GameEngine.enterDayDiscussion(room);
    expect(room.phase).toBe('GAME_OVER');
    expect(room.winner).toBe('ARSONIST');
  });

  it('blocks White Wolf betrayal on odd nights, allows it on even nights, and awards win only as sole survivor', () => {
    const room = createTestRoomWithRoles([
      'WHITE_WOLF', // p1
      'WEREWOLF',   // p2
      'VILLAGER',   // p3
      'SEER',       // p4
    ]);

    // Night 1 (odd): betrayal rejected
    const oddBetray = GameEngine.submitNightAction(room, 'p1', {
      actionType: 'WHITE_WOLF_KILL',
      targetId: 'p2',
    });
    expect(oddBetray.valid).toBe(false);

    // Night 2 (even): White Wolf betrays and eliminates Werewolf (p2)
    room.nightNumber = 2;
    GameEngine.enterNightPhase(room);
    const evenBetray = GameEngine.submitNightAction(room, 'p1', {
      actionType: 'WHITE_WOLF_KILL',
      targetId: 'p2',
    });
    expect(evenBetray.valid).toBe(true);
    GameEngine.resolveNightAndEnterDawn(room);

    expect(room.players.find((p) => p.id === 'p2')?.isAlive).toBe(false);

    // Eliminate Villager & Seer -> White Wolf is sole survivor
    room.players[2].isAlive = false;
    room.players[3].isAlive = false;
    const winCheck = WinConditionChecker.check(room);
    expect(winCheck.isGameOver).toBe(true);
    expect(winCheck.winner).toBe('WHITE_WOLF');
  });

  it('triggers Hunter 15-second revenge shot on death and resolves immediate Village win', () => {
    const room = createTestRoomWithRoles([
      'WEREWOLF', // p1
      'HUNTER',   // p2
      'VILLAGER', // p3
      'SEER',     // p4
    ]);

    GameEngine.submitNightAction(room, 'p1', {
      actionType: 'WOLF_VOTE',
      targetId: 'p2',
    });
    const dawn = GameEngine.resolveNightAndEnterDawn(room);
    expect(dawn.hunterTriggered).toBe(true);
    expect(room.hunterRevenge?.hunterId).toBe('p2');

    const shot = GameEngine.resolveHunterShot(room, 'p2', 'p1');
    expect(shot.valid).toBe(true);
    expect(room.players.find((p) => p.id === 'p1')?.isAlive).toBe(false);
    expect(room.phase).toBe('GAME_OVER');
    expect(room.winner).toBe('VILLAGE');
  });

  it('tracks Little Girl peek exposure and emits alert to wolves', () => {
    const room = createTestRoomWithRoles([
      'WEREWOLF',    // p1
      'LITTLE_GIRL', // p2
      'VILLAGER',    // p3
      'SEER',        // p4
    ]);

    expect(GameEngine.toggleLittleGirlPeek(room, 'p2', true).valid).toBe(true);
    const t1 = GameEngine.tickLittleGirlExposure(room, () => 0.99);
    expect(t1.exposureLevel).toBeGreaterThan(0);
    expect(t1.wolfAlertTriggered).toBe(false);

    const t2 = GameEngine.tickLittleGirlExposure(room, () => 0.01);
    expect(t2.wolfAlertTriggered).toBe(true);
    expect(room.wolfAlertedThisNight).toBe(true);
  });
});

describe('Campfire Wolves - Day Voting, Angel, & Win Conditions', () => {
  it('awards Angel immediate Day 1 win on vote execution, and converts surviving Angel to Villager when Night 2 starts', () => {
    const room1 = createTestRoomWithRoles([
      'ANGEL',    // p1
      'WEREWOLF', // p2
      'VILLAGER', // p3
      'SEER',     // p4
    ]);
    GameEngine.resolveNightAndEnterDawn(room1);
    GameEngine.enterDayDiscussion(room1);
    GameEngine.enterDayVoting(room1);

    GameEngine.castDayVote(room1, 'p2', 'p1');
    GameEngine.castDayVote(room1, 'p3', 'p1');
    GameEngine.resolveDayVotesAndEnterExecution(room1);
    expect(room1.phase).toBe('GAME_OVER');
    expect(room1.winner).toBe('ANGEL');

    // Case 2: Angel survives Day 1 -> converts into VILLAGER as Night 2 begins
    const room2 = createTestRoomWithRoles([
      'ANGEL',    // p1
      'WEREWOLF', // p2
      'VILLAGER', // p3
      'SEER',     // p4
    ]);
    GameEngine.resolveNightAndEnterDawn(room2);
    GameEngine.enterDayDiscussion(room2);
    GameEngine.enterDayVoting(room2);
    GameEngine.castDayVote(room2, 'p1', 'SKIP');
    GameEngine.resolveDayVotesAndEnterExecution(room2);
    GameEngine.completeExecutionAndLoopToNight(room2);

    const formerAngel = room2.players.find((p) => p.id === 'p1')!;
    expect(formerAngel.role).toBe('VILLAGER');
    expect(formerAngel.faction).toBe('VILLAGE');
  });

  it('prevents Qatil win while a lethal Tərəfsiz (Arsonist / White Wolf) is still alive', () => {
    const room = createTestRoomWithRoles([
      'WEREWOLF', // p1
      'WEREWOLF', // p2
      'ARSONIST', // p3
      'VILLAGER', // p4
    ]);

    // Even with 2 Wolves vs 2 non-Wolves, Arsonist is still alive so Qatil hasn't won yet!
    const midCheck = WinConditionChecker.check(room);
    expect(midCheck.isGameOver).toBe(false);

    // Once Arsonist dies and Qatil >= non-Wolves, Werewolves win
    room.players[2].isAlive = false;
    const wolfWin = WinConditionChecker.check(room);
    expect(wolfWin.isGameOver).toBe(true);
    expect(wolfWin.winner).toBe('WEREWOLF');

    // Check helper predicates
    expect(isWolfPackRole('WHITE_WOLF')).toBe(true);
    expect(isQatilFactionRole('WHITE_WOLF')).toBe(false);
    expect(isQatilFactionRole('MYSTIC_WOLF')).toBe(true);
  });

  it('skips Day Discussion early with strict >50% votes and resolves tied Day Votes without execution', () => {
    const room = createTestRoomWithRoles([
      'WEREWOLF',
      'VILLAGER',
      'SEER',
      'GUARD',
    ]);
    GameEngine.resolveNightAndEnterDawn(room);
    GameEngine.enterDayDiscussion(room);

    GameEngine.toggleSkipDiscussion(room, 'p1');
    const half = GameEngine.toggleSkipDiscussion(room, 'p2');
    expect(half.transitionedToVoting).toBe(false);

    const majority = GameEngine.toggleSkipDiscussion(room, 'p3');
    expect(majority.transitionedToVoting).toBe(true);
    expect(room.phase).toBe('DAY_VOTING');

    GameEngine.castDayVote(room, 'p1', 'p2');
    GameEngine.castDayVote(room, 'p3', 'p2');
    GameEngine.castDayVote(room, 'p2', 'p1');
    GameEngine.castDayVote(room, 'p4', 'p1');

    const res = GameEngine.resolveDayVotesAndEnterExecution(room);
    expect(res.executedPlayer).toBeNull();
    expect(room.players.every((p) => p.isAlive)).toBe(true);
  });
});

describe('Campfire Wolves - Server-Authoritative Chat Channel Access', () => {
  it('enforces public, wolves (with anonymized Wolf 1/Wolf 2 for peeking Little Girl), and dead channel isolation', () => {
    const room = createTestRoomWithRoles([
      'MYSTIC_WOLF', // p1
      'WHITE_WOLF',  // p2
      'LITTLE_GIRL', // p3
      'VILLAGER',    // p4
    ]);
    GameEngine.enterNightPhase(room);

    const wolf1 = room.players[0];
    const wolf2 = room.players[1];
    const girl = room.players[2];
    const villager = room.players[3];

    // Public locked at night
    expect(canWriteToChannel(room, villager, 'public').allowed).toBe(false);
    expect(canReadChannel(room, villager, 'public')).toBe(true);

    // Wolves chat accessible to Mystic Wolf & White Wolf, blocked for Villager
    expect(canWriteToChannel(room, wolf1, 'wolves').allowed).toBe(true);
    expect(canWriteToChannel(room, wolf2, 'wolves').allowed).toBe(true);
    expect(canWriteToChannel(room, villager, 'wolves').allowed).toBe(false);
    expect(canReadChannel(room, villager, 'wolves')).toBe(false);

    // Little Girl peeking gets read-only anonymized Wolf 1 alias
    girl.isPeeking = true;
    expect(canReadChannel(room, girl, 'wolves')).toBe(true);
    expect(canWriteToChannel(room, girl, 'wolves').allowed).toBe(false);

    const wolfMsg: ChatMessage = {
      id: 'w-1',
      senderId: wolf1.id,
      senderName: wolf1.nickname,
      senderColor: '#fb7185',
      channel: 'wolves',
      channelBadge: '🐺 Qatil Çatı',
      content: 'Bu gecə Villageri götürək.',
      timestamp: Date.now(),
    };

    const forWolf = formatMessageForRecipient(room, wolf2, wolfMsg);
    expect(forWolf?.senderName).toBe(wolf1.nickname);

    const forGirl = formatMessageForRecipient(room, girl, wolfMsg);
    expect(forGirl).not.toBeNull();
    expect(forGirl?.senderName).toBe('Wolf 1');
    expect(forGirl?.isAnonymized).toBe(true);

    expect(formatMessageForRecipient(room, villager, wolfMsg)).toBeNull();

    // Dead channel accessible only to eliminated players
    expect(canReadChannel(room, villager, 'dead')).toBe(false);
    villager.isAlive = false;
    room.phase = 'DAY_DISCUSSION';
    expect(canWriteToChannel(room, villager, 'dead').allowed).toBe(true);
    expect(canWriteToChannel(room, villager, 'public').allowed).toBe(false);
    expect(canWriteToChannel(room, girl, 'public').allowed).toBe(true);
  });
});

describe('Campfire Wolves - 8 Classic Agrou Roles Mechanics', () => {
  it('draws all 8 new roles cleanly via buildRoleDeck when enabled', () => {
    const newSpecialToggles: Record<RoleType, boolean> = {
      VILLAGER: true,
      WEREWOLF: true,
      SEER: false,
      WITCH: false,
      GUARD: false,
      HUNTER: false,
      LITTLE_GIRL: false,
      BLACK_WOLF: false,
      MYSTIC_WOLF: false,
      ANGEL: false,
      WHITE_WOLF: false,
      ARSONIST: false,
      ELDER: true,
      BEAR_TAMER: true,
      CROW: true,
      CUPID: true,
      VENGEFUL_WOLF: true,
      SHADOW_WOLF: true,
      JESTER: true,
      WILD_CHILD: true,
    };

    const deck = GameEngine.buildRoleDeck(15, newSpecialToggles);
    expect(deck).toHaveLength(15);
    for (const expected of [
      'ELDER',
      'BEAR_TAMER',
      'CROW',
      'CUPID',
      'VENGEFUL_WOLF',
      'SHADOW_WOLF',
      'JESTER',
      'WILD_CHILD',
    ] as RoleType[]) {
      expect(deck.filter((r) => r === expected)).toHaveLength(1);
    }
  });

  it('Elder survives first Werewolf bite, dies on second bite, and strips Normal powers if voted out', () => {
    const room = createTestRoomWithRoles(['WEREWOLF', 'ELDER', 'SEER', 'VILLAGER']);
    const elder = room.players[1];

    // Bite 1 -> Elder survives with 1 life remaining
    GameEngine.submitNightAction(room, 'p1', { actionType: 'WOLF_VOTE', targetId: elder.id });
    GameEngine.submitNightAction(room, 'p3', { actionType: 'SEER_INSPECT', targetId: 'p1' });
    GameEngine.resolveNightAndEnterDawn(room);
    expect(elder.isAlive).toBe(true);
    expect(elder.elderLivesRemaining).toBe(1);

    // Bite 2 -> Elder dies
    room.phase = 'NIGHT_PHASE';
    room.nightNumber = 2;
    GameEngine.submitNightAction(room, 'p1', { actionType: 'WOLF_VOTE', targetId: elder.id });
    GameEngine.resolveNightAndEnterDawn(room);
    expect(elder.isAlive).toBe(false);
    expect(elder.elderLivesRemaining).toBe(0);

    // Executing Elder by Day Vote strips all Normal powers
    const voteRoom = createTestRoomWithRoles(['WEREWOLF', 'ELDER', 'SEER', 'VILLAGER', 'GUARD']);
    voteRoom.phase = 'DAY_VOTING';
    GameEngine.castDayVote(voteRoom, 'p1', 'p2');
    GameEngine.castDayVote(voteRoom, 'p3', 'p2');
    GameEngine.castDayVote(voteRoom, 'p4', 'p2');
    GameEngine.resolveDayVotesAndEnterExecution(voteRoom);

    expect(voteRoom.players[1].isAlive).toBe(false);
    expect(voteRoom.villagePowersLost).toBe(true);

    voteRoom.phase = 'NIGHT_PHASE';
    voteRoom.nightNumber = 2;
    const seerResult = GameEngine.submitNightAction(voteRoom, 'p3', {
      actionType: 'SEER_INSPECT',
      targetId: 'p1',
    });
    expect(seerResult.valid).toBe(false);
  });

  it('Bear Tamer growls at dawn only when an adjacent living neighbor is Qatil and powers remain intact', () => {
    const quietRoom = createTestRoomWithRoles([
      'VILLAGER',
      'BEAR_TAMER',
      'VILLAGER',
      'VENGEFUL_WOLF',
      'VILLAGER',
    ]);
    GameEngine.submitNightAction(quietRoom, 'p4', { actionType: 'WOLF_VOTE', targetId: 'p5' });
    GameEngine.resolveNightAndEnterDawn(quietRoom);
    expect(quietRoom.lastBearGrowled).toBe(false);

    const growlRoom = createTestRoomWithRoles([
      'VILLAGER',
      'BEAR_TAMER',
      'SHADOW_WOLF',
      'VILLAGER',
    ]);
    GameEngine.submitNightAction(growlRoom, 'p3', { actionType: 'WOLF_VOTE', targetId: 'p4' });
    GameEngine.resolveNightAndEnterDawn(growlRoom);
    expect(growlRoom.lastBearGrowled).toBe(true);

    growlRoom.phase = 'NIGHT_PHASE';
    growlRoom.nightNumber = 2;
    growlRoom.villagePowersLost = true;
    GameEngine.submitNightAction(growlRoom, 'p3', { actionType: 'WOLF_VOTE', targetId: 'p1' });
    GameEngine.resolveNightAndEnterDawn(growlRoom);
    expect(growlRoom.lastBearGrowled).toBe(false);
  });

  it('Crow adds +2 automatic penalty votes to cursed target on next day voting', () => {
    const room = createTestRoomWithRoles(['CROW', 'VILLAGER', 'VILLAGER', 'WEREWOLF']);
    GameEngine.submitNightAction(room, 'p1', { actionType: 'CROW_CURSE', targetId: 'p2' });
    GameEngine.submitNightAction(room, 'p4', { actionType: 'WOLF_VOTE', targetId: 'p1' });
    GameEngine.resolveNightAndEnterDawn(room);

    expect(room.cursedPlayerId).toBe('p2');
    room.phase = 'DAY_VOTING';
    // 1 real vote on p2 (+2 Crow penalty = 3) beats 2 real votes on p4
    GameEngine.castDayVote(room, 'p3', 'p2');
    GameEngine.castDayVote(room, 'p2', 'p4');
    GameEngine.castDayVote(room, 'p4', 'p4');
    const res = GameEngine.resolveDayVotesAndEnterExecution(room);
    expect(res.executedPlayer?.playerId).toBe('p2');
    expect(room.players[1].isAlive).toBe(false);
  });

  it('Cupid links Lovers with private chat, heartbreak cascade, and mixed Lovers solo win', () => {
    const room = createTestRoomWithRoles(['CUPID', 'VILLAGER', 'WEREWOLF', 'GUARD', 'VILLAGER']);
    GameEngine.submitNightAction(room, 'p1', {
      actionType: 'CUPID_LINK',
      targetId: 'p2',
      secondTargetId: 'p3',
    });
    GameEngine.submitNightAction(room, 'p4', { actionType: 'GUARD_PROTECT', targetId: 'p5' });
    GameEngine.submitNightAction(room, 'p3', { actionType: 'WOLF_VOTE', targetId: 'p5' });
    GameEngine.resolveNightAndEnterDawn(room);

    const loverA = room.players[1];
    const loverB = room.players[2];
    const cupid = room.players[0];
    expect(loverA.loverPartnerId).toBe(loverB.id);
    expect(loverB.loverPartnerId).toBe(loverA.id);

    // Lovers private chat isolation
    expect(canReadChannel(room, loverA, 'lovers')).toBe(true);
    expect(canWriteToChannel(room, loverB, 'lovers').allowed).toBe(true);
    expect(canReadChannel(room, cupid, 'lovers')).toBe(false);
    expect(canWriteToChannel(room, cupid, 'lovers').allowed).toBe(false);

    // Mixed Lovers (Villager + Werewolf) as final 2 survivors triggers LOVERS solo win
    const endgameRoom = createTestRoomWithRoles(['VILLAGER', 'WEREWOLF']);
    endgameRoom.players[0].loverPartnerId = 'p2';
    endgameRoom.players[1].loverPartnerId = 'p1';
    expect(WinConditionChecker.check(endgameRoom).winner).toBe('LOVERS');

    // Executing one lover triggers HEARTBREAK death of the partner
    room.phase = 'DAY_VOTING';
    GameEngine.castDayVote(room, 'p1', 'p2');
    GameEngine.castDayVote(room, 'p4', 'p2');
    GameEngine.castDayVote(room, 'p5', 'p2');
    GameEngine.castDayVote(room, 'p2', 'SKIP');
    GameEngine.castDayVote(room, 'p3', 'SKIP');
    GameEngine.resolveDayVotesAndEnterExecution(room);

    expect(loverA.isAlive).toBe(false);
    expect(loverB.isAlive).toBe(false);
    expect(loverB.deathReason).toContain('Heartbreak');
  });

  it('Vengeful Wolf fires a 15s revenge shot when executed by Village day vote', () => {
    const room = createTestRoomWithRoles(['VENGEFUL_WOLF', 'VILLAGER', 'VILLAGER', 'VILLAGER']);
    room.phase = 'DAY_VOTING';
    GameEngine.castDayVote(room, 'p2', 'p1');
    GameEngine.castDayVote(room, 'p3', 'p1');
    GameEngine.castDayVote(room, 'p4', 'p1');

    const res = GameEngine.resolveDayVotesAndEnterExecution(room);
    expect(res.hunterTriggered).toBe(true);
    expect(room.phase).toBe('EXECUTION_REVEAL');
    expect(room.hunterRevenge?.resolved).toBe(false);
    expect(room.hunterRevenge?.revengeRole).toBe('VENGEFUL_WOLF');

    const shot = GameEngine.resolveHunterShot(room, 'p1', 'p2');
    expect(shot.valid).toBe(true);
    expect(room.players[1].isAlive).toBe(false);
    expect(room.players[1].deathReason).toContain('Vengeful Wolf');
  });

  it('Shadow Wolf hides live day vote counts during voting and reveals on execution', () => {
    const room = createTestRoomWithRoles(['SHADOW_WOLF', 'VILLAGER', 'VILLAGER', 'VILLAGER']);
    room.phase = 'DAY_VOTING';

    const firstUse = GameEngine.activateShadowWolfHideVotes(room, 'p1');
    expect(firstUse.valid).toBe(true);
    expect(room.dayVotesHidden).toBe(true);
    expect(room.shadowWolfAbilityAvailable).toBe(false);

    GameEngine.castDayVote(room, 'p1', 'p2');
    GameEngine.castDayVote(room, 'p2', 'p1');
    GameEngine.castDayVote(room, 'p3', 'p1');

    const maskedForVoter = sanitizeStateForPlayer(room, 'p2');
    expect(maskedForVoter.dayVotesHidden).toBe(true);
    expect(maskedForVoter.dayVotes).toEqual({ p2: 'p1' });

    const secondUse = GameEngine.activateShadowWolfHideVotes(room, 'p1');
    expect(secondUse.valid).toBe(false);

    GameEngine.resolveDayVotesAndEnterExecution(room);
    const revealedAfterVote = sanitizeStateForPlayer(room, 'p2');
    expect(revealedAfterVote.dayVotesHidden).toBe(false);
    expect(Object.keys(revealedAfterVote.dayVotes).length).toBeGreaterThan(1);
  });

  it('Jester wins immediately when voted out by the village on any day', () => {
    const room = createTestRoomWithRoles(['JESTER', 'VILLAGER', 'VILLAGER', 'WEREWOLF']);
    room.dayNumber = 2;
    room.phase = 'DAY_VOTING';

    GameEngine.castDayVote(room, 'p2', 'p1');
    GameEngine.castDayVote(room, 'p3', 'p1');
    GameEngine.castDayVote(room, 'p4', 'p1');

    const res = GameEngine.resolveDayVotesAndEnterExecution(room);
    expect(res.gameEnded).toBe(true);
    expect(room.winner).toBe('JESTER');
    expect(room.phase).toBe('GAME_OVER');
  });

  it('Wild Child starts Normal and secretly transforms into Werewolf if Role Model dies', () => {
    const room = createTestRoomWithRoles(['WILD_CHILD', 'VILLAGER', 'VILLAGER', 'WEREWOLF']);
    const wildChild = room.players[0];
    expect(wildChild.faction).toBe('VILLAGE');

    GameEngine.submitNightAction(room, 'p1', {
      actionType: 'WILD_CHILD_MODEL',
      targetId: 'p2',
    });
    GameEngine.submitNightAction(room, 'p4', { actionType: 'WOLF_VOTE', targetId: 'p2' });
    GameEngine.resolveNightAndEnterDawn(room);

    expect(room.players[1].isAlive).toBe(false);
    expect(wildChild.role).toBe('WEREWOLF');
    expect(wildChild.faction).toBe('WEREWOLF');
    expect(wildChild.transformedFromWildChild).toBe(true);

    // Packmate sees transformed Wild Child as Werewolf and shares wolves chat at night
    room.phase = 'NIGHT_PHASE';
    room.nightNumber = 2;
    const packView = sanitizeStateForPlayer(room, 'p4');
    expect(packView.players.find((p) => p.id === 'p1')?.role).toBe('WEREWOLF');
    expect(canReadChannel(room, wildChild, 'wolves')).toBe(true);
  });
});
