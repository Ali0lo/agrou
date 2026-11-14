import { ChatChannel, ChatMessage, PlayerState, RoomState } from '../types/game.js';
import { isWolfPackRole } from './roles/RoleStrategy.js';

export const CHANNEL_BADGES: Record<ChatChannel, string> = {
  public: '💬 Ümumi',
  wolves: '🐺 Canavarlar',
  siblings: '👥 Qardaşlar',
  lovers: '💘 Aşiqlər',
  dead: '👻 Ruhlar',
  system: '🔥 Sistem',
};

/**
 * Normalizes incoming channel identifiers (including legacy uppercase names)
 * into canonical lowercase ChatChannel values.
 */
export function normalizeChatChannel(raw?: string): ChatChannel {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'wolves':
    case 'wolf':
      return 'wolves';
    case 'siblings':
    case 'sisters':
      return 'siblings';
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
      // Everyone in the room (alive + dead) can read public chat & system announcements
      return true;

    case 'wolves': {
      // 1. Alive Werewolf-team roles (including infected players & transformed Wild Child)
      if (player.isAlive && isWolfPackRole(player.role)) {
        return true;
      }
      // 2. Alive Little Girl peeking during NIGHT_PHASE (read-only anonymized stream)
      if (
        room.phase === 'NIGHT_PHASE' &&
        player.isAlive &&
        player.role === 'LITTLE_GIRL' &&
        !room.villagePowersLost &&
        player.isPeeking
      ) {
        return true;
      }
      return false;
    }

    case 'siblings':
      // Only alive players assigned the Qardaşlar (SISTERS) role
      return player.isAlive && player.role === 'SISTERS';

    case 'lovers':
      // Only the two alive players linked by Kupidon (Cupid)
      return (
        player.isAlive &&
        player.loverPartnerId !== null &&
        room.lovers !== null &&
        room.lovers.includes(player.id)
      );

    case 'dead': {
      // 1. All eliminated (dead) players at any time (Day or Night)
      if (!player.isAlive) {
        return true;
      }
      // 2. Alive Medium (Ruhçağıran) during NIGHT_PHASE
      if (
        room.phase === 'NIGHT_PHASE' &&
        player.isAlive &&
        player.role === 'MEDIUM' &&
        !room.villagePowersLost
      ) {
        return true;
      }
      return false;
    }
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
          error: 'Yalnız sağ qalan Canavarlar bu kanala yaza bilər.',
        };
      }
      if (room.phase !== 'NIGHT_PHASE') {
        return {
          allowed: false,
          error: 'Canavarlar çatı yalnız Gecə fazasında aktivdir.',
        };
      }
      return { allowed: true };
    }

    case 'siblings': {
      if (!player.isAlive || player.role !== 'SISTERS') {
        return {
          allowed: false,
          error: 'Yalnız sağ qalan Qardaşlar (Two Sisters) bu kanala yaza bilər.',
        };
      }
      return { allowed: true };
    }

    case 'lovers': {
      if (
        !player.isAlive ||
        !player.loverPartnerId ||
        !room.lovers ||
        !room.lovers.includes(player.id)
      ) {
        return {
          allowed: false,
          error: 'Yalnız sağ qalan Aşiqlər (Lovers) bu kanala yaza bilər.',
        };
      }
      const partner = room.players.find((p) => p.id === player.loverPartnerId);
      if (!partner || !partner.isAlive) {
        return {
          allowed: false,
          error: 'Digər aşiq həyatda deyil.',
        };
      }
      return { allowed: true };
    }

    case 'dead': {
      if (!player.isAlive) {
        return { allowed: true };
      }
      if (
        room.phase === 'NIGHT_PHASE' &&
        player.isAlive &&
        player.role === 'MEDIUM' &&
        !room.villagePowersLost
      ) {
        return { allowed: true };
      }
      return {
        allowed: false,
        error: 'Yalnız ölən oyunçular (və gecə Ruhçağıran) Ruhlar kanalına yaza bilər.',
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
    return {
      ...msg,
      senderId: 'ANONYMOUS_WOLF',
      senderName: 'Canavar ???',
      senderColor: '#f43f5e',
      isAnonymized: true,
    };
  }

  return msg;
}
