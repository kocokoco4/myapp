// ─── データ管理・状態 ───
function mkSong(t='新しい曲'){
  return{
    id:gid(),title:t,status:'アイデア',key:'C',tempo:120,meter:'4/4',
    lyrics:'',memo:'',
    sections:DSECS.map(n=>({id:gid(),name:n,lyrics:'',measures:Array(4).fill(0).map(()=>({id:gid(),chord:'',melNotes:[]}))})),
    selInstrs:['piano','bass','drums'],
    accomp:null,createdAt:Date.now(),updatedAt:Date.now()
  };
}

let songs=[],curId=null,curTab='lyrics',aiHist=[],sbVis=window.innerWidth>768,notePickerCb=null;

// drive.js がロードされたら上書きする
let scheduleDriveSync=function(){};

function save(){
  try{localStorage.setItem('kch_v4',JSON.stringify({songs,curId}));}catch(e){}
  scheduleDriveSync();
}

function load(){
  try{const d=JSON.parse(localStorage.getItem('kch_v4')||'{}');songs=d.songs||[];curId=d.curId||null;}
  catch(e){songs=[];curId=null;}
}

function cur(){return songs.find(s=>s.id===curId);}

function saveOnly(fn){const s=cur();if(!s)return;fn(s);s.updatedAt=Date.now();save();}

function upd(fn){const s=cur();if(!s)return;fn(s);s.updatedAt=Date.now();save();renderSongList();renderTab();}

function toast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg;el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),2600);
}
