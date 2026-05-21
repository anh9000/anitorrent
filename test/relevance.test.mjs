// Relevance test harness. Runs diverse anime with realistic full AniList title
// sets (native + foreign synonyms, native-first to stress title selection)
// against the live nyaa source. Asserts: non-zero results AND zero off-show
// contamination. Run with: npm test
//
// Network test (hits nyaa.si). Exits non-zero on any failure.

import nyaa from '../dist/nyaa.js'

const CASES = [
  { name: 'Witch Hat Atelier', ep: 8, want: /witch hat|tongari boushi/i,
    titles: ['とんがり帽子のアトリエ', 'Xưởng Phép Thuật', 'Tongari Boushi no Atelier', 'Witch Hat Atelier', 'Atelier of Witch Hat', "L'Atelier des Sorciers"] },
  { name: 'Frieren', ep: 10, want: /frieren/i,
    titles: ['葬送のフリーレン', 'Sousou no Frieren', 'Frieren: Beyond Journey’s End'] },
  { name: 'One Piece', ep: 1100, want: /one piece/i,
    titles: ['ワンピース', 'One Piece'] },
  { name: 'Re:Zero S4', ep: 7, want: /re.?zero|isekai seikatsu/i,
    titles: ['Re:ゼロから始める異世界生活 4th season', 'Re:Zero kara Hajimeru Isekai Seikatsu 4th Season', 'Re:ZERO -Starting Life in Another World- Season 4'] },
  { name: 'LIAR GAME', ep: 5, want: /liar game/i,
    titles: ['ライアーゲーム', 'LIAR GAME'] },
  { name: 'Dandadan', ep: 1, want: /dandadan|dan da dan/i,
    titles: ['ダンダダン', 'Dandadan', 'DAN DA DAN'] },
  { name: 'Bleach TYBW', ep: 1, want: /bleach/i,
    titles: ['BLEACH 千年血戦篇', 'Bleach: Sennen Kessen-hen', 'Bleach: Thousand-Year Blood War'] },
  { name: 'Apothecary Diaries', ep: 1, want: /apothecary|kusuriya/i,
    titles: ['薬屋のひとりごと', 'Kusuriya no Hitorigoto', 'The Apothecary Diaries'] },
  { name: 'Jujutsu Kaisen', ep: 1, want: /jujutsu kaisen|sorcery fight/i,
    titles: ['呪術廻戦', 'JJK', 'Sorcery Fight', 'Jujutsu Kaisen', 'JUJUTSU KAISEN'] },
  { name: 'Demon Slayer', ep: 1, want: /kimetsu|demon slayer/i,
    titles: ['鬼滅の刃', 'KnY', 'Kimetsu no Yaiba', 'Demon Slayer: Kimetsu no Yaiba'] },
  { name: 'Attack on Titan', ep: 1, want: /attack on titan|shingeki/i,
    titles: ['進撃の巨人', 'SnK', 'AoT', 'Shingeki no Kyojin', 'Attack on Titan'] },
  { name: 'Chainsaw Man', ep: 1, want: /chainsaw man/i,
    titles: ['チェンソーマン', 'CSM', 'Chainsaw Man'] },
  { name: 'Mushoku Tensei', ep: 1, want: /mushoku tensei|jobless/i,
    titles: ['無職転生 ～異世界行ったら本気だす～', 'Mushoku Tensei: Isekai Ittara Honki Dasu', 'Mushoku Tensei: Jobless Reincarnation'] },
  { name: 'Solo Leveling', ep: 1, want: /solo leveling|ore dake level/i,
    titles: ['俺だけレベルアップな件', 'Na Honjaman Level Up', 'Ore dake Level Up na Ken', 'Solo Leveling'] },
  { name: 'Kaiju No. 8', ep: 1, want: /kaiju|kaijuu|monster #?8/i,
    titles: ['怪獣8号', 'Monster #8', '8Kaijuu', 'Kaijuu 8-gou', 'Kaiju No. 8'] }
]

const sleep = ms => new Promise(r => setTimeout(r, ms))

let failures = 0
for (const c of CASES) {
  let r = []
  try {
    r = await nyaa.single({ titles: c.titles, episode: c.ep, resolution: '1080', exclusions: [] })
  } catch (e) {
    console.log('FAIL  ' + c.name + '  threw: ' + e.message)
    failures++
    await sleep(500)
    continue
  }
  const garbage = r.filter(x => !c.want.test(x.title))
  const ok = r.length > 0 && garbage.length === 0
  if (!ok) failures++
  console.log((ok ? 'PASS  ' : 'FAIL  ') + c.name.padEnd(22) + r.length + ' results, ' + garbage.length + ' off-show'
    + (r.length === 0 ? '  <-- ZERO RESULTS' : '')
    + (garbage.length ? '  <-- e.g. ' + garbage[0].title.slice(0, 50) : ''))
  await sleep(500)
}

console.log('\n' + (CASES.length - failures) + '/' + CASES.length + ' passed')
process.exit(failures ? 1 : 0)
