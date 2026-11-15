import { Faction, FactionQuota, RoleInfo, RoleType } from '../types/game';

/**
 * Automatic Faction Distribution Quota Table for 4 to 16 players.
 * Sum (normal + qatil + terefsiz) strictly matches player count N.
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

export const VILLAGE_ROLES: RoleType[] = ['VILLAGER', ...NORMAL_SPECIAL_ROLES];

export const QATIL_SPECIAL_ROLES: RoleType[] = [
  'BLACK_WOLF',
  'MYSTIC_WOLF',
  'VENGEFUL_WOLF',
  'SHADOW_WOLF',
];

export const WEREWOLF_ROLES: RoleType[] = ['WEREWOLF', ...QATIL_SPECIAL_ROLES];

export const TEREFSIZ_ROLES: RoleType[] = [
  'ANGEL',
  'WHITE_WOLF',
  'ARSONIST',
  'JESTER',
  'WILD_CHILD',
];

export const NEUTRAL_ROLES: RoleType[] = [...TEREFSIZ_ROLES];

export const ALL_PLAYABLE_ROLES: RoleType[] = [
  ...VILLAGE_ROLES,
  ...WEREWOLF_ROLES,
  ...NEUTRAL_ROLES,
];

export const ROLE_CATALOG: Record<RoleType, RoleInfo> = {
  // ==========================================
  // 1. NORMAL TEAM (Village Team)
  // ==========================================
  VILLAGER: {
    role: 'VILLAGER',
    name: 'Villager',
    nameAz: 'Kəndli',
    displayName: 'Kəndli (Villager)',
    icon: '🌾',
    faction: 'VILLAGE',
    factionLabel: 'Normal',
    isBaseFiller: true,
    color: '#34d399',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    shortDescription:
      'Gecə xüsusi gücü yoxdur; gündüz müzakirə və səsvermə ilə Qatilləri və təhlükəli Tərəfsizləri tapır.',
    winCondition:
      'Bütün Qatillər və ölümcül Tərəfsizlər (Ağ Canavar, Alovçu) məhv edildikdə qalib gəlir.',
    abilityGuide:
      'Avtomatik kvota sistemində Normal komandasının qalan yerlərini doldurur (birdən çox ola bilər). İfadələri analiz et və səs ver.',
  },
  SEER: {
    role: 'SEER',
    name: 'Seer',
    nameAz: 'Kahin',
    displayName: 'Kahin (Seer)',
    icon: '🔮',
    faction: 'VILLAGE',
    factionLabel: 'Normal',
    color: '#2dd4bf',
    badgeBg: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    shortDescription:
      'Hər gecə 1 oyunçunu yoxlayıb onun əsl rolunu gizlicə görür.',
    winCondition: 'Normal komandası ilə qalib gəlir.',
    abilityGuide:
      'Gecə tonqal ətrafından 1 oyunçu seç və kimliyini aşkar et. Səhər Qatilləri ifşa etmək üçün bu biliyi ağılla bölüş.',
    nightActionLabel: '🔮 Rolunu Yoxla',
  },
  WITCH: {
    role: 'WITCH',
    name: 'Witch',
    nameAz: 'Cadugər',
    displayName: 'Cadugər (Witch)',
    icon: '🧪',
    faction: 'VILLAGE',
    factionLabel: 'Normal',
    color: '#a78bfa',
    badgeBg: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
    shortDescription:
      'Matç boyu 1x Xilas İksiri (Qatil qurbanını dirildir) və 1x Ölüm Zəhəri işlədə bilir.',
    winCondition: 'Normal komandası ilə qalib gəlir.',
    abilityGuide:
      'Gecə Qatil sürüsünün seçdiyi qurbanı görürsən. İstəsən onu dirilt, və ya zəhər rejimini açıb şübhəli birini məhv et.',
    nightActionLabel: '🧪 İksirlərdən İstifadə Et',
  },
  GUARD: {
    role: 'GUARD',
    name: 'Guard',
    nameAz: 'Mühafizəçi',
    displayName: 'Mühafizəçi (Guard)',
    icon: '🛡️',
    faction: 'VILLAGE',
    factionLabel: 'Normal',
    color: '#60a5fa',
    badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    shortDescription:
      'Hər gecə 1 oyunçunu (özü daxil) Qatil hücumundan qoruyur; ard-arda 2 gecə eyni şəxsi qoruya bilməz.',
    winCondition: 'Normal komandası ilə qalib gəlir.',
    abilityGuide:
      'Dünən gecə qoruduğun oyunçu kilidlidir. Özünü və ya Kahini qorumağa çalış.',
    nightActionLabel: '🛡️ Qoru',
  },
  HUNTER: {
    role: 'HUNTER',
    name: 'Hunter',
    nameAz: 'Ovçu',
    displayName: 'Ovçu (Hunter)',
    icon: '🏹',
    faction: 'VILLAGE',
    factionLabel: 'Normal',
    color: '#fbbf24',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    shortDescription:
      'Gecə və ya edamla öldükdə 15 saniyə ərzində 1 oyunçunu özü ilə məzara aparır.',
    winCondition: 'Normal komandası ilə qalib gəlir.',
    abilityGuide:
      'Ölüm anında ekranda 15 saniyəlik intiqam nişangahı açılır — dərhal əsas şübhəliyə atəş aç.',
  },
  LITTLE_GIRL: {
    role: 'LITTLE_GIRL',
    name: 'Little Girl',
    nameAz: 'Kiçik Qız',
    displayName: 'Kiçik Qız (Little Girl)',
    icon: '👧',
    faction: 'VILLAGE',
    factionLabel: 'Normal',
    color: '#f472b6',
    badgeBg: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
    shortDescription:
      'Gecə Qatil söhbətini anonimləşdirilmiş halda (Wolf 1, Wolf 2) gizlicə dinləyə bilir.',
    winCondition: 'Normal komandası ilə qalib gəlir.',
    abilityGuide:
      'Gizli İzlə düyməsini basıb saxladıqca risk sayğacı artır; çox uzun baxsan Qatillər izlənildiyini anlayacaq.',
    nightActionLabel: '👀 Gizli İzləmə',
  },
  ELDER: {
    role: 'ELDER',
    name: 'Elder',
    nameAz: 'Ağsaqqal',
    displayName: 'Ağsaqqal (Elder)',
    icon: '🧓',
    faction: 'VILLAGE',
    factionLabel: 'Normal',
    color: '#84cc16',
    badgeBg: 'bg-lime-500/20 text-lime-200 border-lime-500/40',
    shortDescription:
      'Gecə ilk Qatil hücumundan sağ çıxır (2 canı var). Kənd səsverməsi ilə edam edilərsə, bütün Normal rollar xüsusi güclərini itirir!',
    winCondition: 'Normal komandası ilə qalib gəlir.',
    abilityGuide:
      'İlk gecə Qatil dişləməsi səni öldürmür (yalnız qalxanını qırır). Ancaq kəndlilərə özünü günahsız sübut et — asılsan bütün kənd gücsüz qalacaq!',
  },
  BEAR_TAMER: {
    role: 'BEAR_TAMER',
    name: 'Bear Tamer',
    nameAz: 'Ayı Təlimçisi',
    displayName: 'Ayı Təlimçisi (Bear Tamer)',
    icon: '🐻',
    faction: 'VILLAGE',
    factionLabel: 'Normal',
    color: '#d97706',
    badgeBg: 'bg-amber-600/20 text-amber-200 border-amber-500/40',
    shortDescription:
      'Sübh açıldıqda tonqalda sağ və ya sol qonşusundan ən azı biri Qatil olarsa, ayı hamıya nərildəyir!',
    winCondition: 'Normal komandası ilə qalib gəlir.',
    abilityGuide:
      'Səhər server "🐻 Ayı nərildəyir!" elanı verərsə, bil ki tonqal dairəsində birbaşa sağında və ya solunda Qatil oturub!',
  },
  CROW: {
    role: 'CROW',
    name: 'Crow',
    nameAz: 'Qarğa',
    displayName: 'Qarğa (Crow)',
    icon: '🐦‍⬛',
    faction: 'VILLAGE',
    factionLabel: 'Normal',
    color: '#818cf8',
    badgeBg: 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40',
    shortDescription:
      'Hər gecə 1 oyunçunu lənətləyir; həmin oyunçu növbəti günün səsverməsinə +2 avtomatik cəza səsi ilə başlayır.',
    winCondition: 'Normal komandası ilə qalib gəlir.',
    abilityGuide:
      'Şübhələndiyin oyunçuya qarğa göndər — səhər səsverməyə artıq 2 səs qabaqdan başlasın.',
    nightActionLabel: '🐦‍⬛ Lənətlə (+2 Səs)',
  },
  CUPID: {
    role: 'CUPID',
    name: 'Cupid',
    nameAz: 'Kupid',
    displayName: 'Kupid (Cupid)',
    icon: '💘',
    faction: 'VILLAGE',
    factionLabel: 'Normal',
    color: '#ec4899',
    badgeBg: 'bg-pink-500/20 text-pink-200 border-pink-400/40',
    shortDescription:
      'Yalnız 1-ci gecə 2 oyunçunu Aşiq olaraq bağlayır. Biri ölərsə, digəri də kədərdən dərhal ölür.',
    winCondition:
      'Normal komandası ilə qazanır (Normal + Qatil Aşiq olarsa, son 2 sağ qalan kimi yalnız onlar qalib gəlir).',
    abilityGuide:
      '1-ci gecə tonqaldan 2 fərqli oyunçu seçib onları Aşiq et. Aşiqlər gizli 💘 Aşiqlər çatında danışa biləcək!',
    nightActionLabel: '💘 2 Aşiq Seç (Gecə 1)',
  },

  // ==========================================
  // 2. QATİL TEAM (Killer / Werewolf Team)
  // ==========================================
  WEREWOLF: {
    role: 'WEREWOLF',
    name: 'Werewolf',
    nameAz: 'Canavar',
    displayName: 'Canavar (Werewolf)',
    icon: '🐺',
    faction: 'WEREWOLF',
    factionLabel: 'Qatil',
    isBaseFiller: true,
    color: '#f87171',
    badgeBg: 'bg-red-500/20 text-red-300 border-red-500/40',
    shortDescription:
      'Hər gecə gizli Qatil çatında danışır və sürünün yeyəcəyi qurbana səs verir.',
    winCondition:
      'Bütün ölümcül Tərəfsizlər öldükdən sonra Qatillərin sayı qalan oyunçulara bərabər və ya çox olduqda qazanır.',
    abilityGuide:
      'Avtomatik kvota sistemində Qatil komandasının qalan yerlərini doldurur. Gündüz günahsız kəndli kimi davran!',
    nightActionLabel: '🩸 Qurban Seç',
  },
  BLACK_WOLF: {
    role: 'BLACK_WOLF',
    name: 'Black Wolf',
    nameAz: 'Qara Canavar',
    displayName: 'Qara Canavar (Black Wolf)',
    icon: '🏴‍☠️',
    faction: 'WEREWOLF',
    factionLabel: 'Qatil',
    color: '#dc2626',
    badgeBg: 'bg-red-700/30 text-red-200 border-red-500/50',
    shortDescription:
      'Matç boyu 1 dəfə Qatil sürüsünün seçdiyi qurbanı öldürmək əvəzinə Canavara yoluxdurub komandanıza qatır.',
    winCondition: 'Qatil komandası ilə qalib gəlir.',
    abilityGuide:
      'Əvvəl sürü ilə qurbanı səsvermə ilə seç, sonra "Yoluxdur (Infect)" düyməsini aktivləşdir. Mühafizəçi və ya Cadugər qoruyarsa qurban ölmür və yoluxmur.',
    nightActionLabel: '🦠 Yoluxdur (1x)',
  },
  MYSTIC_WOLF: {
    role: 'MYSTIC_WOLF',
    name: 'Mystic Wolf',
    nameAz: 'Mistik Canavar',
    displayName: 'Mistik Canavar (Mystic Wolf)',
    icon: '👁️‍🗨️',
    faction: 'WEREWOLF',
    factionLabel: 'Qatil',
    color: '#fb7185',
    badgeBg: 'bg-rose-500/25 text-rose-200 border-rose-500/50',
    shortDescription:
      'Hər gecə 1 Qatil olmayan oyunçunu yoxlayıb onun xüsusi gücü olub-olmadığını (Adi Kəndli vs Güclü Rol) öyrənir.',
    winCondition: 'Qatil komandası ilə qalib gəlir.',
    abilityGuide:
      'Sürü ovuna səs verdikdən sonra "Güc Yoxla" rejimini seçib hədəfin xüsusi qabiliyyətə malik olub-olmadığını aşkar et.',
    nightActionLabel: '👁️ Güc Yoxla',
  },
  VENGEFUL_WOLF: {
    role: 'VENGEFUL_WOLF',
    name: 'Vengeful Wolf',
    nameAz: 'İntiqamçı Qurd',
    displayName: 'İntiqamçı Qurd (Vengeful Wolf)',
    icon: '🩸',
    faction: 'WEREWOLF',
    factionLabel: 'Qatil',
    color: '#e11d48',
    badgeBg: 'bg-rose-600/25 text-rose-200 border-rose-500/50',
    shortDescription:
      'Sürü ilə gecə ovlayır. Gündüz kənd səsverməsi ilə edam edilərsə, dərhal sağ qalan 1 oyunçunu özü ilə məzara aparır!',
    winCondition: 'Qatil komandası ilə qalib gəlir.',
    abilityGuide:
      'Gündüz asılmaq üzrə olsan qorxma — edam anında 15 saniyəlik intiqam seçimi açılacaq və istədiyin sağ oyunçunu özünlə aparacaqsan.',
    nightActionLabel: '🩸 Qurban Seç',
  },
  SHADOW_WOLF: {
    role: 'SHADOW_WOLF',
    name: 'Shadow Wolf',
    nameAz: 'Kölgə Qurd',
    displayName: 'Kölgə Qurd (Shadow Wolf)',
    icon: '🌑',
    faction: 'WEREWOLF',
    factionLabel: 'Qatil',
    color: '#9333ea',
    badgeBg: 'bg-purple-600/25 text-purple-200 border-purple-500/50',
    shortDescription:
      'Sürü ilə gecə ovlayır. Oyun boyu 1 dəfə gündüz səsverməsində bütün canlı səs saylarını səsvermə bitənə qədər gizlədə bilər!',
    winCondition: 'Qatil komandası ilə qalib gəlir.',
    abilityGuide:
      'Gündüz səsverməsində kritik anda "🌑 Səsləri Gizlət (1x)" düyməsini bas — kimə neçə səs gəldiyi səsvermə bitənə qədər gizli qalacaq.',
    nightActionLabel: '🌑 Qurban Seç / Səsləri Gizlət',
  },

  // ==========================================
  // 3. TƏRƏFSİZ TEAM (Neutral Team)
  // ==========================================
  ANGEL: {
    role: 'ANGEL',
    name: 'Angel',
    nameAz: 'Mələk',
    displayName: 'Mələk (Angel)',
    icon: '😇',
    faction: 'NEUTRAL',
    factionLabel: 'Tərəfsiz',
    color: '#fde047',
    badgeBg: 'bg-yellow-400/20 text-yellow-200 border-yellow-400/40',
    shortDescription:
      'Yeganə məqsədi 1-ci gündüz səsverməsi ilə edam edilməkdir! 2-ci gecəyə sağ qalsa Kəndliyə çevrilir.',
    winCondition:
      '1-ci gün kənd səsverməsi ilə asılsa DƏRHAL təkbaşına qazanır. Əks halda 2-ci gecə Normal Kəndli olur.',
    abilityGuide:
      '1-ci gün şübhəli ifadələr verib səsvermədə özünü asdır — amma gecə canavarlara yem olma!',
  },
  WHITE_WOLF: {
    role: 'WHITE_WOLF',
    name: 'White Wolf',
    nameAz: 'Ağ Canavar',
    displayName: 'Ağ Canavar (White Wolf)',
    icon: '🐻‍❄️',
    faction: 'NEUTRAL',
    factionLabel: 'Tərəfsiz',
    color: '#e2e8f0',
    badgeBg: 'bg-slate-200/20 text-slate-100 border-slate-300/40',
    shortDescription:
      'Qatillərə adi Canavar kimi görünür və onlarla danışır, amma hər 2-ci gecə 1 canavar yoldaşını gizlicə öldürə bilir.',
    winCondition:
      'Yalnız və yalnız tonqalda sağ qalan TƏK SONUNCU oyunçu olduqda təkbaşına qazanır.',
    abilityGuide:
      '2, 4, 6-cı gecələrdə xüsusi xəyanət rejimi ilə başqa bir canavarı öldürə bilərsən. Sonda həm kəndliləri, həm də sürünü məhv etməlisən!',
    nightActionLabel: '🗡️ Canavara Xəyanət (Cüt Gecə)',
  },
  ARSONIST: {
    role: 'ARSONIST',
    name: 'Arsonist',
    nameAz: 'Alovçu',
    displayName: 'Alovçu (Arsonist)',
    icon: '🔥',
    faction: 'NEUTRAL',
    factionLabel: 'Tərəfsiz',
    color: '#fb923c',
    badgeBg: 'bg-orange-500/25 text-orange-200 border-orange-500/50',
    shortDescription:
      'Hər gecə ya 1 oyunçunu benzinləyir (Douse), ya da əvvəl benzinlədiyi BÜTÜN oyunçuları eyni anda alovlandırır (Ignite)!',
    winCondition:
      'Tonqalda sağ qalan TƏK SONUNCU oyunçu olduqda təkbaşına qalib gəlir.',
    abilityGuide:
      'Əvvəlcə səssizcə bir neçə hədəfə benzin tök, sonra "Alovlandır" düyməsini basaraq hamısını birdən partlat! Alov Mühafizəçini də keçə bilər.',
    nightActionLabel: '🛢️ Benzinlə / 🔥 Alovlandır',
  },
  JESTER: {
    role: 'JESTER',
    name: 'Jester',
    nameAz: 'Təlxək',
    displayName: 'Təlxək (Jester)',
    icon: '🃏',
    faction: 'NEUTRAL',
    factionLabel: 'Tərəfsiz',
    color: '#c084fc',
    badgeBg: 'bg-purple-500/20 text-purple-200 border-purple-400/40',
    shortDescription:
      'Məqsədi istənilən gündüz səsverməsində kəndi aldadıb özünü edam etdirməkdir!',
    winCondition:
      'Hər hansı bir gündüz səsverməsində edam edildiyi anda DƏRHAL təkbaşına qazanır!',
    abilityGuide:
      'Şübhəli danış, amma gecə canavarlara öldürtmə — gündüz məhkəməsində səs çoxluğu ilə asılsan təkbaşına qalib gəlirsən.',
  },
  WILD_CHILD: {
    role: 'WILD_CHILD',
    name: 'Wild Child',
    nameAz: 'Vəhşi Uşaq',
    displayName: 'Vəhşi Uşaq (Wild Child)',
    icon: '🐾',
    faction: 'NEUTRAL',
    factionLabel: 'Tərəfsiz',
    color: '#14b8a6',
    badgeBg: 'bg-teal-500/20 text-teal-200 border-teal-400/40',
    shortDescription:
      'Normal komandasında başlayır. 1-ci gecə 1 Rol Model seçir; həmin şəxs ölərsə gizlicə Canavara (Qatil) çevrilir!',
    winCondition:
      'Rol Modeli sağ qalarsa Normal ilə, öləndən sonra Canavara çevrilib Qatil komandası ilə qazanır.',
    abilityGuide:
      '1-ci gecə sağ qalacağını və ya tez hədəf alınacağını düşündüyün 1 oyunçunu Rol Model seç. O ölən kimi Qatil sürüsünə qoşulursan!',
    nightActionLabel: '🐾 Rol Model Seç (Gecə 1)',
  },
};

export function getFactionGroupRoles(faction: Faction): RoleType[] {
  return ALL_PLAYABLE_ROLES.filter((r) => ROLE_CATALOG[r].faction === faction);
}

export interface QuotaPreviewBreakdown {
  playerCount: number;
  baseQuota: FactionQuota;
  adjustedNormal: number;
  terefsizShortage: number;
  enabledTerefsizCount: number;
  enabledQatilSpecialCount: number;
  enabledNormalSpecialCount: number;
}

/**
 * Mirrors server `GameEngine.buildRoleDeck` quota logic so the Host immediately sees
 * exact Normal / Qatil / Tərəfsiz numbers for the seated player count.
 */
export function computeQuotaPreview(
  connectedCount: number,
  enabledRoles: Record<RoleType, boolean>
): QuotaPreviewBreakdown {
  const playerCount = Math.min(16, Math.max(4, connectedCount));
  const baseQuota = FACTION_QUOTA_TABLE[playerCount] ?? FACTION_QUOTA_TABLE[4];

  const enabledTerefsizCount = TEREFSIZ_ROLES.filter((r) =>
    Boolean(enabledRoles[r])
  ).length;
  const activeTerefsizCount = Math.min(baseQuota.terefsiz, enabledTerefsizCount);
  const terefsizShortage = baseQuota.terefsiz - activeTerefsizCount;

  const adjustedNormal = baseQuota.normal + terefsizShortage;
  const enabledQatilSpecialCount = QATIL_SPECIAL_ROLES.filter((r) =>
    Boolean(enabledRoles[r])
  ).length;
  const enabledNormalSpecialCount = NORMAL_SPECIAL_ROLES.filter((r) =>
    Boolean(enabledRoles[r])
  ).length;

  return {
    playerCount,
    baseQuota,
    adjustedNormal,
    terefsizShortage,
    enabledTerefsizCount: activeTerefsizCount,
    enabledQatilSpecialCount,
    enabledNormalSpecialCount,
  };
}
