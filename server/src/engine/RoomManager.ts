import crypto from 'node:crypto';
import { Server as SocketIOServer } from 'socket.io';
import {
  ChatChannel,
  ChatMessage,
  NightActionPayload,
  PhaseTimers,
  PlayerState,
  RoleType,
  RoomState,
} from '../types/game.js';
import {
  CHANNEL_BADGES,
  canWriteToChannel,
  formatMessageForRecipient,
  normalizeChatChannel,
} from './ChatAuthorization.js';
import {
  createInitialRoomState,
  createPlayerState,
  GameEngine,
} from './GameEngine.js';
import { isWolfPackRole } from './roles/RoleStrategy.js';
import { sanitizeStateForPlayer } from './StateSanitizer.js';

const BOT_PRESETS = [
  { nickname: 'Rowan', avatar: '🦉', color: '#f59e0b' },
  { nickname: 'Sylvi', avatar: '🦌', color: '#10b981' },
  { nickname: 'Gideon', avatar: '🐻', color: '#3b82f6' },
  { nickname: 'Vesper', avatar: '🐈‍⬛', color: '#8b5cf6' },
  { nickname: 'Bramble', avatar: '🦔', color: '#ec4899' },
  { nickname: 'Ash', avatar: '🐺', color: '#ef4444' },
  { nickname: 'Fern', avatar: '🐸', color: '#14b8a6' },
  { nickname: 'Orion', avatar: '🦅', color: '#6366f1' },
  { nickname: 'Wren', avatar: '🐿️', color: '#f97316' },
  { nickname: 'Moss', avatar: '🦡', color: '#84cc16' },
  { nickname: 'Ember', avatar: '🦊', color: '#eab308' },
  { nickname: 'Luna', avatar: '🌙', color: '#a855f7' },
  { nickname: 'Thorne', avatar: '🐗', color: '#ef4444' },
  { nickname: 'Willow', avatar: '🦢', color: '#06b6d4' },
  { nickname: 'Draven', avatar: '🦇', color: '#ec4899' },
];

export type SoundCueType =
  | 'NIGHTFALL'
  | 'DAWN_ROOSTER'
  | 'WOLF_HOWL'
  | 'GAVEL'
  | 'HUNTER_SHOT'
  | 'VICTORY';

export class RoomManager {
  private rooms = new Map<string, RoomState>();
  private roomTimers = new Map<string, NodeJS.Timeout>();
  private nightTickIntervals = new Map<string, NodeJS.Timeout>();
  private io: SocketIOServer | null = null;

  constructor(io?: SocketIOServer) {
    if (io) {
      this.io = io;
    }
  }

  public setSocketServer(io: SocketIOServer): void {
    this.io = io;
  }

  public generateRoomCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = '';
      for (let i = 0; i < 5; i++) {
        code += alphabet[crypto.randomInt(0, alphabet.length)];
      }
      if (!this.rooms.has(code)) {
        return code;
      }
    }
    return crypto.randomBytes(3).toString('hex').slice(0, 5).toUpperCase();
  }

  public getRoom(roomCode: string): RoomState | undefined {
    return this.rooms.get(roomCode.toUpperCase());
  }

  public createRoom(params: {
    socketId: string;
    nickname: string;
    avatar: string;
    color: string;
    sessionToken?: string;
  }): { room: RoomState; player: PlayerState } {
    const roomCode = this.generateRoomCode();
    const room = createInitialRoomState(roomCode);
    const hostPlayer = createPlayerState({
      socketId: params.socketId,
      sessionToken: params.sessionToken,
      nickname: params.nickname,
      avatar: params.avatar,
      color: params.color,
      seatIndex: 0,
      isHost: true,
    });

    room.players.push(hostPlayer);
    this.rooms.set(roomCode, room);
    GameEngine.appendSystemMessage(
      room,
      `${hostPlayer.nickname} tonqalı yandırdı! Dostlarınızı dəvət etmək üçün kod: ${roomCode}`
    );

    return { room, player: hostPlayer };
  }

  public joinRoom(params: {
    roomCode: string;
    socketId: string;
    nickname: string;
    avatar: string;
    color: string;
    sessionToken?: string;
  }): { room?: RoomState; player?: PlayerState; error?: string } {
    const code = params.roomCode.trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) {
      return { error: `Room "${code}" does not exist.` };
    }

    if (params.sessionToken) {
      const existing = room.players.find(
        (p) => p.sessionToken === params.sessionToken
      );
      if (existing) {
        existing.socketId = params.socketId;
        existing.isConnected = true;
        if (room.phase === 'LOBBY' && params.nickname.trim()) {
          existing.nickname = params.nickname.trim().slice(0, 20);
          existing.avatar = params.avatar || existing.avatar;
          existing.color = params.color || existing.color;
        }
        return { room, player: existing };
      }
    }

    if (room.phase !== 'LOBBY') {
      return {
        error:
          'This match is already in progress. Reconnect from your original browser tab if you were already seated.',
      };
    }

    if (room.players.length >= 16) {
      return { error: 'This campfire is full (maximum 16 players).' };
    }

    let desiredName = params.nickname.trim().slice(0, 20) || 'Wanderer';
    if (
      room.players.some(
        (p) => p.nickname.toLowerCase() === desiredName.toLowerCase()
      )
    ) {
      desiredName = `${desiredName.slice(0, 16)}-${room.players.length + 1}`;
    }

    const player = createPlayerState({
      socketId: params.socketId,
      sessionToken: params.sessionToken,
      nickname: desiredName,
      avatar: params.avatar,
      color: params.color,
      seatIndex: room.players.length,
      isHost: room.players.length === 0,
    });

    room.players.push(player);
    GameEngine.appendSystemMessage(
      room,
      `${player.nickname} tonqal ətrafında əyləşdi.`
    );

    return { room, player };
  }

  public reconnectPlayer(params: {
    roomCode: string;
    sessionToken: string;
    socketId: string;
  }): { room?: RoomState; player?: PlayerState; error?: string } {
    const code = params.roomCode.trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) {
      return { error: 'Room no longer exists.' };
    }

    const player = room.players.find(
      (p) => p.sessionToken === params.sessionToken
    );
    if (!player) {
      return { error: 'Session token not found in this room.' };
    }

    player.socketId = params.socketId;
    player.isConnected = true;
    return { room, player };
  }

  public handleDisconnect(socketId: string): void {
    for (const room of this.rooms.values()) {
      const player = room.players.find((p) => p.socketId === socketId);
      if (!player) continue;

      player.isConnected = false;
      player.isSpeaking = false;
      player.isTyping = false;

      if (player.isHost && room.phase === 'LOBBY') {
        const nextHost = room.players.find(
          (p) => p.id !== player.id && !p.isBot && p.isConnected
        );
        if (nextHost) {
          player.isHost = false;
          nextHost.isHost = true;
        }
      }

      this.broadcastSanitizedState(room.roomCode);
    }
  }

  public addBot(roomCode: string, requesterId: string): { error?: string } {
    const room = this.getRoom(roomCode);
    if (!room) return { error: 'Room not found.' };
    if (room.phase !== 'LOBBY') return { error: 'Cannot add bots mid-game.' };
    const requester = room.players.find((p) => p.id === requesterId);
    if (!requester?.isHost) return { error: 'Only the host can add bots.' };
    if (room.players.length >= 16) return { error: 'Room is full (max 16).' };

    const usedNames = new Set(room.players.map((p) => p.nickname));
    const preset =
      BOT_PRESETS.find((b) => !usedNames.has(`${b.nickname} (Bot)`)) ??
      BOT_PRESETS[room.players.length % BOT_PRESETS.length];

    const bot = createPlayerState({
      socketId: null,
      nickname: `${preset.nickname} (Bot)`,
      avatar: preset.avatar,
      color: preset.color,
      seatIndex: room.players.length,
      isHost: false,
      isBot: true,
    });

    room.players.push(bot);
    this.broadcastSanitizedState(room.roomCode);
    return {};
  }

  public removePlayer(
    roomCode: string,
    requesterId: string,
    targetPlayerId: string
  ): { error?: string } {
    const room = this.getRoom(roomCode);
    if (!room) return { error: 'Room not found.' };
    if (room.phase !== 'LOBBY') return { error: 'Cannot remove players mid-game.' };
    const requester = room.players.find((p) => p.id === requesterId);
    if (!requester?.isHost) return { error: 'Only the host can remove players.' };
    if (requesterId === targetPlayerId) {
      return { error: 'Host cannot remove themselves.' };
    }

    room.players = room.players.filter((p) => p.id !== targetPlayerId);
    room.players.forEach((p, idx) => {
      p.seatIndex = idx;
    });

    this.broadcastSanitizedState(room.roomCode);
    return {};
  }

  public updateConfig(
    roomCode: string,
    requesterId: string,
    configUpdate: {
      timers?: Partial<PhaseTimers>;
      enabledRoles?: Partial<Record<RoleType, boolean>>;
      allowWebRTC?: boolean;
      revealDeadRoles?: boolean;
    }
  ): { error?: string } {
    const room = this.getRoom(roomCode);
    if (!room) return { error: 'Room not found.' };
    if (room.phase !== 'LOBBY') {
      return { error: 'Configuration can only be changed in the lobby.' };
    }
    const requester = room.players.find((p) => p.id === requesterId);
    if (!requester?.isHost) {
      return { error: 'Only the host can modify room settings.' };
    }

    if (configUpdate.timers) {
      room.config.timers = {
        ...room.config.timers,
        nightPhase: Math.min(
          180,
          Math.max(10, configUpdate.timers.nightPhase ?? room.config.timers.nightPhase)
        ),
        dayDiscussion: Math.min(
          300,
          Math.max(15, configUpdate.timers.dayDiscussion ?? room.config.timers.dayDiscussion)
        ),
        dayVoting: Math.min(
          120,
          Math.max(10, configUpdate.timers.dayVoting ?? room.config.timers.dayVoting)
        ),
        roleReveal: Math.min(
          20,
          Math.max(4, configUpdate.timers.roleReveal ?? room.config.timers.roleReveal)
        ),
        dawnSummary: Math.min(
          20,
          Math.max(4, configUpdate.timers.dawnSummary ?? room.config.timers.dawnSummary)
        ),
        executionReveal: Math.min(
          20,
          Math.max(4, configUpdate.timers.executionReveal ?? room.config.timers.executionReveal)
        ),
        hunterRevenge: Math.min(
          30,
          Math.max(10, configUpdate.timers.hunterRevenge ?? room.config.timers.hunterRevenge)
        ),
      };
    }

    if (configUpdate.enabledRoles) {
      for (const [role, enabled] of Object.entries(configUpdate.enabledRoles)) {
        const key = role as RoleType;
        // Base filler roles (VILLAGER & WEREWOLF) always remain enabled to fill quotas
        if (key === 'VILLAGER' || key === 'WEREWOLF') {
          room.config.enabledRoles[key] = true;
        } else {
          room.config.enabledRoles[key] = Boolean(enabled);
        }
      }
    }

    if (typeof configUpdate.allowWebRTC === 'boolean') {
      room.config.allowWebRTC = configUpdate.allowWebRTC;
    }

    if (typeof configUpdate.revealDeadRoles === 'boolean') {
      room.config.revealDeadRoles = configUpdate.revealDeadRoles;
    }

    this.broadcastSanitizedState(room.roomCode);
    return {};
  }

  public startGame(roomCode: string, requesterId: string): { error?: string } {
    const room = this.getRoom(roomCode);
    if (!room) return { error: 'Room not found.' };
    const requester = room.players.find((p) => p.id === requesterId);
    if (!requester?.isHost) return { error: 'Only the host can start the game.' };

    const result = GameEngine.startGame(room);
    if (!result.valid) {
      return { error: result.error };
    }

    this.broadcastSanitizedState(room.roomCode);
    this.schedulePhaseTransition(
      room.roomCode,
      room.config.timers.roleReveal * 1000,
      () => {
        this.transitionToNight(room.roomCode);
      }
    );

    return {};
  }

  public transitionToNight(roomCode: string): void {
    const room = this.getRoom(roomCode);
    if (!room) return;

    this.clearTimers(roomCode);
    GameEngine.enterNightPhase(room);
    this.emitSoundCue(roomCode, 'NIGHTFALL');
    this.emitSoundCue(roomCode, 'WOLF_HOWL');
    this.broadcastSanitizedState(roomCode);

    setTimeout(() => {
      this.executeBotNightActions(roomCode);
    }, 1500);

    const tickInterval = setInterval(() => {
      const currentRoom = this.getRoom(roomCode);
      if (!currentRoom || currentRoom.phase !== 'NIGHT_PHASE') {
        clearInterval(tickInterval);
        return;
      }
      const { wolfAlertTriggered } =
        GameEngine.tickLittleGirlExposure(currentRoom);
      if (wolfAlertTriggered) {
        this.notifyWolvesOfSpy(currentRoom);
      }
      const hasPeekingGirl = currentRoom.players.some(
        (p) => p.isAlive && p.role === 'LITTLE_GIRL' && p.isPeeking
      );
      if (hasPeekingGirl || wolfAlertTriggered) {
        this.broadcastSanitizedState(roomCode);
      }
    }, 1000);
    this.nightTickIntervals.set(roomCode, tickInterval);

    this.schedulePhaseTransition(
      roomCode,
      room.config.timers.nightPhase * 1000,
      () => {
        this.transitionToDawn(roomCode);
      }
    );
  }

  private isGameOver(room: RoomState): boolean {
    return room.phase === 'GAME_OVER';
  }

  public transitionToDawn(roomCode: string): void {
    const room = this.getRoom(roomCode);
    if (!room || room.phase !== 'NIGHT_PHASE') return;

    this.clearTimers(roomCode);
    GameEngine.resolveNightAndEnterDawn(room);
    this.emitSoundCue(roomCode, 'DAWN_ROOSTER');

    if (this.isGameOver(room)) {
      this.emitSoundCue(roomCode, 'VICTORY');
      this.broadcastSanitizedState(roomCode);
      return;
    }

    this.broadcastSanitizedState(roomCode);

    if (room.hunterRevenge && !room.hunterRevenge.resolved) {
      const hunter = room.players.find(
        (p) => p.id === room.hunterRevenge?.hunterId
      );
      if (hunter?.isBot) {
        setTimeout(() => this.executeBotHunterShot(roomCode), 1500);
      }
      this.schedulePhaseTransition(
        roomCode,
        room.config.timers.hunterRevenge * 1000,
        () => {
          this.transitionToDayDiscussion(roomCode);
        }
      );
      return;
    }

    this.schedulePhaseTransition(
      roomCode,
      room.config.timers.dawnSummary * 1000,
      () => {
        this.transitionToDayDiscussion(roomCode);
      }
    );
  }

  public transitionToDayDiscussion(roomCode: string): void {
    const room = this.getRoom(roomCode);
    if (!room) return;

    this.clearTimers(roomCode);
    GameEngine.enterDayDiscussion(room);

    if (room.phase === 'GAME_OVER') {
      this.emitSoundCue(roomCode, 'VICTORY');
      this.broadcastSanitizedState(roomCode);
      return;
    }

    this.broadcastSanitizedState(roomCode);

    this.schedulePhaseTransition(
      roomCode,
      room.config.timers.dayDiscussion * 1000,
      () => {
        this.transitionToDayVoting(roomCode);
      }
    );
  }

  public transitionToDayVoting(roomCode: string): void {
    const room = this.getRoom(roomCode);
    if (!room) return;

    this.clearTimers(roomCode);
    if (room.phase !== 'DAY_VOTING') {
      GameEngine.enterDayVoting(room);
    }
    this.broadcastSanitizedState(roomCode);

    setTimeout(() => {
      this.executeBotDayVotes(roomCode);
    }, 1500);

    this.schedulePhaseTransition(
      roomCode,
      room.config.timers.dayVoting * 1000,
      () => {
        this.transitionToExecutionReveal(roomCode);
      }
    );
  }

  public transitionToExecutionReveal(roomCode: string): void {
    const room = this.getRoom(roomCode);
    if (!room || room.phase !== 'DAY_VOTING') return;

    this.clearTimers(roomCode);
    GameEngine.resolveDayVotesAndEnterExecution(room);
    this.emitSoundCue(roomCode, 'GAVEL');

    if (this.isGameOver(room)) {
      this.emitSoundCue(roomCode, 'VICTORY');
      this.broadcastSanitizedState(roomCode);
      return;
    }

    this.broadcastSanitizedState(roomCode);

    if (room.hunterRevenge && !room.hunterRevenge.resolved) {
      const hunter = room.players.find(
        (p) => p.id === room.hunterRevenge?.hunterId
      );
      if (hunter?.isBot) {
        setTimeout(() => this.executeBotHunterShot(roomCode), 1500);
      }
      this.schedulePhaseTransition(
        roomCode,
        room.config.timers.hunterRevenge * 1000,
        () => {
          this.completeExecutionPhase(roomCode);
        }
      );
      return;
    }

    this.schedulePhaseTransition(
      roomCode,
      room.config.timers.executionReveal * 1000,
      () => {
        this.completeExecutionPhase(roomCode);
      }
    );
  }

  private completeExecutionPhase(roomCode: string): void {
    const room = this.getRoom(roomCode);
    if (!room) return;

    this.clearTimers(roomCode);
    GameEngine.completeExecutionAndLoopToNight(room);

    if (room.phase === 'GAME_OVER') {
      this.emitSoundCue(roomCode, 'VICTORY');
      this.broadcastSanitizedState(roomCode);
      return;
    }

    this.emitSoundCue(roomCode, 'NIGHTFALL');
    this.emitSoundCue(roomCode, 'WOLF_HOWL');
    this.broadcastSanitizedState(roomCode);

    setTimeout(() => {
      this.executeBotNightActions(roomCode);
    }, 1500);

    const tickInterval = setInterval(() => {
      const currentRoom = this.getRoom(roomCode);
      if (!currentRoom || currentRoom.phase !== 'NIGHT_PHASE') {
        clearInterval(tickInterval);
        return;
      }
      const { wolfAlertTriggered } =
        GameEngine.tickLittleGirlExposure(currentRoom);
      if (wolfAlertTriggered) {
        this.notifyWolvesOfSpy(currentRoom);
      }
      const hasPeekingGirl = currentRoom.players.some(
        (p) => p.isAlive && p.role === 'LITTLE_GIRL' && p.isPeeking
      );
      if (hasPeekingGirl || wolfAlertTriggered) {
        this.broadcastSanitizedState(roomCode);
      }
    }, 1000);
    this.nightTickIntervals.set(roomCode, tickInterval);

    this.schedulePhaseTransition(
      roomCode,
      room.config.timers.nightPhase * 1000,
      () => {
        this.transitionToDawn(roomCode);
      }
    );
  }

  public handleNightAction(
    roomCode: string,
    playerId: string,
    payload: NightActionPayload
  ): { error?: string } {
    const room = this.getRoom(roomCode);
    if (!room) return { error: 'Room not found.' };

    const result = GameEngine.submitNightAction(room, playerId, payload);
    if (!result.valid) {
      return { error: result.error };
    }

    this.broadcastSanitizedState(roomCode);
    return {};
  }

  public handleLittleGirlPeek(
    roomCode: string,
    playerId: string,
    peeking: boolean
  ): { error?: string } {
    const room = this.getRoom(roomCode);
    if (!room) return { error: 'Room not found.' };

    const result = GameEngine.toggleLittleGirlPeek(room, playerId, peeking);
    if (!result.valid) {
      return { error: result.error };
    }

    this.broadcastSanitizedState(roomCode);
    return {};
  }

  public handleSkipDiscussionVote(
    roomCode: string,
    playerId: string
  ): { error?: string } {
    const room = this.getRoom(roomCode);
    if (!room) return { error: 'Room not found.' };

    const result = GameEngine.toggleSkipDiscussion(room, playerId);
    if (!result.valid) {
      return { error: result.error };
    }

    if (result.transitionedToVoting) {
      this.transitionToDayVoting(roomCode);
    } else {
      this.broadcastSanitizedState(roomCode);
    }

    return {};
  }

  public handleDayVote(
    roomCode: string,
    playerId: string,
    targetId: string | 'SKIP' | null
  ): { error?: string } {
    const room = this.getRoom(roomCode);
    if (!room) return { error: 'Room not found.' };

    const result = GameEngine.castDayVote(room, playerId, targetId);
    if (!result.valid) {
      return { error: result.error };
    }

    this.broadcastSanitizedState(roomCode);

    const alivePlayers = room.players.filter((p) => p.isAlive);
    const allVoted =
      alivePlayers.length > 0 &&
      alivePlayers.every((p) => room.dayVotes[p.id] !== undefined);

    if (allVoted) {
      this.transitionToExecutionReveal(roomCode);
    }

    return {};
  }

  public handleHunterShot(
    roomCode: string,
    hunterId: string,
    targetId: string
  ): { error?: string } {
    const room = this.getRoom(roomCode);
    if (!room) return { error: 'Room not found.' };

    const triggeredFrom = room.hunterRevenge?.triggeredFromPhase;
    const result = GameEngine.resolveHunterShot(room, hunterId, targetId);
    if (!result.valid) {
      return { error: result.error };
    }

    this.emitSoundCue(roomCode, 'HUNTER_SHOT');

    if (room.phase === 'GAME_OVER') {
      this.clearTimers(roomCode);
      this.emitSoundCue(roomCode, 'VICTORY');
      this.broadcastSanitizedState(roomCode);
      return {};
    }

    this.broadcastSanitizedState(roomCode);

    this.schedulePhaseTransition(roomCode, 3000, () => {
      if (triggeredFrom === 'DAWN_SUMMARY') {
        this.transitionToDayDiscussion(roomCode);
      } else {
        this.completeExecutionPhase(roomCode);
      }
    });

    return {};
  }

  public handlePlayAgain(
    roomCode: string,
    requesterId: string
  ): { error?: string } {
    const room = this.getRoom(roomCode);
    if (!room) return { error: 'Room not found.' };
    const requester = room.players.find((p) => p.id === requesterId);
    if (!requester?.isHost) {
      return { error: 'Only the host can reset the lobby.' };
    }

    this.clearTimers(roomCode);
    GameEngine.resetToLobby(room);
    this.broadcastSanitizedState(roomCode);
    return {};
  }

  /**
   * Authoritative chat routing with strict server-side channel isolation:
   * ('public' | 'wolves' | 'dead')
   */
  public handleChatMessage(params: {
    roomCode: string;
    senderId: string;
    content: string;
    channel?: ChatChannel | string;
  }): { error?: string } {
    const room = this.getRoom(params.roomCode);
    if (!room) return { error: 'Otaq tapılmadı.' };

    const sender = room.players.find((p) => p.id === params.senderId);
    if (!sender) return { error: 'Oyunçu tapılmadı.' };

    const trimmed = params.content.trim().slice(0, 280);
    if (!trimmed) return {};

    const channel = normalizeChatChannel(params.channel);

    // Server-side authorization check for writing to this channel
    const authCheck = canWriteToChannel(room, sender, channel);
    if (!authCheck.allowed) {
      return { error: authCheck.error ?? 'Bu kanala yazmaq icazəniz yoxdur.' };
    }

    const isSpiritMessage = channel === 'dead' && !sender.isAlive;

    let senderName = sender.nickname;
    let senderColor = sender.color;

    if (channel === 'dead' && isSpiritMessage) {
      senderName = `👻 Ruh: ${sender.nickname}`;
    } else if (channel === 'wolves') {
      senderColor = '#fb7185';
    }

    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      senderId: sender.id,
      senderName,
      senderColor,
      channel,
      channelBadge: CHANNEL_BADGES[channel],
      content: trimmed,
      timestamp: Date.now(),
      isSpiritMessage,
    };

    room.messages.push(msg);
    this.deliverChatMessage(room, msg);
    return {};
  }

  private deliverChatMessage(room: RoomState, msg: ChatMessage): void {
    if (!this.io) return;

    for (const recipient of room.players) {
      if (!recipient.socketId || !recipient.isConnected) continue;

      const formatted = formatMessageForRecipient(room, recipient, msg);
      if (formatted) {
        this.io.to(recipient.socketId).emit('chat:message', formatted);
      }
    }
  }

  private notifyWolvesOfSpy(room: RoomState): void {
    if (!this.io) return;
    for (const player of room.players) {
      if (
        player.socketId &&
        player.isConnected &&
        player.isAlive &&
        isWolfPackRole(player.role)
      ) {
        this.io.to(player.socketId).emit('night:wolfAlert', {
          suspicionLevel: 100,
          message:
            '👀 Kolluqda xışıltı var! Kiçik Qız bu gecə sürünü gizlicə izləyir!',
        });
      }
    }
  }

  public broadcastSanitizedState(roomCode: string): void {
    if (!this.io) return;
    const room = this.getRoom(roomCode);
    if (!room) return;

    for (const player of room.players) {
      if (player.socketId && player.isConnected) {
        const sanitized = sanitizeStateForPlayer(room, player.id);
        this.io.to(player.socketId).emit('room:state', sanitized);
      }
    }
  }

  public emitSoundCue(roomCode: string, cue: SoundCueType): void {
    if (!this.io) return;
    const room = this.getRoom(roomCode);
    if (!room) return;
    for (const player of room.players) {
      if (player.socketId && player.isConnected) {
        this.io.to(player.socketId).emit('sound:cue', { cue });
      }
    }
  }

  private schedulePhaseTransition(
    roomCode: string,
    delayMs: number,
    callback: () => void
  ): void {
    const existing = this.roomTimers.get(roomCode);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(callback, delayMs);
    this.roomTimers.set(roomCode, timer);
  }

  private clearTimers(roomCode: string): void {
    const timer = this.roomTimers.get(roomCode);
    if (timer) {
      clearTimeout(timer);
      this.roomTimers.delete(roomCode);
    }
    const tick = this.nightTickIntervals.get(roomCode);
    if (tick) {
      clearInterval(tick);
      this.nightTickIntervals.delete(roomCode);
    }
  }

  private executeBotNightActions(roomCode: string): void {
    const room = this.getRoom(roomCode);
    if (!room || room.phase !== 'NIGHT_PHASE') return;

    const alivePlayers = room.players.filter((p) => p.isAlive);
    const nonWolves = alivePlayers.filter((p) => !isWolfPackRole(p.role));

    for (const bot of alivePlayers.filter((p) => p.isBot)) {
      if (isWolfPackRole(bot.role) && nonWolves.length > 0) {
        const target = nonWolves[crypto.randomInt(0, nonWolves.length)];
        GameEngine.submitNightAction(room, bot.id, {
          actionType: 'WOLF_VOTE',
          targetId: target.id,
        });

        if (bot.role === 'MYSTIC_WOLF') {
          const uninspected = nonWolves.filter(
            (p) => bot.mysticWolfInspections[p.id] === undefined
          );
          const inspectPool = uninspected.length > 0 ? uninspected : nonWolves;
          const inspectTarget =
            inspectPool[crypto.randomInt(0, inspectPool.length)];
          GameEngine.submitNightAction(room, bot.id, {
            actionType: 'MYSTIC_WOLF_INSPECT',
            targetId: inspectTarget.id,
          });
        } else if (
          bot.role === 'BLACK_WOLF' &&
          room.blackWolfInfectionAvailable &&
          crypto.randomInt(0, 3) === 0
        ) {
          GameEngine.submitNightAction(room, bot.id, {
            actionType: 'BLACK_WOLF_INFECT',
            targetId: target.id,
          });
        } else if (bot.role === 'WHITE_WOLF' && room.nightNumber % 2 === 0) {
          const fellowWolves = alivePlayers.filter(
            (p) => p.id !== bot.id && isWolfPackRole(p.role)
          );
          if (fellowWolves.length > 0) {
            const betrayalTarget =
              fellowWolves[crypto.randomInt(0, fellowWolves.length)];
            GameEngine.submitNightAction(room, bot.id, {
              actionType: 'WHITE_WOLF_KILL',
              targetId: betrayalTarget.id,
            });
          }
        }
      } else if (bot.role === 'GUARD') {
        const validTargets = alivePlayers.filter(
          (p) => p.id !== bot.lastProtectedPlayerId
        );
        if (validTargets.length > 0) {
          const target = validTargets[crypto.randomInt(0, validTargets.length)];
          GameEngine.submitNightAction(room, bot.id, {
            actionType: 'GUARD_PROTECT',
            targetId: target.id,
          });
        }
      } else if (bot.role === 'SEER') {
        const candidates = alivePlayers.filter(
          (p) => p.id !== bot.id && !bot.knownRoles[p.id]
        );
        const pool =
          candidates.length > 0
            ? candidates
            : alivePlayers.filter((p) => p.id !== bot.id);
        if (pool.length > 0) {
          const target = pool[crypto.randomInt(0, pool.length)];
          GameEngine.submitNightAction(room, bot.id, {
            actionType: 'SEER_INSPECT',
            targetId: target.id,
          });
        }
      } else if (bot.role === 'ARSONIST') {
        const dousedAlive = room.arsonistDousedIds.filter((id) =>
          alivePlayers.some((p) => p.id === id && p.id !== bot.id)
        );
        const undoused = alivePlayers.filter(
          (p) => p.id !== bot.id && !room.arsonistDousedIds.includes(p.id)
        );

        if (
          dousedAlive.length >= 2 ||
          (dousedAlive.length > 0 && undoused.length === 0) ||
          (alivePlayers.length <= 4 && dousedAlive.length >= 1)
        ) {
          GameEngine.submitNightAction(room, bot.id, {
            actionType: 'ARSONIST_IGNITE',
          });
        } else if (undoused.length > 0) {
          const target = undoused[crypto.randomInt(0, undoused.length)];
          GameEngine.submitNightAction(room, bot.id, {
            actionType: 'ARSONIST_DOUSE',
            targetId: target.id,
          });
        }
      }
    }

    this.broadcastSanitizedState(roomCode);
  }

  private executeBotDayVotes(roomCode: string): void {
    const room = this.getRoom(roomCode);
    if (!room || room.phase !== 'DAY_VOTING') return;

    const alivePlayers = room.players.filter((p) => p.isAlive);
    for (const bot of alivePlayers.filter((p) => p.isBot)) {
      const others = alivePlayers.filter((p) => p.id !== bot.id);
      if (others.length > 0) {
        const target = others[crypto.randomInt(0, others.length)];
        GameEngine.castDayVote(room, bot.id, target.id);
      }
    }

    this.broadcastSanitizedState(roomCode);
  }

  private executeBotHunterShot(roomCode: string): void {
    const room = this.getRoom(roomCode);
    if (!room || !room.hunterRevenge || room.hunterRevenge.resolved) return;

    const aliveTargets = room.players.filter((p) => p.isAlive);
    if (aliveTargets.length > 0) {
      const target = aliveTargets[crypto.randomInt(0, aliveTargets.length)];
      this.handleHunterShot(roomCode, room.hunterRevenge.hunterId, target.id);
    }
  }
}
