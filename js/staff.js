// ─── SVG 楽譜レンダラー ───
const SS=8,SH=4;
const DI={C:0,D:1,E:2,F:3,G:4,A:5,B:6};

function pitchPos(pitch,clef){
  const m=(pitch||'').match(/^([A-G])(#|b)?(\d)$/);
  if(!m)return 4;
  const o=parseInt(m[3]);
  if(clef==='bass')return(o-2)*7+(DI[m[1]]-DI['G']);
  return(o-4)*7+(DI[m[1]]-DI['E']);
}
function pY(pos,sb){return sb-pos*SH;}
function sLine(x1,y1,x2,y2,c='#333',w=0.8){
  return`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}"/>`;
}
function staveLines(x,top,w){
  let s='';
  for(let i=0;i<=4;i++)s+=sLine(x,top+i*SS,x+w,top+i*SS);
  return s;
}
function ledger(cx,pos,sb){
  let s='';const lw=13;
  if(pos<=-1){const from=pos%2===0?pos:pos-1;for(let p=from;p<0;p+=2)s+=sLine(cx-lw/2,pY(p,sb),cx+lw/2,pY(p,sb),'#555',0.9);}
  if(pos>=9){for(let p=10;p<=pos+(pos%2===0?0:1);p+=2)s+=sLine(cx-lw/2,pY(p,sb),cx+lw/2,pY(p,sb),'#555',0.9);}
  return s;
}
function drawNoteHead(cx,pos,dur,color,sb){
  const y=pY(pos,sb);const filled=dur!=='w'&&dur!=='h';let s=ledger(cx,pos,sb);
  if(dur==='w')s+=`<ellipse cx="${cx}" cy="${y}" rx="5.5" ry="4" fill="none" stroke="${color}" stroke-width="1.6" transform="rotate(-10,${cx},${y})"/>`;
  else if(!filled)s+=`<ellipse cx="${cx}" cy="${y}" rx="5" ry="3.8" fill="white" stroke="${color}" stroke-width="1.5" transform="rotate(-10,${cx},${y})"/>`;
  else s+=`<ellipse cx="${cx}" cy="${y}" rx="5" ry="3.8" fill="${color}" transform="rotate(-10,${cx},${y})"/>`;
  if(dur!=='w'){
    const up=pos<4;const sx=up?cx+5:cx-5;
    const sy1=y+(up?-1:1);const sy2=y+(up?-26:26);
    s+=sLine(sx,sy1,sx,sy2,color,1.2);
    if(dur==='8')s+=up
      ?`<path d="M ${sx} ${sy2} q 10 5 5 16" stroke="${color}" fill="none" stroke-width="1.2"/>`
      :`<path d="M ${sx} ${sy2} q 10 -5 5 -16" stroke="${color}" fill="none" stroke-width="1.2"/>`;
    if(dur==='16')s+=up
      ?`<path d="M ${sx} ${sy2} q 10 5 5 14" stroke="${color}" fill="none" stroke-width="1.2"/><path d="M ${sx} ${sy2+7} q 10 5 5 14" stroke="${color}" fill="none" stroke-width="1.2"/>`
      :`<path d="M ${sx} ${sy2} q 10 -5 5 -14" stroke="${color}" fill="none" stroke-width="1.2"/><path d="M ${sx} ${sy2-7} q 10 -5 5 -14" stroke="${color}" fill="none" stroke-width="1.2"/>`;
  }
  return s;
}
function drawAccidental(cx,pos,acc,color,sb){
  if(!acc)return'';
  const y=pY(pos,sb);
  return`<text x="${cx-13}" y="${y+4}" font-size="10" fill="${color}" text-anchor="middle" font-family="serif">${acc==='#'?'♯':'♭'}</text>`;
}
function drawRest(cx,dur,sb){
  const mid=pY(4,sb);
  if(dur==='w')return`<rect x="${cx-6}" y="${pY(6,sb)}" width="12" height="5" fill="#555" rx="1"/>`;
  if(dur==='h')return`<rect x="${cx-6}" y="${pY(4,sb)-5}" width="12" height="5" fill="#555" rx="1"/>`;
  if(dur==='q')return`<path d="M ${cx} ${mid-14} q 5 3 0 8 q -7 3 -2 9 q 5 3 2 9" stroke="#555" fill="none" stroke-width="1.5"/>`;
  return`<path d="M ${cx} ${mid-6} q 7 0 2 10" stroke="#555" fill="none" stroke-width="1.5"/><circle cx="${cx+2}" cy="${mid+4}" r="2.5" fill="#555"/>`;
}
function drawNoteHeadOnly(cx,pos,dur,color,sb){
  const y=pY(pos,sb);const filled=dur!=='w'&&dur!=='h';let s=ledger(cx,pos,sb);
  if(dur==='w')s+=`<ellipse cx="${cx}" cy="${y}" rx="5.5" ry="4" fill="none" stroke="${color}" stroke-width="1.6" transform="rotate(-10,${cx},${y})"/>`;
  else if(!filled)s+=`<ellipse cx="${cx}" cy="${y}" rx="5" ry="3.8" fill="white" stroke="${color}" stroke-width="1.5" transform="rotate(-10,${cx},${y})"/>`;
  else s+=`<ellipse cx="${cx}" cy="${y}" rx="5" ry="3.8" fill="${color}" transform="rotate(-10,${cx},${y})"/>`;
  return s;
}
function drawBeamGroup(group,clef,mx,bw,sb,color){
  if(group.length<2)return'';let s='';
  const realNotes=group.filter(n=>n.pitch!=='R');
  if(realNotes.length<2)return'';
  const positions=group.map(n=>n.pitch==='R'?4:pitchPos(n.pitch,clef));
  const avgPos=positions.reduce((a,b)=>a+b,0)/positions.length;
  const up=avgPos<4;
  const noteData=group.map((n,i)=>{
    const cx=mx+(n.startBeat||0)*bw+bw*0.55;
    const pos=positions[i];const y=pY(pos,sb);
    const sx=up?cx+5:cx-5;
    return{cx,pos,y,sx,dur:n.duration,isRest:n.pitch==='R'};
  });
  const extremeY=up?Math.min(...noteData.filter(d=>!d.isRest).map(d=>d.y)):Math.max(...noteData.filter(d=>!d.isRest).map(d=>d.y));
  const beamY=up?extremeY-26:extremeY+26;
  for(const d of noteData){if(d.isRest)continue;s+=sLine(d.sx,d.y+(up?-1:1),d.sx,beamY,color,1.2);}
  const firstN=noteData.find(d=>!d.isRest);const lastN=[...noteData].reverse().find(d=>!d.isRest);
  if(firstN&&lastN){const bx=Math.min(firstN.sx,lastN.sx);const bw2=Math.abs(lastN.sx-firstN.sx)||1;
    s+=`<rect x="${bx}" y="${beamY-(up?3:0)}" width="${bw2}" height="3" fill="${color}" rx="0.5"/>`;}
  const beamY2=up?beamY+7:beamY-7;let bi=0;
  while(bi<noteData.length){
    if(noteData[bi].dur==='16'&&!noteData[bi].isRest){let bj=bi;while(bj<noteData.length&&noteData[bj].dur==='16')bj++;
      const seg=noteData.slice(bi,bj).filter(d=>!d.isRest);
      if(seg.length>=2){s+=`<rect x="${Math.min(seg[0].sx,seg[seg.length-1].sx)}" y="${beamY2-(up?3:0)}" width="${Math.abs(seg[seg.length-1].sx-seg[0].sx)||1}" height="3" fill="${color}" rx="0.5"/>`;}
      else if(seg.length===1){const sd=bi>0?-1:1;s+=`<rect x="${seg[0].sx+(sd<0?-8:0)}" y="${beamY2-(up?3:0)}" width="8" height="3" fill="${color}" rx="0.5"/>`;}
      bi=bj;}else{bi++;}
  }
  return s;
}
function renderNotes(notes,clef,mx,mw,sb,color){
  let s='';
  if(!notes||!notes.length){s+=drawRest(mx+mw/2,'w',sb);return s;}
  const bw=mw/4;
  const sorted=[...notes].filter(n=>n?.pitch).sort((a,b)=>(a.startBeat||0)-(b.startBeat||0));
  // beam groups
  const beamGroups=[];let curGrp=[];
  for(const n of sorted){
    const isB=n.duration==='8'||n.duration==='16';
    if(isB){const beat=Math.floor(n.startBeat||0);
      if(curGrp.length>0){const lb=Math.floor(curGrp[curGrp.length-1].startBeat||0);
        if(beat===lb){curGrp.push(n);}else{if(curGrp.filter(x=>x.pitch!=='R').length>=2)beamGroups.push([...curGrp]);curGrp=[n];}
      }else{curGrp.push(n);}
    }else{if(curGrp.filter(x=>x.pitch!=='R').length>=2)beamGroups.push([...curGrp]);curGrp=[];}
  }
  if(curGrp.filter(x=>x.pitch!=='R').length>=2)beamGroups.push([...curGrp]);
  const beamedSet=new Set();for(const g of beamGroups)for(const n of g)beamedSet.add(n);
  for(const n of sorted){
    const isR=n.pitch==='R';const cx=mx+(n.startBeat||0)*bw+bw*0.55;
    if(isR){s+=drawRest(cx,n.duration||'q',sb);continue;}
    const m=n.pitch.match(/^([A-G])(#|b)?(\d)$/);if(!m)continue;
    const pos=pitchPos(n.pitch,clef);
    if(beamedSet.has(n)){s+=drawNoteHeadOnly(cx,pos,n.duration||'q',color,sb);}
    else{s+=drawNoteHead(cx,pos,n.duration||'q',color,sb);}
    s+=drawAccidental(cx,pos,m[2]||null,color,sb);
  }
  for(const g of beamGroups)s+=drawBeamGroup(g,clef,mx,bw,sb,color);
  return s;
}

function singleStaffSVG(measures,clef,color,meter='4/4'){
  const [mBeats,mUnit]=(meter||'4/4').split('/').map(Number);
  const PT=22,PB=20,staffTop=PT,staffBot=staffTop+4*SS,svgH=staffBot+PB;
  const CLEF_W=58,MW=152,w=CLEF_W+measures.length*MW+8;
  let svg=`<svg width="${w}" height="${svgH}" style="display:block">`;
  svg+=staveLines(2,staffTop,w-4);
  if(clef==='bass')svg+=`<text x="8" y="${staffTop+SS*3+4}" font-size="32" fill="#333" font-family="serif" dominant-baseline="central">𝄢</text>`;
  else svg+=`<text x="6" y="${staffTop+SS*2}" font-size="48" fill="#333" font-family="serif">𝄞</text>`;
  svg+=`<text x="44" y="${staffTop+SS+4}" font-size="14" fill="#333" font-family="serif" font-weight="bold" text-anchor="middle">${mBeats}</text>`;
  svg+=`<text x="44" y="${staffTop+SS*3+4}" font-size="14" fill="#333" font-family="serif" font-weight="bold" text-anchor="middle">${mUnit}</text>`;
  svg+=sLine(CLEF_W-3,staffTop,CLEF_W-3,staffBot,'#333',1.2);
  let x=CLEF_W;
  for(const meas of measures){
    if(meas.chord)svg+=`<text x="${x+MW/2}" y="${staffTop-6}" font-size="10" fill="#7c3aed" text-anchor="middle" font-family="monospace">${meas.chord}</text>`;
    svg+=renderNotes(meas.notes||[],clef,x+6,MW-12,staffBot,color);
    svg+=sLine(x+MW,staffTop,x+MW,staffBot,'#555',0.8);x+=MW;
  }
  svg+=sLine(x,staffTop,x,staffBot,'#333',1.8);
  svg+='</svg>';return svg;
}

function grandStaffSVG(measures,color,meter='4/4'){
  const [mBeats,mUnit]=(meter||'4/4').split('/').map(Number);
  const PT=20,IGAP=18,PB=20,RHtop=PT,RHbot=RHtop+4*SS,LHtop=RHbot+IGAP,LHbot=LHtop+4*SS;
  const CLEF_W=64,MW=164,w=CLEF_W+measures.length*MW+8;
  let svg=`<svg width="${w}" height="${LHbot+PB}" style="display:block">`;
  svg+=`<path d="M 7,${RHtop} q -16,${(LHbot-RHtop)/2} 0,${LHbot-RHtop}" stroke="#333" fill="none" stroke-width="3"/>`;
  svg+=staveLines(12,RHtop,w-16);svg+=staveLines(12,LHtop,w-16);
  svg+=sLine(12,RHtop,12,LHbot,'#333',1.5);
  svg+=`<text x="17" y="${RHtop+SS*2}" font-size="44" fill="#333" font-family="serif">𝄞</text>`;
  svg+=`<text x="17" y="${LHtop+SS*3+4}" font-size="30" fill="#333" font-family="serif" dominant-baseline="central">𝄢</text>`;
  [RHtop,LHtop].forEach(t=>{
    svg+=`<text x="46" y="${t+SS+4}" font-size="14" fill="#333" font-family="serif" font-weight="bold" text-anchor="middle">${mBeats}</text>`;
    svg+=`<text x="46" y="${t+SS*3+4}" font-size="14" fill="#333" font-family="serif" font-weight="bold" text-anchor="middle">${mUnit}</text>`;
  });
  svg+=sLine(CLEF_W-3,RHtop,CLEF_W-3,LHbot,'#333',1.2);
  let x=CLEF_W;
  for(const meas of measures){
    if(meas.chord)svg+=`<text x="${x+MW/2}" y="${RHtop-5}" font-size="10" fill="#7c3aed" text-anchor="middle" font-family="monospace">${meas.chord}</text>`;
    const rh=(meas.rh||meas.notes||[]).filter(n=>{const m=n.pitch?.match(/^([A-G])(#|b)?(\d)$/);return m&&parseInt(m[3])>=4;});
    const lh=(meas.lh||meas.notes||[]).filter(n=>{const m=n.pitch?.match(/^([A-G])(#|b)?(\d)$/);return m&&parseInt(m[3])<=3;});
    svg+=renderNotes(rh,'treble',x+6,MW-12,RHbot,color);
    svg+=renderNotes(lh,'bass',x+6,MW-12,LHbot,color);
    svg+=sLine(x+MW,RHtop,x+MW,LHbot,'#555',0.8);x+=MW;
  }
  svg+=sLine(x,RHtop,x,LHbot,'#333',2);svg+='</svg>';return svg;
}

function drumStaffSVG(measures){
  const PT=18,PB=18,MW=164,CLEF_W=42,staffTop=PT,staffBot=staffTop+4*SS;
  const w=CLEF_W+measures.length*MW+8;
  let svg=`<svg width="${w}" height="${staffBot+PB}" style="display:block">`;
  svg+=staveLines(2,staffTop,w-4);
  svg+=`<rect x="8" y="${staffTop+SS}" width="4" height="${SS*2}" fill="#555" rx="1"/>`;
  svg+=`<rect x="14" y="${staffTop+SS}" width="4" height="${SS*2}" fill="#555" rx="1"/>`;
  svg+=sLine(CLEF_W-3,staffTop,CLEF_W-3,staffBot,'#333',1.2);
  const DPOS={HH:8,CY:10,SD:4,BD:0};
  const DC={HH:'#e8a020',CY:'#50c878',SD:'#9060e8',BD:'#3b82f6'};
  let x=CLEF_W;
  for(const meas of measures){
    if(meas.chord)svg+=`<text x="${x+MW/2}" y="${staffTop-5}" font-size="10" fill="#7c3aed" text-anchor="middle" font-family="monospace">${meas.chord}</text>`;
    const pat=meas.pattern||{};const bw=(MW-12)/8;
    Object.entries(pat).forEach(([drum,row])=>{
      const pos=DPOS[drum]??4;const dc=DC[drum]||'#333';const y=pY(pos,staffBot);
      (row||[]).forEach((on,bi)=>{
        if(!on)return;
        const cx=x+6+bi*bw+bw/2;
        svg+=sLine(cx-4,y-4,cx+4,y+4,dc,1.8)+sLine(cx+4,y-4,cx-4,y+4,dc,1.8);
      });
    });
    svg+=sLine(x+MW,staffTop,x+MW,staffBot,'#555',0.8);x+=MW;
  }
  svg+=sLine(x,staffTop,x,staffBot,'#333',2);svg+='</svg>';return svg;
}

function melodyStaffSVG(measures,color='#1eb8a0',meter='4/4'){
  return singleStaffSVG(measures.map(m=>({...m,notes:m.melNotes||[]})),'treble',color,meter);
}
