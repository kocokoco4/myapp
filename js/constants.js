// ─── 定数・ユーティリティ ───
const KEYS=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const STATS=['アイデア','作詞中','作曲中','録音中','完成'];
const STC={アイデア:'#64748b',作詞中:'#3b82f6',作曲中:'#9060e8',録音中:'#e8a020',完成:'#50c878'};
const DSECS=['イントロ','Aメロ','Bメロ','サビ','アウトロ'];
const CL=[
  ['C','CM7','C7','Cm','Cm7','Cadd9'],
  ['D','DM7','D7','Dm','Dm7','D/F#'],
  ['E','EM7','E7','Em','Em7'],
  ['F','FM7','F7','Fm','Fm7','F/A'],
  ['G','GM7','G7','Gm','Gm7','G/B'],
  ['A','AM7','A7','Am','Am7','A/C#'],
  ['B','BM7','B7','Bm','Bm7'],
  ['F#','F#m','Bb','Eb','Ab','Db']
];
const QP=[
  {l:'王道進行',c:['C','G','Am','F']},
  {l:'小室進行',c:['Am','F','G','C']},
  {l:'カノン',c:['C','G','Am','Em','F','C','F','G']},
  {l:'暗い系',c:['Am','G','F','E']},
  {l:'4-5-3-6',c:['F','G','Em','Am']}
];
const INSTRS={
  piano:{label:'ピアノ',color:'#9060e8'},
  bass:{label:'ベース',color:'#3b82f6'},
  guitar:{label:'ギター',color:'#e8a020'},
  drums:{label:'ドラム',color:'#e05050'}
};
const NOTE_NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const OCTAVES=[3,4,5];
const DURS=[
  {v:'w',l:'全音符',b:4},
  {v:'h',l:'2分',b:2},
  {v:'q',l:'4分',b:1},
  {v:'8',l:'8分',b:.5},
  {v:'16',l:'16分',b:.25}
];
const TABS=[
  {id:'lyrics',l:'歌詞'},
  {id:'melody',l:'メロディ'},
  {id:'chords',l:'コード'},
  {id:'accomp',l:'伴奏譜面'},
  {id:'score',l:'チャート'},
  {id:'ai',l:'AI相談'}
];

const gid=()=>Math.random().toString(36).slice(2,9);
const esc=s=>(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
