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
const BBOX = { s: 20.95, w: -89.645, n: 20.99, e: -89.6 };
const HIGHWAYS = 'primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|trunk|trunk_link|residential|unclassified|living_street';

const query = `[out:json][timeout:90];
way["highway"~"^(${HIGHWAYS})$"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
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
    if (isCut && current.length >= 2) {
      const segmentId = `seg_${w.id.toString(36)}_${part++}`;
      const lenM = current.slice(1).reduce((s, q, k) => s + haversineM(current[k]!, q), 0);
      if (lenM >= 3) {
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
