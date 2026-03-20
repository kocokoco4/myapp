// ─── UI レンダリング・曲管理 ───

/* ── テーマ切替 ── */
function toggleTheme(){
  const cur=document.documentElement.getAttribute('data-theme')||'dark';
  const next=cur==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',next);
  localStorage.setItem('kch_theme',next);
  _syncThemeBtn(next);
}
function _syncThemeBtn(t){
  const btn=document.getElementById('themeBtn');
  if(btn)btn.textContent=t==='dark'?'🌙':'☀️';
}

/* ── 曲CRUD ── */
function addSong(){const s=mkSong();songs.unshift(s);curId=s.id;curTab='lyrics';aiHist=[];save();renderAll();}
function delSong(id,e){e.stopPropagation();songs=songs.filter(s=>s.id!==id);if(curId===id)curId=songs[0]?.id||null;save();renderAll();}
function selSong(id){curId=id;curTab='lyrics';aiHist=[];save();closeSB();renderAll();}
function onTitleChange(v){const s=cur();if(!s)return;s.title=v;s.updatedAt=Date.now();save();renderSongList();}

/* ── サイドバー ── */
function toggleSB(){
  const isMobile=window.innerWidth<=768;
  if(isMobile){
    const sb=document.getElementById('sidebar');
    const ov=document.getElementById('sb-overlay');
    const isOpen=sb.classList.contains('open');
    sb.classList.toggle('open',!isOpen);
    ov.classList.toggle('open',!isOpen);
  }else{
    sbVis=!sbVis;
    document.getElementById('sidebar').style.display=sbVis?'flex':'none';
  }
}
function closeSB(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sb-overlay').classList.remove('open');
}

/* ── ステータス ── */
function initSDrop(){
  document.getElementById('stDrop').innerHTML=STATS.map(s=>`<div class="sopt" style="color:${STC[s]}" onclick="setStatus('${s}')">${s}</div>`).join('');
}
function toggleSDrop(){document.getElementById('stDrop').classList.toggle('open');}
function setStatus(s){upd(song=>song.status=s);document.getElementById('stDrop').classList.remove('open');renderStatusBtn();}
function renderStatusBtn(){
  const s=cur();if(!s)return;
  const b=document.getElementById('stBtn');
  b.textContent=s.status;
  b.style.background=STC[s.status]+'22';
  b.style.borderColor=STC[s.status]+'66';
  b.style.color=STC[s.status];
}

/* ── レンダリング ── */
function renderAll(){
  renderSongList();const s=cur();
  ['topbar','tabsBar','tabC','bnav'].forEach(id=>document.getElementById(id).style.display='');
  document.getElementById('emptyS').style.display='none';
  if(!s){
    ['topbar','tabsBar','tabC','bnav'].forEach(id=>document.getElementById(id).style.display='none');
    document.getElementById('emptyS').style.display='flex';
    return;
  }
  document.getElementById('titleIn').value=s.title;
  renderStatusBtn();renderTabsBar();renderTab();renderBNav();
}

function renderSongList(){
  const el=document.getElementById('songList');
  if(!songs.length){
    el.innerHTML='<p style="color:var(--text3);font-size:11px;text-align:center;margin-top:18px;font-family:var(--mono)">— empty —</p>';
    return;
  }
  el.innerHTML=[...songs].sort((a,b)=>b.updatedAt-a.updatedAt).map(s=>`<div class="si${s.id===curId?' active':''}" onclick="selSong('${s.id}')"><div class="sn">${esc(s.title)}</div><span class="stag" style="background:${STC[s.status]}18;color:${STC[s.status]}">${s.status}</span><button class="sdel" onclick="delSong('${s.id}',event)">×</button></div>`).join('');
}

function renderTabsBar(){
  document.getElementById('tabsBar').innerHTML=TABS.map(t=>`<button class="tbtn${t.id===curTab?' active':''}" onclick="switchTab('${t.id}')">${t.l}</button>`).join('');
}

function renderBNav(){
  document.querySelectorAll('.bnb').forEach(b=>b.classList.toggle('active',b.dataset.tab===curTab));
}

function switchTab(t){curTab=t;stopSectionPlay();stopMetronome();closeNotePicker();renderTabsBar();renderBNav();renderTab();}

function renderTab(){
  const s=cur();if(!s)return;
  const el=document.getElementById('tabC');
  el.className='tab-c fi';void el.offsetWidth;
  if(curTab==='lyrics')el.innerHTML=renderLyrics(s);
  else if(curTab==='melody')el.innerHTML=renderMelody(s);
  else if(curTab==='chords')el.innerHTML=renderChords(s);
  else if(curTab==='accomp')el.innerHTML=renderAccomp(s);
  else if(curTab==='score')el.innerHTML=renderScore(s);
  else if(curTab==='dict')el.innerHTML=renderDict();
  else if(curTab==='ai'){el.innerHTML=renderAI(s);const m=document.getElementById('chatMsgs');if(m)m.scrollTop=m.scrollHeight;}
}
