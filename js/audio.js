// ─── Web Audio API ───
const NF={
  'C2':65.4,'C#2':69.3,'D2':73.4,'D#2':77.8,'E2':82.4,'F2':87.3,'F#2':92.5,'G2':98,'A2':110,'B2':123.5,
  'C3':130.8,'C#3':138.6,'D3':146.8,'D#3':155.6,'E3':164.8,'F3':174.6,'F#3':185,'G3':196,'A3':220,'B3':246.9,
  'C4':261.6,'C#4':277.2,'D4':293.7,'D#4':311.1,'E4':329.6,'F4':349.2,'F#4':370,'G4':392,'A4':440,'B4':493.9,
  'C5':523.3,'D5':587.3,'E5':659.3,'G5':784
};
const CI={
  '':[0,4,7],'M7':[0,4,7,11],'7':[0,4,7,10],
  'm':[0,3,7],'m7':[0,3,7,10],'add9':[0,4,7,14],'sus4':[0,5,7]
};
const NN=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
let actx=null;

function getAudioCtx(){
  if(!actx)actx=new(window.AudioContext||window.webkitAudioContext)();
  if(actx.state==='suspended')actx.resume();
  return actx;
}

function parseChord(name){
  if(!name)return[];
  const sl=name.indexOf('/');
  const base=sl>0?name.slice(0,sl):name;
  const m=base.match(/^([A-G]#?)(.*)/);
  if(!m)return[];
  const ri=NN.indexOf(m[1]);
  if(ri<0)return[];
  const ivs=CI[m[2]]||CI[''];
  return ivs.map(i=>{const ni=(ri+i)%12;const o=3+Math.floor((ri+i)/12);return NN[ni]+o;});
}

function playChord(name,el){
  if(!name)return;
  const ctx=getAudioCtx();
  const notes=parseChord(name);
  if(!notes.length)return;
  if(el){el.classList.add('play');setTimeout(()=>el.classList.remove('play'),600);}
  const now=ctx.currentTime;
  notes.forEach(n=>{
    const freq=NF[n];if(!freq)return;
    const osc=ctx.createOscillator(),gain=ctx.createGain(),filt=ctx.createBiquadFilter();
    osc.type='triangle';osc.frequency.value=freq;
    filt.type='lowpass';filt.frequency.value=2200;
    gain.gain.setValueAtTime(0,now);
    gain.gain.linearRampToValueAtTime(0.12,now+0.02);
    gain.gain.exponentialRampToValueAtTime(0.001,now+1.2);
    osc.connect(filt);filt.connect(gain);gain.connect(ctx.destination);
    osc.start(now);osc.stop(now+1.2);
  });
}

function playNote(pitch){
  const ctx=getAudioCtx();
  const freq=NF[pitch];if(!freq)return;
  const now=ctx.currentTime;
  const osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type='sine';osc.frequency.value=freq;
  gain.gain.setValueAtTime(0,now);
  gain.gain.linearRampToValueAtTime(0.2,now+0.01);
  gain.gain.exponentialRampToValueAtTime(0.001,now+0.8);
  osc.connect(gain);gain.connect(ctx.destination);
  osc.start(now);osc.stop(now+0.8);
}
