import { Server as SocketIOServer, Socket } from 'socket.io';
import { RoomManager } from '../engine/RoomManager.js';
import { sanitizeStateForPlayer } from '../engine/StateSanitizer.js';
import {
  NightActionPayload,
  PhaseTimers,
  RoleType,
} from '../types/game.js';

interface SocketSessionContext {
  roomCode: string | null;
  playerId: string | null;
}

export function registerSocketHandlers(
  io: SocketIOServer,
  roomManager: RoomManager
): void {
  io.on('connection', (socket: Socket) => {
    const session: SocketSessionContext = {
      roomCode: null,
      playerId: null,
    };

    const emitError = (code: string, message: string) => {
      socket.emit('room:error', { code, message });
    };

    socket.on(
      'room:create',
      (payload: {
        nickname: string;
        avatar: string;
        color: string;
        sessionToken?: string;
      }) => {
        const { room, player } = roomManager.createRoom({
          socketId: socket.id,
          nickname: payload?.nickname || 'Host',
          avatar: payload?.avatar || '🦊',
          color: payload?.color || '#f97316',
          sessionToken: payload?.sessionToken,
        });

        session.roomCode = room.roomCode;
        session.playerId = player.id;
        socket.join(room.roomCode);

        socket.emit('room:joined', {
          roomCode: room.roomCode,
          playerId: player.id,
          sessionToken: player.sessionToken,
        });

        // Send initial chat log & sanitized state
        for (const msg of room.messages) {
          socket.emit('chat:message', msg);
        }
        roomManager.broadcastSanitizedState(room.roomCode);
      }
    );

    socket.on(
      'room:join',
      (payload: {
        roomCode: string;
        nickname: string;
        avatar: string;
        color: string;
        sessionToken?: string;
      }) => {
        if (!payload?.roomCode) {
          emitError('INVALID_ROOM', 'Room code is required.');
          return;
        }

        const result = roomManager.joinRoom({
          roomCode: payload.roomCode,
          socketId: socket.id,
          nickname: payload.nickname || 'Wanderer',
          avatar: payload.avatar || '🦉',
          color: payload.color || '#3b82f6',
          sessionToken: payload.sessionToken,
        });

        if (result.error || !result.room || !result.player) {
          emitError('JOIN_FAILED', result.error ?? 'Failed to join room.');
          return;
        }

        session.roomCode = result.room.roomCode;
        session.playerId = result.player.id;
        socket.join(result.room.roomCode);

        socket.emit('room:joined', {
          roomCode: result.room.roomCode,
          playerId: result.player.id,
          sessionToken: result.player.sessionToken,
        });

        for (const msg of result.room.messages.filter(
          (m) => m.channel === 'PUBLIC' || m.channel === 'SYSTEM'
        )) {
          socket.emit('chat:message', msg);
        }

        roomManager.broadcastSanitizedState(result.room.roomCode);
      }
    );

    socket.on(
      'room:reconnect',
      (payload: { roomCode: string; sessionToken: string }) => {
        if (!payload?.roomCode || !payload?.sessionToken) {
          emitError('RECONNECT_FAILED', 'Missing session token or room code.');
          return;
        }

        const result = roomManager.reconnectPlayer({
          roomCode: payload.roomCode,
          sessionToken: payload.sessionToken,
          socketId: socket.id,
        });

        if (result.error || !result.room || !result.player) {
          emitError(
            'RECONNECT_FAILED',
            result.error ?? 'Could not restore session.'
          );
          return;
        }

        session.roomCode = result.room.roomCode;
        session.playerId = result.player.id;
        socket.join(result.room.roomCode);

        socket.emit('room:joined', {
          roomCode: result.room.roomCode,
          playerId: result.player.id,
          sessionToken: result.player.sessionToken,
        });

        const sanitized = sanitizeStateForPlayer(result.room, result.player.id);
        socket.emit('room:state', sanitized);
        roomManager.broadcastSanitizedState(result.room.roomCode);
      }
    );

    socket.on(
      'lobby:updateConfig',
      (payload: {
        timers?: Partial<PhaseTimers>;
        enabledRoles?: Partial<Record<RoleType, number>>;
        allowWebRTC?: boolean;
      }) => {
        if (!session.roomCode || !session.playerId) return;
        const res = roomManager.updateConfig(
          session.roomCode,
          session.playerId,
          payload
        );
        if (res.error) emitError('CONFIG_ERROR', res.error);
      }
    );

    socket.on('lobby:addBot', () => {
      if (!session.roomCode || !session.playerId) return;
      const res = roomManager.addBot(session.roomCode, session.playerId);
      if (res.error) emitError('BOT_ERROR', res.error);
    });

    socket.on('lobby:removePlayer', (payload: { playerId: string }) => {
      if (!session.roomCode || !session.playerId) return;
      const res = roomManager.removePlayer(
        session.roomCode,
        session.playerId,
        payload.playerId
      );
      if (res.error) emitError('REMOVE_ERROR', res.error);
    });

    socket.on('game:start', () => {
      if (!session.roomCode || !session.playerId) return;
      const res = roomManager.startGame(session.roomCode, session.playerId);
      if (res.error) emitError('START_ERROR', res.error);
    });

    socket.on('game:playAgain', () => {
      if (!session.roomCode || !session.playerId) return;
      const res = roomManager.handlePlayAgain(
        session.roomCode,
        session.playerId
      );
      if (res.error) emitError('RESET_ERROR', res.error);
    });

    socket.on('night:wolfVote', (payload: { targetId: string | null }) => {
      if (!session.roomCode || !session.playerId) return;
      const res = roomManager.handleNightAction(
        session.roomCode,
        session.playerId,
        {
          actionType: 'WOLF_VOTE',
          targetId: payload?.targetId ?? null,
        }
      );
      if (res.error) emitError('ACTION_ERROR', res.error);
    });

    socket.on('night:action', (payload: NightActionPayload) => {
      if (!session.roomCode || !session.playerId) return;
      const res = roomManager.handleNightAction(
        session.roomCode,
        session.playerId,
        payload
      );
      if (res.error) emitError('ACTION_ERROR', res.error);
    });

    socket.on('night:littleGirlPeek', (payload: { peeking: boolean }) => {
      if (!session.roomCode || !session.playerId) return;
      const res = roomManager.handleLittleGirlPeek(
        session.roomCode,
        session.playerId,
        Boolean(payload?.peeking)
      );
      if (res.error) emitError('PEEK_ERROR', res.error);
    });

    socket.on('day:skipVote', () => {
      if (!session.roomCode || !session.playerId) return;
      const res = roomManager.handleSkipDiscussionVote(
        session.roomCode,
        session.playerId
      );
      if (res.error) emitError('SKIP_ERROR', res.error);
    });

    socket.on('day:vote', (payload: { targetId: string | 'SKIP' | null }) => {
      if (!session.roomCode || !session.playerId) return;
      const res = roomManager.handleDayVote(
        session.roomCode,
        session.playerId,
        payload?.targetId ?? null
      );
      if (res.error) emitError('VOTE_ERROR', res.error);
    });

    socket.on('hunter:shoot', (payload: { targetId: string }) => {
      if (!session.roomCode || !session.playerId) return;
      const res = roomManager.handleHunterShot(
        session.roomCode,
        session.playerId,
        payload.targetId
      );
      if (res.error) emitError('HUNTER_ERROR', res.error);
    });

    socket.on(
      'chat:send',
      (payload: {
        content: string;
        channel: 'PUBLIC' | 'WOLF' | 'GHOST';
      }) => {
        if (!session.roomCode || !session.playerId) return;
        const res = roomManager.handleChatMessage({
          roomCode: session.roomCode,
          senderId: session.playerId,
          content: payload?.content ?? '',
          channel: payload?.channel ?? 'PUBLIC',
        });
        if (res.error) emitError('CHAT_ERROR', res.error);
      }
    );

    socket.on('chat:typing', (payload: { isTyping: boolean }) => {
      if (!session.roomCode || !session.playerId) return;
      const room = roomManager.getRoom(session.roomCode);
      if (!room) return;
      const player = room.players.find((p) => p.id === session.playerId);
      if (!player) return;
      player.isTyping = Boolean(payload?.isTyping);
      roomManager.broadcastSanitizedState(room.roomCode);
    });

    socket.on('webrtc:speaking', (payload: { isSpeaking: boolean }) => {
      if (!session.roomCode || !session.playerId) return;
      const room = roomManager.getRoom(session.roomCode);
      if (!room) return;
      const player = room.players.find((p) => p.id === session.playerId);
      if (!player) return;
      player.isSpeaking = Boolean(payload?.isSpeaking);
      roomManager.broadcastSanitizedState(room.roomCode);
    });

    socket.on(
      'webrtc:signal',
      (payload: { toPlayerId: string; signal: unknown }) => {
        if (!session.roomCode || !session.playerId) return;
        const room = roomManager.getRoom(session.roomCode);
        if (!room) return;
        const target = room.players.find((p) => p.id === payload?.toPlayerId);
        if (target?.socketId && target.isConnected) {
          io.to(target.socketId).emit('webrtc:signal', {
            fromPlayerId: session.playerId,
            signal: payload.signal,
          });
        }
      }
    );

    socket.on('disconnect', () => {
      roomManager.handleDisconnect(socket.id);
    });
  });
}
