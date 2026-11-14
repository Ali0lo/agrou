import { Faction, RoleType } from '../types/game.js';

export interface RoleDefinition {
  role: RoleType;
  nameAz: string;
  nameEn: string;
  displayName: string;
  icon: string;
  faction: Faction;
  shortDescription: string;
  winCondition: string;
  hasNightAction: boolean;
  nightOneOnly?: boolean;
  nightTurnPriority: number;
}

export const DETERMINISTIC_NIGHT_ORDER: RoleType[] = [
  // Night 1 Setup
  'THIEF',
  'CUPID',
  'WILD_CHILD',
  'SISTERS',
  // Information & Inspection
  'FOX',
  'SEER',
  'WOLF_SEER',
  'MEDIUM',
  // Protection
  'GUARD',
  // Werewolf Pack & Wolf Specials
  'WEREWOLF',
  'BIG_BAD_WOLF',
  'BLACK_WOLF',
  'WHITE_WOLF',
  // Potions, Curses & Solo Killers
  'WITCH',
  'CROW',
  'SERIAL_KILLER',
];

export const ROLE_DEFINITIONS: Record<RoleType, RoleDefinition> = {
  // ==========================================
  // A. KƏNDLİLƏR / VILLAGE TEAM (12 Roles)
  // ==========================================
  VILLAGER: {
    role: 'VILLAGER',
    nameAz: 'Kəndli',
    nameEn: 'Villager',
    displayName: 'Kəndli (Villager)',
    icon: '🌾',
    faction: 'VILLAGE',
    shortDescription:
      'Gecə xüsusi gücü yoxdur; gündüz müzakirə və səsvermə ilə canavarları tapmağa çalışır.',
    winCondition: 'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd qazanır.',
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
    shortDescription:
      'Hər gecə oyanaraq bir oyunçunu yoxlayır və onun dəqiq rolunu öyrənir.',
    winCondition: 'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd qazanır.',
    hasNightAction: true,
    nightTurnPriority: 21,
  },
  GUARD: {
    role: 'GUARD',
    nameAz: 'Mühafizəçi',
    nameEn: 'Bodyguard',
    displayName: 'Mühafizəçi (Bodyguard)',
    icon: '🛡️',
    faction: 'VILLAGE',
    shortDescription:
      'Hər gecə bir oyunçunu canavar hücumundan qoruyur (eyni oyunçunu ardıcıl iki gecə qoruya bilməz).',
    winCondition: 'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd qazanır.',
    hasNightAction: true,
    nightTurnPriority: 30,
  },
  WITCH: {
    role: 'WITCH',
    nameAz: 'Cadugər',
    nameEn: 'Witch',
    displayName: 'Cadugər (Witch)',
    icon: '🧪',
    faction: 'VILLAGE',
    shortDescription:
      'Oyun boyu iki birdəfəlik iksiri var: Həyat İksiri (canavarların qurbanını xilas edir) və Ölüm İksiri (istənilən oyunçunu öldürür).',
    winCondition: 'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd qazanır.',
    hasNightAction: true,
    nightTurnPriority: 60,
  },
  HUNTER: {
    role: 'HUNTER',
    nameAz: 'Ovçu',
    nameEn: 'Hunter',
    displayName: 'Ovçu (Hunter)',
    icon: '🏹',
    faction: 'VILLAGE',
    shortDescription:
      'Öldürüldükdə (gecə və ya gündüz səsverməsində) son nəfəsində bir canlı oyunçunu vuraraq özü ilə aparır.',
    winCondition: 'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd qazanır.',
    hasNightAction: false,
    nightTurnPriority: 99,
  },
  CUPID: {
    role: 'CUPID',
    nameAz: 'Kupidon',
    nameEn: 'Cupid',
    displayName: 'Kupidon (Cupid)',
    icon: '💘',
    faction: 'VILLAGE',
    shortDescription:
      '1-ci gecə iki oyunçunu Aşiqlər (Lovers) olaraq birləşdirir. Biri ölərsə, digəri də dərhal kədərdən ölür.',
    winCondition: 'Kəndlə birlikdə (və ya fərqli komandalardandırsa Aşiqlər cütlüyü olaraq) qazanır.',
    hasNightAction: true,
    nightOneOnly: true,
    nightTurnPriority: 2,
  },
  LITTLE_GIRL: {
    role: 'LITTLE_GIRL',
    nameAz: 'Kiçik Qız',
    nameEn: 'Little Girl',
    displayName: 'Kiçik Qız (Little Girl)',
    icon: '🕯️',
    faction: 'VILLAGE',
    shortDescription:
      'Gecə canavarların gizli söhbətinə gizlicə baxa bilər, lakin hər saniyə ifşa olunma riskini artırır.',
    winCondition: 'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd qazanır.',
    hasNightAction: true,
    nightTurnPriority: 42,
  },
  ELDER: {
    role: 'ELDER',
    nameAz: 'Ağsaqqal',
    nameEn: 'Elder',
    displayName: 'Ağsaqqal (Elder)',
    icon: '🧙‍♂️',
    faction: 'VILLAGE',
    shortDescription:
      'Canavarların ilk hücumundan sağ çıxır (2 canı var). Lakin kənd səsverməsi ilə edam edilərsə, kəndin bütün xüsusi gücləri itirilir!',
    winCondition: 'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd qazanır.',
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
    shortDescription:
      'Hər gecə bir oyunçunu lənətləyir və həmin oyunçu növbəti gündüz səsverməsinə avtomatik +2 səslə başlayır.',
    winCondition: 'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd qazanır.',
    hasNightAction: true,
    nightTurnPriority: 70,
  },
  SISTERS: {
    role: 'SISTERS',
    nameAz: 'Qardaşlar',
    nameEn: 'Two Sisters / Brothers',
    displayName: 'Qardaşlar (Two Sisters)',
    icon: '🤝',
    faction: 'VILLAGE',
    shortDescription:
      '1-ci gecə bir-birini tanıyan və gecələr gizli söhbət kanalını paylaşan sadiq kəndlilər.',
    winCondition: 'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd qazanır.',
    hasNightAction: false,
    nightOneOnly: true,
    nightTurnPriority: 4,
  },
  MEDIUM: {
    role: 'MEDIUM',
    nameAz: 'Ruhçağıran',
    nameEn: 'Medium',
    displayName: 'Ruhçağıran (Medium)',
    icon: '👻',
    faction: 'VILLAGE',
    shortDescription:
      'Gecə ölmüş oyunçuların ruhları ilə ünsiyyət qura bilir və ölən oyunçunun gizli rolunu öyrənə bilir.',
    winCondition: 'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd qazanır.',
    hasNightAction: true,
    nightTurnPriority: 23,
  },
  FOX: {
    role: 'FOX',
    nameAz: 'Tülkü',
    nameEn: 'Fox',
    displayName: 'Tülkü (Fox)',
    icon: '🦊',
    faction: 'VILLAGE',
    shortDescription:
      'Gecə yanaşı əyləşən 3 oyunçunu (hədəf və sağ/sol qonşuları) iyləyir; ən azı biri Canavardırsa öyrənir. Heç biri deyilsə gücünü itirir.',
    winCondition: 'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd qazanır.',
    hasNightAction: true,
    nightTurnPriority: 20,
  },

  // ==========================================
  // B. CANAVARLAR / WEREWOLF TEAM (5 Roles)
  // ==========================================
  WEREWOLF: {
    role: 'WEREWOLF',
    nameAz: 'Canavar',
    nameEn: 'Werewolf',
    displayName: 'Canavar (Werewolf)',
    icon: '🐺',
    faction: 'WEREWOLF',
    shortDescription:
      'Hər gecə sürüsü ilə birlikdə oyanaraq bir qurbanı parçalamaq üçün səs verir.',
    winCondition: 'Canavarların sayı qeyri-canavarlara bərabər və ya çox olduqda qazanır.',
    hasNightAction: true,
    nightTurnPriority: 40,
  },
  BIG_BAD_WOLF: {
    role: 'BIG_BAD_WOLF',
    nameAz: 'Böyük Qara Canavar',
    nameEn: 'Big Bad Wolf',
    displayName: 'Böyük Qara Canavar (Big Bad Wolf)',
    icon: '🐾',
    faction: 'WEREWOLF',
    shortDescription:
      'Hər gecə sürü səsverməsindən əlavə ikinci bir qurbanı təkbaşına öldürə bilər (ilk canavar ölənə qədər).',
    winCondition: 'Canavarların sayı qeyri-canavarlara bərabər və ya çox olduqda qazanır.',
    hasNightAction: true,
    nightTurnPriority: 45,
  },
  BLACK_WOLF: {
    role: 'BLACK_WOLF',
    nameAz: 'Yoluxucu Ata Canavar',
    nameEn: 'Infectious Father of Wolves',
    displayName: 'Yoluxucu Ata Canavar (Infectious Wolf)',
    icon: '🖤',
    faction: 'WEREWOLF',
    shortDescription:
      'Oyun boyu bir dəfə gecə sürünün hədəfini öldürmək əvəzinə yoluxduraraq gizlicə Canavara çevirə bilər.',
    winCondition: 'Canavarların sayı qeyri-canavarlara bərabər və ya çox olduqda qazanır.',
    hasNightAction: true,
    nightTurnPriority: 46,
  },
  WOLF_SEER: {
    role: 'WOLF_SEER',
    nameAz: 'Görücü Canavar',
    nameEn: 'Wolf Seer',
    displayName: 'Görücü Canavar (Wolf Seer)',
    icon: '👁️‍🗨️',
    faction: 'WEREWOLF',
    shortDescription:
      'Sürü ilə birlikdə oyanır və hər gecə bir oyunçunun dəqiq rolunu yoxlayaraq Kahin və ya Cadugəri axtarır.',
    winCondition: 'Canavarların sayı qeyri-canavarlara bərabər və ya çox olduqda qazanır.',
    hasNightAction: true,
    nightTurnPriority: 22,
  },
  WHITE_WOLF: {
    role: 'WHITE_WOLF',
    nameAz: 'Ağ Canavar',
    nameEn: 'White Werewolf',
    displayName: 'Ağ Canavar (White Werewolf)',
    icon: '🐻‍❄️',
    faction: 'NEUTRAL',
    shortDescription:
      'Digər canavarlara adi Canavar kimi görünür. Hər iki gecədən bir (cüt gecələr) digər bir Canavarı öldürə bilər.',
    winCondition: 'Yalnız oyunda sağ qalan sonuncu tək oyunçu olduqda qazanır.',
    hasNightAction: true,
    nightTurnPriority: 50,
  },

  // ==========================================
  // C. NEYTRAL / SOLO & SPECIAL ROLES (5 Roles)
  // ==========================================
  THIEF: {
    role: 'THIEF',
    nameAz: 'Oğru',
    nameEn: 'Thief',
    displayName: 'Oğru (Thief)',
    icon: '🎭',
    faction: 'NEUTRAL',
    shortDescription:
      '1-ci gecə mərkəzdəki iki əlavə rol kartına baxır və onlardan birini seçərək rolunu dəyişir (Canavar varsa seçməyə məcburdur).',
    winCondition: 'Seçdiyi yeni rolun komandası ilə qazanır.',
    hasNightAction: true,
    nightOneOnly: true,
    nightTurnPriority: 1,
  },
  WILD_CHILD: {
    role: 'WILD_CHILD',
    nameAz: 'Vəhşi Uşaq',
    nameEn: 'Wild Child',
    displayName: 'Vəhşi Uşaq (Wild Child)',
    icon: '🐾',
    faction: 'VILLAGE',
    shortDescription:
      '1-ci gecə özünə bir Kumir (Role Model) seçir. Kumiri sağ ikən Kənd komandasındadır; Kumiri ölərsə dərhal Canavara çevrilir!',
    winCondition: 'Çevrilməzdən əvvəl Kəndlə, çevrildikdən sonra isə Canavarlarla qazanır.',
    hasNightAction: true,
    nightOneOnly: true,
    nightTurnPriority: 3,
  },
  JESTER: {
    role: 'JESTER',
    nameAz: 'Təlxək / Dəli',
    nameEn: 'Jester / Fool',
    displayName: 'Təlxək / Dəli (Jester)',
    icon: '🃏',
    faction: 'NEUTRAL',
    shortDescription:
      'Təkbaşına oynayan neytral rol; kəndi aldadaraq gündüz səsverməsində özünü edam etdirərsə dərhal tək qalib olur!',
    winCondition: 'Gündüz kənd səsverməsi ilə edam edilmək.',
    hasNightAction: false,
    nightTurnPriority: 99,
  },
  SERIAL_KILLER: {
    role: 'SERIAL_KILLER',
    nameAz: 'Zərbəçi / Qatil',
    nameEn: 'Serial Killer',
    displayName: 'Zərbəçi / Qatil (Serial Killer)',
    icon: '🗡️',
    faction: 'NEUTRAL',
    shortDescription:
      'Hər gecə müstəqil olaraq bir hədəfi aradan götürən tək qatil. Mühafizəçi onu dayandıra bilmir.',
    winCondition: 'Yalnız oyunda sağ qalan sonuncu tək oyunçu olduqda qazanır.',
    hasNightAction: true,
    nightTurnPriority: 80,
  },
  MAYOR: {
    role: 'MAYOR',
    nameAz: 'Bələdiyyə Başçısı / Şerif',
    nameEn: 'Mayor / Sheriff',
    displayName: 'Bələdiyyə Başçısı / Şerif (Mayor)',
    icon: '🎖️',
    faction: 'VILLAGE',
    shortDescription:
      'Gündüz səsverməsində səsi 2 səs kimi hesablanır və bərabərlikləri həll edir.',
    winCondition: 'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd qazanır.',
    hasNightAction: false,
    nightTurnPriority: 99,
  },

  // Legacy alias support for existing tests using ANGEL
  ANGEL: {
    role: 'ANGEL',
    nameAz: 'Mələk',
    nameEn: 'Angel',
    displayName: 'Mələk (Angel)',
    icon: '👼',
    faction: 'NEUTRAL',
    shortDescription:
      '1-ci gün kənd tərəfindən səsvermə ilə edam edilərsə dərhal qazanır, sağ qalarsa adi Kəndliyə çevrilir.',
    winCondition: '1-ci gün səsvermə ilə edam edilmək.',
    hasNightAction: false,
    nightTurnPriority: 99,
  },
};

export const ALL_22_ROLES: RoleType[] = [
  // Village (12)
  'VILLAGER',
  'SEER',
  'GUARD',
  'WITCH',
  'HUNTER',
  'CUPID',
  'LITTLE_GIRL',
  'ELDER',
  'CROW',
  'SISTERS',
  'MEDIUM',
  'FOX',
  // Werewolves (5)
  'WEREWOLF',
  'BIG_BAD_WOLF',
  'BLACK_WOLF',
  'WOLF_SEER',
  'WHITE_WOLF',
  // Neutral / Special (5)
  'THIEF',
  'WILD_CHILD',
  'JESTER',
  'SERIAL_KILLER',
  'MAYOR',
];
