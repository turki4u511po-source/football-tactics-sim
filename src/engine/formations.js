// ===========================================================================
// formations.js — normalized formation templates.
//   nx: 0 = own goal line .. 1 = halfway line   (depth in own half)
//   ny: 0 = one touchline  .. 1 = other touchline (width)
// World.placeTeam() maps these into pitch meters and mirrors for the away side.
// ===========================================================================

export const FORMATIONS = {
  '4-3-3': [
    { role: 'GK', nx: 0.04, ny: 0.50, isGK: true },
    { role: 'RB', nx: 0.24, ny: 0.16 },
    { role: 'RCB', nx: 0.15, ny: 0.38 },
    { role: 'LCB', nx: 0.15, ny: 0.62 },
    { role: 'LB', nx: 0.24, ny: 0.84 },
    { role: 'RCM', nx: 0.46, ny: 0.30 },
    { role: 'CM', nx: 0.42, ny: 0.50 },
    { role: 'LCM', nx: 0.46, ny: 0.70 },
    { role: 'RW', nx: 0.74, ny: 0.18 },
    { role: 'ST', nx: 0.82, ny: 0.50 },
    { role: 'LW', nx: 0.74, ny: 0.82 },
  ],
  '4-4-2': [
    { role: 'GK', nx: 0.04, ny: 0.50, isGK: true },
    { role: 'RB', nx: 0.24, ny: 0.16 },
    { role: 'RCB', nx: 0.15, ny: 0.38 },
    { role: 'LCB', nx: 0.15, ny: 0.62 },
    { role: 'LB', nx: 0.24, ny: 0.84 },
    { role: 'RM', nx: 0.50, ny: 0.18 },
    { role: 'RCM', nx: 0.44, ny: 0.42 },
    { role: 'LCM', nx: 0.44, ny: 0.58 },
    { role: 'LM', nx: 0.50, ny: 0.82 },
    { role: 'RST', nx: 0.80, ny: 0.40 },
    { role: 'LST', nx: 0.80, ny: 0.60 },
  ],
  '4-2-3-1': [
    { role: 'GK', nx: 0.04, ny: 0.50, isGK: true },
    { role: 'RB', nx: 0.24, ny: 0.16 },
    { role: 'RCB', nx: 0.15, ny: 0.38 },
    { role: 'LCB', nx: 0.15, ny: 0.62 },
    { role: 'LB', nx: 0.24, ny: 0.84 },
    { role: 'RDM', nx: 0.40, ny: 0.38 },
    { role: 'LDM', nx: 0.40, ny: 0.62 },
    { role: 'RAM', nx: 0.66, ny: 0.20 },
    { role: 'CAM', nx: 0.68, ny: 0.50 },
    { role: 'LAM', nx: 0.66, ny: 0.80 },
    { role: 'ST', nx: 0.84, ny: 0.50 },
  ],
  '4-1-4-1': [
    { role: 'GK', nx: 0.04, ny: 0.5, isGK: true },
    { role: 'RB', nx: 0.24, ny: 0.16 },
    { role: 'RCB', nx: 0.15, ny: 0.38 },
    { role: 'LCB', nx: 0.15, ny: 0.62 },
    { role: 'LB', nx: 0.24, ny: 0.84 },
    { role: 'DM', nx: 0.36, ny: 0.5 },
    { role: 'RM', nx: 0.56, ny: 0.16 },
    { role: 'RCM', nx: 0.52, ny: 0.4 },
    { role: 'LCM', nx: 0.52, ny: 0.6 },
    { role: 'LM', nx: 0.56, ny: 0.84 },
    { role: 'ST', nx: 0.82, ny: 0.5 },
  ],
  '3-5-2': [
    { role: 'GK', nx: 0.04, ny: 0.5, isGK: true },
    { role: 'RCB', nx: 0.15, ny: 0.3 },
    { role: 'CB', nx: 0.12, ny: 0.5 },
    { role: 'LCB', nx: 0.15, ny: 0.7 },
    { role: 'RWB', nx: 0.42, ny: 0.1 },
    { role: 'LWB', nx: 0.42, ny: 0.9 },
    { role: 'RCM', nx: 0.44, ny: 0.34 },
    { role: 'CM', nx: 0.4, ny: 0.5 },
    { role: 'LCM', nx: 0.44, ny: 0.66 },
    { role: 'RST', nx: 0.8, ny: 0.42 },
    { role: 'LST', nx: 0.8, ny: 0.58 },
  ],
  '3-4-2-1': [
    { role: 'GK', nx: 0.04, ny: 0.5, isGK: true },
    { role: 'RCB', nx: 0.15, ny: 0.32 },
    { role: 'CB', nx: 0.12, ny: 0.5 },
    { role: 'LCB', nx: 0.15, ny: 0.68 },
    { role: 'RWB', nx: 0.44, ny: 0.12 },
    { role: 'LWB', nx: 0.44, ny: 0.88 },
    { role: 'RCM', nx: 0.45, ny: 0.4 },
    { role: 'LCM', nx: 0.45, ny: 0.6 },
    { role: 'RAM', nx: 0.68, ny: 0.34 },
    { role: 'LAM', nx: 0.68, ny: 0.66 },
    { role: 'ST', nx: 0.84, ny: 0.5 },
  ],
};

export const DEFAULT_FORMATION = '4-3-3';
