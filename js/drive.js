// ─── Google Drive 同期・設定モーダル ───
const CLIENT_ID_ST='songbook_oauth_cid';
const DRIVE_FID_ST='songbook_drive_fid';

function getClientId(){return localStorage.getItem(CLIENT_ID_ST)||'';}
function setClientId(v){localStorage.setItem(CLIENT_ID_ST,v);}

let tokenClient=null,accessToken=null,tokenExpiry=0;
let driveFileId=localStorage.getItem(DRIVE_FID_ST)||null;
let driveReady=false,driveSyncing=false,driveSaveTimer=null;

// data.js のスタブを上書き
scheduleDriveSync=function(){
  clearTimeout(driveSaveTimer);
  driveSaveTimer=setTimeout(driveSaveNow,1000);
};

function setSyncStatus(msg){
  const el=document.getElementById('syncStatus');
  if(!el)return;el.textContent=msg;el.style.opacity=1;
  if(msg.startsWith('✓'))setTimeout(()=>{el.style.opacity=.4;},3000);
}

function initGIS(){
  const cid=getClientId();
  if(!cid||typeof google==='undefined')return;
  tokenClient=google.accounts.oauth2.initTokenClient({
    client_id:cid,
    scope:'https://www.googleapis.com/auth/drive.appdata',
    callback:async(resp)=>{
      if(resp.error){setSyncStatus('⚠ 認証失敗');return;}
      accessToken=resp.access_token;
      tokenExpiry=Date.now()+(resp.expires_in-60)*1000;
      driveReady=true;renderSyncBar();
      setSyncStatus('読み込み中...');
      const ok=await driveLoad();
      if(ok){renderAll();}
      setSyncStatus('✓ Drive同期済み');
    }
  });
}

async function signInDrive(){
  if(!getClientId()){openSettings();return;}
  if(!tokenClient){
    if(typeof google==='undefined'){toast('Google SDKを読み込み中...');setTimeout(()=>{initGIS();signInDrive();},1000);return;}
    initGIS();
  }
  tokenClient.requestAccessToken({prompt:driveReady?'':'consent'});
}

async function ensureToken(){
  if(accessToken&&Date.now()<tokenExpiry)return true;
  if(!tokenClient)return false;
  return new Promise(resolve=>{
    const orig=tokenClient.callback;
    tokenClient.callback=(resp)=>{
      tokenClient.callback=orig;
      if(!resp.error){accessToken=resp.access_token;tokenExpiry=Date.now()+(resp.expires_in-60)*1000;resolve(true);}
      else resolve(false);
    };
    tokenClient.requestAccessToken({prompt:''});
  });
}

async function driveLoad(){
  if(!await ensureToken())return false;
  try{
    if(!driveFileId){
      const r=await fetch("https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='songbook_data.json'",
        {headers:{Authorization:`Bearer ${accessToken}`}});
      const d=await r.json();
      if(d.files?.length>0){driveFileId=d.files[0].id;localStorage.setItem(DRIVE_FID_ST,driveFileId);}
    }
    if(!driveFileId)return false;
    const r=await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
      {headers:{Authorization:`Bearer ${accessToken}`}});
    const d=await r.json();
    if(Array.isArray(d.songs)){
      songs=d.songs;
      if(!curId||!songs.find(s=>s.id===curId))curId=songs[0]?.id||null;
      try{localStorage.setItem('kch_v4',JSON.stringify({songs,curId}));}catch(e){}
      return true;
    }
  }catch(e){console.error('Drive load error',e);}
  return false;
}

async function driveSaveNow(){
  if(!driveReady||!await ensureToken())return;
  if(driveSyncing){driveSaveTimer=setTimeout(driveSaveNow,1500);return;}
  driveSyncing=true;setSyncStatus('保存中...');
  const content=JSON.stringify({songs,curId});
  try{
    if(driveFileId){
      const r=await fetch(`https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media`,
        {method:'PATCH',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:content});
      if(r.status===404){driveFileId=null;localStorage.removeItem(DRIVE_FID_ST);}
    }
    if(!driveFileId){
      const meta={name:'songbook_data.json',parents:['appDataFolder']};
      const form=new FormData();
      form.append('metadata',new Blob([JSON.stringify(meta)],{type:'application/json'}));
      form.append('file',new Blob([content],{type:'application/json'}));
      const r=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {method:'POST',headers:{Authorization:`Bearer ${accessToken}`},body:form});
      const d=await r.json();
      if(d.id){driveFileId=d.id;localStorage.setItem(DRIVE_FID_ST,driveFileId);}
    }
    setSyncStatus('✓ Drive同期済み');
  }catch(e){setSyncStatus('⚠ 保存失敗');}
  driveSyncing=false;
}

/* ── 設定モーダル ── */
function openSettings(){
  document.getElementById('settingsModal').style.display='flex';
  renderSettingsModal();
}
function closeSettings(){document.getElementById('settingsModal').style.display='none';}

function renderSettingsModal(){
  const hasGemini=!!getGeminiKey();
  document.getElementById('settingsContent').innerHTML=`
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
  <span style="font-family:var(--disp);font-size:16px;font-weight:800;color:var(--amber)">⚙ 設定</span>
  <button style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:18px;padding:4px" onclick="closeSettings()">✕</button>
</div>

<div style="background:var(--bg4);border:1px solid var(--border2);border-radius:10px;padding:14px;margin-bottom:14px">
  <div style="font-size:11px;font-weight:700;color:var(--amber);font-family:var(--mono);margin-bottom:8px">🤖 Gemini API キー</div>
  <input id="geminiKeyIn" type="password" class="inp" style="width:100%;margin-bottom:8px"
    placeholder="AIzaSy..." value="${hasGemini?'●●●●●●●●●●●●':''}">
  <button class="btn btn-a" style="width:100%;font-size:12px" onclick="saveGeminiKey()">保存</button>
  <div style="font-size:10px;color:var(--text3);margin-top:7px;line-height:1.7">
    <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--teal)">Google AI Studio</a> でAPIキーを取得してください（無料）
  </div>
</div>

<div style="background:var(--bg4);border:1px solid var(--border2);border-radius:10px;padding:14px;margin-bottom:14px">
  <div style="font-size:11px;font-weight:700;color:var(--teal);font-family:var(--mono);margin-bottom:8px">☁ Google Drive 自動同期</div>
  <input id="clientIdIn" class="inp" style="width:100%;margin-bottom:8px"
    placeholder="xxxx.apps.googleusercontent.com" value="${getClientId()}">
  <button class="btn btn-t" style="width:100%;font-size:12px;margin-bottom:10px" onclick="saveClientId()">保存してログイン</button>
  <div style="font-size:10px;color:var(--text3);line-height:1.8;border-top:1px solid var(--border);padding-top:8px">
    <strong style="color:var(--text2)">OAuth Client ID の取得手順（一度だけ）</strong><br>
    1. <a href="https://console.cloud.google.com/" target="_blank" style="color:var(--teal)">Google Cloud Console</a> を開く<br>
    2. プロジェクト作成 → 「APIとサービス」→「ライブラリ」→ <strong>Google Drive API</strong> を有効化<br>
    3. 「認証情報」→「認証情報を作成」→「OAuth 2.0 クライアントID」→ <strong>ウェブアプリケーション</strong><br>
    4. 「承認済みのJavaScriptオリジン」に <code style="background:var(--bg3);padding:1px 5px;border-radius:3px">http://127.0.0.1:5500</code> を追加<br>
    5. 作成されたクライアントIDをここに貼り付け
  </div>
</div>

<div style="font-size:10px;color:var(--text3);text-align:center;font-family:var(--mono)">
  データはブラウザのlocalStorageとGoogle Driveのアプリデータフォルダに保存されます
</div>`;
}

function saveGeminiKey(){
  const v=document.getElementById('geminiKeyIn')?.value?.trim();
  if(v&&!v.startsWith('●')){setGeminiKey(v);toast('✓ Gemini APIキーを保存しました');}
  closeSettings();renderSyncBar();
}
function saveClientId(){
  const v=document.getElementById('clientIdIn')?.value?.trim();
  if(v){setClientId(v);initGIS();closeSettings();signInDrive();}
}

/* ── Sync Bar ── */
function renderSyncBar(){
  const el=document.getElementById('syncBar');if(!el)return;
  const hasKey=!!getGeminiKey();
  el.innerHTML=`
  <div style="padding:10px 12px;border-top:1px solid var(--border)">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:7px">
      <span id="syncStatus" style="flex:1;font-size:10px;color:${driveReady?'var(--teal)':'var(--text3)'};font-family:var(--mono);opacity:${driveReady?1:.6}">
        ${driveReady?'✓ Drive同期中':'⬤ ローカルのみ'}
      </span>
      ${driveReady
        ?`<button class="btn btn-g" style="font-size:9px;padding:3px 7px" title="最新データを読み込む"
            onclick="driveLoad().then(ok=>{if(ok){renderAll();toast('✓ 最新データを読み込みました');}})">↻</button>`
        :`<button class="btn btn-t" style="font-size:9px;padding:3px 9px" onclick="signInDrive()">Driveにログイン</button>`
      }
    </div>
    <button class="btn btn-g" style="width:100%;font-size:10px;padding:5px;${hasKey?'color:var(--teal);border-color:rgba(30,184,160,.4)':''}"
      onclick="openSettings()">⚙ 設定${hasKey?' (Gemini ✓)':' — APIキー未設定'}</button>
  </div>`;
}
