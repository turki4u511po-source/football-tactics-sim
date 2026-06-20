// ===========================================================================
// clubs.js — 17 selectable real clubs (2025-26 identities) encoded as a tactics
// preset + an overall rating + a one-line signature. Used as the player's team
// and as opponent archetypes. Star names are illustrative role anchors only.
// ===========================================================================

const c = (name, tactics, rating, sig) => ({ name, tactics, rating, signature: sig });

export const CLUBS = {
  // 🇸🇦 Saudi Pro League
  'al-hilal': c({ ar: 'الهلال', en: 'Al-Hilal' },
    { formation: '3-5-2', mentality: 'attacking', playstyle: 'possession', pressing: 'mid', line: 'normal', width: 'wide', tempo: 'normal', buildup: 'short', focus: 'balanced' },
    0.86, { ar: 'أجنحة ظهير عريضة وتحولات عمودية قاتلة.', en: 'Wing-back width and lethal vertical transitions.' }),
  'al-nassr': c({ ar: 'النصر', en: 'Al-Nassr' },
    { formation: '4-2-3-1', mentality: 'attacking', playstyle: 'possession', pressing: 'high', line: 'high', width: 'wide', tempo: 'high', buildup: 'mixed', focus: 'balanced' },
    0.85, { ar: 'استحواذ عمودي يغذّي مهاجمًا صريحًا.', en: 'Vertical possession feeding a poacher.' }),
  'al-ahli': c({ ar: 'الأهلي', en: 'Al-Ahli' },
    { formation: '4-2-3-1', mentality: 'attacking', playstyle: 'counter', pressing: 'gegenpress', line: 'high', width: 'balanced', tempo: 'high', buildup: 'mixed', focus: 'balanced' },
    0.83, { ar: 'ضغط عالٍ وتحولات سريعة؛ تتراجع لياقته متأخرًا.', en: 'High press, fast transitions; fades late.' }),
  'al-ittihad': c({ ar: 'الاتحاد', en: 'Al-Ittihad' },
    { formation: '4-2-3-1', mentality: 'attacking', playstyle: 'direct', pressing: 'high', line: 'high', width: 'wide', tempo: 'high', buildup: 'mixed', focus: 'balanced' },
    0.83, { ar: 'شدّة بدنية وإيقاع عالٍ وضغط عدائي.', en: 'High-intensity, high-tempo, aggressive press.' }),
  'al-qadsiah': c({ ar: 'القادسية', en: 'Al-Qadsiah' },
    { formation: '4-3-3', mentality: 'balanced', playstyle: 'possession', pressing: 'mid', line: 'normal', width: 'balanced', tempo: 'normal', buildup: 'short', focus: 'balanced' },
    0.79, { ar: 'بناء صبور واستحواذ ومهاجمون فتّاكون.', en: 'Patient possession, clinical strikers.' }),

  // 🏴 England
  'man-city': c({ ar: 'مانشستر سيتي', en: 'Man City' },
    { formation: '4-3-3', mentality: 'attacking', playstyle: 'possession', pressing: 'high', line: 'high', width: 'wide', tempo: 'high', buildup: 'short', focus: 'balanced', invertedFB: true },
    0.93, { ar: 'ظهير مقلوب ولعب مكاني وسيطرة على الكرة.', en: 'Inverted full-back, positional play, control.' }),
  'arsenal': c({ ar: 'آرسنال', en: 'Arsenal' },
    { formation: '4-3-3', mentality: 'attacking', playstyle: 'possession', pressing: 'high', line: 'high', width: 'wide', tempo: 'normal', buildup: 'short', focus: 'balanced' },
    0.91, { ar: 'تحكّم مكاني، دفاع قوي، وتهديد كرات ثابتة.', en: 'Positional control, strong defence, set-piece threat.' }),
  'liverpool': c({ ar: 'ليفربول', en: 'Liverpool' },
    { formation: '4-2-3-1', mentality: 'attacking', playstyle: 'balanced', pressing: 'high', line: 'high', width: 'wide', tempo: 'high', buildup: 'mixed', focus: 'balanced' },
    0.9, { ar: 'تحولات سريعة وأظهرة مهاجمة وضغط حادّ.', en: 'Quick transitions, attacking full-backs, hard press.' }),
  'man-utd': c({ ar: 'مانشستر يونايتد', en: 'Man Utd' },
    { formation: '3-4-2-1', mentality: 'balanced', playstyle: 'direct', pressing: 'mid', line: 'normal', width: 'wide', tempo: 'normal', buildup: 'mixed', focus: 'balanced' },
    0.85, { ar: 'نظام دفاع ثلاثي وأجنحة ظهير وصانع في الجيب.', en: 'Back-three, wing-backs, a creator in the pocket.' }),
  'chelsea': c({ ar: 'تشيلسي', en: 'Chelsea' },
    { formation: '4-2-3-1', mentality: 'balanced', playstyle: 'possession', pressing: 'high', line: 'high', width: 'wide', tempo: 'normal', buildup: 'short', focus: 'balanced', invertedFB: true },
    0.86, { ar: 'استحواذ مكاني صبور؛ يتعثّر أمام البلوك المنخفض.', en: 'Patient positional possession; struggles vs a low block.' }),
  'tottenham': c({ ar: 'توتنهام', en: 'Tottenham' },
    { formation: '4-3-3', mentality: 'balanced', playstyle: 'counter', pressing: 'mid', line: 'normal', width: 'balanced', tempo: 'normal', buildup: 'mixed', focus: 'balanced' },
    0.84, { ar: 'بلوك منظّم، كرات ثابتة، وتحولات ذكية.', en: 'Organised block, set-pieces, smart transitions.' }),

  // 🇪🇸 Spain
  'real-madrid': c({ ar: 'ريال مدريد', en: 'Real Madrid' },
    { formation: '4-2-3-1', mentality: 'attacking', playstyle: 'balanced', pressing: 'mid', line: 'high', width: 'wide', tempo: 'high', buildup: 'mixed', focus: 'balanced' },
    0.92, { ar: 'تقدّم عمودي وأظهرة متداخلة وأفراد مميّزون.', en: 'Vertical progression, overlaps, individual brilliance.' }),
  'barcelona': c({ ar: 'برشلونة', en: 'Barcelona' },
    { formation: '4-2-3-1', mentality: 'attacking', playstyle: 'possession', pressing: 'gegenpress', line: 'veryhigh', width: 'wide', tempo: 'high', buildup: 'short', focus: 'balanced' },
    0.9, { ar: 'خط دفاع مرتفع جدًا ومصيدة تسلّل — مساحة خلفه نقطة ضعفه.', en: 'Extreme high line + offside trap — space in behind is the weakness.' }),
  'atletico': c({ ar: 'أتلتيكو مدريد', en: 'Atlético' },
    { formation: '4-4-2', mentality: 'defensive', playstyle: 'counter', pressing: 'low', line: 'deep', width: 'narrow', tempo: 'normal', buildup: 'mixed', focus: 'balanced' },
    0.87, { ar: 'بلوك منخفض منضبط، صعب الاختراق، قاتل على الهجمة المرتدة.', en: 'Disciplined low block, brutally hard to break, lethal on the counter.' }),

  // 🇫🇷 France
  'psg': c({ ar: 'باريس سان جيرمان', en: 'PSG' },
    { formation: '4-3-3', mentality: 'attacking', playstyle: 'possession', pressing: 'gegenpress', line: 'high', width: 'wide', tempo: 'high', buildup: 'short', focus: 'balanced' },
    0.92, { ar: 'استحواذ مكاني وضغط مضاد خانق وثلاثي مراوغ.', en: 'Positional possession, suffocating counter-press, dribblers.' }),

  // 🇩🇪 Germany
  'bayern': c({ ar: 'بايرن ميونخ', en: 'Bayern' },
    { formation: '4-2-3-1', mentality: 'attacking', playstyle: 'possession', pressing: 'high', line: 'high', width: 'wide', tempo: 'high', buildup: 'short', focus: 'balanced' },
    0.91, { ar: 'سيطرة على الكرة وضغط عدائي ومهاجم يصنع ويسجّل.', en: 'Ball dominance, aggressive press, a deep-dropping #9.' }),
  'dortmund': c({ ar: 'بوروسيا دورتموند', en: 'Dortmund' },
    { formation: '3-4-2-1', mentality: 'balanced', playstyle: 'counter', pressing: 'high', line: 'normal', width: 'wide', tempo: 'high', buildup: 'mixed', focus: 'balanced' },
    0.85, { ar: 'دفاع ثلاثي متين وتحولات عمودية سريعة.', en: 'Solid back three, fast vertical transitions.' }),
};

// stable ordered id list (for menus)
export const CLUB_IDS = Object.keys(CLUBS);
