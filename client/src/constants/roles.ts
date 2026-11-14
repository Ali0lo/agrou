import { Faction, RoleInfo, RoleType } from '../types/game';

export const VILLAGE_ROLES: RoleType[] = [
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
];

export const WEREWOLF_ROLES: RoleType[] = [
  'WEREWOLF',
  'BIG_BAD_WOLF',
  'BLACK_WOLF',
  'WOLF_SEER',
  'WHITE_WOLF',
];

export const NEUTRAL_ROLES: RoleType[] = [
  'THIEF',
  'WILD_CHILD',
  'JESTER',
  'SERIAL_KILLER',
  'MAYOR',
];

export const ALL_22_ROLES: RoleType[] = [
  ...VILLAGE_ROLES,
  ...WEREWOLF_ROLES,
  ...NEUTRAL_ROLES,
];

export interface RolePreset {
  id: string;
  label: string;
  subtitle: string;
  roles: Partial<Record<RoleType, number>>;
}

export const ROLE_PRESETS: RolePreset[] = [
  {
    id: 'classic-6',
    label: '6 Oyunçu Klassik',
    subtitle: '1 Canavar, Kahin, Cadugər, Mühafizəçi, 2 Kəndli',
    roles: {
      WEREWOLF: 1,
      SEER: 1,
      WITCH: 1,
      GUARD: 1,
      VILLAGER: 2,
    },
  },
  {
    id: 'mixed-10',
    label: '10 Oyunçu Qarışıq',
    subtitle: 'Canavar, Yoluxucu Ata, Kahin, Cadugər, Mühafizəçi, Ovçu, Kupidon, Tülkü, Təlxək, Şerif',
    roles: {
      WEREWOLF: 1,
      BLACK_WOLF: 1,
      SEER: 1,
      WITCH: 1,
      GUARD: 1,
      HUNTER: 1,
      CUPID: 1,
      FOX: 1,
      JESTER: 1,
      MAYOR: 1,
    },
  },
  {
    id: 'chaos-16',
    label: '16+ Xaos',
    subtitle: 'Bütün xüsusi kənd, canavar sürüsü və neytral rollar daxil',
    roles: {
      WEREWOLF: 1,
      BIG_BAD_WOLF: 1,
      BLACK_WOLF: 1,
      WOLF_SEER: 1,
      WHITE_WOLF: 1,
      SEER: 1,
      GUARD: 1,
      WITCH: 1,
      HUNTER: 1,
      CUPID: 1,
      LITTLE_GIRL: 1,
      ELDER: 1,
      CROW: 1,
      MEDIUM: 1,
      FOX: 1,
      SERIAL_KILLER: 1,
    },
  },
];

export const ROLE_CATALOG: Record<RoleType, RoleInfo> = {
  // ==========================================
  // A. KƏNDLİLƏR / VILLAGE TEAM (12 Roles)
  // ==========================================
  VILLAGER: {
    role: 'VILLAGER',
    name: 'Kəndli (Villager)',
    nameAz: 'Kəndli',
    nameEn: 'Villager',
    icon: '🌾',
    faction: 'VILLAGE',
    colorClass: 'text-emerald-300',
    badgeBg: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200',
    description:
      'Gecə xüsusi qabiliyyəti yoxdur; gündüz müzakirə və məntiqi səsvermə ilə canavarları tapır.',
    winCondition:
      'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd komandası ilə qazanır.',
  },
  SEER: {
    role: 'SEER',
    name: 'Kahin (Seer)',
    nameAz: 'Kahin',
    nameEn: 'Seer',
    icon: '🔮',
    faction: 'VILLAGE',
    colorClass: 'text-purple-300',
    badgeBg: 'bg-purple-500/20 border-purple-500/40 text-purple-200',
    description:
      'Hər gecə oyanaraq bir oyunçunu yoxlayır və onun dəqiq rolunu gizlicə öyrənir.',
    winCondition:
      'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd komandası ilə qazanır.',
  },
  GUARD: {
    role: 'GUARD',
    name: 'Mühafizəçi (Bodyguard)',
    nameAz: 'Mühafizəçi',
    nameEn: 'Bodyguard',
    icon: '🛡️',
    faction: 'VILLAGE',
    colorClass: 'text-sky-300',
    badgeBg: 'bg-sky-500/20 border-sky-500/40 text-sky-200',
    description:
      'Hər gecə bir oyunçunu canavar hücumundan qoruyur (eyni oyunçunu ardıcıl iki gecə qoruya bilməz).',
    winCondition:
      'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd komandası ilə qazanır.',
  },
  WITCH: {
    role: 'WITCH',
    name: 'Cadugər (Witch)',
    nameAz: 'Cadugər',
    nameEn: 'Witch',
    icon: '🧪',
    faction: 'VILLAGE',
    colorClass: 'text-fuchsia-300',
    badgeBg: 'bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-200',
    description:
      'Oyun boyu iki birdəfəlik iksiri var: Həyat İksiri (canavarların hədəfini xilas edir) və Ölüm İksiri (gecə istənilən oyunçunu öldürür).',
    winCondition:
      'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd komandası ilə qazanır.',
  },
  HUNTER: {
    role: 'HUNTER',
    name: 'Ovçu (Hunter)',
    nameAz: 'Ovçu',
    nameEn: 'Hunter',
    icon: '🏹',
    faction: 'VILLAGE',
    colorClass: 'text-amber-300',
    badgeBg: 'bg-amber-500/20 border-amber-500/40 text-amber-200',
    description:
      'Öldürüldükdə (canavarlar və ya gündüz səsverməsi ilə) dərhal son atəşini açaraq seçdiyi bir oyunçunu özü ilə aparır.',
    winCondition:
      'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd komandası ilə qazanır.',
  },
  CUPID: {
    role: 'CUPID',
    name: 'Kupidon (Cupid)',
    nameAz: 'Kupidon',
    nameEn: 'Cupid',
    icon: '💘',
    faction: 'VILLAGE',
    colorClass: 'text-pink-300',
    badgeBg: 'bg-pink-500/20 border-pink-500/40 text-pink-200',
    description:
      '1-ci gecə iki oyunçunu Aşiqlər (Lovers) olaraq birləşdirir. Biri ölərsə, digəri də dərhal ürək ağrısından ölür.',
    winCondition:
      'Kənd komandası ilə qazanır (Canavar və Kəndli birləşibsə, Aşiqlər son iki sağ qalan olaraq qazanır).',
  },
  LITTLE_GIRL: {
    role: 'LITTLE_GIRL',
    name: 'Kiçik Qız (Little Girl)',
    nameAz: 'Kiçik Qız',
    nameEn: 'Little Girl',
    icon: '🕯️',
    faction: 'VILLAGE',
    colorClass: 'text-teal-300',
    badgeBg: 'bg-teal-500/20 border-teal-500/40 text-teal-200',
    description:
      'Gecə fazasında canavarların gizli söhbətini izləyə bilər, lakin hər saniyə ifşa olunma riskini artırır.',
    winCondition:
      'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd komandası ilə qazanır.',
  },
  ELDER: {
    role: 'ELDER',
    name: 'Ağsaqqal (Elder)',
    nameAz: 'Ağsaqqal',
    nameEn: 'Elder',
    icon: '🧙‍♂️',
    faction: 'VILLAGE',
    colorClass: 'text-cyan-300',
    badgeBg: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-200',
    description:
      'Canavarların ilk hücumundan sağ çıxır (canavarlara qarşı 2 canı var); lakin kənd səsverməsi ilə edam edilərsə, bütün xüsusi kənd gücləri itirilir!',
    winCondition:
      'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd komandası ilə qazanır.',
  },
  CROW: {
    role: 'CROW',
    name: 'Qarğa (Crow)',
    nameAz: 'Qarğa',
    nameEn: 'Crow',
    icon: '🐦‍⬛',
    faction: 'VILLAGE',
    colorClass: 'text-violet-300',
    badgeBg: 'bg-violet-500/20 border-violet-500/40 text-violet-200',
    description:
      'Hər gecə bir oyunçunu lənətləyir və həmin oyunçu növbəti gündüz səsverməsinə avtomatik +2 səslə başlayır.',
    winCondition:
      'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd komandası ilə qazanır.',
  },
  SISTERS: {
    role: 'SISTERS',
    name: 'Qardaşlar (Two Sisters)',
    nameAz: 'Qardaşlar',
    nameEn: 'Two Sisters / Brothers',
    icon: '🤝',
    faction: 'VILLAGE',
    colorClass: 'text-blue-300',
    badgeBg: 'bg-blue-500/20 border-blue-500/40 text-blue-200',
    description:
      '1-ci gecə oyanaraq bir-birini tanıyan və özəl gizli söhbət kanalını paylaşan iki kəndli.',
    winCondition:
      'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd komandası ilə qazanır.',
  },
  MEDIUM: {
    role: 'MEDIUM',
    name: 'Ruhçağıran (Medium)',
    nameAz: 'Ruhçağıran',
    nameEn: 'Medium',
    icon: '👻',
    faction: 'VILLAGE',
    colorClass: 'text-indigo-300',
    badgeBg: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200',
    description:
      'Gecə ölmüş oyunçularla Ruh Söhbətində danışa bilir və ölən oyunçunun əsl rolunu yoxlaya bilir (xüsusilə rollar gizli olduqda).',
    winCondition:
      'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd komandası ilə qazanır.',
  },
  FOX: {
    role: 'FOX',
    name: 'Tülkü (Fox)',
    nameAz: 'Tülkü',
    nameEn: 'Fox',
    icon: '🦊',
    faction: 'VILLAGE',
    colorClass: 'text-orange-300',
    badgeBg: 'bg-orange-500/20 border-orange-500/40 text-orange-200',
    description:
      'Gecə 3 yanaşı oyunçunu (hədəf + sağ və sol qonşuları) iyləyir; ən azı biri Canavardırsa öyrənir. Heç biri canavar deyilsə gücünü itirir.',
    winCondition:
      'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd komandası ilə qazanır.',
  },

  // ==========================================
  // B. CANAVARLAR / WEREWOLF TEAM (5 Roles)
  // ==========================================
  WEREWOLF: {
    role: 'WEREWOLF',
    name: 'Canavar (Werewolf)',
    nameAz: 'Canavar',
    nameEn: 'Werewolf',
    icon: '🐺',
    faction: 'WEREWOLF',
    colorClass: 'text-rose-400',
    badgeBg: 'bg-rose-500/20 border-rose-500/40 text-rose-200',
    description:
      'Hər gecə sürüsü ilə birlikdə oyanaraq bir qurbanı parçalamaq üçün səs verir.',
    winCondition:
      'Canavarların sayı qeyri-canavarlara bərabər və ya çox olduqda Canavar sürüsü qazanır.',
  },
  BIG_BAD_WOLF: {
    role: 'BIG_BAD_WOLF',
    name: 'Böyük Qara Canavar (Big Bad Wolf)',
    nameAz: 'Böyük Qara Canavar',
    nameEn: 'Big Bad Wolf',
    icon: '🐾',
    faction: 'WEREWOLF',
    colorClass: 'text-red-400',
    badgeBg: 'bg-red-600/25 border-red-500/50 text-red-200',
    description:
      'Normal canavar səsverməsindən əlavə hər gecə ikinci bir oyunçunu öldürə bilər (hər hansı bir canavar ölənə qədər).',
    winCondition:
      'Canavarların sayı qeyri-canavarlara bərabər və ya çox olduqda Canavar sürüsü qazanır.',
  },
  BLACK_WOLF: {
    role: 'BLACK_WOLF',
    name: 'Yoluxucu Ata Canavar (Infectious Wolf)',
    nameAz: 'Yoluxucu Ata Canavar',
    nameEn: 'Infectious Father of Wolves',
    icon: '🖤',
    faction: 'WEREWOLF',
    colorClass: 'text-red-300',
    badgeBg: 'bg-red-700/25 border-red-500/50 text-red-200',
    description:
      'Oyun boyu bir dəfə gecə canavarların hədəfini öldürmək əvəzinə yoluxduraraq gizlicə Canavara çevirə bilər.',
    winCondition:
      'Canavarların sayı qeyri-canavarlara bərabər və ya çox olduqda Canavar sürüsü qazanır.',
  },
  WOLF_SEER: {
    role: 'WOLF_SEER',
    name: 'Görücü Canavar (Wolf Seer)',
    nameAz: 'Görücü Canavar',
    nameEn: 'Wolf Seer',
    icon: '👁️‍🗨️',
    faction: 'WEREWOLF',
    colorClass: 'text-rose-300',
    badgeBg: 'bg-rose-600/25 border-rose-400/50 text-rose-100',
    description:
      'Sürü ilə birlikdə oyanır və hər gecə bir oyunçunu yoxlayaraq Kahin və ya Cadugər kimi hədəfləri tapır.',
    winCondition:
      'Canavarların sayı qeyri-canavarlara bərabər və ya çox olduqda Canavar sürüsü qazanır.',
  },
  WHITE_WOLF: {
    role: 'WHITE_WOLF',
    name: 'Ağ Canavar (White Werewolf)',
    nameAz: 'Ağ Canavar',
    nameEn: 'White Werewolf',
    icon: '🐻‍❄️',
    faction: 'NEUTRAL',
    colorClass: 'text-indigo-200',
    badgeBg: 'bg-indigo-500/25 border-indigo-400/50 text-indigo-100',
    description:
      'Digər canavarlara adi Canavar kimi görünür. Hər iki gecədən bir (cüt gecələr) digər bir Canavarı gizlicə öldürə bilər.',
    winCondition:
      'Yalnız oyunda sağ qalan sonuncu tək oyunçu olduqda təkbaşına qazanır.',
  },

  // ==========================================
  // C. NEYTRAL / SOLO & SPECIAL ROLES (5 Roles)
  // ==========================================
  THIEF: {
    role: 'THIEF',
    name: 'Oğru (Thief)',
    nameAz: 'Oğru',
    nameEn: 'Thief',
    icon: '🎭',
    faction: 'NEUTRAL',
    colorClass: 'text-amber-300',
    badgeBg: 'bg-amber-500/20 border-amber-500/40 text-amber-200',
    description:
      '1-ci gecə mərkəzdəki iki əlavə rol kartına baxır və birini seçərək rolunu dəyişir (kartlardan biri Canavardırsa seçməyə məcburdur).',
    winCondition: 'Seçdiyi yeni rolun komandası ilə qazanır.',
  },
  WILD_CHILD: {
    role: 'WILD_CHILD',
    name: 'Vəhşi Uşaq (Wild Child)',
    nameAz: 'Vəhşi Uşaq',
    nameEn: 'Wild Child',
    icon: '🐾',
    faction: 'VILLAGE',
    colorClass: 'text-lime-300',
    badgeBg: 'bg-lime-500/20 border-lime-500/40 text-lime-200',
    description:
      '1-ci gecə özünə bir Kumir (Role Model) seçir. Kumiri sağ ikən Kənd komandasındadır; Kumiri ölərsə dərhal Canavara çevrilir!',
    winCondition:
      'Çevrilməzdən əvvəl Kəndlə, çevrildikdən sonra isə Canavarlarla qazanır.',
  },
  JESTER: {
    role: 'JESTER',
    name: 'Təlxək / Dəli (Jester)',
    nameAz: 'Təlxək / Dəli',
    nameEn: 'Jester / Fool',
    icon: '🃏',
    faction: 'NEUTRAL',
    colorClass: 'text-yellow-300',
    badgeBg: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-200',
    description:
      'Təkbaşına oynayan neytral rol; kəndi aldadaraq gündüz səsverməsində özünü edam etdirərsə dərhal tək qalib olur!',
    winCondition: 'Gündüz kənd səsverməsi ilə edam edilmək.',
  },
  SERIAL_KILLER: {
    role: 'SERIAL_KILLER',
    name: 'Zərbəçi / Qatil (Serial Killer)',
    nameAz: 'Zərbəçi / Qatil',
    nameEn: 'Serial Killer',
    icon: '🗡️',
    faction: 'NEUTRAL',
    colorClass: 'text-fuchsia-400',
    badgeBg: 'bg-fuchsia-600/25 border-fuchsia-400/50 text-fuchsia-100',
    description:
      'Hər gecə müstəqil olaraq bir hədəfi aradan götürən tək qatil. Mühafizəçi onu dayandıra bilmir.',
    winCondition:
      'Yalnız oyunda sağ qalan sonuncu tək oyunçu olduqda təkbaşına qazanır.',
  },
  MAYOR: {
    role: 'MAYOR',
    name: 'Bələdiyyə Başçısı / Şerif (Mayor)',
    nameAz: 'Bələdiyyə Başçısı / Şerif',
    nameEn: 'Mayor / Sheriff',
    icon: '🎖️',
    faction: 'VILLAGE',
    colorClass: 'text-amber-200',
    badgeBg: 'bg-amber-500/25 border-amber-400/50 text-amber-100',
    description:
      'Gündüz səsverməsində səsi 2 səs kimi hesablanır və səs bərabərliklərini həll edir. Öldükdə nişanı sağ qalan oyunçuya ötürülür.',
    winCondition:
      'Bütün Canavarlar və qatil neytrallar zərərsizləşdirildikdə Kənd komandası ilə qazanır.',
  },
  ANGEL: {
    role: 'ANGEL',
    name: 'Mələk (Angel)',
    nameAz: 'Mələk',
    nameEn: 'Angel',
    icon: '👼',
    faction: 'NEUTRAL',
    colorClass: 'text-yellow-300',
    badgeBg: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-200',
    description:
      '1-ci gün kənd tərəfindən səsvermə ilə edam edilərsə dərhal qazanır, sağ qalarsa adi Kəndliyə çevrilir.',
    winCondition: '1-ci gün səsvermə ilə edam edilmək.',
  },
};

export function getFactionGroupRoles(faction: Faction): RoleType[] {
  if (faction === 'VILLAGE') return VILLAGE_ROLES;
  if (faction === 'WEREWOLF') return WEREWOLF_ROLES;
  return NEUTRAL_ROLES;
}
