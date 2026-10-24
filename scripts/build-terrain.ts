/**
 * Modelo de terreno para el modelo hidrológico → data/hydro.json
 *
 * 1. Elevación: Terrain Tiles (AWS Open Data, s3://elevation-tiles-prod, formato terrarium), que en México
 *    provienen de SRTM (misión de radar satelital de la NASA), z13 ≈ 18 m por pixel.
 * 2. Suavizado 3x3 para quitar ruido del radar.
 * 3. Priority-Flood (Barnes 2014): DEM "llenado"; las celdas con lleno > elevación son hondonadas (depresiones).
 * 4. Depresiones = componentes conexos con el mismo nivel de derrame; se descartan las de < 25 cm o < 4 celdas.
 * 5. Cuenca de aporte: cada celda sigue la máxima pendiente (D8) hasta un fondo; si cae en una depresión, aporta a ella.
 * 6. Cada tramo de calle se muestrea cada ~8 m; se guarda la cota más baja del tramo dentro de cada depresión.
 *
 * Uso: npx tsx scripts/build-terrain.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { haversineM, type Position, type StreetSegment } from '../core/src/index';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const Z = 13;
const BBOX = { s: 20.89, w: -89.73, n: 21.07, e: -89.54 };
const MIN_DEPTH_M = 0.25;
const MIN_CELLS = 4;
/** Más hondas que esto: sascaberas (canteras) o artefactos del radar, no calles. */
const MAX_DEPTH_M = 4;

const tileX = (lon: number) => Math.floor(((lon + 180) / 360) * 2 ** Z);
const tileY = (lat: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** Z);
};
/** Coordenada en pixeles globales (mercator) a z. */
const px = (lon: number, lat: number): [number, number] => {
  const r = (lat * Math.PI) / 180;
  const n = 2 ** Z * 256;
  return [((lon + 180) / 360) * n, ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n];
};

const x0 = tileX(BBOX.w), x1 = tileX(BBOX.e), y0 = tileY(BBOX.n), y1 = tileY(BBOX.s);
const W = (x1 - x0 + 1) * 256, H = (y1 - y0 + 1) * 256;
const raw = new Float32Array(W * H);

console.log(`descargando ${(x1 - x0 + 1) * (y1 - y0 + 1)} teselas z${Z}…`);
for (let tx = x0; tx <= x1; tx++) {
  for (let ty = y0; ty <= y1; ty++) {
    const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${tx}/${ty}.png`);
    if (!res.ok) throw new Error(`tesela ${tx}/${ty}: ${res.status}`);
    const png = PNG.sync.read(Buffer.from(await res.arrayBuffer()));
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        const i = (y * 256 + x) * 4;
        const elev = png.data[i]! * 256 + png.data[i + 1]! + png.data[i + 2]! / 256 - 32768;
        raw[((ty - y0) * 256 + y) * W + (tx - x0) * 256 + x] = elev;
      }
  }
}

// Suavizado 3x3
const z = new Float32Array(W * H);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    let s = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy >= 0 && yy < H && xx >= 0 && xx < W) { s += raw[yy * W + xx]!; n++; }
      }
    z[y * W + x] = s / n;
  }

// Priority-Flood con montículo binario
const filled = Float32Array.from(z);
const seen = new Uint8Array(W * H);
const heap: number[] = [];
const less = (a: number, b: number) => filled[a]! < filled[b]!;
const push = (i: number) => {
  heap.push(i);
  let k = heap.length - 1;
  while (k > 0) {
    const p = (k - 1) >> 1;
    if (!less(heap[k]!, heap[p]!)) break;
    [heap[k], heap[p]] = [heap[p]!, heap[k]!];
    k = p;
  }
};
const pop = () => {
  const top = heap[0]!;
  const last = heap.pop()!;
  if (heap.length) {
    heap[0] = last;
    let k = 0;
    for (;;) {
      const l = 2 * k + 1, r = l + 1;
      let m = k;
      if (l < heap.length && less(heap[l]!, heap[m]!)) m = l;
      if (r < heap.length && less(heap[r]!, heap[m]!)) m = r;
      if (m === k) break;
      [heap[k], heap[m]] = [heap[m]!, heap[k]!];
      k = m;
    }
  }
  return top;
};
const NB = [-1, 0, 1];
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++)
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) { seen[y * W + x] = 1; push(y * W + x); }
while (heap.length) {
  const c = pop();
  const cx = c % W, cy = (c / W) | 0;
  for (const dy of NB)
    for (const dx of NB) {
      if (!dx && !dy) continue;
      const xx = cx + dx, yy = cy + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const n = yy * W + xx;
      if (seen[n]) continue;
      seen[n] = 1;
      filled[n] = Math.max(z[n]!, filled[c]!);
      push(n);
    }
}

// Depresiones: componentes conexos de celdas hundidas con el mismo nivel de derrame
const label = new Int32Array(W * H).fill(-1);
interface Dep { cells: number[]; spill: number; maxDepth: number }
const deps: Dep[] = [];
for (let i = 0; i < W * H; i++) {
  if (label[i] !== -1 || filled[i]! - z[i]! <= 0.01) continue;
  const id = deps.length;
  const spill = filled[i]!;
  const d: Dep = { cells: [], spill, maxDepth: 0 };
  const stack = [i];
  label[i] = id;
  while (stack.length) {
    const c = stack.pop()!;
    d.cells.push(c);
    d.maxDepth = Math.max(d.maxDepth, spill - z[c]!);
    const cx = c % W, cy = (c / W) | 0;
    for (const dy of NB)
      for (const dx of NB) {
        const xx = cx + dx, yy = cy + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const n = yy * W + xx;
        if (label[n] === -1 && filled[n]! - z[n]! > 0.01 && Math.abs(filled[n]! - spill) < 1e-3) {
          label[n] = id;
          stack.push(n);
        }
      }
  }
  deps.push(d);
}
const keep = new Int32Array(deps.length).fill(-1);
const kept: Dep[] = [];
deps.forEach((d, i) => {
  if (d.maxDepth >= MIN_DEPTH_M && d.maxDepth <= MAX_DEPTH_M && d.cells.length >= MIN_CELLS) { keep[i] = kept.length; kept.push(d); }
});

// Cuenca de aporte por máxima pendiente (D8) con memo
const sinkOf = new Int32Array(W * H).fill(-2); // -2 sin calcular, -1 ninguna
for (let i = 0; i < W * H; i++) {
  if (sinkOf[i] !== -2) continue;
  const path: number[] = [];
  let c = i;
  let result = -1;
  for (;;) {
    if (sinkOf[c] !== -2) { result = sinkOf[c]!; break; }
    if (label[c] !== -1) { result = keep[label[c]!]!; break; }
    path.push(c);
    const cx = c % W, cy = (c / W) | 0;
    let best = c;
    for (const dy of NB)
      for (const dx of NB) {
        const xx = cx + dx, yy = cy + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const n = yy * W + xx;
        if (z[n]! < z[best]!) best = n;
      }
    if (best === c) break;
    c = best;
  }
  for (const p of path) sinkOf[p] = result;
  if (label[i] !== -1) sinkOf[i] = keep[label[i]!]!;
}

// Tamaño de celda en metros a la latitud media
const latMid = (BBOX.n + BBOX.s) / 2;
const cellM = (156543.03392 * Math.cos((latMid * Math.PI) / 180)) / 2 ** Z;
const cellArea = cellM * cellM;
const catch_ = new Float64Array(kept.length);
for (let i = 0; i < W * H; i++) if (sinkOf[i]! >= 0) catch_[sinkOf[i]!]! += cellArea;

// Muestreo de tramos
const segments = JSON.parse(readFileSync(join(DATA_DIR, 'segments.json'), 'utf8')) as StreetSegment[];
const [ox, oy] = [x0 * 256, y0 * 256];
const cellAt = (p: Position) => {
  const [gx, gy] = px(p[0], p[1]);
  const x = Math.floor(gx - ox), y = Math.floor(gy - oy);
  return x < 0 || y < 0 || x >= W || y >= H ? -1 : y * W + x;
};
const segDeps: Record<string, [number, number][]> = {};
let touched = 0;
for (const s of segments) {
  const best = new Map<number, number>();
  const cs = s.geometry.coordinates;
  for (let k = 1; k < cs.length; k++) {
    const a = cs[k - 1]!, b = cs[k]!;
    const n = Math.max(1, Math.ceil(haversineM(a, b) / 8));
    for (let j = 0; j <= n; j++) {
      const p: Position = [a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n];
      const c = cellAt(p);
      if (c < 0 || label[c] === -1) continue;
      const d = keep[label[c]!]!;
      if (d < 0) continue;
      const zc = z[c]!;
      if (!best.has(d) || zc < best.get(d)!) best.set(d, zc);
    }
  }
  if (best.size) {
    touched++;
    segDeps[s.segmentId] = [...best].map(([d, zz]) => [d, Math.round(zz * 100) / 100]);
  }
}

const out = {
  source: 'Terrain Tiles (AWS Open Data, SRTM/NASA) z13, Priority-Flood + D8',
  cellAreaM2: Math.round(cellArea * 10) / 10,
  depressions: kept.map((d, i) => ({
    spill: Math.round(d.spill * 100) / 100,
    catchAreaM2: Math.round(catch_[i]!),
    zs: d.cells.map((c) => Math.round(z[c]! * 100) / 100).sort((a, b) => a - b),
  })),
  segments: segDeps,
};
writeFileSync(join(DATA_DIR, 'hydro.json'), JSON.stringify(out));
const depthStats = kept.map((d) => d.maxDepth).sort((a, b) => b - a);
console.log(
  `DEM ${W}x${H} celdas de ${cellM.toFixed(1)} m · elev ${z.reduce((a, b) => Math.min(a, b), 1e9).toFixed(1)}–${z.reduce((a, b) => Math.max(a, b), -1e9).toFixed(1)} m · ` +
    `depresiones ${kept.length} (de ${deps.length}) · más profundas ${depthStats.slice(0, 5).map((x) => x.toFixed(2)).join(', ')} m · ` +
    `tramos en depresión ${touched}/${segments.length}`,
);
