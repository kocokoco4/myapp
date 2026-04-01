import type { Song } from '../types'

const DM: Record<string, number> = { w: 16, h: 8, q: 4, '8': 2, '16': 1 }
const TM: Record<string, string> = { w: 'whole', h: 'half', q: 'quarter', '8': 'eighth', '16': '16th' }

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// [Webhook候補] MusicXML出力イベントを外部に通知できる
// 例: LogicPro連携ログ / 他アプリへのデータ反映
export function exportMusicXML(song: Song): void {
  const ac = song.accomp
  if (!ac) return

  interface PartDef { id: string; name: string; instr: string; clef: string; hand: string | null }
  const partDefs: PartDef[] = []
  if (ac.piano) {
    partDefs.push({ id: 'P1', name: 'ピアノ右手', instr: 'piano', clef: 'treble', hand: 'rh' })
    partDefs.push({ id: 'P2', name: 'ピアノ左手', instr: 'piano', clef: 'bass', hand: 'lh' })
  }
  if (ac.bass) partDefs.push({ id: `P${partDefs.length + 1}`, name: 'ベース', instr: 'bass', clef: 'bass', hand: null })
  if (ac.guitar) partDefs.push({ id: `P${partDefs.length + 1}`, name: 'ギター', instr: 'guitar', clef: 'treble', hand: null })

  const pl = partDefs.map(p => `<score-part id="${p.id}"><part-name>${p.name}</part-name></score-part>`).join('')

  const parts = partDefs.map(p => {
    let mn = 1
    const data = ac[p.instr as keyof typeof ac]
    if (!data) return ''
    const cl = p.clef === 'bass' ? 'bass' : 'treble'
    const ms = data.sections?.flatMap(sec =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sec.measures || []).map((meas: any) => {
        const src = p.hand === 'rh' ? meas.rh || [] : p.hand === 'lh' ? meas.lh || [] : meas.notes || []
        let notes = src.filter((n: { pitch: string }) => n.pitch && n.pitch !== 'R').map((n: { pitch: string; duration?: string }) => {
          const m = n.pitch.match(/^([A-G])(#|b)?(\d)$/)
          if (!m) return null
          return { step: m[1], alter: m[2] === '#' ? 1 : m[2] === 'b' ? -1 : null, oct: m[3], dur: n.duration || 'q', type: TM[n.duration || 'q'] || 'quarter' }
        }).filter(Boolean)
        if (!notes.length) notes = [{ rest: true, dur: 'w', type: 'whole' }]
        const nx = notes.map((n: { rest?: boolean; step?: string; alter?: number | null; oct?: string; dur: string; type: string }) =>
          n.rest
            ? `<note><rest/><duration>16</duration><type>whole</type></note>`
            : `<note><pitch><step>${n.step}</step>${n.alter != null ? `<alter>${n.alter}</alter>` : ''}<octave>${n.oct}</octave></pitch><duration>${DM[n.dur] || 4}</duration><type>${n.type}</type></note>`
        ).join('')
        const attr = mn === 1
          ? `<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>${cl === 'bass' ? 'F' : 'G'}</sign><line>${cl === 'bass' ? 4 : 2}</line></clef></attributes>`
          : ''
        return `<measure number="${mn++}">${attr}${nx}</measure>`
      })
    ) || []
    return `<part id="${p.id}">${ms.join('')}</part>`
  }).join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd"><score-partwise version="3.1"><work><work-title>${esc(song.title)}</work-title></work><part-list>${pl}</part-list>${parts}</score-partwise>`
  const blob = new Blob([xml], { type: 'application/xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${song.title}.musicxml`
  a.click()
  URL.revokeObjectURL(url)
}
