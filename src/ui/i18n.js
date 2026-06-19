// ===========================================================================
// i18n.js — bilingual labels (Arabic-first, English tactical terms).
// Phase 1 covers the shell + controls + HUD; tactical vocabulary grows with
// each later phase. `t(key, lang)` returns the string for the active language.
// ===========================================================================

export const DICT = {
  title: { ar: 'محاكي التكتيك الكروي', en: 'Football Tactics Simulator' },
  phaseTag: { ar: 'المرحلة ١ — الملعب والحركة', en: 'Phase 1 — Pitch & Motion' },

  play: { ar: 'تشغيل', en: 'Play' },
  pause: { ar: 'إيقاف', en: 'Pause' },
  restart: { ar: 'ضربة البداية', en: 'Kickoff' },
  speed: { ar: 'السرعة', en: 'Speed' },
  seed: { ar: 'البذرة', en: 'Seed' },
  apply: { ar: 'تطبيق', en: 'Apply' },
  numbers: { ar: 'الأرقام', en: 'Numbers' },
  language: { ar: 'English', en: 'العربية' }, // label shows the OTHER language

  kickoff: { ar: 'ضربة البداية', en: 'Kickoff' },
  inPlay: { ar: 'الكرة في اللعب', en: 'In play' },
  possession: { ar: 'الاستحواذ', en: 'Possession' },

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
