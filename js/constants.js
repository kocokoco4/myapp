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
  {id:'dict',l:'📖辞典'},
  {id:'ai',l:'AI相談'}
];

const CHORD_DICT=[
  // ── J-POP ──
  {name:'王道進行',genre:'J-POP',mood:'明るい・感動',chords:['C','G','Am','F'],
   desc:'日本のJ-POPで最も使われる黄金進行。Ⅰ→Ⅴ→Ⅵm→Ⅳの流れが感動的でドラマチックな響きを生む。',
   ex:['Story / AI','ありがとう / いきものがかり','女々しくて / ゴールデンボンバー']},
  {name:'小室進行',genre:'J-POP',mood:'哀愁・疾走',chords:['Am','F','G','C'],
   desc:'90年代J-POP黄金期を築いた小室哲哉が多用した進行。Ⅵm→Ⅳ→Ⅴ→Ⅰで哀愁と疾走感が同居する。',
   ex:['DEPARTURES / globe','観月ありさ / 伝説の少女']},
  {name:'4-5-3-6進行',genre:'J-POP',mood:'切ない・ドラマチック',chords:['F','G','Em','Am'],
   desc:'Ⅳ→Ⅴ→Ⅲm→Ⅵmの循環。切なくドラマチックで、サビへの盛り上がりに最適。',
   ex:['世界に一つだけの花 / SMAP','ヒゲダン多数']},
  {name:'Just The Two of Us進行',genre:'J-POP/R&B',mood:'おしゃれ・洗練',chords:['FM7','Em7','Dm7','Em7'],
   desc:'ループ感のあるオシャレな進行。シティポップやNeo Soulで多用される都会的なサウンド。',
   ex:['Just The Two of Us / Bill Withers','丸の内サディスティック / 椎名林檎']},
  {name:'JORURI進行',genre:'J-POP',mood:'感動・壮大',chords:['Am','F','C','G'],
   desc:'小室進行の亜種。スケールの大きな感動系バラードに合う。マイナー始まりが切なさを演出。',
   ex:['千本桜','アニソン系に頻出']},
  // ── ポップス ──
  {name:'50年代進行',genre:'ポップス',mood:'懐かしい・ポップ',chords:['C','Am','F','G'],
   desc:'1950〜60年代のポップスの定番。Ⅰ→Ⅵm→Ⅳ→Ⅴの安定した循環で、誰でも口ずさめる親しみやすさ。',
   ex:['Stand By Me / Ben E. King','Blue Moon']},
  {name:'Axis of Awesome進行',genre:'ポップス',mood:'明るい・普遍的',chords:['C','G','Am','F'],
   desc:'世界中の数百ものヒット曲が同じこの4コードを使っていることをバンドが証明した伝説の進行。',
   ex:['Let It Be / The Beatles','No Woman No Cry / Bob Marley','ほか多数']},
  {name:'クリシェ（内声下降）',genre:'ポップス',mood:'叙情的・哀愁',chords:['Am','AmM7','Am7','Am6'],
   desc:'ルートはAmのまま内声が半音ずつ下降する技法。シンプルなのに奥深い哀愁が生まれる。',
   ex:['Michelle / The Beatles','夜空ノムコウ / SMAP']},
  // ── ロック ──
  {name:'I-IV-V（ロック基本）',genre:'ロック',mood:'力強い・シンプル',chords:['C','F','G'],
   desc:'ロックの最も基本的な3コード進行。シンプルだからこそパワーがあり、世界中のバンドが使う。',
   ex:['Johnny B. Goode / Chuck Berry','La Bamba','Twist and Shout']},
  {name:'暗い系（フラメンコ）',genre:'ロック/フラメンコ',mood:'ダーク・情熱',chords:['Am','G','F','E'],
   desc:'Amから半音階的に下降しEで終わる進行。フラメンコ的な緊張感と情熱が特徴。',
   ex:['Stairway to Heaven（一部）/ Led Zeppelin','Sultans of Swing']},
  {name:'モーダルロック進行',genre:'ロック',mood:'重厚・神秘',chords:['Dm','C','Bb','C'],
   desc:'ドリアンモードを使った重厚なロック進行。繰り返すだけで強烈なグルーヴが生まれる。',
   ex:['Smoke on the Water / Deep Purple','Light My Fire / The Doors']},
  // ── ジャズ ──
  {name:'ii-V-I（ジャズ基本）',genre:'ジャズ',mood:'おしゃれ・解決',chords:['Dm7','G7','CM7'],
   desc:'ジャズの基本中の基本。Ⅱm7→Ⅴ7→ⅠM7で生まれる「緊張と解決」がジャズの醍醐味。',
   ex:['多くのジャズスタンダード','枯葉（一部）']},
  {name:'リズムチェンジ',genre:'ジャズ',mood:'スウィング・明るい',chords:['CM7','A7','Dm7','G7'],
   desc:'ガーシュウィン「I Got Rhythm」が起源のジャズ定番循環コード。ビバップの基礎。',
   ex:['I Got Rhythm / Gershwin','Anthropology / Charlie Parker']},
  {name:'枯葉進行',genre:'ジャズ',mood:'秋・哀愁',chords:['Cm7','F7','BbM7','EbM7','Am7b5','D7','Gm'],
   desc:'世界で最も有名なジャズスタンダードの進行。長調と短調を行き来する洗練されたコード運び。',
   ex:['Autumn Leaves / Joseph Kosma']},
  // ── ブルース ──
  {name:'12小節ブルース',genre:'ブルース',mood:'渋い・グルーヴ',chords:['C7','C7','C7','C7','F7','F7','C7','C7','G7','F7','C7','G7'],
   desc:'ブルースの聖典。12小節でI7→IV7→V7を循環する。すべてのポピュラー音楽の源流。',
   ex:['Johnny B. Goode / Chuck Berry','Hound Dog / Elvis Presley']},
  {name:'8小節ブルース',genre:'ブルース',mood:'渋い・コンパクト',chords:['C','F','C','G','F','C','G','C'],
   desc:'12小節より短くコンパクトなブルース形式。跳ねるリズムとの相性が抜群。',
   ex:['Key to the Highway / Big Bill Broonzy']},
  // ── クラシック ──
  {name:'カノン進行',genre:'クラシック',mood:'壮大・普遍',chords:['C','G','Am','Em','F','C','F','G'],
   desc:'パッヘルベルのカノンが起源。300年以上使われ続ける人類共通の美しい8コード進行。',
   ex:['Canon / Pachelbel','Canon Rock / JerryC']},
  {name:'フォリア',genre:'クラシック/フラメンコ',mood:'荘厳・哀愁',chords:['Am','E','Am','G','C','G','Am','E'],
   desc:'16〜17世紀のスペイン発祥。コレッリ、サラサーテなど多くの作曲家が変奏曲を書いた歴史的進行。',
   ex:['La Folia / Corelli','多くのバロック変奏曲']},
  // ── ソウル/R&B ──
  {name:'ソウル進行',genre:'ソウル/R&B',mood:'温かい・グルーヴ',chords:['C7','F7'],
   desc:'ⅠとⅣを行き来するだけのシンプルな進行。ファンクやソウルの基本でグルーヴが命。',
   ex:['多くのファンク/ソウル曲','Play That Funky Music']},
  {name:'Neo Soul進行',genre:'R&B/ネオソウル',mood:'洗練・切ない',chords:['Dm9','G13','Em7','Am7'],
   desc:'豊かなテンションノートを使ったNeo Soul定番進行。メロウで都会的なサウンド。',
   ex:['John Mayer / neo soul系多数']},
  // ── 映画音楽 ──
  {name:'映画的マイナー',genre:'映画音楽',mood:'壮大・感動',chords:['Am','F','C','Em'],
   desc:'マイナー始まりだが途中で長調の明るさが入り、最後のEmで浮遊感を出す映画音楽定番。',
   ex:['映画エンドロール的雰囲気','ゲームBGM多数']},
  {name:'ハンス・ジマー的進行',genre:'映画音楽',mood:'壮大・史詩的',chords:['Cm','Ab','Eb','Bb'],
   desc:'長大なスケール感を生む映画音楽的マイナー進行。弦楽器で演奏すると圧倒的な迫力。',
   ex:['Interstellar / Hans Zimmer（インスパイア）']},
];

const gid=()=>Math.random().toString(36).slice(2,9);
const esc=s=>(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
