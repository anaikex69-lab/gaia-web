import * as THREE from "three"

export type GalaxyData = {
  count: number
  positions: Float32Array
  colors: Float32Array
  sizes: Float32Array
  radii: Float32Array // normalized 0..1 distance from core
  seeds: Float32Array
  // line segment buffers
  linePositions: Float32Array
  lineColors: Float32Array
  lineRadii: Float32Array
  lineSeeds: Float32Array
  lineCount: number
  radius: number
}

// Color helpers (deep-space palette: white, light blue, cyan, soft purple)
const COL_WHITE = new THREE.Color("#eaf2ff")
const COL_BLUE = new THREE.Color("#7fb6ff")
const COL_CYAN = new THREE.Color("#46e0ff")
const COL_PURPLE = new THREE.Color("#9d7bff")

function gaussian(rng: () => number) {
  // Box-Muller
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

// Small seeded RNG for stable galaxies between renders
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generateGalaxy(
  options: {
    count?: number
    arms?: number
    radius?: number
    spin?: number
    neighbors?: number
    maxLinkDist?: number
  } = {},
): GalaxyData {
  const count = options.count ?? 1400
  const arms = options.arms ?? 3
  const radius = options.radius ?? 9
  const spin = options.spin ?? 2.4
  const neighbors = options.neighbors ?? 3
  const maxLinkDist = options.maxLinkDist ?? 1.4

  const rng = mulberry32(20260619)

  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const radii = new Float32Array(count)
  const seeds = new Float32Array(count)

  const tmp = new THREE.Color()

  for (let i = 0; i < count; i++) {
    const i3 = i * 3

    // distance from center, biased toward core
    const t = Math.pow(rng(), 0.65)
    const r = t * radius
    const branch = (i % arms) / arms
    const branchAngle = branch * Math.PI * 2

    const spinAngle = r * spin * 0.45
    const angle = branchAngle + spinAngle

    // scatter, wider near the outside but always present
    const scatter = (0.18 + t * 0.55) * 1.0
    const sx = gaussian(rng) * scatter
    const sy = gaussian(rng) * scatter * 0.35 * (1 - t * 0.6)
    const sz = gaussian(rng) * scatter

    const x = Math.cos(angle) * r + sx
    const y = sy
    const z = Math.sin(angle) * r + sz

    positions[i3] = x
    positions[i3 + 1] = y
    positions[i3 + 2] = z

    radii[i] = Math.min(1, Math.sqrt(x * x + z * z) / radius)
    seeds[i] = rng() * 100

    // color: core = warm white, mid = blue, edges = cyan with rare purple
    const rn = radii[i]
    tmp.copy(COL_WHITE).lerp(COL_BLUE, Math.min(1, rn * 1.2))
    if (rng() > 0.86) tmp.lerp(COL_CYAN, 0.5)
    if (rng() > 0.95) tmp.lerp(COL_PURPLE, 0.6)
    colors[i3] = tmp.r
    colors[i3 + 1] = tmp.g
    colors[i3 + 2] = tmp.b

    // brighter, bigger stars toward the core
    sizes[i] = (1 - rn) * 18 + 6 + rng() * 8
  }

  // Build connections: link each star to a few nearby stars using a spatial grid
  const cell = maxLinkDist
  const grid = new Map<string, number[]>()
  const key = (cx: number, cy: number, cz: number) => `${cx},${cy},${cz}`
  const cellOf = (v: number) => Math.floor(v / cell)

  for (let i = 0; i < count; i++) {
    const i3 = i * 3
    const k = key(cellOf(positions[i3]), cellOf(positions[i3 + 1]), cellOf(positions[i3 + 2]))
    const arr = grid.get(k)
    if (arr) arr.push(i)
    else grid.set(k, [i])
  }

  const seen = new Set<number>()
  const lineP: number[] = []
  const lineC: number[] = []
  const lineR: number[] = []
  const lineS: number[] = []
  const maxLinkSq = maxLinkDist * maxLinkDist

  const lineColA = new THREE.Color()
  const lineColB = new THREE.Color()

  for (let i = 0; i < count; i++) {
    const i3 = i * 3
    const px = positions[i3]
    const py = positions[i3 + 1]
    const pz = positions[i3 + 2]
    const cx = cellOf(px)
    const cy = cellOf(py)
    const cz = cellOf(pz)

    // gather candidates in neighboring cells
    const cand: { j: number; d: number }[] = []
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const arr = grid.get(key(cx + dx, cy + dy, cz + dz))
          if (!arr) continue
          for (const j of arr) {
            if (j === i) continue
            const j3 = j * 3
            const ddx = positions[j3] - px
            const ddy = positions[j3 + 1] - py
            const ddz = positions[j3 + 2] - pz
            const d = ddx * ddx + ddy * ddy + ddz * ddz
            if (d <= maxLinkSq) cand.push({ j, d })
          }
        }
      }
    }
    cand.sort((a, b) => a.d - b.d)

    let linked = 0
    for (const { j } of cand) {
      if (linked >= neighbors) break
      const pairKey = i < j ? i * count + j : j * count + i
      if (seen.has(pairKey)) continue
      seen.add(pairKey)
      linked++

      const j3 = j * 3
      lineP.push(px, py, pz, positions[j3], positions[j3 + 1], positions[j3 + 2])

      // connection colors: cyan with occasional purple, biased to outer ring
      const midR = (radii[i] + radii[j]) * 0.5
      lineColA.copy(COL_CYAN)
      if ((i + j) % 7 === 0) lineColA.copy(COL_PURPLE)
      lineColB.copy(lineColA)
      lineC.push(lineColA.r, lineColA.g, lineColA.b, lineColB.r, lineColB.g, lineColB.b)
      lineR.push(radii[i], radii[j])
      const s = seeds[i] * 0.5 + 7
      lineS.push(s, s)
      void midR
    }
  }

  return {
    count,
    positions,
    colors,
    sizes,
    radii,
    seeds,
    linePositions: new Float32Array(lineP),
    lineColors: new Float32Array(lineC),
    lineRadii: new Float32Array(lineR),
    lineSeeds: new Float32Array(lineS),
    lineCount: lineP.length / 3,
    radius,
  }
}