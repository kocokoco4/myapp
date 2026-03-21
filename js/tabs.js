// ─── タブレンダラー・インタラクション ───

/* ── メトロノーム ── */
let _metroTimer=null,_metroBeat=0,_metroAccent=false;

function _getMeterInfo(s){
  const mv=s?.meter||'4/4';
  const found=METERS.find(m=>m.v===mv);
  if(found&&found.v!=='custom')return found;
  // カスタム or 未登録 → 文字列からパース
  const parts=(mv==='custom'?'4/4':mv).split('/').map(Number);
  return{v:mv,beats:parts[0]||4,unit:parts[1]||4};
}

function _beatMs(s){
  const m=_getMeterInfo(s);
  return(60000/(s?.tempo||120))*(4/m.unit);
}

function toggleMetronome(){
  const btn=document.getElementById('metroBtn');
  if(_metroTimer){
    clearInterval(_metroTimer);_metroTimer=null;_metroBeat=0;
    if(btn){btn.textContent='♩ メトロ';btn.style.background='';btn.style.color='';}
    return;
  }
  const s=cur();if(!s)return;
  const m=_getMeterInfo(s);
  const bms=_beatMs(s);
  const ctx=getAudioCtx();
  function tick(){
    const now=ctx.currentTime;
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    const isAccentBeat=_metroAccent&&(_metroBeat%m.beats===0);
    osc.frequency.value=isAccentBeat?1400:900;
    const vol=isAccentBeat?0.3:0.18;
    gain.gain.setValueAtTime(vol,now);
    gain.gain.exponentialRampToValueAtTime(0.001,now+0.04);
    osc.connect(gain);gain.connect(ctx.destination);
    osc.start(now);osc.stop(now+0.04);
    _metroBeat++;
  }
  tick();
  _metroTimer=setInterval(tick,bms);
  if(btn){btn.textContent='■ 停止';btn.style.background='rgba(30,184,160,.15)';btn.style.color='var(--teal)';}
}

function toggleMetroAccent(){
  _metroAccent=!_metroAccent;
  const btn=document.getElementById('accentBtn');
  if(btn){
    btn.textContent=_metroAccent?'強拍 ON':'強拍 OFF';
    btn.style.borderColor=_metroAccent?'var(--amber)':'';
    btn.style.color=_metroAccent?'var(--amber)':'';
  }
}

function stopMetronome(){
  if(_metroTimer){clearInterval(_metroTimer);_metroTimer=null;_metroBeat=0;}
  const btn=document.getElementById('metroBtn');
  if(btn){btn.textContent='♩ メトロ';btn.style.background='';btn.style.color='';}
}
function onMeterChange(v){
  const wrap=document.getElementById('customMeterWrap');
  if(v==='custom'){if(wrap)wrap.style.display='flex';}
  else{if(wrap)wrap.style.display='none';upd(s=>s.meter=v);}
}
function applyCustomMeter(){
  const v=document.getElementById('customMeterIn')?.value?.trim();
  if(!v||!/^\d+\/\d+$/.test(v)){toast('⚠ 例: 7/4 の形式で入力してください');return;}
  upd(s=>s.meter=v);toast(`✓ 拍子を ${v} に設定しました`);
}

/* ── 転調・複製 ── */
const _SM={'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11,'Db':1,'Eb':3,'Gb':6,'Ab':8,'Bb':10};

function _transposeChord(chord,st){
  if(!chord)return chord;
  const m=chord.match(/^([A-G][#b]?)(.*)$/);if(!m)return chord;
  const ri=_SM[m[1]];if(ri===undefined)return chord;
  const newRoot=KEYS[((ri+st)%12+12)%12];
  const sfx=m[2];
  const sl=sfx.lastIndexOf('/');
  if(sl>=0){
    const bn=sfx.slice(sl+1);const bi=_SM[bn];
    if(bi!==undefined)return newRoot+sfx.slice(0,sl+1)+KEYS[((bi+st)%12+12)%12];
  }
  return newRoot+sfx;
}

function _transposePitch(pitch,st){
  if(!pitch||pitch==='R')return pitch;
  const m=pitch.match(/^([A-G][#b]?)(\d)$/);if(!m)return pitch;
  const ni=_SM[m[1]];if(ni===undefined)return pitch;
  const total=ni+parseInt(m[2])*12+st;
  const newOct=Math.floor(total/12);const newNi=((total%12)+12)%12;
  return KEYS[newNi]+newOct;
}

function transposeSection(si,st){
  upd(s=>{
    s.sections[si].measures=s.sections[si].measures.map(m=>({
      ...m,
      chord:_transposeChord(m.chord,st),
      melNotes:(m.melNotes||[]).map(n=>({...n,pitch:_transposePitch(n.pitch,st)}))
    }));
  });
}

function dupSection(si){
  upd(s=>{
    const orig=s.sections[si];
    const copy=JSON.parse(JSON.stringify(orig));
    copy.id=gid();copy.name=orig.name+' (コピー)';
    copy.measures=copy.measures.map(m=>({...m,id:gid()}));
    s.sections.splice(si+1,0,copy);
  });
}

/* ── セクション再生 ── */
let _playTimers=[],_playingSec=null;

function stopSectionPlay(){
  _playTimers.forEach(t=>clearTimeout(t));
  _playTimers=[];_playingSec=null;
  document.querySelectorAll('.sec-play-btn').forEach(b=>{b.textContent='▶ 再生';b.style.color='';b.style.borderColor='';});
}

function playMelSection(si){
  if(_playingSec!==null){stopSectionPlay();return;}
  const s=cur();if(!s)return;
  const sec=s.sections[si];const beatMs=_beatMs(s);
  const beatsPerMeas=_getMeterInfo(s).beats;
  _playingSec=si;
  const btn=document.getElementById(`mel-play-${si}`);
  if(btn){btn.textContent='■ 停止';btn.style.color='var(--coral)';btn.style.borderColor='var(--coral)';}
  let maxT=0;
  sec.measures.forEach((meas,mi)=>{
    const measStart=mi*beatsPerMeas*beatMs;
    (meas.melNotes||[]).forEach(n=>{
      if(!n.pitch||n.pitch==='R')return;
      const t=measStart+(n.startBeat||0)*beatMs;
      _playTimers.push(setTimeout(()=>playNote(n.pitch),t));
      maxT=Math.max(maxT,t+beatMs);
    });
  });
  if(maxT===0)maxT=sec.measures.length*beatsPerMeas*beatMs;
  _playTimers.push(setTimeout(stopSectionPlay,maxT+300));
}

function playChordSection(si){
  if(_playingSec!==null){stopSectionPlay();return;}
  const s=cur();if(!s)return;
  const sec=s.sections[si];
  const measMs=_getMeterInfo(s).beats*_beatMs(s);
  _playingSec=si;
  const btn=document.getElementById(`chord-play-${si}`);
  if(btn){btn.textContent='■ 停止';btn.style.color='var(--coral)';btn.style.borderColor='var(--coral)';}
  sec.measures.forEach((meas,mi)=>{
    if(!meas.chord)return;
    _playTimers.push(setTimeout(()=>{
      const el=document.getElementById(`cc_${si}_${mi}`);
      playChord(meas.chord,el);
    },mi*measMs));
  });
  _playTimers.push(setTimeout(stopSectionPlay,sec.measures.length*measMs+300));
}

/* ── LYRICS ── */
function renderLyrics(s){return`
<div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:7px 12px">
  <span style="font-size:10px;color:var(--text3);font-family:var(--mono)">Key: <strong style="color:var(--text2)">${s.key}</strong></span>
  <span style="color:var(--border2)">|</span>
  <span style="font-size:10px;color:var(--text3);font-family:var(--mono)">BPM: <strong style="color:var(--text2)">${s.tempo}</strong></span>
  <span style="font-size:10px;color:var(--text3);margin-left:4px">← メロディタブで変更</span>
</div>
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
  <span style="font-family:var(--disp);font-size:15px;font-weight:700">セクション別 歌詞</span>
  <button class="btn btn-g" style="font-size:11px;padding:5px 11px" onclick="addSection()">＋ セクション</button>
</div>
${s.sections.map((sec,si)=>`
<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--rl);padding:12px;margin-bottom:10px">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
    <input class="sni" value="${esc(sec.name)}" oninput="saveOnly(s=>s.sections[${si}].name=this.value)" style="font-size:12px">
    ${s.sections.length>1?`<button style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;padding:2px" onclick="delSection(${si})">×</button>`:''}
  </div>
  <textarea class="txa" style="min-height:70px;font-size:15px;line-height:2"
    placeholder="${esc(sec.name)}の歌詞を入力..."
    oninput="saveOnly(s=>s.sections[${si}].lyrics=this.value)">${esc(sec.lyrics||'')}</textarea>
</div>`).join('')}
<div style="margin-top:12px">
  <label class="flbl">LYRICS MEMO</label>
  <textarea class="txa" id="lyricsTA" style="min-height:100px"
    placeholder="フレーズの下書き、参考メモなど自由に"
    oninput="saveOnly(s=>s.lyrics=this.value)">${esc(s.lyrics)}</textarea>
</div>
<div style="margin-top:10px">
  <label class="flbl">MEMO</label>
  <textarea class="txa" id="memoTA" style="min-height:65px"
    placeholder="コンセプト、参考曲など"
    oninput="saveOnly(s=>s.memo=this.value)">${esc(s.memo)}</textarea>
</div>`;}

/* ── MELODY ── */
function renderMelody(s){
  return`
<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:10px 12px">
  <div><label class="flbl">KEY</label><select class="inp" onchange="upd(s=>s.key=this.value)">${KEYS.map(k=>`<option${k===s.key?' selected':''}>${k}</option>`).join('')}</select></div>
  <div><label class="flbl">BPM</label><input type="number" class="inp" style="width:72px" value="${s.tempo}" min="40" max="300" onchange="upd(s=>s.tempo=parseInt(this.value)||120)"></div>
  <div>
    <label class="flbl">拍子</label>
    <div style="display:flex;gap:5px;align-items:center">
      <select class="inp" id="meterSel" onchange="onMeterChange(this.value)">${METERS.map(m=>`<option value="${m.v}"${(s.meter||'4/4')===m.v?' selected':''}>${m.l}</option>`).join('')}</select>
      <div id="customMeterWrap" style="display:${(s.meter&&!METERS.find(m=>m.v===s.meter))?'flex':'none'};gap:5px;align-items:center">
        <input id="customMeterIn" class="inp" style="width:70px" placeholder="例: 7/4" value="${(!METERS.find(m=>m.v===(s.meter||'4/4')))?s.meter||'':''}" oninput="">
        <button class="btn btn-g" style="font-size:10px;padding:5px 8px;white-space:nowrap" onclick="applyCustomMeter()">適用</button>
      </div>
    </div>
  </div>
  <div style="display:flex;gap:5px;padding-bottom:2px">
    <button id="metroBtn" class="btn btn-g" style="font-size:11px;padding:6px 10px" onclick="toggleMetronome()">♩ メトロ</button>
    <button id="accentBtn" class="btn btn-g" style="font-size:11px;padding:6px 10px;${_metroAccent?'border-color:var(--amber);color:var(--amber)':''}" onclick="toggleMetroAccent()">${_metroAccent?'強拍 ON':'強拍 OFF'}</button>
  </div>
</div>
${s.sections.map((sec,si)=>`
<div class="mel-sec">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
    <input class="mel-sec-name" style="margin-bottom:0" value="${esc(sec.name)}" oninput="saveOnly(s=>s.sections[${si}].name=this.value)">
    <button id="mel-play-${si}" class="sec-play-btn btn btn-g" style="flex-shrink:0;font-size:10px;padding:4px 10px;white-space:nowrap" onclick="playMelSection(${si})">▶ 再生</button>
    ${s.sections.length>1?`<button style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:2px 4px;flex-shrink:0" onclick="delSection(${si})">×</button>`:''}
  </div>
  ${(sec.lyrics||'')?`<div style="background:rgba(232,160,32,.06);border:1px solid rgba(232,160,32,.15);border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:13px;color:var(--text);line-height:1.8;white-space:pre-wrap">${esc(sec.lyrics)}</div>`:''}
  <div style="margin-bottom:12px">
    <div class="staff-block">
      ${melodyStaffSVG(sec.measures,'#1eb8a0',s.meter||'4/4')}
    </div>
  </div>
  <div class="mel-measures">
    ${sec.measures.map((m,mi)=>`
    <div class="mel-meas">
      <div class="mel-meas-chord">${mi+1}小節 ${m.chord?'('+m.chord+')':''}</div>
      <div class="mel-notes" id="mn_${si}_${mi}">
        ${(m.melNotes||[]).map((n,ni)=>`
        <div class="mel-note-chip" onclick="previewNote('${n.pitch}')">
          <span>${n.pitch}</span><span style="font-size:9px;color:rgba(30,184,160,.6)">${DURS.find(d=>d.v===n.duration)?.l||n.duration}</span>
          <span class="del" onclick="event.stopPropagation();delMelNote(${si},${mi},${ni})">×</span>
        </div>`).join('')}
        <button class="add-note-btn" onclick="openNotePicker(event,${si},${mi})">＋ 音符</button>
      </div>
    </div>`).join('')}
  </div>
  <div style="display:flex;gap:6px;flex-wrap:wrap">
    <button class="btn btn-g" style="font-size:10px;padding:4px 10px" onclick="addMelMeasure(${si})">+ 小節</button>
    ${sec.measures.length>1?`<button class="btn btn-g" style="font-size:10px;padding:4px 10px" onclick="delMelMeasure(${si})">- 小節</button>`:''}
    <button class="btn btn-g" style="font-size:10px;padding:4px 10px" onclick="dupSection(${si})">複製</button>
    <button class="btn btn-g" style="font-size:10px;padding:4px 10px" onclick="transposeSection(${si},1)">半音↑</button>
    <button class="btn btn-g" style="font-size:10px;padding:4px 10px" onclick="transposeSection(${si},-1)">半音↓</button>
  </div>
</div>`).join('')}
<div style="text-align:center;margin-top:10px">
  <button class="btn btn-g" style="font-size:11px;padding:5px 14px" onclick="addSection()">＋ セクション追加</button>
</div>`;
}

function previewNote(pitch){playNote(pitch);}
function delMelNote(si,mi,ni){upd(s=>{s.sections[si].measures[mi].melNotes.splice(ni,1);let sb=0;for(const n of s.sections[si].measures[mi].melNotes){n.startBeat=sb;sb+=(DB[n.duration]||1);}});}
function addMelMeasure(si){upd(s=>s.sections[si].measures.push({id:gid(),chord:s.sections[si].measures[s.sections[si].measures.length-1]?.chord||'',melNotes:[]}));}
function delMelMeasure(si){upd(s=>{if(s.sections[si].measures.length>1)s.sections[si].measures.pop();});}

/* ── Note Picker ── */
let npState={pitch:'C4',dur:'q',rest:false};
let _npSi=-1,_npMi=-1;

function openNotePicker(e,si,mi){
  e.stopPropagation();
  const npk=document.getElementById('npk');
  _npSi=si;_npMi=mi;
  notePickerCb=(pitch,dur)=>addMelNote(si,mi,pitch,dur);
  if(window.innerWidth<=768){
    // スマホ：画面下部ボトムシート
    const bnavH=document.getElementById('bnav').offsetHeight||56;
    npk.style.cssText=`display:block;position:fixed;left:0;right:0;bottom:${bnavH}px;top:auto;width:100%;border-radius:16px 16px 0 0;z-index:1000;max-height:72vh;overflow-y:auto;padding:16px`;
    renderNotePicker();
  } else {
    // PC：ボタン付近に表示。画面外にはみ出る場合は反転
    const btn=e.currentTarget;const rect=btn.getBoundingClientRect();
    // 仮レンダリングで高さを計測
    npk.style.cssText=`visibility:hidden;display:block;position:fixed;top:0;left:0;width:310px;border-radius:12px;z-index:500;padding:12px`;
    renderNotePicker();
    const ph=npk.offsetHeight;
    const pw=310;
    const margin=8;
    const vw=window.innerWidth;const vh=window.innerHeight;
    // 左右
    let left=rect.left;
    if(left+pw+margin>vw) left=vw-pw-margin;
    if(left<margin) left=margin;
    // 上下：下に収まるなら下、収まらなければ上
    let top=rect.bottom+6;
    if(top+ph+margin>vh) top=Math.max(margin,rect.top-ph-6);
    npk.style.cssText=`display:block;position:fixed;top:${top}px;left:${left}px;width:${pw}px;border-radius:12px;z-index:500;padding:12px`;
  }
}

/* ── 音価 SVG 記号 ── */
function _noteSvg(v){
  const W=20,H=22,cx=6,cy=18,sx=cx+5;
  const isOpen=v==='w'||v==='h'||v==='h.';
  const flagMap={'8':1,'8.':1,'8t':1,'16':2,'16t':2,'32':3};
  const nF=flagMap[v]||0;
  const isDot=v.includes('.');
  const isTri=v.endsWith('t');
  const hasStem=v!=='w';
  let s=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:inline-block;vertical-align:middle;pointer-events:none">`;
  if(v==='w'){
    s+=`<ellipse cx="${cx}" cy="${cy}" rx="5.5" ry="3.5" fill="none" stroke="currentColor" stroke-width="1.5" transform="rotate(-12,${cx},${cy})"/>`;
  }else if(isOpen){
    s+=`<ellipse cx="${cx}" cy="${cy}" rx="5" ry="3.2" fill="none" stroke="currentColor" stroke-width="1.3" transform="rotate(-12,${cx},${cy})"/>`;
  }else{
    s+=`<ellipse cx="${cx}" cy="${cy}" rx="5" ry="3.2" fill="currentColor" transform="rotate(-12,${cx},${cy})"/>`;
  }
  if(hasStem) s+=`<line x1="${sx}" y1="${cy-2}" x2="${sx}" y2="3" stroke="currentColor" stroke-width="1.2"/>`;
  for(let i=0;i<nF;i++) s+=`<path d="M ${sx} ${3+i*5} q 8 2 6 8" stroke="currentColor" fill="none" stroke-width="1.1"/>`;
  if(isDot) s+=`<circle cx="${(hasStem?sx:cx)+6}" cy="${cy-2}" r="1.5" fill="currentColor"/>`;
  if(isTri) s+=`<text x="${W-1}" y="10" font-size="7" fill="currentColor" font-family="monospace" font-weight="bold" text-anchor="end">3</text>`;
  s+=`</svg>`;
  return s;
}

/* ── ピアノ鍵盤SVG生成 ── */
function _pianoSVG(){
  const WW=11,WH=44,BW=7,BH=27;
  const curOct=parseInt(npState.pitch.slice(-1));
  const isLight=document.documentElement.getAttribute('data-theme')==='light';
  // 白鍵：C D E F G A B の順
  const WN=['C','D','E','F','G','A','B'];
  // 黒鍵：白鍵インデックスと音名
  const BK=[{wi:0,n:'C#'},{wi:1,n:'D#'},{wi:3,n:'F#'},{wi:4,n:'G#'},{wi:5,n:'A#'}];
  // 教育ラベル（C音の下に表示）
  const CLBL={3:'低音域',4:'中央のド',5:'高音域'};
  const octs=[3,4,5];
  const svgW=octs.length*7*WW+1;
  let ws='',bs='',lbls='';

  octs.forEach((oct,oi)=>{
    const ox=oi*7*WW;
    const isSelOct=oct===curOct;
    WN.forEach((n,wi)=>{
      const pitch=n+oct;
      const x=ox+wi*WW;
      const isSel=npState.pitch===pitch;
      const wFill=isSel?'#1eb8a0':isSelOct?'rgba(232,160,32,.18)':(isLight?'#f8f5ef':'white');
      const wStroke=isSel?'#1eb8a0':isSelOct?'#e8a020':(isLight?'#b0a898':'#ccc');
      ws+=`<rect x="${x}" y="0" width="${WW-1}" height="${WH}" rx="2" fill="${wFill}" stroke="${wStroke}" stroke-width="${isSel?1.5:.7}" style="cursor:pointer" onclick="npSetNoteOct('${n}','${oct}')"/>`;
      if(isSel)ws+=`<text x="${x+WW/2-.5}" y="${WH-5}" font-size="6" text-anchor="middle" fill="white" font-family="monospace" font-weight="bold">${n}</text>`;
    });
    BK.forEach(({wi,n})=>{
      const pitch=n+oct;
      const x=ox+(wi+1)*WW-BW/2-1;
      const isSel=npState.pitch===pitch;
      const bFill=isSel?'#1eb8a0':isSelOct?'#6040a0':(isLight?'#2a2318':'#1a1815');
      bs+=`<rect x="${x}" y="0" width="${BW}" height="${BH}" rx="2" fill="${bFill}" stroke="none" style="cursor:pointer" onclick="npSetNoteOct('${n}','${oct}')"/>`;
    });
    // C音の下にラベル
    const lx=ox+WW/2-.5;
    const isSelLbl=oct===curOct;
    const lblColor=isSelLbl?'#e8a020':(isLight?'#8a7c6e':'#888');
    lbls+=`<text x="${lx}" y="${WH+11}" font-size="7" text-anchor="start" fill="${lblColor}" font-family="monospace" font-weight="${isSelLbl?'bold':'normal'}">${CLBL[oct]||'Oct'+oct}</text>`;
  });

  return`<svg width="${svgW}" height="${WH+15}" style="display:block;overflow:visible">${ws}${bs}${lbls}</svg>`;
}

function renderNotePicker(){
  const npk=document.getElementById('npk');
  const selNote=npState.pitch.replace(/\d/,'');
  const selOct=parseInt(npState.pitch.slice(-1));
  npk.innerHTML=`
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
  <span style="font-size:11px;font-weight:700;color:var(--teal);font-family:var(--mono)">音符を追加</span>
  <button style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;padding:2px" onclick="closeNotePicker()">✕</button>
</div>

<!-- ピアノ鍵盤 -->
<div class="npk-piano-bg" style="background:#f8f6f2;border-radius:8px;padding:10px 8px 6px;margin-bottom:12px;overflow-x:auto">
  ${_pianoSVG()}
  <div style="margin-top:3px;font-size:9px;color:#999;font-family:monospace;text-align:right">← タップして音を選択</div>
</div>

<!-- 音名・オクターブ（鍵盤と連動） -->
<div class="npk-row" style="margin-bottom:6px">
  <span class="npk-lbl">音名</span>
  <div style="display:flex;gap:3px;flex-wrap:wrap">${NOTE_NAMES.map(n=>{const isSel=selNote===n;const isScale=(typeof getScaleNotes==='function')&&getScaleNotes(cur()?.key||'C').includes(n);return`<button class="npk-note${isSel?' sel':''}${n.includes('#')?' sharp':''}${isScale?' scale':''}" onclick="npSetNote('${n}')">${n}</button>`;}).join('')}</div>
</div>
<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
  <span style="font-size:9px;color:var(--text3);font-family:var(--mono)"><span style="color:var(--teal)">●</span> Key: ${cur()?.key||'C'} スケール音</span>
  <div style="flex:1"></div>
  <button class="btn ${npState.rest?'btn-a':'btn-g'}" style="font-size:10px;padding:4px 10px;${npState.rest?'background:var(--coral);border-color:var(--coral)':''}" onclick="npToggleRest()">${npState.rest?'🎵 音符に戻す':'休符モード'}</button>
</div>
<div class="npk-row" style="margin-bottom:10px">
  <span class="npk-lbl">オクターブ</span>
  <div style="display:flex;gap:3px">${OCTAVES.map(o=>{const lbl={3:'低',4:'中',5:'高'};return`<button class="npk-note${selOct===o?' sel':''}" onclick="npSetOct(${o})" style="min-width:38px">${o}<span style="font-size:8px;opacity:.7;margin-left:2px">${lbl[o]||''}</span></button>`;}).join('')}</div>
</div>

<!-- 音価（カテゴリ分け） -->
<div style="margin-bottom:10px">
  <div style="font-size:10px;color:var(--text2);font-family:var(--mono);margin-bottom:5px">${npState.rest?'休符の長さ':'音価'}</div>
  ${['通常','付点','三連符'].map(cat=>{
    const items=DURS.filter(d=>d.cat===cat);
    return`<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px">
      <span style="font-size:9px;color:var(--text3);font-family:var(--mono);width:38px;flex-shrink:0">${cat}</span>
      <div style="display:flex;gap:3px;flex-wrap:wrap">${items.map(d=>`<button class="dur-btn${npState.dur===d.v?' sel':''}" onclick="npSetDur('${d.v}')" title="${d.l}">${_noteSvg(d.v)}</button>`).join('')}</div>
    </div>`;
  }).join('')}
</div>

<!-- 操作バー -->
<div style="margin-top:8px;text-align:center;font-size:10px;color:var(--text3);font-family:var(--mono)">${npState.rest?'<span style="color:var(--coral)">休符モード：</span>音名タップで選んだ長さの休符を追加':'音名タップで即追加・即再生'}</div>`;
}

function npToggleRest(){npState.rest=!npState.rest;renderNotePicker();}
function npSetOct(o){const root=npState.pitch.replace(/\d/,'');npState.pitch=root+o;renderNotePicker();}
function npSetNote(n){
  const oct=npState.pitch.slice(-1);npState.pitch=n+oct;
  if(npState.rest){npAddRest();return;}
  playNote(npState.pitch);npAutoAdd();renderNotePicker();
}
function npSetNoteOct(n,o){
  npState.pitch=n+o;
  if(npState.rest){npAddRest();return;}
  playNote(npState.pitch);npAutoAdd();renderNotePicker();
}
function npSetDur(d){npState.dur=d;renderNotePicker();}
function npPreview(){playNote(npState.pitch);}
function npConfirm(){if(notePickerCb)notePickerCb(npState.pitch,npState.dur);closeNotePicker();}
function _npRestore(){notePickerCb=(p,d)=>addMelNote(_npSi,_npMi,p,d);}
function npAddRest(){addMelNote(_npSi,_npMi,'R',npState.dur);_npRestore();renderNotePicker();}
function npAutoAdd(){if(!notePickerCb)return;notePickerCb(npState.pitch,npState.dur);_npRestore();const tabC=document.getElementById('tabC');const sy=tabC.scrollTop;renderTab();tabC.scrollTop=sy;}
function closeNotePicker(){document.getElementById('npk').style.display='none';notePickerCb=null;}
function addMelNote(si,mi,pitch,dur){
  const s=cur();if(!s)return;
  const m=s.sections[si].measures[mi];
  if(!m.melNotes)m.melNotes=[];
  let sb=0;for(const n of m.melNotes){sb+=(DB[n.duration]||1);}
  const meterInfo=_getMeterInfo(s);
  const maxBeats=meterInfo.beats*(4/meterInfo.unit);
  if(sb+((DB[dur])||1)>maxBeats){toast('この小節はいっぱいです');return;}
  m.melNotes.push({pitch,duration:dur,startBeat:sb});
  s.updatedAt=Date.now();save();renderSongList();renderTab();
}

/* ── CHORDS ── */
function renderChords(s){return`
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
  <span style="font-family:var(--disp);font-size:15px;font-weight:700">コード進行</span>
  <button class="btn btn-g" style="font-size:11px;padding:5px 11px" onclick="addSection()">＋ セクション</button>
</div>
<div style="font-size:10px;color:var(--text3);font-family:var(--mono);margin-bottom:12px">▶ タップで音が鳴ります</div>
${s.sections.map((sec,si)=>`
<div class="sec-wr">
  <div style="display:flex;align-items:center;gap:6px;margin-bottom:7px">
    <input class="sni" value="${esc(sec.name)}" oninput="saveOnly(s=>s.sections[${si}].name=this.value)">
    ${s.sections.length>1?`<button style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:2px 4px;flex-shrink:0" onclick="delSection(${si})">×</button>`:''}
  </div>
  <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px">
    <button id="chord-play-${si}" class="sec-play-btn btn btn-g" style="font-size:10px;padding:4px 10px;white-space:nowrap" onclick="playChordSection(${si})">▶ 再生</button>
    <button class="btn btn-g" style="padding:4px 9px;font-size:10px" onclick="addMeasure(${si})">＋小節</button>
    <button class="btn btn-g" style="padding:4px 9px;font-size:10px" onclick="dupSection(${si})">複製</button>
    <button class="btn btn-g" style="padding:4px 9px;font-size:10px" onclick="transposeSection(${si},1)">半音↑</button>
    <button class="btn btn-g" style="padding:4px 9px;font-size:10px" onclick="transposeSection(${si},-1)">半音↓</button>
  </div>
  <div class="cg" id="cg_${si}">
    ${sec.measures.map((m,mi)=>`
    <div class="cc${m.chord?' has':''}" id="cc_${si}_${mi}" onclick="handleCC(event,${si},${mi},'${esc(m.chord)}')">
      <span class="bn">${mi+1}</span>
      <span class="cn">${m.chord||'–'}</span>
    </div>`).join('')}
  </div>
  <div class="qr">${QP.map((p,qi)=>`<button class="qb" onclick="applyProgByIdx(${si},${qi})">${p.l}</button>`).join('')}</div>
</div>`).join('')}`;}

function handleCC(e,si,mi,c){e.stopPropagation();closeAllPickers();const cell=document.getElementById(`cc_${si}_${mi}`);if(c)playChord(c,cell);openPicker(e,si,mi,c);}

function openPicker(e,si,mi,curC){
  const cell=document.getElementById(`cc_${si}_${mi}`);
  const div=document.createElement('div');div.className='cpk';
  div.innerHTML=`<div style="display:flex;gap:5px;margin-bottom:7px"><input id="cpIn" class="inp" style="flex:1;font-size:12px;padding:5px 8px" placeholder="直接入力"><button class="btn btn-a" style="padding:5px 10px;font-size:11px" onclick="cpApply(${si},${mi})">✓</button></div><div style="max-height:150px;overflow-y:auto;margin-bottom:7px">${CL.map(row=>`<div class="cpr">${row.map(c=>`<button class="cpb${c===curC?' a':''}" onclick="setChordPlay(${si},${mi},'${c}')">${c}</button>`).join('')}</div>`).join('')}</div><div style="display:flex;gap:5px;padding-top:7px;border-top:1px solid var(--border2)"><button class="btn btn-g" style="flex:1;font-size:10px;padding:5px" onclick="setChord(${si},${mi},'')">クリア</button><button class="btn btn-g" style="flex:1;font-size:10px;padding:5px;border-color:var(--coral);color:var(--coral)" onclick="delMeasure(${si},${mi})">削除</button></div>`;
  cell.appendChild(div);setTimeout(()=>document.getElementById('cpIn')?.focus(),50);
}

function setChordPlay(si,mi,c){setChord(si,mi,c);setTimeout(()=>playChord(c,document.getElementById(`cc_${si}_${mi}`)),50);}
function cpApply(si,mi){const v=document.getElementById('cpIn')?.value?.trim();if(v)setChordPlay(si,mi,v);}
function setChord(si,mi,c){upd(s=>s.sections[si].measures[mi].chord=c);closeAllPickers();}
function closeAllPickers(){document.querySelectorAll('.cpk').forEach(el=>el.remove());}
function addSection(){upd(s=>s.sections.push({id:gid(),name:'新セクション',lyrics:'',measures:Array(4).fill(0).map(()=>({id:gid(),chord:'',melNotes:[]}))}));}
function delSection(si){const s=cur();if(!s||s.sections.length<=1){toast('最低1つのセクションが必要です');return;}const name=s.sections[si].name||'セクション';if(!confirm(`「${name}」を削除しますか？\nコード・メロディ・歌詞がすべて消えます。`))return;upd(s=>{s.sections.splice(si,1);});}
function addMeasure(si){upd(s=>s.sections[si].measures.push({id:gid(),chord:'',melNotes:[]}));}
function delMeasure(si,mi){upd(s=>{if(s.sections[si].measures.length>1)s.sections[si].measures.splice(mi,1);});closeAllPickers();}
function applyProgByIdx(si,qi){applyProg(si,QP[qi].c);}
function applyProg(si,cs){
  upd(s=>{
    s.sections[si].measures=cs.map((c,i)=>({
      ...(s.sections[si].measures[i]||{}),
      id:s.sections[si].measures[i]?.id||gid(),
      chord:c,
      melNotes:s.sections[si].measures[i]?.melNotes||[]
    }));
  });
}

/* ── ACCOMP ── */
function renderAccomp(s){
  const ac=s.accomp;
  return`
<div style="margin-bottom:12px"><label class="flbl">楽器を選択</label>
<div class="isel">${Object.entries(INSTRS).map(([k,v])=>{const on=(s.selInstrs||[]).includes(k);return`<button class="ibtn" style="border-color:${on?v.color:v.color+'33'};color:${on?v.color:'var(--text3)'};background:${on?v.color+'18':'transparent'}" onclick="toggleInstr('${k}')">${v.label}</button>`;}).join('')}</div></div>
<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:18px">
  <button class="btn btn-a" id="genBtn" onclick="generateAccomp()">✦ 伴奏を生成</button>
  ${ac?`<button class="btn btn-t" onclick="exportMusicXML()">⬇ MusicXML出力 (Logic用)</button>`:''}
</div>
${!ac?`<div style="text-align:center;padding:44px 20px"><div style="font-size:36px;margin-bottom:12px;opacity:.3">🎼</div><div style="color:var(--text3);font-size:12px;line-height:2;font-family:var(--mono)">楽器を選んで、伴奏を生成。<br><span style="font-size:10px">コードタブでコード進行を入れておくと精度UP</span></div></div>`
:Object.entries(INSTRS).filter(([k])=>ac[k]).map(([k,v])=>`<div style="margin-bottom:20px"><div class="staff-part-lbl" style="color:${v.color}">▸ ${v.label}</div>${ac[k].sections?.map(sec=>`<div style="margin-bottom:12px"><div class="staff-sec-lbl">${sec.sectionName||sec.name||'SEC'}</div><div class="staff-block">${k==='piano'?grandStaffSVG(sec.measures,v.color,s.meter||'4/4'):k==='drums'?drumStaffSVG(sec.measures):singleStaffSVG(sec.measures,k==='bass'?'bass':'treble',v.color,s.meter||'4/4')}</div></div>`).join('')}</div>`).join('')}`;}

function toggleInstr(k){upd(s=>{const i=(s.selInstrs||[]).indexOf(k);if(i>=0)s.selInstrs.splice(i,1);else s.selInstrs.push(k);});}

async function generateAccomp(){
  const s=cur();if(!s)return;
  const btn=document.getElementById('genBtn');btn.textContent='生成中...';btn.disabled=true;
  const cp=s.sections.map(x=>`${x.name}:${x.measures.map(m=>m.chord||'–').join('|')}`).join('\n');
  const instrs=s.selInstrs||['piano','bass','drums'];
  const sys=`音楽アレンジャー。コード進行に合わせたJ-POP系伴奏をJSONのみで返す。説明・コードブロック不要。
フォーマット(選択楽器のみ):
{"piano":{"sections":[{"sectionName":"Aメロ","measures":[{"chord":"C","rh":[{"pitch":"E4","startBeat":0,"duration":"h"},{"pitch":"G4","startBeat":2,"duration":"h"}],"lh":[{"pitch":"C3","startBeat":0,"duration":"q"},{"pitch":"G3","startBeat":1,"duration":"q"},{"pitch":"C3","startBeat":2,"duration":"q"},{"pitch":"G3","startBeat":3,"duration":"q"}]}]}]},
"bass":{"sections":[{"sectionName":"Aメロ","measures":[{"chord":"C","notes":[{"pitch":"C2","startBeat":0,"duration":"h"},{"pitch":"G2","startBeat":2,"duration":"q"},{"pitch":"E2","startBeat":3,"duration":"q"}]}]}]},
"guitar":{"sections":[{"sectionName":"Aメロ","measures":[{"chord":"C","notes":[{"pitch":"E3","startBeat":0,"duration":"q"},{"pitch":"G3","startBeat":1,"duration":"q"},{"pitch":"B3","startBeat":2,"duration":"q"},{"pitch":"G3","startBeat":3,"duration":"q"}]}]}]},
"drums":{"sections":[{"sectionName":"Aメロ","measures":[{"chord":"C","pattern":{"HH":[1,1,1,1,1,1,1,1],"SD":[0,0,0,0,1,0,0,0],"BD":[1,0,0,0,1,0,0,0],"CY":[1,0,0,0,0,0,0,0]}}]}]}}
ルール:piano rh=C4以上,lh=C3以下。bass=C1-C3,guitar=E2-E5。startBeat=0〜3,duration=w/h/q/8/16。各小節合計4拍。drums=8拍8要素 0/1。各セクション2小節。楽器:${instrs.join(',')}`;
  try{
    const raw=await callGemini(sys,[{role:'user',content:`${s.title} Key:${s.key} BPM:${s.tempo}\n${cp}`}],1200);
    const t=raw.replace(/```json|```/g,'').trim();
    const p=JSON.parse(t);upd(song=>{song.accomp=p;});toast('🎼 伴奏譜面を生成しました！');
  }catch(e){
    console.error(e);
    if(e.message==='NO_KEY'){openSettings();}
    else{alert('生成失敗。コード進行を入力してから再試行してください。');}
  }
  if(btn){btn.textContent='✦ 伴奏を生成';btn.disabled=false;}
}

function exportMusicXML(){
  const s=cur();if(!s?.accomp)return;
  const dm={w:16,h:8,q:4,'8':2,'16':1};
  const tm={w:'whole',h:'half',q:'quarter','8':'eighth','16':'16th'};
  const ac=s.accomp;const partDefs=[];
  if(ac.piano){partDefs.push({id:'P1',name:'ピアノ右手',instr:'piano',clef:'treble',hand:'rh'});partDefs.push({id:'P2',name:'ピアノ左手',instr:'piano',clef:'bass',hand:'lh'});}
  if(ac.bass)partDefs.push({id:`P${partDefs.length+1}`,name:'ベース',instr:'bass',clef:'bass',hand:null});
  if(ac.guitar)partDefs.push({id:`P${partDefs.length+1}`,name:'ギター',instr:'guitar',clef:'treble',hand:null});
  const pl=partDefs.map(p=>`<score-part id="${p.id}"><part-name>${p.name}</part-name></score-part>`).join('');
  const parts=partDefs.map(p=>{
    let mn=1;const data=ac[p.instr];if(!data)return'';const cl=p.clef==='bass'?'bass':'treble';
    const ms=data.sections?.flatMap(sec=>(sec.measures||[]).map(meas=>{
      const src=p.hand==='rh'?meas.rh||[]:p.hand==='lh'?meas.lh||[]:meas.notes||[];
      let notes=src.filter(n=>n.pitch&&n.pitch!=='R').map(n=>{
        const m=n.pitch.match(/^([A-G])(#|b)?(\d)$/);if(!m)return null;
        return{step:m[1],alter:m[2]==='#'?1:m[2]==='b'?-1:null,oct:m[3],dur:n.duration||'q',type:tm[n.duration||'q']||'quarter'};
      }).filter(Boolean);
      if(!notes.length)notes=[{rest:true,dur:'w',type:'whole'}];
      const nx=notes.map(n=>n.rest
        ?`<note><rest/><duration>16</duration><type>whole</type></note>`
        :`<note><pitch><step>${n.step}</step>${n.alter!=null?`<alter>${n.alter}</alter>`:''}<octave>${n.oct}</octave></pitch><duration>${dm[n.dur]||4}</duration><type>${n.type}</type></note>`
      ).join('');
      const attr=mn===1?`<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>${cl==='bass'?'F':'G'}</sign><line>${cl==='bass'?4:2}</line></clef></attributes>`:'';
      return`<measure number="${mn++}">${attr}${nx}</measure>`;
    }))||[];
    return`<part id="${p.id}">${ms.join('')}</part>`;
  }).join('');
  const xml=`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd"><score-partwise version="3.1"><work><work-title>${esc(s.title)}</work-title></work><part-list>${pl}</part-list>${parts}</score-partwise>`;
  const blob=new Blob([xml],{type:'application/xml'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`${s.title}.musicxml`;a.click();
  URL.revokeObjectURL(url);
  toast('✓ MusicXMLをダウンロード。LogicProで開いてください');
}

/* ── SCORE ── */
function renderScore(s){return`
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
  <span style="font-family:var(--disp);font-size:15px;font-weight:700">コードチャート</span>
  <button class="btn btn-g" style="font-size:11px;padding:5px 12px" onclick="printScore()">🖨 PDF保存</button>
</div>
<div class="sc-wr">
  <div class="sc-ti">${esc(s.title)}</div>
  <div class="sc-meta">Key: ${s.key} · BPM: ${s.tempo}</div>
  ${s.sections.map(sec=>`<div style="margin-bottom:16px"><div class="sc-sn">${esc(sec.name)}</div><div style="display:flex;flex-wrap:wrap;gap:6px">${sec.measures.map((m,i)=>`<div><div style="font-size:9px;color:var(--text3);margin-bottom:2px;font-family:var(--mono)">${i+1}</div><div class="sc-ch${m.chord?' has':''}">${m.chord||'–'}</div></div>`).join('')}</div></div>`).join('')}
  ${s.lyrics?`<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border2)"><div class="flbl">LYRICS</div><pre style="color:var(--text2);font-size:13px;line-height:2.1;white-space:pre-wrap;font-family:var(--font)">${esc(s.lyrics)}</pre></div>`:''}
</div>`;}

function printScore(){
  const s=cur();if(!s)return;
  const w=window.open('','_blank');if(!w)return;
  w.document.write(`<html><head><title>${esc(s.title)}</title><style>body{font-family:'Helvetica Neue',Arial,sans-serif;padding:32px;max-width:720px;margin:0 auto;color:#111}h1{font-size:24px;font-weight:800;margin-bottom:4px}.meta{color:#888;font-size:12px;font-family:monospace;margin-bottom:24px}.sec{margin-bottom:20px}.sn{font-weight:700;font-size:12px;color:#7c3aed;margin-bottom:8px;padding-bottom:3px;border-bottom:2px solid #7c3aed22;font-family:monospace}.cs{display:flex;flex-wrap:wrap;gap:6px}.c{text-align:center}.cn{font-size:9px;color:#bbb;margin-bottom:2px;font-family:monospace}.ch{border:1px solid #ddd;border-radius:7px;padding:7px 12px;font-size:16px;font-weight:700;color:#7c3aed;min-width:52px;font-family:monospace;text-align:center}.lyr{margin-top:26px;padding-top:20px;border-top:2px solid #eee}pre{line-height:2.2;font-size:14px;white-space:pre-wrap;font-family:inherit}</style></head><body><h1>${esc(s.title)}</h1><div class="meta">Key: ${s.key} · BPM: ${s.tempo}</div>${s.sections.map(sec=>`<div class="sec"><div class="sn">${esc(sec.name)}</div><div class="cs">${sec.measures.map((m,i)=>`<div class="c"><div class="cn">${i+1}</div><div class="ch">${m.chord||'–'}</div></div>`).join('')}</div></div>`).join('')}${s.lyrics?`<div class="lyr"><h3 style="font-size:13px;color:#888;margin-bottom:10px">歌詞</h3><pre>${esc(s.lyrics)}</pre></div>`:''}</body></html>`);
  w.document.close();setTimeout(()=>w.print(),400);
}

/* ── AI ── */
function renderAI(s){
  const hasKey=!!getGeminiKey();
  const SUGG=['Aメロのコード提案して','サビをドラマチックにして','黄昏コード教えて','伴奏アレンジのアドバイス'];
  return`
${!hasKey?`<div style="background:rgba(232,160,32,.08);border:1px solid rgba(232,160,32,.3);border-radius:10px;padding:12px 14px;margin-bottom:12px;font-size:12px;color:var(--amber)">
  ⚠️ AIを使うにはGemini APIキーが必要です。
  <button class="btn btn-a" style="margin-left:10px;padding:4px 10px;font-size:11px" onclick="openSettings()">設定を開く</button>
</div>`:''}
<div id="chatMsgs" style="margin-bottom:12px">${aiHist.length===0?`<div class="mb mb-a">「${esc(s.title)}」の制作サポートします！コード・アレンジ・歌詞など何でもどうぞ 🎵</div>`:''} ${aiHist.map(m=>`<div class="mb ${m.role==='user'?'mb-u':'mb-a'}" style="margin-bottom:8px">${m.content.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>')}</div>`).join('')}<div id="chatBottom"></div></div>
<div style="margin-bottom:8px">
  <div class="sugg">${SUGG.map(sg=>`<button class="sg" onclick="sendAI('${sg}')">${sg}</button>`).join('')}</div>
</div>
<div class="chat-row" style="margin-bottom:80px"><input id="chatIn" class="chat-in" placeholder="コード、アレンジ、メロディなど..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendAI();}"><button class="btn btn-a" style="flex-shrink:0" onclick="sendAI()">送信</button></div>
`;}

/* ── DICT（コード進行辞典） ── */
let _dictFilter='全て';
let _dictMainTab='chords'; // 'chords' | 'basics'
let _dictPreviewTimers=[];

const _CHORD_GENRES=['全て','J-POP','ポップス','ロック','ジャズ','ブルース','クラシック','ソウル/R&B','映画音楽'];
const _MOOD_COLOR={'明るい':'#50c878','哀愁':'#3b82f6','切ない':'#9060e8','感動':'#e8a020',
  'ダーク':'#e05050','おしゃれ':'#1eb8a0','渋い':'#8a8070','壮大':'#7c3aed',
  '懐かしい':'#f0b840','グルーヴ':'#e05050','洗練':'#1eb8a0','叙情的':'#9060e8',
  '普遍的':'#50c878','力強い':'#e8a020','神秘':'#7c3aed','スウィング':'#f0b840','史詩的':'#7c3aed'};

function setDictMainTab(t){_dictMainTab=t;renderTab();}
function setDictFilter(g){_dictFilter=g;renderTab();}

function dictPreview(idx){
  _dictPreviewTimers.forEach(t=>clearTimeout(t));_dictPreviewTimers=[];
  const entry=CHORD_DICT[idx];if(!entry)return;
  const bpm=cur()?.tempo||120;const measMs=(4*60000)/bpm;
  entry.chords.forEach((c,i)=>{
    _dictPreviewTimers.push(setTimeout(()=>{
      const el=document.getElementById(`dcard_${idx}`);
      playChord(c,el);
    },i*measMs));
  });
}

function openDictApply(idx){
  const entry=CHORD_DICT[idx];if(!entry)return;
  const s=cur();if(!s)return;
  // セクション選択パネルをカード内に表示/非表示
  const panel=document.getElementById(`dapply_${idx}`);
  if(panel){panel.style.display=panel.style.display==='none'?'block':'none';return;}
}

function applyDictToSection(si,dictIdx){
  const chords=CHORD_DICT[dictIdx].chords;
  upd(s=>{
    const sec=s.sections[si];
    const newMeas=chords.map((c,i)=>({
      id:sec.measures[i]?.id||gid(),
      chord:c,
      melNotes:sec.measures[i]?.melNotes||[]
    }));
    // コード数が小節数を超える場合は小節を追加
    if(chords.length>sec.measures.length){
      for(let i=sec.measures.length;i<chords.length;i++){
        newMeas[i]={id:gid(),chord:chords[i],melNotes:[]};
      }
    }
    s.sections[si].measures=newMeas;
  });
  document.querySelectorAll('.dapply-panel').forEach(p=>p.style.display='none');
  toast(`✓「${cur()?.sections[si]?.name}」に適用しました`);
  // コードタブに移動して確認
  switchTab('chords');
}

/* 音楽基礎 — 各カードの視覚要素 */
function _basicsVisual(idx){
  const C='#e8a020',P='#9060e8',T='#1eb8a0',B='#3b82f6',R='#e05050',G='#50c878';
  const stLines=(x1,x2)=>[8,16,24,32,40].map(y=>`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#555" stroke-width="0.7"/>`).join('');
  const v=[
    /* 0: 五線譜 */
    `<svg width="100%" height="72" viewBox="0 0 240 72" style="max-width:240px">
      ${[8,16,24,32,40].map((y,i)=>`<line x1="28" y1="${y}" x2="200" y2="${y}" stroke="#666" stroke-width="0.8"/>
        <text x="2" y="${y+4}" font-size="8" fill="#777" font-family="monospace">第${5-i}線</text>`).join('')}
      <ellipse cx="130" cy="24" rx="7" ry="4.5" fill="${T}" transform="rotate(-12,130,24)"/>
      <line x1="137" y1="23" x2="137" y2="4" stroke="${T}" stroke-width="1.3"/>
      <text x="145" y="22" font-size="9" fill="${T}" font-family="monospace">← 第3線</text>
      <line x1="80" y1="52" x2="96" y2="52" stroke="${C}" stroke-width="1"/>
      <ellipse cx="88" cy="56" rx="7" ry="4.5" fill="${C}" transform="rotate(-12,88,56)"/>
      <text x="68" y="70" font-size="8" fill="${C}" font-family="monospace">← 加線（五線の外）</text>
    </svg>`,
    /* 1: ト音記号/ヘ音記号 */
    `<div style="display:flex;gap:24px;align-items:center">
      <div style="text-align:center"><div style="font-size:52px;line-height:1;font-family:serif;color:${C}">𝄞</div><div style="font-size:10px;color:#999;margin-top:2px">ト音記号</div><div style="font-size:9px;color:#666">（高音部）</div></div>
      <div style="font-size:20px;color:#444">vs</div>
      <div style="text-align:center"><div style="font-size:38px;line-height:1.2;font-family:serif;color:${P};margin-top:4px">𝄢</div><div style="font-size:10px;color:#999;margin-top:4px">ヘ音記号</div><div style="font-size:9px;color:#666">（低音部）</div></div>
    </div>`,
    /* 2: 音符の長さ */
    `<div style="overflow-x:auto"><svg width="230" height="56" viewBox="0 0 230 56">
      ${[[18,'w'],[56,'h'],[94,'q'],[132,'8'],[170,'16']].map(([cx,dur],i)=>{
        const labels=['全音符','2分','4分','8分','16分'];
        const sx=cx+6,sy1=30,sy2=10;
        let s='';
        if(dur==='w') s+=`<ellipse cx="${cx}" cy="30" rx="8" ry="5.5" fill="none" stroke="${C}" stroke-width="1.6" transform="rotate(-12,${cx},30)"/>`;
        else if(dur==='h') s+=`<ellipse cx="${cx}" cy="30" rx="7" ry="4.5" fill="none" stroke="${C}" stroke-width="1.5" transform="rotate(-12,${cx},30)"/>`;
        else s+=`<ellipse cx="${cx}" cy="30" rx="7" ry="4.5" fill="${C}" transform="rotate(-12,${cx},30)"/>`;
        if(dur!=='w') s+=`<line x1="${sx}" y1="${sy1-1}" x2="${sx}" y2="${sy2}" stroke="${C}" stroke-width="1.2"/>`;
        if(dur==='8') s+=`<path d="M ${sx} ${sy2} q 8 4 4 12" stroke="${C}" fill="none" stroke-width="1.2"/>`;
        if(dur==='16') s+=`<path d="M ${sx} ${sy2} q 8 4 4 11" stroke="${C}" fill="none" stroke-width="1.2"/><path d="M ${sx} ${sy2+5} q 8 4 4 11" stroke="${C}" fill="none" stroke-width="1.2"/>`;
        s+=`<text x="${cx}" y="52" font-size="8" fill="#999" font-family="monospace" text-anchor="middle">${labels[i]}</text>`;
        return s;
      }).join('')}
    </svg></div>`,
    /* 3: 付点音符 */
    `<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <svg width="80" height="46" viewBox="0 0 80 46">
        <ellipse cx="22" cy="26" rx="7" ry="4.5" fill="${P}" transform="rotate(-12,22,26)"/>
        <line x1="29" y1="25" x2="29" y2="6" stroke="${P}" stroke-width="1.2"/>
        <circle cx="37" cy="24" r="3.5" fill="${C}"/>
        <text x="9" y="44" font-size="9" fill="${P}" font-family="monospace">付点4分</text>
      </svg>
      <span style="font-size:18px;color:#666">=</span>
      <div style="text-align:center"><div style="font-size:26px;font-weight:800;color:${C};font-family:monospace;line-height:1">1.5</div><div style="font-size:10px;color:#999">拍</div></div>
      <div style="font-size:10px;color:#777;line-height:1.6">1拍 + 0.5拍<br>（元の長さ × 1.5）</div>
    </div>`,
    /* 4: 三連符 */
    `<div style="overflow-x:auto"><svg width="180" height="56" viewBox="0 0 180 56">
      ${[28,90,152].map(cx=>`<ellipse cx="${cx}" cy="36" rx="7" ry="4.5" fill="${B}" transform="rotate(-12,${cx},36)"/>
        <line x1="${cx+7}" y1="35" x2="${cx+7}" y2="14" stroke="${B}" stroke-width="1.2"/>`).join('')}
      <path d="M 24 12 Q 90 -2 158 12" stroke="${C}" fill="none" stroke-width="1.4"/>
      <text x="90" y="8" font-size="14" fill="${C}" font-family="monospace" text-anchor="middle" font-weight="bold">3</text>
      <text x="90" y="54" font-size="9" fill="#999" font-family="monospace" text-anchor="middle">3つで本来の2拍分</text>
    </svg></div>`,
    /* 5: 拍子記号 */
    `<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
      ${[['4','4',C,'四拍子'],['3','4',P,'三拍子'],['6','8',T,'六拍子（複合）']].map(([a,b,col,lbl])=>`
        <div style="text-align:center">
          <svg width="36" height="46" viewBox="0 0 36 46">${stLines(2,34)}
            <text x="11" y="22" font-size="18" fill="${col}" font-family="serif" font-weight="bold">${a}</text>
            <text x="11" y="40" font-size="18" fill="${col}" font-family="serif" font-weight="bold">${b}</text>
          </svg>
          <div style="font-size:9px;color:#888;margin-top:1px">${lbl}</div>
        </div>`).join('')}
    </div>`,
    /* 6: テンポとBPM */
    `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <span style="font-size:40px;color:${C};line-height:1">♩</span>
      <span style="font-size:26px;color:#666">=</span>
      <div style="text-align:center"><div style="font-size:34px;font-weight:800;color:${T};font-family:monospace;line-height:1">120</div><div style="font-size:9px;color:#888;font-family:monospace">BPM</div></div>
      <div style="display:flex;flex-direction:column;gap:4px;margin-left:6px">
        <div style="font-size:10px;color:#888;font-family:monospace">60   → ゆっくり 🐢</div>
        <div style="font-size:10px;color:${C};font-family:monospace">120 → 普通 🚶</div>
        <div style="font-size:10px;color:${R};font-family:monospace">160+ → 速い 🏃</div>
      </div>
    </div>`,
    /* 7: コードとは */
    `<div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">
      ${[['C','ルート',C],['E','長3度',P],['G','完全5度',T]].map(([n,label,col],i)=>`
        ${i>0?`<span style="font-size:20px;color:#555;align-self:center;padding-top:4px">+</span>`:''}
        <div style="text-align:center">
          <div style="width:40px;height:40px;border-radius:50%;background:${col}20;border:2px solid ${col};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;color:${col};font-family:monospace">${n}</div>
          <div style="font-size:9px;color:#888;margin-top:3px;line-height:1.3">${label}</div>
        </div>`).join('')}
      <span style="font-size:22px;color:#666;align-self:center;padding:0 6px">→</span>
      <div style="text-align:center">
        <div style="font-size:22px;font-weight:800;color:${C};font-family:monospace;background:${C}18;border:2px solid ${C}55;border-radius:8px;padding:6px 14px">C</div>
        <div style="font-size:9px;color:#888;margin-top:3px">コード（和音）</div>
      </div>
    </div>`,
    /* 8: キー（調） */
    `<div>
      <div style="display:flex;gap:3px;margin-bottom:6px">
        ${['C','D','E','F','G','A','B'].map(n=>`<div style="flex:1;text-align:center;background:rgba(255,255,255,.09);border:1px solid #444;border-radius:5px;padding:6px 0;font-size:12px;font-weight:800;color:${C};font-family:monospace">${n}</div>`).join('')}
      </div>
      <div style="font-size:9px;color:#888;font-family:monospace;text-align:center">Cメジャースケール（白鍵7音のみ）</div>
    </div>`,
    /* 9: ダイアトニックコード */
    `<div style="overflow-x:auto">
      <div style="display:flex;gap:3px;min-width:270px">
        ${[['Ⅰ','C',G],['Ⅱm','Dm','#aaa'],['Ⅲm','Em','#aaa'],['Ⅳ','F',G],['Ⅴ','G',C],['Ⅵm','Am',P],['Ⅶ°','B°',R]].map(([r,c,col])=>`
          <div style="flex:1;text-align:center">
            <div style="font-size:9px;color:${col};font-family:monospace;margin-bottom:2px;font-weight:700">${r}</div>
            <div style="font-size:10px;font-weight:700;color:var(--text);font-family:monospace;background:var(--bg4);border:1px solid ${col}55;border-radius:5px;padding:4px 1px">${c}</div>
          </div>`).join('')}
      </div>
      <div style="font-size:9px;color:#888;margin-top:6px;font-family:monospace">Cメジャーの7つのダイアトニックコード</div>
    </div>`,
    /* 10: 音程（インターバル） */
    `<div style="overflow-x:auto"><svg width="220" height="54" viewBox="0 0 220 54">
      ${[6,14,22,30,38].map(y=>`<line x1="8" y1="${y}" x2="200" y2="${y}" stroke="#444" stroke-width="0.6"/>`).join('')}
      <ellipse cx="40" cy="30" rx="7" ry="4.5" fill="${T}" transform="rotate(-12,40,30)"/>
      <line x1="47" y1="29" x2="47" y2="8" stroke="${T}" stroke-width="1.2"/>
      <text x="34" y="52" font-size="9" fill="${T}" font-family="monospace">C</text>
      <ellipse cx="110" cy="22" rx="7" ry="4.5" fill="${P}" transform="rotate(-12,110,22)"/>
      <line x1="117" y1="21" x2="117" y2="0" stroke="${P}" stroke-width="1.2"/>
      <text x="104" y="52" font-size="9" fill="${P}" font-family="monospace">E</text>
      <ellipse cx="180" cy="14" rx="7" ry="4.5" fill="${C}" transform="rotate(-12,180,14)"/>
      <line x1="187" y1="13" x2="187" y2="-8" stroke="${C}" stroke-width="1.2"/>
      <text x="174" y="52" font-size="9" fill="${C}" font-family="monospace">G</text>
      <line x1="47" y1="5" x2="117" y2="5" stroke="${P}" stroke-width="1" stroke-dasharray="3,2"/>
      <text x="82" y="3" font-size="8" fill="${P}" font-family="monospace" text-anchor="middle">長3度</text>
      <line x1="117" y1="9" x2="187" y2="9" stroke="${C}" stroke-width="1" stroke-dasharray="3,2"/>
      <text x="152" y="7" font-size="8" fill="${C}" font-family="monospace" text-anchor="middle">短3度</text>
    </svg></div>`,
    /* 11: コードの種類 */
    `<div style="display:flex;gap:6px;flex-wrap:wrap">
      ${[[`C`,`メジャー`,G],[`Cm`,`マイナー`,P],[`C7`,`セブンス`,C],[`CM7`,`メジャー7`,T],[`Cdim`,`ディミニッシュ`,R]].map(([c,l,col])=>`
        <div style="text-align:center">
          <div style="font-size:13px;font-weight:800;color:${col};font-family:monospace;background:${col}18;border:1.5px solid ${col}55;border-radius:6px;padding:5px 8px">${c}</div>
          <div style="font-size:8px;color:#888;margin-top:3px">${l}</div>
        </div>`).join('')}
    </div>`,
    /* 12: スケール */
    `<div>
      <div style="display:flex;gap:3px;align-items:flex-end;margin-bottom:4px">
        ${[['C',32,C],['D',18,'#ccc'],['E',18,'#ccc'],['F',18,'#ccc'],['G',22,'#ccc'],['A',18,'#ccc'],['B',18,'#ccc'],['C',32,C]].map(([n,h,col])=>`
          <div style="flex:1;text-align:center">
            <div style="height:${h}px;background:${col}44;border:1px solid ${col};border-radius:3px 3px 0 0;margin-bottom:3px"></div>
            <div style="font-size:10px;font-weight:700;color:${col};font-family:monospace">${n}</div>
          </div>`).join('')}
      </div>
      <div style="font-size:9px;color:#888;font-family:monospace;text-align:center">全全半全全全半（メジャースケールのパターン）</div>
    </div>`,
  ];
  return v[idx]||'';
}

function _renderMusicBasics(){
  return`<div style="display:flex;flex-direction:column;gap:12px">
${MUSIC_BASICS.map((item,idx)=>`
<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--rl);padding:16px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <div style="font-weight:800;font-size:15px;color:var(--text)">${esc(item.title)}</div>
    <span style="font-size:9px;padding:3px 8px;border-radius:10px;background:rgba(30,184,160,.15);color:var(--teal);font-family:var(--mono);font-weight:700;flex-shrink:0;margin-left:8px">音楽基礎</span>
  </div>
  <div style="background:var(--bg4);border-radius:8px;padding:12px 14px;margin-bottom:12px;min-height:50px;display:flex;align-items:center">
    ${_basicsVisual(idx)}
  </div>
  <div style="font-size:12px;color:var(--text2);line-height:1.9;margin-bottom:10px">${esc(item.body)}</div>
  <div style="background:rgba(30,184,160,.08);border-left:3px solid var(--teal);border-radius:0 6px 6px 0;padding:8px 11px;font-size:11px;color:var(--teal);line-height:1.7">
    💡 ${esc(item.tip)}
  </div>
</div>`).join('')}
</div>`;
}

function renderDict(){
  const s=cur();
  const filtered=_dictMainTab==='chords'?(_dictFilter==='全て'?CHORD_DICT:CHORD_DICT.filter(e=>e.genre.includes(_dictFilter))):[];
  return`
<div style="font-family:var(--disp);font-size:16px;font-weight:800;margin-bottom:14px">📖 辞典</div>

<!-- メインタブ（2択） -->
<div style="display:flex;gap:8px;margin-bottom:16px">
  <button onclick="setDictMainTab('chords')" style="flex:1;padding:11px 8px;border-radius:10px;border:2px solid ${_dictMainTab==='chords'?'var(--amber)':'var(--border)'};background:${_dictMainTab==='chords'?'rgba(232,160,32,.12)':'transparent'};color:${_dictMainTab==='chords'?'var(--amber)':'var(--text3)'};font-weight:700;font-size:13px;cursor:pointer;transition:.15s">🎵 コード進行</button>
  <button onclick="setDictMainTab('basics')" style="flex:1;padding:11px 8px;border-radius:10px;border:2px solid ${_dictMainTab==='basics'?'var(--teal)':'var(--border)'};background:${_dictMainTab==='basics'?'rgba(30,184,160,.12)':'transparent'};color:${_dictMainTab==='basics'?'var(--teal)':'var(--text3)'};font-weight:700;font-size:13px;cursor:pointer;transition:.15s">📚 音楽基礎</button>
</div>

${_dictMainTab==='basics'?_renderMusicBasics():`
<!-- ジャンルサブフィルター -->
<div style="font-size:11px;color:var(--text3);line-height:1.7;margin-bottom:10px">▶ で試聴、「使う」でコード進行タブに即反映。</div>
<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:14px">
  ${_CHORD_GENRES.map(g=>`<button onclick="setDictFilter('${g}')" style="font-size:10px;padding:4px 10px;border-radius:20px;border:1px solid ${_dictFilter===g?'var(--amber)':'var(--border2)'};background:${_dictFilter===g?'rgba(232,160,32,.15)':'transparent'};color:${_dictFilter===g?'var(--amber)':'var(--text3)'};cursor:pointer">${g}</button>`).join('')}
</div>

<!-- コード進行カード一覧 -->
<div style="display:flex;flex-direction:column;gap:12px">
${filtered.map((entry)=>{
  const realIdx=CHORD_DICT.indexOf(entry);
  const moodColor=_MOOD_COLOR[entry.mood.split('・')[0]]||'var(--text2)';
  return`
<div id="dcard_${realIdx}" style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--rl);padding:16px">
  <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px">
    <div style="flex:1">
      <div style="font-weight:800;font-size:15px;margin-bottom:6px;color:var(--text)">${esc(entry.name)}</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap">
        <span style="font-size:10px;padding:3px 9px;border-radius:10px;background:rgba(232,160,32,.12);color:var(--amber);font-family:var(--mono);font-weight:700">${esc(entry.genre)}</span>
        <span style="font-size:10px;padding:3px 9px;border-radius:10px;background:${moodColor}18;color:${moodColor};font-family:var(--mono)">${esc(entry.mood)}</span>
      </div>
    </div>
    <div style="display:flex;gap:5px;flex-shrink:0">
      <button class="btn btn-g" style="font-size:10px;padding:5px 10px" onclick="dictPreview(${realIdx})">▶ 試聴</button>
      ${s?`<button class="btn btn-a" style="font-size:10px;padding:5px 10px" onclick="openDictApply(${realIdx})">使う ▾</button>`:''}
    </div>
  </div>
  <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">
    ${entry.chords.map((c,i)=>`<span style="background:var(--bg4);border:1px solid var(--border2);border-radius:6px;padding:4px 10px;font-size:13px;font-weight:700;font-family:var(--mono);color:var(--text)">${i+1}.<span style="color:var(--amber);margin-left:3px">${c}</span></span>`).join('')}
  </div>
  <div style="font-size:12px;color:var(--text2);line-height:1.9;margin-bottom:8px">${esc(entry.desc)}</div>
  <div style="font-size:11px;color:var(--text3);font-family:var(--mono);line-height:1.7">🎵 ${entry.ex.map(e=>esc(e)).join(' · ')}</div>
  ${s?`<div id="dapply_${realIdx}" class="dapply-panel" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border2)">
    <div style="font-size:11px;color:var(--text2);margin-bottom:8px;font-weight:700">どのセクションに適用する？</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${s.sections.map((sec,si)=>`<button class="btn btn-g" style="font-size:11px;padding:5px 12px;border-color:var(--teal);color:var(--teal)" onclick="applyDictToSection(${si},${realIdx})">${esc(sec.name)}</button>`).join('')}
    </div>
  </div>`:''}
</div>`;
}).join('')}
</div>`}
`;
}

async function sendAI(text){
  const s=cur();if(!s)return;
  if(!getGeminiKey()){openSettings();return;}
  const inp=document.getElementById('chatIn');
  const t=(text||inp?.value||'').trim();if(!t)return;if(inp)inp.value='';
  aiHist.push({role:'user',content:t});renderTab();
  setTimeout(()=>document.getElementById('chatBottom')?.scrollIntoView({behavior:'smooth'}),50);
  const cp=s.sections.map(x=>`${x.name}:${x.measures.map(m=>m.chord||'–').join('|')}`).join('\n');
  const sys=`J-POP音楽制作アドバイザー。「${s.title}」制作中(${s.status})。Key:${s.key} BPM:${s.tempo}\nコード:\n${cp}\n歌詞:${s.lyrics||'未入力'}\n短く答えて。コード提案はC→Am→F→G形式で。`;
  try{
    const reply=await callGemini(sys,aiHist,800);
    aiHist.push({role:'assistant',content:reply});
  }catch(e){
    if(e.message==='NO_KEY'){openSettings();return;}
    aiHist.push({role:'assistant',content:`⚠️ エラー: ${e.message}`});
  }
  renderTab();setTimeout(()=>document.getElementById('chatBottom')?.scrollIntoView({behavior:'smooth'}),100);
}
