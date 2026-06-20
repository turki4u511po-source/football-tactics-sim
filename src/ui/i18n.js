// ===========================================================================
// i18n.js — bilingual labels (Arabic-first, English tactical terms).
// Phase 1 covers the shell + controls + HUD; tactical vocabulary grows with
// each later phase. `t(key, lang)` returns the string for the active language.
// ===========================================================================

export const DICT = {
  title: { ar: 'محاكي التكتيك الكروي', en: 'Football Tactics Simulator' },
  phaseTag: { ar: 'محاكاة تكتيكية — أندية حقيقية وذكاء متكيّف', en: 'Tactical sim — real clubs & adaptive AI' },

  play: { ar: 'تشغيل', en: 'Play' },
  pause: { ar: 'إيقاف', en: 'Pause' },
  restart: { ar: 'ضربة البداية', en: 'Kickoff' },
  speed: { ar: 'السرعة', en: 'Speed' },
  seed: { ar: 'البذرة', en: 'Seed' },
  apply: { ar: 'تطبيق', en: 'Apply' },
  numbers: { ar: 'الأرقام', en: 'Numbers' },
  shape: { ar: 'الشكل', en: 'Shape' },
  language: { ar: 'English', en: 'العربية' }, // label shows the OTHER language

  kickoff: { ar: 'ضربة البداية', en: 'Kickoff' },
  inPlay: { ar: 'الكرة في اللعب', en: 'In play' },
  halftimeLbl: { ar: 'الاستراحة', en: 'Half-time' },
  fulltimeLbl: { ar: 'انتهت المباراة', en: 'Full time' },
  possession: { ar: 'الاستحواذ', en: 'Possession' },

  // Phase 4 — live control & management
  tactics: { ar: 'التكتيك', en: 'Tactics' },
  close: { ar: 'إغلاق', en: 'Close' },
  step: { ar: 'خطوة', en: 'Step' },
  teamShape: { ar: 'الشكل والتعليمات', en: 'Shape & Instructions' },
  subsTitle: { ar: 'التبديلات', en: 'Substitutions' },
  manMarkTitle: { ar: 'الرقابة اللصيقة', en: 'Man-marking' },
  subBtn: { ar: 'تبديل', en: 'Sub' },
  none: { ar: 'بدون', en: 'None' },
  stamina: { ar: 'اللياقة', en: 'Fitness' },
  bench: { ar: 'دكة البدلاء', en: 'Bench' },
  subsLeft: { ar: 'المتبقي', en: 'left' },

  // Phase 8 — season / career
  season: { ar: 'الموسم', en: 'Season' },
  startSeason: { ar: 'ابدأ الموسم', en: 'Start season' },
  matchday: { ar: 'الجولة', en: 'Matchday' },
  playMatch: { ar: 'العب مباراتك', en: 'Play your match' },
  simMatchday: { ar: 'حاكِ الجولة', en: 'Simulate round' },
  autoSim: { ar: 'حاكِ حتى النهاية', en: 'Sim to end' },
  newSeason: { ar: 'موسم جديد', en: 'New season' },
  leagueTable: { ar: 'جدول الدوري', en: 'League table' },
  recentResults: { ar: 'آخر النتائج', en: 'Latest results' },
  formLbl: { ar: 'الأداء', en: 'Form' },
  fatigueLbl: { ar: 'الإرهاق', en: 'Fatigue' },
  seasonOver: { ar: 'انتهى الموسم — البطل', en: 'Season over — champion' },
  vs: { ar: 'ضد', en: 'vs' },
  nextFixture: { ar: 'مباراتك القادمة', en: 'Your next match' },

  // Phase 7 — modes, what-if, lab
  lab: { ar: 'المختبر (ماذا لو)', en: 'Lab (what-if)' },
  whatif: { ar: 'إعادة «ماذا لو» ببذرة ثابتة', en: 'Seeded what-if A/B' },
  whatifHint: {
    ar: 'يُعيد المباراة مرتين بنفس البذرة مع تغيير إعداد واحد فقط، ويعرض الفرق.',
    en: 'Re-runs the match twice on the same seed with one setting changed, and diffs the result.',
  },
  runAB: { ar: 'شغّل A/B', en: 'Run A/B' },
  archTitle: { ar: 'اختبر ضد النماذج', en: 'Test vs archetypes' },
  archHint: {
    ar: 'يشغّل تكتيكك ضد طيف من الأندية (بلوك أتلتيكو، خط برشلونة العالي، ضغط سان جيرمان…).',
    en: "Runs your tactic against a spectrum of clubs (Atlético's block, Barça's high line, PSG's press…).",
  },
  runArch: { ar: 'شغّل', en: 'Run' },
  scenario: { ar: 'السيناريو', en: 'Scenario' },
  challengeWon: { ar: '✓ نجحت في التحدي', en: '✓ Challenge passed' },
  challengeLost: { ar: '✗ فشلت في التحدي', en: '✗ Challenge failed' },

  // Phase 6 — clubs + adaptive AI
  yourClub: { ar: 'فريقك', en: 'Your club' },
  opponent: { ar: 'الخصم', en: 'Opponent' },
  difficulty: { ar: 'الصعوبة', en: 'Difficulty' },
  adaptiveAI: { ar: 'ذكاء متكيّف', en: 'Adaptive AI' },
  custom: { ar: 'مخصّص (أزرق)', en: 'Custom (Blue)' },
  customAway: { ar: 'مخصّص (أحمر)', en: 'Custom (Red)' },
  diff_easy: { ar: 'سهل', en: 'Easy' },
  diff_normal: { ar: 'عادي', en: 'Normal' },
  diff_hard: { ar: 'صعب', en: 'Hard' },
  apply2: { ar: 'ابدأ المباراة', en: 'Start match' },

  // Phase 5 — analytics
  analytics: { ar: 'التحليلات', en: 'Analytics' },
  heatmap: { ar: 'الخريطة الحرارية', en: 'Heatmap' },
  shotMap: { ar: 'خريطة التسديد', en: 'Shot map' },
  passNetwork: { ar: 'شبكة التمرير', en: 'Pass network' },
  momentum: { ar: 'الزخم (xG تراكمي)', en: 'Momentum (cumulative xG)' },
  insightsTitle: { ar: 'قراءة المباراة', en: 'Match insights' },
  statsTitle: { ar: 'الإحصائيات', en: 'Statistics' },
  exportJson: { ar: 'تصدير JSON', en: 'Export JSON' },
  exportPng: { ar: 'تصدير صورة', en: 'Export image' },
  st_poss: { ar: 'الاستحواذ %', en: 'Possession %' },
  st_shots: { ar: 'التسديدات', en: 'Shots' },
  st_sot: { ar: 'على المرمى', en: 'On target' },
  st_xg: { ar: 'xG', en: 'xG' },
  st_xt: { ar: 'xT (تهديد)', en: 'xT (threat)' },
  st_passes: { ar: 'التمريرات', en: 'Passes' },
  st_passpct: { ar: 'دقة التمرير %', en: 'Pass %' },
  st_int: { ar: 'القطع', en: 'Interceptions' },
  st_tackles: { ar: 'التدخلات', en: 'Tackles' },
  st_corners: { ar: 'الركنيات', en: 'Corners' },
  st_fouls: { ar: 'الأخطاء', en: 'Fouls' },
  st_ppda: { ar: 'PPDA (ضغط)', en: 'PPDA' },

  // setting names (bilingual; option values stay as English tactical terms)
  s_formation: { ar: 'التشكيل', en: 'Formation' },
  s_mentality: { ar: 'العقلية', en: 'Mentality' },
  s_playstyle: { ar: 'أسلوب اللعب', en: 'Play style' },
  s_pressing: { ar: 'الضغط', en: 'Pressing' },
  s_line: { ar: 'خط الدفاع', en: 'Defensive line' },
  s_width: { ar: 'العرض', en: 'Width' },
  s_tempo: { ar: 'الإيقاع', en: 'Tempo' },
  s_buildup: { ar: 'البناء', en: 'Build-up' },
  s_focus: { ar: 'محور الهجوم', en: 'Attacking focus' },

  hint: {
    ar: 'انقر «تشغيل». غيّر البذرة وأعد التشغيل بنفس القيمة لتطابق المباراة تمامًا.',
    en: 'Click Play. Re-run the same seed to reproduce the match exactly.',
  },
};

export function t(key, lang = 'ar') {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[lang] ?? entry.ar;
}

// Prettify an English tactical option value for display.
export function optLabel(v) {
  const map = { veryhigh: 'Very High', gegenpress: 'Gegenpress' };
  return map[v] || v.charAt(0).toUpperCase() + v.slice(1);
}
