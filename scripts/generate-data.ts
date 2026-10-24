/**
 * Genera datos SINTÉTICOS de demo (determinista, semilla fija):
 *   data/segments.json           retícula de calles del Centro de Mérida
 *   data/rain-2026-05-29.json    serie de lluvia cada 15 min
 * No son datos reales: sustituir por OSM + INEGI y la lluvia observada cuando estén disponibles.
 *
 * Uso: npx tsx scripts/generate-data.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { haversineM, type Position, type StreetSegment } from '../core/src/index';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260529);
const round = (x: number, d = 6) => Math.round(x * 10 ** d) / 10 ** d;

// Calles pares corren N-S (crecen hacia el poniente); impares corren E-O (crecen hacia el sur).
const EVEN = Array.from({ length: 20 }, (_, i) => 42 + 2 * i); // 42..80
const ODD = Array.from({ length: 18 }, (_, i) => 45 + 2 * i); // 45..79
const LNG_STEP = 0.00145; // ~150 m
const LAT_STEP = 0.00135; // ~150 m
const LNG_C60 = -89.6237;
const LAT_C61 = 20.9668;

const lngOf = (street: number) => LNG_C60 + ((street - 60) / 2) * -LNG_STEP;
const latOf = (street: number) => LAT_C61 + ((street - 61) / 2) * -LAT_STEP;

// Nodos con un pequeño desplazamiento para que no sea una cuadrícula perfecta.
const nodes: Position[][] = EVEN.map((e) =>
  ODD.map((o) => [round(lngOf(e) + (rand() - 0.5) * 0.00012), round(latOf(o) + (rand() - 0.5) * 0.00012)] as Position),
);

// Depresiones (puntos bajos) sintéticas. La primera, junto al mercado (Calle 60 x 61).
const DEPRESSIONS = [
  { center: [-89.6237, 20.9668] as Position, radiusM: 260, depthM: 2.6 },
  { center: [-89.6135, 20.9585] as Position, radiusM: 220, depthM: 2.2 },
  { center: [-89.6325, 20.9735] as Position, radiusM: 200, depthM: 1.9 },
];

function elevationAt(p: Position): number {
  let z = 0.3 + rand() * 1.2;
  for (const d of DEPRESSIONS) {
    const dist = haversineM(p, d.center);
    z -= d.depthM * Math.exp(-((dist / d.radiusM) ** 2));
  }
  return round(z, 2);
}

let counter = 0;
const segId = () => {
  counter += 1;
  const h = (Math.imul(counter, 2654435761) >>> 0).toString(16).padStart(8, '0');
  return `seg_${h.slice(0, 6)}`;
};

function makeSegment(name: string, a: Position, b: Position): StreetSegment {
  const mid: Position = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const relativeElevationM = elevationAt(mid);
  const inDepression = relativeElevationM < -0.8;
  const historicalFloodCount = inDepression ? 2 + Math.floor(rand() * 4) : rand() < 0.1 ? 1 : 0;
  return {
    segmentId: segId(),
    name,
    geometry: { type: 'LineString', coordinates: [a, b] },
    relativeElevationM,
    inDepression,
    historicalFloodCount,
  };
}

const segments: StreetSegment[] = [];
EVEN.forEach((street, i) => {
  for (let j = 0; j < ODD.length - 1; j++) segments.push(makeSegment(`Calle ${street}`, nodes[i]![j]!, nodes[i]![j + 1]!));
});
ODD.forEach((street, j) => {
  for (let i = 0; i < EVEN.length - 1; i++) segments.push(makeSegment(`Calle ${street}`, nodes[i]![j]!, nodes[i + 1]![j]!));
});

// Lluvia: curva gaussiana centrada a las 20:00Z (sigma 40 min, ~82 mm totales) + llovizna.
const START = Date.parse('2026-05-29T15:00:00Z');
const END = Date.parse('2026-05-30T00:00:00Z');
const STEP = 15 * 60 * 1000;
const PEAK = Date.parse('2026-05-29T20:00:00Z');
const SIGMA_MIN = 40;
const TOTAL_MM = 82;

const quarters: { t: number; mm: number }[] = [];
for (let t = START - 3 * 60 * 60 * 1000; t <= END; t += STEP) {
  const mid = (t - STEP / 2 - PEAK) / 60000;
  const density = Math.exp(-0.5 * (mid / SIGMA_MIN) ** 2) / (SIGMA_MIN * Math.sqrt(2 * Math.PI));
  const drizzle = t >= START ? 0.2 : 0;
  quarters.push({ t, mm: round(TOTAL_MM * density * 15 + drizzle, 2) });
}
const series = quarters
  .filter((q) => q.t >= START)
  .map((q) => {
    const sumSince = (ms: number) =>
      round(quarters.filter((x) => x.t > q.t - ms && x.t <= q.t).reduce((s, x) => s + x.mm, 0), 1);
    return {
      t: new Date(q.t).toISOString().replace('.000Z', 'Z'),
      rain15mMm: q.mm,
      accum1hMm: sumSince(60 * 60 * 1000),
      accum3hMm: sumSince(3 * 60 * 60 * 1000),
    };
  });

mkdirSync(DATA_DIR, { recursive: true });
writeFileSync(join(DATA_DIR, 'segments.json'), JSON.stringify(segments));
writeFileSync(
  join(DATA_DIR, 'rain-2026-05-29.json'),
  JSON.stringify({ event: '2026-05-29', synthetic: true, stepMinutes: 15, series }, null, 2),
);

const peak = series.reduce((a, b) => (b.accum1hMm > a.accum1hMm ? b : a));
console.log(
  `segments: ${segments.length} (en depresión: ${segments.filter((s) => s.inDepression).length}) · ` +
    `lluvia: ${series.length} pasos, pico 1h ${peak.accum1hMm} mm a las ${peak.t}, ` +
    `máx 3h ${Math.max(...series.map((s) => s.accum3hMm))} mm`,
);
