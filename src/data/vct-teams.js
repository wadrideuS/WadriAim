// Official partner list announced for 2027, checked 2026-10-23.
// https://valorantesports.com/en-US/valorantesports/partner-teams
// Theme colors are subdued interpretations of each team's branding.
export const vctRegions = [
  ['americas', 'Américas'],
  ['emea', 'EMEA'],
  ['pacific', 'Pacífico'],
  ['china', 'China'],
];
const groups = {
  americas: [
    ['100t', '100 Thieves', '100T', '#d63843'],
    ['g2', 'G2 Esports', 'G2', '#ff173d'],
    ['kru', 'KRÜ Visa', 'KRÜ', '#ff4b92'],
    ['lev', 'Leviatán Esports', 'LEV', '#4bbcd3'],
    ['loud', 'LOUD', 'LOUD', '#55cf83'],
    ['mibr', 'MIBR', 'MIBR', '#c8aa68'],
    ['nrg', 'NRG', 'NRG', '#d78b50'],
    ['sen', 'Sentinels', 'SEN', '#e6485c'],
  ],
  emea: [
    ['bbl', 'BBL Esports', 'BBL', '#d5b443'],
    ['fnc', 'FNATIC', 'FNC', '#ff7900'],
    ['fut', 'FUT Esports', 'FUT', '#d94e62'],
    ['m8', 'Gentle Mates', 'M8', '#b58de3'],
    ['kc', 'Karmine Corp', 'KC', '#54a6df'],
    ['th', 'Team Heretics', 'TH', '#d5b46b'],
    ['tl', 'Team Liquid', 'TL', '#608bbc'],
    ['vit', 'Team Vitality', 'VIT', '#e2bc55'],
  ],
  pacific: [
    ['cr', 'Crazy Raccoon', 'CR', '#d65366'],
    ['fs', 'FULL SENSE', 'FS', '#df716c'],
    ['gam', 'GAM Esports', 'GAM', '#d7b54a'],
    ['geng', 'Gen.G', 'GEN', '#c7ac65'],
    ['prx', 'Paper Rex', 'PRX', '#e681a7'],
    ['rrq', 'Rex Regum Qeon', 'RRQ', '#d8af53'],
    ['t1', 'T1', 'T1', '#dd5364'],
    ['zeta', 'ZETA DIVISION', 'ZETA', '#b4c2a6'],
  ],
  china: [
    ['ag', 'ALL GAMERS', 'AG', '#da5368'],
    ['blg', 'Bilibili Gaming', 'BLG', '#ef87b9'],
    ['edg', 'EDWARD Gaming', 'EDG', '#c6d0dc'],
    ['jdg', 'JD GAMING', 'JDG', '#de5b72'],
    ['te', 'Trace Esports', 'TE', '#af89da'],
    ['tyloo', 'TYLOO GAMING', 'TYL', '#e36e51'],
    ['wbg', 'Weibo Gaming', 'WBG', '#dc8455'],
    ['xlg', 'Xi Lai Gaming', 'XLG', '#a18bd7'],
  ],
};
export const vctTeams = Object.entries(groups).flatMap(([region, teams]) =>
  teams.map(([id, name, tag, color]) => ({ id, name, tag, color, region })),
);
export function teamById(id) {
  return vctTeams.find((team) => team.id === id) || null;
}
function mix(a, b, amount) {
  return (
    '#' +
    [1, 3, 5]
      .map((i) =>
        Math.round(
          parseInt(a.slice(i, i + 2), 16) * (1 - amount) + parseInt(b.slice(i, i + 2), 16) * amount,
        )
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
export function teamPalette(team) {
  if (team.id === 'prx') return {label:'VCT · PRX',accent:'#ed8cc4',secondary:'#4279df',bg:'#070b17',panel:'#111b35',arena:'#0c1630',floor:'#1b2d4c'};
  if (team.id === 'g2')
    return {
      label: 'VCT · G2',
      accent: '#ff173d',
      secondary: '#bb0c2b',
      bg: '#050505',
      panel: '#111112',
      arena: '#090909',
      floor: '#202023',
    };
  if (team.id === 'fnc')
    return {
      label: 'VCT · FNC',
      accent: '#ff7900',
      secondary: '#ffae4c',
      bg: '#080706',
      panel: '#17120e',
      arena: '#100d0a',
      floor: '#27201a',
    };
  if (team.id === 'blg')
    return {
      label: 'VCT · BLG',
      accent: '#ed8fba',
      secondary: '#86c9e4',
      bg: '#0a0b10',
      panel: '#191724',
      arena: '#11131e',
      floor: '#252938',
    };
  return {
    label: `VCT · ${team.tag}`,
    accent: mix(team.color, '#bfc5ce', 0.2),
    bg: mix('#090a0d', team.color, 0.045),
    panel: mix('#17191e', team.color, 0.065),
    arena: mix('#101218', team.color, 0.055),
    floor: mix('#23262d', team.color, 0.075),
  };
}
export const teamPalettes = Object.fromEntries(
  vctTeams.map((team) => ['team-' + team.id, teamPalette(team)]),
);
