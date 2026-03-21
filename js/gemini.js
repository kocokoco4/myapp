// ─── Gemini API ───
const GEMINI_KEY_ST='songbook_gemini_key';

function getGeminiKey(){return localStorage.getItem(GEMINI_KEY_ST)||'';}
function setGeminiKey(k){localStorage.setItem(GEMINI_KEY_ST,k);}

const GEMINI_MODELS=['gemini-2.5-flash','gemini-2.0-flash','gemini-1.5-flash'];
async function callGemini(systemText,messages,maxTokens=800){
  const key=getGeminiKey();
  if(!key)throw new Error('NO_KEY');
  const body={
    system_instruction:{parts:[{text:systemText}]},
    contents:messages.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})),
    generationConfig:{maxOutputTokens:maxTokens}
  };
  for(const model of GEMINI_MODELS){
    const url=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d=await r.json();
    if(d.error&&(d.error.code===404||d.error.message?.includes('not found'))){continue;}
    if(d.error)throw new Error(d.error.message);
    return d.candidates?.[0]?.content?.parts?.[0]?.text||'';
  }
  throw new Error('利用可能なGeminiモデルが見つかりません');
}
