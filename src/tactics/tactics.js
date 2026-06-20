// ===========================================================================
// tactics/tactics.js — the tactical model (pure data) + the mapping from
// human settings to numeric behaviour parameters the engine reads ("tuning").
// This is where §3 (settings) and §5 (principles) become numbers; simulation.js
// consumes `tuning` so every setting visibly changes how the dots behave.
// ===========================================================================

export const OPTIONS = {
  formation: ['4-3-3', '4-4-2', '4-2-3-1'],
  mentality: ['defensive', 'balanced', 'attacking'],
  playstyle: ['possession', 'balanced', 'counter', 'direct'],
  pressing: ['low', 'mid', 'high', 'gegenpress'],
  line: ['deep', 'normal', 'high', 'veryhigh'],
  width: ['narrow', 'balanced', 'wide'],
  tempo: ['slow', 'normal', 'high'],
  buildup: ['short', 'mixed', 'long'],
  focus: ['left', 'middle', 'right', 'balanced'],
};

export function defaultTactics() {
  return {
    formation: '4-3-3',
    mentality: 'balanced',
    playstyle: 'balanced',
    pressing: 'mid',
    line: 'normal',
    width: 'balanced',
    tempo: 'normal',
    buildup: 'mixed',
    focus: 'balanced',
    invertedFB: false, // inverted full-backs tuck into midfield in possession
  };
}

// Map the settings to engine numbers. Keep this transparent and tunable.
export function derive(t) {
  const lineHeight = { deep: 0.17, normal: 0.28, high: 0.4, veryhigh: 0.5 }[t.line];
  return {
    lineHeight,
    lineBase: lineHeight * 105, // back-line distance from own goal (m)
    pressRange: { low: 30, mid: 46, high: 80, gegenpress: 96 }[t.pressing], // how far up they engage
    gegen: t.pressing === 'gegenpress',
    pressHard: t.pressing === 'high' || t.pressing === 'gegenpress',
    tempoMul: { slow: 1.35, normal: 1.0, high: 0.72 }[t.tempo], // decision-interval scale
    attackPush: { defensive: 6, balanced: 13, attacking: 22 }[t.mentality], // m pushed up in possession
    restDefenders: { defensive: 5, balanced: 4, attacking: 3 }[t.mentality],
    widthBias: { narrow: 0.6, balanced: 1.0, wide: 1.32 }[t.width], // attacking y spread from centre
    defWidthBias: { narrow: 0.5, balanced: 0.78, wide: 0.98 }[t.width], // compactness when defending
    directness: { possession: 0.18, balanced: 0.45, counter: 0.72, direct: 0.92 }[t.playstyle],
    buildupLong: { short: 0.0, mixed: 0.45, long: 1.0 }[t.buildup],
    counter: t.playstyle === 'counter',
    shootEager: { possession: 0.85, balanced: 1.0, counter: 1.12, direct: 1.05 }[t.playstyle],
    focus: t.focus,
    invertedFB: !!t.invertedFB,
  };
}

// Vertical "line" a role belongs to: 0 defence, 1 midfield, 2 attack.
export function roleLayer(role) {
  if (/GK/.test(role)) return -1;
  if (/(CB|RB|LB|WB)$/.test(role) || /(CB|RB|LB|WB)/.test(role)) return 0;
  if (/(RW|LW|ST|CF|RST|LST)/.test(role)) return 2;
  if (/AM/.test(role)) return 1.7; // attacking midfielders play between the lines
  return 1; // CM / DM / wide mids
}

export function isFullback(role) {
  return /(RB|LB|RWB|LWB)/.test(role);
}
