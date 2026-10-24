/**
 * Calles REALES del Centro de Mérida desde OpenStreetMap (Overpass API) → data/segments.json.
 * Cada vía se parte en tramos entre cruces (nodos compartidos), así el ruteo puede girar en cada esquina.
 * La geometría y los nombres son reales (© OpenStreetMap, ODbL). La elevación relativa, las depresiones
 * y el historial siguen siendo SINTÉTICOS de demo hasta tener INEGI (CEM) y registros de Protección Civil.
 *
 * Uso: npx tsx scripts/import-osm.ts   (después: npx tsx scripts/build-replay.ts)
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { haversineM, type Position, type StreetSegment } from '../core/src/index';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
/** Toda la ciudad (dentro del Periférico y un poco más): solo avenidas y calles principales. */
const CITY = { s: 20.89, w: -89.73, n: 21.07, e: -89.54 };
const ARTERIALS = 'motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link';
const LOCAL = 'residential|unclassified|living_street';
/** Zonas críticas del spec (§1.5): todas las calles. Centros aproximados (Nominatim). */
const ZONES = [
  { name: 'Centro', s: 20.95, w: -89.645, n: 20.99, e: -89.6 },
  { name: 'Ciudad Caucel', ...box(-89.6988, 20.9969, 1600) },
  { name: 'Juan Pablo II', ...box(-89.6789, 20.9698, 900) },
  { name: 'Miguel Hidalgo', ...box(-89.6423, 20.9891, 800) },
];

function box(lon: number, lat: number, radiusM: number) {
  const dLat = radiusM / 111320;
  const dLon = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  return { s: lat - dLat, w: lon - dLon, n: lat + dLat, e: lon + dLon };
}

const bb = (b: { s: number; w: number; n: number; e: number }) => `(${b.s},${b.w},${b.n},${b.e})`;
const query = `[out:json][timeout:180];
(
  way["highway"~"^(${ARTERIALS})$"]${bb(CITY)};
${ZONES.map((z) => `  way["highway"~"^(${ARTERIALS}|${LOCAL})$"]${bb(z)};`).join(String.fromCharCode(10))}
);
out body;
>;
out skel qt;`;

interface OsmNode { type: 'node'; id: number; lat: number; lon: number }
interface OsmWay { type: 'way'; id: number; nodes: number[]; tags?: Record<string, string> }

const res = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'aguaruta-hackathon/0.1' },
  body: 'data=' + encodeURIComponent(query),
});
if (!res.ok) throw new Error(`Overpass respondió ${res.status}`);
const osm = (await res.json()) as { elements: (OsmNode | OsmWay)[] };

const nodes = new Map<number, Position>();
const ways: OsmWay[] = [];
for (const el of osm.elements) {
  if (el.type === 'node') nodes.set(el.id, [round(el.lon), round(el.lat)]);
  else if (el.type === 'way') ways.push(el);
}

// Un nodo usado por más de una vía (o repetido) es un cruce: ahí se corta el tramo.
const uses = new Map<number, number>();
for (const w of ways) for (const id of w.nodes) uses.set(id, (uses.get(id) ?? 0) + 1);

// Puntos bajos SINTÉTICOS (mismos que la versión anterior): mercado / Calle 60 x 61 y dos más.
const DEPRESSIONS = [
  { center: [-89.6237, 20.9668] as Position, radiusM: 260, depthM: 2.6 },
  { center: [-89.6135, 20.9585] as Position, radiusM: 220, depthM: 2.2 },
  { center: [-89.6325, 20.9735] as Position, radiusM: 200, depthM: 1.9 },
  { center: [-89.7010, 20.9990] as Position, radiusM: 380, depthM: 2.4 },
  { center: [-89.6930, 20.9905] as Position, radiusM: 300, depthM: 2.0 },
  { center: [-89.6790, 20.9690] as Position, radiusM: 280, depthM: 2.2 },
  { center: [-89.6420, 20.9890] as Position, radiusM: 240, depthM: 2.0 },
  { center: [-89.5900, 21.0200] as Position, radiusM: 350, depthM: 1.8 },
  { center: [-89.6600, 20.9300] as Position, radiusM: 350, depthM: 1.8 },
];

function round(x: number, d = 6) {
  return Math.round(x * 10 ** d) / 10 ** d;
}

/** Ruido determinista por id de tramo (sin Math.random: mismo resultado en cada corrida). */
function noise(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

function attrs(id: string, coords: Position[]) {
  const mid = coords[Math.floor(coords.length / 2)]!;
  let z = 0.3 + noise(id) * 1.2;
  for (const d of DEPRESSIONS) z -= d.depthM * Math.exp(-((haversineM(mid, d.center) / d.radiusM) ** 2));
  const relativeElevationM = round(z, 2);
  const inDepression = relativeElevationM < -0.8;
  const r = noise(id + 'h');
  const historicalFloodCount = inDepression ? 2 + Math.floor(r * 4) : r < 0.1 ? 1 : 0;
  return { relativeElevationM, inDepression, historicalFloodCount };
}

/** Largo máximo de un tramo (m). Los cortes sin cruce usan un nodo de OSM, así el grafo sigue conectado. */
const MAX_SEG_M = 120;
const segments: StreetSegment[] = [];
for (const w of ways) {
  const name = w.tags?.name ?? w.tags?.ref ?? null;
  let current: Position[] = [];
  let part = 0;
  w.nodes.forEach((nid, i) => {
    const p = nodes.get(nid);
    if (!p) return;
    current.push(p);
    const isCut = i > 0 && (i === w.nodes.length - 1 || (uses.get(nid) ?? 0) > 1);
    // Corta en cruces y también cada ~120 m, para que solo se marque la parte de la calle que se inunda.
    const runM = current.slice(1).reduce((s, q, k) => s + haversineM(current[k]!, q), 0);
    if ((isCut || runM >= MAX_SEG_M) && current.length >= 2) {
      const segmentId = `seg_${w.id.toString(36)}_${part++}`;
      if (runM >= 3) {
        segments.push({ segmentId, name, geometry: { type: 'LineString', coordinates: current }, ...attrs(segmentId, current) });
      }
      current = [p];
    }
  });
}

writeFileSync(join(DATA_DIR, 'segments.json'), JSON.stringify(segments));
console.log(
  `OSM: ${ways.length} vías → ${segments.length} tramos (en depresión: ${segments.filter((s) => s.inDepression).length}, ` +
    `con nombre: ${segments.filter((s) => s.name).length})`,
);
