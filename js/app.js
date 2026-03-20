// ─── 初期化 ───
load();
initSDrop();

if(!curId&&songs.length===0){
  const s=mkSong('無題の曲 1');songs.push(s);curId=s.id;
  try{localStorage.setItem('kch_v4',JSON.stringify({songs,curId}));}catch(e){}
}

if(window.innerWidth<=768)sbVis=false;
if(window.innerWidth>768){document.getElementById('sidebar').style.display=sbVis?'flex':'none';}

renderAll();
renderSyncBar();

// クリックでドロップダウン・ピッカーを閉じる
document.addEventListener('click',e=>{
  if(!e.target.closest('.status-wr'))document.getElementById('stDrop').classList.remove('open');
  if(!e.target.closest('.cc')&&!e.target.closest('.cpk'))closeAllPickers();
  if(!e.target.closest('#npk')&&!e.target.closest('.add-note-btn'))closeNotePicker();
});

// GIS ロード後にClientIDがあれば自動サインイン
window.addEventListener('load',()=>{
  if(getClientId()&&typeof google!=='undefined'){
    initGIS();
    setTimeout(()=>tokenClient?.requestAccessToken({prompt:''}),500);
  }
});
