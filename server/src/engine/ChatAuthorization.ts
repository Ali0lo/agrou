import { ChatChannel, ChatMessage, PlayerState, RoomState } from '../types/game.js';
import { isWolfPackRole } from './roles/RoleStrategy.js';

export const CHANNEL_BADGES: Record<ChatChannel, string> = {
  public: '💬 Ümumi',
  wolves: '🐺 Qatil Çatı',
  lovers: '💘 Aşiqlər',
  dead: '👻 Ruhlar',
  system: '🔥 Sistem',
};

/**
 * Normalizes incoming channel identifiers into canonical lowercase ChatChannel values.
 */
export function normalizeChatChannel(raw?: string): ChatChannel {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'wolves':
    case 'wolf':
      return 'wolves';
    case 'lovers':
    case 'lover':
      return 'lovers';
    case 'dead':
    case 'ghost':
    case 'ghosts':
      return 'dead';
    case 'system':
      return 'system';
    case 'public':
    default:
      return 'public';
  }
}

/**
 * Server-authoritative check: can `player` READ messages in `channel` right now?
 */
export function canReadChannel(
  room: RoomState,
  player: PlayerState,
  channel: ChatChannel
): boolean {
  switch (channel) {
    case 'public':
    case 'system':
      return true;

    case 'wolves': {
      // 1. Alive Qatil / wolf-pack roles (including infected players & White Wolf)
      if (player.isAlive && isWolfPackRole(player.role)) {
        return true;
      }
      // 2. Alive Little Girl peeking during NIGHT_PHASE (read-only anonymized stream)
      if (
        room.phase === 'NIGHT_PHASE' &&
        player.isAlive &&
        player.role === 'LITTLE_GIRL' &&
        player.isPeeking
      ) {
        return true;
      }
      return false;
    }

    case 'lovers':
      return Boolean(
        player.isAlive &&
          player.loverPartnerId &&
          room.players.some((p) => p.id === player.loverPartnerId && p.isAlive)
      );

    case 'dead':
      // Eliminated players can read & talk anytime
      return !player.isAlive;
  }
}

/**
 * Server-authoritative check: can `player` WRITE a message to `channel` right now?
 */
export function canWriteToChannel(
  room: RoomState,
  player: PlayerState,
  channel: ChatChannel
): { allowed: boolean; error?: string } {
  switch (channel) {
    case 'public': {
      if (!player.isAlive && room.phase !== 'LOBBY' && room.phase !== 'GAME_OVER') {
        return {
          allowed: false,
          error: 'Ölən oyunçular ümumi söhbətə yaza bilməz. Ruhlar kanalından istifadə edin.',
        };
      }
      if (room.phase === 'NIGHT_PHASE') {
        return {
          allowed: false,
          error: 'Gecə fazasında ümumi söhbət bağlıdır.',
        };
      }
      return { allowed: true };
    }

    case 'wolves': {
      if (!player.isAlive || !isWolfPackRole(player.role)) {
        return {
          allowed: false,
          error: 'Yalnız sağ qalan Qatillər bu kanala yaza bilər.',
        };
      }
      if (room.phase !== 'NIGHT_PHASE') {
        return {
          allowed: false,
          error: 'Qatil çatı yalnız Gecə fazasında aktivdir.',
        };
      }
      return { allowed: true };
    }

    case 'lovers': {
      const hasAlivePartner = Boolean(
        player.isAlive &&
          player.loverPartnerId &&
          room.players.some((p) => p.id === player.loverPartnerId && p.isAlive)
      );
      if (!hasAlivePartner) {
        return {
          allowed: false,
          error: 'Yalnız sağ qalan Aşiqlər bu gizli kanala yaza bilər.',
        };
      }
      return { allowed: true };
    }

    case 'dead': {
      if (!player.isAlive) {
        return { allowed: true };
      }
      return {
        allowed: false,
        error: 'Yalnız ölən oyunçular Ruhlar kanalına yaza bilər.',
      };
    }

    case 'system':
      return {
        allowed: false,
        error: 'Sistem kanalına oyunçular birbaşa yaza bilməz.',
      };
  }
}

/**
 * Formats and sanitizes a ChatMessage for a specific recipient.
 * Returns `null` if the recipient is not authorized to read the message.
 */
export function formatMessageForRecipient(
  room: RoomState,
  recipient: PlayerState,
  msg: ChatMessage
): ChatMessage | null {
  if (!canReadChannel(room, recipient, msg.channel)) {
    return null;
  }

  // Little Girl peeking at `wolves` chat receives anonymized sender "Canavar ???"
  if (
    msg.channel === 'wolves' &&
    recipient.isAlive &&
    recipient.role === 'LITTLE_GIRL' &&
    !isWolfPackRole(recipient.role)
  ) {
    const alias = room.wolfAliasMap[msg.senderId] ?? 'Wolf 1';
    return {
      ...msg,
      senderId: 'ANONYMOUS_WOLF',
      senderName: alias,
      senderColor: '#f43f5e',
      isAnonymized: true,
    };
  }

  return msg;
}
