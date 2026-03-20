// ─── タブレンダラー・インタラクション ───

/* ── LYRICS ── */
function renderLyrics(s){return`
<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
  <div><label class="flbl">KEY</label><select class="inp" onchange="upd(s=>s.key=this.value)">${KEYS.map(k=>`<option${k===s.key?' selected':''}>${k}</option>`).join('')}</select></div>
  <div><label class="flbl">BPM</label><input type="number" class="inp" style="width:72px" value="${s.tempo}" min="40" max="300" onchange="upd(s=>s.tempo=parseInt(this.value)||120)"></div>
</div>
<div style="margin-bottom:12px">
  <label class="flbl">LYRICS</label>
  <textarea class="txa" id="lyricsTA" style="min-height:240px"
    placeholder="[Aメロ]&#10;&#10;[サビ]&#10;&#10;// フレーズメモをどんどん貼り付けてOK"
    oninput="saveOnly(s=>s.lyrics=this.value)">${esc(s.lyrics)}</textarea>
</div>
<div>
  <label class="flbl">MEMO</label>
  <textarea class="txa" id="memoTA" style="min-height:65px"
    placeholder="コンセプト、参考曲など"
    oninput="saveOnly(s=>s.memo=this.value)">${esc(s.memo)}</textarea>
</div>`;}

/* ── MELODY ── */
function renderMelody(s){
  return`
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
  <span style="font-family:var(--disp);font-size:15px;font-weight:700">メロディ</span>
  <span style="font-size:10px;color:var(--text3);font-family:var(--mono)">音符をタップして追加 · 鳴らして確認</span>
</div>
<div style="font-size:11px;color:var(--text2);background:var(--bg3);border-radius:8px;padding:10px 12px;margin-bottom:14px;border:1px solid var(--border);line-height:1.8">
  各セクション・各小節に音符を追加できます。<br>コードタブでコード進行を入力しておくと、コード名も一緒に表示されます。
</div>
${s.sections.map((sec,si)=>`
<div class="mel-sec">
  <input class="mel-sec-name" value="${esc(sec.name)}" oninput="saveOnly(s=>s.sections[${si}].name=this.value)">
  <div style="margin-bottom:12px">
    <div class="staff-block">
      ${melodyStaffSVG(sec.measures)}
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
  <div style="display:flex;gap:6px">
    <button class="btn btn-g" style="font-size:10px;padding:4px 10px" onclick="addMelMeasure(${si})">+ 小節</button>
    ${sec.measures.length>1?`<button class="btn btn-g" style="font-size:10px;padding:4px 10px" onclick="delMelMeasure(${si})">- 小節</button>`:''}
  </div>
</div>`).join('')}`;
}

function previewNote(pitch){playNote(pitch);}
function delMelNote(si,mi,ni){upd(s=>{s.sections[si].measures[mi].melNotes.splice(ni,1);});}
function addMelMeasure(si){upd(s=>s.sections[si].measures.push({id:gid(),chord:s.sections[si].measures[s.sections[si].measures.length-1]?.chord||'',melNotes:[]}));}
function delMelMeasure(si){upd(s=>{if(s.sections[si].measures.length>1)s.sections[si].measures.pop();});}

/* ── Note Picker ── */
let npState={pitch:'C4',dur:'q'};

function openNotePicker(e,si,mi){
  e.stopPropagation();
  const btn=e.currentTarget;const rect=btn.getBoundingClientRect();
  const npk=document.getElementById('npk');
  npk.style.display='block';
  const top=rect.bottom+6;const left=Math.min(rect.left,window.innerWidth-290);
  npk.style.top=top+'px';npk.style.left=left+'px';
  notePickerCb=(pitch,dur)=>addMelNote(si,mi,pitch,dur);
  renderNotePicker();
}

function renderNotePicker(){
  const npk=document.getElementById('npk');
  npk.innerHTML=`
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px">
  <span style="font-size:11px;font-weight:700;color:var(--teal);font-family:var(--mono)">音符を追加</span>
  <button style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;padding:2px" onclick="closeNotePicker()">✕</button>
</div>
<div class="npk-row">
  <span class="npk-lbl">オクターブ</span>
  <div style="display:flex;gap:3px">${OCTAVES.map(o=>`<button class="npk-note${npState.pitch.slice(-1)==String(o)?' sel':''}" onclick="npSetOct(${o})">${o}</button>`).join('')}</div>
</div>
<div class="npk-row">
  <span class="npk-lbl">音名</span>
  <div style="display:flex;gap:3px;flex-wrap:wrap">${NOTE_NAMES.map(n=>{const full=n+npState.pitch.slice(-1);const isSel=npState.pitch===full;return`<button class="npk-note${isSel?' sel':''}${n.includes('#')?' sharp':''}" onclick="npSetNote('${n}')">${n}</button>`;}).join('')}</div>
</div>
<div class="npk-row"><span class="npk-lbl">音価</span><div class="dur-row">${DURS.map(d=>`<button class="dur-btn${npState.dur===d.v?' sel':''}" onclick="npSetDur('${d.v}')">${d.l}</button>`).join('')}</div></div>
<div style="margin-top:10px;display:flex;gap:6px;align-items:center">
  <div style="flex:1;background:var(--bg4);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;font-family:var(--mono);font-size:13px;color:var(--teal)">${npState.pitch} / ${DURS.find(d=>d.v===npState.dur)?.l}</div>
  <button class="btn" style="background:var(--teal);color:var(--bg);padding:7px 14px" onclick="npPreview()">▶</button>
  <button class="btn btn-a" style="padding:7px 14px" onclick="npConfirm()">追加</button>
</div>`;
}

function npSetOct(o){const root=npState.pitch.replace(/\d/,'');npState.pitch=root+o;renderNotePicker();}
function npSetNote(n){const oct=npState.pitch.slice(-1);npState.pitch=n+oct;renderNotePicker();}
function npSetDur(d){npState.dur=d;renderNotePicker();}
function npPreview(){playNote(npState.pitch);}
function npConfirm(){if(notePickerCb)notePickerCb(npState.pitch,npState.dur);closeNotePicker();}
function closeNotePicker(){document.getElementById('npk').style.display='none';notePickerCb=null;}
function addMelNote(si,mi,pitch,dur){
  upd(s=>{
    if(!s.sections[si].measures[mi].melNotes)s.sections[si].measures[mi].melNotes=[];
    s.sections[si].measures[mi].melNotes.push({pitch,duration:dur,startBeat:s.sections[si].measures[mi].melNotes.length*0.5});
  });
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
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
    <input class="sni" value="${esc(sec.name)}" oninput="saveOnly(s=>s.sections[${si}].name=this.value)">
    <button class="btn btn-g" style="padding:3px 8px;font-size:10px" onclick="addMeasure(${si})">+小節</button>
    ${s.sections.length>1?`<button style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;padding:2px" onclick="delSection(${si})">×</button>`:''}
  </div>
  <div class="cg" id="cg_${si}">
    ${sec.measures.map((m,mi)=>`
    <div class="cc${m.chord?' has':''}" id="cc_${si}_${mi}" onclick="handleCC(event,${si},${mi},'${esc(m.chord)}')">
      <span class="bn">${mi+1}</span>
      <span class="cn">${m.chord||'–'}</span>
    </div>`).join('')}
  </div>
  <div class="qr">${QP.map(p=>`<button class="qb" onclick="applyProg(${si},${JSON.stringify(p.c)})">${p.l}</button>`).join('')}</div>
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
function addSection(){upd(s=>s.sections.push({id:gid(),name:'新セクション',measures:Array(4).fill(0).map(()=>({id:gid(),chord:'',melNotes:[]}))}));}
function delSection(si){upd(s=>{if(s.sections.length>1)s.sections.splice(si,1);});}
function addMeasure(si){upd(s=>s.sections[si].measures.push({id:gid(),chord:'',melNotes:[]}));}
function delMeasure(si,mi){upd(s=>{if(s.sections[si].measures.length>1)s.sections[si].measures.splice(mi,1);});closeAllPickers();}
function applyProg(si,cs){
  upd(s=>{
    s.sections[si].measures=cs.map((c,i)=>({
      ...s.sections[si].measures[i],
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
:Object.entries(INSTRS).filter(([k])=>ac[k]).map(([k,v])=>`<div style="margin-bottom:20px"><div class="staff-part-lbl" style="color:${v.color}">▸ ${v.label}</div>${ac[k].sections?.map(sec=>`<div style="margin-bottom:12px"><div class="staff-sec-lbl">${sec.sectionName||sec.name||'SEC'}</div><div class="staff-block">${k==='piano'?grandStaffSVG(sec.measures,v.color):k==='drums'?drumStaffSVG(sec.measures):singleStaffSVG(sec.measures,k==='bass'?'bass':'treble',v.color)}</div></div>`).join('')}</div>`).join('')}`;}

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
  return`<div class="chat-wr" style="height:calc(100vh - 175px)">
${!hasKey?`<div style="background:rgba(232,160,32,.08);border:1px solid rgba(232,160,32,.3);border-radius:10px;padding:12px 14px;margin-bottom:12px;font-size:12px;color:var(--amber)">
  ⚠️ AIを使うにはGemini APIキーが必要です。
  <button class="btn btn-a" style="margin-left:10px;padding:4px 10px;font-size:11px" onclick="openSettings()">設定を開く</button>
</div>`:''}
<div class="chat-msgs" id="chatMsgs">${aiHist.length===0?`<div class="mb mb-a">「${esc(s.title)}」の制作サポートします！コード・アレンジ・歌詞など何でもどうぞ 🎵</div>`:''} ${aiHist.map(m=>`<div class="mb ${m.role==='user'?'mb-u':'mb-a'}">${m.content.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>')}</div>`).join('')}<div id="chatBottom"></div></div>
<div class="chat-iw">
  <div class="sugg">${SUGG.map(sg=>`<button class="sg" onclick="sendAI('${sg}')">${sg}</button>`).join('')}</div>
  <div class="chat-row"><input id="chatIn" class="chat-in" placeholder="コード、アレンジ、メロディなど..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendAI();}"><button class="btn btn-a" onclick="sendAI()">送信</button></div>
</div></div>`;}

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
