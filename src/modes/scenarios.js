// ===========================================================================
// modes/scenarios.js — Scenario / Challenge mode: drop into a pre-set situation
// with a win condition (evaluated from the player's = home team's perspective).
// ===========================================================================

export const SCENARIOS = {
  none: {
    name: { ar: 'بدون (مباراة عادية)', en: 'None (normal match)' },
    desc: { ar: '', en: '' },
  },
  comeback: {
    name: { ar: 'العودة من الخلف', en: 'Comeback' },
    desc: { ar: 'أنت متأخر ٠-١ وبقي ٢٠ دقيقة. تعادل أو افز.', en: 'Down 0-1 with 20 minutes left. Draw or win.' },
    setup: { startClock: 70 * 60, score: { home: 0, away: 1 } },
    win: (w) => ({ met: w.score.home >= w.score.away, text: { ar: 'عُدت في المباراة!', en: 'You rescued it!' } }),
  },
  tenmen: {
    name: { ar: 'بعشرة لاعبين', en: 'Down to 10 men' },
    desc: { ar: 'طُرد أحد لاعبيك. لا تخسر المباراة.', en: 'You have a man sent off. Avoid defeat.' },
    setup: { redCard: 'home', score: { home: 0, away: 0 } },
    win: (w) => ({ met: w.score.home >= w.score.away, text: { ar: 'صمدت بعشرة!', en: 'You held on with 10!' } }),
  },
  holdlead: {
    name: { ar: 'حافظ على التقدّم', en: 'Protect the lead' },
    desc: { ar: 'تتقدّم ١-٠ وبقي ١٥ دقيقة. احمِ النتيجة.', en: 'Leading 1-0 with 15 minutes left. See it out.' },
    setup: { startClock: 75 * 60, score: { home: 1, away: 0 } },
    win: (w) => ({ met: w.score.home > w.score.away, text: { ar: 'حميت التقدّم!', en: 'Lead protected!' } }),
  },
  parkedbus: {
    name: { ar: 'اكسر الحافلة', en: 'Break the parked bus' },
    desc: { ar: 'الخصم يدافع بعمق شديد (أتلتيكو). يجب أن تفوز.', en: 'A deep, disciplined block (Atlético). You must win.' },
    setup: { awayClubId: 'atletico', score: { home: 0, away: 0 } },
    win: (w) => ({ met: w.score.home > w.score.away, text: { ar: 'كسرت الحافلة!', en: 'Bus broken!' } }),
  },
};

export const SCENARIO_IDS = Object.keys(SCENARIOS);
