import { Faction, FactionQuota, RoleType } from '../types/game.js';

export interface RoleDefinition {
  role: RoleType;
  nameAz: string;
  nameEn: string;
  displayName: string;
  icon: string;
  faction: Faction;
  factionLabel: 'Normal' | 'Qatil' | 'Tərəfsiz';
  isBaseFiller?: boolean;
  shortDescription: string;
  winCondition: string;
  hasNightAction: boolean;
  nightTurnPriority: number;
}

/**
 * Automatic Faction Distribution Quota Table for 4 to 16 players.
 * Sum of (normal + qatil + terefsiz) === playerCount for every N in [4..16].
 */
export const FACTION_QUOTA_TABLE: Record<number, FactionQuota> = {
  4: { normal: 3, qatil: 1, terefsiz: 0 },
  5: { normal: 4, qatil: 1, terefsiz: 0 },
  6: { normal: 4, qatil: 1, terefsiz: 1 },
  7: { normal: 5, qatil: 1, terefsiz: 1 },
  8: { normal: 5, qatil: 2, terefsiz: 1 },
  9: { normal: 6, qatil: 2, terefsiz: 1 },
  10: { normal: 6, qatil: 2, terefsiz: 2 },
  11: { normal: 7, qatil: 2, terefsiz: 2 },
  12: { normal: 7, qatil: 2, terefsiz: 3 },
  13: { normal: 8, qatil: 3, terefsiz: 2 },
  14: { normal: 9, qatil: 3, terefsiz: 2 },
  15: { normal: 9, qatil: 3, terefsiz: 3 },
  16: { normal: 10, qatil: 3, terefsiz: 3 },
};

export const NORMAL_SPECIAL_ROLES: RoleType[] = [
  'SEER',
  'WITCH',
  'GUARD',
  'HUNTER',
  'LITTLE_GIRL',
  'ELDER',
  'BEAR_TAMER',
  'CROW',
  'CUPID',
];

export const QATIL_SPECIAL_ROLES: RoleType[] = [
  'BLACK_WOLF',
  'MYSTIC_WOLF',
  'VENGEFUL_WOLF',
  'SHADOW_WOLF',
];

export const TEREFSIZ_ROLES: RoleType[] = [
  'ANGEL',
  'WHITE_WOLF',
  'ARSONIST',
  'JESTER',
  'WILD_CHILD',
];

export const ALL_PLAYABLE_ROLES: RoleType[] = [
  'VILLAGER',
  ...NORMAL_SPECIAL_ROLES,
  'WEREWOLF',
  ...QATIL_SPECIAL_ROLES,
  ...TEREFSIZ_ROLES,
];

export const ROLE_DEFINITIONS: Record<RoleType, RoleDefinition> = {
  // ==========================================
  // 1. NORMAL TEAM (Village Team)
  // ==========================================
  VILLAGER: {
    role: 'VILLAGER',
    nameAz: 'Kəndli',
    nameEn: 'Villager',
    displayName: 'Kəndli (Villager)',
    icon: '🌾',
    faction: 'VILLAGE',
    factionLabel: 'Normal',
    isBaseFiller: true,
    shortDescription:
      'Gecə xüsusi gücü yoxdur; gündüz müzakirə və səsvermə ilə Qatil və təhlükəli Tərəfsiz rolları tapır.',
    winCondition:
      'Bütün Qatillər və ölümcül Tərəfsizlər (Ağ Canavar, Alovçu) məhv edildikdə Normal komandası qazanır.',
    hasNightAction: false,
    nightTurnPriority: 99,
  },
  SEER: {
    role: 'SEER',
    nameAz: 'Kahin',
    nameEn: 'Seer',
    displayName: 'Kahin (Seer)',
    icon: '🔮',
    faction: 'VILLAGE',
    factionLabel: 'Normal',
    shortDescription:
      'Hər gecə 1 oyunçunu yoxlayır və onun dəqiq rolunu öyrənir.',
    winCondition:
      'Bütün Qatillər və ölümcül Tərəfsizlər məhv edildikdə Normal komandası qazanır.',
    hasNightAction: true,
    nightTurnPriority: 20,
  },
  WITCH: {
    role: 'WITCH',
    nameAz: 'Cadugər',
    nameEn: 'Witch',
    displayName: 'Cadugər (Witch)',
    icon: '🧪',
    faction: 'VILLAGE',
    factionLabel: 'Normal',
    shortDescription:
      'Oyun boyu 1 Həyat İksiri (gecə Canavarların hədəfini görüb xilas edir) və 1 Ölüm İksiri (istənilən oyunçunu öldürür) var.',
    winCondition:
      'Bütün Qatillər və ölümcül Tərəfsizlər məhv edildikdə Normal komandası qazanır.',
    hasNightAction: true,
    nightTurnPriority: 50,
  },
  GUARD: {
    role: 'GUARD',
    nameAz: 'Mühafizəçi',
    nameEn: 'Guard',
    displayName: 'Mühafizəçi (Guard)',
    icon: '🛡️',
    faction: 'VILLAGE',
    factionLabel: 'Normal',
    shortDescription:
      'Hər gecə 1 oyunçunu Qatil hücumlarından qoruyur (ardıcıl 2 gecə eyni oyunçunu qoruya bilməz).',
    winCondition:
      'Bütün Qatillər və ölümcül Tərəfsizlər məhv edildikdə Normal komandası qazanır.',
    hasNightAction: true,
    nightTurnPriority: 10,
  },
  HUNTER: {
    role: 'HUNTER',
    nameAz: 'Ovçu',
    nameEn: 'Hunter',
    displayName: 'Ovçu (Hunter)',
    icon: '🏹',
    faction: 'VILLAGE',
    factionLabel: 'Normal',
    shortDescription:
      'Gecə və ya gündüz öldürüldükdə 15 saniyə ərzində sağ qalan 1 oyunçunu vuraraq özü ilə aparır.',
    winCondition:
      'Bütün Qatillər və ölümcül Tərəfsizlər məhv edildikdə Normal komandası qazanır.',
    hasNightAction: false,
    nightTurnPriority: 99,
  },
  LITTLE_GIRL: {
    role: 'LITTLE_GIRL',
    nameAz: 'Kiçik Qız',
    nameEn: 'Little Girl',
    displayName: 'Kiçik Qız (Little Girl)',
    icon: '🕯️',
    faction: 'VILLAGE',
    factionLabel: 'Normal',
    shortDescription:
      'Gecə Qatil çatına anonim ("Canavar ???") baxa bilər, lakin baxdıqca canavarlara ifşa olma riski artır.',
    winCondition:
      'Bütün Qatillər və ölümcül Tərəfsizlər məhv edildikdə Normal komandası qazanır.',
    hasNightAction: true,
    nightTurnPriority: 42,
  },
  ELDER: {
    role: 'ELDER',
    nameAz: 'Ağsaqqal',
    nameEn: 'Elder',
    displayName: 'Ağsaqqal (Elder)',
    icon: '🧓',
    faction: 'VILLAGE',
    factionLabel: 'Normal',
    shortDescription:
      'Gecə ilk Qatil hücumundan sağ çıxır (2 canı var). Lakin kənd səsverməsi ilə edam edilərsə, bütün Normal rollar xüsusi güclərini itirir!',
    winCondition:
      'Bütün Qatillər və ölümcül Tərəfsizlər məhv edildikdə Normal komandası qazanır.',
    hasNightAction: false,
    nightTurnPriority: 99,
  },
  BEAR_TAMER: {
    role: 'BEAR_TAMER',
    nameAz: 'Ayı Təlimçisi',
    nameEn: 'Bear Tamer',
    displayName: 'Ayı Təlimçisi (Bear Tamer)',
    icon: '🐻',
    faction: 'VILLAGE',
    factionLabel: 'Normal',
    shortDescription:
      'Səhər açıldıqda tonqal ətrafında sağ və ya sol qonşusundan ən azı biri Qatil olarsa, ayı hamıya nərildəyir.',
    winCondition:
      'Bütün Qatillər və ölümcül Tərəfsizlər məhv edildikdə Normal komandası qazanır.',
    hasNightAction: false,
    nightTurnPriority: 99,
  },
  CROW: {
    role: 'CROW',
    nameAz: 'Qarğa',
    nameEn: 'Crow',
    displayName: 'Qarğa (Crow)',
    icon: '🐦‍⬛',
    faction: 'VILLAGE',
    factionLabel: 'Normal',
    shortDescription:
      'Hər gecə 1 oyunçunu lənətləyir; lənətlənmiş oyunçu növbəti günün səsverməsinə +2 avtomatik cəza səsi ilə başlayır.',
    winCondition:
      'Bütün Qatillər və ölümcül Tərəfsizlər məhv edildikdə Normal komandası qazanır.',
    hasNightAction: true,
    nightTurnPriority: 30,
  },
  CUPID: {
    role: 'CUPID',
    nameAz: 'Kupid',
    nameEn: 'Cupid',
    displayName: 'Kupid (Cupid)',
    icon: '💘',
    faction: 'VILLAGE',
    factionLabel: 'Normal',
    shortDescription:
      'Yalnız 1-ci gecə 2 oyunçunu Aşiq olaraq bağlayır. Aşiqlərdən biri ölərsə, digəri də kədərdən dərhal ölür.',
    winCondition:
      'Normal komandası ilə qazanır (əgər Aşiqlər Normal + Qatil cütüdürsə, son 2 sağ qalan kimi yalnız onlar qalib gəlir).',
    hasNightAction: true,
    nightTurnPriority: 5,
  },

  // ==========================================
  // 2. QATİL TEAM (Killer / Werewolf Team)
  // ==========================================
  WEREWOLF: {
    role: 'WEREWOLF',
    nameAz: 'Canavar',
    nameEn: 'Werewolf',
    displayName: 'Canavar (Werewolf)',
    icon: '🐺',
    faction: 'WEREWOLF',
    factionLabel: 'Qatil',
    isBaseFiller: true,
    shortDescription:
      'Hər gecə sürüsü ilə məsləhətləşib 1 qurbanı yemək üçün səs verir.',
    winCondition:
      'Sağ Qatillərin sayı digər bütün sağ oyunçulara bərabər və ya çox olduqda Qatil komandası qazanır.',
    hasNightAction: true,
    nightTurnPriority: 30,
  },
  BLACK_WOLF: {
    role: 'BLACK_WOLF',
    nameAz: 'Qara Canavar',
    nameEn: 'Black Wolf',
    displayName: 'Qara Canavar (Black Wolf)',
    icon: '🖤',
    faction: 'WEREWOLF',
    factionLabel: 'Qatil',
    shortDescription:
      'Oyun boyu 1 dəfə sürünün hədəfini öldürmək əvəzinə yoluxduraraq gizlicə Canavara çevirə bilər.',
    winCondition:
      'Sağ Qatillərin sayı digər bütün sağ oyunçulara bərabər və ya çox olduqda Qatil komandası qazanır.',
    hasNightAction: true,
    nightTurnPriority: 46,
  },
  MYSTIC_WOLF: {
    role: 'MYSTIC_WOLF',
    nameAz: 'Mistik Canavar',
    nameEn: 'Mystic Wolf',
    displayName: 'Mistik Canavar (Mystic Wolf)',
    icon: '👁️‍🗨️',
    faction: 'WEREWOLF',
    factionLabel: 'Qatil',
    shortDescription:
      'Hər gecə 1 qeyri-Canavar oyunçunu yoxlayaraq onun xüsusi Normal/Tərəfsiz gücə sahib olub-olmadığını öyrənir.',
    winCondition:
      'Sağ Qatillərin sayı digər bütün sağ oyunçulara bərabər və ya çox olduqda Qatil komandası qazanır.',
    hasNightAction: true,
    nightTurnPriority: 22,
  },
  VENGEFUL_WOLF: {
    role: 'VENGEFUL_WOLF',
    nameAz: 'İntiqamçı Qurd',
    nameEn: 'Vengeful Wolf',
    displayName: 'İntiqamçı Qurd (Vengeful Wolf)',
    icon: '🩸',
    faction: 'WEREWOLF',
    factionLabel: 'Qatil',
    shortDescription:
      'Sürü ilə gecə ovlayır. Gündüz kənd səsverməsi ilə edam edilərsə, dərhal sağ qalan 1 oyunçunu özü ilə aparır.',
    winCondition:
      'Sağ Qatillərin sayı digər bütün sağ oyunçulara bərabər və ya çox olduqda Qatil komandası qazanır.',
    hasNightAction: true,
    nightTurnPriority: 40,
  },
  SHADOW_WOLF: {
    role: 'SHADOW_WOLF',
    nameAz: 'Kölgə Qurd',
    nameEn: 'Shadow Wolf',
    displayName: 'Kölgə Qurd (Shadow Wolf)',
    icon: '🌑',
    faction: 'WEREWOLF',
    factionLabel: 'Qatil',
    shortDescription:
      'Sürü ilə gecə ovlayır. Oyun boyu 1 dəfə gündüz səsverməsində bütün canlı səs saylarını səsvermə bitənə qədər gizlədə bilər.',
    winCondition:
      'Sağ Qatillərin sayı digər bütün sağ oyunçulara bərabər və ya çox olduqda Qatil komandası qazanır.',
    hasNightAction: true,
    nightTurnPriority: 40,
  },

  // ==========================================
  // 3. TƏRƏFSİZ TEAM (Neutral Team)
  // ==========================================
  ANGEL: {
    role: 'ANGEL',
    nameAz: 'Mələk',
    nameEn: 'Angel',
    displayName: 'Mələk (Angel)',
    icon: '👼',
    faction: 'NEUTRAL',
    factionLabel: 'Tərəfsiz',
    shortDescription:
      '1-ci gün kənd səsverməsi ilə edam edilərsə dərhal qazanır! 2-ci gecəyə qədər sağ qalarsa adi Kəndliyə çevrilir.',
    winCondition: '1-ci gün kənd səsverməsində edam edilmək.',
    hasNightAction: false,
    nightTurnPriority: 99,
  },
  WHITE_WOLF: {
    role: 'WHITE_WOLF',
    nameAz: 'Ağ Canavar',
    nameEn: 'White Wolf',
    displayName: 'Ağ Canavar (White Wolf)',
    icon: '🐻‍❄️',
    faction: 'NEUTRAL',
    factionLabel: 'Tərəfsiz',
    shortDescription:
      'Qatil komandasına adi Canavar kimi görünür. Hər 2 gecədən bir (cüt gecələr) gizlicə 1 Canavarı öldürə bilər.',
    winCondition: 'Yalnız oyunda sağ qalan sonuncu tək oyunçu olduqda qazanır.',
    hasNightAction: true,
    nightTurnPriority: 60,
  },
  ARSONIST: {
    role: 'ARSONIST',
    nameAz: 'Alovçu / Piroman',
    nameEn: 'Arsonist (Pyromaniac)',
    displayName: 'Alovçu (Arsonist)',
    icon: '🔥',
    faction: 'NEUTRAL',
    factionLabel: 'Tərəfsiz',
    shortDescription:
      'Hər gecə ya 1 oyunçuya benzin tökür (Douse), ya da benzin tökülmüş bütün oyunçuları eyni anda yandırır (Ignite).',
    winCondition: 'Oyunda sağ qalan sonuncu oyunçu olduqda qazanır.',
    hasNightAction: true,
    nightTurnPriority: 70,
  },
  JESTER: {
    role: 'JESTER',
    nameAz: 'Təlxək',
    nameEn: 'Jester',
    displayName: 'Təlxək (Jester)',
    icon: '🃏',
    faction: 'NEUTRAL',
    factionLabel: 'Tərəfsiz',
    shortDescription:
      'İstənilən gündüz səsverməsində kəndliləri aldadıb özünü edam etdirərsə, oyunu dərhal təkbaşına qazanır!',
    winCondition: 'Hər hansı bir gündüz səsverməsində kənd tərəfindən edam edilmək.',
    hasNightAction: false,
    nightTurnPriority: 99,
  },
  WILD_CHILD: {
    role: 'WILD_CHILD',
    nameAz: 'Vəhşi Uşaq',
    nameEn: 'Wild Child',
    displayName: 'Vəhşi Uşaq (Wild Child)',
    icon: '🐾',
    faction: 'NEUTRAL',
    factionLabel: 'Tərəfsiz',
    shortDescription:
      'Normal komandasında başlayır. 1-ci gecə 1 Rol Model seçir; həmin şəxs ölərsə gizlicə Canavara (Qatil) çevrilir.',
    winCondition:
      'Rol Modeli sağ qaldıqda Normal ilə, öləndən sonra Canavara çevrilib Qatil komandası ilə qazanır.',
    hasNightAction: true,
    nightTurnPriority: 6,
  },
};
