import type { MelNote } from '../types'

const SS = 8, SH = 4

// ─── SVG path-based music symbols ─── //
// Source: Leland font (MuseScore, SIL Open Font License)
// Converted from VexFlow glyph format to standard SVG path commands

/** Treble clef — Leland font glyph, scale 0.028 to fit 32px staff */
function drawTrebleClef(x: number, staffTop: number, staffBot: number): string {
  const staffH = staffBot - staffTop
  const s = staffH / 1200 // scale to staff
  // Origin: G line (line 2 from bottom = staffTop + 3*SS)
  const ox = x + 8
  const oy = staffTop + 3 * SS
  return `<g transform="translate(${ox},${oy}) scale(${s},${-s})">
    <path d="M605,-297 C576,-302 549,-305 521,-305 C315,-305 140,-161 140,56 C140,232 264,389 390,498 C415,520 438,540 459,562 C472,484 482,416 492,357 C361,318 272,180 272,45 C272,-56 351,-194 467,-194 C478,-194 491,-189 491,-176 C491,-163 477,-156 459,-144 C403,-109 372,-72 372,-1 C372,86 436,157 521,177 Z M478,1184 C491,1241 557,1392 632,1392 C654,1392 688,1322 688,1223 C688,1073 577,960 478,863 C469,920 462,976 462,1037 C462,1090 467,1139 478,1184 Z M176,-739 C176,-834 249,-959 444,-959 C511,-959 570,-942 622,-910 C700,-855 720,-760 720,-670 C720,-613 711,-549 697,-467 C693,-438 684,-395 675,-338 C816,-292 922,-145 922,3 C922,220 768,367 557,367 C543,454 528,539 516,619 C668,779 773,959 773,1188 C773,1319 733,1426 710,1477 C675,1551 634,1601 608,1601 C598,1601 553,1584 505,1528 C413,1418 387,1234 387,1113 C387,1035 395,965 419,804 C418,802 343,726 312,701 C181,579 0,405 0,117 C0,-153 235,-364 503,-364 C544,-364 583,-360 616,-354 C644,-492 660,-593 660,-670 C660,-819 583,-899 438,-899 C403,-899 373,-891 370,-891 C369,-890 366,-888 366,-887 C366,-884 369,-883 373,-881 C441,-871 508,-814 508,-721 C508,-644 449,-562 341,-562 C240,-562 176,-644 176,-739 Z M809,-30 C716,186 809,98 809,-30 C809,-132 768,-238 665,-279 C635,-107 596,122 586,186 Z" fill="#333"/>
  </g>`
}

/** Bass clef — Leland font glyph */
function drawBassClef(x: number, staffTop: number): string {
  const s = (4 * SS) / 900
  const ox = x + 6
  const oy = staffTop + SS // F line (line 4 from bottom = staffTop + SS)
  return `<g transform="translate(${ox},${oy}) scale(${s},${-s})">
    <path d="M366,361 C256,361 168,298 167,298 C84,236 50,163 37,112 C30,86 27,60 27,36 C27,1 33,-30 46,-58 C63,-96 96,-124 140,-138 C157,-144 176,-147 194,-147 C226,-147 259,-138 287,-122 C331,-98 359,-46 359,10 C359,60 333,107 289,134 C259,154 230,160 206,160 C189,160 173,157 160,153 C145,147 121,132 109,122 C114,150 131,192 147,215 C163,238 194,266 219,279 C255,300 301,308 351,308 C498,308 570,190 570,-52 C570,-186 520,-314 477,-399 C429,-494 366,-585 310,-635 C160,-772 19,-837 17,-837 C17,-837 0,-847 0,-864 C0,-867 1,-868 1,-871 C6,-886 19,-888 27,-888 C29,-888 33,-887 35,-887 C36,-887 200,-819 331,-717 C405,-664 471,-606 528,-544 C580,-488 625,-428 661,-367 C724,-259 760,-147 760,-50 C760,69 729,168 670,239 C602,320 500,361 366,361 Z" fill="#333"/>
    <circle cx="${(818 + 68) * s}" cy="${-179 * s}" r="${37 * s}" fill="#333"/>
    <circle cx="${(818 + 68) * s}" cy="${177 * s}" r="${37 * s}" fill="#333"/>
  </g>`
}

/** Time signature numbers */
function drawTimeSigNum(x: number, y: number, n: number): string {
  return `<text x="${x}" y="${y}" font-size="12" font-weight="bold" fill="#333" text-anchor="middle" font-family="Arial,Helvetica,sans-serif">${n}</text>`
}
const DI: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }

function pitchPos(pitch: string, clef: string): number {
  const m = (pitch || '').match(/^([A-G])(#|b)?(\d)$/)
  if (!m) return 4
  const o = parseInt(m[3])
  if (clef === 'bass') return (o - 2) * 7 + (DI[m[1]] - DI['G'])
  return (o - 4) * 7 + (DI[m[1]] - DI['E'])
}

function pY(pos: number, sb: number): number { return sb - pos * SH }

/** Stem end Y — extends to at least the middle line for ledger-line notes */
function calcStemEnd(pos: number, noteY: number, sb: number): number {
  const midY = pY(4, sb)
  if (pos < 4) return Math.min(noteY - 26, midY)   // stem up
  return Math.max(noteY + 26, midY)                  // stem down
}

function sLine(x1: number, y1: number, x2: number, y2: number, c = '#333', w = 0.8): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}"/>`
}

function staveLines(x: number, top: number, w: number): string {
  let s = ''
  for (let i = 0; i <= 4; i++) s += sLine(x, top + i * SS, x + w, top + i * SS)
  return s
}

/** Ledger lines — correct music theory positioning */
function ledger(cx: number, pos: number, sb: number): string {
  let s = ''
  const lw = 14
  // Below staff: draw at even positions from -2 down to the note
  if (pos <= -2) {
    const lowest = pos % 2 === 0 ? pos : pos + 1
    for (let p = -2; p >= lowest; p -= 2)
      s += sLine(cx - lw / 2, pY(p, sb), cx + lw / 2, pY(p, sb), '#555', 0.9)
  }
  // Above staff: draw at even positions from 10 up to the note
  if (pos >= 10) {
    const highest = pos % 2 === 0 ? pos : pos - 1
    for (let p = 10; p <= highest; p += 2)
      s += sLine(cx - lw / 2, pY(p, sb), cx + lw / 2, pY(p, sb), '#555', 0.9)
  }
  return s
}

/** Strip dotted prefix for base duration type */
function baseDur(dur: string): string {
  if (dur === 'dh') return 'h'
  if (dur === 'dq') return 'q'
  if (dur === 'd8') return '8'
  return dur
}
function isDotted(dur: string): boolean { return dur === 'dh' || dur === 'dq' || dur === 'd8' }

function drawNoteHead(cx: number, pos: number, dur: string, color: string, sb: number): string {
  const y = pY(pos, sb)
  const bd = baseDur(dur)
  const filled = bd !== 'w' && bd !== 'h'
  let s = ledger(cx, pos, sb)
  if (bd === 'w') s += `<ellipse cx="${cx}" cy="${y}" rx="5.5" ry="4" fill="none" stroke="${color}" stroke-width="1.6" transform="rotate(-10,${cx},${y})"/>`
  else if (!filled) s += `<ellipse cx="${cx}" cy="${y}" rx="5" ry="3.8" fill="white" stroke="${color}" stroke-width="1.5" transform="rotate(-10,${cx},${y})"/>`
  else s += `<ellipse cx="${cx}" cy="${y}" rx="5" ry="3.8" fill="${color}" transform="rotate(-10,${cx},${y})"/>`

  // Dotted: add dot to the right of note head
  if (isDotted(dur)) {
    s += `<circle cx="${cx + 8}" cy="${y - (pos % 2 === 0 ? 3 : 0)}" r="1.5" fill="${color}"/>`
  }

  if (bd !== 'w') {
    const up = pos < 4
    const sx = up ? cx + 5 : cx - 5
    const sy1 = y + (up ? -1 : 1)
    const sy2 = calcStemEnd(pos, y, sb)
    s += sLine(sx, sy1, sx, sy2, color, 1.2)
    const flag = (d: string) => {
      if (d === '8' || d === 'd8') return 1
      if (d === '16') return 2
      if (d === '32') return 3
      return 0
    }
    const nFlags = flag(bd === 'd8' ? '8' : dur)
    for (let fi = 0; fi < nFlags; fi++) {
      const offset = fi * 6
      s += up
        ? `<path d="M ${sx} ${sy2 + offset} q 8 4 4 12" stroke="${color}" fill="none" stroke-width="1.3" stroke-linecap="round"/>`
        : `<path d="M ${sx} ${sy2 - offset} q 8 -4 4 -12" stroke="${color}" fill="none" stroke-width="1.3" stroke-linecap="round"/>`
    }
  }
  return s
}

function drawAccidental(cx: number, pos: number, acc: string | null, color: string, sb: number): string {
  if (!acc) return ''
  const y = pY(pos, sb)
  const ax = cx - 12
  if (acc === '#') {
    // Sharp: two vertical lines + two horizontal
    return `<g stroke="${color}" stroke-width="0.9" stroke-linecap="round">
      <line x1="${ax - 1.5}" y1="${y - 5}" x2="${ax - 1.5}" y2="${y + 5}"/>
      <line x1="${ax + 1.5}" y1="${y - 5}" x2="${ax + 1.5}" y2="${y + 5}"/>
      <line x1="${ax - 3.5}" y1="${y - 1.5}" x2="${ax + 3.5}" y2="${y - 2.5}" stroke-width="1.5"/>
      <line x1="${ax - 3.5}" y1="${y + 2.5}" x2="${ax + 3.5}" y2="${y + 1.5}" stroke-width="1.5"/>
    </g>`
  }
  // Flat: vertical line + curved bowl
  return `<g fill="${color}" stroke="${color}" stroke-width="0.5">
    <line x1="${ax}" y1="${y - 6}" x2="${ax}" y2="${y + 3}" stroke-width="1"/>
    <path d="M ${ax} ${y - 1} C ${ax + 3} ${y - 3} ${ax + 5} ${y - 1} ${ax + 4} ${y + 1} C ${ax + 3} ${y + 3} ${ax} ${y + 3} ${ax} ${y + 3}" fill="none" stroke-width="1"/>
  </g>`
}

/** Rest symbols — standard music notation shapes */
function drawRest(cx: number, dur: string, sb: number): string {
  const midY = pY(4, sb)
  if (dur === 'w') {
    // Whole rest: rectangle hanging from 4th line
    return `<rect x="${cx - 6}" y="${pY(6, sb)}" width="12" height="5" fill="#555" rx="1"/>`
  }
  if (dur === 'h') {
    // Half rest: rectangle sitting on 3rd line
    return `<rect x="${cx - 6}" y="${midY - 5}" width="12" height="5" fill="#555" rx="1"/>`
  }
  if (dur === 'q') {
    // Quarter rest: proper zigzag shape (spans ~middle of staff)
    const t = midY - 11
    return `<path d="M ${cx + 2} ${t} L ${cx - 3} ${t + 7} L ${cx + 4} ${t + 13} C ${cx + 3} ${t + 17} ${cx} ${t + 20} ${cx - 2} ${t + 23}" stroke="#555" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
  }
  if (dur === '8') {
    // Eighth rest: dot + curved stem
    return `<circle cx="${cx + 3}" cy="${midY - 4}" r="2" fill="#555"/>`
      + `<path d="M ${cx} ${midY + 6} C ${cx + 1} ${midY + 1} ${cx + 2} ${midY - 2} ${cx + 3} ${midY - 4}" stroke="#555" fill="none" stroke-width="1.6" stroke-linecap="round"/>`
  }
  // 16th rest: two dots + longer curved stem
  return `<circle cx="${cx + 3}" cy="${midY - 5}" r="2" fill="#555"/>`
    + `<circle cx="${cx + 4}" cy="${midY + 2}" r="2" fill="#555"/>`
    + `<path d="M ${cx} ${midY + 12} C ${cx + 1} ${midY + 5} ${cx + 2} ${midY - 2} ${cx + 3} ${midY - 5}" stroke="#555" fill="none" stroke-width="1.6" stroke-linecap="round"/>`
}

function drawNoteHeadOnly(cx: number, pos: number, dur: string, color: string, sb: number): string {
  const y = pY(pos, sb)
  const bd = baseDur(dur)
  const filled = bd !== 'w' && bd !== 'h'
  let s = ledger(cx, pos, sb)
  if (bd === 'w') s += `<ellipse cx="${cx}" cy="${y}" rx="5.5" ry="4" fill="none" stroke="${color}" stroke-width="1.6" transform="rotate(-10,${cx},${y})"/>`
  else if (!filled) s += `<ellipse cx="${cx}" cy="${y}" rx="5" ry="3.8" fill="white" stroke="${color}" stroke-width="1.5" transform="rotate(-10,${cx},${y})"/>`
  else s += `<ellipse cx="${cx}" cy="${y}" rx="5" ry="3.8" fill="${color}" transform="rotate(-10,${cx},${y})"/>`
  if (isDotted(dur)) s += `<circle cx="${cx + 8}" cy="${y - (pos % 2 === 0 ? 3 : 0)}" r="1.5" fill="${color}"/>`
  return s
}

function drawBeamGroup(group: MelNote[], clef: string, mx: number, bw: number, sb: number, color: string): string {
  if (group.length < 2) return ''
  let s = ''
  const realNotes = group.filter(n => n.pitch !== 'R')
  if (realNotes.length < 2) return ''
  const positions = group.map(n => n.pitch === 'R' ? 4 : pitchPos(n.pitch, clef))
  const avgPos = positions.reduce((a, b) => a + b, 0) / positions.length
  const up = avgPos < 4
  const midY = pY(4, sb)
  const noteData = group.map((n, i) => {
    const cx = mx + (n.startBeat || 0) * bw + bw * 0.3
    const pos = positions[i]
    const y = pY(pos, sb)
    const sx = up ? cx + 5 : cx - 5
    return { cx, pos, y, sx, dur: n.duration, isRest: n.pitch === 'R' }
  })
  const extremeY = up
    ? Math.min(...noteData.filter(d => !d.isRest).map(d => d.y))
    : Math.max(...noteData.filter(d => !d.isRest).map(d => d.y))
  // Beam position: extends to at least the middle line
  const beamY = up
    ? Math.min(extremeY - 26, midY)
    : Math.max(extremeY + 26, midY)

  for (const d of noteData) {
    if (d.isRest) continue
    const sy1 = d.y + (up ? -1 : 1)
    s += sLine(d.sx, sy1, d.sx, beamY, color, 1.2)
  }

  const firstN = noteData.find(d => !d.isRest)
  const lastN = [...noteData].reverse().find(d => !d.isRest)
  if (firstN && lastN) {
    const bx = Math.min(firstN.sx, lastN.sx)
    const bw2 = Math.abs(lastN.sx - firstN.sx) || 1
    s += `<rect x="${bx}" y="${beamY - (up ? 3 : 0)}" width="${bw2}" height="3" fill="${color}" rx="0.5"/>`
  }

  const beamY2 = up ? beamY + 7 : beamY - 7
  let bi = 0
  while (bi < noteData.length) {
    if (noteData[bi].dur === '16' && !noteData[bi].isRest) {
      let bj = bi
      while (bj < noteData.length && noteData[bj].dur === '16') bj++
      const seg = noteData.slice(bi, bj).filter(d => !d.isRest)
      if (seg.length >= 2) {
        const f16 = seg[0], l16 = seg[seg.length - 1]
        s += `<rect x="${Math.min(f16.sx, l16.sx)}" y="${beamY2 - (up ? 3 : 0)}" width="${Math.abs(l16.sx - f16.sx) || 1}" height="3" fill="${color}" rx="0.5"/>`
      } else if (seg.length === 1) {
        const d = seg[0]
        const sd = bi > 0 ? -1 : 1
        s += `<rect x="${d.sx + (sd < 0 ? -8 : 0)}" y="${beamY2 - (up ? 3 : 0)}" width="8" height="3" fill="${color}" rx="0.5"/>`
      }
      bi = bj
    } else { bi++ }
  }
  return s
}

function renderNotes(notes: MelNote[] | undefined, clef: string, mx: number, mw: number, sb: number, color: string, syllableY?: number, beatsInMeasure = 4): string {
  let s = ''
  if (!notes || !notes.length) { s += drawRest(mx + mw / 2, 'w', sb); return s }
  const bw = mw / beatsInMeasure
  const sorted = [...notes].filter(n => n?.pitch).sort((a, b) => (a.startBeat || 0) - (b.startBeat || 0))
  const beamGroups: MelNote[][] = []
  let curGrp: MelNote[] = []
  for (const n of sorted) {
    const isB = n.duration === '8' || n.duration === '16'
    if (isB) {
      const beat = Math.floor(n.startBeat || 0)
      if (curGrp.length > 0) {
        const lastBeat = Math.floor(curGrp[curGrp.length - 1].startBeat || 0)
        if (beat === lastBeat) { curGrp.push(n) }
        else { if (curGrp.filter(x => x.pitch !== 'R').length >= 2) beamGroups.push([...curGrp]); curGrp = [n] }
      } else { curGrp.push(n) }
    } else { if (curGrp.filter(x => x.pitch !== 'R').length >= 2) beamGroups.push([...curGrp]); curGrp = [] }
  }
  if (curGrp.filter(x => x.pitch !== 'R').length >= 2) beamGroups.push([...curGrp])

  const beamedSet = new Set<MelNote>()
  for (const g of beamGroups) for (const n of g) beamedSet.add(n)

  for (const n of sorted) {
    const isR = n.pitch === 'R'
    const cx = mx + (n.startBeat || 0) * bw + bw * 0.3
    if (isR) { s += drawRest(cx, n.duration || 'q', sb); continue }
    const m = n.pitch.match(/^([A-G])(#|b)?(\d)$/)
    if (!m) continue
    const pos = pitchPos(n.pitch, clef)
    if (beamedSet.has(n)) { s += drawNoteHeadOnly(cx, pos, n.duration || 'q', color, sb) }
    else { s += drawNoteHead(cx, pos, n.duration || 'q', color, sb) }
    s += drawAccidental(cx, pos, m[2] || null, color, sb)
    // Syllable text below the staff
    if (n.syllable && syllableY) {
      s += `<text x="${cx}" y="${syllableY}" font-size="11" fill="#7c3aed" text-anchor="middle" font-weight="bold" font-family="'Noto Sans JP',sans-serif">${n.syllable}</text>`
    }
  }
  for (const g of beamGroups) s += drawBeamGroup(g, clef, mx, bw, sb, color)

  // Triplet brackets — detect consecutive tq/t8 groups of 3
  let ti = 0
  while (ti < sorted.length) {
    const n = sorted[ti]
    if (n.duration === 'tq' || n.duration === 't8') {
      // Collect consecutive triplet notes
      const tripStart = ti
      while (ti < sorted.length && (sorted[ti].duration === 'tq' || sorted[ti].duration === 't8')) ti++
      const tripNotes = sorted.slice(tripStart, ti)
      // Draw "3" bracket for each group of 3
      for (let gi = 0; gi < tripNotes.length; gi += 3) {
        const grp = tripNotes.slice(gi, Math.min(gi + 3, tripNotes.length))
        if (grp.length < 2) continue
        const x1 = mx + (grp[0].startBeat || 0) * bw + bw * 0.3
        const x2 = mx + (grp[grp.length - 1].startBeat || 0) * bw + bw * 0.3
        // Position bracket above or below based on average pitch
        const positions = grp.filter(gn => gn.pitch !== 'R').map(gn => pitchPos(gn.pitch, clef))
        if (positions.length === 0) continue
        const avgP = positions.reduce((a, b) => a + b, 0) / positions.length
        const above = avgP < 4
        const bracketY = above ? pY(Math.max(...positions), sb) - 32 : pY(Math.min(...positions), sb) + 28
        const xMid = (x1 + x2) / 2
        // Bracket lines
        s += sLine(x1 - 2, bracketY, x1 - 2, bracketY + (above ? 4 : -4), '#555', 0.8)
        s += sLine(x1 - 2, bracketY, xMid - 5, bracketY, '#555', 0.8)
        s += sLine(xMid + 5, bracketY, x2 + 2, bracketY, '#555', 0.8)
        s += sLine(x2 + 2, bracketY, x2 + 2, bracketY + (above ? 4 : -4), '#555', 0.8)
        // "3" text
        s += `<text x="${xMid}" y="${bracketY + (above ? -1 : 11)}" font-size="9" fill="#555" text-anchor="middle" font-family="serif" font-style="italic">3</text>`
      }
    } else {
      ti++
    }
  }

  return s
}

/** Scan measures to find note position range */
function posRange(measures: StaffMeasure[], clef: string, noteKey: 'notes' | 'melNotes' = 'notes'): [number, number] {
  let minP = 0, maxP = 8
  for (const meas of measures) {
    for (const n of (meas[noteKey] || meas.notes || [])) {
      if (!n.pitch || n.pitch === 'R') continue
      const p = pitchPos(n.pitch, clef)
      if (p < minP) minP = p
      if (p > maxP) maxP = p
    }
  }
  return [minP, maxP]
}

interface StaffMeasure {
  chord?: string
  notes?: MelNote[]
  rh?: MelNote[]
  lh?: MelNote[]
  melNotes?: MelNote[]
  pattern?: Record<string, number[]>
}

export function singleStaffSVG(measures: StaffMeasure[], clef: string, color: string, timeSig?: { beats: number; value: number }): string {
  const [minPos, maxPos] = posRange(measures, clef)
  const tsBeats = timeSig?.beats ?? 4
  const tsValue = timeSig?.value ?? 4

  // Check if any notes have syllables
  const hasSyllables = measures.some(m => (m.notes || []).some(n => n.syllable))

  // Dynamic padding based on note range
  const extraAbove = maxPos > 8 ? (maxPos - 8) * SH + 20 : 0
  const extraBelow = minPos < 0 ? (-minPos) * SH + 10 : 0
  const CHORD_H = 16
  const SYLLABLE_H = hasSyllables ? 20 : 0
  const PT = CHORD_H + extraAbove + 4
  const PB = Math.max(14, extraBelow + SYLLABLE_H)
  const staffTop = PT, staffBot = staffTop + 4 * SS, svgH = staffBot + PB
  // Measure width scales with beats (wider for 5/4, 6/8, etc.)
  const bpmFactor = tsValue === 8 ? tsBeats / 2 : tsBeats
  const MW = Math.round(152 * bpmFactor / 4)
  const CLEF_W = 58, w = CLEF_W + measures.length * MW + 8

  // Syllable text Y position: below staff + any extra below space
  const syllableY = staffBot + extraBelow + 12

  let svg = `<svg width="${w}" height="${svgH}" style="display:block">`
  svg += staveLines(2, staffTop, w - 4)
  if (clef === 'bass') svg += drawBassClef(4, staffTop)
  else svg += drawTrebleClef(2, staffTop, staffBot)
  // Time signature display
  svg += drawTimeSigNum(46, staffTop + SS * 2 + 2, tsBeats)
  svg += drawTimeSigNum(46, staffTop + SS * 4 + 2, tsValue)
  svg += sLine(CLEF_W - 3, staffTop, CLEF_W - 3, staffBot, '#333', 1.2)

  const chordY = CHORD_H - 2

  let x = CLEF_W
  for (const meas of measures) {
    if (meas.chord) svg += `<text x="${x + MW / 2}" y="${chordY}" font-size="10" fill="#7c3aed" text-anchor="middle" font-family="monospace">${meas.chord}</text>`
    svg += renderNotes(meas.notes || [], clef, x + 6, MW - 12, staffBot, color, hasSyllables ? syllableY : undefined, bpmFactor)
    svg += sLine(x + MW, staffTop, x + MW, staffBot, '#555', 0.8)
    x += MW
  }
  svg += sLine(x, staffTop, x, staffBot, '#333', 1.8)
  svg += '</svg>'
  return svg
}

export function grandStaffSVG(measures: StaffMeasure[], color: string): string {
  // Scan RH and LH notes for range
  let rhMax = 8, lhMin = 0
  for (const meas of measures) {
    const rh = (meas.rh || meas.notes || []).filter(n => {
      if (!n.pitch) return true
      const m = n.pitch.match(/^([A-G])(#|b)?(\d)$/)
      return m && parseInt(m[3]) >= 4
    })
    const lh = (meas.lh || meas.notes || []).filter(n => {
      if (!n.pitch) return true
      const m = n.pitch.match(/^([A-G])(#|b)?(\d)$/)
      return m && parseInt(m[3]) <= 3
    })
    for (const n of rh) {
      if (!n.pitch || n.pitch === 'R') continue
      const p = pitchPos(n.pitch, 'treble')
      if (p > rhMax) rhMax = p
    }
    for (const n of lh) {
      if (!n.pitch || n.pitch === 'R') continue
      const p = pitchPos(n.pitch, 'bass')
      if (p < lhMin) lhMin = p
    }
  }

  const extraAbove = rhMax > 8 ? (rhMax - 8) * SH + 16 : 0
  const extraBelow = lhMin < 0 ? (-lhMin) * SH + 10 : 0
  const PT = 20 + extraAbove, IGAP = 18, PB = Math.max(20, extraBelow)
  const RHtop = PT, RHbot = RHtop + 4 * SS, LHtop = RHbot + IGAP, LHbot = LHtop + 4 * SS, svgH = LHbot + PB
  const CLEF_W = 64, MW = 164, w = CLEF_W + measures.length * MW + 8
  let svg = `<svg width="${w}" height="${svgH}" style="display:block">`
  svg += `<path d="M 7,${RHtop} q -16,${(LHbot - RHtop) / 2} 0,${LHbot - RHtop}" stroke="#333" fill="none" stroke-width="3"/>`
  svg += staveLines(12, RHtop, w - 16)
  svg += staveLines(12, LHtop, w - 16)
  svg += sLine(12, RHtop, 12, LHbot, '#333', 1.5)
  svg += drawTrebleClef(13, RHtop, RHbot)
  svg += drawBassClef(13, LHtop);
  [RHtop, LHtop].forEach(t => {
    svg += drawTimeSigNum(48, t + SS * 2 + 2, 4)
    svg += drawTimeSigNum(48, t + SS * 4 + 2, 4)
  })
  svg += sLine(CLEF_W - 3, RHtop, CLEF_W - 3, LHbot, '#333', 1.2)
  let x = CLEF_W
  for (const meas of measures) {
    if (meas.chord) svg += `<text x="${x + MW / 2}" y="${RHtop - 5}" font-size="10" fill="#7c3aed" text-anchor="middle" font-family="monospace">${meas.chord}</text>`
    const rh = (meas.rh || meas.notes || []).filter(n => {
      if (!n.pitch) return true
      const m = n.pitch.match(/^([A-G])(#|b)?(\d)$/)
      return m && parseInt(m[3]) >= 4
    })
    const lh = (meas.lh || meas.notes || []).filter(n => {
      if (!n.pitch) return true
      const m = n.pitch.match(/^([A-G])(#|b)?(\d)$/)
      return m && parseInt(m[3]) <= 3
    })
    svg += renderNotes(rh, 'treble', x + 6, MW - 12, RHbot, color)
    svg += renderNotes(lh, 'bass', x + 6, MW - 12, LHbot, color)
    svg += sLine(x + MW, RHtop, x + MW, LHbot, '#555', 0.8)
    x += MW
  }
  svg += sLine(x, RHtop, x, LHbot, '#333', 2)
  svg += '</svg>'
  return svg
}

export function drumStaffSVG(measures: StaffMeasure[]): string {
  const PT = 18, PB = 18, MW = 164, CLEF_W = 42
  const staffTop = PT, staffBot = staffTop + 4 * SS, svgH = staffBot + PB
  const w = CLEF_W + measures.length * MW + 8
  let svg = `<svg width="${w}" height="${svgH}" style="display:block">`
  svg += staveLines(2, staffTop, w - 4)
  svg += `<rect x="8" y="${staffTop + SS}" width="4" height="${SS * 2}" fill="#555" rx="1"/><rect x="14" y="${staffTop + SS}" width="4" height="${SS * 2}" fill="#555" rx="1"/>`
  svg += sLine(CLEF_W - 3, staffTop, CLEF_W - 3, staffBot, '#333', 1.2)
  const DPOS: Record<string, number> = { HH: 8, CY: 10, SD: 4, BD: 0 }
  const DC: Record<string, string> = { HH: '#e8a020', CY: '#50c878', SD: '#9060e8', BD: '#3b82f6' }
  let x = CLEF_W
  for (const meas of measures) {
    if (meas.chord) svg += `<text x="${x + MW / 2}" y="${staffTop - 5}" font-size="10" fill="#7c3aed" text-anchor="middle" font-family="monospace">${meas.chord}</text>`
    const pat = meas.pattern || {}
    const bw = (MW - 12) / 8
    Object.entries(pat).forEach(([drum, row]) => {
      const pos = DPOS[drum] ?? 4
      const dc = DC[drum] || '#333'
      const y = pY(pos, staffBot);
      (row || []).forEach((on: number, bi: number) => {
        if (!on) return
        const cx = x + 6 + bi * bw + bw / 2
        svg += sLine(cx - 4, y - 4, cx + 4, y + 4, dc, 1.8) + sLine(cx + 4, y - 4, cx - 4, y + 4, dc, 1.8)
      })
    })
    svg += sLine(x + MW, staffTop, x + MW, staffBot, '#555', 0.8)
    x += MW
  }
  svg += sLine(x, staffTop, x, staffBot, '#333', 2)
  svg += '</svg>'
  return svg
}

export function melodyStaffSVG(measures: StaffMeasure[], color = '#333', timeSig?: { beats: number; value: number }): string {
  return singleStaffSVG(
    measures.map(m => ({ ...m, notes: m.melNotes || [] })),
    'treble',
    color,
    timeSig,
  )
}
