import type { PanelConfig, Project, Rig, RigItem } from '../types'
import { cellRects, computeMetrics, hasPlate, outlineOf } from './calc'
import {
  box, depthPerZ, faceBounds, projectFaces, project as projectPoint, wedge, VIEWS,
  type Camera, type Face, type Vec3, type Wire,
} from './scene3d'
import { COLORS } from './sheetSpec'
import { tint } from './layout'

/** Tons neutros das peças, quando nenhuma cor foi atribuída. */
const SHADE = {
  panel: '#eef3f9',
  deck: '#e6e9ee',
  brace: '#dfe4ea',
  volume: '#e9edf2',
  ground: '#f6f8fa',
} as const

const stroke = COLORS.moduleStroke

/**
 * Placas do painel como volume, respeitando o formato livre.
 *
 * A face escondida do painel é descartada antes da ordenação. O painel é uma
 * chapa fina dividida em muitas placas, e o algoritmo do pintor ordena face a
 * face: numa vista inclinada, a placa do fundo de um trecho fica mais perto do
 * observador que a placa da frente de outro trecho, as duas se intercalam e o
 * painel aparece vazado. Como as duas faces são planas e paralelas, dá para
 * saber qual delas a câmera vê sem ordenar nada — e a que sobra não disputa
 * profundidade com ninguém, porque suas placas são coplanares.
 */
function panelFaces(item: RigItem, panel: PanelConfig | null, cam: Camera): Face[] {
  const faces: Face[] = []
  const fill = item.color ? tint(item.color, 0.72) : SHADE.panel
  const style = { fill, stroke, width: 0.25 }

  if (!panel) {
    return box(item.x, item.y, item.z, item.wMm, item.hMm, item.dMm, style)
  }

  const m = computeMetrics(panel)
  const d = item.dMm
  // A altura do painel cresce para cima a partir de `y`; a grade conta de
  // cima para baixo, então a linha 0 fica no topo.
  const top = item.y + panel.heightMm
  const px = (mm: number) => item.x + mm
  const py = (mm: number) => top - mm

  const p = (x: number, y: number, z: number): Vec3 => ({ x, y, z })

  // De perfil as duas faces se projetam na mesma linha: aí nenhuma esconde a
  // outra e as duas ficam.
  const away = depthPerZ(cam)
  const planes: number[] = []
  if (away > 1e-6) planes.push(item.z)
  else if (away < -1e-6) planes.push(item.z + d)
  else planes.push(item.z, item.z + d)

  for (const c of cellRects(m, (col, row) => hasPlate(panel, col, row))) {
    const x0 = px(c.x0), x1 = px(c.x1)
    const y0 = py(c.y1), y1 = py(c.y0)
    // Uma placa por vez na face visível: é o que deixa a modulação aparecer.
    for (const z of planes) {
      faces.push({ pts: [p(x0, y0, z), p(x1, y0, z), p(x1, y1, z), p(x0, y1, z)], ...style })
    }
  }

  // As laterais só existem no contorno da forma: num pórtico, contornam o vão.
  for (const seg of outlineOf(m, (col, row) => hasPlate(panel, col, row))) {
    const a = { x: px(seg.x1), y: py(seg.y1) }
    const b = { x: px(seg.x2), y: py(seg.y2) }
    faces.push({
      pts: [
        p(a.x, a.y, item.z), p(b.x, b.y, item.z),
        p(b.x, b.y, item.z + d), p(a.x, a.y, item.z + d),
      ],
      ...style,
    })
  }
  return faces
}

/** Praticável: tampo apoiado em quatro pernas reguláveis. */
function deckFaces(item: RigItem): Face[] {
  const fill = item.color ? tint(item.color, 0.72) : SHADE.deck
  const style = { fill, stroke, width: 0.25 }
  const leg = Math.max(0, item.legMm)
  const faces = box(item.x, item.y + leg, item.z, item.wMm, item.hMm, item.dMm, style)

  const t = 80
  const inset = 40
  const corners: Array<[number, number]> = [
    [item.x + inset, item.z + inset],
    [item.x + item.wMm - inset - t, item.z + inset],
    [item.x + inset, item.z + item.dMm - inset - t],
    [item.x + item.wMm - inset - t, item.z + item.dMm - inset - t],
  ]
  for (const [lx, lz] of corners) {
    faces.push(...box(lx, item.y, lz, t, leg, t, { ...style, width: 0.2 }))
  }
  return faces
}

/**
 * Peças de uma montagem, já com as repetições resolvidas.
 *
 * A câmera entra aqui porque a cena depende dela: peças planas descartam a
 * face que o observador não vê. Sem ela vale a vista escolhida na folha.
 */
export function rigFaces(project: Project, rig: Rig, cam: Camera = VIEWS[rig.view]): Face[] {
  const faces: Face[] = []
  const panelById = new Map(project.panels.map((p) => [p.id, p]))

  for (const item of rig.items) {
    const times = Math.max(1, Math.round(item.count))
    for (let i = 0; i < times; i++) {
      const at: RigItem = { ...item, x: item.x + i * item.stepMm }
      let made: Face[]
      switch (item.kind) {
        case 'painel':
          made = panelFaces(at, at.panelId ? panelById.get(at.panelId) ?? null : null, cam)
          break
        case 'praticavel':
          made = deckFaces(at)
          break
        case 'maoFrancesa':
          made = wedge(at.x, at.y, at.z, at.wMm, at.hMm, at.dMm, {
            fill: at.color ? tint(at.color, 0.72) : SHADE.brace,
            stroke,
            width: 0.25,
          })
          break
        default:
          made = box(at.x, at.y, at.z, at.wMm, at.hMm, at.dMm, {
            fill: at.color ? tint(at.color, 0.72) : SHADE.volume,
            stroke,
            width: 0.25,
          })
      }
      // Todas as repetições respondem pela mesma peça: arrastar qualquer uma
      // move o conjunto.
      for (const f of made) f.itemId = item.id
      faces.push(...made)
    }
  }

  if (rig.showGround && faces.length) {
    faces.unshift(...groundFaces(faces))
  }

  return faces
}

/**
 * Piso de referência: uma laje sob as peças, riscada de metro em metro.
 *
 * A malha é o que dá noção de tamanho na vista isométrica — sem ela, um painel
 * de 3 m e um de 12 m desenham igual. As linhas são traçado sem preenchimento,
 * então não escondem nada do que está apoiado nelas.
 */
function groundFaces(faces: Face[]): Face[] {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (const f of faces) {
    for (const p of f.pts) {
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x)
      z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z)
    }
  }
  const step = 1000
  const pad = 500
  const gx0 = Math.floor((x0 - pad) / step) * step
  const gx1 = Math.ceil((x1 + pad) / step) * step
  const gz0 = Math.floor((z0 - pad) / step) * step
  const gz1 = Math.ceil((z1 + pad) / step) * step

  const grid: Wire[] = []
  for (let x = gx0 + step; x < gx1; x += step) {
    grid.push({ pts: [{ x, y: 0, z: gz0 }, { x, y: 0, z: gz1 }], stroke: COLORS.dash, width: 0.12 })
  }
  for (let z = gz0 + step; z < gz1; z += step) {
    grid.push({ pts: [{ x: gx0, y: 0, z }, { x: gx1, y: 0, z }], stroke: COLORS.dash, width: 0.12 })
  }

  return [{
    pts: [
      { x: gx0, y: 0, z: gz0 }, { x: gx1, y: 0, z: gz0 },
      { x: gx1, y: 0, z: gz1 }, { x: gx0, y: 0, z: gz1 },
    ],
    fill: SHADE.ground,
    stroke: COLORS.dash,
    width: 0.2,
    lines: grid,
    back: true,
  }]
}

/**
 * Envoltória da montagem em milímetros.
 *
 * O piso é ignorado: ele é uma referência visual, desenhada com folga em volta
 * das peças, e entraria somando essa folga à medida informada na folha.
 */
export function rigBounds(faces: Face[]) {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity
  let x1 = -Infinity, y1 = -Infinity, z1 = -Infinity
  for (const f of faces) {
    if (!f.itemId) continue
    for (const p of f.pts) {
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x)
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y)
      z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z)
    }
  }
  if (!Number.isFinite(x0)) return { wMm: 0, hMm: 0, dMm: 0 }
  return { wMm: x1 - x0, hMm: y1 - y0, dMm: z1 - z0 }
}


/** Uma cota da montagem: o trecho medido e o rótulo. */
export interface RigDim {
  a: Vec3
  b: Vec3
  /** Deslocamento da linha de cota em relação ao trecho medido. */
  off: Vec3
  label: string
}

/**
 * Cotas da montagem: as três medidas gerais e as alturas que importam para
 * montar — a que o painel fica do chão e a do tampo do praticável.
 */
export function rigDimensions(project: Project, rig: Rig): RigDim[] {
  const faces = rigFaces(project, rig)
  let x0 = Infinity, y0 = Infinity, z0 = Infinity
  let x1 = -Infinity, y1 = -Infinity, z1 = -Infinity
  for (const f of faces) {
    if (!f.itemId) continue
    for (const p of f.pts) {
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x)
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y)
      z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z)
    }
  }
  if (!Number.isFinite(x0)) return []

  const span = Math.max(x1 - x0, y1 - y0, z1 - z0)
  const off = Math.max(300, span * 0.09)
  const m = (mm: number) => `${(mm / 1000).toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}m`

  const dims: RigDim[] = [
    {
      a: { x: x0, y: y0, z: z0 }, b: { x: x1, y: y0, z: z0 },
      off: { x: 0, y: 0, z: -off }, label: m(x1 - x0),
    },
    {
      a: { x: x0, y: y0, z: z0 }, b: { x: x0, y: y1, z: z0 },
      off: { x: -off, y: 0, z: 0 }, label: m(y1 - y0),
    },
    {
      a: { x: x1, y: y0, z: z0 }, b: { x: x1, y: y0, z: z1 },
      off: { x: off, y: 0, z: 0 }, label: m(z1 - z0),
    },
  ]

  // Altura do painel em relação ao chão: a medida que o montador procura.
  const panel = rig.items.find((i) => i.kind === 'painel' && i.y > 0)
  if (panel) {
    dims.push({
      a: { x: panel.x, y: 0, z: panel.z },
      b: { x: panel.x, y: panel.y, z: panel.z },
      off: { x: -off * 0.45, y: 0, z: -off * 0.45 },
      label: m(panel.y),
    })
  }

  // Altura do tampo do praticável, já com a regulagem das pernas.
  const deck = rig.items.find((i) => i.kind === 'praticavel')
  if (deck) {
    const top = deck.y + deck.legMm + deck.hMm
    dims.push({
      a: { x: deck.x, y: 0, z: deck.z + deck.dMm },
      b: { x: deck.x, y: top, z: deck.z + deck.dMm },
      off: { x: -off * 0.45, y: 0, z: off * 0.45 },
      label: m(top),
    })
  }

  return dims
}

/**
 * As mesmas cotas, com o lado do deslocamento já resolvido pela projeção.
 *
 * O deslocamento cai sobre a peça numa vista e fora dela noutra, então o lado
 * é escolhido pelo que afasta a linha do centro do desenho. Resolver aqui é o
 * que faz a cota na tela e a cota na folha saírem iguais.
 */
export function resolvedDimensions(project: Project, rig: Rig, cam: Camera): RigDim[] {
  const dims = rigDimensions(project, rig)
  if (!dims.length) return dims

  const b = faceBounds(projectFaces(rigFaces(project, rig, cam), cam))
  const center = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }

  return dims.map((d) => {
    const mid = { x: (d.a.x + d.b.x) / 2, y: (d.a.y + d.b.y) / 2, z: (d.a.z + d.b.z) / 2 }
    const away = (sign: number) => {
      const q = projectPoint(
        { x: mid.x + d.off.x * sign, y: mid.y + d.off.y * sign, z: mid.z + d.off.z * sign },
        cam,
      )
      return Math.hypot(q.x - center.x, q.y - center.y)
    }
    const sign = away(1) >= away(-1) ? 1 : -1
    return { ...d, off: { x: d.off.x * sign, y: d.off.y * sign, z: d.off.z * sign } }
  })
}
